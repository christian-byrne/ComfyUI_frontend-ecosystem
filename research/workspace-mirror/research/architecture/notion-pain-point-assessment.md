---
source_url: https://www.notion.so/comfy-org/Develop-a-custom-node-from-scratch-pain-point-assessment-33c6d73d365080f49126c0b5affa7559
parent_page_url: https://www.notion.so/comfy-org/Nodes-2-0-Default-UI-DevRel-Docs-Migration-3226d73d365081b388c1c393c1d7415b
date_accessed: 2026-05-08
page_last_edited: 2026-04-14
author: Terry Jia (lead), Christian Byrne
methodology: Develop a custom node from scratch, document every blocker and friction point
scope: First-principles walkthrough; supplements §58-package aggregate audit (notion-api-usage-research-summary.md)
---

# Custom Node Pain Point Assessment — Ingestion Summary

## Source overview

Terry Jia's developer-experience assessment built by developing a custom Vue node from scratch.
Companion to the 58-package aggregate audit. Produces a prioritized P0/P1/P2 list plus four
appendix sections (A.1–A.4) that surface gaps not captured by code-search methodology.

Parent milestone: "Nodes 2.0 Default UI — DevRel, Docs & Migration" (P1, in-progress).

---

## P0 Blockers — must fix before public Vue API launch

### P0-1: No documentation for custom widgets
- `getCustomWidgets` hook not mentioned in javascript_hooks.mdx
- `addDOMWidget` mentioned but not explained
- Widget constructor contract (V1 vs V2 signature, `getValue`/`setValue`, serialization) undiscoverable without reading source
- **78+ packages resort to prototype monkey-patching as workaround** — this is the direct causal link between documentation absence and S2.N* blast radius
- **DB cross-ref:** S1.H3 (`getCustomWidgets` hook), S4.W2 (`addDOMWidget`), S4.W3 (`widget.serializeValue`)
- **v2 resolution:** D7 (widget shape + persistence), PKG2 (published types), DEP3 (docs update)

### P0-2: No documentation for Vue component widgets
- `ComponentWidgetImpl` exists at `src/scripts/domWidget.ts`, fully functional, used internally by `load3d.ts`
- Zero public docs; zero mention in the extension guide
- **9+ packages bundle entire Vue runtime** (~50KB+ each, some >7000 lines) because they don't know they can use the host Vue instance
- Cannot access i18n, theme, or Pinia stores from bundled runtime
- **DB cross-ref:** S16.VUE1 (bundled Vue runtime — BC.32)
- **v2 resolution:** `registerVueWidget(nodeType, name, Component)` in PKG2 surface; composables `useNodeSize()`, `useWidgetValue()` etc.

### P0-3: V1 vs V3 schema — no decision guidance
- All docs + walkthrough cover V1 exclusively
- V3 (RemoteOptions, Autogrow, DynamicCombo, MatchType, typed IO) exists but framed as migration doc, not getting-started
- No comparison matrix; V3 stability label says "more changes will be made without warning"
- **DB cross-ref:** S13.SC1 (schema interpretation), S13.SC2 (nodeData inspection)
- **v2 resolution:** DEP3 (docs update scope includes V1 vs V3 guidance)

---

## P1 High-friction issues

### P1-1: Prototype monkey-patching is the only way to extend node behavior
- 135 `onNodeCreated`, 88 `onExecuted`, 64 `onConnectionsChange` patches
- `chainCallback` independently reimplemented by 5+ packages (VHS, AnimateDiff, KJNodes, Impact-Pack, VHS)
- docs mark prototype hijacking deprecated but provide no alternative for all use cases
- **DB cross-ref:** S2.N1, S2.N3, S2.N4 (core patching family), S4.W1 (chainCallback)
- **v2 resolution:** D5 event system; `node.on('executed'|'connectionChanged'|'sizeChanged')`; DEP1/DEP2 (deprecation warnings)

### P1-2: Two conflicting import styles, no migration path
- Legacy relative imports `../../scripts/app.js`: **142 occurrences**
- Modern `window.comfyAPI`: **26 occurrences**
- No deprecation timeline documented anywhere
- **DB cross-ref:** S6.A1/A2 (app/api import surface), S7.G1 (window globals as ABI)
- **v2 resolution:** D6 parallel paths; `@comfyorg/extension-api` typed imports replace both; DOC1 appendix

