---
task: R10
date_accessed: 2026-05-08
source_url: file://ComfyUI_frontend/src/types/index.ts,file://ComfyUI_frontend/src/lib/litegraph/src/
sources:
  - ComfyUI_frontend/src/types/index.ts (barrel exports)
  - ComfyUI_frontend/src/lib/litegraph/src/LGraphNode.ts
  - ComfyUI_frontend/src/lib/litegraph/src/LGraph.ts
  - ComfyUI_frontend/src/lib/litegraph/src/LGraphCanvas.ts
  - ComfyUI_frontend/src/lib/litegraph/src/LGraphGroup.ts
  - ComfyUI_frontend/src/lib/litegraph/src/LLink.ts
  - ComfyUI_frontend/src/lib/litegraph/src/Reroute.ts
strategy: Reverse-direction sweeps — walk all exports and prototype methods, flag any not covered by database.yaml patterns.
---

# R10 — Orphan Exports & Unmapped Prototype Methods

Two reverse-direction sweeps: (A) public type barrel exports vs database patterns, (B) LiteGraph prototype methods vs database patterns. Surfaces the "what we export but never tracked" gap.

---

## Part A — `src/types/index.ts` barrel exports

### Methodology

Cross-referenced every named export in `src/types/index.ts` against `database.yaml` pattern `surface`, `fingerprint`, and `semantic` fields. "Covered" = at least one pattern fingerprints the symbol by name.

### Coverage table

| Export | Pattern coverage | `@public_needed` | Notes |
|--------|-----------------|-----------------|-------|
| `ComfyExtension` | S1.H1–H17 (full lifecycle hook family) | YES — already public | Core extension interface; must survive |
| `ComfyApi` | **ORPHAN** | YES | Extensions access `app.api` for fetch, upload, websocket; no pattern covers the type itself (usage is via `window.app` or import) |
| `ComfyApp` | **ORPHAN** | YES | Exported but not a named DB pattern; accessed via `window.app` (S2 through S6 use it implicitly). Needs `/** @public */` |
| `ComfyNodeDef` | S13.SC1 | YES — already public | Heavily used for schema inspection |
| `InputSpec` | **ORPHAN** | YES | Sub-type of ComfyNodeDef; extensions that inspect `input.required[name]` shapes use this type but pattern S13.SC1 doesn't name it explicitly |
| `NodeLocatorId` | S14.ID1 | YES | Parsing/creation helpers covered |
| `NodeExecutionId` | S14.ID1 | YES | Covered |
| `isNodeLocatorId` | **ORPHAN** (function, not type) | MAYBE | Guard function; exported but no pattern fingerprints its use. Likely internal-only; extensions use the type shape, not this guard |
| `isNodeExecutionId` | **ORPHAN** | MAYBE | Same as above |
| `parseNodeLocatorId` | S14.ID1 | YES | Named in pattern |
| `createNodeLocatorId` | S14.ID1 | YES | Named in pattern |
| `parseNodeExecutionId` | **ORPHAN** | MAYBE | Present in code but not fingerprinted separately; pair with `parseNodeLocatorId` — probably safe |
| `createNodeExecutionId` | **ORPHAN** | MAYBE | Same |
| `DOMWidget` | S4.W2 | YES | Core DOM widget type |
| `DOMWidgetOptions` | **ORPHAN** | YES | Options bag for `addDOMWidget`; not fingerprinted as own symbol but extensions definitely pass `DOMWidgetOptions`-shaped objects |
| `EmbeddingsResponse` | **ORPHAN** | NO | Pure API response shape; extensions don't directly import/extend this; type safety for `app.api.getEmbeddings()` return |
| `ExtensionsResponse` | **ORPHAN** | NO | Same — API shape, not extension-facing |
| `PromptResponse` | **ORPHAN** | NO | API response type |
| `NodeError` | **ORPHAN** | MAYBE | Extensions read `NodeError` from execution events; low usage as a type import but present |
| `Settings` | S12.UI3 (indirectly) | YES | Settings schema used by extensions for custom settings registration |
| `DeviceStats` | **ORPHAN** | NO | System monitoring type; no extension use cases |
| `SystemStats` | **ORPHAN** | NO | Same |
| `User` | **ORPHAN** | NO | Auth type; no extension surface |
| `UserData` | **ORPHAN** | NO | Same |
| `UserDataFullInfo` | **ORPHAN** | NO | Same |
| `TerminalSize` | **ORPHAN** | NO | Terminal/server config type; no extension use case |
| `LogEntry` | **ORPHAN** | NO | Server log shape |
| `LogsRawResponse` | **ORPHAN** | NO | Server log shape |
| `SidebarTabExtension` | **ORPHAN** | YES | Extensions register sidebar tabs; S13.SC2-family covers commandManager/extensionManager; this type is the shape extensions pass in. Needs annotation |
| `BottomPanelExtension` | **ORPHAN** | YES | Same reasoning as SidebarTabExtension |
| `ToastManager` | **ORPHAN** | YES | Extensions call `app.extensionManager.toast.*`; the type is the shape they program against |
| `ExtensionManager` | **ORPHAN** | YES | Key extension-facing object; no pattern names the type (patterns name the accessed methods) |
| `CommandManager` | **ORPHAN** | YES | Extensions register commands; same as ExtensionManager |
| `ToastMessageOptions` | **ORPHAN** | MAYBE | Options bag for toast calls; low direct import usage |

