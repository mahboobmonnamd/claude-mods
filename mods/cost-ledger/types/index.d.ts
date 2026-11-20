export type Totals = { routed: number; saved: number; reread: number; helperIn: number; helperOut: number }

export type Snapshot = {
  chat: Totals
  today: Totals
  all: Totals
  byMod: ({ mod: string } & Totals)[]
  recent: { t: number; mod: string; source: string; saved: number }[]
}

declare module 'claude-code' {
  interface PluginState {
    'cost-ledger': { snapshot: Shaped<Snapshot> }
  }
}
