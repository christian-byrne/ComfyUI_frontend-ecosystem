---
source: in-house (no external URL — synthesized from R4 + database.yaml + meeting transcript)
date_accessed: 2026-05-06
created: 2026-05-06
purpose: Plan + schema for the canonical touch-point database
status: active
---

# Touch-Point Database — Plan

## Why we are building this

The v2 extension API redesign (P1, D3.x) and the eventual test framework need a **shared evidence layer**: every API surface that real-world extensions touch, frequency-weighted by usage, with citations to verify. Without this, two failure modes are guaranteed:

1. **Silent regressions in v2.** Surfaces we don't know about can't be re-implemented or formally deprecated. The v2 service ships, big custom-node packs break, ComfyUI looks unstable.
2. **Test framework with the wrong floor.** Tests that don't reflect real extension shapes will pass v2 while production extensions break.

The database is the input for:
- v2 API gap analysis (D4 G1–G13, plus future Gs surfaced here)
- Test framework design (widget-api-thoughts.md "Test Framework" section): every entry maps to ≥1 test case
- Migration guide writing (P3, DEP3, DEP4)
- "What can we actually delete" decisions (e.g., R4 found `loadedGraphNode` has 1 real call site)

## What the v2 POC shipped (CONTEXT for the audit)

There are 5 untracked v2 files in `ComfyUI_frontend` worktree (proof-of-concept):

- `src/types/extensionV2.ts` — `NodeHandle`, `WidgetHandle`, `defineNodeExtension`, `defineWidgetExtension` interfaces
- `src/services/extensionV2Service.ts` — scope registry, reactive mount system, handle factories (with inline open-question comments)
- `src/extensions/core/dynamicPrompts.v2.ts` — POC migration
- `src/extensions/core/imageCrop.v2.ts` — POC migration (13→12 lines)
- `src/extensions/core/previewAny.v2.ts` — POC migration (90→35 lines)

**Open questions left in v2 service comments** (touch-points must answer these):
- `setLabel` — special vs just an option? `setHidden` — same?
- `on('change')` watches `WidgetValue.value` only — how do extensions watch options/props?
- `setSerializeValue` callback — should be `on('serialize')` or `onBeforeSerialize`?
- Get/set vs getters/setters — should NodeHandle expose `get pos()` accessors?
- `getProperties` — current `properties` bag is heavily used by extensions for "persist across teardown"; v2 must verify that pattern still works
- `addWidget` returns by what mechanism? sync dispatch? promise?
- Widget figler tree / coverage report of "strangler-figged vs re-implemented vs unsupported"

These open questions become *test cases*: for each, the database tells us how many extensions in the wild touch the underlying surface.

## Comprehensive surface enumeration

The audit covers **8 surface families**. Each family contains specific patterns to search for.

### S1 — `ComfyExtension` lifecycle hooks (17 hooks)

From `src/types/comfy.ts`, lines 144-266:

| Hook | Core extension files using it | Replacement direction |
|---|---:|---|
| `init` | 16 | unchanged in v2 (ExtensionOptions.init) |
| `setup` | 3 | unchanged in v2 (ExtensionOptions.setup) |
| `addCustomNodeDefs` | 1 | unknown — may need v2 registration API |
| `getCustomWidgets` | 4 | replaced by `defineWidgetExtension` |
| `beforeRegisterNodeDef` | 10 | replaced by `nodeTypes` filter + `inspectNodeDef` (G1) |
| `beforeRegisterVueAppNodeDefs` | 0 | candidate for removal |
| `registerCustomNodes` | 3 | NO v2 equivalent (D4-G2 BLOCKER) |
| `loadedGraphNode` | 0 (core), 1 (entire wild corpus) | candidate for removal |
| `nodeCreated` | 12 | `defineNodeExtension({ nodeCreated })` |
| `beforeConfigureGraph` | 1 | needs decision — graph lifecycle hook |
| `afterConfigureGraph` | 0 | candidate for removal |
| `getSelectionToolboxCommands` | 0 | candidate for removal |
| `getCanvasMenuItems` | 4 | EXISTS — replaces canvas right-click monkey-patching |
| `getNodeMenuItems` | 4 | EXISTS — replaces node right-click monkey-patching (P6 in R4) |
| `onAuthUserResolved` | 1 | unchanged |
| `onAuthTokenRefreshed` | 1 | unchanged |
| `onAuthUserLogout` | 1 | unchanged |

### S2 — `LGraphNode.prototype` methods commonly patched

Already-confirmed (R4): `onNodeCreated`, `onExecuted`, `onConnectionsChange`, `onRemoved`, `getExtraMenuOptions`, `convertWidgetToInput`, `onGraphConfigured`, `onConfigure`, `onInputDblClick`.

