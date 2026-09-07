#!/usr/bin/env bash
# Prints the environment for running the app against the local stack.
#   eval "$(scripts/local/env.sh)" && npx next start
set -euo pipefail

SECRET="rift-local-test-secret-at-least-32-chars-long"
NOW=$(date +%s)
b64() { printf '%s' "$1" | openssl base64 -A | tr '+/' '-_' | tr -d '='; }
H=$(b64 '{"alg":"HS256","typ":"JWT"}')
P=$(b64 "{\"role\":\"anon\",\"iat\":${NOW},\"exp\":$((NOW + 86400))}")
S=$(printf '%s' "${H}.${P}" | openssl dgst -sha256 -hmac "$SECRET" -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')
JWT="${H}.${P}.${S}"

# SUPABASE_URL, not just the NEXT_PUBLIC_ one: NEXT_PUBLIC_ variables are
# inlined at build time, so a server reading one talks to whatever project the
# bundle was compiled against regardless of the runtime environment.
cat <<ENV
export SUPABASE_URL="http://localhost:3002"
export NEXT_PUBLIC_SUPABASE_URL="http://localhost:3002"
export SUPABASE_SERVICE_ROLE_KEY="${JWT}"
export SUPABASE_ANON_KEY="${JWT}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${JWT}"
export CRON_SECRET="local-test-secret"
ENV
