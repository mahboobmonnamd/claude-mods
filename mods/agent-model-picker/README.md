# agent-model-picker

Before a subagent starts, Haiku picks its model tier. Cheaper needs 0.75 confidence, dearer 0.3, and risk above 0.5 forces the deepest model. A call that names a model is left alone. Limit: it does not retry a failed cheaper subagent on a stronger model.

Command: `/agent-model-picker`

## Install

```
/plugin marketplace add mahboobmonnamd/claude-mods
/plugin install agent-model-picker@claude-mods
```

Part of the Lean pack; see the repo README.
