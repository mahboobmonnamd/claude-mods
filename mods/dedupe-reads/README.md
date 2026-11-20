# dedupe-reads

When Claude reads a whole file it has already read in this chat, and the text has not changed, the result is replaced by a one-line pointer to the earlier read. A changed file is always passed through whole. The memory is cleared on compaction, because the earlier read is gone then.

Command: `/dedupe-reads`

## Install

```
/plugin marketplace add mahboobmonnamd/claude-mods
/plugin install dedupe-reads@claude-mods
```

Part of the Lean pack; see the repo README.
