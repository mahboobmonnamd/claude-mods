import type { Register } from 'claude-code'

import { switches, writeSwitches } from './shared.ts'

// The plugins of this pack. Each one checks <data>/switches.json before it acts, so a switch works in every chat
// at once without any of them polling.
const PACK: Record<string, string> = {
  'input-router': 'Haiku notes in place of big file, shell and connector output',
  'effort-optimizer': 'suggests or sets the effort level per prompt',
  'model-router': 'picks the model of each subagent',
  'cache-clock': 'prompt cache countdown and keep-warm',
  handoff: 'writes a handoff of a long chat',
  'research-router': 'shortens big web results',
  'browser-shrink': 'shrinks browser screenshots',
  'savings-proof': 'reports what the pack saved',
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'mods', description: 'Switch the token-saving plugins: /mods | /mods off <name> | /mods on <name> | /mods off all' })
    return next(e)
  })

  on('command.run', { command: 'mods' }, async ($, e) => {
    const [verb = '', target = ''] = e.args.trim().toLowerCase().split(/\s+/)
    const map = { ...(await switches($)) }
    if ((verb === 'on' || verb === 'off') && target) {
      const names = target === 'all' ? Object.keys(PACK) : [target]
      const unknown = names.filter(n => !(n in PACK))
      if (unknown.length) return { text: `Unknown: ${unknown.join(', ')}. Known: ${Object.keys(PACK).join(', ')}.` }
      for (const n of names) map[n] = verb === 'on'
      await writeSwitches($, map)
    } else if (verb) {
      return { text: 'Usage: /mods | /mods off <name> | /mods on <name> | /mods off all' }
    }
    const rows = Object.entries(PACK).map(([name, what]) => `${map[name] === false ? 'off' : 'on '}  ${name.padEnd(17)} ${what}`)
    return { text: `${rows.join('\n')}\n\nA switch applies to every chat on its next action.` }
  })
}
