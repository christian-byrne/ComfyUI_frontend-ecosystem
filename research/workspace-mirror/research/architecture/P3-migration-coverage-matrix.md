# P3 — Migration Coverage Matrix

**Source:** `research/touch-points/database.yaml` + `rollup.yaml` (73 patterns, generated 2026-05-08)

**Dispositions:**

| Label | Meaning |
|---|---|
| `replaced` | v2 API provides a direct, semantically equivalent replacement. Extensions can migrate mechanically. |
| `re-implemented` | v2 re-implements the capability at parity under a different mechanism (no behavior loss). |
| `strangler-figged` | v1 hook remains callable; v2 runtime intercepts and translates. Extension code needs no change until Phase D sunset. |
| `dropped` | Pattern relied on an internal detail with no v2 contract. v2 simply does not expose it; extensions using it must change. |
| `uwf-resolved` | Migration path is UWF Phase 3 save-time materialization, not v2 extension API. No v2 extension hook covers this. |
| `security-policy` | Pattern is disallowed by the v2 security model; extensions must change unconditionally. |

Patterns are sorted by `blast_radius` descending. Column `BR` = blast_radius score.

---

## S6 — App-level execution / serialization hooks

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S6.A1 | app.graphToPrompt monkey-patching | 7.016 | **uwf-resolved** | UWF Phase 3 save-time materialization; transitional bridge: `ctx.on('beforePrompt', event => {...})` (Phase B, I-UWF.4.F2) | Most impacted repos: Manager, rgthree, KJNodes, Easy-Use. UWF Phase 3 handles virtual-node resolution, cross-node transforms. v2 `beforePrompt` is the transition bridge only; long-term path is UWF. |
| S6.A4 | app.queuePrompt / queuePrompt patching | 6.095 | **replaced** | `graph.run({ batch })` + `app.on('beforeRun', payload => {...})` | Run interception, custom payload mutation, sidebar 'Run' buttons. `beforeRun` fires before queuePrompt is called. |
| S6.A3 | api.fetchApi — HTTP endpoint calls | 5.774 | **re-implemented** | `ctx.api.fetch(path, init)` typed wrapper | Same semantics, auth/base-URL handled by harness, narrower surface. Not a breaking change; shim can forward `fetchApi` to `ctx.api.fetch`. |
| S6.A2 | window.app.loadGraphData direct call | 5.054 | **replaced** | `app.loadWorkflow(json)` on public API barrel | Existing load codepath preserved; only call site changes. |
| S6.A5 | Frontend pre-queue validation | 4.719 | **replaced** | `ctx.on('beforeQueue', event => event.reject(msg))` (D5 EVT2) | Silent-breakage multi-patch scenario documented in BC.35. |

---

