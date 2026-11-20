import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Snapshot, Totals } from '../types'
import { fmt, loadLedger, short, tally } from './shared.ts'
import type { LedgerEntry } from './shared.ts'

const NAME = 'cost-ledger'
const PANE = 'cost-ledger'
const DAY = 24 * 60 * 60_000
const RECENT = 12

const EMPTY: Snapshot = {
  chat: { routed: 0, saved: 0, reread: 0, helperIn: 0, helperOut: 0 },
  today: { routed: 0, saved: 0, reread: 0, helperIn: 0, helperOut: 0 },
  all: { routed: 0, saved: 0, reread: 0, helperIn: 0, helperOut: 0 },
  byMod: [],
  recent: [],
}

// Change the tag when the snapshot's fields change: it declines what an earlier version stored.
const snapshot = atom({ plugin: 'cost-ledger', key: 'snapshot' } as const, EMPTY, { shape: 'snapshot-1' })

const totals = (rows: LedgerEntry[]): Totals => {
  const t = tally(rows)
  return { routed: t.routed, saved: t.gross, reread: t.reread, helperIn: t.helperIn, helperOut: t.helperOut }
}

async function refresh($: EngineInterface) {
  const rows = await loadLedger($)
  const now = await $.clock.now()
  const started = (await $.session.usage()).startedAt
  const next: Snapshot = {
    chat: totals(rows.filter(r => r.t >= started)),
    today: totals(rows.filter(r => r.t >= now - DAY)),
    all: totals(rows),
    byMod: [...new Set(rows.map(r => r.mod))].sort().map(mod => ({ mod, ...totals(rows.filter(r => r.mod === mod)) })),
    recent: rows
      .filter(r => r.kind === 'route')
      .slice(-RECENT)
      .reverse()
      .map(r => ({ t: r.t, mod: r.mod, source: short(r.source ?? '', 60), saved: (r.before ?? 0) - (r.after ?? 0) })),
  }
  await update($, snapshot, () => next)
}

export const register: Register = on => {
  // Refreshing reads the whole ledger, so it only runs while the pane is open.
  let isOpen = false

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: NAME, description: 'Open a pane with what the token-saving plugins saved, net of re-reads, and what their helper calls cost' })
    return next(e)
  })

  on('command.run', { command: NAME }, async $ => {
    isOpen = true
    await refresh($)
    const placed = await $.ui.open({ id: PANE, title: 'Cost ledger' })
    return { text: placed.isPlaced ? 'Cost ledger pane opened.' : 'The pane needs a wider terminal. /savings prints the same figures as text.' }
  })

  on('turn.complete', async ($, e, next) => {
    if (isOpen) await refresh($)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const s = await read($, snapshot)
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 14 - s.byMod.length)
    const row = (label: string, t: Totals) => (
      <Text>
        {label.padEnd(9)} {String(t.routed).padStart(4)} routed · saved {fmt(t.saved)}
        {t.reread > 0 ? ` (${fmt(t.reread)} taken back)` : ''} · helper {fmt(t.helperIn)} in / {fmt(t.helperOut)} out
      </Text>
    )

    return (
      <Box flexDirection="column">
        {s.all.routed === 0 && s.all.helperIn === 0 && <Text dimColor>Nothing in the ledger yet. It fills as the other plugins act.</Text>}
        {row('This chat', s.chat)}
        {row('Today', s.today)}
        {row('All time', s.all)}
        <Text> </Text>
        <Text dimColor>By plugin</Text>
        {s.byMod.map(m => row(m.mod, m))}
        <Text> </Text>
        <Text dimColor>Latest</Text>
        {s.recent.slice(0, room).map(r => (
          <Text>
            {r.mod} · {r.source} · {r.saved >= 0 ? `-${fmt(r.saved)}` : `+${fmt(-r.saved)}`}
          </Text>
        ))}
        <Text dimColor>Tokens are estimated at 4 characters each.</Text>
      </Box>
    )
  })
}
