# effort-tuner

Suggests the effort level a prompt needs (default), or sets it before each turn in auto mode. Approvals ("yes", "go") keep the level; plainly hard or trivial prompts are decided locally; only ambiguous ones cost a Haiku call.

Command: `/effort-tuner off|suggest|auto`

## Install

```
/plugin marketplace add mahboobmonnamd/claude-mods
/plugin install effort-tuner@claude-mods
```

Part of the Lean pack; see the repo README.
