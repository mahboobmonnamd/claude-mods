import type { Register } from 'claude-code'

const MARKER = '=== SUMMARY ==='

const INSTRUCTION = `Reader-friendly output style (applies to every reply, scaled to its size):
- Lead with the outcome in one plain sentence. No preamble, no restating the question.
- Short answers stay short: one or two sentences, no labels.
- Bigger answers use short labeled blocks, each label in capitals on its own line, a blank line between blocks, and only the blocks that apply: DONE (the outcome), CHANGED (what and why, as "- " bullets), FILES (paths touched, one per line), NEEDS YOUR CALL (open questions or decisions), NEXT (suggested next step).
- Keep bullets to one line each. Put paths and commands on their own lines. Prefer plain words over jargon; explain any term the reader may not know.
- Plain text only: no markdown tables, headings, bold, emoji or box characters.
- When you finish a task that used tools, put a line containing exactly "${MARKER}" right before the labeled blocks (DONE onward) in your final message, so the blocks can be copied cleanly. Skip it for conversational answers.`

const plain = (text: string) =>
  text
    .replace(/\*\*|__|`/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .trim()

export const register: Register = on => {
  let toolCount = 0

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    return {
      sections: [
        ...composed.sections,
        { id: `${$.plugin.name}:summary`, text: INSTRUCTION, scope: 'session' },
      ],
    }
  })

  on('turn.start', ($, e, next) => {
    if (e.agentId === undefined) toolCount = 0
    return next(e)
  })

  on('tool.call', ($, e, next) => {
    toolCount += 1
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer' || toolCount === 0) return result

    const at = e.answer.lastIndexOf(MARKER)
    if (at === -1) return result

    const summary = plain(e.answer.slice(at + MARKER.length))
    if (summary === '') return result

    const copied = await $.ui.copy({ text: summary })
    $.ui.toast(copied.isCopied ? 'Summary copied to clipboard' : 'Summary not copied')
    return result
  })
}
