# claude-mods

Claude Code plugins by mahboob. Add the marketplace once, then install what you want:

```
/plugin marketplace add mahboobmonnamd/claude-mods
/plugin install <name>@claude-mods
```

## The token-saving pack

Plugins that keep tokens out of the chat. Install them all with one command, or pick:

```
/plugin install mahboobmonnamd@claude-mods
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
| `switches` | One panel to turn each plugin of the pack on or off. | `/switches` |
| `mahboobmonnamd` | Installs all of the above. | |

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
- Not yet tested in a long live session. Automated regressions cover output-routing ownership, test-log persistence, and test-output trimming; other plugin behaviors still need live acceptance.


## Before you enable the pack

- **Web result ownership:** `trim-web` exclusively handles `WebSearch`, `WebFetch` and MCP tool names containing `search`, `fetch`, `scrape`, `crawl` or `browse`. `trim-output` skips those results even when its tool list contains `mcp__*` or `WebFetch`. Turning off `trim-web` leaves those results untouched.
- **Recoverability:** `test-output-trim` only replaces test output after the complete original has been written successfully to a uniquely named local log. A failed write leaves the original result unchanged.
- **Platform notes:** `trim-shots` requires macOS `sips` and falls back to the original image elsewhere. `chat-handoff` uses Claude Code's clipboard API and reports when copying is unavailable.
- **Safety:** Summaries and image resizing are lossy. Disable the relevant mod when auditing exact commands, logs, source text, or screenshots. Redaction matches known secret patterns but is not a comprehensive data-loss-prevention boundary. Do not use the summarizer for sensitive connector results without validating its privacy requirements.
- **Savings:** The ledger estimates text tokens using four characters per token and deducts subsequent re-reads. Helper input and output tokens are listed separately. It does **not** establish billed token savings or monetary savings; prompt caching, pricing tiers and retries change actual cost.

## Release verification

The CI workflow validates the marketplace and every plugin, checks shared helper synchronization, and runs the pure-policy/log-handling regression tests and test-output trimming tests without live model calls. On a machine with Claude Code installed, run:

```sh
sh tools/sync-shared.sh --check
claude plugin validate .
for plugin in mods/*; do claude plugin validate "$plugin"; done
claude plugin test mods/trim-output
claude plugin test mods/test-output-trim
```

**Manual acceptance still required before a performance claim or wider promotion:** install `mahboobmonnamd@claude-mods` in Claude Code 2.1.311+, run a long mixed read/web/test session, verify each mod's on/off switch, confirm that original test logs are recoverable, and compare actual token usage and answer quality with all mods disabled. These live-session and billing measurements have not been completed.

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
