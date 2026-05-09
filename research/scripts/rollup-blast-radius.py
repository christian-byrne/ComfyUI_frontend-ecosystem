#!/usr/bin/env python3
# rollup-blast-radius.py — compute per-pattern blast-radius metrics from
# database.yaml + star-cache.yaml, write to research/touch-points/rollup.yaml.
#
# Blast-radius formula (per PLAN.md):
#   br = (log10(1 + cumulative_stars))      * w_stars       (default 1.0)
#      + (log10(1 + occurrence_count))      * w_occ         (default 0.7)
#      + (signature_count - 1)              * w_sig         (default 0.5)
#      + silent_breakage_weight             * w_silent      (default 0.5)
#      + lifecycle_coupling_weight          * w_lifecycle   (default 0.4)
#
# silent_breakage_weight & lifecycle_coupling_weight come from the per-pattern
# heuristics field; if absent they default to 0.

import math
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "touch-points-database.yaml"
STARS = ROOT / "touch-points-star-cache.yaml"
OUT = ROOT / "touch-points-rollup.yaml"

W = {
    "stars": 1.0,
    "occ": 0.7,
    "sig": 0.5,
    "silent": 0.5,
    "lifecycle": 0.4,
}


def load_stars() -> dict[str, int]:
    if not STARS.exists():
        return {}
    cache = yaml.safe_load(STARS.read_text())
    out = {}
    for r in cache.get("repos", []) or []:
        if r.get("stars") is not None:
            out[r["repo"]] = int(r["stars"])
    return out


def main() -> int:
    db = yaml.safe_load(DB.read_text())
    stars = load_stars()

    rows = []
    for p in db.get("patterns", []) or []:
        evidence = p.get("evidence") or []
        repos = []
        for e in evidence:
            r = e.get("repo")
            if r:
                repos.append(r)
        unique_repos = sorted(set(repos))
        cum_stars = sum(stars.get(r, 0) for r in unique_repos)
        occ = len(evidence)
        sig_count = p.get("signature_count") or len(p.get("signatures") or []) or 1

        # Pattern fields can be top-level or under 'heuristics'
        h = p.get("heuristics") or {}
        sev_map = {"CRITICAL": 2, "HIGH": 1.5, "MEDIUM": 1, "LOW": 0.5}
        silent_w = float(h.get("silent_breakage", sev_map.get(p.get("severity", ""), 0)))
        life_w = float(h.get("lifecycle_coupling", p.get("lifecycle_coupling", 0)))

        br = (
            math.log10(1 + cum_stars) * W["stars"]
            + math.log10(1 + occ) * W["occ"]
            + max(0, sig_count - 1) * W["sig"]
            + silent_w * W["silent"]
            + life_w * W["lifecycle"]
        )

        rows.append(
            {
                "pattern_id": p["pattern_id"],
                "surface_family": p.get("surface_family"),
                "name": p.get("name") or p.get("surface") or p.get("semantic_intent") or p.get("semantic"),
                "occurrences": occ,
                "unique_repos": len(unique_repos),
                "cumulative_stars": cum_stars,
                "signature_count": sig_count,
                "silent_breakage": silent_w,
                "lifecycle_coupling": life_w,
                "blast_radius": round(br, 3),
                "top_repos": [
                    {"repo": r, "stars": stars.get(r, 0)}
                    for r in sorted(unique_repos, key=lambda x: -stars.get(x, 0))[:5]
                ],
            }
        )

    rows.sort(key=lambda r: -r["blast_radius"])

    out = {
        "meta": {
            "generated_from": ["database.yaml", "star-cache.yaml"],
            "weights": W,
            "patterns_count": len(rows),
        },
        "patterns": rows,
    }
    OUT.write_text(yaml.safe_dump(out, sort_keys=False, width=120))
    print(f"✅ wrote {OUT.relative_to(ROOT)} ({len(rows)} patterns)")

    print()
    print("Top 12 by blast radius:")
    print(f"  {'rank':>4}  {'br':>6}  {'★sum':>6}  {'occ':>3}  {'sig':>3}  pattern")
    for i, r in enumerate(rows[:12], 1):
        print(
            f"  {i:>4}  {r['blast_radius']:>6.2f}  {r['cumulative_stars']:>6}  "
            f"{r['occurrences']:>3}  {r['signature_count']:>3}  {r['pattern_id']}  {r['name']}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
