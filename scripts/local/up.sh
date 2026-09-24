#!/usr/bin/env bash
#
# Brings up a local stand-in for Supabase: Postgres + PostgREST behind a proxy
# that speaks the /rest/v1 path supabase-js expects.
#
# This exists because the pieces were all verified separately: SQL against
# Postgres, query syntax against PostgREST, the UI against fixtures, and
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

# A separate database for the test suites. They rebuild the schema from the
# migrations, and sharing one database meant `npm test` destroyed this stack:
# including the agent row, after which every write reported "no agent row
# exists yet" two commands away from the cause.
#
# NOT swallowed. This was `|| true` with both streams to /dev/null, and when it
# failed, which it did, because pg_isready reports the server up a moment
# before it will accept a CREATE DATABASE: the consequence was that every
# database suite SKIPPED. Seventy tests, reported as "skipped", which the
# schema suite's own docblock calls the worst possible outcome and which CI has
# a dedicated step to catch. Locally there was nothing to catch it.
if ! docker exec rift-pg psql -U postgres -q -c "create database rift_test;" 2>/tmp/rift-createdb.err; then
  if grep -q "already exists" /tmp/rift-createdb.err; then
    echo "  (rift_test already exists)"
  else
    echo "Could not create rift_test: the database suites would silently SKIP:" >&2
    cat /tmp/rift-createdb.err >&2
    exit 1
  fi
fi

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

echo "→ Storage (documents, W08)"
# Supabase's own storage server, on the files backend, so uploads are tested
# against the real API rather than a stand-in. It creates the storage schema
# and the anon/authenticated/service_role roles in this database; the bucket
# is created the way the migration creates it in production. Port 5055: 5000
# is often taken by macOS AirPlay.
mkjwt() { node -e 'const c=require("crypto");const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");const h=b({alg:"HS256",typ:"JWT"});const p=b({role:process.argv[1],iat:1700000000,exp:2000000000});console.log(h+"."+p+"."+c.createHmac("sha256",process.argv[2]).update(h+"."+p).digest("base64url"))' "$1" "$SECRET"; }
docker rm -f rift-storage >/dev/null 2>&1 || true
docker run -d --name rift-storage --network host \
  -e ANON_KEY="$(mkjwt anon)" -e SERVICE_KEY="$(mkjwt service_role)" \
  -e AUTH_JWT_SECRET="$SECRET" -e PGRST_JWT_SECRET="$SECRET" \
  -e DATABASE_URL="postgres://postgres:pw@localhost:${PG_PORT}/postgres" -e DB_INSTALL_ROLES=true \
  -e FILE_SIZE_LIMIT=52428800 -e STORAGE_BACKEND=file -e FILE_STORAGE_BACKEND_PATH=/tmp/storage \
  -e TENANT_ID=stub -e REGION=local -e GLOBAL_S3_BUCKET=stub -e SERVER_PORT=5055 -e ENABLE_IMAGE_TRANSFORMATION=false \
  public.ecr.aws/supabase/storage-api:v1.72.1 >/dev/null
for _ in $(seq 1 30); do curl -sf localhost:5055/status >/dev/null && break; sleep 1; done
docker exec rift-pg psql -U postgres -q -c "
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('rift-documents','rift-documents', false, 20971520, array['application/pdf','image/jpeg','image/png'])
  on conflict (id) do nothing;"

echo "→ /rest/v1 and /storage/v1 proxy"
pkill -f "scripts/local/proxy.mjs" >/dev/null 2>&1 || true
nohup node scripts/local/proxy.mjs > /tmp/rift-proxy.log 2>&1 &
sleep 2

echo
echo "Note: PostgREST caches the schema at startup. After adding a migration,"
echo "      run  docker restart rift-postgrest  or every write against the new"
echo "      column fails with a message about a schema cache."
echo
echo "Up. Start the app with:"
echo "  eval \"\$(scripts/local/env.sh)\" && npx next start"
echo
echo "Then: npm run verify:queries"
