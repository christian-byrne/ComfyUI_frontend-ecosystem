#!/usr/bin/env bash
# collect-evidence.sh — Search a repo for v1 API fingerprints via GitHub code search
# Outputs YAML evidence entries ready to paste into database.yaml
#
# Usage: bash scripts/collect-evidence.sh <owner/repo>
# Example: bash scripts/collect-evidence.sh Kosinkadink/ComfyUI-VideoHelperSuite

set -euo pipefail

REPO="${1:?Usage: $0 <owner/repo>}"

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ gh CLI not installed" >&2
  exit 1
fi

# Core v1 API fingerprints to search for
declare -A PATTERNS=(
  ["S1.H1"]="registerExtension"
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
  ["S3.C1"]="LGraphCanvas.prototype"
  ["S4.W1"]="widget.callback"
  ["S4.W2"]="widget.options.values"
  ["S6.A1"]="graphToPrompt"
  ["S6.A2"]="api.addEventListener"
  ["S11.G1"]="app.graph.add"
  ["S11.G2"]="LiteGraph.createNode"
)

echo "# Evidence for $REPO" >&2
echo "# Searched $(date +%Y-%m-%d)" >&2
echo "" >&2

found=0
for pattern_id in "${!PATTERNS[@]}"; do
  fingerprint="${PATTERNS[$pattern_id]}"

  # Search via GitHub code search API
  results=$(gh api "search/code?q=${fingerprint}+repo:${REPO}+language:javascript+language:typescript" \
    --jq '.items[] | "\(.path):\(.text_matches[0].fragment // "")"' 2>/dev/null || true)

  if [[ -n "$results" ]]; then
    echo "  # $pattern_id — $fingerprint" >&2
    while IFS=':' read -r filepath fragment; do
      [[ -z "$filepath" ]] && continue
      found=$((found + 1))
      # Get line number by fetching file and grepping
      line=$(gh api "repos/$REPO/contents/$filepath" --jq '.content' 2>/dev/null | base64 -d 2>/dev/null | grep -n "$fingerprint" | head -1 | cut -d: -f1 || echo "1")

      echo "  - repo: $REPO"
      echo "    file: $filepath"
      echo "    lines: [$line]"
      echo "    url: https://github.com/$REPO/blob/HEAD/$filepath#L$line"
      echo "    pattern_id: $pattern_id"
      echo "    source: github-code-search"
      echo ""
    done <<< "$results"
  fi

  # Rate limit protection
  sleep 0.5
done

echo "" >&2
if [[ $found -eq 0 ]]; then
  echo "⚠️  No evidence found for $REPO" >&2
else
  echo "✅ Found $found evidence entries for $REPO" >&2
fi
