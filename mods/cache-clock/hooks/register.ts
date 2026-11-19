import type { EngineInterface, Register } from 'claude-code'

import { fmt, isOn, ledger } from './shared.ts'

const NAME = 'cache-clock'
const MINUTE = 60_000
const LEAD = 45_000
// Under this a cold restart is cheap enough that pinging is not worth a call.
const MIN_TOKENS = 20_000
const MAX_FAILS = 3

// Prices as multiples of the base input price: a cache write costs 1.25x (5 min) or 2x (1 hour),
// a read 0.1x. A cold restart pays the write once; each ping pays a read. Past the break-even
// number of pings, letting the cache go cold would have been cheaper.
const WRITE = { '5m': 1.25, '1h': 2 } as const
const READ = 0.1
const breakEven = (ttl: Ttl) => Math.floor((WRITE[ttl] - READ) / READ)

type Ttl = '5m' | '1h'
const ttlMs = (t: Ttl) => (t === '1h' ? 60 * MINUTE : 5 * MINUTE)

/** m:ss for a number of milliseconds, never below zero. */
function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.trunc(total / 60)
  const seconds = total - minutes * 60
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}

type Warm = { pings: number; fails: number; startedAt: number; sending: boolean }

// Module state: a reload starts it over, which only ever turns keep-warm off.
let ttl: Ttl | undefined
let lastEnd = 0
let tokens = 0
let working = false
let warm: Warm | null = null
let stop: { cancel: () => void } | undefined

async function ttlNow($: EngineInterface): Promise<Ttl> {
  ttl ??= ((await $.store.get('ttl')) as Ttl | undefined) ?? '5m'
  return ttl
}

async function draw($: EngineInterface) {
  if (!lastEnd || !(await isOn($, NAME))) return $.ui.status(undefined)
  const t = await ttlNow($)
  const left = lastEnd + ttlMs(t) - (await $.clock.now())
  const note = warm ? ` · keeping warm (${warm.pings}/${breakEven(t)})` : ''
  $.ui.status(left > 0 ? `cache ${clock(left)}${note}` : `cache cold (${fmt(tokens)} tokens to rewrite)`)
}

async function stopWarm($: EngineInterface, why: string) {
  if (!warm) return
  await ledger($, { mod: NAME, kind: 'event', note: `keep-warm off after ${warm.pings} pings: ${why}` })
  warm = null
  $.ui.toast(`Keep warm stopped: ${why}`)
}

async function tick($: EngineInterface) {
  await draw($)
  if (!warm || warm.sending || working) return
  const t = await ttlNow($)
  const now = await $.clock.now()
  if (warm.pings >= breakEven(t)) return stopWarm($, `${warm.pings} pings is the break-even against one cold restart`)
  if (now - warm.startedAt >= 2 * 60 * MINUTE) return stopWarm($, 'two hours')
  if (now < lastEnd + ttlMs(t) - LEAD) return
  const mine = warm
  mine.sending = true
  try {
    const r = await $.model.fork({ prompt: 'Reply with the single word: ok' })
    if (!r.isAnswered) throw new Error(r.reason)
    mine.pings += 1
    mine.fails = 0
    lastEnd = await $.clock.now()
    await ledger($, { mod: NAME, kind: 'event', note: `ping ${mine.pings}`, helper: { model: 'fork', in: r.usage.input_tokens + (r.usage.cache_read_input_tokens ?? 0), out: r.usage.output_tokens } })
  } catch (err) {
    mine.fails += 1
    if (mine.fails >= MAX_FAILS) await stopWarm($, `${MAX_FAILS} pings in a row failed (${String(err).slice(0, 80)})`)
  } finally {
    mine.sending = false
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: NAME, description: 'Cache clock: ttl 5m|1h, warm on|off, status' })
    stop?.cancel()
    stop = $.clock.every(1000, () => {
      void tick($).catch(() => undefined)
    })
    return next(e)
  })

  on('command.run', { command: NAME }, async ($, e) => {
    const [verb = 'status', arg = ''] = e.args.trim().toLowerCase().split(/\s+/)
    const t = await ttlNow($)
    if (verb === 'ttl') {
      if (arg !== '5m' && arg !== '1h') return { text: `Usage: /${NAME} ttl 5m|1h (now ${t}). The cache length is whatever your plan uses; 1h costs more to write.` }
      ttl = arg
      await $.store.set('ttl', arg)
      return { text: `Cache length set to ${arg}.` }
    }
    if (verb === 'warm') {
      if (arg === 'off') {
        await stopWarm($, 'turned off')
        return { text: 'Keep warm is off.' }
      }
      if (!lastEnd) return { text: "Nothing to keep warm yet. It works after Claude's first reply." }
      if (tokens < MIN_TOKENS) return { text: `This chat is under ${fmt(MIN_TOKENS)} tokens. A cold restart costs less than the pings, so keep warm stays off.` }
      warm = { pings: 0, fails: 0, startedAt: await $.clock.now(), sending: false }
      return { text: `Keep warm is on: one small ping about 45 s before the cache goes cold, at most ${breakEven(t)} (the break-even against one cold restart) or two hours. Sending a message stops it.` }
    }
    return { text: `Cache length ${t}. ${lastEnd ? `Last reply ${clock((await $.clock.now()) - lastEnd)} ago, ${fmt(tokens)} tokens in context.` : 'No reply yet.'} Keep warm is ${warm ? `on (${warm.pings} pings)` : 'off'}.` }
  })

  on('turn.start', async ($, e, next) => {
    working = true
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    working = false
    lastEnd = await $.clock.now()
    tokens = (await $.session.usage()).context.tokens ?? 0
    await draw($)
    return next(e)
  })

  // A message from the person is a real request: the cache is theirs to use, and a ping would only get in the way.
  on('prompt.submit', async ($, e, next) => {
    if (warm && !e.isMeta) await stopWarm($, 'you sent a message')
    return next(e)
  })
}
