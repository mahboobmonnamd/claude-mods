import type { EngineInterface, Register } from 'claude-code'

import { dataDir, fmt, isOn } from './shared.ts'

type Row = {
  t: number
  mod: string
  kind: 'route' | 'reread' | 'decision' | 'event'
  source?: string
  before?: number
  after?: number
  helper?: { model: string; in: number; out: number }
  note?: string
}

const DAY = 24 * 60 * 60_000

async function load($: EngineInterface): Promise<Row[]> {
  const file = `${await dataDir($)}/ledger.jsonl`
  if (!(await $.fs.exists(file))) return []
  const rows: Row[] = []
  for (const line of String(await $.fs.read(file)).split('\n')) {
    if (!line.trim()) continue
    try {
      const r = JSON.parse(line) as Row
      if (typeof r.t === 'number' && typeof r.mod === 'string' && typeof r.kind === 'string') rows.push(r)
    } catch {
      // A damaged line is skipped, never fatal.
    }
  }
  return rows
}

type Tally = { routed: number; gross: number; reread: number; helperIn: number; helperOut: number; rerouted: number }

// A route whose source was read again afterwards did not save what it claimed: Claude paid for the full text anyway.
// Those savings are taken back, so the figure is net of the notes not being enough.
function tally(rows: Row[]): Tally {
  const reread = new Set(rows.filter(r => r.kind === 'reread').map(r => `${r.mod}\n${r.source}`))
  const t: Tally = { routed: 0, gross: 0, reread: 0, helperIn: 0, helperOut: 0, rerouted: 0 }
  for (const r of rows) {
    if (r.helper) {
      t.helperIn += r.helper.in
      t.helperOut += r.helper.out
    }
    if (r.kind !== 'route') continue
    t.routed += 1
    const saved = (r.before ?? 0) - (r.after ?? 0)
    if (reread.has(`${r.mod}\n${r.source}`)) {
      t.rerouted += 1
      t.reread += saved
    } else {
      t.gross += saved
    }
  }
  return t
}

const line = (label: string, t: Tally) =>
  `${label.padEnd(10)} ${String(t.routed).padStart(4)} routed · net ${fmt(t.gross)} tokens saved` +
  (t.rerouted ? ` (${t.rerouted} re-read, ${fmt(t.reread)} taken back)` : '') +
  ` · helper cost ${fmt(t.helperIn)} in / ${fmt(t.helperOut)} out`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'savings', description: 'What the token-saving plugins saved: this chat, today, all time, by plugin' })
    return next(e)
  })

  on('command.run', { command: 'savings' }, async $ => {
    if (!(await isOn($, 'savings-proof'))) return { text: 'Savings proof is off. /mods on savings-proof turns it on.' }
    const rows = await load($)
    if (rows.length === 0) return { text: 'Nothing in the ledger yet. It fills as the other plugins act.' }
    const now = await $.clock.now()
    const started = (await $.session.usage()).startedAt
    const out = [
      line('This chat', tally(rows.filter(r => r.t >= started))),
      line('Today', tally(rows.filter(r => r.t >= now - DAY))),
      line('All time', tally(rows)),
      '',
      'By plugin (all time):',
    ]
    for (const mod of [...new Set(rows.map(r => r.mod))].sort()) out.push(`  ${line(mod, tally(rows.filter(r => r.mod === mod))).trim()}`)
    out.push('', 'Tokens are estimated at 4 characters each. Helper cost is what the Haiku calls used, so subtract it by eye; a saved token is not priced here because cache reads and writes differ by chat.')
    return { text: out.join('\n') }
  })
}
