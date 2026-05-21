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

# Restore intentionally-kept "future surface" placeholder pages from git
# HEAD. These describe surfaces that are A14 PHASE_A_EXCLUDED (commented
# out in source pending Phase B re-enablement) but whose published doc
# pages communicate the planned shape to extension authors. Per design
# direction 2026-05-21: keep these absent-but-coming-back pages visible.
# A page that wholesale moved (e.g. v1-only `extensionmanager`) is NOT
# restored — the canonical surface is the v2 reference.
PRESERVED_PAGES=(
  nodeconnectedevent.mdx
  nodedisconnectedevent.mdx
  nodemodechangedevent.mdx
  nodepositionchangedevent.mdx
  nodesizechangedevent.mdx
  nodemode.mdx
  slotdirection.mdx
  slotinfo.mdx
)
restored=0
for page in "${PRESERVED_PAGES[@]}"; do
  if git -C "$(dirname "$0")/.." show "HEAD:src/data/api-docs/$page" > "$DST_DIR/$page" 2>/dev/null; then
    restored=$((restored + 1))
  else
    rm -f "$DST_DIR/$page"
  fi
done
echo "Restored $restored intentionally-kept placeholder page(s) from HEAD."

# Post-process: drop @deprecated members that have a clear v1→v2
# migration path. Members kept "absent on purpose" (A14 PHASE_A_EXCLUDED)
# never appear in TypeDoc output, so this only affects deprecated-with-
# replacement entries. Done in this repo (not upstream packages/extension-api)
# to respect the Phase A surface freeze.
node "$(dirname "$0")/strip-deprecated.mjs"

# Post-process: stamp PlannedBadge frontmatter onto the placeholder pages
# enumerated in scripts/planned-pages.json (W17.H). Renderer (ApiDocs.vue,
# W17.G) shows a "Phase B" / "ECS PR #11939" chip above the symbol title.
node "$(dirname "$0")/stamp-planned.mjs"

# Post-process: auto-link known symbols (W18.K). Wraps bare references to
# API types (e.g. WidgetHandle), ADR IDs (D14), and axiom IDs (A1) in
# `<a class="wiki-link">` pointing at the canonical detail page.
# Idempotent: skips text already inside <a>, fenced code, inline code,
# or markdown links. Capped at 3 hits per symbol per file.
node "$(dirname "$0")/wiki-link-mdx.mjs"

echo "✅ API docs refreshed. Review with: git diff --stat src/data/api-docs/"
