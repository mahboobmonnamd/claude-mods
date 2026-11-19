import type { Register } from 'claude-code'

import { appendLine, dataDir, fmt, isOn, ledger } from './shared.ts'

const NAME = 'handoff'
const DEFAULT_NUDGE = 250_000

const BRIEF = `Write a handoff so a fresh chat can continue this work with no other context.
Use these headings: Goal, State (what is done and what is half-done), Decisions and why, Files touched (paths, one line each), Open problems, Next steps (in order), Commands to run.
Be exact with paths, names and numbers. Leave out anything that is not needed to continue. Reply with the handoff only.`

export const register: Register = on => {
  // The size already nudged about, so one long chat gets one reminder per threshold crossing.
  let nudged = false

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: NAME, description: 'Write a handoff of this chat, save and copy it. /handoff nudge <tokens> sets the reminder size (0 turns it off)' })
    return next(e)
  })

  on('command.run', { command: NAME }, async ($, e) => {
    const [verb = '', arg = ''] = e.args.trim().split(/\s+/)
    if (verb === 'nudge') {
      const n = Number(arg)
      if (!Number.isFinite(n) || n < 0) return { text: `Usage: /${NAME} nudge <tokens> (0 turns the reminder off)` }
      await $.store.set('nudge', n)
      nudged = false
      return { text: n === 0 ? 'Handoff reminder is off.' : `You will be reminded at ${fmt(n)} tokens.` }
    }

    // A fork repeats this chat's last request, so it writes from the real conversation and reads it from cache.
    const r = await $.model.fork({ prompt: BRIEF })
    if (!r.isAnswered) return { text: r.reason === 'nothing-to-fork' ? 'Nothing to hand off yet. Send a message first.' : `The handoff could not be written (${r.reason}).` }

    const text = r.text.trim()
    const stamp = new Date(await $.clock.now()).toISOString().slice(0, 19).replace(/[T:]/g, '-')
    const file = `${await dataDir($)}/handoffs/${stamp}.md`
    await appendLine($, file, text)
    const copied = await $.process.run(['/usr/bin/pbcopy'], { stdin: text, timeoutMs: 5000 }).catch(() => undefined)
    await ledger($, { mod: NAME, kind: 'event', note: `handoff written (${fmt(text.length / 4)} tokens)`, helper: { model: 'fork', in: r.usage.input_tokens + (r.usage.cache_read_input_tokens ?? 0), out: r.usage.output_tokens } })
    return {
      text: `Handoff saved to ${file}${copied?.exitCode === 0 ? ' and copied' : ''}. Start a fresh chat and paste it as the first message.\n\n${text}`,
    }
  })

  on('turn.complete', async ($, e, next) => {
    if (await isOn($, NAME)) {
      const limit = ((await $.store.get('nudge')) as number | undefined) ?? DEFAULT_NUDGE
      const size = (await $.session.usage()).context.tokens ?? 0
      if (limit > 0 && size >= limit && !nudged) {
        nudged = true
        $.ui.toast(`This chat is ${fmt(size)} tokens. Type /${NAME} to carry it into a fresh one.`)
      }
      if (size < limit * 0.5) nudged = false
    }
    return next(e)
  })
}
