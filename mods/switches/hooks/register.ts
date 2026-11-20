import type { Register } from 'claude-code'

import { switches, writeSwitches } from './shared.ts'

// The plugins of this pack. Each one checks <data>/switches.json before it acts, so a switch works in every chat
// at once without any of them polling.
const PACK: Record<string, string> = {
  'trim-output': 'Haiku notes in place of big file, shell and connector output',
  'effort-tuner': 'suggests or sets the effort level per prompt',
  'agent-model-picker': 'picks the model of each subagent',
  'cache-timer': 'prompt cache countdown and keep-warm',
  'chat-handoff': 'writes a handoff of a long chat',
  'trim-web': 'shortens big web results',
  'trim-shots': 'shrinks browser screenshots',
  'savings-meter': 'reports what the pack saved',
  'dedupe-reads': 'points at an earlier read instead of repeating an unchanged file',
  'test-output-trim': 'cuts test runs to their failures and summary',
  'cost-ledger': 'side pane over the savings ledger',
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'switches', description: 'Switch the token-saving plugins: /switches | /switches off <name> | /switches on <name> | /switches off all' })
    return next(e)
  })

  on('command.run', { command: 'switches' }, async ($, e) => {
    const [verb = '', target = ''] = e.args.trim().toLowerCase().split(/\s+/)
    const map = { ...(await switches($)) }
    if ((verb === 'on' || verb === 'off') && target) {
      const names = target === 'all' ? Object.keys(PACK) : [target]
      const unknown = names.filter(n => !(n in PACK))
      if (unknown.length) return { text: `Unknown: ${unknown.join(', ')}. Known: ${Object.keys(PACK).join(', ')}.` }
      for (const n of names) map[n] = verb === 'on'
      await writeSwitches($, map)
    } else if (verb) {
      return { text: 'Usage: /switches | /switches off <name> | /switches on <name> | /switches off all' }
    }
    const rows = Object.entries(PACK).map(([name, what]) => `${map[name] === false ? 'off' : 'on '}  ${name.padEnd(17)} ${what}`)
    return { text: `${rows.join('\n')}\n\nA switch applies to every chat on its next action.` }
  })
}