Add to search: `onAdded`, `onSerialize`, `onDeserialize`, `onDrawForeground`, `onDrawBackground`, `onSelected`, `onDeselected`, `onMouseDown`, `onMouseEnter`, `onMouseLeave`, `onDblClick`, `onPropertyChanged`, `onWidgetChanged`, `onResize`, `onAction`, `onConnectInput`, `onConnectOutput`, `onConfigure`, `onWorkflowConfigure`, `onConnectionsChange`, `onConfigure`, `onCreate`, `clone`, `computeSize`.

### S3 — `LGraphCanvas.prototype` methods commonly patched

Confirmed (R4 P7): `processKey`, `processContextMenu`, `computeVisibleNodes`. Our own core: `processMouseDown`, `processMouseMove` (simpleTouchSupport.ts).

Add to search: `drawNode`, `drawNodeShape`, `drawConnections`, `onMouseDown`, `onDblClick`, `getCanvasMenuOptions`, `getNodeMenuOptions`, `getGroupMenuOptions`, `processNodeWidgets`, `selectNodes`, `deselectAllNodes`, `setSelectedNodes`.

### S4 — Widget-level patterns (the heart of widget-api-thoughts.md)

- `.callback` chaining (R4 P1) — the dominant value-change pattern
- `.value` direct reads/writes (R4 evidence: imageCompare, widgetInputs, customWidgets, saveImageExtraOutput)
- `.serializeValue` assignment (dynamicPrompts.v2 uses it)
- `.options.*` direct mutation
- `.computedHeight`, `.y`, `.last_y` — layout-level reads
- `.options.values` — combo widget values
- `.options.serialize`, `.options.hidden`, `.options.readonly` — option flags
- Custom widget types declared via `getCustomWidgets`
- `addDOMWidget(name, type, element, options)` — DOM widget contribution (R4 P9)

**Widget thoughts file flags lifecycle dependencies** (widget-api-thoughts.md:25-30):
- 3D widgets: file uploads
- Webcam widgets: heavy perf
- Webcam widgets: lifecycle-dependent serialization
- Widgets whose post-serialize value depends on lifecycle steps

These need explicit DB entries with `lifecycle_dependent: true` flag.

### S5 — `ComfyApi` / `app.api` event surfaces

Confirmed (R4 P8): `addEventListener('executed', …)`, custom `'extName.eventName'` events.

Add to search: `addEventListener('executing', …)`, `'progress'`, `'progress_state'`, `'status'`, `'reconnecting'`, `'reconnected'`, `'execution_start'`, `'execution_success'`, `'execution_error'`, `'execution_cached'`, `'b_preview'`, `'logs'`.

### S6 — `ComfyApp` god-object touch points

- `app.graph` — direct LiteGraph object access
- `app.canvas` — direct LGraphCanvas access
- `app.canvasManager` — newer wrapper
- `app.queuePrompt` — submit a workflow
- `app.graphToPrompt` — serialize current graph to API payload
- `app.loadGraphData` — load a workflow JSON
- `app.extensionManager` — ExtensionManager registry access
- `app.api` — see S5
- `app.getNodeDefs` — node definition registry
- `app.registerExtension` — the entry point itself
- `app.ui` — legacy UI shim

### S7 — Window / global escape hatches

- `window.app` — escape hatch documented in index.ts
- `window.graph` — escape hatch documented in index.ts
- `window.LiteGraph` — direct LiteGraph access
- `window.LGraphCanvas` — direct canvas class access
- `window.comfyAPI.modules[...]` — production-only shim mechanism (per extension-development-guide.md)

### S8 — Special node properties (magic flags)

- `nodeType.prototype.isVirtualNode` (R4 P10) — virtual node flag
- `nodeType.prototype.serialize_widgets` — serialization toggle
- `nodeType.prototype.color`, `bgcolor` — visual override
- `nodeType.prototype.shape` — node shape override
- `nodeType['@<input>']` — input-type metadata (Eclipse pattern)
- `nodeType.category` — menu category override

### S9 — Non-Node entity kinds (per ADR 0008)

ADR 0008 enumerates **six** entity kinds; the bulk of the ecosystem touches more than just `Node` and `Widget`. These touch points are largely undocumented in the v1 extension API.

