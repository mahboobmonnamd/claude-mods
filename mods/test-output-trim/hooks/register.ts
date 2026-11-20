import type { EngineInterface, Register } from 'claude-code'

import { dataDir, estimate, fmt, isOn, ledger, short } from './shared.ts'

const NAME = 'test-output-trim'
// Under this a test run is small enough to read whole.
const MIN_TOKENS = 1200
const KEEP_HEAD = 3
const KEEP_TAIL = 40
const BEFORE = 2
const AFTER = 8
const MAX_KEPT_LINES = 300
const KEEP_LOGS = 20

const RUNNER =
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|t)\b|\b(jest|vitest|mocha|pytest|py\.test|tox|nose2|phpunit|rspec|ctest)\b|\b(rake|mix|dotnet|swift|deno)\s+test\b|\bmvn\s+(-\S+\s+)?test\b|\bgradlew?\s+(\S+\s+)*test\b|\bgo\s+test\b|\bcargo\s+(nextest\s+run|test)\b|\bpython3?\s+-m\s+(pytest|unittest)\b|\bxcodebuild\b.*\btest\b/

// A line that reports a failure, or the detail of one.
const FAIL =
  /\b(FAIL(ED|URES?)?|ERROR|Error|error:|panic(ked)?|Traceback|AssertionError|Exception|not ok|Expected|Received|Caused by)\b|✗|✘|×|●|^\s*E\s|^---\s|^\s+at\s/
// A line that reports success: dropped from the middle of the output.
const PASS = /^\s*(✓|✔|√|PASS\b|ok\b|\.+\s*$|[\w./-]+\s+\.+\s*(\[\s*\d+%\s*\])?\s*$)/

type Trimmed = { text: string; kept: number; dropped: number }

/** Keeps the head, the tail and every failure with some context; reports what it left out. */
export function trimTestOutput(output: string): Trimmed {
  const lines = output.split('\n')
  const keep = new Set<number>()
  for (let i = 0; i < Math.min(KEEP_HEAD, lines.length); i++) keep.add(i)
  for (let i = Math.max(0, lines.length - KEEP_TAIL); i < lines.length; i++) keep.add(i)
  for (let i = 0; i < lines.length; i++) {
    if (PASS.test(lines[i]) || !FAIL.test(lines[i])) continue
    for (let j = Math.max(0, i - BEFORE); j <= Math.min(lines.length - 1, i + AFTER); j++) keep.add(j)
  }
  // A run with a flood of failures keeps its first ones and its tail, never everything.
  let order = [...keep].sort((a, b) => a - b)
  const tailStart = Math.max(0, lines.length - KEEP_TAIL)
  if (order.length > MAX_KEPT_LINES) {
    const tail = order.filter(n => n >= tailStart)
    order = [...order.filter(n => n < tailStart).slice(0, Math.max(0, MAX_KEPT_LINES - tail.length)), ...tail]
  }

  const out: string[] = []
  let last = -1
  for (const n of order) {
    if (n > last + 1) out.push(`[... ${n - last - 1} lines left out ...]`)
    out.push(lines[n])
    last = n
  }
  if (last < lines.length - 1) out.push(`[... ${lines.length - 1 - last} lines left out ...]`)
  return { text: out.join('\n'), kept: order.length, dropped: lines.length - order.length }
}

async function saveLog($: EngineInterface, text: string): Promise<string | undefined> {
  try {
    const file = `${await dataDir($)}/test-logs/${await $.clock.now()}.log`
    // Newest 20 logs stay; a test log is only useful while the run is fresh.
    await $.process.run(['/bin/sh', '-c', `d=$(dirname "$1"); mkdir -p "$d" && cat > "$1" && ls -t "$d"/*.log | tail -n +${KEEP_LOGS + 1} | xargs rm -f`, 'sh', file], {
      stdin: text,
      timeoutMs: 10_000,
    })
    return file
  } catch {
    return undefined
  }
}

type Block = { type: string; text?: string; [k: string]: unknown }

export const register: Register = (on, options) => {
  const calls = new Map<string, string>()
  const custom = (() => {
    const raw = String((options as Record<string, unknown>)?.extraPattern ?? '').trim()
    try {
      return raw === '' ? null : new RegExp(raw)
    } catch {
      return null
    }
  })()

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: NAME, description: 'Test output trim: how many long test runs were cut to their failures' })
    return next(e)
  })

  on('command.run', { command: NAME }, async $ => {
    const s = ((await $.store.get('stats')) ?? { n: 0, before: 0, after: 0 }) as { n: number; before: number; after: number }
    return { text: `Test output trim cut ${s.n} test runs, ${fmt(s.before)} → ${fmt(s.after)} tokens (saved ${fmt(s.before - s.after)}), for runs over ${fmt(MIN_TOKENS)} tokens. Full logs are in ${await dataDir($)}/test-logs. Switch it with /switches.` }
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === 'Bash') {
      const command = String((e as unknown as { command?: string }).command ?? '')
      if (RUNNER.test(command) || custom?.test(command)) {
        calls.set(e.tool_use_id, command)
        if (calls.size > 50) calls.delete(calls.keys().next().value as string)
      }
    }
    return next(e)
  })

  on('session.append', { door: 'tool-result' }, async ($, e, next) => {
    if (!(await isOn($, NAME))) return next(e)
    let changed = false
    const content = await Promise.all(
      e.message.content.map(async block => {
        // A failing run is an error result; it is the case this exists for, so is_error is not a reason to pass.
        if (block.type !== 'tool_result') return block
        const command = calls.get(String(block.tool_use_id))
        if (command === undefined) return block
        const parts: Block[] = typeof block.content === 'string' ? [{ type: 'text', text: block.content }] : Array.isArray(block.content) ? (block.content as Block[]) : []
        if (parts.length === 0 || parts.some(p => p.type !== 'text' || typeof p.text !== 'string')) return block

        const original = parts.map(p => p.text as string).join('\n')
        const before = estimate(original)
        if (before < MIN_TOKENS) return block

        const trimmed = trimTestOutput(original)
        const log = await saveLog($, original)
        // Without the full log on disk, nothing is cut: a trimmed run that cannot be recovered is a loss.
        if (log === undefined) return block
        const text = `[Test Output Trim · ${fmt(before)} → ~${fmt(estimate(trimmed.text))} tokens · ${trimmed.dropped} lines left out · full log: ${log}]\n${trimmed.text}`
        const after = estimate(text)
        if (after >= before * 0.8) return block

        const s = ((await $.store.get('stats')) ?? { n: 0, before: 0, after: 0 }) as { n: number; before: number; after: number }
        await $.store.set('stats', { n: s.n + 1, before: s.before + before, after: s.after + after })
        await ledger($, { mod: NAME, kind: 'route', source: short(command, 160), before, after })
        changed = true
        return { ...block, content: [{ type: 'text', text }] }
      }),
    )
    return changed ? next({ ...e, message: { ...e.message, content } }) : next(e)
  })
}
