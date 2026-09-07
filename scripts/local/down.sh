#!/usr/bin/env bash
set -euo pipefail
pkill -f "scripts/local/proxy.mjs" >/dev/null 2>&1 || true
docker rm -f rift-postgrest rift-pg >/dev/null 2>&1 || true
echo "Local stack down."