- **Reroute** (`Reroute`, `RerouteId`) — `LiteGraph.createRerouteOnLink`, `graph.reroutes`, `node.connectByRerouteId`
- **Group** (`LGraphGroup`) — `graph.groups`, `group.color`, `group.font`, `group.font_size`, `group.children`
- **Link** (`LLink`, `LinkId`) — `link.color`, `link._pos`, `link._dragging`, `link.data`
- **Slot** (`SlotBase` / `INodeInputSlot` / `INodeOutputSlot`) — `slot.color_on/_off`, `slot.shape`, `slot.dir`, `slot.localized_name`
- **Subgraph virtual nodes** — set/get virtual node trick (KJNodes), `nodeType.isVirtualNode = true` (S8) coupled with `graphToPrompt` rewriting (S6.A1)

### S10 — Dynamic node API (slot/connection mutation at runtime)

- `node.addInput(name, type)` / `node.removeInput(slot)` — runtime input mutation (typically inside `onConnectionsChange`)
- `node.addOutput(name, type)` / `node.removeOutput(slot)` — runtime output mutation
- `node.connect(srcSlot, target, dstSlot)` / `node.disconnectInput(slot)` / `node.disconnectOutput(slot)` — programmatic linking
- `node.findOutputSlot(name)` / `node.findInputSlot(name)` — slot lookup by name
- `node.setDirtyCanvas(true, true)` — force redraw (extremely common after any mutation)
- `node.collapse()` / `node.setSize([w,h])` — imperative geometry

### S11 — Graph-level state and change-tracking

- `graph._version++` and `graph._version` reads — change-tracking signal **(project AGENTS.md §5: affects 40+ repos)**
- `graph.add(node)` / `graph.remove(node)` / `graph.findNodesByType(type)` / `graph.findNodeById(id)`
- `graph.serialize()` / `graph.configure(json)` — full-graph serialization (related to S6.A1 graphToPrompt but distinct)
- `graph.beforeChange()` / `graph.afterChange()` — explicit batching seam
- `graph.onNodeAdded` / `graph.onNodeRemoved` / `graph.onNodeConnectionChange` — graph-level callbacks (vs per-node)

### S12 — Shell UI registries (sidebar / bottom panel / commands / toasts)

These are *declarative* surfaces in v1 (extensions push registrations) but their semantics are still public API. Migration must preserve names and contracts.

- `extensionManager.registerSidebarTab(...)` — `SidebarTabExtension`
- `extensionManager.registerBottomPanelTab(...)` — `BottomPanelExtension`
- `commandManager.registerCommand(...)` — `CommandManager`
- `toastManager.add(...)` / `toastManager.remove(...)` — `ToastManager`
- `app.registerExtension({ settings: [...] })` — Settings system contributions
- `app.registerExtension({ keybindings: [...] })` — Keybinding contributions
- `app.registerExtension({ commands: [...], menuCommands: [...] })` — Menu/command contributions

### S13 — Schema interpretation (`ComfyNodeDef` / `InputSpec`)

Extensions inspect the node-def schema directly to drive UI/behavior — this is a public API by accident.

- `nodeData.input.required` / `nodeData.input.optional` / `nodeData.input.hidden` — input bag inspection
- `nodeData.output[]` / `nodeData.output_name[]` / `nodeData.output_is_list[]` — output schema inspection
- `nodeData.output_node` — special "output node" boolean flag
- `nodeData.category` / `nodeData.python_module` — origin metadata
- `InputSpec` sentinel objects — `["INT", { default, min, max, step }]`, `["STRING", { multiline }]`, `["COMBO", { values, default }]`, `["IMAGEUPLOAD", {...}]`, etc.

### S14 — Identity / Locator scheme

- `NodeLocatorId` — encodes `(graphScope, nodeId)` for cross-subgraph references
- `NodeExecutionId` — backend execution-graph identifier
- `parseNodeLocatorId` / `createNodeLocatorId` / `isNodeLocatorId` — public helpers exported from `src/types/index.ts`
- Implicit pattern: extensions resolve "node X in subgraph Y" — must work after subgraph promotion

### S15 — Output system (per `widget-api-thoughts.md`)

`widget-api-thoughts.md` flags this as a separate change axis from widgets:

- Dynamic output mutation via `node.addOutput` / `node.removeOutput` (cross-references S10)
- Schema-declared outputs (preferred end-state) — `OUTPUT_TYPES`-style explicit declaration
- `nodeData.output_node` flag — node is a terminal/sink
- `node.onExecuted({ images: [...] })` — output-display pattern (cross-references S2.N2)
- "Force declaration" goal: extensions must declare output types in the node schema, not mutate at runtime

## Database schema

Each entry is a YAML record:

