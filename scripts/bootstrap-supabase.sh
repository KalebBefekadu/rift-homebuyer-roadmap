#!/usr/bin/env bash
# One-shot: create/link Supabase project, write .env.local keys, migrate, seed, Vercel env.
# Usage: bash scripts/bootstrap-supabase.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VELTRO_ENV="${VELTRO_ENV:-$HOME/veltro-monorepo/apps/developer-portal/.env.local}"
ORG_ID="${SUPABASE_ORG_ID:-hapnhdpsgeasscpgvejl}"
PROJECT_NAME="${SUPABASE_PROJECT_NAME:-value-first-realestate}"
REGION="${SUPABASE_REGION:-us-east-1}"
VERCEL_PROJECT="${VERCEL_PROJECT:-rift-homebuyer-roadmap}"

if [[ ! -f "$VELTRO_ENV" ]]; then
  echo "MISSING_VELTRO_ENV: $VELTRO_ENV" >&2
  exit 1
fi

export SUPABASE_ACCESS_TOKEN
SUPABASE_ACCESS_TOKEN="$(python3 -c "
from pathlib import Path
for line in Path('$VELTRO_ENV').read_text().splitlines():
    if line.startswith('SUPABASE_ACCESS_TOKEN='):
        print(line.split('=',1)[1].strip()); break
")"
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "MISSING_SUPABASE_ACCESS_TOKEN" >&2
  exit 1
fi
echo "TOKEN_OK len=${#SUPABASE_ACCESS_TOKEN}"

api() {
  local method="$1" path="$2" data="${3:-}"
  if [[ -n "$data" ]]; then
    curl -sS --max-time 120 -X "$method" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "https://api.supabase.com/v1$path"
  else
    curl -sS --max-time 60 -X "$method" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      "https://api.supabase.com/v1$path"
  fi
}

export ROOT ORG_ID PROJECT_NAME REGION
python3 - <<'PY'
import json, os, sys, urllib.request, secrets, string, time, pathlib, subprocess

org_id = os.environ["ORG_ID"]
project_name = os.environ["PROJECT_NAME"]
region = os.environ["REGION"]
token = os.environ["SUPABASE_ACCESS_TOKEN"]
root = pathlib.Path(os.environ["ROOT"])

def req(method, path, body=None, timeout=120):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(
        f"https://api.supabase.com/v1{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            **({"Content-Type": "application/json"} if body is not None else {}),
        },
    )
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        try:
            parsed = json.loads(err)
        except Exception:
            parsed = err
        return e.code, parsed

code, projects = req("GET", "/projects")
if code != 200 or not isinstance(projects, list):
    print("LIST_FAIL", code, projects)
    sys.exit(2)
for p in projects:
    print(f"PROJECT\t{p.get('id')}\t{p.get('name')}\t{p.get('status')}")

pick = next((p for p in projects if p.get("name", "").lower() == project_name.lower()), None)
created = False
if not pick:
    db_pass = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(28))
    pass_path = pathlib.Path("/tmp/sb_vf_db_pass.txt")
    pass_path.write_text(db_pass)
    pass_path.chmod(0o600)
    code, data = req(
        "POST",
        "/projects",
        {
            "organization_id": org_id,
            "name": project_name,
            "db_pass": db_pass,
            "region": region,
        },
    )
    if code in (200, 201) and isinstance(data, dict) and data.get("id"):
        pick = data
        created = True
        print("CREATE_OK", pick["id"], pick.get("status"))
    else:
        print("CREATE_FAIL", code, data)
        # Fallback: first INACTIVE non-veltro project
        pick = next(
            (
                p
                for p in projects
                if p.get("status") == "INACTIVE"
                and "veltro" not in p.get("name", "").lower()
            ),
            None,
        )
        if not pick:
            print("NO_FALLBACK_PROJECT")
            sys.exit(3)
        print("FALLBACK", pick["id"], pick["name"], pick["status"])

