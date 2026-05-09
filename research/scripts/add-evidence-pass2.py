#!/usr/bin/env python3
# add-evidence-pass2.py — second MCP sweep. Appends evidence to under-evidenced
# patterns and adds new patterns discovered in pass-2 (graph batching seam,
# window.* globals, setDirtyCanvas redraw idiom).
#
# Idempotent: skips evidence already present (matched by repo+file+lines).
#
# Run: python3 scripts/add-evidence-pass2.py

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "research" / "touch-points" / "database.yaml"


def url(repo: str, file: str, line: int) -> str:
    return f"https://github.com/{repo}/blob/main/{file}#L{line}"


def ev(repo, file, lines, **kw):
    e = {
        "repo": repo,
        "file": file,
        "lines": lines if isinstance(lines, list) else [lines],
        "url": url(repo, file, lines if isinstance(lines, int) else lines[0]),
    }
    e.update(kw)
    return e


# ─── Evidence to append to existing patterns ──────────────────────────────
APPEND = {
    "S2.N17": [  # onSelected / onDeselected
        ev("nodelee733/ComfyUI-mxToolkit", "js/Slider.js", 1, variant="prototype-patch", breakage_class="silent",
           notes="mxToolkit Slider patches onSelected for highlight state"),
        ev("nodelee733/ComfyUI-mxToolkit", "js/Slider2D.js", 1, variant="prototype-patch", breakage_class="silent"),
    ],
    "S2.N19": [  # onResize
        ev("SKBv0/ComfyUI_SKBundle", "js/MultiFloat.js", 1, variant="prototype-patch", breakage_class="silent",
           notes="MultiFloat widget syncs internal layout on resize"),
        ev("PGCRT/CRT-Nodes", "js/Magic_Lora_Loader.js", 1, variant="prototype-patch", breakage_class="silent"),
        ev("dorpxam/ComfyUI-LTX2-Microscope", "web/js/ui/visualizer.js", 1, variant="prototype-patch", breakage_class="silent",
           notes="visualizer reflows DOM widget on resize"),
    ],
    "S9.R1": [  # Reroute manipulation
        ev("linjm8780860/ljm_comfyui", "src/utils/vintageClipboard.ts", 1, variant="graph.reroutes.values()", breakage_class="loud",
           notes="iterates reroute map directly — fork of frontend, but represents real internal contract surface"),
        ev("nodetool-ai/nodetool", "subgraphs.md", [1, 50], variant="documented-pattern", breakage_class="loud",
           notes="external doc treats graph.reroutes as part of subgraph contract"),
    ],
    "S9.SG1": [  # Set/Get virtual node
        ev("krismasdev/ComfyUI-Flux-Continuum", "web/hint.js", 1, variant="virtual-node-companion", breakage_class="silent",
           notes="Flux Continuum hint system depends on Set/Get virtual node graph"),
        ev("SpaceWarpStudio/ComfyUI-SetInputGetOutput", "web/js/setinputgetoutput.js", 1, variant="full-implementation",
           breakage_class="loud", notes="another SetInput/GetOutput pack — variant of KJNodes pattern"),
    ],
    "S13.SC1": [  # ComfyNodeDef inspection
        ev("xeinherjer-dev/ComfyUI-XENodes", "web/js/combo_selector.js", 1, variant="nodeData.input.optional",
           breakage_class="silent", notes="reads nodeData.input.optional to drive UI generation"),
        ev("StableLlama/ComfyUI-basic_data_handling", "web/js/dynamicnode.js", 1, variant="nodeData.input.optional",
           breakage_class="silent"),
        ev("IXIWORKS-KIMJUNGHO/comfyui-ixiworks-tools", "js/sb_concat.js", 1, variant="nodeData.input.optional",
           breakage_class="silent"),
        ev("BennyKok/comfyui-deploy", "web-plugin/index.js", 1, variant="nodeData.input.required",
           breakage_class="silent", notes="comfyui-deploy is widely used; treats schema as a public contract"),
        ev("egormly/ComfyUI-EG_Tools", "web/dynamic_inputs.js", 1, variant="nodeData.input.optional",
           breakage_class="silent"),
    ],
    "S3.C1": [  # LGraphCanvas.prototype.* monkey-patching — drawNodeShape variant
        ev("yolain/ComfyUI-Easy-Use-Frontend", "src/extensions/ui.js", 1, variant="drawNodeShape-patch",
           breakage_class="silent", notes="Easy-Use is a major pack; patches LGraphCanvas.prototype.drawNodeShape"),
        ev("melMass/comfy_mtb", "web/note_plus.js", 1, variant="canvas-draw-patch", breakage_class="silent",
           notes="comfy_mtb (popular pack) — note_plus draws decorations via canvas patching"),
        ev("lucafoscili/lf-nodes", "web/src/nodes/reroute.ts", 1, variant="onDrawForeground+canvas-draw",
           breakage_class="silent"),
        ev("krismasdev/ComfyUI-Flux-Continuum", "web/outputgetnode.js", 1, variant="onDrawForeground",
           breakage_class="silent"),
    ],
    "S10.D2": [  # disconnectInput / disconnectOutput / connect
        ev("MockbaTheBorg/ComfyUI-Mockba", "js/slider.js", 1, variant="programmatic-disconnect",
           breakage_class="loud", notes="app.graph.getNodeById(tlink.target_id).disconnectInput(tlink.target_slot)"),
        ev("vjumpkung/comfyui-infinitetalk-native-sampler", "README.md", [1, 50], variant="documented-as-API",
           breakage_class="loud", notes="3rd-party docs treat node.disconnect* as a stable extension surface"),
    ],
    "S8.P1": [  # isVirtualNode = true
        ev("ComfyNodePRs/PR-comfyui-pkg39-ccab78b5", "js/libs/image.js", [541, 1382], variant="filter-by-virtual",
           breakage_class="loud", notes="extension code filters nodes by isVirtualNode — treats it as discovery API"),
    ],
}


