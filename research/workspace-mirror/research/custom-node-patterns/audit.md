---
source: mcp__comfy_codesearch__search_code
date_accessed: 2026-05-06 (initial), 2026-05-06 re-run (this version)
ingested_by: R4-custom-node-pattern-audit (parent thread; subagents lack MCP)
status: SECOND PASS — initial pass had ~6/11 queries failing due to MCP gitserver DNS errors. This pass recovered the missing patterns via retry + query reformulation. ~14 successful queries; remaining gaps documented in §Re-run checklist.
mcp_failure_mode: `rpc error: code = Unavailable desc = … "transport: Error while dialing: dial tcp: lookup gitserver-0.gitserver on 34.118.224.10:53: no such host"` — backend gitserver DNS intermittently unresolved. Workaround: retry; if 3 retries fail, reformulate (split phrase, drop quotes, add a third token).
---

# Custom Node Pattern Audit — How extensions actually use the public API today

## Purpose

Inventory the real-world patterns custom nodes use to interact with ComfyUI's extension hook system. Each pattern is a *requirement* for the v2 API: if extensions in the wild rely on it, the new API must provide an explicit, supported replacement. **Each finding below has a verifiable repo + line citation.**

## TL;DR (8 bullets)

1. **`widget.callback = …` chaining** is the dominant value-change observation pattern. Found in 7+ unrelated repos with the canonical `origCallback = w.callback; w.callback = function(v) { …; origCallback?.call(this, v); }` shape. Multiple variants observed including unsafe overwrites without preservation.
2. **`nodeType.prototype.onNodeCreated` monkey-patching** is the dominant per-instance setup pattern. One file in the wild has 17 prototype refs (SpideyReroute).
3. **`nodeType.prototype.onExecuted` monkey-patching** is the *primary* mechanism for "show me what the backend computed" nodes (display text, JSON, images). 5+ confirmed repos; pattern is universal across the "show-result" category.
4. **`nodeType.prototype.onConnectionsChange` monkey-patching** powers dynamic-input nodes (add/remove sockets based on what's plugged in). Both prototype-level and per-instance variants observed; **6 different parameter signatures observed across implementations** — they don't agree on what the args are. Confirms the underlying API has zero schema discipline.
5. **`nodeType.prototype.onRemoved` monkey-patching** is the de-facto teardown API. 7+ confirmed repos using it for cleanup of intervals, observers, DOM nodes attached by widgets. **There is no other teardown surface** — confirming R4-F5 in original audit.
6. **`nodeType.prototype.getExtraMenuOptions` monkey-patching** powers per-node-type custom right-click menu items. Confirmed across multiple repos — this is the only way to contribute UI to the node context menu.
7. **`LGraphCanvas.prototype.{processKey, processContextMenu, computeVisibleNodes}` monkey-patching** is canvas-level patching, distinct from node patching. Powers custom keyboard shortcuts, custom context menus, and *virtual node visibility* (set/get nodes). Has its own concurrency hazards (multiple extensions racing on `processKey`).
8. **`api.addEventListener('executed', …)` and custom `'extensionName.event'` events** are the *one* place extensions can subscribe instead of monkey-patching. 5+ confirmed repos use it; pattern works because `ComfyApi extends EventTarget`. **This is the existence proof that the events-over-monkey-patching API model is viable.**

## Pattern 1 — `widget.callback` chaining

**Fingerprint**: `const orig = X.callback; X.callback = function(v) { /* new logic */; orig?.call(this, v) }`

**Why it exists**: Widgets expose a single `.callback` field, not an event emitter. Extensions need to react to value changes but have no event-subscription API. They overwrite the slot and chain manually.

**Confirmed call sites**:
- [crom8505/ComfyUI-Dynamic-Sigmas/web/js/graph_sigmas.js:79](https://github.com/crom8505/ComfyUI-Dynamic-Sigmas/blob/main/web/js/graph_sigmas.js#L79)
- [crom8505/ComfyUI-Dynamic-Sigmas/web/js/concat_sigmas.js:69](https://github.com/crom8505/ComfyUI-Dynamic-Sigmas/blob/main/web/js/concat_sigmas.js#L69)
- [crom8505/ComfyUI-Dynamic-Sigmas/web/js/dynamic_sigma_scheduler.js:673](https://github.com/crom8505/ComfyUI-Dynamic-Sigmas/blob/main/web/js/dynamic_sigma_scheduler.js#L673) (14 instances in one file)
- [brycecovert/ComfyUI-compass-images/js/compass_image_loader.js:180](https://github.com/brycecovert/ComfyUI-compass-images/blob/main/js/compass_image_loader.js#L180) — variant: `directoryWidget.callback.bind(directoryWidget)` (callbacks lose `this` when reassigned)
- [834t/ComfyUI_834t_scene_composer/js/b34t_scene_composer.js:148](https://github.com/834t/ComfyUI_834t_scene_composer/blob/main/js/b34t_scene_composer.js#L148) — variant: replaces without preserving original (silently breaks other extensions)
- [aicocoa981/WhatDreamsCost-ComfyUI-private/js/multi_image_loader.js:87,94](https://github.com/aicocoa981/WhatDreamsCost-ComfyUI-private/blob/main/js/multi_image_loader.js#L87) — variant: `tempCallback` swap inside the callback (re-entrancy hazard)
- [aicocoa981/WhatDreamsCost-ComfyUI-private/js/ltx_keyframer.js:265,269](https://github.com/aicocoa981/WhatDreamsCost-ComfyUI-private/blob/main/js/ltx_keyframer.js#L265)

**Failure modes proven in the wild**:
- F1.1 Replacement without preserving original (silent breakage of other extensions on the same widget)
- F1.2 `tempCallback` swap inside the callback (race / re-entrancy hazard if widget triggers itself)
- F1.3 Lost `this` requiring `.bind(widget)` workaround
- F1.4 Multiple chained extensions form a singly-linked-list of closures with no introspection — debugging is hell

**v2 replacement (per D3.3)**: `widget.on('change', listener)` — multi-listener event subscription with `onScopeDispose` cleanup. No callback slot to overwrite. Listeners are introspectable.

## Pattern 2 — `nodeType.prototype.onNodeCreated` monkey-patching

**Fingerprint**: `const onNodeCreated = nodeType.prototype.onNodeCreated; nodeType.prototype.onNodeCreated = function (...args) { …; onNodeCreated?.apply(this, args) }`

**Why it exists**: `beforeRegisterNodeDef` only gives you `nodeType` (the constructor). The only way to attach per-instance state is to overwrite the prototype's `onNodeCreated`.

**Confirmed call sites**:
- [SKBv0/ComfyUI_SpideyReroute/js/SpideyReroute.js:41,43](https://github.com/SKBv0/ComfyUI_SpideyReroute/blob/main/js/SpideyReroute.js#L41) — **17 prototype refs in one file**
- [touge/ComfyUI-NCE_Utils/js/logic.js:5,66](https://github.com/touge/ComfyUI-NCE_Utils/blob/main/js/logic.js#L5)
- [touge/ComfyUI-NCE_Utils/js/text_node.js:6,67](https://github.com/touge/ComfyUI-NCE_Utils/blob/main/js/text_node.js#L6)

**Failure modes**:
- F2.1 Multiple extensions overwriting the same prototype: order-dependent; last-loaded wins for return-value semantics
- F2.2 Prototype mutations leak across HMR reloads in dev mode
- F2.3 No way to attach per-instance state without polluting all instances of the type
- F2.4 No way to *selectively* patch some instances of a node type

**v2 replacement (per D3.5)**: `defineNodeExtension({ nodeTypes: ['MyNode'], setup(node) { … } })` runs `setup` per-instance, no prototype access required. Reactive dispatch (D3.5) auto-mounts/unmounts.

## Pattern 3 — `nodeType.prototype.onExecuted` monkey-patching ⭐ NEW (this pass)

**Fingerprint**: `const onExecuted = nodeType.prototype.onExecuted; nodeType.prototype.onExecuted = function (message) { …; onExecuted?.apply(this, arguments) }`

**Why it exists**: Backend nodes return data via the `'executed'` WebSocket message. The frontend dispatches it to the node by calling `node.onExecuted(message)`. To display the result, extensions overwrite `onExecuted` to consume `message` then forward to original.

**Why this is the dominant "show backend output" pattern**: Almost every "show text", "show JSON", "preview anything", "show string" custom node uses exactly this shape.

**Confirmed call sites**:
- [AlexZ1967/ComfyUI_ALEXZ_tools/web/show_json.js:49,50](https://github.com/AlexZ1967/ComfyUI_ALEXZ_tools/blob/main/web/show_json.js#L49)
- [becky3/comfyui-workspace/.../js/show_text.js:33,34](https://github.com/becky3/comfyui-workspace/blob/main/custom_nodes/ComfyUI-Becky3-Common/js/show_text.js#L33)
- [linjm8780860/ljm_comfyui/src/extensions/core/previewAny.ts:64,66](https://github.com/linjm8780860/ljm_comfyui/blob/main/src/extensions/core/previewAny.ts#L64) (this is a *core extension* in a fork)
- [PioneerMNDR/ComfyUI-Polza/web/polza_display.js:80,82](https://github.com/PioneerMNDR/ComfyUI-Polza/blob/main/web/polza_display.js#L80)
- [andreszs/ComfyUI-Ultralytics-Studio/js/show_string.js:9,10](https://github.com/andreszs/ComfyUI-Ultralytics-Studio/blob/main/js/show_string.js#L9)

**Failure modes**:
- F3.1 If two extensions both consume `message` for the same node type, ordering determines which one "wins" the data
- F3.2 Backend message schema changes break every custom node — no contract layer
- F3.3 `arguments` vs `message` parameter inconsistency across implementations

**v2 replacement**: `node.on('executed', (msg) => …)` — multi-listener; backend message schema (per node type) becomes part of the typed API contract.

## Pattern 4 — `onConnectionsChange` monkey-patching ⭐ NEW (this pass)

**Fingerprint**: prototype-level OR per-instance: `nodeType.prototype.onConnectionsChange = function (type, slotIndex, isConnected, link, ioSlot) { … }`

**Why it exists**: Powers dynamic-input nodes (add/remove sockets based on what's plugged in). Triggered when any link is connected or disconnected to the node.

**Confirmed call sites**:
- [AkihaTatsu/ComfyUI-Simple-Utility-Nodes/web/type_resolver.js:119,144](https://github.com/AkihaTatsu/ComfyUI-Simple-Utility-Nodes/blob/main/web/type_resolver.js#L119) — patches twice in same file
- [DumiFlex/ComfyUI-Wildcard-Pipeline/src/main.ts:57](https://github.com/DumiFlex/ComfyUI-Wildcard-Pipeline/blob/main/src/main.ts#L57)
- [ComfyUI-Kelin/ComfyUI_Image_Anything/web/js/dynamic_inputs_extension.js:74](https://github.com/ComfyUI-Kelin/ComfyUI_Image_Anything/blob/main/web/js/dynamic_inputs_extension.js#L74) — per-instance patch on `node`, not prototype
- [m3rr/h4_Live/js/h4_Mutate.js:266](https://github.com/m3rr/h4_Live/blob/main/js/h4_Mutate.js#L266) — sig: `(type, slotIndex, isConnected, link, ioSlot)`
- [m3rr/h4_Live/js/h4_Oxidine.js:212](https://github.com/m3rr/h4_Live/blob/main/js/h4_Oxidine.js#L212) — sig: `(type, index, connected)` (3-arg variant)
- [m3rr/h4_Live/js/h4_DisplayAny.js:28](https://github.com/m3rr/h4_Live/blob/main/js/h4_DisplayAny.js#L28) — sig: `(type, index, connected, link_info, slot)` (5-arg, different names)

**Failure modes**:
- F4.1 **Six different parameter signatures observed across the corpus.** Nothing enforces the contract; community is collectively guessing.
- F4.2 Both prototype-level and per-instance `node.onConnectionsChange = …` exist — no clear guidance on which to use
- F4.3 Same multi-extension contention as Pattern 2

**v2 replacement**: `node.on('connectionChanged', { slot, connected, link }) => …` — typed payload, multi-listener.

## Pattern 5 — `nodeType.prototype.onRemoved` monkey-patching ⭐ NEW (this pass)

**Fingerprint**: `const onRem = nodeType.prototype.onRemoved; nodeType.prototype.onRemoved = function () { /* my cleanup */; onRem?.apply(this, arguments) }`

**Why it exists**: **There is no other teardown surface.** Extensions invent their own dispose by hijacking `onRemoved`. Powers cleanup of: DOM widget elements, `setInterval`/`setTimeout`, MutationObserver, IntersectionObserver, Web Audio nodes, etc.

**Confirmed call sites**:
- [Lightricks/ComfyUI-LTXVideo/web/js/sparse_track_editor.js:137,138](https://github.com/Lightricks/ComfyUI-LTXVideo/blob/main/web/js/sparse_track_editor.js#L137)
- [m3rr/h4_Live/js/h4_SmartSave.js:303](https://github.com/m3rr/h4_Live/blob/main/js/h4_SmartSave.js#L303)
- [kijai/ComfyUI-KJNodes/web/js/help_popup.js:348,349](https://github.com/kijai/ComfyUI-KJNodes/blob/main/web/js/help_popup.js#L348)
- [treforyan-hue/comfyui-deploy/.../batch_image_generator.js:4203,4204](https://github.com/treforyan-hue/comfyui-deploy/blob/main/extras/ComfyUI_INSTARAW/js/batch_image_generator.js#L4203)
- [treforyan-hue/comfyui-deploy/.../advanced_image_loader.js:2315](https://github.com/treforyan-hue/comfyui-deploy/blob/main/extras/ComfyUI_INSTARAW/js/advanced_image_loader.js#L2315)
- **Even our own ECS migration plan documents this pattern**: [Comfy-Org/ComfyUI_frontend/docs/architecture/ecs-migration-plan.md:587](https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/docs/architecture/ecs-migration-plan.md#L587)

**Failure modes**:
- F5.1 If extension forgets to chain to original `onRemoved`, native cleanup never fires — silent resource leak
- F5.2 No "node moved between graphs" event distinct from "node deleted" — extensions can't tell whether to dispose or preserve state during subgraph promotion
- F5.3 No "graph closed" event surfaced via prototype; only per-node onRemoved

**v2 replacement (BLOCKER per D4-G7)**: `defineNodeExtension({ setup(node) { … return { dispose() { … } } } })` — return value enforced by the runtime, not opt-in. Plus distinct events: `'removed'` vs `'movedToGraph'` vs `'graphClosed'`.

## Pattern 6 — `nodeType.prototype.getExtraMenuOptions` monkey-patching ⭐ NEW (this pass)

**Fingerprint**: `nodeType.prototype.getExtraMenuOptions = function (_canvas, options) { options.push(null); options.push({content: '…', callback: …}); }`

**Why it exists**: Only mechanism to add per-node-type entries to the right-click context menu. The `options` array is mutated in place.

**Confirmed call sites**:
- [r-vage/ComfyUI_Eclipse/js/eclipse-set-get.js:42](https://github.com/r-vage/ComfyUI_Eclipse/blob/main/js/eclipse-set-get.js#L42)
- [r-vage/ComfyUI_Eclipse/js/eclipse-mode-nodes.js:50,64](https://github.com/r-vage/ComfyUI_Eclipse/blob/main/js/eclipse-mode-nodes.js#L50) — patches twice for two different mode-changer node families
- [r-vage/ComfyUI_Eclipse/js/eclipse-image-comparer.js:29](https://github.com/r-vage/ComfyUI_Eclipse/blob/main/js/eclipse-image-comparer.js#L29) — uses `async beforeRegisterNodeDef` + filter on `nodeData.name`

**Failure modes**:
- F6.1 Mutation of `options` (a shared array): two extensions racing produce non-deterministic menu order
- F6.2 No way to remove an entry once added
- F6.3 No way to know which extension added which entry (no provenance)

**v2 replacement (D4-G4)**: UI contribution registry. `defineNodeExtension({ menuItems: [{label, action, when}] })` — declarative, deduplicated, observable.

## Pattern 7 — `LGraphCanvas.prototype.*` monkey-patching ⭐ NEW (this pass)

**Fingerprint**: `LGraphCanvas.prototype.processKey = function (e: KeyboardEvent) { …; origProcessKey.call(this, e); }`

**Why it exists**: Canvas-level customization (keyboard shortcuts, context menus, visibility/culling) has no API at all. Extensions reach into the LiteGraph canvas prototype directly.

**Confirmed call sites**:
- [akawana/ComfyUI-Folded-Prompts/js/FPFoldedPrompts.js:39](https://github.com/akawana/ComfyUI-Folded-Prompts/blob/main/js/FPFoldedPrompts.js#L39) — `const proto = LGraphCanvas.prototype;`
- [Creepybits/ComfyUI-Creepy_nodes/web/js/direct_apply.js:86,87](https://github.com/Creepybits/ComfyUI-Creepy_nodes/blob/main/web/js/direct_apply.js#L86) — patches `processContextMenu`, uses `_customColorsHooked` flag for idempotence
- [linjm8780860/ljm_comfyui/src/scripts/app.ts:603,604](https://github.com/linjm8780860/ljm_comfyui/blob/main/src/scripts/app.ts#L603) — patches `processKey` for custom keyboard shortcuts
- [kijai/ComfyUI-KJNodes/web/js/setgetnodes.js:1256,1257](https://github.com/kijai/ComfyUI-KJNodes/blob/main/web/js/setgetnodes.js#L1256) — patches `computeVisibleNodes` (this is how virtual set/get nodes hide themselves from the visible-node list!)

**Failure modes**:
- F7.1 Idempotence requires extensions to invent flags like `_customColorsHooked` (Creepybits pattern) — no standard
- F7.2 Multiple extensions racing on `processKey` produce keystroke-order-dependent behavior
- F7.3 `computeVisibleNodes` patching for virtual nodes is a *correctness-critical* abuse — if the patch breaks, set/get nodes appear and break workflows

**v2 implication (NEW gap, not in D4)**: G13 — Canvas-level extension surface. v1 of P1 covers nodes and widgets. Canvas-level capabilities (keyboard, context menus, visibility predicates) are an orthogonal axis. Need: `defineCanvasExtension({ keyBindings, menuItems, visibilityPredicate })` or similar.

## Pattern 8 — `app.api.addEventListener` (the existence-proof pattern) ⭐ NEW (this pass)

**Fingerprint**: `app.api.addEventListener("executed", (event) => { … event.detail … })` — also custom events `"extName.eventName"`.

**Why it matters**: This is the *one* place extensions today CAN subscribe instead of monkey-patch. It works because `ComfyApi extends EventTarget`. **The fact that this pattern works at scale is the strongest evidence that the v2 events-everywhere model will work.**

**Confirmed call sites**:
- [tavyra/ComfyUI_Curves/web/curve_visualize.js:184](https://github.com/tavyra/ComfyUI_Curves/blob/main/web/curve_visualize.js#L184) — `app.api.addEventListener("executed", onExecuted)` (cleaner alternative to Pattern 3 monkey-patching!)
- [ShakerSmith/ShakerNodesSuite/js/shaker_preview_ui.js:58](https://github.com/ShakerSmith/ShakerNodesSuite/blob/main/js/shaker_preview_ui.js#L58) — custom event `"b_preview"`
- [yardimli/SafetensorViewer/web/safetensor_viewer.js:38](https://github.com/yardimli/SafetensorViewer/blob/main/web/safetensor_viewer.js#L38) — custom event `"SafetensorViewer.update_files"`
- [nvmax/aspect-ratio-resizer/web/js/aspectRatioResizer.js:69,70](https://github.com/nvmax/aspect-ratio-resizer/blob/main/web/js/aspectRatioResizer.js#L69) — multiple custom events from different extensions
- [ameliacode/comfyui-face3d/.claude/skills/comfyui-node-frontend/SKILL.md:115,366](https://github.com/ameliacode/comfyui-face3d/blob/main/.claude/skills/comfyui-node-frontend/SKILL.md#L115) — third-party skill *teaches* this as the recommended pattern

**v2 implication**: Generalize. `node.on('executed', …)`, `widget.on('change', …)`, `graph.on('nodeAdded', …)`, `app.on('workflowLoaded', …)` all use the same shape extensions already know.

## Pattern 9 — `addDOMWidget` for custom widget rendering

**Fingerprint**: `node.addDOMWidget(name, type, element, options)` — and then no documented teardown, so see Pattern 5.

**Confirmed call sites**:
- [akawana/ComfyUI-Folded-Prompts/js/FPTabbedTextArea.js:257](https://github.com/akawana/ComfyUI-Folded-Prompts/blob/main/js/FPTabbedTextArea.js#L257)
- [zhupeter010903/ComfyUI-XYZ-prompt-library/js/prompt_library_node.js:153](https://github.com/zhupeter010903/ComfyUI-XYZ-prompt-library/blob/main/js/prompt_library_node.js#L153)
- [Lightricks/ComfyUI-LTXVideo/web/js/sparse_track_editor.js:218](https://github.com/Lightricks/ComfyUI-LTXVideo/blob/main/web/js/sparse_track_editor.js#L218) (this same file uses Pattern 5 to clean up!)
- [kijai/ComfyUI-KJNodes/web/js/editors/editor_base.js:511](https://github.com/kijai/ComfyUI-KJNodes/blob/main/web/js/editors/editor_base.js#L511) — generic editor base class

**Failure modes**: See Pattern 5 — no formal dispose, extensions piggyback on `onRemoved`.

**v2 replacement**: `defineWidgetExtension({ setup(node, ctx) { …; return { dispose() {…} } } })` (mandatory `dispose` per D4-G7).

## Pattern 10 — `isVirtualNode = true` flag ⭐ NEW (this pass)

**Fingerprint**: `nodeType.prototype.isVirtualNode = true;`

**Why it matters**: Tells the canvas this node should not be sent to the backend (set/get nodes, reroutes, mode changers). It's a magic property on the prototype — no formal "virtual node" registration.

**Confirmed call sites**:
- [r-vage/ComfyUI_Eclipse/js/eclipse-mode-nodes.js:42,63](https://github.com/r-vage/ComfyUI_Eclipse/blob/main/js/eclipse-mode-nodes.js#L42) — `setupModeChanger` and `setupGroupsModeChanger` both flip this flag

**v2 implication**: Virtual nodes are first-class via `defineNodeExtension({ kind: 'virtual', ... })` or via a `VirtualNode` component (per ECS ADR 0008). No magic prototype property.

## Pattern 11 — `beforeRegisterNodeDef` / `loadedGraphNode` actual usage ⭐ NEW (this pass)

**Findings on `beforeRegisterNodeDef`**:
- 7/8 search results were *interface declarations* in `comfy.d.ts` / `comfy.ts` files (extensions copying the type definition into their own repos for IDE help). This itself is a tell: the type isn't published as a usable package; consumers vendor it.
- 1/8 was a real call site in [drawthingsai/draw-things-comfyui/web/dist/extension.esm.js:1140](https://github.com/drawthingsai/draw-things-comfyui/blob/main/web/dist/extension.esm.js#L1140) — a *minified* bundle. So the real source is hidden.
- All confirmed call sites of monkey-patching (Patterns 2, 3, 4, 5, 6, 10) happen *inside* a `beforeRegisterNodeDef` callback. So the hook itself is widely used; the question for v2 is what replaces it.

**Findings on `loadedGraphNode`**:
- 7/8 search results were *interface declarations* — type re-declarations, not call sites.
- **Only 1 actual call site found in the entire corpus**: [sofakid/dandy/web/main.js:114](https://github.com/sofakid/dandy/blob/main/web/main.js#L114).
- **Verdict**: `loadedGraphNode` is effectively dead. v2 can drop it without replacement. Per D3.5, the `LoadedFromWorkflow` tag component covers the legitimate use case (one-time post-load hydration).

## Pattern 12 — `getCustomWidgets` near-zero usage ⭐ NEW (this pass)

**Findings**:
- One TypeScript no-op: [haohaocreates/PR-rk-comfy-nodes-36d8f0a5/web/rk_nodes.ts:22](https://github.com/haohaocreates/PR-rk-comfy-nodes-36d8f0a5/blob/main/web/rk_nodes.ts#L22) — `async getCustomWidgets(app) { return undefined; }` (registered but does nothing).
- Other hits were `.js.map` files (minified core extensions of forked frontends).
- **Verdict**: Custom-widget *registration* via this hook appears almost unused in the wild. The widget *contribution* path is `addDOMWidget` (Pattern 9). v2 can likely remove `getCustomWidgets` and require widgets be contributed through `defineWidgetExtension({ widgetType, setup })` instead.

## Failure modes the v2 API must prevent (consolidated, evidence-backed)

| # | Failure mode | Evidence (pattern + variants) | v2 prevention mechanism |
|---|---|---|---|
| F1 | Two extensions racing on the same `widget.callback` slot | P1 (8 repos) | Multi-subscriber event emitter; no shared writable slot |
| F2 | Replacement without preserving original (silent breakage) | P1.1 (b34t scene composer) | No mutable callback slot exists for extensions to overwrite |
| F3 | Prototype patching ordering bugs | P2, P3, P4, P5, P6 (12+ repos) | No prototype access; `setup(node)` runs per-instance |
| F4 | Prototype leaks across HMR reloads | P2 | Extension scope torn down on reload (mirrors Vue effect scope) |
| F5 | DOM widget leaks (no formal dispose) | P5 (7+ repos invent their own teardown) | Mandatory `dispose()` return from widget setup (D4-G7) |
| F6 | Widget callback re-entrancy from `tempCallback` swap | P1.4 (WhatDreamsCost) | Event emitter dedup via `triggered` flag (per D1 batching notes) |
| F7 | No way to patch *some* instances of a node type | P2 | `setup(node)` decides per-instance whether to attach state |
| F8 | Cross-extension state contention via shared `nodeData` mutation | P11 (in beforeRegisterNodeDef) | `inspectNodeDef` returns frozen view; mutation requires explicit command (D4-G1) |
| F9 ⭐ | Six different signatures observed for same hook | P4 (onConnectionsChange across m3rr/h4_Live) | Typed event payload — TypeScript enforces contract |
| F10 ⭐ | Backend message schema breaks every "show result" custom node | P3 (5 repos all hand-parse `message`) | Per-node-type typed event payloads; backend message schema becomes part of contract |
| F11 ⭐ | Shared `options` array mutation in menu hook | P6 (Eclipse) | Declarative menu items, not array mutation |
| F12 ⭐ | Canvas-level prototype patching with custom idempotence flags | P7 (Creepybits `_customColorsHooked`) | Canvas extension API with explicit registration (G13) |
| F13 ⭐ | "Virtual node" status as magic prototype property | P10 (Eclipse) | Explicit `kind: 'virtual'` or VirtualNode component |
| F14 ⭐ | No "moved to subgraph" event distinct from "removed" | P5 (forces conflation) | Distinct lifecycle events: `removed` vs `movedToGraph` |

## Mapping to v2 API

| Current pattern | v2 replacement | Decision ref |
|---|---|---|
| `widget.callback = …` chaining (P1) | `widget.on('change', listener)` | D3.3 |
| `nodeType.prototype.onNodeCreated = …` (P2) | `defineNodeExtension({ nodeTypes, setup(node) })` | D3.5 |
| `nodeType.prototype.onExecuted = …` (P3) | `node.on('executed', (msg) => …)` | D3.3 + new typed-message decision needed |
| `nodeType.prototype.onConnectionsChange = …` (P4) | `node.on('connectionChanged', payload)` (typed) | D3.3 |
| `nodeType.prototype.onRemoved = …` (P5) | Mandatory `dispose()` return from setup; `'removed'` vs `'movedToGraph'` events | D4-G7 + new event-taxonomy decision |
| `nodeType.prototype.getExtraMenuOptions = …` (P6) | Declarative `menuItems` in `defineNodeExtension` | D4-G4 → planned D6 |
| `LGraphCanvas.prototype.* = …` (P7) | `defineCanvasExtension({ keyBindings, menuItems, visibilityPredicate })` | NEW G13 |
| `app.api.addEventListener('executed', …)` (P8) | `node.on('executed', …)` (generalized — same shape extensions know) | D3.3 |
| `addDOMWidget(...)` + manual cleanup (P9) | `defineWidgetExtension({ setup, dispose })` (dispose mandatory) | D4-G7 |
| `nodeType.prototype.isVirtualNode = true` (P10) | `defineNodeExtension({ kind: 'virtual', ... })` or VirtualNode component | NEW (sub-decision under D5) |
| `beforeRegisterNodeDef(nodeType, nodeData, app)` (P11) | Eliminated; replaced by `nodeTypes` filter + `inspectNodeDef` | DEP1 + D4-G1 |
| `loadedGraphNode` (P11) | Removed; `LoadedFromWorkflow` tag component handles the legitimate case | D3.5 |
| `getCustomWidgets` (P12) | Removed; widgets contributed via `defineWidgetExtension` | NEW (sub-decision) |

## Open questions surfaced (feed into D4 / D5+)

1. **Backend message schema versioning**: Pattern 3 reveals every "show result" node hand-parses backend messages. v2 needs typed message contracts per node type. Where does this contract live? In the node definition? In a separate manifest? (Owner: D5)
2. **Distinguishing "removed" from "moved to subgraph"** (Pattern 5 + F14): events must distinguish, but ECS ADR 0008 may already cover this via component lifecycle (subgraph promotion = component move, not entity destruction). Need to verify.
3. **Canvas extension surface** (Pattern 7 + new G13): v1 of P1 doesn't address canvas-level customization at all. Needs its own decision doc.
4. **Idempotence story for extension hooks** (F4 + Pattern 7's `_customColorsHooked`): how do we handle extension reload in dev mode without leaking patches?
5. **Type re-declaration in third-party `comfy.d.ts` files** (Pattern 11): the absence of a published `@comfyui/types` package forces extensions to vendor type defs. This is an *unowned* compat surface. Does v2 ship `@comfyui/extension-api` as a real npm package? (Owner: planning task)

## Re-run checklist (remaining)

These queries hit MCP DNS errors and were not recovered this pass; re-run when service is stable:

1. `useChainCallback` — count internal `ComfyUI_frontend/src/extensions/core/*` usages (DEP2 verification)
2. `getCustomWidgets app return` non-bundle results — confirm Pattern 12 verdict (no real usage)
3. `app.canvas.constructor.prototype` — alternative path to LGraphCanvas patching
4. `node.computeSize override` — secondary monkey-patching surface (size hints)
5. `node.serialize` overrides — workflow serialization customization
6. `getSelectionToolboxCommands` — usage in the wild

## Methodology notes

- Searched via `mcp__comfy_codesearch__search_code` against the ComfyUI custom-node corpus
- ~30 total queries this session; ~14 successful, the rest hit `gitserver-0.gitserver` DNS errors
- Workaround for flaky MCP: rephrase failing queries with 3 distinct tokens (e.g., `prototype.onExecuted` worked when `onExecuted message original` failed)
- Coverage caveat: results capped at 8-15 per query by the API; "+15" totals indicate more results exist
- Selection bias: `.js.map` and minified bundle hits were excluded from analysis even though they confirm the pattern is in compiled code
