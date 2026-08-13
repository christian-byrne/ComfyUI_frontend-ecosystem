#!/usr/bin/env python3
"""normalize-repo-slugs.py — canonicalise `owner/name` repo slugs in the data.

Why this exists (issue #30, part B)
-----------------------------------
Evidence rows come from two sources that disagree on how to name a repo:

  * **clone-and-grep** emits canonical `owner/name` slugs.
  * **MCP `comfy_codesearch`** emits *bare* slugs (`comfyui-mixlab-nodes`, no
    owner) and happily indexes low-star forks/re-uploads
    (`goodtab/ComfyUI-Custom-Scripts`, `40740/ComfyUI_LayerStyle_Bmss`)
    instead of the upstream project.

Mixing them left three slug shapes in one dataset. The damage is not cosmetic:
a bare or fork slug does not resolve against the star cache, so its evidence
contributes **zero stars** to `cumulative_stars` and therefore silently
understates `blast_radius` for every pattern it appears under.

Every mapping below was verified against the live GitHub API before being
added — fork/rename parentage checked via `repos/{slug}`, and for the two fork
slugs that carry deep-link evidence URLs, the cited file path was confirmed to
exist in the canonical upstream repo.

Provenance is preserved: rows keep the pre-normalisation slug in
`repo_original` so the MCP-vs-clone provenance question stays answerable.

Usage:
    python3 scripts/normalize-repo-slugs.py           # rewrite in place
    python3 scripts/normalize-repo-slugs.py --check   # CI: fail if un-normalised
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ── the canonical slug map ────────────────────────────────────────────────
# value = (canonical slug, why)
SLUG_MAP: dict[str, tuple[str, str]] = {
    # -- forks / re-uploads -> upstream project ---------------------------
    # 0 stars, 0 forks, last push 2024-09-02; upstream is ★3,075 and active.
    # All three cited files (web/js/{quickNodes,graphArrange,reroutePrimitive}.js)
    # verified present upstream.
    "goodtab/ComfyUI-Custom-Scripts": (
        "pythongosssss/ComfyUI-Custom-Scripts",
        "fork/re-upload of the upstream pack (0★, stale 2024-09)",
    ),
    # 0 stars, 0 forks, last push 2024-10-16; upstream ★3,125 and active.
    # Cited file js/dz_mtb_widgets.js verified present upstream.
    "40740/ComfyUI_LayerStyle_Bmss": (
        "chflame163/ComfyUI_LayerStyle",
        "fork/re-upload of the upstream pack (0★, stale 2024-10)",
    ),
    # Third re-upload of the same pack. Not in the original issue-#30 list —
    # found because it was the *same* S11.G1 evidence row
    # (js/dz_mtb_widgets.js:292) that the YAML attributed to
    # 40740/ComfyUI_LayerStyle_Bmss and the JSON attributed to this slug, i.e.
    # it was also a live YAML↔JSON drift. 0★, 0 forks, last push 2025-06-23.
    "coeuskoalemoss/comfyUI-layerstyle-custom": (
        "chflame163/ComfyUI_LayerStyle",
        "fork/re-upload of the upstream pack (0★, stale 2025-06)",
    ),
    # -- bare slugs (MCP code-search output) -> owner-qualified ------------
    "ComfyUI-Custom-Scripts": ("pythongosssss/ComfyUI-Custom-Scripts", "bare slug"),
    "ComfyUI-Easy-Use": ("yolain/ComfyUI-Easy-Use", "bare slug"),
    "ComfyUI-KJNodes": ("kijai/ComfyUI-KJNodes", "bare slug"),
    "ComfyUI-OpenPose-Editor": ("space-nuko/ComfyUI-OpenPose-Editor", "bare slug"),
    "ComfyUI_Custom_Nodes_AlekPet": ("AlekPet/ComfyUI_Custom_Nodes_AlekPet", "bare slug"),
    "ComfyUI_tinyterraNodes": ("TinyTerra/ComfyUI_tinyterraNodes", "bare slug"),
    "ComfyUI-BlenderAI-node": ("AIGODLIKE/ComfyUI-BlenderAI-node", "bare slug"),
    "comfy_mtb": ("melMass/comfy_mtb", "bare slug"),
    "comfyui_controlnet_aux": ("Fannovel16/comfyui_controlnet_aux", "bare slug"),
    # shadowcz007/comfyui-mixlab-nodes was renamed to MixLabPro/… (GitHub
    # redirects the old owner); MixLabPro is the slug already in the cache.
    "comfyui-mixlab-nodes": ("MixLabPro/comfyui-mixlab-nodes", "bare slug + owner rename"),
    "ComfyUI-NKD-Sigmas-Curve": ("Nekodificador/ComfyUI-NKD-Sigmas-Curve", "bare slug"),
}

# Non-repo evidence sources. These are deliberately not `owner/name` — they
# record aggregate or first-principles findings that have no single repo. The
# parenthesised form is the documented marker; see check-repo-slugs.py.
NON_REPO_RE = re.compile(r"^\(.+\)$")
CANONICAL_RE = re.compile(r"^[A-Za-z0-9][\w.-]*/[\w.-]+$")

TARGETS = [
    ROOT / "src" / "data" / "touch-points-database.json",
    ROOT / "src" / "data" / "touch-points-rollup.json",
    ROOT / "src" / "data" / "behavior-categories.json",
    ROOT / "research" / "touch-points-database.yaml",
    ROOT / "research" / "touch-points-rollup.yaml",
]


def rewrite_url(url: str, old: str, new: str) -> str:
    """Repoint a github.com deep link from the fork to the canonical repo."""
    if not url:
        return url
    return url.replace(f"github.com/{old}", f"github.com/{new}")


def walk(node, changes: list[tuple[str, str]]):
    """Recursively rewrite any dict carrying a mapped `repo` key."""
    if isinstance(node, list):
        for item in node:
            walk(item, changes)
        return
    if not isinstance(node, dict):
        return

    old = node.get("repo")
    if isinstance(old, str) and old in SLUG_MAP:
        new, _reason = SLUG_MAP[old]
        node["repo"] = new
        # Keep the original so the MCP-vs-clone provenance stays auditable.
        node.setdefault("repo_original", old)
        if isinstance(node.get("url"), str):
            node["url"] = rewrite_url(node["url"], old, new)
        changes.append((old, new))

    for value in node.values():
        walk(value, changes)


def process_json(path: Path, apply: bool) -> tuple[bool, list[tuple[str, str]]]:
    doc = json.loads(path.read_text())
    changes: list[tuple[str, str]] = []
    walk(doc, changes)
    if changes and apply:
        path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    return bool(changes), changes


def process_yaml_text(path: Path, apply: bool) -> tuple[bool, list[tuple[str, str]]]:
    """Textual rewrite for the YAML sources.

    Deliberately text-level, not a yaml round-trip: these files are
    hand-curated with comments and ordering that a `yaml.safe_dump` would
    destroy. Slugs only ever appear as `repo: <slug>` values or inside
    github.com URLs, both of which are safe to match textually.
    """
    text = path.read_text()
    original = text
    changes: list[tuple[str, str]] = []
    for old, (new, _reason) in SLUG_MAP.items():
        pattern = re.compile(rf"(?m)^(\s*(?:-\s*)?repo:\s*){re.escape(old)}\s*$")
        text, n = pattern.subn(lambda m: f"{m.group(1)}{new}", text)
        if n:
            changes.extend([(old, new)] * n)
        url_pattern = re.compile(rf"github\.com/{re.escape(old)}(?=[/\s\"']|$)")
        text = url_pattern.sub(f"github.com/{new}", text)
    if text != original and apply:
        path.write_text(text)
    return text != original, changes


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="CI: fail if anything needs normalising")
    args = ap.parse_args()
    apply = not args.check

    total: list[tuple[str, str]] = []
    stale_files: list[str] = []
    for path in TARGETS:
        if not path.exists():
            continue
        if path.suffix == ".json":
            changed, changes = process_json(path, apply)
        else:
            changed, changes = process_yaml_text(path, apply)
        if changed:
            stale_files.append(str(path.relative_to(ROOT)))
            total.extend(changes)

    if args.check:
        if stale_files:
            print("✗ non-canonical repo slugs present in:", file=sys.stderr)
            for f in stale_files:
                print(f"    {f}", file=sys.stderr)
            print("  Run: make slugs", file=sys.stderr)
            return 1
        print("✓ all repo slugs are canonical")
        return 0

    if not total:
        print("✓ nothing to normalise — all repo slugs already canonical")
        return 0

    tally: dict[tuple[str, str], int] = {}
    for pair in total:
        tally[pair] = tally.get(pair, 0) + 1
    print(f"✓ normalised {len(total)} slug occurrence(s) across {len(stale_files)} file(s):")
    for (old, new), count in sorted(tally.items()):
        print(f"    {old}  ->  {new}   ({count}x — {SLUG_MAP[old][1]})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
