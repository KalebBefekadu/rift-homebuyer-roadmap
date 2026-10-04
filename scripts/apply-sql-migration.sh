#!/usr/bin/env bash
# Apply one SQL migration file to the linked Supabase project via Management API.
# Usage: bash scripts/apply-sql-migration.sh supabase/migrations/YYYYMMDDHHMMSS_name.sql
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="${1:-}"
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  # Allow relative to ROOT
  if [[ -n "$FILE" && -f "$ROOT/$FILE" ]]; then
    FILE="$ROOT/$FILE"
  else
    echo "Usage: bash scripts/apply-sql-migration.sh <path-to.sql>" >&2
    exit 1
  fi
fi
REF="$(tr -d '[:space:]' < "$ROOT/.supabase-project-ref")"

# The Supabase personal access token: from the environment, else this repo's
# .env.local, else (for now) the developer-portal checkout it was first read
# from. That last one is another project's file: if it moves, or its token is
# rotated, migrations here stop for a reason nothing in this repo explains.
# Put SUPABASE_ACCESS_TOKEN in .env.local and the fallback is never reached.
token_from() {
  [[ -f "$1" ]] || return 0
  python3 -c "
from pathlib import Path
for line in Path(r'''$1''').read_text().splitlines():
    if line.startswith('SUPABASE_ACCESS_TOKEN='):
        print(line.split('=',1)[1].strip().strip('\"')); break
"
}
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-$(token_from "$ROOT/.env.local")}"
if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
  VELTRO_ENV="${VELTRO_ENV:-$HOME/veltro-monorepo/apps/developer-portal/.env.local}"
  SUPABASE_ACCESS_TOKEN="$(token_from "$VELTRO_ENV")"
  [[ -n "$SUPABASE_ACCESS_TOKEN" ]] && echo "note: token read from $VELTRO_ENV; add SUPABASE_ACCESS_TOKEN to .env.local" >&2
fi
if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
  echo "No SUPABASE_ACCESS_TOKEN in the environment or .env.local." >&2
  exit 1
fi
NAME="$(basename "$FILE" .sql)"
python3 - <<PY
import json, os, pathlib, urllib.request, urllib.error
token=os.environ["SUPABASE_ACCESS_TOKEN"]
ref="$REF"
sql=pathlib.Path(r'''$FILE''').read_text()
# Recorded in the same request, so a migration that fails is not recorded and
# one that succeeds cannot be forgotten. See 20261003100000_rift_schema_ledger.
# A file named outside the ledger's pattern (a one-off query) is not recorded.
import re
name="$NAME"
if re.fullmatch(r"[0-9]{14}_[a-z0-9_]+", name):
    sql += (
        "\n;\ndo \$ledger\$ begin if to_regclass('public.rift_schema_migrations') is not null then "
        f"insert into public.rift_schema_migrations (name) values ('{name}') on conflict (name) do nothing; "
        "end if; end \$ledger\$;\n"
    )
body=json.dumps({"query": sql}).encode()
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
path=f"/projects/{ref}/database/query"
req=urllib.request.Request(
    f"https://api.supabase.com/v1{path}",
    data=body,
    method="POST",
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": UA,
        "Accept": "application/json",
    },
)
try:
    with urllib.request.urlopen(req, timeout=180) as resp:
        print("SQL_OK", pathlib.Path(r'''$FILE''').name, resp.status)
        # The rows, when the statement returned any.
        #
        # This used to be discarded, which made the script unable to answer the
        # one question worth asking after a migration: did the columns actually
        # arrive? "SQL_OK 201" is the API accepting the request, not the schema
        # being what you meant, and every defect in this codebase so far has
        # looked exactly like success. A verification query run through here
        # printed nothing at all.
        try:
            rows = json.loads(resp.read() or b"[]")
        except (ValueError, TypeError):
            rows = []
        for row in rows if isinstance(rows, list) else []:
            if isinstance(row, dict):
                print("  " + " | ".join(f"{k}={v}" for k, v in row.items()))
            else:
                print("  " + str(row))
except urllib.error.HTTPError as e:
    print("SQL_FAIL", e.code, e.read().decode()[:800])
    raise SystemExit(1)
PY