## S2 — Node lifecycle prototype patching

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S2.N15 | nodeType.prototype.serialize patching | 6.358 | **replaced** | `node.on('beforeSerialize', (event) => {...})` (D5, EVT2) | Covers `onSerialize` and direct `serialize` method replacement. `setSerializedValue` / `skip` typed mutators on event object. |
| S2.N16 | node.widgets array direct access | 5.803 | **replaced** | `nodeHandle.widgets()` iterator + named widget lookup `nodeHandle.widget(name)` | Direct positional access replaced by named lookup; aligns with widgets_values_named (S17.WV1). |
| S2.N12 | onConnectInput prototype patching | 5.457 | **replaced** | `node.on('connectionChanged', { slot, connected, link, direction: 'input' })` | Return-false to refuse: `event.preventDefault()`. |
| S2.N13 | onConnectOutput prototype patching | 5.267 | **replaced** | `node.on('connectionChanged', { ..., direction: 'output' })` | Same event shape as S2.N12 input side. |
| S2.N9 | onDrawForeground custom canvas drawing | 5.251 | **replaced** | `defineNodeExtension({ onDraw(node, ctx2d) {...} })` — Phase B canvas drawing API (I-SR.3) | Lifecycle coupling HIGH; Phase A: strangler-figged (prototype patch still fires). Phase B: dispatch through ECS render pass. |
| S2.N4 | onRemoved — de-facto teardown | 5.197 | **re-implemented** | `defineNodeExtension({ setup(node) { return { dispose() {...} } } })` | dispose() called by `unmountExtensionsForNode()` on graph deletion. Survives subgraph promotion (does NOT call dispose on move, only on delete per D12). |
| S2.N14 | onWidgetChanged prototype patching | 5.091 | **replaced** | `widget.on('valueChange', fn)` (D5 EVT3) | Narrower: fires only on true value change, not on option mutations. |
| S2.N19 | onResize prototype patching | 4.948 | **replaced** | `node.on('resize', (newSize) => {...})` | Reactive layout system fires this after reflow. |
| S2.N7 | onConfigure — workflow-load-time hook | 4.906 | **replaced** | `defineNodeExtension({ loadedGraphNode(node) {...} })` + `LoadedFromWorkflow` ECS tag (D3.5) | Distinction: `loadedGraphNode` fires only when `LoadedFromWorkflow` tag present (workflow hydration); `nodeCreated` fires for all creation paths. |
| S2.N11 | computeSize prototype patching | 4.903 | **replaced** | `defineNodeExtension({ minSize: [w, h] })` declarative | Must call `super.computeSize()` for composite layout correctness; v2 enforces this by calling super first. |
| S2.N18 | onPropertyChanged prototype patching | 4.806 | **replaced** | `node.on('propertyChange', ({ key, value, prev }) => {...})` (D5 EVT3 `propertyChange` @experimental) | Low occurrence (rgthree-only). |
| S2.N10 | onMouseDown prototype patching | 4.662 | **replaced** | `node.on('mouseDown', (event, pos) => {...})` | Widget-level pointer events also available. |
| S2.N2 | onExecuted — execution output display | 4.671 | **replaced** | `node.on('executed', (msg) => {...})` typed message contract | Most common use: display text/image/JSON outputs. Typed by output kind. |
| S2.N5 | getExtraMenuOptions prototype patching | 4.989 | **replaced** | `defineNodeExtension({ menuItems: [{label, action, when}] })` declarative | `when` predicate receives node handle. |
| S2.N8 | onAdded prototype patching | 4.274 | **dropped** | Use `nodeCreated` + `LoadedFromWorkflow` tag instead | `onAdded` fires after graph attachment; `nodeCreated` fires before. v2 consolidates: `nodeCreated` is the creation hook; workflow-load case uses `loadedGraphNode`. No "after-graph-attach" hook in v2 Phase A — if needed, file as API gap. |
| S2.N17 | onSelected / onDeselected patching | 1.469 | **replaced** | `node.on('selected', fn)` / `node.on('deselected', fn)` | Low blast_radius; straightforward event. |
| S2.N6 | onSerialize prototype patching | 4.432 | **replaced** | `node.on('beforeSerialize', event => event.setSerializedValue(key, val))` (same as S2.N15) | Alias: same v2 event covers both the `serialize` method patch and `onSerialize` hook. |
| S2.N3 | onConnectionsChange prototype patching | 3.934 | **replaced** | `node.on('connectionChanged', ...)` | Covers both connect and disconnect; `connected` bool in payload. |
| S2.N1 | onNodeCreated prototype patching | 4.480 | **replaced** | `defineNodeExtension({ nodeTypes: [...], setup(node) {...} })` | The canonical v2 per-instance setup path. Harness smoke test (BC.02) covers this. |

---

## S11 — Graph mutation and batching

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S11.G2 | graph.add/remove/findNodesByType/findNodeById/serialize/configure | 6.276 | **re-implemented** | `graph.nodes()` iterator + `graph.findNodes({ type, ... })` + explicit mutation API | `graph.configure()` replaced by `app.loadWorkflow(json)`. `graph.serialize()` stays internal; extensions don't need it — use `ctx.on('beforePrompt')` to see the serialized form. |
| S11.G3 | graph.beforeChange / graph.afterChange batching | 6.251 | **replaced** | `world.batch(() => { ...mutations... })` typed batching API | ECS World batch coalesces undo/dirty/re-render. v1 shim: `beforeChange`/`afterChange` calls pass through to `world.batch` wrapper. |
| S11.G4 | graph.setDirtyCanvas imperative redraw | 4.541 | **dropped** | Implicit — reactive system schedules redraws on entity mutation. Escape hatch: `world.markDirty()` for non-reactive canvas use. | Phase A: strangler-figged (setDirtyCanvas noop shim that triggers reactive flush). |
| S11.G1 | graph._version mutation/read | 4.681 | **dropped** | Internal version counter is not public in v2. Listen to `graph.on('changed', fn)` for change notification. | `_version` read is a change-detection hack; replace with typed event. |

