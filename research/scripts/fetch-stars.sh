#!/usr/bin/env bash
# fetch-stars.sh — populate research/touch-points/star-cache.yaml
# Reads database.yaml, extracts unique repo: entries, queries gh api for stars.
# Usage: bash scripts/fetch-stars.sh
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
DB="$DIR/../touch-points-database.yaml"
CACHE="$DIR/../touch-points-star-cache.yaml"

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ gh CLI not installed"
  exit 1
fi

# Extract unique repo: entries from database
repos=$(grep -E '^\s*-\s*repo:\s' "$DB" | sed -E 's/^\s*-\s*repo:\s*//' | sort -u | grep -v '^$' || true)

today=$(date +%Y-%m-%d)

{
  echo "# ───────────────────────────────────────────────────────────────────────"
  echo "# GitHub star cache for repos referenced in database.yaml"
  echo "# Refresh: bash scripts/fetch-stars.sh"
  echo "# Asof dates allow drift detection"
  echo "# ───────────────────────────────────────────────────────────────────────"
  echo ""
  echo "asof: $today"
  echo "populated_via: scripts/fetch-stars.sh"
  echo ""
  echo "repos:"
} > "$CACHE.tmp"

count=0
err_count=0
for r in $repos; do
  count=$((count + 1))
  printf "  [%3d] %s ... " "$count" "$r" >&2
  if data=$(gh api "repos/$r" 2>/dev/null); then
    stars=$(echo "$data" | jq -r '.stargazers_count')
    archived=$(echo "$data" | jq -r '.archived')
    forks=$(echo "$data" | jq -r '.forks_count')
    last=$(echo "$data" | jq -r '.pushed_at' | cut -dT -f1)
    echo "★ $stars" >&2
    {
      echo "  - repo: $r"
      echo "    stars: $stars"
      echo "    archived: $archived"
      echo "    forks: $forks"
      echo "    last_commit: $last"
      echo "    asof: $today"
    } >> "$CACHE.tmp"
  else
    err_count=$((err_count + 1))
    echo "ERROR" >&2
    {
      echo "  - repo: $r"
      echo "    stars: null"
      echo "    error: \"gh api failed (rate limit / repo missing / network)\""
      echo "    asof: $today"
    } >> "$CACHE.tmp"
  fi
done

mv "$CACHE.tmp" "$CACHE"
echo "" >&2
echo "✅ Wrote $CACHE — $count repos, $err_count errors" >&2
