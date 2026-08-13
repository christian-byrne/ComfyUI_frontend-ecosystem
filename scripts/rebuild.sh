#!/usr/bin/env bash
# rebuild.sh — deterministic rebuild for the dashboard data pipeline.
#
# Implements Alex's ask in #26: a single command that regenerates the
# dashboard data + site from raw inputs without falling back on ad-hoc tools
# or one-off prompts. Re-runnable; same inputs ⇒ same outputs.
#
# Pipeline (in order):
#   1. stars   — refresh star data from GitHub and MERGE it into the canonical
#                cache src/data/touch-points-star-cache.json, re-emitting
#                research/touch-points-star-cache.yaml as a derived mirror.
#                The merge is a union (newest asof wins per repo) behind a
#                regression guard, so this step cannot shrink the data — see
#                README §"Which star cache is canonical?".
#   2. rollup  — recompute research/touch-points-rollup.yaml from
#                database.yaml + star-cache
#   3. weights — recompute usage_weight in src/data/behavior-categories.json
#                from the rollup (replaces the never-vendored
#                build-behavior-categories.py)
#   4. slugs   — normalise repo slugs to canonical owner/name
#   5. data    — verify inputs parse, then run every drift/consistency check
#   6. build   — pnpm build (Vite inlines the JSON under src/data/)
#
# Usage:
#   bash scripts/rebuild.sh             # full pipeline
#   bash scripts/rebuild.sh stars       # just refresh + merge the star cache
#   bash scripts/rebuild.sh rollup      # just recompute rollup
#   bash scripts/rebuild.sh weights     # just recompute usage_weight
#   bash scripts/rebuild.sh slugs       # just normalise repo slugs
#   bash scripts/rebuild.sh data        # verify data inputs + run all checks
#   bash scripts/rebuild.sh check       # read-only checks only (what CI runs)
#   bash scripts/rebuild.sh build       # just run pnpm build
#   bash scripts/rebuild.sh --skip-stars   # full pipeline minus stars (for offline / no `gh` auth)
#   bash scripts/rebuild.sh --clean     # blow away dist/ and Vite cache before building
#
# Required tools: bash, python3, pyyaml, gh, jq, pnpm, node.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ─── helpers ──────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; BOLD='\033[1m'; RESET='\033[0m'
log()  { echo -e "${BOLD}${GREEN}▶${RESET} ${BOLD}$*${RESET}"; }
warn() { echo -e "${BOLD}${YELLOW}!${RESET} $*" >&2; }
die()  { echo -e "${BOLD}${RED}✗${RESET} $*" >&2; exit 1; }

require() {
  command -v "$1" >/dev/null 2>&1 || die "missing required tool: $1"
}

# ─── steps ────────────────────────────────────────────────────────────────
need_python() {
  require python3
  python3 -c 'import yaml' 2>/dev/null || die "missing pyyaml — install with: pip install pyyaml"
}

# Keep the JSON data files formatted the way lint-staged/prettier would, so a
# regenerated file never shows up as a whitespace-only diff.
format_json() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm exec prettier --write --log-level warn "$@" >/dev/null 2>&1 || true
  fi
}

step_stars() {
  log "[1/6] refreshing star cache -> src/data/touch-points-star-cache.json (canonical)"
  need_python
  require gh; require jq
  # fetch-stars.sh writes the research YAML; sync merges it INTO the canonical
  # JSON (union, newest-asof-wins) and re-emits the YAML as a derived mirror.
  # The merge is guarded, so a rate-limited fetch degrades to a no-op rather
  # than deleting repos.
  bash research/scripts/fetch-stars.sh
  python3 scripts/sync-star-cache.py --backfill-missing
  format_json src/data/touch-points-star-cache.json
}

step_rollup() {
  log "[2/6] recomputing rollup (research/touch-points-rollup.yaml)"
  need_python
  ( cd research && python3 scripts/rollup-blast-radius.py )
}