# ─── Brand-new patterns discovered in pass-2 ──────────────────────────────
NEW_PATTERNS = [
    {
        "pattern_id": "S11.G3",
        "surface_family": "S11",
        "surface": "graph.beforeChange / graph.afterChange — explicit batching seam for multi-step mutations",
        "fingerprint": "graph.beforeChange(); ...mutations...; graph.afterChange();",
        "semantic": (
            "extensions wrap multi-node/multi-link mutations in beforeChange/afterChange so undo, "
            "dirty-tracking, and re-render coalesce around the batch instead of per-mutation"
        ),
        "v2_replacement": "world.batch(() => { ...mutations... }) — typed batching API",
        "decision_ref": (
            "First-class batching is required for any reactive layer that wants stable diffs; "
            "v2 should expose this as a mandatory wrapper for multi-mutation operations"
        ),
        "test_target": "GRAPH_BATCH_BOUNDARY",
        "lifecycle_coupling": 1,
        "severity": "HIGH",
        "evidence_status": "swept",
        "evidence": [
            ev("nodetool-ai/nodetool", "subgraphs.md", [1, 50], variant="documented-pattern", breakage_class="loud",
               notes="docs use beforeChange/afterChange around subgraph promotion"),
            ev("linjm8780860/ljm_comfyui", "src/utils/vintageClipboard.ts", 1, variant="paste-undo-batch",
               breakage_class="loud", notes="paste flow batches mutations across clipboard restore"),
        ],
    },
    {
        "pattern_id": "S7.G1",
        "surface_family": "S7",
        "surface": "window.LiteGraph / window.comfyAPI.* — globals as public surface",
        "fingerprint": "window.LiteGraph.createNode(...); window.comfyAPI.app.app",
        "semantic": (
            "extensions reach into the global namespace for LiteGraph constructors/enums or for the "
            "module-as-global comfyAPI registry. This is the closest thing to a 'public ABI' today"
        ),
        "v2_replacement": (
            "explicit `import { app, graph, LiteGraph } from '@comfy/extension'` + a typed registry "
            "keyed by extension name; window.* should remain as a deprecated read-only mirror"
        ),
        "decision_ref": (
            "Cannot break window.LiteGraph immediately — too much ecosystem code reaches for it. "
            "Must ship typed import path first, then deprecate. Similar story to S11.G2 graph globals."
        ),
        "test_target": "GLOBAL_NAMESPACE_COMPAT",
        "lifecycle_coupling": 0,
        "severity": "CRITICAL",
        "evidence_status": "swept",
        "evidence": [
            ev("krismasdev/ComfyUI-Flux-Continuum", "web/hint.js", 1, variant="window.LiteGraph",
               breakage_class="loud"),
            ev("SpaceWarpStudio/ComfyUI-SetInputGetOutput", "web/js/setinputgetoutput.js", 1,
               variant="window.LiteGraph", breakage_class="loud"),
            ev("ArtHommage/HommageTools", "web/js/index.js", 1, variant="window.LiteGraph", breakage_class="loud"),
            ev("PROJECTMAD/PROJECT-MAD-NODES", "web/js/index.js", 1, variant="window.LiteGraph", breakage_class="loud"),
            ev("ryanontheinside/ComfyUI_RyanOnTheInside", "web/js/index.js", 1, variant="window.LiteGraph",
               breakage_class="loud"),
            ev("stavzszn/comfyui-teskors-utils", "web/js/index.js", 1, variant="window.LiteGraph",
               breakage_class="loud"),
        ],
    },
    {
        "pattern_id": "S11.G4",
        "surface_family": "S11",
        "surface": "graph.setDirtyCanvas(true, true) — imperative canvas-redraw trigger",
        "fingerprint": "node.graph?.setDirtyCanvas?.(true, true); app.graph.setDirtyCanvas(true, true);",
        "semantic": (
            "after any imperative mutation extensions call setDirtyCanvas to force a redraw — the "
            "ecosystem's de-facto 'reactivity flush' primitive. v2 reactivity should make this unnecessary"
        ),
        "v2_replacement": (
            "implicit — reactive system schedules redraw automatically when tracked entity mutates. "
            "Provide an escape hatch `world.markDirty()` only for non-reactive third-party canvas use"
        ),
        "decision_ref": (
            "Replacing this surface is the strongest evidence that v2 reactivity actually buys something. "
            "Should be in v2 'value proposition' demo extension"
        ),
        "test_target": "REDRAW_NO_LONGER_NEEDED",
        "lifecycle_coupling": 0,
        "severity": "MEDIUM",
        "evidence_status": "swept",
        "evidence": [
            ev("AlexZ1967/ComfyUI_ALEXZ_tools", "web/video_cut_match_upload.js", 111,
               variant="post-mutation-redraw", breakage_class="silent"),
            ev("AlexZ1967/ComfyUI_ALEXZ_tools", "web/widget_visibility_profiles.js", 285,
               variant="post-mutation-redraw", breakage_class="silent"),
            ev("AlexZ1967/ComfyUI_ALEXZ_tools", "web/ui/module_node_picker_node_factory.js", 189,
               variant="post-mutation-redraw", breakage_class="silent"),
            ev("akawana/ComfyUI-Folded-Prompts", "js/FPFoldedPrompts.js", [776, 1087],
               variant="post-mutation-redraw", breakage_class="silent",
               notes="multiple call sites — extension assumes manual flush is the contract"),
        ],
    },
    {
        "pattern_id": "S10.D3",
        "surface_family": "S10",
        "surface": "node.setSize(node.computeSize()) — imperative resize after dynamic mutation",
        "fingerprint": "node.setSize?.(node.computeSize())",
        "semantic": (
            "after dynamic widget/input/output mutation, extensions manually call computeSize+setSize "
            "to reflow the node. Companion to S2.N11 (computeSize override) and S11.G4 (setDirtyCanvas)"
        ),
        "v2_replacement": (
            "automatic — reactive layout system recomputes node size when widget/slot collection changes. "
            "Expose `nodeHandle.requestLayout()` only as escape hatch"
        ),
        "decision_ref": "Pairs with S11.G4 — both are 'manual flush' idioms that v2 should obviate",
        "test_target": "AUTO_RELAYOUT_ON_MUTATION",
        "lifecycle_coupling": 0,
        "severity": "MEDIUM",
        "evidence_status": "swept",
        "evidence": [
            ev("AlexZ1967/ComfyUI_ALEXZ_tools", "web/widget_visibility_profiles.js", 283,
               variant="setSize+computeSize", breakage_class="silent",
               notes="exact 'node.setSize?.(node.computeSize())' canonical idiom"),
            ev("zhupeter010903/ComfyUI-XYZ-prompt-library", "js/prompt_library_node.js", 466,
               variant="manual-height", breakage_class="silent",
               notes="commented-out manual setSize — shows the pattern is well-known"),
        ],
    },
]