---

## S7 — Global namespace (window.LiteGraph / window.comfyAPI)

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S7.G1 | window.LiteGraph / window.comfyAPI.* globals | 6.118 | **strangler-figged** | `import { app, graph, LiteGraph } from '@comfyorg/extension-api'`; window.* remains a deprecated read-only mirror | Phase D: window.comfyAPI.* mirrors are removed. Until then the shim keeps them alive. `comfyAPIPlugin.ts` wires `window.comfyAPI.*` from the v2 barrel (MIG1.E5). |

---

## S10 — Dynamic slot / link mutation

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S10.D1 | node.addInput / removeInput / addOutput / removeOutput | 6.029 | **replaced** | `nodeHandle.addInput(spec)` / `nodeHandle.removeInput(name)` typed methods (Phase B ECS dispatch) | Phase A: thin shim to LGraphNode. ECS dispatch in Phase B. |
| S10.D2 | node.connect / disconnectInput / disconnectOutput | 5.994 | **replaced** | `nodeHandle.connect(outputSlot, targetNode, inputSlot)` / `nodeHandle.disconnect(...)` | Phase A shim; Phase B dispatches `ConnectNodes` / `DisconnectNodes` ECS commands. |
| S10.D3 | node.setSize(computeSize()) imperative resize | 5.273 | **dropped** | Implicit reactive layout recomputes size when widget/slot collection changes. Escape hatch: `nodeHandle.requestLayout()`. | Phase A: strangler-figged (call triggers reactive reflow instead of direct LGraphNode mutation). |

---

## S4 — Widget API

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S4.W4 | widget.options.values mutation (COMBO update) | 5.808 | **replaced** | `widget.setOption('values', [...])` typed mutation that triggers re-render | Phase A already implemented in WidgetHandle. |
| S4.W3 | widget.serializeValue direct assignment | 5.583 | **replaced** | `widget.setSerializeValue(fn)` (WidgetHandle, already in extensionV2.ts) | Covers `dynamicPrompts.v2.ts` pattern. |
| S4.W2 | node.addDOMWidget | 5.448 | **re-implemented** | `defineWidgetExtension({ widgetType, setup, dispose })` — dispose mandatory per D4-G7 | `setup` receives the host element; `dispose` is called on `onRemoved`. Phase A: DOM widget lifecycle is the same but `dispose` is now enforced by the harness. |
| S4.W5 | direct widget.value writes | 4.717 | **replaced** | `widget.setValue(newValue)` — unified set+notify | Already in v2 POC. Unifies write with callback notification. |
| S4.W1 | widget.callback chain pattern | 4.545 | **replaced** | `widget.on('valueChange', fn)` (D5 EVT3) | The chain pattern is the de-facto way to subscribe; v2 makes it declarative. Phase C strangler: widget.callback setter traps and translates to event listener. |
| S4.W6 | DOM widget creation hook (cross-ext observer) | 0.411 | **dropped** | No cross-extension widget observer in v2 Phase A. GAP filed (BC.33). Extensions that need this should use `graph.on('widgetAdded', ...)` when/if implemented. | Rare pattern; deferred. |

---