step_weights() {
  log "[3/6] recomputing behavior-category usage_weight from the rollup"
  need_python
  python3 scripts/recompute-usage-weights.py
  format_json src/data/behavior-categories.json
}

step_slugs() {
  log "[4/6] normalising repo slugs to canonical owner/name"
  need_python
  python3 scripts/normalize-repo-slugs.py
  format_json src/data/touch-points-database.json src/data/touch-points-rollup.json \
    src/data/behavior-categories.json
}

# Read-only guards. Every one of these caught a real, shipped staleness bug;
# they exist so the same class cannot come back silently.
step_check() {
  log "[check] running data drift + consistency guards"
  need_python
  local failed=0
  python3 scripts/recompute-usage-weights.py --check || failed=1
  python3 scripts/sync-star-cache.py --check       || failed=1
  python3 scripts/normalize-repo-slugs.py --check  || failed=1
  python3 scripts/check-repo-slugs.py              || failed=1
  [ $failed -eq 0 ] || die "data checks failed (see above)"
  log "✅ all data checks passed"
}

step_data() {
  log "[5/6] verifying dashboard data inputs are present + parseable"
  require python3
  python3 -c 'import yaml' 2>/dev/null || die "missing pyyaml — install with: pip install pyyaml"
  python3 - <<'PY'
import sys, yaml
from pathlib import Path
inputs = [
  "research/touch-points-database.yaml",
  "research/touch-points-rollup.yaml",
  "research/touch-points-star-cache.yaml",
  "research/workspace-mirror/research/touch-points/behavior-categories.yaml",
]
errors = 0
for p in inputs:
  path = Path(p)
  if not path.exists():
    print(f"  ✗ MISSING:    {p}"); errors += 1; continue
  try:
    yaml.safe_load(path.read_text())
    size_kb = path.stat().st_size // 1024
    print(f"  ✓ {p}  ({size_kb} kB)")
  except yaml.YAMLError as e:
    print(f"  ✗ PARSE ERR:  {p}: {e}"); errors += 1
sys.exit(errors)
PY
  step_check
}

step_clean() {
  log "[clean] removing dist/ and Vite cache"
  rm -rf dist node_modules/.vite
}

step_build() {
  log "[6/6] running pnpm build (vite + vue-tsc)"
  require pnpm
  if [ ! -d node_modules ]; then
    log "  installing dependencies (pnpm install)"
    pnpm install --frozen-lockfile
  fi
  pnpm build
}

step_test() {
  log "[test] running pnpm test (vitest)"
  require pnpm
  pnpm test
}

# ─── parse args ───────────────────────────────────────────────────────────
SKIP_STARS=0
CLEAN=0
TARGET=""

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-stars)         SKIP_STARS=1 ;;
    --clean)              CLEAN=1 ;;
    -h|--help)
      sed -n '2,30p' "$0"; exit 0 ;;
    stars|rollup|weights|slugs|data|check|build|clean|test|all)
      TARGET="$1" ;;
    *)
      die "unknown argument: $1 (try --help)" ;;
  esac
  shift
done

# ─── dispatch ─────────────────────────────────────────────────────────────
case "${TARGET:-all}" in
  stars)   step_stars ;;
  rollup)  step_rollup ;;
  weights) step_weights ;;
  slugs)   step_slugs ;;
  data)    step_data ;;
  check)   step_check ;;
  build)   [ $CLEAN -eq 1 ] && step_clean; step_build ;;
  clean)   step_clean ;;
  test)    step_test ;;
  all)
    [ $CLEAN -eq 1 ] && step_clean
    if [ $SKIP_STARS -eq 0 ]; then
      step_stars
    else
      warn "skipping stars (--skip-stars)"
      # Still reconcile the two caches offline so they cannot drift.
      need_python
      python3 scripts/sync-star-cache.py
      format_json src/data/touch-points-star-cache.json
    fi
    step_rollup
    step_weights
    step_slugs
    step_data
    step_build
    log "✅ rebuild complete"
    ;;
esac