def normalize_evidence_key(e):
    return (e.get("repo"), e.get("file"), tuple(e.get("lines") or []))


def main():
    db = yaml.safe_load(DB.read_text())

    appended = 0
    skipped = 0
    for pid, new_evs in APPEND.items():
        for p in db["patterns"]:
            if p["pattern_id"] == pid:
                if "evidence" not in p or p["evidence"] is None:
                    p["evidence"] = []
                existing = {normalize_evidence_key(e) for e in p["evidence"]}
                for e in new_evs:
                    if normalize_evidence_key(e) in existing:
                        skipped += 1
                        continue
                    p["evidence"].append(e)
                    appended += 1
                p["evidence_status"] = "swept"
                break
        else:
            print(f"⚠️  pattern {pid} not found")

    added_new = 0
    existing_ids = {p["pattern_id"] for p in db["patterns"]}
    for np in NEW_PATTERNS:
        if np["pattern_id"] in existing_ids:
            print(f"⚠️  pattern {np['pattern_id']} already exists — skipping")
            continue
        db["patterns"].append(np)
        added_new += 1

    db["meta"]["patterns_count"] = len(db["patterns"])
    db["meta"]["sweep_status"] = "in-progress"
    if "evidence-sweep-pass-2" not in db["meta"].get("sweeps_done", []):
        db["meta"]["sweeps_done"].append("evidence-sweep-pass-2")

    DB.write_text(yaml.safe_dump(db, sort_keys=False, width=200, allow_unicode=True))
    print(f"✅ appended {appended} evidence rows ({skipped} dupes skipped)")
    print(f"✅ added {added_new} new patterns")
    print(f"✅ DB now has {len(db['patterns'])} patterns")


if __name__ == "__main__":
    main()
