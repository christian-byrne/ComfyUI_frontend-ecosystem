#!/usr/bin/env python3
"""sync-star-cache.py — reconcile the two star caches, newest-wins, never shrink.

Why this exists
---------------
There are two star caches and the README used to describe the flow backwards:

  * `src/data/touch-points-star-cache.json` — what the dashboard actually
    imports (`src/data/index.ts`, `src/data/star-cache.ts`). 131 repos,
    asof 2026-05-13.
  * `research/touch-points-star-cache.yaml` — written by
    `research/scripts/fetch-stars.sh`. 120 repos, asof 2026-05-08.

The README's pipeline table listed the YAML as a *source* feeding the JSON, so
`make stars` looked like a refresh. It was not: nothing ever converted YAML to
JSON, and the YAML was 11 repos and 5 days **behind** the JSON. Anyone running
the documented `make rebuild` and then hand-syncing would have regressed the
dashboard's data.

The fix, implemented here:

  * **JSON is canonical.** It is the artifact the app imports; it is also the
    newer of the two.
  * Reconciliation is a **union with newest-`asof`-wins per repo**, so neither
    file can delete a repo the other knows about, in either direction.
  * A **regression guard** refuses to write a result with fewer repos, or an
    older top-level `asof`, than the canonical JSON already has. `make stars`
    therefore cannot move the data backwards even if `gh` returns a partial or
    rate-limited answer.
  * The YAML is rewritten as a derived mirror of the merged set, so the two
    files stop drifting.

Usage:
    python3 scripts/sync-star-cache.py                    # merge + write both
    python3 scripts/sync-star-cache.py --check            # CI: fail if they disagree
    python3 scripts/sync-star-cache.py --backfill-missing # `gh`-fetch repos the
                                                          # data cites but the
                                                          # cache lacks
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import subprocess
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover - environment guard
    sys.exit("missing pyyaml — install with: pip install pyyaml")

ROOT = Path(__file__).resolve().parent.parent
JSON_CACHE = ROOT / "src" / "data" / "touch-points-star-cache.json"
YAML_CACHE = ROOT / "research" / "touch-points-star-cache.yaml"

YAML_HEADER = """\
# ───────────────────────────────────────────────────────────────────────
# GitHub star cache — DERIVED MIRROR, do not hand-edit.
#
# Canonical copy is src/data/touch-points-star-cache.json (that is the file
# the dashboard imports). This YAML is regenerated from the merged set by
# scripts/sync-star-cache.py so the two cannot drift.
#
# Refresh flow:  make stars
#   1. research/scripts/fetch-stars.sh queries `gh api` and writes fresh rows
#   2. sync-star-cache.py unions them into the canonical JSON, newest asof
#      wins per repo, and re-emits this mirror
#
# The merge never drops a repo and never lowers the top-level asof, so a
# partial or rate-limited fetch degrades to a no-op instead of a regression.
# ───────────────────────────────────────────────────────────────────────
"""


def _norm_asof(value) -> str:
    """PyYAML parses bare `2026-05-13` into a date; JSON keeps it a string."""
    return value.isoformat() if hasattr(value, "isoformat") else str(value or "")


def read_json() -> dict:
    if not JSON_CACHE.exists():
        return {"asof": "", "repos": []}
    return json.loads(JSON_CACHE.read_text())


def read_yaml() -> dict:
    if not YAML_CACHE.exists():
        return {"asof": "", "repos": []}
    doc = yaml.safe_load(YAML_CACHE.read_text()) or {}
    doc["asof"] = _norm_asof(doc.get("asof"))
    for row in doc.get("repos") or []:
        row["asof"] = _norm_asof(row.get("asof"))
        if "last_commit" in row:
            row["last_commit"] = _norm_asof(row["last_commit"])
    return doc


def merge(canonical: dict, other: dict) -> tuple[dict, list[str]]:
    """Union both caches; for a repo in both, the newer `asof` row wins."""
    merged: dict[str, dict] = {}
    notes: list[str] = []
    for source_name, doc in (("json", canonical), ("yaml", other)):
        for row in doc.get("repos") or []:
            repo = row.get("repo")
            if not repo:
                continue
            existing = merged.get(repo)
            if existing is None:
                merged[repo] = dict(row)
                continue
            if _norm_asof(row.get("asof")) > _norm_asof(existing.get("asof")):
                merged[repo] = dict(row)
                notes.append(f"{repo}: took newer row from {source_name}")

    row_asofs = [_norm_asof(r.get("asof")) for r in merged.values() if r.get("asof")]
    asof = max(
        [_norm_asof(canonical.get("asof")), _norm_asof(other.get("asof"))] + row_asofs
    )
    out = {
        # Newest row — i.e. when the cache was last touched at all.
        "asof": asof,
        # Oldest row — the staleness *floor*. A targeted backfill of one repo
        # moves `asof` forward while leaving 130 rows months old, so `asof`
        # alone reads as far fresher than the data is. Consumers that care
        # about staleness should read this one.
        "asof_oldest": min(row_asofs) if row_asofs else asof,
        "populated_via": "research/scripts/fetch-stars.sh + scripts/sync-star-cache.py",
        "repos": [merged[k] for k in sorted(merged, key=str.lower)],
    }
    return out, notes


def guard(result: dict, canonical: dict) -> list[str]:
    """Refuse any merge that would move the canonical data backwards."""
    errors = []
    before = {r["repo"] for r in canonical.get("repos") or []}
    after = {r["repo"] for r in result["repos"]}
    dropped = sorted(before - after)
    if dropped:
        errors.append(f"would drop {len(dropped)} repo(s): {', '.join(dropped[:8])}")
    if _norm_asof(result["asof"]) < _norm_asof(canonical.get("asof")):
        errors.append(
            f"would lower asof {canonical.get('asof')} -> {result['asof']}"
        )
    return errors


def emit_yaml(doc: dict) -> str:
    lines = [
        YAML_HEADER,
        f"asof: {doc['asof']}",
        f"asof_oldest: {doc['asof_oldest']}",
        f"populated_via: {doc['populated_via']}",
        "",
        "repos:",
    ]
    for row in doc["repos"]:
        lines.append(f"  - repo: {row['repo']}")
        for key in ("stars", "archived", "forks", "last_commit", "asof", "error"):
            if key not in row:
                continue
            value = row[key]
            if value is None:
                rendered = "null"
            elif isinstance(value, bool):
                rendered = "true" if value else "false"
            elif key == "error":
                rendered = json.dumps(str(value))
            else:
                rendered = str(value)
            lines.append(f"    {key}: {rendered}")
    return "\n".join(lines) + "\n"


# ── targeted backfill ─────────────────────────────────────────────────────
# Files whose evidence rows cite repos that must resolve against the cache.
DATA_FILES = [
    ROOT / "src" / "data" / "touch-points-database.json",
    ROOT / "src" / "data" / "touch-points-rollup.json",
    ROOT / "src" / "data" / "behavior-categories.json",
]
NON_REPO_RE = re.compile(r"^\(.+\)$")


def cited_repos() -> set[str]:
    found: set[str] = set()

    def walk(node):
        if isinstance(node, list):
            for item in node:
                walk(item)
        elif isinstance(node, dict):
            repo = node.get("repo")
            if isinstance(repo, str) and repo and not NON_REPO_RE.match(repo):
                found.add(repo)
            for value in node.values():
                walk(value)

    for path in DATA_FILES:
        if path.exists():
            walk(json.loads(path.read_text()))
    return found


def gh_fetch(repo: str) -> dict | None:
    """One `gh api repos/<slug>` call -> a star-cache row, or None on failure."""
    proc = subprocess.run(
        [
            "gh",
            "api",
            f"repos/{repo}",
            "--jq",
            "{stars:.stargazers_count,archived:.archived,forks:.forks_count,"
            "last_commit:(.pushed_at|split(\"T\")[0])}",
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        return None
    row = json.loads(proc.stdout)
    row["repo"] = repo
    row["asof"] = _dt.date.today().isoformat()
    return {k: row[k] for k in ("repo", "stars", "archived", "forks", "last_commit", "asof")}


def backfill(canonical: dict) -> int:
    """Fetch only repos the data cites but the cache lacks. Cheap + rerunnable."""
    have = {r["repo"] for r in canonical.get("repos") or []}
    missing = sorted(cited_repos() - have)
    if not missing:
        print("✓ no missing repos to backfill")
        return 0
    print(f"backfilling {len(missing)} repo(s) absent from the cache…")
    added = 0
    for repo in missing:
        row = gh_fetch(repo)
        if row is None:
            print(f"    ✗ {repo} — gh api failed (rate limit / gone / no auth)", file=sys.stderr)
            continue
        canonical.setdefault("repos", []).append(row)
        print(f"    ✓ {repo} — ★{row['stars']}")
        added += 1
    return added


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="CI: fail if the caches disagree")
    ap.add_argument(
        "--backfill-missing",
        action="store_true",
        help="`gh`-fetch star rows for repos the data cites but the cache lacks",
    )
    ap.add_argument(
        "--refresh",
        nargs="+",
        metavar="SLUG",
        default=[],
        help="`gh`-refetch these specific repos (e.g. a row a failed fetch left at 0★)",
    )
    args = ap.parse_args()

    canonical = read_json()
    if args.backfill_missing:
        backfill(canonical)
    for slug in args.refresh:
        row = gh_fetch(slug)
        if row is None:
            print(f"    ✗ {slug} — gh api failed", file=sys.stderr)
            continue
        rows = canonical.setdefault("repos", [])
        for i, existing in enumerate(rows):
            if existing.get("repo") == slug:
                rows[i] = row
                break
        else:
            rows.append(row)
        print(f"    ✓ refreshed {slug} — ★{row['stars']}")
    other = read_yaml()
    result, notes = merge(canonical, other)

    errors = guard(result, canonical)
    if errors:
        print("✗ star-cache merge rejected (would regress canonical JSON):", file=sys.stderr)
        for e in errors:
            print(f"    {e}", file=sys.stderr)
        return 2

    new_json = json.dumps(result, indent=2, ensure_ascii=False) + "\n"
    new_yaml = emit_yaml(result)
    json_stale = not JSON_CACHE.exists() or JSON_CACHE.read_text() != new_json
    yaml_stale = not YAML_CACHE.exists() or YAML_CACHE.read_text() != new_yaml

    if args.check:
        if json_stale or yaml_stale:
            stale = ", ".join(
                n for n, s in ((JSON_CACHE.name, json_stale), (YAML_CACHE.name, yaml_stale)) if s
            )
            print(f"✗ star caches out of sync ({stale}) — run: make stars-sync", file=sys.stderr)
            return 1
        print(f"✓ star caches in sync — {len(result['repos'])} repos, asof {result['asof']}")
        return 0

    JSON_CACHE.write_text(new_json)
    YAML_CACHE.write_text(new_yaml)
    print(
        f"✓ star caches synced — {len(result['repos'])} repos "
        f"(json had {len(canonical.get('repos') or [])}, "
        f"yaml had {len(other.get('repos') or [])}), asof {result['asof']}"
    )
    for note in notes[:5]:
        print(f"    {note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