ref = pick["id"]
print("TARGET", ref, pick.get("name"), pick.get("status"), "created=", created)

# Wait for healthy if newly created / coming up
for i in range(36):
    code, info = req("GET", f"/projects/{ref}")
    status = (info or {}).get("status") if isinstance(info, dict) else None
    print(f"STATUS_{i}={status}")
    if status == "ACTIVE_HEALTHY":
        break
    if status in ("INACTIVE", "GOING_DOWN", "REMOVED"):
        # try restore
        rcode, rdata = req("POST", f"/projects/{ref}/restore", {})
        print("RESTORE", rcode, rdata)
    time.sleep(10)
else:
    print("WARN_NOT_HEALTHY_CONTINUING")

code, keys = req("GET", f"/projects/{ref}/api-keys")
if code != 200:
    print("KEYS_FAIL", code, keys)
    sys.exit(4)
anon = None
for k in keys if isinstance(keys, list) else []:
    name = (k.get("name") or k.get("type") or "").lower()
    val = k.get("api_key") or k.get("key")
    print("KEY_NAME", name, "len", len(val or ""))
    if name in ("anon", "anonymous") or "anon" in name:
        anon = val
        break
if not anon:
    print("NO_ANON_KEY")
    sys.exit(5)

url = f"https://{ref}.supabase.co"
env_path = root / ".env.local"
text = env_path.read_text() if env_path.exists() else ""
lines = [
    ln
    for ln in text.splitlines()
    if not ln.startswith("NEXT_PUBLIC_SUPABASE_URL=")
    and not ln.startswith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")
    and ln.strip() != "# Supabase"
]
body = "\n".join(lines).rstrip() + "\n\n# Supabase\n"
body += f"NEXT_PUBLIC_SUPABASE_URL={url}\n"
body += f"NEXT_PUBLIC_SUPABASE_ANON_KEY={anon}\n"
env_path.write_text(body)
print("WROTE_ENV_LOCAL", url)

# Save ref for later steps
(root / ".supabase-project-ref").write_text(ref + "\n")
print("REF_FILE_OK", ref)
PY

REF="$(tr -d '[:space:]' < "$ROOT/.supabase-project-ref")"
echo "REF=$REF"

# Link + push migrations via CLI if available
cd "$ROOT"
if ! command -v supabase >/dev/null 2>&1; then
  echo "Installing supabase CLI via npm..."
  npm install --no-save supabase@latest >/tmp/sb_npm_install.log 2>&1 || true
fi
SB=(npx --yes supabase)
"${SB[@]}" --version || true

# Ensure config exists for link/push
if [[ ! -f "$ROOT/supabase/config.toml" ]]; then
  "${SB[@]}" init || true
fi

# Link (non-interactive)
yes | "${SB[@]}" link --project-ref "$REF" || "${SB[@]}" link --project-ref "$REF" --yes || true

# DB password if we created one
if [[ -f /tmp/sb_vf_db_pass.txt ]]; then
  export SUPABASE_DB_PASSWORD="$(cat /tmp/sb_vf_db_pass.txt)"
fi

