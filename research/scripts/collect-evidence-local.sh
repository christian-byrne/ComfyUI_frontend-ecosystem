#!/usr/bin/env bash
# collect-evidence-local.sh — Clone repo and grep for v1 API fingerprints
# More reliable than GitHub code search API
#
# Usage: bash scripts/collect-evidence-local.sh <owner/repo>
# Example: bash scripts/collect-evidence-local.sh Kosinkadink/ComfyUI-VideoHelperSuite

set -euo pipefail

REPO="${1:?Usage: $0 <owner/repo>}"
CLONE_DIR="/tmp/evidence-scan/${REPO//\//__}"

echo "📦 Cloning $REPO..." >&2
rm -rf "$CLONE_DIR"
gh repo clone "$REPO" "$CLONE_DIR" -- --depth 1 --quiet 2>/dev/null

# Core v1 API fingerprints
declare -A PATTERNS=(
  ["S1.H1"]="app.registerExtension"
  ["S1.H2"]="beforeRegisterNodeDef"
  ["S1.H3"]="getCustomWidgets"
  ["S1.H4"]="nodeCreated"
  ["S1.H5"]="loadedGraphNode"
  ["S2.N1"]="prototype.onNodeCreated"
  ["S2.N2"]="prototype.onExecuted"
  ["S2.N3"]="prototype.onConnectionsChange"
  ["S2.N4"]="prototype.onRemoved"
  ["S2.N5"]="prototype.getExtraMenuOptions"
  ["S2.N13"]="prototype.onDrawForeground"
  ["S4.W1"]=".callback.*="
  ["S6.A1"]="graphToPrompt"
  ["S6.A2"]="api.addEventListener"
  ["S11.G2"]="LiteGraph.createNode"
)

echo "" >&2
echo "# Evidence for $REPO"
echo "# Searched $(date +%Y-%m-%d) via local clone"
echo ""

found=0
for pattern_id in $(echo "${!PATTERNS[@]}" | tr ' ' '\n' | sort); do
  fingerprint="${PATTERNS[$pattern_id]}"

  # Search in web/, js/, src/ directories for JS/TS files
  results=$(grep -rn "$fingerprint" "$CLONE_DIR"/{web,js,src}/ --include="*.js" --include="*.ts" 2>/dev/null || true)

  if [[ -n "$results" ]]; then
    echo "  # $pattern_id — $fingerprint" >&2
    while IFS=':' read -r filepath line rest; do
      [[ -z "$filepath" ]] && continue
      found=$((found + 1))
      # Make path relative
      relpath="${filepath#$CLONE_DIR/}"

      echo "  - repo: $REPO"
      echo "    file: $relpath"
      echo "    lines: [$line]"
      echo "    url: https://github.com/$REPO/blob/HEAD/$relpath#L$line"
      echo "    pattern_id: $pattern_id"
      echo "    source: local-clone"
      echo ""
    done <<< "$results"
  fi
done

# Cleanup
rm -rf "$CLONE_DIR"

echo "" >&2
if [[ $found -eq 0 ]]; then
  echo "⚠️  No evidence found for $REPO" >&2
else
  echo "✅ Found $found evidence entries for $REPO" >&2
fi
