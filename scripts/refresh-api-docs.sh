#!/usr/bin/env bash
# refresh-api-docs.sh — re-run the P2 docgen pipeline and copy the
# generated Mintlify MDX into this repo's src/data/api-docs/ folder.
#
# Run from the repo root, or via `pnpm refresh:api-docs` once we add it
# to package.json. Requires the @comfyorg/extension-api worktree to live
# at $EXT_API_WORKTREE (override with env var).
#
# After running, commit the changes to src/data/api-docs/ along with any
# router/page tweaks if the docgen output schema shifts.
set -euo pipefail

EXT_API_WORKTREE="${EXT_API_WORKTREE:-$HOME/worktrees/ComfyUI_frontend/restack-pkg-v2}"
PKG_DIR="$EXT_API_WORKTREE/packages/extension-api"
SRC_DIR="$PKG_DIR/docs-build/mintlify"
DST_DIR="$(cd "$(dirname "$0")/.." && pwd)/src/data/api-docs"

if [ ! -d "$PKG_DIR" ]; then
  echo "ERROR: extension-api worktree not found at $PKG_DIR" >&2
  echo "Set EXT_API_WORKTREE env var to override." >&2
  exit 1
fi

echo "Building API docs in $PKG_DIR ..."
(cd "$EXT_API_WORKTREE" && pnpm --filter @comfyorg/extension-api docs:build >/dev/null)

if [ ! -d "$SRC_DIR" ]; then
  echo "ERROR: docgen output missing at $SRC_DIR" >&2
  exit 1
fi

echo "Copying $(ls "$SRC_DIR"/*.mdx | wc -l) pages → $DST_DIR ..."
mkdir -p "$DST_DIR"
# Wipe existing pages so removed symbols don't linger.
find "$DST_DIR" -name '*.mdx' -delete
cp "$SRC_DIR"/*.mdx "$DST_DIR/"
cp "$SRC_DIR/nav-snippet.json" "$DST_DIR/"

echo "✅ API docs refreshed. Review with: git diff --stat src/data/api-docs/"
