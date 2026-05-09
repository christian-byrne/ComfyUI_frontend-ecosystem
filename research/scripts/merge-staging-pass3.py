#!/usr/bin/env python3
# merge-staging-pass3.py — single-threaded merger for pass-3 staging files.
#
# Reads:
#   research/touch-points/staging/r8-evidence.yaml         (clone-grep)
#   research/touch-points/staging/r9-security.yaml         (security scan + proposed S16.* patterns)
#   research/touch-points/staging/r9-guides.yaml           (sanctioned surfaces from docs we ship)
#   research/touch-points/staging/r9-cookiecutter.yaml     (scaffolded = forced-public surfaces)
#
# Writes back to:
#   research/touch-points/database.yaml
#
# Safe to re-run; per-(repo, file, lines) dedup is enforced.
# R8 evidence is capped at 6 rows per pattern (already capped per repo+pattern in producer).
#
# R9.popularity is metadata about repos, not evidence — skipped here.
# R9.qa is regression-scenario seeds for I-TF.3 — referenced but not merged into DB.

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "research" / "touch-points" / "database.yaml"
STAGING = ROOT / "research" / "touch-points" / "staging"

R8 = STAGING / "r8-evidence.yaml"
R9_SEC = STAGING / "r9-security.yaml"
R9_GUIDES = STAGING / "r9-guides.yaml"
R9_CK = STAGING / "r9-cookiecutter.yaml"

CAP_PER_PATTERN_FROM_R8 = 8  # adjust if DB explodes


def normalize_lines(lines):
    if isinstance(lines, str):
        # R8 emitted strings like "[119, 131]" — convert
        try:
            return tuple(eval(lines, {"__builtins__": {}}, {}))
        except Exception:
            return (lines,)
    if isinstance(lines, list):
        return tuple(lines)
    return (lines,)


def evkey(e):
    return (e.get("repo"), e.get("file"), normalize_lines(e.get("lines")))


def append_dedup(target_evidence, new_rows, cap=None):
    existing = {evkey(e) for e in target_evidence}
    appended = 0
    skipped = 0
    rows_to_consider = list(new_rows)
    if cap and len(rows_to_consider) > cap:
        # Prefer rows from higher-star repos when capping.
        # Order is producer-defined; keep first `cap`.
        rows_to_consider = rows_to_consider[:cap]
    for e in rows_to_consider:
        # Normalize line representation
        if isinstance(e.get("lines"), str):
            e["lines"] = list(normalize_lines(e["lines"]))
        if evkey(e) in existing:
            skipped += 1
            continue
        target_evidence.append(e)
        existing.add(evkey(e))
        appended += 1
    return appended, skipped


