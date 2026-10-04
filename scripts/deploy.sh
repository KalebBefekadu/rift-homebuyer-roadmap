#!/usr/bin/env bash
# Deploys to production what is on GitHub, and only once CI has passed it.
#   scripts/deploy.sh
#
# `vercel deploy` from a working folder uploads the folder: untracked files,
# other sessions' half-finished work, and commits a rejected push never got to
# GitHub. All three happened in one week. Vercel is not connected to the
# repository, so nothing else stands between a laptop and production; until it
# is, this is the way to deploy.
#
# It refuses unless HEAD is exactly origin/main and CI passed that commit
# (waiting if CI is still running), then deploys a clean checkout of it.
# RIFT_DEPLOY_SKIP_CI="<reason>" skips the CI wait and says so; it does not
# skip the rest.
set -euo pipefail
cd "$(dirname "$0")/.."

refuse() { echo "Not deploying: $1" >&2; exit 1; }

git fetch origin main --quiet
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || refuse "tracked files have uncommitted changes."
SHA="$(git rev-parse HEAD)"
[[ "$SHA" == "$(git rev-parse origin/main)" ]] || refuse "HEAD ($(git rev-parse --short HEAD)) is not origin/main. Push, or pull, first."

if [[ -n "${RIFT_DEPLOY_SKIP_CI:-}" ]]; then
  echo "warning: deploying without waiting for CI: $RIFT_DEPLOY_SKIP_CI" >&2
else
  RUN="$(gh run list --workflow CI --commit "$SHA" --limit 1 --json databaseId,status,conclusion \
        -q '.[0] | "\(.databaseId) \(.status) \(.conclusion)"')"
  [[ -n "$RUN" ]] || refuse "no CI run for $(git rev-parse --short HEAD) yet. Wait a minute after pushing."
  read -r RUN_ID STATUS CONCLUSION <<<"$RUN"
  if [[ "$STATUS" != "completed" ]]; then
    echo "CI is $STATUS for $(git rev-parse --short HEAD); waiting."
    gh run watch "$RUN_ID" --exit-status --interval 20 >/dev/null || refuse "CI failed: gh run view $RUN_ID"
  elif [[ "$CONCLUSION" != "success" ]]; then
    refuse "CI concluded '$CONCLUSION': gh run view $RUN_ID"
  fi
  echo "CI passed $(git rev-parse --short HEAD)."
fi

# Tracked files only. .vercel carries the project link; .env.local is never
# copied, because the build reads its variables from the Vercel project.
WORK="$(mktemp -d)/rift-deploy"
cleanup() { git worktree remove --force "$WORK" >/dev/null 2>&1 || true; }
trap cleanup EXIT
git worktree add --detach --quiet "$WORK" "$SHA"
cp -R .vercel "$WORK/"

(cd "$WORK" && vercel deploy --prod --yes)

SITE="${RIFT_SITE_URL:-https://rift-homebuyer-roadmap.vercel.app}"
echo "Health: $(curl -s -o /dev/null -w '%{http_code}' "$SITE/api/health")"
