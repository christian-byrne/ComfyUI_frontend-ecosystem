#!/usr/bin/env bash
# sync-knowledge.sh — Mirror the ECS workspace's design knowledge
# (ADRs, axioms, context, todo, agents-guide, announcements) into this
# repo so the dashboard can serve them as first-class pages.
#
# The workspace at $WORKSPACE_DIR is intentionally NOT a git repo (per
# user direction); this script copies the canonical markdown into
# src/data/knowledge/ where the Vue app's import.meta.glob picks it up.
#
# Run via: bash scripts/sync-knowledge.sh
#          (or `pnpm sync:knowledge` once registered)
#
# CI integration: .github/workflows/knowledge-sync-check.yml runs this
# script on PR and fails if any tracked file has unsynced changes.
set -euo pipefail

WORKSPACE_DIR="${WORKSPACE_DIR:-$HOME/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api}"
DST_DIR="$(cd "$(dirname "$0")/.." && pwd)/src/data/knowledge"

if [ ! -d "$WORKSPACE_DIR" ]; then
  echo "ERROR: workspace not found at $WORKSPACE_DIR" >&2
  echo "Set WORKSPACE_DIR env var to override." >&2
  exit 1
fi

echo "📚 Syncing knowledge: $WORKSPACE_DIR → $DST_DIR"

# Wipe + recreate subdirs. Idempotent on every run.
rm -rf "$DST_DIR"
mkdir -p "$DST_DIR/decisions" "$DST_DIR/root" "$DST_DIR/announcements"

# ── ADRs ─────────────────────────────────────────────────────────────
adr_count=0
if [ -d "$WORKSPACE_DIR/decisions" ]; then
  for f in "$WORKSPACE_DIR/decisions"/*.md; do
    [ -f "$f" ] || continue
    cp "$f" "$DST_DIR/decisions/$(basename "$f")"
    adr_count=$((adr_count + 1))
  done
fi
echo "  ✓ ${adr_count} ADRs"

# ── Root context files ───────────────────────────────────────────────
root_count=0
for f in AXIOMS.md CONTEXT.md AGENTS.md todo.md axioms-theorems.md; do
  if [ -f "$WORKSPACE_DIR/$f" ]; then
    cp "$WORKSPACE_DIR/$f" "$DST_DIR/root/$f"
    root_count=$((root_count + 1))
  fi
done
# W19.A3 — glossary lives under docs/ in the workspace; mirror flat into
# root/ so the dashboard /glossary route can load it via the same
# knowledge-loader pattern as AXIOMS/CONTEXT/AGENTS/todo/axioms-theorems.
if [ -f "$WORKSPACE_DIR/docs/glossary.md" ]; then
  cp "$WORKSPACE_DIR/docs/glossary.md" "$DST_DIR/root/glossary.md"
  root_count=$((root_count + 1))
fi
echo "  ✓ ${root_count} root context files"

# ── Announcements ────────────────────────────────────────────────────
# Try multiple candidate locations — announcement drafts have lived in
# both ComfyUI_frontend/docs/announcements/ and a sibling worktree
# (workspace-name keyed) depending on which agent wrote them.
ann_count=0
for ann_src in \
  "$WORKSPACE_DIR/ComfyUI_frontend/docs/announcements" \
  "$HOME/worktrees/docs/$(basename "$WORKSPACE_DIR")/announcements" \
  "$WORKSPACE_DIR/docs/announcements"
do
  [ -d "$ann_src" ] || continue
  for f in "$ann_src"/*.md; do
    [ -f "$f" ] || continue
    cp "$f" "$DST_DIR/announcements/$(basename "$f")"
    ann_count=$((ann_count + 1))
  done
done
echo "  ✓ ${ann_count} announcements"

# ── Manifest (consumed by knowledge-loader.ts) ───────────────────────
node "$(dirname "$0")/build-knowledge-manifest.mjs"

echo "✅ Knowledge sync complete: $((adr_count + root_count + ann_count)) files copied"
