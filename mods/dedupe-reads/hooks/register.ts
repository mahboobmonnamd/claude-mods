import type { Register } from 'claude-code'

import { estimate, fmt, isOn, ledger, short } from './shared.ts'

const NAME = 'dedupe-reads'
// A pointer costs about 40 tokens; below this the saving is not worth the indirection.
const MIN_TOKENS = 300

// Two cheap hashes and the length: an unchanged file matches all three, an edited one almost never does.
const fingerprint = (text: string): string => {
  let a = 0x811c9dc5
  let b = 5381
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193) >>> 0
    b = (Math.imul(b, 33) + c) >>> 0
  }
  return `${text.length}:${a.toString(16)}:${b.toString(16)}`
}

type Block = { type: string; text?: string; [k: string]: unknown }

export const register: Register = on => {
  // Whole-file reads only: a ranged read is a different question each time.
  const calls = new Map<string, string>()
  // path -> fingerprint of the text Claude was last given for it, and its size.
  const seen = new Map<string, { print: string; tokens: number }>()

  on('session.start', async ($, e, next) => {
    seen.clear()
    await $.command.register({ name: NAME, description: 'Dedupe reads: how many repeated file reads were replaced by a pointer' })
    return next(e)
  })

  on('command.run', { command: NAME }, async $ => {
    const s = ((await $.store.get('stats')) ?? { n: 0, tokens: 0 }) as { n: number; tokens: number }
    return { text: `Dedupe reads replaced ${s.n} unchanged file reads, about ${fmt(s.tokens)} tokens. Switch it with /switches.` }
  })

  // After a compaction the earlier read is gone from the chat, so a pointer to it would point at nothing.
  on('session.compact', async ($, e, next) => {
    seen.clear()
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === 'Read') {
      const args = e as unknown as Record<string, unknown>
      const isRanged = args.offset !== undefined || args.limit !== undefined || args.pages !== undefined
      if (!isRanged && typeof args.file_path === 'string') {
        calls.set(e.tool_use_id, args.file_path)
        if (calls.size > 100) calls.delete(calls.keys().next().value as string)
      }
    }
    // A file Claude just changed is expected to read differently; the text comparison below would catch it, this only
    // spares a stale entry from sitting around.
    if (e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'MultiEdit') {
      const path = (e as unknown as { file_path?: unknown }).file_path
      if (typeof path === 'string') seen.delete(path)
    }
    return next(e)
  })

  on('session.append', { door: 'tool-result' }, async ($, e, next) => {
    if (!(await isOn($, NAME))) return next(e)
    let changed = false
    const content = await Promise.all(
      e.message.content.map(async block => {
        if (block.type !== 'tool_result' || block.is_error === true) return block
        const path = calls.get(String(block.tool_use_id))
        if (path === undefined) return block
        const parts: Block[] = typeof block.content === 'string' ? [{ type: 'text', text: block.content }] : Array.isArray(block.content) ? (block.content as Block[]) : []
        if (parts.length === 0 || parts.some(p => p.type !== 'text' || typeof p.text !== 'string')) return block

        const original = parts.map(p => p.text as string).join('\n')
        const tokens = estimate(original)
        if (tokens < MIN_TOKENS) return block
        const print = fingerprint(original)
        const before = seen.get(path)
        seen.set(path, { print, tokens })
        if (before === undefined || before.print !== print) return block

        const text = `[Dedupe Reads · ${short(path, 160)} is unchanged since you read it earlier in this chat (${fmt(tokens)} tokens). Use that earlier copy. To see it again, read a line range.]`
        const after = estimate(text)
        const s = ((await $.store.get('stats')) ?? { n: 0, tokens: 0 }) as { n: number; tokens: number }
        await $.store.set('stats', { n: s.n + 1, tokens: s.tokens + tokens - after })
        await ledger($, { mod: NAME, kind: 'route', source: path, before: tokens, after })
        changed = true
        return { ...block, content: [{ type: 'text', text }] }
      }),
    )
    return changed ? next({ ...e, message: { ...e.message, content } }) : next(e)
  })
}
