# mahboobmonnamd

Installs the whole Lean pack in one step; this is the one plugin to install if you want everything. Lean is a set of plugins that keep tokens out of the chat: they trim big file, shell, web and test output, point at earlier reads instead of repeating them, tune reasoning effort and subagent models, time the prompt cache, write handoffs, and report what was saved. Installing this plugin pulls in every one of them as a dependency; turn any single plugin off later with `/switches off <name>`.

```
/plugin marketplace add mahboobmonnamd/claude-mods
/plugin install mahboobmonnamd@claude-mods
```

See the repository README for what each plugin does and the limits of the pack.
