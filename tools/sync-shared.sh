#!/bin/sh
# Copy shared/shared.ts into each token-saving plugin: a plugin is installed on its own, so each carries its own copy.
set -e
cd "$(dirname "$0")/.."
for p in input-router effort-optimizer model-router cache-clock handoff research-router browser-shrink switchboard savings-proof; do
  cp shared/shared.ts "mods/$p/hooks/shared.ts"
done
echo "synced shared.ts into 9 plugins"
