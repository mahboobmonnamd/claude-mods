# model-router

Before a subagent starts, Haiku picks its model tier. Cheaper needs 0.75 confidence, dearer 0.3, and risk above 0.5 forces the deepest model. A call that names a model is left alone. Limit: it does not retry a failed cheaper subagent on a stronger model.

Command: `/model-router`

## Install

```
/plugin marketplace add mahboobmonnamd/claude-mods
/plugin install model-router@claude-mods
```

Part of the token-saving pack; see the repo README.