echo "Pushing migrations..."
"${SB[@]}" db push --include-all --yes 2>&1 | tee /tmp/sb_db_push.log || {
  echo "DB_PUSH_FAILED — trying SQL via Management API execute"
  python3 - <<'PY'
import json, os, urllib.request, pathlib
token=os.environ["SUPABASE_ACCESS_TOKEN"]
ref=pathlib.Path(".supabase-project-ref").read_text().strip()
root=pathlib.Path(".")
files=[
  root/"supabase/migrations/20260717000000_roadmap_mvp.sql",
  root/"supabase/migrations/20260717200000_auth_agent_bootstrap.sql",
  root/"supabase/seed/dpa_programs.sql",
]
for f in files:
    if not f.exists():
        print("SKIP_MISSING", f)
        continue
    sql=f.read_text()
    body=json.dumps({"query": sql}).encode()
    # database query endpoint
    for path in (f"/projects/{ref}/database/query", f"/projects/{ref}/run"):
        req=urllib.request.Request(
            f"https://api.supabase.com/v1{path}",
            data=body,
            method="POST",
            headers={"Authorization":f"Bearer {token}","Content-Type":"application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                print("SQL_OK", f.name, path, resp.status)
                break
        except urllib.error.HTTPError as e:
            print("SQL_TRY_FAIL", f.name, path, e.code, e.read().decode()[:400])
    else:
        print("SQL_FAIL", f.name)
PY
}

# Seed explicitly if push didn't include seed
if [[ -f "$ROOT/supabase/seed/dpa_programs.sql" ]]; then
  "${SB[@]}" db execute -f "$ROOT/supabase/seed/dpa_programs.sql" --yes 2>&1 || true
fi

# Auth redirect URLs
PROD_URL="$(vercel project inspect "$VERCEL_PROJECT" 2>/dev/null | python3 -c "import sys,re; t=sys.stdin.read(); m=re.search(r'https://[^\s]+vercel\.app', t); print(m.group(0) if m else '')" || true)"
LOCAL_CB="http://localhost:3000/auth/callback"
PROD_CB="${PROD_URL%/}/auth/callback"
echo "Configuring auth URLs local=$LOCAL_CB prod=$PROD_CB"
python3 - <<PY
import json, os, urllib.request
token=os.environ["SUPABASE_ACCESS_TOKEN"]
ref=open(".supabase-project-ref").read().strip()
local="$LOCAL_CB"
prod="$PROD_CB"
# GET current auth config
req=urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}/config/auth", headers={"Authorization":f"Bearer {token}"})
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        cfg=json.load(resp)
except Exception as e:
    print("AUTH_GET_FAIL", e)
    cfg={}
uris=cfg.get("uri_allow_list") or cfg.get("URI_ALLOW_LIST") or ""
parts=[p.strip() for p in str(uris).split(",") if p.strip()]
for u in (local, prod):
    if u and u not in parts:
        parts.append(u)
site = cfg.get("site_url") or "http://localhost:3000"
body={"site_url": site if site else "http://localhost:3000", "uri_allow_list": ",".join(parts)}
# Also set additional redirect URLs commonly used
data=json.dumps(body).encode()
req=urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{ref}/config/auth",
    data=data,
    method="PATCH",
    headers={"Authorization":f"Bearer {token}","Content-Type":"application/json"},
)
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        print("AUTH_PATCH_OK", resp.status)
except urllib.error.HTTPError as e:
    print("AUTH_PATCH_FAIL", e.code, e.read().decode()[:500])
PY

# Vercel env
URL="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$ROOT/.env.local" | cut -d= -f2-)"
ANON="$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "$ROOT/.env.local" | cut -d= -f2-)"
if command -v vercel >/dev/null 2>&1 && [[ -n "$URL" && -n "$ANON" ]]; then
  echo "Setting Vercel envs on $VERCEL_PROJECT..."
  for ENV in production preview development; do
    printf '%s' "$URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL "$ENV" --yes 2>&1 || \
      printf '%s' "$URL" | vercel env rm NEXT_PUBLIC_SUPABASE_URL "$ENV" --yes 2>&1; \
      printf '%s' "$URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL "$ENV" --yes 2>&1 || true
    printf '%s' "$ANON" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY "$ENV" --yes 2>&1 || \
      printf '%s' "$ANON" | vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY "$ENV" --yes 2>&1; \
      printf '%s' "$ANON" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY "$ENV" --yes 2>&1 || true
  done
  echo "VERCEL_ENV_DONE"
else
  echo "VERCEL_SKIP"
fi

echo "=== DONE ==="
grep -E '^(NEXT_PUBLIC_SUPABASE_|# Supabase)' "$ROOT/.env.local" | sed -E 's/=.*/=<present>/'
echo "REF=$REF created_or_linked"
echo "Verify signup: npm run dev → /signup → confirm email redirect hits /auth/callback"
