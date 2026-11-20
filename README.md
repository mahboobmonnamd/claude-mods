# claude-mods

Claude Code plugins by mahboob. Add the marketplace once, then install what you want:

```
/plugin marketplace add mahboobmonnamd/claude-mods
/plugin install <name>@claude-mods
```

## The Lean pack

Plugins that keep tokens out of the chat. Install them all with one command, or pick:

```
/plugin install lean@claude-mods
```

| Plugin | What it does | Command |
|---|---|---|
| `trim-output` | Big file reads, read-only shell output (`cat`, `grep`, `curl`...) and connector results over 6,000 tokens are trimmed, then summarised by Haiku. Secrets are masked first. | `/trim-output` |
| `trim-web` | Shortens big web search and fetch results, keeping sources and dates. | `/trim-web` |
| `trim-shots` | Shrinks browser screenshots with `sips` (macOS). | `/trim-shots` |
| `test-output-trim` | Cuts long test runs to the failures and the summary. The full log is saved to disk. No model call. | `/test-output-trim` |
| `dedupe-reads` | An unchanged file read a second time becomes a one-line pointer to the first. | `/dedupe-reads` |
| `effort-tuner` | Picks the reasoning effort a prompt needs. Most prompts are decided locally with no model call. | `/effort-tuner` |
| `agent-model-picker` | Picks each subagent's model with a Haiku judge and confidence bars. | `/agent-model-picker` |
| `cache-timer` | Status-line countdown to the prompt cache going cold; keep-warm stops at break-even. | `/cache-timer` |
| `chat-handoff` | Writes, saves and copies a handoff of a long chat. | `/handoff` |
| `savings-meter` | Tokens saved this chat, today and all time, net of re-reads. | `/savings` |
| `cost-ledger` | A side pane over the same ledger: by plugin, with the latest actions. | `/cost-ledger` |
| `switches` | One panel to turn each Lean plugin on or off. | `/switches` |
| `lean` | Installs all of the above. | |

## Other plugins

| Plugin | What it does |
|---|---|
| `copy-summary` | After real work, Claude ends with a plain-text summary copied to the clipboard. |

Needs Claude Code 2.1.311 or newer.

## Limits

- Summaries are lossy. For exact text, read a range under 100 lines, or run `/switches off trim-output`.
- Token counts are estimates (4 characters per token). No dollar prices are computed.
- `agent-model-picker` records every decision but does not retry a failed cheaper subagent on a stronger model.
- `dedupe-reads` compares file text, so an edited file is always read whole; its memory is cleared on compaction.
- Each plugin is installed alone, so each carries its own copy of `shared/shared.ts`. After editing it, run `sh tools/sync-shared.sh`; `sh tools/sync-shared.sh --check` fails if a copy has drifted.
- Not yet tested in a long live session. `test-output-trim` has unit tests (`claude plugin test mods/test-output-trim`); the other plugins do not.

## Data

The pack writes under `~/.claude/token-mods/`: `ledger.jsonl` (one line per action), `switches.json`, `handoffs/` and `test-logs/`. Text goes to Haiku only after secrets are masked. The folder keeps this name from before the plugins were renamed, so existing ledgers carry over; rows written under an old plugin name stay listed under it.

## Renamed plugins

If you installed an earlier version, reinstall under the new name:

| Was | Now |
|---|---|
| `input-router` | `trim-output` |
| `research-router` | `trim-web` |
| `browser-shrink` | `trim-shots` |
| `effort-optimizer` | `effort-tuner` |
| `model-router` | `agent-model-picker` |
| `cache-clock` | `cache-timer` |
| `handoff` | `chat-handoff` (command is still `/handoff`) |
| `savings-proof` | `savings-meter` |
| `mods` | `switches` (command is `/switches`) |

Switches saved under an old name in `switches.json` no longer apply; set them again with `/switches`.
