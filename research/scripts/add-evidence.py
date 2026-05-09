#!/usr/bin/env python3
# add-evidence.py — append evidence to existing patterns and add NEW patterns
# discovered during the MCP sweep. Idempotent: skips evidence already present
# (matched by repo+file+lines).
#
# Run: python3 scripts/add-evidence.py
#
# Source-of-truth for evidence is inline below — keeping it in version
# control makes the sweep reproducible and reviewable.

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "touch-points-database.yaml"


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


# ─── Evidence to merge into existing patterns ─────────────────────────────
APPEND = {
    "S2.N12": [
        # already has core dynamicWidgets entry
    ],
    "S2.N13": [
        ev("rgthree/rgthree-comfy", "web/comfyui/node_mode_relay.js", [90, 92], variant="subclass-override", breakage_class="loud", notes="rgthree — major pack. Subclass override pattern (calls super)."),
        ev("rgthree/rgthree-comfy", "web/comfyui/node_mode_repeater.js", [21, 24], variant="subclass-override", breakage_class="loud"),
        ev("rgthree/rgthree-comfy", "src_web/comfyui/node_mode_relay.ts", [146, 153], variant="subclass-override-ts", breakage_class="loud"),
        ev("rgthree/rgthree-comfy", "src_web/comfyui/node_mode_repeater.ts", [46, 56], variant="subclass-override-ts", breakage_class="loud"),
        ev("rgthree/rgthree-comfy", "web/comfyui/base_any_input_connected_node.js", [136, 138], variant="subclass-override", breakage_class="loud"),
    ],
    "S2.N14": [
        ev("niknah/presentation-ComfyUI", "js/PresentationDropDown.js", [12, 75], variant="prototype-chain", breakage_class="silent", notes="captures original onWidgetChanged via prototype chain"),
        ev("chyer/Chye-ComfyUI-Toolset", "web/comfyui/text_file_loader.js", [35, 115], variant="instance-method", breakage_class="silent"),
    ],
    "S2.N15": [
        ev("Azornes/Comfyui-LayerForge", "js/CanvasView.js", 1438, variant="prototype-replace", breakage_class="silent", notes="LayerForge (313★) — replaces serialize wholesale"),
        ev("Azornes/Comfyui-LayerForge", "src/CanvasView.ts", 1657, variant="prototype-replace-ts", breakage_class="silent"),
        ev("IAMCCS/IAMCCS-nodes", "web/iamccs_wan_motion_presets.js", 598, variant="prototype-replace", breakage_class="silent"),
        ev("IAMCCS/IAMCCS-nodes", "web/iamccs_ltx2_extension_presets.js", 350, variant="prototype-replace", breakage_class="silent"),
        ev("DazzleNodes/ComfyUI-Smart-Resolution-Calc", "web/utils/serialization.js", 32, variant="prototype-replace", breakage_class="silent"),
        ev("alankent/ComfyUI-OA-360-Clip", "web/oa_360_clip.js", 900, variant="prototype-replace", breakage_class="silent"),
    ],
    "S2.N16": [
        ev("krismasdev/ComfyUI-Flux-Continuum", "web/outputgetnode.js", 328, variant="push", breakage_class="silent", notes="extension pushes to node.widgets directly"),
        ev("max-dingsda/ComfyUI-AllinOne-LazyNode", "web/js/aio_core_preview.js", 170, variant="push", breakage_class="silent"),
        ev("r-vage/ComfyUI_Eclipse", "js/eclipse-set-get.js", 9, variant="indexed-read", breakage_class="loud", notes="reads node.widgets[0].value to get name"),
        ev("r-vage/ComfyUI_Eclipse", "js/eclipse-load-image.js", 56, variant="indexOf", breakage_class="loud"),
        ev("viswamohankomati/ComfyUI-Copilot", "ComfyUI/custom_nodes/ComfyUI-Copilot/ui/src/utils/comfyuiWorkflowApi2Ui.ts", [305, 316], variant="widgets_values-push", breakage_class="silent", notes="touches node.widgets_values, the serialized array"),
    ],
    "S11.G1": [
        ev("FloyoAI/ComfyUI-SoundFlow", "js/PreviewAudio.js", 293, variant="post-mutation-bump", breakage_class="silent", notes="bumps version after node-internal mutation to trigger redraw"),
        ev("krismasdev/ComfyUI-Flux-Continuum", "web/outputgetnode.js", 84, variant="post-mutation-bump", breakage_class="silent"),
        ev("coeuskoalemoss/comfyUI-layerstyle-custom", "js/dz_mtb_widgets.js", 292, variant="post-mutation-bump", breakage_class="silent"),
        ev("40740/ComfyUI_LayerStyle_Bmss", "js/dz_mtb_widgets.js", 292, variant="post-mutation-bump", breakage_class="silent", notes="duplicate-of-coeuskoalemoss pattern — fork"),
    ],
    "S11.G2": [
        ev("yolain/ComfyUI-Easy-Use", "web_version/v1/js/easy/easyExtraMenu.js", 439, variant="add+createNode", breakage_class="loud", notes="Easy-Use is a major pack; uses graph.add(LiteGraph.createNode(...))"),
        ev("KumihoIO/kumiho-plugins", "comfyui/web/js/kumiho.js", 431, variant="add+createNode", breakage_class="loud"),
        ev("r-vage/ComfyUI_Eclipse", "js/eclipse-ui-enhancements.js", 29, variant="remove-then-add", breakage_class="loud", notes="swap nodes by remove+add — preserves layout via savedProps"),
        ev("Comfy-Org/ComfyUI_frontend", "browser_tests/tests/workflowPersistence.spec.ts", [351, 413], variant="add+createNode", breakage_class="loud", notes="OUR OWN E2E TESTS rely on window.app.graph.add(window.LiteGraph.createNode(...))"),
    ],
    "S12.UI1": [
        ev("robertvoy/ComfyUI-Distributed", "web/main.js", [269, 270], variant="extensionManager.registerSidebarTab", breakage_class="loud", notes="real call site for sidebar registration"),
        ev("criskb/Comfypencil", "web/comfy_pencil_extension.js", [955, 956], variant="extensionManager.registerSidebarTab", breakage_class="loud"),
        ev("maxi45274/ComfyUI_LinkFX", "js/LinkFX.js", [707, 709], variant="extensionManager.registerSidebarTab", breakage_class="loud"),
    ],
    "S10.D1": [
        ev("zhupeter010903/ComfyUI-XYZ-prompt-library", "js/node.js", [18, 53], variant="dynamic-addInput-loop", breakage_class="loud", notes="real-world dynamic input expansion: this.addInput('infix '+i,'STRING')"),
        ev("r-vage/ComfyUI_Eclipse", "js/eclipse-mode-nodes.js", [42, 106], variant="virtual-node-setup", breakage_class="loud", notes="Eclipse uses addOutput within isVirtualNode setup"),
        ev("Comfy-Org/ComfyUI_frontend", "src/lib/litegraph/src/canvas/LinkConnector.core.test.ts", [121, 158], variant="OUR-TESTS", breakage_class="loud", notes="OUR OWN TESTS depend on addOutput"),
    ],
    "S9.S1": [
        ev("lordwedggie/xcpNodes", "js/xcpDerpINT.js", 162, variant="output-color_on-assignment", breakage_class="silent", notes="this.outputs[0].color_on = templateSlotColorOn — direct slot visual override"),
        ev("nodetool-ai/nodetool", "subgraphs.md", [267, 299], variant="documented-pattern", breakage_class="loud", notes="external docs reference color_on for subgraph slot inheritance"),
    ],
    "S4.W4": [
        ev("AlexZ1967/ComfyUI_ALEXZ_tools", "web/video_cut_match_upload.js", [24, 27], variant="includes-then-push", breakage_class="silent", notes="checks values then mutates"),
        ev("zzggi2024/shaobkj", "js/dynamic_inputs.js", [374, 376], variant="snapshot-then-mutate", breakage_class="silent", notes="saves __originalValues snapshot before mutating widget.options.values"),
        ev("EnragedAntelope/EA_LMStudio", "web/ea_lmstudio.js", 11, variant="documented-fallback", breakage_class="loud", notes="explicit comment: 'Legacy LiteGraph frontend: full support via widget.options.values'"),
    ],
}


