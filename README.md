# claude-mods

Claude Code plugins by mahboob. Add the marketplace once, then install what you want:

```
/plugin marketplace add mahboobmonnamd/claude-mods
/plugin install <name>@claude-mods
```

## Plugins

| Plugin | What it does | Command |
|---|---|---|
| `copy-summary` | After real work, Claude ends with a plain-text summary copied to the clipboard. | |
| `input-router` | Big file reads, read-only shell output (`cat`, `grep`, `curl`...) and connector results over 6,000 tokens are trimmed, then summarised by Haiku. Secrets are masked first. | `/input-router` |
| `effort-optimizer` | Picks the reasoning effort a prompt needs. Most prompts are decided locally with no model call. | `/effort-optimizer` |
| `model-router` | Picks each subagent's model with a Haiku judge and confidence bars. | `/model-router` |
| `cache-clock` | Status-line countdown to the prompt cache going cold; keep-warm stops at break-even. | `/cache-clock` |
| `handoff` | Writes, saves and copies a handoff of a long chat. | `/handoff` |
| `research-router` | Shortens big web search and fetch results, keeping sources and dates. | `/research-router` |
| `browser-shrink` | Shrinks browser screenshots with `sips` (macOS). | `/browser-shrink` |
| `mods` | One switchboard for the token-saving plugins. | `/mods` |
| `savings-proof` | Tokens saved this chat, today and all time, net of re-reads. | `/savings` |

All plugins except `copy-summary` are the token-saving pack. Install the whole pack:

```
/plugin install input-router@claude-mods
/plugin install effort-optimizer@claude-mods
/plugin install model-router@claude-mods
/plugin install cache-clock@claude-mods
/plugin install handoff@claude-mods
/plugin install research-router@claude-mods
/plugin install browser-shrink@claude-mods
/plugin install mods@claude-mods
/plugin install savings-proof@claude-mods
```

Needs Claude Code 2.1.311 or newer.

## Data

The pack writes under `~/.claude/token-mods/`: `ledger.jsonl` (one line per action), `switches.json` and `handoffs/`. Text goes to Haiku only after secrets are masked.

## Honest limits

- Summaries are lossy. For exact text, read a range under 100 lines, or run `/mods off input-router`.
- Token counts are estimates (4 characters per token). No dollar prices are computed.
- `model-router` records every decision but does not retry a failed cheaper subagent on a stronger model.
- Each plugin is installed alone, so each carries its own copy of `shared/shared.ts`. After editing it, run `sh tools/sync-shared.sh`.
- Not yet tested in a long live session.
