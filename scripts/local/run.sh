#!/usr/bin/env bash
# Runs one command against the local stack:
#   scripts/local/run.sh npx next start
#   scripts/local/run.sh npx next dev --turbopack
#
# This exists because the way it used to be done could fail silently in the
# worst direction. `source <(scripts/local/env.sh)` reads nothing on macOS's
# bash 3.2, so no variable was set, Next.js filled the gaps from .env.local, and
# the "local" app was talking to the production database: demo data and test
# writes included. Nothing said so; the pages looked the same.
#
# Here the environment is set in this process and the command inherits it, so
# there is nothing to source, and the command does not start unless the
# database it will reach is on this machine.
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ $# -eq 0 ]]; then
  echo "Usage: scripts/local/run.sh <command> [args...]" >&2
  exit 64
fi

eval "$(scripts/local/env.sh)"

for v in SUPABASE_URL NEXT_PUBLIC_SUPABASE_URL; do
  case "${!v:-}" in
    http://localhost:*|http://127.0.0.1:*) ;;
    *) echo "Refusing to start: $v is '${!v:-unset}', not the local stack." >&2; exit 1 ;;
  esac
done

# A token minted for the local stack, not one left over in the shell. The local
# PostgREST and the production project use different secrets, so a production
# key here would fail; this check makes it fail with a reason.
case "$SUPABASE_SERVICE_ROLE_KEY" in
  "$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '"')")
    echo "Refusing to start: the service key is the one from .env.local." >&2; exit 1 ;;
esac

exec "$@"