## S9 — Structural entities (Reroute / Group / Link / Slot / Subgraph)

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S9.SG1 | Subgraph "set/get virtual node" pattern | 5.755 | **uwf-resolved** | UWF Phase 3 must know which nodes are layout-only. Transitional: `defineNodeExtension({ kind: 'virtual', resolveConnections(inputs) → ResolvedEdges })` (I-UWF.5, pending decision) | KJNodes Set/Get, cg-use-everywhere. Not expressible as per-node `beforeSerialize`; needs `ctx.on('beforePrompt')` bridge (I-UWF.4.F2). |
| S9.L1 | LLink direct mutation | 5.475 | **dropped** | Links are ECS entities in Phase B. No direct mutation in v2; use `nodeHandle.connect()` / `nodeHandle.disconnect()`. `link.color` styling: `defineCanvasExtension({ linkStyle(link) → style })`. | Phase A: strangler-figged (direct LLink mutation still works; ECS sync deferred to Phase B). |
| S9.G1 | LGraphGroup creation / mutation | 4.765 | **re-implemented** | `graph.addGroup(spec)` / `groupHandle.setColor(...)` typed API (Phase B ECS Group entity) | Phase A: strangler-figged (direct group mutation still works). |
| S9.R1 | Reroute creation / mutation | 3.912 | **re-implemented** | `graph.addReroute(linkId)` / `rerouteHandle.setPosition(...)` (Phase B ECS Reroute entity) | Phase A: strangler-figged. |
| S9.S1 | Slot direct mutation | 4.493 | **dropped** | Slot appearance declared at registration: `defineNodeExtension({ slots: [{ name, color, shape }] })`. Runtime style: `defineCanvasExtension({ slotStyle(slot) → style })`. | `slot.color_on`/`color_off` are LiteGraph internals; not exposed in v2. |

---

## S5 — Backend event subscriptions

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S5.A1 | app.api.addEventListener — existence proof | 4.995 | **re-implemented** | `ctx.execution.on('executed' | 'start' | 'success' | 'error' | 'cached', payload => ...)` OR `node.on('executed', ...)` | The proven "events everywhere" pattern is the v2 foundation. v1 addEventListener shim stays; events are re-emitted on the v2 bus. |
| S5.A2 | app.api.addEventListener('progress') | 4.505 | **replaced** | `node.on('progress', ({ step, total, value }) => ...)` per-node AND `app.on('progress', ...)` global | Both surfaces provided. |
| S5.A3 | api.addEventListener execution lifecycle events | 4.252 | **replaced** | `ctx.execution.on('start' | 'success' | 'error' | 'cached', payload => ...)` typed events | v1 string event names mapped to typed v2 enum. |

---

## S3 — Canvas-level monkey-patching

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S3.C1 | LGraphCanvas.prototype.* monkey-patching | 4.809 | **replaced** | `defineCanvasExtension({ keyBindings, menuItems, visibilityPredicate, onDraw })` (NEW G13, I-PG.A1) | Covers keyboard, context menu, visibility predicates, drawing overrides. High-impact: 12 unique repos. Phase A: surface shim added. |
| S3.C2 | LiteGraph.ContextMenu global replacement | 0.711 | **dropped** | Completely replaced by the `defineCanvasExtension` menu contribution model. Global replacement of ContextMenu is not supported in v2. | One repo (Easy-Use). Extensions must migrate to `menuItems` declarative API. |

---

## S1 — ComfyExtension hook slots (the v1 registration surface)

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S1.H1 | loadedGraphNode hook | 4.419 | **strangler-figged** | v1 hook fires are translated to `LoadedFromWorkflow` tag dispatch (D3.5). `defineNodeExtension({ loadedGraphNode })` is the v2 declaration form. | Phase C: v1 hook slot deprecated. |
| S1.H2 | getCustomWidgets hook | 4.483 | **strangler-figged** | `defineWidgetExtension({ widgetType, setup, dispose })` is the v2 equivalent. v1 hook slot kept alive via strangler until Phase D. | |
| S1.H3 | getCanvasMenuItems hook | 4.130 | **strangler-figged** | `defineCanvasExtension({ menuItems: [...] })` is the v2 equivalent. v1 hook slot kept alive; items merged into the menu. | |
| S1.H4 | getNodeMenuItems hook | 4.063 | **strangler-figged** | `defineNodeExtension({ menuItems: [...] })` is the v2 equivalent. | |
| S1.H5 | addCustomNodeDefs hook | 3.599 | **dropped** | BLOCKER D4-G2: v2 needs explicit `registerNodeDef(spec)` equivalent. Until implemented, v1 hook slot remains open (no v2 replacement shipped). Flag for I-COORD.1 — core extensions using this are blocked from Phase A conversion. | |
| S1.H6 | registerCustomNodes hook | 4.741 | **dropped** | BLOCKER D4-G2: same as H5 — pure-frontend node registration not yet in v2 surface. Phase A leaves this hook intact. | |

