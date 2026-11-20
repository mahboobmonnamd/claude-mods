#!/bin/sh
# Copy shared/shared.ts into each pack plugin: a plugin is installed on its own, so each carries its own copy.
# `sh tools/sync-shared.sh --check` changes nothing and fails if any copy has drifted.
set -e
cd "$(dirname "$0")/.."
PLUGINS="trim-output trim-web trim-shots effort-tuner agent-model-picker cache-timer chat-handoff switches savings-meter dedupe-reads test-output-trim cost-ledger"
if [ "$1" = "--check" ]; then
  bad=0
  for p in $PLUGINS; do
    cmp -s shared/shared.ts "mods/$p/hooks/shared.ts" || { echo "drifted: mods/$p/hooks/shared.ts"; bad=1; }
  done
  [ "$bad" = 0 ] && echo "all copies of shared.ts match"
  exit "$bad"
fi
for p in $PLUGINS; do
  cp shared/shared.ts "mods/$p/hooks/shared.ts"
done
echo "synced shared.ts into $(echo $PLUGINS | wc -w | tr -d ' ') plugins"
