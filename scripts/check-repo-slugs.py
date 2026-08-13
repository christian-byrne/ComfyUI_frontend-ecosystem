#!/usr/bin/env python3
"""check-repo-slugs.py — CI gate: every cited repo slug resolves in the star cache.

Issue #30 part C. This is the guard that keeps the slug normalisation from
rotting: a slug that does not resolve against
`src/data/touch-points-star-cache.json` contributes **0 stars** to
`cumulative_stars`, which silently understates `blast_radius` for every
pattern the repo appears under. That failure is invisible in the UI — the
number is simply lower than it should be — so it needs a build-time check.

Three rules, checked over `top_repos` (rollup), `evidence[].repo` (database)
and `exemplars[].repo` (behavior categories):

  1. **Shape** — a repo value is either canonical `owner/name` or an explicit
     non-repo aggregate source in parenthesised form, e.g.
     `(aggregate — Notion §2.2)`. A bare `comfyui-mixlab-nodes` is neither and
     fails.
  2. **Resolution** — every canonical slug has a row in the star cache.
  3. **No known forks** — slugs listed in normalize-repo-slugs.py's SLUG_MAP
     must have been rewritten to their canonical upstream.

Usage:
    python3 scripts/check-repo-slugs.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# The fork/bare-slug list has exactly one home: normalize-repo-slugs.py. That
# filename has hyphens so it is not importable as a module; load it by path so
# the two scripts can never disagree about what "canonical" means.
_normalizer_path = ROOT / "scripts" / "normalize-repo-slugs.py"
_ns: dict = {"__name__": "_normalize_repo_slugs", "__file__": str(_normalizer_path)}
exec(  # noqa: S102 - trusted, in-repo sibling script
    compile(_normalizer_path.read_text(), str(_normalizer_path), "exec"), _ns
)
KNOWN_NONCANONICAL: dict = _ns["SLUG_MAP"]

STAR_CACHE = ROOT / "src" / "data" / "touch-points-star-cache.json"

CANONICAL_RE = re.compile(r"^[A-Za-z0-9][\w.-]*/[\w.-]+$")
# Aggregate / first-principles evidence with no single backing repo. These are
# legitimate rows; they are marked by the parenthesised form so they can never
# be mistaken for an unresolvable repo.
NON_REPO_RE = re.compile(r"^\(.+\)$")

SOURCES = [
    ("top_repos", ROOT / "src" / "data" / "touch-points-rollup.json"),
    ("evidence", ROOT / "src" / "data" / "touch-points-database.json"),
    ("exemplars", ROOT / "src" / "data" / "behavior-categories.json"),
]


def collect(path: Path) -> dict[str, int]:
    """repo value -> occurrence count, anywhere in the document."""
    found: dict[str, int] = {}

    def walk(node):
        if isinstance(node, list):
            for item in node:
                walk(item)
        elif isinstance(node, dict):
            repo = node.get("repo")
            if isinstance(repo, str):
                found[repo] = found.get(repo, 0) + 1
            for value in node.values():
                walk(value)

    walk(json.loads(path.read_text()))
    return found


def main() -> int:
    star_cache = {r["repo"] for r in json.loads(STAR_CACHE.read_text())["repos"]}
    failures: list[str] = []
    checked = 0
    aggregates = 0

    for label, path in SOURCES:
        if not path.exists():
            failures.append(f"{label}: missing data file {path.relative_to(ROOT)}")
            continue
        for repo, count in sorted(collect(path).items()):
            if NON_REPO_RE.match(repo):
                aggregates += 1
                continue
            checked += 1
            where = f"{path.relative_to(ROOT)} ({label}, {count}x)"
            if repo in KNOWN_NONCANONICAL:
                canonical, reason = KNOWN_NONCANONICAL[repo]
                failures.append(
                    f"{where}: '{repo}' is a known non-canonical slug ({reason}) "
                    f"— should be '{canonical}'. Run: make slugs"
                )
                continue
            if not CANONICAL_RE.match(repo):
                failures.append(
                    f"{where}: '{repo}' is neither canonical 'owner/name' nor a "
                    f"parenthesised non-repo source"
                )
                continue
            if repo not in star_cache:
                failures.append(
                    f"{where}: '{repo}' does not resolve against "
                    f"{STAR_CACHE.relative_to(ROOT)} — it contributes 0 stars to "
                    f"cumulative_stars and understates blast_radius. "
                    f"Run: make stars-backfill"
                )

    if failures:
        print(f"✗ repo-slug check failed ({len(failures)} problem(s)):", file=sys.stderr)
        for f in failures:
            print(f"    {f}", file=sys.stderr)
        return 1

    print(
        f"✓ repo-slug check passed — {checked} slug reference(s) resolve against "
        f"the star cache ({len(star_cache)} repos); "
        f"{aggregates} non-repo aggregate source(s) skipped"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