def main():
    db = yaml.safe_load(DB.read_text())
    patterns_by_id = {p["pattern_id"]: p for p in db["patterns"]}

    total_appended = 0
    total_skipped = 0
    new_patterns_added = 0

    # ─── R8 (clone-grep) ────────────────────────────────────────────
    r8 = yaml.safe_load(R8.read_text())
    print(f"R8: {sum(len(v) for v in r8.values())} total rows across {len(r8)} patterns")
    for pid, rows in r8.items():
        if pid not in patterns_by_id:
            print(f"  ⚠️ R8 pattern {pid} not in DB — skipping")
            continue
        p = patterns_by_id[pid]
        if "evidence" not in p or p["evidence"] is None:
            p["evidence"] = []
        a, s = append_dedup(p["evidence"], rows, cap=CAP_PER_PATTERN_FROM_R8)
        total_appended += a
        total_skipped += s
        p["evidence_status"] = "swept"

    # ─── R9.security: proposed S16.* patterns ───────────────────────
    sec = yaml.safe_load(R9_SEC.read_text())
    for sp in sec.get("proposed_patterns", []):
        pid = sp.get("proposed_pattern_id")
        if not pid:
            continue
        if pid in patterns_by_id:
            print(f"  R9.sec pattern {pid} already exists — appending evidence only")
            target = patterns_by_id[pid]
        else:
            # Materialize the new pattern
            new_p = {
                "pattern_id": pid,
                "surface_family": sp.get("surface_family", "S16"),
                "surface": sp.get("surface", ""),
                "fingerprint": sp.get("fingerprint", ""),
                "semantic": sp.get("semantic", ""),
                "v2_replacement": sp.get("v2_replacement", ""),
                "decision_ref": sp.get("rationale", ""),
                "test_target": sp.get("test_target", ""),
                "lifecycle_coupling": 0,
                "severity": "MEDIUM",
                "evidence_status": "swept",
                "evidence": [],
            }
            db["patterns"].append(new_p)
            patterns_by_id[pid] = new_p
            target = new_p
            new_patterns_added += 1
            print(f"  ➕ R9.sec NEW pattern {pid}: {sp.get('surface', '')[:60]}")

        # Materialize evidence rows from R9.sec
        evidence_field = sp.get("evidence")
        if isinstance(evidence_field, str):
            try:
                evidence_field = eval(evidence_field, {"__builtins__": {}}, {})
            except Exception:
                evidence_field = []
        if not isinstance(evidence_field, list):
            evidence_field = []
        rows = []
        for e in evidence_field:
            if not isinstance(e, dict):
                continue
            rows.append({
                "pattern_id": pid,
                "repo": e.get("repo", "unknown"),
                "file": e.get("file", "unknown"),
                "lines": e.get("lines", [1]) if isinstance(e.get("lines"), (list, int)) else [1],
                "url": e.get("url", ""),
                "rule": e.get("rule", ""),
                "source": "security",
                "variant": e.get("rule", "yara/bandit-hit"),
            })
        a, s = append_dedup(target["evidence"], rows)
        total_appended += a
        total_skipped += s

    # ─── R9.cookiecutter: scaffolded surfaces ───────────────────────
    ck = yaml.safe_load(R9_CK.read_text())
    for entry in ck.get("scaffold_surfaces", []):
        pid = entry.get("pattern_id")
        if not pid or pid not in patterns_by_id:
            continue
        target = patterns_by_id[pid]
        if "evidence" not in target or target["evidence"] is None:
            target["evidence"] = []
        rows = [{
            "pattern_id": pid,
            "repo": "cookiecutter-comfy-extension",
            "file": entry.get("template_file", "unknown"),
            "lines": entry.get("lines", [1]),
            "url": "",
            "source": "cookiecutter",
            "variant": "scaffolded-by-default",
            "excerpt": entry.get("excerpt", ""),
            "notes": "FORCED-PUBLIC: this surface is generated by the default scaffold, so v2 cannot break it without breaking new-extension onboarding",
        }]
        a, s = append_dedup(target["evidence"], rows)
        total_appended += a
        total_skipped += s

    # ─── R9.guides: surfaces we teach in docs ───────────────────────
    guides = yaml.safe_load(R9_GUIDES.read_text())
    for entry in guides.get("sanctioned_surfaces", []):
        pid = entry.get("pattern_id")
        if not pid or pid not in patterns_by_id:
            continue
        target = patterns_by_id[pid]
        if "evidence" not in target or target["evidence"] is None:
            target["evidence"] = []
        rows = [{
            "pattern_id": pid,
            "repo": "comfyanonymous/custom-nodes-guides",
            "file": entry.get("taught_in", "unknown"),
            "lines": entry.get("lines", [1]),
            "url": "",
            "source": "guides",
            "variant": "taught-in-official-docs",
            "excerpt": entry.get("excerpt", ""),
            "notes": "SANCTIONED-PUBLIC: this surface is taught in official docs we ship, so v2 must keep it stable",
        }]
        a, s = append_dedup(target["evidence"], rows)
        total_appended += a
        total_skipped += s

    # ─── Update meta ────────────────────────────────────────────────
    db["meta"]["patterns_count"] = len(db["patterns"])
    db["meta"]["sweep_status"] = "in-progress"
    sweeps = db["meta"].setdefault("sweeps_done", [])
    if "evidence-sweep-pass-3" not in sweeps:
        sweeps.append("evidence-sweep-pass-3")

    DB.write_text(yaml.safe_dump(db, sort_keys=False, width=200, allow_unicode=True))

    total_evidence = sum(len(p.get("evidence") or []) for p in db["patterns"])
    print()
    print(f"✅ appended {total_appended} rows ({total_skipped} dupes skipped)")
    print(f"✅ added {new_patterns_added} new patterns")
    print(f"✅ DB now: {len(db['patterns'])} patterns, {total_evidence} evidence rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
