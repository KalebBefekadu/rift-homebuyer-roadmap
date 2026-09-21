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
VELTRO_ENV="${VELTRO_ENV:-$HOME/veltro-monorepo/apps/developer-portal/.env.local}"
REF="$(tr -d '[:space:]' < "$ROOT/.supabase-project-ref")"
export SUPABASE_ACCESS_TOKEN
SUPABASE_ACCESS_TOKEN="$(python3 -c "
from pathlib import Path
for line in Path(r'''$VELTRO_ENV''').read_text().splitlines():
    if line.startswith('SUPABASE_ACCESS_TOKEN='):
        print(line.split('=',1)[1].strip()); break
")"
python3 - <<PY
import json, os, pathlib, urllib.request, urllib.error
token=os.environ["SUPABASE_ACCESS_TOKEN"]
ref="$REF"
sql=pathlib.Path(r'''$FILE''').read_text()
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
        # being what you meant — and every defect in this codebase so far has
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
