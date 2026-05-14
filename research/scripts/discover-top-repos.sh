#!/usr/bin/env bash
# discover-top-repos.sh — Find top ComfyUI custom node repos by stars via GitHub API
# Outputs repos NOT already in the database for potential inclusion.
#
# Usage: bash scripts/discover-top-repos.sh [--top N] [--min-stars N]
# Example: bash scripts/discover-top-repos.sh --top 100 --min-stars 100

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
DB="$DIR/../touch-points-database.yaml"
TOP=${TOP:-100}
MIN_STARS=${MIN_STARS:-50}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --top) TOP="$2"; shift 2 ;;
    --min-stars) MIN_STARS="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ gh CLI not installed"
  exit 1
fi

echo "🔍 Discovering top-$TOP ComfyUI repos with ≥$MIN_STARS stars..." >&2

# Get existing repos from database
existing=$(grep -oE 'repo:\s*[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+' "$DB" | sed -E 's/repo:\s*//' | sort -u)

# Search for ComfyUI repos with frontend code (js/ts extensions)
# Multiple queries to cover different naming patterns
queries=(
  "comfyui extension language:javascript stars:>=$MIN_STARS"
  "comfyui nodes language:typescript stars:>=$MIN_STARS"
  "comfyui custom language:javascript stars:>=$MIN_STARS"
  "ComfyUI_frontend language:javascript stars:>=$MIN_STARS"
)

all_repos=""
for q in "${queries[@]}"; do
  echo "  Searching: $q" >&2
  results=$(gh api "search/repositories?q=$(echo "$q" | sed 's/ /+/g')&sort=stars&order=desc&per_page=$TOP" \
    --jq '.items[] | "\(.full_name)\t\(.stargazers_count)\t\(.description // "No description")"' 2>/dev/null || true)
  all_repos+="$results"$'\n'
done

# Dedupe, sort by stars, filter
echo "" >&2
echo "=== Repos NOT in database (candidates for inclusion) ===" >&2
echo "STARS | REPO | DESCRIPTION" >&2
echo "------|------|------------" >&2

echo "$all_repos" | sort -t$'\t' -k2 -rn | uniq | while IFS=$'\t' read -r repo stars desc; do
  [[ -z "$repo" ]] && continue
  # Check if already in database
  if echo "$existing" | grep -qF "$repo"; then
    continue
  fi
  # Check if it has frontend code (js/ or web/ directory)
  has_frontend=$(gh api "repos/$repo/contents" --jq '.[].name' 2>/dev/null | grep -qE '^(js|web|src)$' && echo "yes" || echo "")
  if [[ -n "$has_frontend" ]]; then
    printf "%5s | %-45s | %.60s\n" "$stars" "$repo" "$desc"
  fi
done | head -"$TOP"

echo "" >&2
echo "✅ Discovery complete. Add promising repos to database.yaml with evidence." >&2