### P1-3: Direct DOM manipulation is only way to add custom UI
- 782 `document.createElement`, 364 `document.body.appendChild`, 443 `innerHTML`, 354 `createElement("style")`
- No `extensionManager.injectStyles(css)`, no `addToolbarItem()`, no safe HTML rendering API
- DOM changes in frontend releases routinely break custom nodes
- **DB cross-ref:** S16.DOM1–4 (BC.31), S3.C2 (ContextMenu replacement)
- **v2 resolution:** BC.31 test stubs (I-N4.2); `injectStyles()` in shell extension surface (PKG2)

### P1-4: No frontend tech stack guidance
- Sidebar tabs doc mentions React/Vue but not node widgets
- No explanation that host Vue runtime can be shared
- **DB cross-ref:** S16.VUE1 (BC.32)

### P1-5: Widget serialization contract undocumented
- `widgets_values` ordering not documented — load/save bugs are most common custom node issue
- `onConfigure` patched 16 times specifically to fix deserialization
- **DB cross-ref:** S4.W3, S2.N6 (onSerialize), S2.N15 (prototype.serialize), S2.N7 (onConfigure)
- **v2 resolution:** D7 Part 3 (3-tier persistence) + D7 Part 4 (4→2 serialization collapse)

### P1-6: No official API for execution output
- 88 packages patch `nodeType.prototype.onExecuted` — second most common monkey-patch
- **DB cross-ref:** S2.N3 (`onExecuted` patching)
- **v2 resolution:** `node.on('executed', handler)` in D5 + PKG2 `NodeHandle`

---

## P2 Nice-to-haves (abbreviated — full detail in source)

| ID | Gap | DB cross-ref | v2 resolution |
|----|-----|--------------|---------------|
| P2-1 | No standardized media preview widget | S4.W2 (addDOMWidget) | `addMediaPreview()` — not in current surface |
| P2-2 | `graph._nodes` traversal (no query API) | S11.G2 | `world.queryAll(NodeType)` (D3.5) |
| P2-3 | No undo transaction API | S11.G3 | `world.batch()` |
| P2-4 | Node resize API missing (57 files touch `node.size[]`) | S10.D3, S2.N19 | `node.on('sizeChanged')`, `useNodeSize()` composable |
| P2-5 | No link type registration | S7.G1 | `app.registerLinkType()` — not in current surface |
| P2-6 | Python dependency management opaque | S16 security | Out of scope for this project |
| P2-7 | Cloud compatibility undocumented | — | Out of scope for this project |

---

## Appendix A — New gaps not captured by code-search

These four items emerged from first-principles walkthrough; none are represented in database.yaml as of
2026-05-08. Proposed as new surface family S17 (runtime environment gaps).

### A.1 — App mode surface gap (proposed: S17.AM1)

**What:** ComfyUI has 5 canvas modes (graph / app / builder:inputs / builder:outputs / builder:arrange).
Mode state lives in `appModeStore` (Pinia), only accessible via `useAppMode()` composable — external JS
extensions cannot use Vue composables. No `app.getMode()`, no `node.on('modeChanged')`, no event when
mode transitions.

**Impact:** All custom nodes that want to support both editor and App mode must poll or use heuristics.
Particularly painful because App mode makes the canvas read-only and changes widget resize behavior.

**DB proposed:** S17.AM1 — `appModeStore` inaccessible to extensions
**BC proposed:** BC.33 — App mode surface
**v2 resolution:** Add `node.on('modeChanged', handler)` to `NodeHandle` event surface. Verify:
`NodeModeChangedEvent` is already in `node.ts` but it covers *execution mode* (muted/bypass), not
*canvas mode*. Canvas mode is a separate concept — needs a separate event or `app.on('canvasModeChanged')`.
**Priority for PKG2:** Medium — add `canvasModeChanged` to `NodeHandle` or as app-level event.

### A.2 — Subgraph boundary propagation failure (proposed: S17.SB1)

**What:** Four distinct failures when custom nodes are placed inside subgraphs:
1. `onExecuted` fires on internal node but SubgraphNode does not re-emit — external observers blind
2. `MatchType` freezes type string on initial connection; runtime type changes not propagated to boundary
3. `Autogrow` (new inputs from `onConnectionsChange`) never mirrored to SubgraphNode external slots
4. Promoted widgets: callback still fires on internal node, invisible to external code

**Impact:** Any custom node using dynamic inputs/outputs (autogrow, matchtype, runtime slot changes)
malfunctions inside subgraphs. Documented in `docs/architecture/ecs-lifecycle-scenarios.md` on branch.

**DB proposed:** S17.SB1 — subgraph boundary propagation failure
**BC proposed:** BC.34 — subgraph boundary event propagation
**v2 resolution:** Intersects D9 Phase B (post-Alex rebase) + I-WS (widget promotion). Likely requires
Alex's #11939 ECS substrate before fixable. Tag as `blocked: I-PG.B1`.
Also intersects ADR 0006 (PrimitiveNode copy/paste) and Austin's `fix-linked-widget-promotion` branch.
**Priority for PKG2:** Document as known limitation with `@experimental` tag on affected events.