### Summary

| Category | Count | Action |
|----------|-------|--------|
| Covered by DB pattern | 8 | No action needed |
| Orphan — `@public_needed: YES` (extension-facing) | 10 | Add `/** @public Used by extensions - preserve */` before `treeshake: true` lands |
| Orphan — `@public_needed: MAYBE` (uncertain usage) | 6 | Check R8 clone excerpts for import usage before deciding |
| Orphan — `@public_needed: NO` (pure API/server shapes) | 9 | Candidates for removal from barrel if `treeshake: true` is re-enabled |

### New patterns to add to database.yaml

Three patterns surface from orphans that should become DB entries (high extension usage, currently untracked as patterns):

| Proposed ID | Symbol | Rationale |
|-------------|--------|-----------|
| **S18.CM1** | `app.extensionManager` / `app.commandManager` / `ExtensionManager` | Extensions register commands, sidebar tabs, bottom panels — these are official extension surfaces not yet pattern-tracked. Likely blast_radius ≥ 3.0 given S13 family evidence |
| **S18.TM1** | `app.extensionManager.toast.*` / `ToastManager` | Toast API is used by many packs for UX; no pattern currently tracks it |
| **S18.DS1** | `DOMWidgetOptions` shape (serialize, computeSize, getMinHeight, etc.) | The options bag for addDOMWidget is richer than S4.W2 suggests; extensions patch `options.serialize`, `options.computeSize`, `options.getMinHeight` |

---

## Part B — LiteGraph prototype methods not in database

### Methodology

Extracted all 2-space-indented method definitions from the six LiteGraph class files. Cross-referenced each against `database.yaml` pattern text. Only methods plausibly callable by extensions (not purely internal rendering machinery) are listed.

### LGraphNode — unmapped methods

