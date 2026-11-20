import type { Register } from 'claude-code'

import { fmt, isOn, loadLedger, tally } from './shared.ts'
import type { Tally } from './shared.ts'

const DAY = 24 * 60 * 60_000

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
    if (!(await isOn($, 'savings-meter'))) return { text: 'Savings meter is off. /switches on savings-meter turns it on.' }
    const rows = await loadLedger($)
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
