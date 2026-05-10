#!/usr/bin/env python3
"""Convert YAML research artifacts into JSON the Vite frontend can import.

Run via `npm run data:build` — keeps the source-of-truth YAML in research/
without forcing the frontend to ship a YAML parser.
"""
from __future__ import annotations

import datetime as _dt
import json
from pathlib import Path

import yaml


def _default(o: object) -> str:
    if isinstance(o, (_dt.date, _dt.datetime)):
        return o.isoformat()
    raise TypeError(f"Object of type {o.__class__.__name__} is not JSON serializable")

ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / "research" / "workspace-mirror" / "research" / "touch-points"
OUT = ROOT / "src" / "data"


def dump(name: str, data: object) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / name
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False, default=_default) + "\n")
    print(f"wrote {out.relative_to(ROOT)}")


def main() -> None:
    cats = yaml.safe_load((RESEARCH / "behavior-categories.yaml").read_text())
    dump("behavior-categories.json", cats)

    db_path = ROOT / "research" / "touch-points-database.yaml"
    if db_path.exists():
        dump("touch-points-database.json", yaml.safe_load(db_path.read_text()))

    rollup_path = ROOT / "research" / "touch-points-rollup.yaml"
    if rollup_path.exists():
        dump("touch-points-rollup.json", yaml.safe_load(rollup_path.read_text()))


if __name__ == "__main__":
    main()