---

## S8 — Node prototype properties

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S8.P1 | nodeType.prototype.isVirtualNode = true | 4.697 | **replaced** | `defineNodeExtension({ kind: 'virtual' })` flag (Phase B) OR `VirtualNode` ECS component (ADR 0008). Phase A: `isVirtualNode` property still read by the canvas; no breaking change. | Subject to I-UWF.5 decision on virtual-node declaration API. |

---

## S13 — Schema inspection

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S13.SC1 | ComfyNodeDef inspection | 4.736 | **re-implemented** | `ctx.inspectNodeDef(nodeData)` typed helper + `node.kind` first-class registration | Shape is stable; v2 just provides a typed wrapper instead of raw object access. |

---

## S14 — Identity encoding

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S14.ID1 | NodeLocatorId / NodeExecutionId parsing | 1.234 | **re-implemented** | Stable; `NodeHandle` is already opaque. Locator helpers stay public in the typed barrel. | Very low blast_radius; only one repo. |

---

## S15 — Output schema / dynamic outputs

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S15.OS1 | dynamic output mutation at runtime | 5.704 | **replaced** | Schema-declared outputs (`OUTPUT_TYPES` list in registration); runtime mutation via `node.declareOutputs(spec)` explicit API | Phase B ECS dispatch. High lifecycle coupling — mutation triggers re-layout and link validation. |

---

## S12 — Shell UI contributions

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S12.UI1 | extensionManager / commandManager / toastManager / sidebarTab / bottomPanel | 5.484 | **re-implemented** | Same surface kept; only ID/structure refinements in v2. Semantic stable. | Highest blast_radius shell-UI pattern. No migration burden. |
| S12.UI2 | app.ui.settings.settingsLookup direct mutation | 0.711 | **dropped** | Private; not part of v2 surface. Extensions should register their own settings via the public `app.ui.settings.addSetting()` API and not reach into another extension's handlers. | |
| S12.UI3 | Settings-integrated custom dialog | 0.411 | **re-implemented** | `app.ui.dialog.open(component, options)` typed method (Phase B shell API). Phase A: pattern still works as-is. | |

---

## S16 — Security / DOM injection patterns

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S16.DOM1 | document.createElement('style') CSS injection | 0.711 | **security-policy** → **replaced** | `extensionManager.injectStyles(css)` scoped to extension lifetime; auto-removed on extension dispose (BC.31 v2 contract). | |
| S16.DOM2 | document.body.appendChild arbitrary DOM | 0.711 | **security-policy** → **replaced** | `extensionManager.mountPanel(element, options)` lifecycle-managed mount. | |
| S16.DOM3 | innerHTML concatenation | 0.211 | **security-policy** | Disallowed in v2. Use template literals with sanitization or Vue components. Extension review gate. | |
| S16.DOM4 | direct fetch() bypassing api.fetchApi | 0.711 | **security-policy** | Disallowed; `ctx.api.fetch()` is the only sanctioned HTTP surface. | |
| S16.VUE1 | bundled Vue runtime inside DOM widget | 0.611 | **security-policy** → **replaced** | `defineWidgetExtension` shares the host Vue instance (BC.32). Bundling own Vue runtime is disallowed in v2 — causes version conflicts, double-reactivity. | |
| S16.D1 | SVG with inline event handlers | 1.302 | **security-policy** | Disallowed. addEventListener at mount instead. Extension review gate blocks shipping SVGs with `onload`/`onerror`. | |
| S16.D3 | Obfuscated string-replace pipeline | 1.229 | **security-policy** | Flag for human review; blocked at extension publish gate. Not a v2 contract change. | |
| S16.D7 | Python web/ template uses exec/eval | 1.168 | **security-policy** | Static templating only in v2 extension contract. No exec/eval at request time. Backend concern, not frontend API. | |