```yaml
- pattern_id: P1.1                              # stable ID for cross-reference
  surface_family: S4                            # S1-S8
  surface: "widget.callback assignment"         # human-readable name
  fingerprint: 'w.callback = function(v) {...}' # regex-ish
  semantic: "subscribe to widget value change"  # what extensions are *trying* to do
  v2_replacement: "widget.on('change', fn)"     # proposed
  decision_ref: D3.3                            # which decision doc covers it
  test_target: WIDGET_VALUE_CHANGE_LISTENER     # test framework symbol
  evidence:
    - repo: crom8505/ComfyUI-Dynamic-Sigmas
      file: web/js/graph_sigmas.js
      lines: [79, 80]
      url: https://github.com/crom8505/ComfyUI-Dynamic-Sigmas/blob/main/web/js/graph_sigmas.js#L79
      stars: 12                                  # github stars (cached, asof date)
      stars_asof: 2026-05-06
      variant: canonical                         # canonical | unsafe | with-bind | tempCallback-swap | per-instance | prototype
      breakage_class: silent                     # silent | loud | undefined-behavior | crash
      notes: "fourteen instances in same file"
  derived:
    occurrences: 7                               # rolled up from evidence
    repos_touched: 5
    cumulative_stars: 245
    canonical_signatures: 1                      # how many distinct shapes seen (P4 had 6 for onConnectionsChange!)
    breakage_classes: [silent, undefined-behavior]
    blast_radius: 3.2                            # see formula
```

## Blast-radius scoring formula

Goal: rank patterns by how disruptive their breakage would be in v2 rollout.

```
blast_radius = 0.40 * log10(1 + cumulative_stars)
             + 0.20 * log10(1 + occurrences)
             + 0.15 * canonical_signatures        # more shapes = more migration cases to support
             + 0.15 * silent_breakage_weight      # silent > loud > crash for danger
             + 0.10 * lifecycle_coupling          # 0/1/2; widgets that break on serialize timing get 2
```

Where:
- `silent_breakage_weight` = max over evidence: silent=1.0, undefined=0.6, loud=0.3, crash=0.2
- `lifecycle_coupling` = 0 (none) | 1 (depends on init/teardown order) | 2 (depends on serialization-timing or DOM-mount-timing)

Rationale:
- `log10` on stars + occurrences damps mega-popular packs from drowning out long-tail diversity
- Silent breakage scores higher than loud — these are the ones that destroy trust
- Lifecycle coupling captures widget-api-thoughts.md concerns (3D, webcam)
- Canonical signatures captures "the API has no schema" risk (R4 P4 with 6 sigs)

A blast_radius ≥ 3.0 = MUST have a v1-compat shim or the migration story breaks.

## Star-fetching strategy

For each unique repo:
```bash
gh api "repos/<owner>/<name>" --jq '.stargazers_count'
```

Cache in `research/touch-points/star-cache.yaml`:
```yaml
- repo: crom8505/ComfyUI-Dynamic-Sigmas
  stars: 12
  asof: 2026-05-06
```

Refresh quarterly. If gh CLI errors (rate limit, repo gone), record `stars: null` and `error: <reason>`.

## Workflow

1. **Plan + schema (this doc)** ✅
2. **Build initial database** — start with the 12 patterns from R4, structured properly
3. **Sweep S1–S8 systematically** — batched code search, populate evidence
4. **Star fetch pass** — `gh api` for every unique repo, populate cache
5. **Compute derived fields** — script that rolls up evidence into derived metrics
6. **Generate ranked report** — `database-by-blast-radius.md`
7. **Map to test framework** — each pattern_id → test symbol

## Dispatch strategy for queries

- ~50 queries needed across S1–S8 (each surface gets 1-3 queries)
- Run in parallel batches of 4-6 (MCP tolerates this if no DNS error)
- Retry failed queries with 3-token reformulations (R4 workaround)
- After each batch: append findings to `database.yaml`, never overwrite
- After full sweep: run star-fetch script, run roll-up script

## Integration with the test framework

Each pattern in the database becomes a test triple:

1. **v1 contract test** (legacy): proves the v1 hook still works for shimmed extensions
2. **v2 contract test** (new): proves the v2 replacement covers the same semantic
3. **Migration test**: takes a real extension snippet from evidence, confirms it works in v2 (or fails with a documented compat error)

The test framework's "compatibility floor" is: every blast_radius ≥ 2.0 entry MUST pass all three tests before v2 ships.

## Out of scope (deferred)

- Sandboxing model (Chrome-extension-style isolation): noted in CONTEXT.md, deferred
- Performance benchmarks vs v1: separate workstream
- Documentation generation from the database: separate workstream
- npm package design for `@comfyui/extension-api`: separate workstream (per R4 P11 finding)