### A.3 — File / asset API gap (proposed: S17.FA1)

**What:** No unified frontend file management API:
- Each extension manually builds `FormData` and calls `api.fetchApi('/upload/image', ...)` with hardcoded params
- Upload timeout hardcoded at 120s — large 3D/video files fail silently
- File retrieval requires manually constructing `/view?filename=...&type=input&subfolder=...` URLs
- No frontend-side asset browsing, delete, rename
- No temporary file lifecycle management (files in `temp/` never cleaned up by frontend)

**Scale:** 32+ packages implement image preview, 9 implement video — each builds upload/URL helpers
from scratch.

**DB proposed:** S17.FA1 — file/asset API gap
**BC proposed:** BC.35 — file and asset management
**v2 resolution:** `comfyAPI.uploadFile(file, { subfolder, type })` + `comfyAPI.getFileUrl(filename, type, subfolder)`.
Not currently in `NodeHandle` or `shell.ts` surface. May belong in a separate `comfyAPI.assets.*` namespace.
**Priority for PKG2:** Out of scope for node-extension API; belongs in a future `@comfyorg/comfy-api` package.
Flag as gap in `src/extension-api/README.md`.

### A.4 — `widgets_values` positional array serialization (proposed: S17.WV1)

**What:** Widget values are serialized as a positional array (`[value1, value2, value3]`), not a named
dict. Any change to input definitions (add, reorder, rename, remove, required→optional transition) causes
values to misalign when loading existing workflows. This is self-described as **"the #1 source of 'my
workflow stopped working after I updated the custom node' reports."**

Root cause: `widgets_values: [30, 12345, 'test']` instead of `{ seed: 12345, steps: 30, prompt: 'test' }`.
The frontend has `sortWidgetValuesByInputOrder()` in `nodeDefOrderingUtil.ts` but only works when
`input_order` is present — many nodes don't define it.

**DB proposed:** S17.WV1 — `widgets_values` positional serialization fragility
**BC proposed:** BC.36 — widget value serialization positional-vs-named
**v2 resolution:** Directly intersects D7 Part 4 (4→2 serialization collapse). D7's `beforeSerialize`
event gives extension authors a hook to remap values before save. Long-term fix is named dict format —
a breaking change to the workflow JSON schema requiring a migration path (versioning + `migrateWidgetValues`
callback). Tag as `blocked: workflow-schema-migration` — out of v2 surface scope but must be documented.
**Priority for PKG2:** `beforeSerialize` event in `NodeHandle` is the partial mitigation; document the
positional contract clearly in `widget.ts` TSDoc.

---

## DX comparison: Litegraph vs Vue nodes

Key insight from Terry's assessment:

> The Vue system is technically superior in every dimension except documentation and community adoption.
> The DX gap is **100% a documentation and API surface exposure problem, not a technical one.**

| Dimension | Litegraph | Vue nodes | Gap |
|-----------|-----------|-----------|-----|
| Documentation | Partial | **Zero** | Critical |
| Getting started | 30min walkthrough | **None** | Critical |
| Widget creation | `node.addWidget()` simple | `ComponentWidgetImpl` powerful but undoc'd | Critical |
| Type safety | None | Full TS + Zod | Advantage: Vue |
| Reactivity | Manual DOM | Vue reactivity | Advantage: Vue |
| Community examples | Hundreds | ~0 public | Critical |
| Stability | Frozen but fragile | Active, no public contract | Risk |

---

## Action items that map to open tasks

| Finding | Open task |
|---------|-----------|
| 88 `onExecuted` patches | EVT1–EVT3 (implement D5 events) |
| 78+ patching → no widget docs | DEP3 (docs), PKG2 (types) |
| 9 bundled Vue runtimes | I-N4.2 (BC.32 stubs), PKG2 `registerVueWidget` surface |
| App mode gap (A.1) | **New: I-N5.2 (stage S17.AM1) + PKG2 surface check** |
| Subgraph boundary (A.2) | **New: I-N5.2 (stage S17.SB1)** + I-PG.B1 (Phase B, blocked) |
| File/asset gap (A.3) | **New: I-N5.2 (stage S17.FA1)** — future scope |
| `widgets_values` positional (A.4) | **New: I-N5.2 (stage S17.WV1)** + D7 Part 4 + DEP3 |
| No V3 getting-started | DEP3 (docs scope) |
| `window.comfyAPI` migration | D6, DOC1.E6 |
