import type { Register } from 'claude-code'

import { fmt, isOn, ledger } from './shared.ts'

const NAME = 'browser-shrink'
// Tools that drive a browser and hand back screenshots.
const BROWSER = /browser|playwright|puppeteer|chrome|computer|screenshot/i
const MAX_SIDE = 1024
// A screenshot costs about width x height / 750 tokens.
const tokensOf = (w: number, h: number) => Math.ceil((w * h) / 750)

// stdin: base64 of the image; $1 is the longest side to allow.
// stdout: sips' own size report for the input, the same for the output, then a marker line and the output as base64.
// Everything lives in one temp directory that is removed on the way out.
const SHRINK = `
set -e
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
base64 -D > "$work/in"
sips -g pixelWidth -g pixelHeight "$work/in"
sips -Z "$1" "$work/in" --out "$work/out" > /dev/null
sips -g pixelWidth -g pixelHeight "$work/out"
echo "---"
base64 -i "$work/out"
`

/** Reads "pixelWidth: 800" and "pixelHeight: 600" out of one sips report. */
function sizeOf(report: string): [number, number] {
  const w = /pixelWidth:\s*(\d+)/.exec(report)
  const h = /pixelHeight:\s*(\d+)/.exec(report)
  return [Number(w?.[1] ?? 0), Number(h?.[1] ?? 0)]
}

type Image = { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
const isImage = (b: unknown): b is Image => !!b && typeof b === 'object' && (b as { type?: string }).type === 'image' && (b as Image).source?.type === 'base64'

export const register: Register = on => {
  const browserCalls = new Set<string>()
  let one = false

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: NAME, description: 'Browser screenshot shrinker: full lets the next screenshot through whole' })
    return next(e)
  })

  on('command.run', { command: NAME }, async ($, e) => {
    if (e.args.trim() === 'full') {
      one = true
      return { text: 'The next screenshot comes through at full size.' }
    }
    const s = ((await $.store.get('stats')) ?? { n: 0, before: 0, after: 0 }) as { n: number; before: number; after: number }
    return { text: `Browser shrink: ${s.n} screenshots cut to ${MAX_SIDE}px on the long side, about ${fmt(s.before - s.after)} tokens saved.` }
  })

  on('tool.call', async ($, e, next) => {
    if (BROWSER.test(String(e.tool))) {
      browserCalls.add(e.tool_use_id)
      if (browserCalls.size > 200) browserCalls.delete(browserCalls.values().next().value as string)
    }
    return next(e)
  })

  on('session.append', { door: 'tool-result' }, async ($, e, next) => {
    if (!(await isOn($, NAME))) return next(e)
    let changed = false
    const content = await Promise.all(
      e.message.content.map(async block => {
        if (block.type !== 'tool_result' || !browserCalls.has(String(block.tool_use_id)) || !Array.isArray(block.content)) return block
        const parts = await Promise.all(
          (block.content as unknown[]).map(async part => {
            if (!isImage(part)) return part
            if (one) {
              one = false
              return part
            }
            try {
              const r = await $.process.run(['/bin/sh', '-c', SHRINK, 'sh', String(MAX_SIDE)], { stdin: part.source.data, timeoutMs: 15_000 })
              const [reports = '', encoded = ''] = r.stdout.split('\n---\n')
              // sips prints the file's path, then its sizes; the second report starts at the output's path.
              const cut = reports.lastIndexOf('/out')
              const [w0, h0] = sizeOf(reports.slice(0, Math.max(cut, 0)))
              const [w1, h1] = sizeOf(reports.slice(Math.max(cut, 0)))
              const data = encoded.trim()
              if (r.exitCode !== 0 || !data || !w0 || !h0 || !w1 || !h1 || w1 * h1 >= w0 * h0) return part
              const before = tokensOf(w0, h0)
              const after = tokensOf(w1, h1)
              const s = ((await $.store.get('stats')) ?? { n: 0, before: 0, after: 0 }) as { n: number; before: number; after: number }
              await $.store.set('stats', { n: s.n + 1, before: s.before + before, after: s.after + after })
              await ledger($, { mod: NAME, kind: 'route', source: `screenshot ${w0}x${h0} → ${w1}x${h1}`, before, after })
              changed = true
              return { ...part, source: { ...part.source, data } }
            } catch {
              return part
            }
          }),
        )
        return { ...block, content: parts }
      }),
    )
    return changed ? next({ ...e, message: { ...e.message, content } }) : next(e)
  })
}
