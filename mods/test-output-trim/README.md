# test-output-trim

Test runs (npm test, pytest, go test, cargo test, jest, vitest, and more) over 1,200 tokens are cut to the head, the tail and every failure with its context. The full output is saved under `~/.claude/token-mods/test-logs/` (newest 20 kept) and its path is in the note. No model call. If the log cannot be saved, nothing is cut.

Command: `/test-output-trim`. Extra commands to match can be set in the plugin's options.

## Install

```
/plugin marketplace add mahboobmonnamd/claude-mods
/plugin install test-output-trim@claude-mods
```

Part of the Lean pack; see the repo README.