---

## S17 — Newly-identified gaps (S17 pain-point patterns)

| ID | Name | BR | Disposition | v2 Path | Notes |
|---|---|---|---|---|---|
| S17.WV1 | widgets_values positional array serialization | 4.086 | **uwf-resolved** | UWF Phase 1 emits `widgets_values_named` key-value pairs (Austin PR #10392). v2 `WidgetHandle` uses name-based identity (I-WS.3 lazy getter). Positional fallback kept in v1 compat mode. | Root cause of #1 user complaint. I-WS.8 confirms lazy getter compatible. |
| S17.AM1 | appModeStore / canvas mode state | 1.111 | **replaced** | `app.on('modeChanged', ({ from, to }) => {...})` typed event + `node.on('modeChanged', ...)` for per-node adaptation. Phase B. | No hook exists today; v2 introduces this gap filler. |
| S17.SB1 | Subgraph boundary event propagation | 1.111 | **dropped** | Phase A: no fix. Phase B (post-Alex ECS rebase): subgraph boundary traversal is an ECS property — `onExecuted` and `onConnectionsChange` dispatch crosses boundary via World query. Tracked as I-COORD.2. | Four distinct failure modes. ECS ADR 0008 Six-Entity model makes boundary explicit. |
| S17.FA1 | File upload / asset URL construction | 0.211 | **replaced** | `ctx.api.uploadFile(file, options) → { url }` typed helper. Hides FormData, `/upload/image`, `/view?...` URL construction. Phase B. | 32+ packages build their own FormData currently. |

---

## Summary by disposition

| Disposition | Count | Notes |
|---|---|---|
| `replaced` | 33 | Direct v2 API equivalent; mechanical migration. |
| `re-implemented` | 11 | Capability preserved under different mechanism; some migration effort. |
| `strangler-figged` | 5 | v1 hook slots kept alive by Phase C strangler; zero extension migration burden until Phase D sunset. |
| `dropped` | 13 | No v2 equivalent; extensions must change. Most are internal-detail hacks (graph._version, direct slot mutation). |
| `uwf-resolved` | 3 | S6.A1, S9.SG1, S17.WV1 — UWF Phase 3 is the destination. v2 provides transitional bridges only. |
| `security-policy` | 8 | S16.* patterns; extensions must change unconditionally. Extension publish gate enforces these. |
| **Total** | **73** | |

---

## Blockers for Phase A launch

Extensions using these patterns cannot be migrated until the v2 blocker is resolved:

| Pattern | Blocker | Owner |
|---|---|---|
| S1.H5 addCustomNodeDefs | D4-G2: no `registerNodeDef(spec)` equivalent | Design needed (I-COORD.1) |
| S1.H6 registerCustomNodes | D4-G2: no pure-frontend node registration | Design needed (I-COORD.1) |
| S2.N8 onAdded | "After-graph-attach" lifecycle event not in v2 Phase A | Low priority; file as API gap if needed |
| S9.SG1 virtual subgraph pattern | I-UWF.5 decision pending | I-UWF.5 |
| S8.P1 isVirtualNode | I-UWF.5 decision on `kind: 'virtual'` flag | I-UWF.5 |

---

## uwf-resolved bridge summary

For extensions stuck behind UWF Phase 3, the transitional v2 bridge is:

```ts
export default defineExtension({
  name: 'my-ext',
  setup(ctx) {
    // Fires after all per-node beforeSerialize handlers.
    // event.spec is read-only; use typed mutators.
    ctx.on('beforePrompt', (event) => {
      const getNodes = event.spec.nodes.filter(n => n.type === 'MyGet')
      for (const node of getNodes) {
        const val = computeFromGraph(event.spec, node)
        event.resolveVirtualInput(node.id, 'value', val)
      }
    })
  }
})
```

This covers S6.A1 (graphToPrompt patching) and S9.SG1 (virtual-node wiring) as Phase B transitional bridges. The long-term home is UWF Phase 3 materialization, not this hook.