| Method | Extension-accessible? | `@public_needed` | Notes / potential new pattern |
|--------|----------------------|-----------------|-------------------------------|
| `addWidget(widget)` | YES — extensions add custom widget instances | YES | Gap pattern: extensions call `node.addWidget(type, name, value, callback)` directly (distinct from `addDOMWidget`). Positional API. Should be S4.W-class |
| `removeWidget(widget)` | YES | YES | Paired with addWidget |
| `clone()` | YES — copy-paste lifecycle | YES | Covered partially by ADR 0006 findings (I-NEW.1) but no DB pattern. Node clone fires before `configure()` — extensions that hook `onConfigure` miss clone |
| `setProperty(name, value)` | YES — extensions set node properties | YES | Pattern gap: alternative to `node.properties[key] = val` mutation; v2 should have `NodeHandle.setProperty()` |
| `changeMode(mode)` | YES — extensions change node mute/bypass state | YES | Missing pattern for mute/bypass API. Used by Manager, rgthree |
| `captureInput(v)` | INTERNAL — canvas pointer capture | NO | Rendering internal |
| `doExecute(param, options)` | INTERNAL — execution engine | NO | Not extension-callable |
| `actionDo(action, param)` | INTERNAL — slot trigger | NO | Not typically extension-callable |
| `collapse(force?)` | YES — extensions toggle node collapsed state | MAYBE | Low DB evidence but used by some UI extensions |
| `pin(v?)` / `unpin()` | MAYBE — UI utility | MAYBE | Used by some packs for layout purposes |
| `isSubgraphNode()` | YES — extensions check if inside subgraph | YES | Missing pattern; important for S17.SB1 subgraph boundary propagation bug |
| `setPos(x, y)` | YES — layout, rarely direct | MAYBE | Extensions occasionally reposition nodes |
| `setSize(v)` | YES — layout | MAYBE | Some packs resize nodes dynamically |
| `getInputData(slot)` | YES — execution-path data read | YES | Extensions read input data in `onExecuted` etc.; gap in DB |
| `getOutputData(slot)` | YES — same | YES | Same |
| `setOutputData(slot, data)` | YES — execution output mutation | YES | Pattern gap for S15-adjacent surface |
| `triggerSlot(slot, param)` | YES — trigger/action nodes | YES | Extensions build trigger nodes that call this; missing pattern |
| `findInputSlot(name)` / `findOutputSlot(name)` | YES — slot lookup by name | YES | Used for dynamic connection code |
| `drawWidgets`, `drawBadges`, `drawSlots`, `drawTitleBarBackground`, etc. | INTERNAL — canvas rendering | NO | Purely rendering; not extension-callable API |
| `computeSize()` | SEMI — extensions override this | MAYBE | Some packs override `computeSize` prototype method; related to S2.N7 |
| `getBounding()` | SEMI — layout queries | MAYBE | Used in canvas-overlay extensions |
| `isWidgetVisible(widget)` | INTERNAL | NO | |
| `getWidgetOnPos(x, y)` | INTERNAL — canvas hit detection | NO | |
| `getSlotFromWidget`, `getWidgetFromSlot` | INTERNAL | NO | |
| `toggleAdvanced()` | UI utility | MAYBE | Low usage |
| `localToScreen(x, y, dnd)` | UI utility for overlays | MAYBE | DOM-widget positioning code may call this |
| `updateComputedDisabled()` | INTERNAL | NO | |
| `connectInputToOutput()` | YES — bypass node pattern | YES | Used by bypass/reroute extensions; currently not fingerprinted |
| `findConnectByTypeSlot(dir, type)` | YES — auto-connect helpers | MAYBE | Used in some "auto-wire" packs |
| `move(dx, dy, skip_comfy?)` | INTERNAL | NO | |
| `trace(msg)` | DEBUG — dev utility | NO | |
| `toString()` | Standard JS | NO | |

### LGraph — unmapped methods

| Method | Extension-accessible? | Notes |
|--------|-----------------------|-------|
| `add(node)` | YES — extensions add nodes dynamically | Gap: extensions call `app.graph.add(node)` regularly; S2.N1 covers `nodeCreated` but not the `add()` call site itself |
| `remove(node)` | YES | Pair with `add()` |
| `clear()` | SEMI — rare | Low usage |
| `clone()` | INTERNAL — graph copy | NO |
| `computeExecutionOrder()` | INTERNAL | NO |
| `attachCanvas(canvas)` | INTERNAL | NO |
| `createReroute(...)` | Covered by S9.R1 | — |
| `createSubgraph(...)` | YES — subgraph creation | Gap: relates to S17.SB1; extensions may call this or observe it |
| `convertToSubgraph(nodes)` | INTERNAL | NO |
| `addFloatingLink(...)` | INTERNAL | NO |
| `checkNodeTypes()` | INTERNAL | NO |
| `beforeChange()` / `afterChange()` | YES — undo/redo boundary | Gap: extensions call these to wrap multi-node mutations for undo/redo correctness; currently no pattern |

### LGraphCanvas — unmapped highlights

(Only a few are extension-accessible; most are internal canvas rendering)

