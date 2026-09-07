#!/usr/bin/env bash
# Configure Supabase Auth redirect URLs for value-first-realestate.
# Usage: bash scripts/configure-auth-redirects.sh [vercel-production-url]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VELTRO_ENV="${VELTRO_ENV:-$HOME/veltro-monorepo/apps/developer-portal/.env.local}"
REF="$(tr -d '[:space:]' < "$ROOT/.supabase-project-ref")"
PROD_BASE="${1:-https://rift-homebuyer-roadmap.vercel.app}"
export SUPABASE_ACCESS_TOKEN
SUPABASE_ACCESS_TOKEN="$(python3 -c "
from pathlib import Path
for line in Path(r'''$VELTRO_ENV''').read_text().splitlines():
    if line.startswith('SUPABASE_ACCESS_TOKEN='):
        print(line.split('=',1)[1].strip()); break
")"
python3 - <<PY
import json, os, urllib.request
token=os.environ["SUPABASE_ACCESS_TOKEN"]
ref="$REF"
prod_base="${PROD_BASE}".rstrip("/")
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
parts=[
    "http://localhost:3000/auth/callback",
    f"{prod_base}/auth/callback",
    "https://*.vercel.app/auth/callback",
]
req=urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{ref}/config/auth",
    headers={"Authorization":f"Bearer {token}","User-Agent":UA,"Accept":"application/json"},
)
with urllib.request.urlopen(req, timeout=60) as resp:
    cfg=json.load(resp)
existing=[p.strip() for p in str(cfg.get("uri_allow_list") or "").split(",") if p.strip()]
for u in parts:
    if u not in existing:
        existing.append(u)
# MVP: autoconfirm so agents/clients can sign up without inbox access during testing.
# Re-enable confirmations before public launch if you want verified emails.
body={
    "site_url": prod_base,
    "uri_allow_list": ",".join(existing),
    "mailer_autoconfirm": True,
}
data=json.dumps(body).encode()
req=urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{ref}/config/auth",
    data=data, method="PATCH",
    headers={"Authorization":f"Bearer {token}","Content-Type":"application/json","User-Agent":UA},
)
with urllib.request.urlopen(req, timeout=60) as resp:
    cfg=json.load(resp) if resp.headers.get("content-type","").startswith("application/json") else {}
    print("AUTH_PATCH_OK", resp.status)
    print("SITE_URL", prod_base)
    print("ALLOW_LIST", ",".join(existing))
    print("MAILER_AUTOCONFIRM", cfg.get("mailer_autoconfirm", True))
PY
