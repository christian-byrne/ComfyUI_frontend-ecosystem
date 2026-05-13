#!/usr/bin/env bash
# rebuild.sh — deterministic rebuild for the dashboard data pipeline.
#
# Implements Alex's ask in #26: a single command that regenerates the
# dashboard data + site from raw inputs without falling back on ad-hoc tools
# or one-off prompts. Re-runnable; same inputs ⇒ same outputs.
#
# Pipeline (in order):
#   1. stars  — refresh research/touch-points-star-cache.yaml from GitHub
#               (reads database.yaml, calls `gh api repos/<r>` for each repo)
#   2. rollup — recompute research/touch-points-rollup.yaml from
#               database.yaml + star-cache.yaml
#   3. data   — verify dashboard data inputs are present + parseable
#   4. build  — pnpm build (Vite reads YAMLs at build time via `?raw` import)
#
# Usage:
#   bash scripts/rebuild.sh             # full pipeline (stars + rollup + data + build)
#   bash scripts/rebuild.sh stars       # just refresh star cache
#   bash scripts/rebuild.sh rollup      # just recompute rollup
#   bash scripts/rebuild.sh data        # just verify data inputs
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
step_stars() {
  log "[1/4] refreshing star cache (research/touch-points-star-cache.yaml)"
  require gh; require jq
  bash research/scripts/fetch-stars.sh
}

step_rollup() {
  log "[2/4] recomputing rollup (research/touch-points-rollup.yaml)"
  require python3
  python3 -c 'import yaml' 2>/dev/null || die "missing pyyaml — install with: pip install pyyaml"
  ( cd research && python3 scripts/rollup-blast-radius.py )
}

step_data() {
  log "[3/4] verifying dashboard data inputs are present + parseable"
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
}

step_clean() {
  log "[clean] removing dist/ and Vite cache"
  rm -rf dist node_modules/.vite
}

step_build() {
  log "[4/4] running pnpm build (vite + vue-tsc)"
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
    stars|rollup|data|build|clean|test|all)
      TARGET="$1" ;;
    *)
      die "unknown argument: $1 (try --help)" ;;
  esac
  shift
done

# ─── dispatch ─────────────────────────────────────────────────────────────
case "${TARGET:-all}" in
  stars)  step_stars ;;
  rollup) step_rollup ;;
  data)   step_data ;;
  build)  [ $CLEAN -eq 1 ] && step_clean; step_build ;;
  clean)  step_clean ;;
  test)   step_test ;;
  all)
    [ $CLEAN -eq 1 ] && step_clean
    if [ $SKIP_STARS -eq 0 ]; then
      step_stars
    else
      warn "skipping stars (--skip-stars)"
    fi
    step_rollup
    step_data
    step_build
    log "✅ rebuild complete"
    ;;
esac
