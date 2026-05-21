# D13 — ECS Alignment Audit

> Status: **draft** — living document, updated as ECS branch evolves
> Last updated: 2026-05-13
> ECS branch: `drjkl/world-combo` (PR #11939, stacked on #11706)

This document tracks misalignments between the extension API v2 design
(Phase A) and the actual ECS implementation on the `world-combo` branch.
The goal is to catch integration issues before Phase B rebase.

---

## 1. Entity ID Format

### Current State

| Layer | Format | Example |
|-------|--------|---------|
| ADR 0008 spec | `number & { __brand }` | `42 as NodeEntityId` |
| ECS slice-1 impl | content-addressed string | `node:${graphId}:${nodeId}` |
| Extension API v2 | imports from `@/world/entityIds` | same as ECS impl |
| Proposed future | opaque UUIDs + identity components | `crypto.randomUUID()` |

### Misalignment

The ECS team is planning to migrate from content-addressed strings to
opaque UUIDs (see `docs/architecture/entity-id-strategy.md` on the branch).
This migration will:

1. Replace `widgetEntityId(g, n, w)` with `mintWidgetId()` (UUID)
2. Move identity data (`graphId`, `nodeId`, `name`) into `WidgetBelongsTo` component
3. Delete `parseWidgetEntityId` regex (which has a colon-collision bug)

### Impact on Extension API

- **Test fixtures**: Our tests use IDs like `node:graph-test:1` — will break
- **Type imports**: `NodeEntityId`/`WidgetEntityId` brands will change from `string` to `string` (UUIDs) — compatible
- **Handle constructors**: If we cache entity IDs, UUID migration is transparent

### Action Items

- [ ] Add migration note to test fixtures
- [ ] Verify `NodeHandle.entityId` / `WidgetHandle.entityId` are opaque to consumers
- [ ] Track UUID migration PR for Phase B timing

---

## 2. SlotEntityId Gap

### Current State

| Layer | Slot Identity |
|-------|---------------|
| ADR 0008 spec | `SlotEntityId = number & { __brand }` |
| ECS slice-1 impl | **No slot entities** — slots identified by `(nodeId, direction, index)` |
| Extension API v2 | `SlotEntityId = number & { __brand: 'SlotEntityId' }` |

### Misalignment

Our `SlotInfo` interface has:
```ts
interface SlotInfo {
  readonly entityId: SlotEntityId  // <-- doesn't exist in ECS
  readonly name: string
  readonly type: string
  readonly direction: SlotDirection
  readonly nodeEntityId: NodeEntityId
}
```

But the ECS branch has no `SlotEntityId` type or slot entity registration.
Slots are still arrays on `LGraphNode.inputs[]` / `outputs[]`.

### Impact on Extension API

- `SlotInfo.entityId` has no backing data source
- Cannot use slot entity IDs in ECS queries
- Phase B will need to either:
  - (a) Mint synthetic slot IDs from `(nodeId, direction, index)`
  - (b) Wait for ECS slot entity migration (per entity-id-strategy.md §6.2)
  - (c) Remove `entityId` from `SlotInfo` and use index-based identity

### Resolution (2026-05-13 Slack discussion)

Alex confirmed:
- Slots **should** have entity IDs (not just `(nodeId, direction, index)`)
- Long-term: opaque UUIDs (branded UUIDs or nanoid for nicer deep links)
- Short-term: compound content-addressed strings for migration/legacy compatibility
- Numeric IDs risk conflicts — prefer string-based

**Decision**: Keep `SlotEntityId` as a branded string. Phase A uses synthetic content-addressed
format `slot:${nodeId}:${direction}:${index}`. Phase B migrates to UUIDs when ECS adds slot
entity support.

### Action Items

- [x] ~~Decide: keep `SlotEntityId` as synthetic or remove from `SlotInfo`~~ — KEEP (synthetic for now)
- [x] ~~If synthetic: define minting strategy~~ — `slot:${nodeId}:${direction}:${index}`
- [ ] Track ECS slot entity migration timeline (blocked on ECS team)

---

## 3. Widget State Components

### Current ECS Component Split

From `src/world/widgets/widgetComponents.ts`:

```ts
WidgetComponentValue    = { value: unknown }
WidgetComponentDisplay  = { label: string, disabled: boolean }
WidgetComponentSchema   = { type: string, options: IWidgetOptions }
WidgetComponentSerialize = { serialize: boolean }
```

### Extension API Assumptions

| API Method | Assumed Backing |
|------------|-----------------|
| `getValue()` / `setValue()` | `WidgetComponentValue.value` |
| `isDisabled()` / `setDisabled()` | `WidgetComponentDisplay.disabled` |
| `label` (readonly) | `WidgetComponentDisplay.label` |
| `widgetType` (readonly) | `WidgetComponentSchema.type` |
| `getOption()` / `setOption()` | `WidgetComponentSchema.options` |
| `isSerializeEnabled()` | `WidgetComponentSerialize.serialize` |
| **`isHidden()` / `setHidden()`** | **??? — not in components** |

### Misalignment: `hidden` State

The `hidden` flag is NOT a first-class component field. It lives in:
- `widget.options.hidden` (instance property)
- Not persisted to ECS components

Our API assumes `setHidden()` dispatches a command and triggers reactive
updates. But the ECS has no `WidgetComponentDisplay.hidden` field.

### Options Architecture (needs clarification)

**Question from user**: Current widgets seem to just take all options and
set them on the instance property via direct `Object.assign`. Is this accurate?

**Investigation needed**:
- [ ] Confirm: does `addWidget()` do `Object.assign(widget, options)`?
- [ ] Where does `hidden` live at runtime? `widget.hidden` or `widget.options.hidden`?
- [ ] Is there any ECS backing for per-widget options, or is it all instance properties?
- [ ] Does `WidgetComponentSchema.options` round-trip the full options bag?

### Impact on Extension API

If `hidden` is just an instance property with no ECS backing:
- `setHidden()` cannot dispatch a command (no undo/redo)
- `on('propertyChange')` for `hidden` has no reactive source
- Phase B shim needs to mutate `widget.hidden` directly

### Action Items

- [x] ~~Clarify options assignment architecture~~ — see §3.1 (DONE)
- [x] ~~Fix upstream: canvas renderer should check `options.hidden`~~ — DONE: `BaseWidget.hidden` now proxies to `options.hidden` (ADR 0010). Both Vue and canvas renderers see the same value.
- [x] ~~Decide: add `hidden` to `WidgetComponentDisplay` OR use dual-write shim~~ — DONE: Proxy approach chosen (ADR 0010). `widget.hidden` is now a getter/setter that reads/writes `options.hidden`.
- [x] ~~Update `WidgetHandle.setHidden()` implementation strategy~~ — DONE: Implementation unchanged, underlying fix in BaseWidget ensures consistency.

---

## 3.1 Widget Options Deep Dive

> Status: **INVESTIGATED** — findings complete, action items derived

### Answer to User Question

**Q**: Current widgets seem to just take all options and set them on the instance property via direct `Object.assign`. Is this accurate?

**A**: Partially. The `BaseWidget` constructor does:

```ts
// src/lib/litegraph/src/widgets/BaseWidget.ts:154-206

constructor(widget: TWidget & { node: LGraphNode }, node?: LGraphNode) {
  this._node = node ?? widget.node

  // 1. Direct reference assignment for core fields
  this.name = widget.name
  this.options = widget.options  // <-- direct reference, NOT copy
  this.type = widget.type

  // 2. Destructure to extract "unsafe" keys
  const {
    node: _, label, disabled, value, linkedWidgets,
    // ... color overrides filtered out
    ...safeValues
  } = widget

  // 3. Spread remaining props onto instance
  Object.assign(this, safeValues)  // <-- includes `hidden` if present

  // 4. Create ECS-tracked state
  this._state = {
    name: this.name,
    type: this.type,
    value,
    label,
    disabled: disabled ?? false,
    serialize: this.serialize,
    options: this.options  // <-- same reference again
  }
}
```

**Key insight**: `options` is a **direct reference**, not a copy. Mutations to
`widget.options.foo` are visible everywhere that holds the same reference.

### The Dual `hidden` Problem

`hidden` exists in TWO places with DIFFERENT consumers:

| Location | Declared | Read By | Written By |
|----------|----------|---------|------------|
| `widget.hidden` | `BaseWidget` line 99 | LGraphNode.ts:3926, NodeWidgets.vue:27 | Object.assign spread |
| `widget.options.hidden` | `IWidgetOptions` | useProcessedWidgets.ts:155, useGraphNodeManager.ts:225 | painter.ts, previewAny.ts |

**The bug**: Setting `widget.options.hidden = true` hides the widget in Vue
renderer but NOT in canvas renderer (which checks `widget.hidden`).

### Evidence from Codebase

**Canvas renderer** — checks instance property:
```ts
// LGraphNode.ts:3926
this.collapsed || widget.hidden || (widget.advanced && !this.showAdvanced)
```

**Vue renderer** — checks options bag:
```ts
// useProcessedWidgets.ts:151-157
export function isWidgetVisible(options: IWidgetOptions, showAdvanced: boolean): boolean {
  const hidden = options.hidden ?? false
  const advanced = options.advanced ?? false
  return !hidden && (!advanced || showAdvanced)
}
```

**Extensions write to options**:
```ts
// painter.ts:18
widget.options.hidden = true

// previewAny.ts:51-66
showValueWidget.options.hidden = !value
showValueWidgetPlain.options.hidden = value
```

### ECS Backing Analysis

The `WidgetState` stored in ECS includes `options`:
```ts
this._state = {
  // ...
  options: this.options  // same object reference
}
```

So mutations to `widget.options.hidden` ARE visible to Vue reactivity (via
`widgetValueStore.getWidget()`), but the **instance property** `widget.hidden`
has NO ECS backing and NO reactivity.

### Runtime Shape Summary

| Property | Lives On | ECS Tracked | Reactive |
|----------|----------|-------------|----------|
| `widget.value` | `_state.value` (getter/setter) | Yes | Yes |
| `widget.disabled` | `_state.disabled` (getter/setter) | Yes | Yes |
| `widget.label` | `_state.label` (getter/setter) | Yes | Yes |
| `widget.hidden` | instance property | **No** | **No** |
| `widget.options.hidden` | options bag (reference) | Yes (via `_state.options`) | Yes |

### Implications for Extension API

1. **`WidgetHandle.setHidden()`** cannot dispatch a command for the instance
   property — there's no ECS component to update.

2. **Option A**: Route through `options.hidden` only
   - Pros: ECS-backed, reactive, Vue works
   - Cons: Canvas renderer ignores it (existing bug)

3. **Option B**: Set BOTH `widget.hidden` AND `widget.options.hidden`
   - Pros: Both renderers see it
   - Cons: No undo/redo for instance property mutation

4. **Option C**: Fix upstream — add `hidden` to `WidgetComponentDisplay`
   - Pros: Clean ECS backing, command dispatch, undo/redo
   - Cons: Requires ECS team coordination

### Action Items

- [x] ~~Clarify options assignment architecture~~ — DONE (see above)
- [ ] File upstream issue: canvas renderer should read `options.hidden` not `widget.hidden` (**OUT OF SCOPE** — not part of extension API migration, but blocks full consistency)
- [x] ~~Decide: Option A/B/C for `WidgetHandle.setHidden()` implementation~~ — Option B chosen: set BOTH `widget.hidden` AND `widget.options.hidden` (dual-write shim until upstream fix)
- [x] ~~If Option C: coordinate with ECS team~~ — N/A, using Option B
- [x] ~~Update extension API shim based on decision~~ — Implemented in `extension-api-service.ts`

---

## 4. Node State — Partially Centralized via LayoutStore

### Current State (Updated 2026-05-13)

**Already centralized** in `layoutStore.ts` (Yjs CRDT-backed):
- Node position (`ynodes` → `NodeLayout.position`)
- Node size (`ynodes` → `NodeLayout.size`)
- Node zIndex (`ynodes` → `NodeLayout.zIndex`)
- Node bounds (computed from position + size)

**NOT centralized** (still on `LGraphNode` instance):
- Node title
- Node mode (execution mode)
- Node properties

ECS slice-1 covers:
- Widgets (via `WidgetComponent*`)
- Node containers (via `WidgetComponentContainer` on `NodeEntityId`)

### LayoutStore Architecture

`layoutStore.ts` is a Yjs-backed CRDT store with:
- `ynodes: Y.Map<NodeLayoutMap>` — position, size, zIndex, bounds
- `ylinks: Y.Map<Y.Map<unknown>>` — link topology
- `yreroutes: Y.Map<Y.Map<unknown>>` — reroute positions
- Vue reactivity layer via `customRef` and version tracking
- Spatial index for hit testing (`SpatialIndexManager`)

**Key insight**: Position/size are already CRDT-backed and operation-logged. The extension
API can read from layoutStore for these properties.

### Extension API Mapping

| API Method | Phase A Backing | Phase B Backing |
|------------|-----------------|-----------------|
| `getPosition()` | `layoutStore.getNodeLayoutRef(nodeId).value.position` | Same (already CRDT) |
| `setPosition(pos)` | `layoutStore` operation (MoveNodeOperation) | Same |
| `getSize()` | `layoutStore.getNodeLayoutRef(nodeId).value.size` | Same |
| `setSize(size)` | `layoutStore` operation (ResizeNodeOperation) | Same |
| `getTitle()` | `LGraphNode.title` | ECS NodeComponentVisual |
| `setTitle(title)` | `node.title = title` | ECS command dispatch |
| `getMode()` | `LGraphNode.mode` | ECS NodeComponentMode |
| `setMode(mode)` | `node.mode = mode` | ECS command dispatch |

### Impact on Extension API

Phase A:
- Position/size: Read/write via layoutStore (CRDT-backed, operation-logged)
- Title/mode: Read/write directly on LGraphNode (no undo/redo)

Phase B:
- Position/size: No change needed (already centralized)
- Title/mode: Migrate to ECS component queries and command dispatch

### Action Items

- [x] ~~Document Phase A shim strategy~~ — See mapping table above
- [x] ~~Wire `NodeHandle.getPosition/setPosition` to layoutStore~~ — DONE (extension-api-service.ts)
- [x] ~~Wire `NodeHandle.getSize/setSize` to layoutStore~~ — DONE (extension-api-service.ts)
- [ ] Track ECS migration for title/mode (lower priority — already works via LGraphNode)

---

## 5. Known ECS Bugs

### 5.1 `parseWidgetEntityId` Colon Collision

From `entity-id-strategy.md`:

> `parseWidgetEntityId`'s regex `/^widget:([^:]+):([^:]+):(.*)$/` captures
> `nodeId` as `[^:]+`, so a string nodeId like `"sg:42"` produces
> `widget:g:sg:42:name`, which the regex mis-parses as `(g, sg, 42:name)`.

**Status**: Latent — production uses bare numeric nodeIds
**Risk**: Blocks `NodeLocatorId` format migration (subgraph prefixes)
**Mitigation**: UUID migration eliminates the regex entirely

### Action Items

- [ ] Avoid constructing test IDs with colons in nodeId segment
- [ ] Track colon-consolidation PR (prerequisite to UUID migration)

---

## 6. Summary Matrix

| Feature | Extension API | Backing | Status |
|---------|---------------|---------|--------|
| NodeEntityId | string (branded) | ECS (content-addressed) | Aligned (UUID migration pending) |
| WidgetEntityId | string (branded) | ECS (content-addressed) | Aligned (UUID migration pending) |
| SlotEntityId | string (branded) | Synthetic `slot:nodeId:dir:idx` | **RESOLVED** — use synthetic, migrate to UUID later |
| widget.value | getValue/setValue | WidgetComponentValue | Aligned |
| widget.disabled | isDisabled/setDisabled | WidgetComponentDisplay | Aligned |
| widget.label | readonly | WidgetComponentDisplay | Aligned |
| widget.hidden | isHidden/setHidden | Dual-write shim (widget + options) | **RESOLVED** — upstream fix out of scope |
| widget.options | getOption/setOption | WidgetComponentSchema.options | Aligned |
| node.position | getPosition/setPosition | **layoutStore (Yjs CRDT)** | **RESOLVED** — already centralized |
| node.size | getSize/setSize | **layoutStore (Yjs CRDT)** | **RESOLVED** — already centralized |
| node.mode | getMode/setMode | LGraphNode instance | Phase B (ECS migration) |
| node.title | getTitle/setTitle | LGraphNode instance | Phase B (ECS migration) |
| node.properties | getProperty/setProperty | LGraphNode instance | Phase B (ECS migration) |

---

## Appendix: ECS Branch References

- PR #11939: `drjkl/world-combo` — ECS substrate slice 1
- PR #11706: `drjkl/world-consolidation-phase2` — widgetValueStore facade
- `src/world/entityIds.ts` — current entity ID implementation
- `src/world/componentKey.ts` — component key system
- `src/world/widgets/widgetComponents.ts` — widget component definitions
- `src/world/widgets/widgetState.ts` — WidgetState view type
- `src/stores/widgetValueStore.ts` — ECS facade for widgets
- `docs/architecture/entity-id-strategy.md` — UUID migration proposal
