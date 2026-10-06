#!/usr/bin/env bash
# The client's way in, against a real Supabase (manual review WS1.8).
#
# Starts Supabase's own stack in Docker (database, Auth, REST, Storage, and
# Mailpit to catch the email), applies the Rift migrations, and runs
# e2e-auth/ against it with playwright.auth.config.ts. Nothing here reads
# .env.local, which points at production.
#
#   scripts/e2e-auth.sh          start (or reuse) the stack and run the suite
#   scripts/e2e-auth.sh stop     stop the stack
#
# Needs Docker and Node. The stack lives in $RIFT_E2E_DIR (default
# ~/.rift-e2e-auth), outside the repository, because `supabase init` writes a
# config.toml this repository does not otherwise have, and its retired MVP
# migrations are not part of the product's schema.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${RIFT_E2E_DIR:-$HOME/.rift-e2e-auth}"
PORT=3178
# Docker Hub mirrors of Supabase's images, for networks that block the default registry.
export SUPABASE_INTERNAL_IMAGE_REGISTRY="${SUPABASE_INTERNAL_IMAGE_REGISTRY:-docker.io}"
SB="npx --yes supabase"
EXCLUDE="realtime,studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta"

if [[ "${1:-}" == "stop" ]]; then
  (cd "$DIR" && $SB stop --no-backup)
  exit 0
fi

mkdir -p "$DIR/supabase/migrations"
cd "$DIR"
if [[ ! -f supabase/config.toml ]]; then
  $SB init --force >/dev/null
  # Ports clear of a developer's own local Supabase; auth pointed at the test
  # site; rate limits raised (the product's own limits are what is tested).
  sed -i.bak \
    -e 's/= 5432\([0-9]\)/= 5632\1/' \
    -e "s#^site_url = .*#site_url = \"http://127.0.0.1:$PORT\"#" \
    -e "s#^additional_redirect_urls = .*#additional_redirect_urls = [\"http://127.0.0.1:$PORT/**\"]#" \
    -e 's/^email_sent = [0-9]*/email_sent = 1000/' \
    -e 's/^sign_in_sign_ups = [0-9]*/sign_in_sign_ups = 1000/' \
    -e 's/^token_verifications = [0-9]*/token_verifications = 1000/' \
    supabase/config.toml
  python3 - <<'PY'
import re
p = "supabase/config.toml"
s = open(p).read()
s = re.sub(r"(\[db\.seed\][^\[]*?)enabled = true", r"\1enabled = false", s, flags=re.S)
s = re.sub(r"(\[storage\.vector\][^\[]*?)enabled = true", r"\1enabled = false", s, flags=re.S)
open(p, "w").write(s)
PY
fi
# The product's migrations only, every run, so a new one is always applied.
rm -f supabase/migrations/*.sql
cp "$ROOT"/supabase/migrations/*_rift_*.sql supabase/migrations/
$SB stop --no-backup >/dev/null 2>&1 || true
$SB start -x "$EXCLUDE"

eval "$($SB status -o env | sed 's/^/export SB_/')"
cd "$ROOT"
E2E_SUPABASE_URL="$SB_API_URL" \
E2E_SUPABASE_ANON_KEY="$SB_ANON_KEY" \
E2E_SUPABASE_SERVICE_ROLE_KEY="$SB_SERVICE_ROLE_KEY" \
E2E_DB_URL="$SB_DB_URL" \
E2E_MAILPIT_URL="${SB_MAILPIT_URL:-$SB_INBUCKET_URL}" \
  npx playwright test -c playwright.auth.config.ts "$@"