# ─── Brand-new patterns discovered during sweep ───────────────────────────
NEW_PATTERNS = [
    {
        "pattern_id": "S6.A3",
        "surface_family": "S6",
        "surface": "api.fetchApi — extensions hit backend HTTP endpoints",
        "fingerprint": "await api.fetchApi('/upload/image', { method: 'POST', body: data })",
        "semantic": "extensions call ComfyAPI.fetchApi as the canonical way to reach backend HTTP routes (auth, base URL, error handling all handled)",
        "v2_replacement": "ctx.api.fetch(path, init) typed wrapper; same semantics, narrower surface",
        "decision_ref": "Pattern is widely used and CORRECT — keep contract, just type it",
        "test_target": "BACKEND_HTTP_CLIENT",
        "lifecycle_coupling": 0,
        "severity": "HIGH",
        "evidence_status": "swept",
        "evidence": [
            ev("AlexZ1967/ComfyUI_ALEXZ_tools", "web/video_cut_match_upload.js", 54, variant="POST-multipart", breakage_class="loud"),
            ev("AlexZ1967/ComfyUI_ALEXZ_tools", "web/api/module_node_picker_api.js", 43, variant="generic-wrapper", breakage_class="loud"),
            ev("akawana/ComfyUI-Folded-Prompts", "js/FPFoldedPrompts.js", 1227, variant="POST-upload", breakage_class="loud"),
            ev("zhupeter010903/ComfyUI-XYZ-prompt-library", "js/prompt_library_window.js", 1379, variant="GET", breakage_class="loud"),
            ev("Comfy-Org/ComfyUI_frontend", "src/components/common/BackgroundImageUpload.vue", 61, variant="POST-upload", breakage_class="loud", notes="OUR OWN UI uses api.fetchApi for image upload"),
        ],
    },
    {
        "pattern_id": "S6.A4",
        "surface_family": "S6",
        "surface": "app.queuePrompt / app.api.queuePrompt patching or direct call",
        "fingerprint": "const orig = window.app.api.queuePrompt; window.app.api.queuePrompt = async function(...args) {...; return orig(...args)}",
        "semantic": "intercept or trigger workflow execution; auth tokens, custom payload mutation, sidebar 'Run' buttons",
        "v2_replacement": "graph.run({ batch }) explicit API + app.on('beforeRun', payload => mutate(payload))",
        "decision_ref": "Pairs with S6.A1 graphToPrompt as the OTHER half of the execute-pipeline interception story",
        "test_target": "PROMPT_QUEUE_INTERCEPT",
        "lifecycle_coupling": 2,
        "severity": "CRITICAL",
        "evidence_status": "swept",
        "evidence": [
            ev("gigici/ComfyUI_BlendPack", "js/ui/NodeUI.js", 99, variant="bind-then-replace", breakage_class="silent", notes="window.app.api.queuePrompt?.bind(window.app.api) — patches the API-level queue"),
            ev("MajoorWaldi/ComfyUI-Majoor-AssetsManager", "js/features/viewer/workflowSidebar/sidebarRunButton.js", [317, 321], variant="multi-path-fallback", breakage_class="loud", notes="documents 4 distinct invocation paths: app.api.queuePrompt, app.queuePrompt, fetch /prompt, etc."),
            ev("rohapa/comfyui-replay", "README.md", [497, 975], variant="call+fallback", breakage_class="loud", notes="app.queuePrompt(0,1) with raw fetch /prompt fallback"),
        ],
    },
    {
        "pattern_id": "S5.A3",
        "surface_family": "S5",
        "surface": "api.addEventListener('execution_start' | 'execution_success' | 'execution_error' | 'execution_cached' | 'executing' | 'status' | 'reconnecting')",
        "fingerprint": "api.addEventListener('execution_start', e => ...)",
        "semantic": "extensions subscribe to backend execution lifecycle WebSocket events",
        "v2_replacement": "ctx.execution.on('start' | 'success' | 'error' | 'cached', payload => ...) typed events",
        "decision_ref": "Cross-references S5.A1 (existence-proof of events-everywhere)",
        "test_target": "EXECUTION_LIFECYCLE_EVENTS",
        "lifecycle_coupling": 0,
        "severity": "HIGH",
        "evidence_status": "swept",
        "evidence": [
            ev("zzw5516/ComfyUI-zw-tools", "entry/entry.js", [27, 28], variant="execution_start", breakage_class="loud"),
            ev("flymyd/koishi-plugin-comfyui-client", "src/ComfyUINode.ts", 109, variant="execution_start-case", breakage_class="loud"),
            ev("kyuz0/amd-strix-halo-comfyui-toolboxes", "scripts/benchmark_workflows.py", 52, variant="execution_start-message-type", breakage_class="loud"),
            ev("philippjbauer/devint25-comfyui-api-demo", "README.md", [144, 179], variant="documented-event-list", breakage_class="loud"),
            ev("philippjbauer/devint25-comfyui-api-demo", "Models/ComfyModels.cs", 159, variant="enum-of-event-names", breakage_class="loud", notes="C# wrapper enumerates the WebSocket event vocabulary as the public API"),
            ev("huafitwjb/ComfyUI-GO-Mobile-app", "app/src/main/java/com/example/myapplication/util/Constants.kt", 26, variant="execution_success-const", breakage_class="loud"),
            ev("hernantech/comfymcp", "src/comfymcp/client/types.py", 17, variant="execution_success-enum", breakage_class="loud"),
            ev("choovin/comfyui-api", "README.md", [57, 1945], variant="execution_success-doc", breakage_class="loud", notes="explicit 'Sidecar-like tracing' depending on execution_* events as public API"),
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
                existing = {normalize_evidence_key(e) for e in (p.get("evidence") or [])}
                if "evidence" not in p or p["evidence"] is None:
                    p["evidence"] = []
                for e in new_evs:
                    if normalize_evidence_key(e) in existing:
                        skipped += 1
                        continue
                    p["evidence"].append(e)
                    appended += 1
                # Mark evidence_status as swept now that we've sourced real data
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
    if "evidence-sweep-pass-1" not in db["meta"].get("sweeps_done", []):
        db["meta"]["sweeps_done"].append("evidence-sweep-pass-1")

    DB.write_text(yaml.safe_dump(db, sort_keys=False, width=200, allow_unicode=True))
    print(f"✅ appended {appended} evidence rows ({skipped} dupes skipped)")
    print(f"✅ added {added_new} new patterns")
    print(f"✅ DB now has {len(db['patterns'])} patterns")


if __name__ == "__main__":
    main()
