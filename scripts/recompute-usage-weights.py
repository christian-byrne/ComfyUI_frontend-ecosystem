#!/usr/bin/env python3
"""recompute-usage-weights.py — regenerate behavior-category usage weights.

Why this exists
---------------
`src/data/behavior-categories.json` was produced by
`scripts/build-behavior-categories.py (I-TF.1)`, a generator that lives in the
cross-repo research workspace and was **never** vendored into this repo. The
consequence: when new patterns and categories were merged in (Notion sweeps,
S16/S17 families, BC.33-BC.41) nobody could re-run the generator, so:

  * `meta.source_pattern_count` / `meta.category_count` froze at 62 / 37 while
    the real rollup grew to 73 patterns and the file grew to 41 categories, and
  * every `usage_weight` went stale — the categories added after the freeze
    were left at a literal `0.00`, which ranked them dead last in every
    weight-sorted view. BC.36 (PrimeVue widget API surface) is the worst case:
    stored 0.00, actually 230.83, i.e. rank 2 of 41.

This script re-derives the one number the generator computed from the rollup,
so the weights are reproducible in-repo without the missing generator.

Formula (unchanged, per `meta.usage_weight_formula`):

    usage_weight = sum over member_pattern_ids of (blast_radius * occurrences)

using `research/touch-points-rollup.yaml` as the source of truth.

Provenance is preserved: the pre-existing value is stashed in
`usage_weight_legacy` on first run and never overwritten afterwards, so the
historical (wrong) ranking stays auditable.

Idempotency: re-running with unchanged inputs is a no-op, including
`meta.usage_weight_recomputed_at` — the stamp only moves when a weight or a
count actually changes. `--check` exits non-zero when a re-run would change
anything, which is what CI asserts.

Usage:
    python3 scripts/recompute-usage-weights.py            # rewrite in place
    python3 scripts/recompute-usage-weights.py --check    # CI: fail if stale
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover - environment guard
    sys.exit("missing pyyaml — install with: pip install pyyaml")

ROOT = Path(__file__).resolve().parent.parent
ROLLUP = ROOT / "research" / "touch-points-rollup.yaml"
CATEGORIES = ROOT / "src" / "data" / "behavior-categories.json"

# The stale-weight admission that this script makes false. Removed from
# meta.notes once the weights are actually recomputed.
STALE_NOTE_MARKER = "usage_weight values below are NOT yet updated"

RECOMPUTE_NOTE = (
    "usage_weight is recomputed by scripts/recompute-usage-weights.py from "
    "research/touch-points-rollup.yaml (not by the unvendored "
    "build-behavior-categories.py). The pre-recompute value is preserved per "
    "category in usage_weight_legacy — many were a placeholder 0.00 because "
    "the category post-dated the last generator run. Re-run via `make weights`."
)


def load_rollup() -> dict[str, dict]:
    """pattern_id -> rollup entry."""
    doc = yaml.safe_load(ROLLUP.read_text())
    return {p["pattern_id"]: p for p in doc.get("patterns", [])}


def compute(members: list[str], rollup: dict[str, dict]) -> float:
    """sum(blast_radius * occurrences) over the category's member patterns."""
    total = 0.0
    for pid in members:
        entry = rollup[pid]
        total += float(entry["blast_radius"]) * float(entry["occurrences"])
    return round(total, 2)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--check",
        action="store_true",
        help="exit 1 if the checked-in file is stale; write nothing",
    )
    ap.add_argument(
        "--today",
        default=None,
        help="override the recompute stamp (default: UTC today) — for tests",
    )
    args = ap.parse_args()

    rollup = load_rollup()
    doc = json.loads(CATEGORIES.read_text())
    meta = doc["meta"]
    categories = doc["categories"]

    # Fail loud on a member pattern the rollup does not know about: a silent
    # skip would understate the weight and re-create the bug this script fixes.
    unknown = sorted(
        {pid for c in categories for pid in c["member_pattern_ids"] if pid not in rollup}
    )
    if unknown:
        print(
            f"✗ {len(unknown)} member_pattern_ids absent from {ROLLUP.name}: "
            f"{', '.join(unknown)}",
            file=sys.stderr,
        )
        return 2

    changes: list[tuple[str, float, float]] = []
    for cat in categories:
        old = float(cat.get("usage_weight", 0.0))
        new = compute(cat["member_pattern_ids"], rollup)
        if abs(new - old) >= 0.005:
            changes.append((cat["category_id"], old, new))
        # Stash the original once; never clobber an existing legacy value.
        cat.setdefault("usage_weight_legacy", old)
        cat["usage_weight"] = new

    meta_changed = False
    for key, value in (
        ("source_pattern_count", len(rollup)),
        ("category_count", len(categories)),
        ("usage_weight_source", str(ROLLUP.relative_to(ROOT))),
    ):
        if meta.get(key) != value:
            meta[key] = value
            meta_changed = True

    notes = [n for n in meta.get("notes", []) if STALE_NOTE_MARKER not in n]
    if RECOMPUTE_NOTE not in notes:
        notes.append(RECOMPUTE_NOTE)
    if notes != meta.get("notes"):
        meta["notes"] = notes
        meta_changed = True

    stale = bool(changes) or meta_changed
    if stale:
        meta["usage_weight_recomputed_at"] = args.today or _dt.date.today().isoformat()
    else:
        # Idempotent re-run: keep the existing stamp so the file is byte-stable.
        meta.setdefault("usage_weight_recomputed_at", args.today or _dt.date.today().isoformat())

    # Keep meta key order deterministic and readable.
    ordered = {}
    for key in (
        "schema_version",
        "generated_from",
        "generated_by",
        "source_pattern_count",
        "category_count",
        "usage_weight_formula",
        "usage_weight_source",
        "usage_weight_recomputed_at",
        "exemplar_ranking",
        "notes",
    ):
        if key in meta:
            ordered[key] = meta.pop(key)
    ordered.update(meta)  # anything unanticipated keeps its place at the end
    doc["meta"] = ordered

    if args.check:
        if stale:
            print(
                f"✗ {CATEGORIES.relative_to(ROOT)} is stale — "
                f"{len(changes)} usage_weight value(s) and "
                f"{'some' if meta_changed else 'no'} meta field(s) would change.\n"
                f"  Run: make weights",
                file=sys.stderr,
            )
            for cid, old, new in changes[:10]:
                print(f"    {cid}: {old:.2f} -> {new:.2f}", file=sys.stderr)
            return 1
        print(f"✓ {CATEGORIES.relative_to(ROOT)} usage weights are current")
        return 0

    CATEGORIES.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    print(
        f"✓ wrote {CATEGORIES.relative_to(ROOT)} — "
        f"{len(categories)} categories, {len(rollup)} source patterns, "
        f"{len(changes)} weight(s) changed"
    )
    for cid, old, new in sorted(changes, key=lambda c: -c[2])[:5]:
        print(f"    {cid}: {old:.2f} -> {new:.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
