# chat-handoff

Writes a handoff of the chat from a cache-reading fork, saves it under ~/.claude/token-mods/handoffs/, copies it, and reminds you once when the chat passes 250k tokens (change or turn off with nudge).

Command: `/handoff, /handoff nudge <tokens>`

## Install

```
/plugin marketplace add mahboobmonnamd/claude-mods
/plugin install chat-handoff@claude-mods
```

Part of the Lean pack; see the repo README.