| Method | Notes |
|--------|-------|
| `bringToFront(node)` / `sendToBack(node)` | Z-order; extensions occasionally reorder nodes |
| `deleteSelected()` | Extensions trigger from custom UI |
| `selectNodes(nodes)` / `deselectAllNodes()` | Selection API; some packs programmatically select nodes |
| `copyToClipboard()` / `pasteFromClipboard()` | Extensions integrate with custom clipboard logic |

### LLink — unmapped

All methods (`asSerialisable`, `configure`, `serialize`, `disconnect`, `resolve`, `toFloating`) are internal link management. Not directly called by extensions as surface patterns — links are accessed through node input/output slot APIs.

### LGraphGroup — unmapped

`addNodes`, `recomputeInsideNodes`, `resizeTo` are internal group management. `getBounding`, `move`, `serialize` partially covered by S9.G1 (LGraphGroup patching).

### Reroute — unmapped

S9.R1 covers reroute creation. The remaining methods (`calculateAngle`, `containsPoint`, `getFloatingLinks`, `getReroutes`, `findSourceOutput`, `findTargetInputs`, etc.) are internal reroute geometry.

---

## New patterns to add to database.yaml

From the Part B analysis, these are the most impactful gaps:

| Proposed ID | Surface | Mechanism | Priority |
|-------------|---------|-----------|----------|
| **S2.N20** | `node.addWidget(type, name, value, callback)` direct call | constructor/setup direct call | HIGH — addWidget is fundamental; estimated blast_radius ~4.0 based on S4.W family |
| **S2.N21** | `node.getInputData(slot)` / `getOutputData(slot)` in execution hooks | direct method call in `onExecuted` | MEDIUM — used in output-passthrough patterns (ADR 0007) |
| **S2.N22** | `node.triggerSlot(slot, param)` / `trigger(action, param)` | direct method call | MEDIUM — trigger/action node pattern |
| **S2.N23** | `node.changeMode(mode)` for mute/bypass | direct method call | MEDIUM — Manager-pattern mute |
| **S2.N24** | `node.isSubgraphNode()` conditional | runtime type check | MEDIUM — subgraph awareness gap S17.SB1 |
| **S2.N25** | `graph.add(node)` / `graph.remove(node)` dynamic node manipulation | direct method call | HIGH — complement to S2.N1 nodeCreated |
| **S2.N26** | `graph.beforeChange()` / `graph.afterChange()` undo boundary wrapping | direct method call | MEDIUM — mutation grouping for undo/redo |
| **S18.CM1** | `app.extensionManager` / `CommandManager` type usage | official API object | HIGH — extension registration surface |
| **S18.TM1** | `app.extensionManager.toast.*` | official API method | HIGH — UX surface used broadly |
| **S18.DS1** | `DOMWidgetOptions.serialize` / `computeSize` / `getMinHeight` callbacks | options bag callback | MEDIUM — richer than S4.W2 captures |

---

## Action items

1. **Add `/** @public Used by extensions - preserve */`** to these `src/types/index.ts` exports before `treeshake: true` re-enable: `ComfyApi`, `ComfyApp`, `InputSpec`, `DOMWidgetOptions`, `SidebarTabExtension`, `BottomPanelExtension`, `ToastManager`, `ExtensionManager`, `CommandManager` (9 exports).

2. **Stage S2.N20–N26 and S18.CM1/TM1/DS1 into database.yaml** — use `scripts/add-evidence.py` with `source: reverse-direction-sweep`. Minimum: S2.N20 (addWidget), S2.N25 (graph.add/remove), S18.CM1 (extensionManager).

3. **Check R8 excerpts** for `isNodeLocatorId`, `isNodeExecutionId`, `parseNodeExecutionId`, `createNodeExecutionId` import usage before deciding `@public_needed`. These helper functions may be internal-only.

4. **Deprecation candidates** (safe to remove from barrel if treeshake re-enabled): `EmbeddingsResponse`, `ExtensionsResponse`, `PromptResponse`, `DeviceStats`, `SystemStats`, `User`, `UserData`, `UserDataFullInfo`, `TerminalSize`, `LogEntry`, `LogsRawResponse` — pure API/server response shapes; no extension import use found.
