#!/usr/bin/env bash
#
# Brings up a local stand-in for Supabase: Postgres + PostgREST behind a proxy
# that speaks the /rest/v1 path supabase-js expects.
#
# This exists because the pieces were all verified separately — SQL against
# Postgres, query syntax against PostgREST, the UI against fixtures — and
# running the ACTUAL application against a database found three defects none of
# those could have. It is worth being able to do that again in one command.
#
#   scripts/local/up.sh          bring it up and apply migrations + seed
#   scripts/local/env.sh         print the env for `npx next start`
#   scripts/local/down.sh        tear it down
#
# Local development only. It has no auth, no RLS enforcement and no TLS.
set -euo pipefail
cd "$(dirname "$0")/../.."

SECRET="rift-local-test-secret-at-least-32-chars-long"
PG_PORT=55432
REST_PORT=3001
PROXY_PORT=3002

echo "→ Postgres"
docker rm -f rift-pg >/dev/null 2>&1 || true
docker run -d --name rift-pg -e POSTGRES_PASSWORD=pw -p "${PG_PORT}:5432" postgres:16-alpine >/dev/null
for _ in $(seq 1 30); do docker exec rift-pg pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done

echo "→ schema, seed and grants"
docker exec -i rift-pg psql -U postgres -q -v ON_ERROR_STOP=1 < supabase/test/shim.sql
for f in supabase/migrations/*_rift_*.sql; do
  docker exec -i rift-pg psql -U postgres -q -v ON_ERROR_STOP=1 < "$f"
done
docker exec -i rift-pg psql -U postgres -q -v ON_ERROR_STOP=1 < supabase/seed/rift_programs.sql
docker exec -i rift-pg psql -U postgres -q -v ON_ERROR_STOP=1 < supabase/test/postgrest-grants.sql

echo "→ the agent row (nothing is recorded without it)"
docker exec rift-pg psql -U postgres -q -c "
  insert into auth.users (id) values ('cccc0000-0000-4000-8000-000000000001') on conflict do nothing;
  insert into rift_agents (id, auth_user_id, name, email, brokerage)
  values ('dddd0000-0000-4000-8000-000000000001','cccc0000-0000-4000-8000-000000000001',
          'Kaleb Befekadu','kaleb@example.com','Peachtree Cardinal')
  on conflict do nothing;"

echo "→ PostgREST"
docker rm -f rift-postgrest >/dev/null 2>&1 || true
docker run -d --name rift-postgrest --network host \
  -e PGRST_DB_URI="postgres://authenticator:pw@localhost:${PG_PORT}/postgres" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET="$SECRET" -e PGRST_SERVER_PORT=${REST_PORT} \
  postgrest/postgrest >/dev/null
sleep 5

echo "→ /rest/v1 proxy"
pkill -f "scripts/local/proxy.mjs" >/dev/null 2>&1 || true
nohup node scripts/local/proxy.mjs > /tmp/rift-proxy.log 2>&1 &
sleep 2

echo
echo "Up. Start the app with:"
echo "  eval \"\$(scripts/local/env.sh)\" && npx next start"
echo
echo "Then: npm run verify:queries"
