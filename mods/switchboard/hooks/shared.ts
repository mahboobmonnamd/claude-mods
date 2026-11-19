// Helpers every plugin in this pack uses. Each plugin folder carries its own copy
// (hooks/shared.ts) because a plugin is installed on its own; `sh tools/sync-shared.sh`
// copies this file into all of them.
import type { EngineInterface } from 'claude-code'

export const estimate = (text: string) => Math.ceil(text.length / 4)
export const short = (text: string, n: number) => (text.length > n ? `${text.slice(0, n - 1)}…` : text)
export const fmt = (n: number) => (Math.abs(n) >= 10_000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)))

// Secrets are masked before any text is handed to a helper model.
const SECRETS: [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[private key removed]'],
  [/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}\b/g, '[key removed]'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, '[github token removed]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '[aws key removed]'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, '[slack token removed]'],
  [/\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}\b/g, '[jwt removed]'],
  [/\b(Bearer|Basic)\s+[\w.~+/=-]{16,}/gi, '$1 [removed]'],
  [/((?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)["']?\s*[:=]\s*["']?)[^\s"',;]{6,}/gi, '$1[removed]'],
]
export const redact = (text: string) => SECRETS.reduce((out, [re, to]) => out.replace(re, to), text)

const trim = (s: string) => s.trim().replace(/\/+$/, '')

/** Where this pack keeps its ledger, switches and handoffs. */
export async function dataDir($: EngineInterface): Promise<string> {
  const config = trim((await $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined)) ?? '')
  const home = trim((await $.env.get('HOME').catch(() => undefined)) ?? '')
  return `${config || `${home}/.claude`}/token-mods`
}

export async function appendLine($: EngineInterface, file: string, line: string): Promise<void> {
  await $.process.run(['/bin/sh', '-c', 'mkdir -p "$(dirname "$1")" && cat >> "$1"', 'sh', file], {
    stdin: `${line}\n`,
    timeoutMs: 10_000,
  })
}

export type LedgerRow = {
  mod: string
  kind: 'route' | 'reread' | 'decision' | 'event'
  /** What was routed: a path, a command or a tool name. */
  source?: string
  before?: number
  after?: number
  /** What the helper model cost, in tokens. */
  helper?: { model: string; in: number; out: number }
  note?: string
}

/** One JSON line in <data>/ledger.jsonl; the savings plugin reads it. */
export async function ledger($: EngineInterface, row: LedgerRow): Promise<void> {
  try {
    await appendLine($, `${await dataDir($)}/ledger.jsonl`, JSON.stringify({ t: await $.clock.now(), ...row }))
  } catch {
    // A ledger that cannot be written never blocks the work.
  }
}

// <data>/switches.json is {"<plugin>": false} to turn one off; the /mods command writes it.
// Read on demand and cached for a few seconds, so nothing polls.
let cached: { at: number; map: Record<string, boolean> } | undefined

export async function switches($: EngineInterface): Promise<Record<string, boolean>> {
  const now = await $.clock.now()
  if (cached && now - cached.at < 5000) return cached.map
  let map: Record<string, boolean> = {}
  try {
    const file = `${await dataDir($)}/switches.json`
    if (await $.fs.exists(file)) map = JSON.parse(String(await $.fs.read(file))) as Record<string, boolean>
  } catch {
    map = {}
  }
  cached = { at: now, map }
  return map
}

export async function isOn($: EngineInterface, plugin: string): Promise<boolean> {
  return (await switches($))[plugin] !== false
}

export async function writeSwitches($: EngineInterface, map: Record<string, boolean>): Promise<void> {
  const file = `${await dataDir($)}/switches.json`
  await $.process.run(['/bin/sh', '-c', 'mkdir -p "$(dirname "$1")" && cat > "$1"', 'sh', file], {
    stdin: JSON.stringify(map, null, 2),
    timeoutMs: 10_000,
  })
  cached = undefined
}
