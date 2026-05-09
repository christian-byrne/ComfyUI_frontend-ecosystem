---
source_url: https://www.notion.so/comfy-org/Workflow-Serialization-in-ComfyUI-Frontend-A-Historical-Analysis-3596d73d365080c9ba69e945df831c1b
date_accessed: 2026-05-08
page_last_edited: 2026-05-07
author: comfy-org (internal doc)
status: To Do (not yet actioned by team)
---

# Workflow Serialization in ComfyUI Frontend: A Historical Analysis

## Short Version

ComfyUI's serialization is **three overlapping formats that have never been fully unified**:
1. **Workflow JSON** — canvas save/load (`LGraph.serialize()`)
2. **API prompt** — backend execution (`graphToPrompt()` pass 2)
3. **extra_pnginfo embed** — PNG metadata (travels as `extra_data.extra_pnginfo.workflow`)

Bridge between them: `graphToPrompt()` at `src/utils/executionUtil.ts:27` — the load-bearing wall.

---

## Part 1: The Serialization Pipeline

### Stage 1: Canvas State → Workflow JSON

**`LGraphNode.serialize()`** (`src/lib/litegraph/src/LGraphNode.ts:944`)

Produces `ISerialisedNode`:
```typescript
{
  id, type, pos, size, flags, order, mode,
  inputs?, outputs?, title?,
  properties?,
  widgets_values?,   // only widgets where widget.serialize !== false
  color?, bgcolor?, boxcolor?, shape?
}
```

`widgets_values` excludes display-only widgets (`widget.serialize === false`). This is the **workflow persistence flag**.

**`LGraph.serialize()`** (`src/lib/litegraph/src/LGraph.ts:2378`) — marked `@deprecated`, calls `asSerialisable()`.

Produces `ISerialisedGraph` (schema version `0.4`):
```typescript
{
  version: 0.4,
  last_node_id, last_link_id,
  nodes: ISerialisedNode[],
  links: SerialisedLLinkArray[],  // [id, origin_id, origin_slot, target_id, target_slot, type]
  groups: ISerialisedGroup[],
  config?,
  extra: {
    ds?,
    reroutes?,
    linkExtensions?,
    frontendVersion,              // set by graphToPrompt()
    workflowRendererVersion?,     // 'LG' | 'Vue' | 'Vue-corrected'
    groupNodes?
  }
}
```

**Newer schema version 1** (`SerialisableGraph`) uses object-shaped links + `state: { lastNodeId, lastLinkId, lastGroupId, lastRerouteId }`. Produced by `asSerialisable()` directly. `graphToPrompt()` still routes through `graph.serialize()` → version 0.4. The two schemas coexist with no programmatic migration. `@ts-expect-error` at `app.ts:1317` marks collision point.

`LGraph.configure()` branches on `data.version === 0.4` (line 2541) to choose array-link vs object-link parsing.

### Stage 2: Workflow JSON → API Prompt

**`graphToPrompt()`** (`src/utils/executionUtil.ts:27`)

**Pass 1 — workflow JSON:**
1. `node.applyToGraph()` on all virtual nodes (PrimitiveNode, Reroute) — materializes connections
2. `graph.serialize({ sortNodes })` → 0.4-format `ISerialisedGraph`
3. Strips `localized_name` from all slots (lines 47–53)
4. `compressWidgetInputSlots(workflow)` (`src/utils/litegraphUtil.ts:259`) — removes unconnected widget-backed input slots
5. Stamps `workflow.extra.frontendVersion`

**Pass 2 — API prompt:**
```typescript
{
  [nodeId: string]: {
    class_type: string,       // node.comfyClass
    _meta: { title: string }, // ignored by backend
    inputs: {
      [widgetName]: widgetValue         // when options.serialize !== false
               | [String(origin_id), origin_slot]  // connected output
    }
  }
}
```

**`widget.options.serialize` is the prompt exclusion flag** — distinct from `widget.serialize`. `control_after_generate` = canonical example: in `widgets_values` (workflow JSON), NOT in `inputs` (prompt).

Special value transformations:
- **Array widgets**: `{ __value__: array }` — backend unwraps at `execution.py:956`
- **Curve widgets**: `{ __type__: 'CURVE', __value__: array }` — backend strips `__value__` only; `__type__` **has no current backend consumer** (forward-looking decoration)
- **Node links**: `[String(origin_id), parseInt(origin_slot)]` — `is_link()` in `graph_utils.py:7` requires `[0]` string, `[1]` integer

### Stage 3: Sending to Backend

**`api.queuePrompt()`** (`src/scripts/api.ts:854`) — POST to `/prompt`:
```json
{
  "client_id": "...",
  "prompt": { /* ComfyApiWorkflow */ },
  "extra_data": {
    "extra_pnginfo": { "workflow": { /* full ComfyWorkflowJSON */ } },
    "auth_token_comfy_org": "...",
    "api_key_comfy_org": "..."
  },
  "front": true
}
```

Nodes with `"hidden": { "extra_pnginfo": "EXTRA_PNGINFO" }` receive the full workflow verbatim — how `SaveImage` embeds workflows in PNGs.

Backend strips `auth_token_comfy_org` and `api_key_comfy_org` into `sensitive` dict (`execution.py:951`) before any further processing. `SENSITIVE_EXTRA_DATA_KEYS` list at `execution.py:151`.

**Backend validation** (`ComfyUI/execution.py:1091`, `validate_inputs():~820`):
- `__value__` unwrapping: `val = val["__value__"]` at line 956
- `is_link()`: 2-element list where `[0]` is string
- Scalar coercions: `int(val)`, `float(val)`, `str(val)`, `bool(val)`
- Combo values validated against allowed options list

### Stage 4: Backend Output → Frontend

**`executed` WebSocket event** (`ComfyUI/execution.py:562`):
```json
{
  "node": "123",
  "display_node": "123",
  "output": { /* NodeExecutionOutput */ },
  "prompt_id": "uuid"
}
```

**Frontend handler** (`src/scripts/app.ts:729`):
```typescript
api.addEventListener('executed', ({ detail }) => {
  const executionId = String(detail.display_node || detail.node)
  nodeOutputStore.setNodeOutputsByExecutionId(executionId, detail.output, { merge: detail.merge })
  const node = getNodeByExecutionId(this.rootGraph, executionId)
  if (node?.onExecuted) node.onExecuted(detail.output)
})
```

`merge` field — standard ComfyUI backend never sends it; forward extension point for cloud backends.

---

## Part 2: Widget Value Type Reference

| Widget type | Frontend → `inputs` | Backend validates |
|---|---|---|
| `INT` | `number` | `int(val)` — throws on `None`, `NaN`-derived `null` |
| `FLOAT` | `number` | `float(val)` |
| `STRING` | `string` | `str(val)` |
| `BOOLEAN` | `boolean` | `bool(val)` |
| Combo | `string` matching option | must be in allowed list |
| Array widget | `{ __value__: [...] }` | unwrapped: `val["__value__"]` |
| Curve widget | `{ __type__: 'CURVE', __value__: [...] }` | `__value__` unwrapped; `__type__` NOT consumed |
| Node link | `[String(origin_id), origin_slot_int]` | `is_link()`: list[0]=str, list[1]=int |
| Custom type (IMAGE, LATENT…) | absent (must arrive via link) | type-validated at input slot |

### Two `serialize` flags — the critical distinction

| Flag | Location | Effect | Checked by |
|---|---|---|---|
| `widget.serialize === false` | Direct property on widget | Excluded from `widgets_values` in workflow JSON | `LGraphNode.serialize()` / `configure()` |
| `widget.options.serialize === false` | Nested in `widget.options` | Excluded from API prompt `inputs` | `executionUtil.ts:99` |

`addWidget('combo', ..., { serialize: false })` puts `serialize` in `widget.options`, NOT directly on `widget`. Getting this wrong shifts all subsequent widget indices for every saved workflow of that node type.

---

## Part 3: Historical Problems

### 3.1 Dual Schema Versions (0.4 vs. 1)

`LiteGraph.VERSION = 0.4` (`LiteGraphGlobal.ts:44`). Schema v1 introduced in 2024–2025 with object-shaped links, but `graphToPrompt()` still produces 0.4. `@ts-expect-error` at `app.ts:1317` is the sentinel.

### 3.2 KSampler `sampler_name` Patch (`app.ts:1360–1368`)

```typescript
if (node.type == 'KSampler' || node.type == 'KSamplerAdvanced') {
  if (widget.name == 'sampler_name') {
    if (typeof widget.value === 'string' && widget.value.startsWith('sample_')) {
      widget.value = widget.value.slice(7)
    }
  }
}
```

Runs on every workflow load. Comment at line 1358: "If you break something in the backend and want to patch workflows in the frontend, this is the place to do this." Standing invitation for future hacks.

### 3.3 `control_after_generate` Boolean→String Migration (`app.ts:1370–1383`)

```typescript
if (widget.name == 'control_after_generate') {
  if (widget.value === true) widget.value = 'randomize'
  else if (widget.value === false) widget.value = 'fixed'
}
```

Runs on every workflow load.

### 3.4 Index Drift from `control_after_generate`

`control_after_generate` was not present in early frontend versions. Old workflows have one fewer `widgets_values` entry per node. Every widget after the seed control is shifted one position left. `Number("hello world")` → `NaN` → `null` on re-save. Historical genesis of the `null`-in-numeric-widget problem (PR #11884).

### 3.5 Reroute Node Rewrite

Original Reroute was a full node type. 2024–2025 rewrite introduced native reroutes in `extra.reroutes`. Migration at `src/utils/migration/migrateReroute.ts` exists but **is not automatically applied**. Users who dismiss the toast accumulate legacy nodes.

### 3.6 Vue Renderer Coordinate Scale

Vue renderer introduced a 1.2× scale factor. Workflows saved then have `extra.workflowRendererVersion: 'Vue'`. `ensureCorrectLayoutScale()` (`src/renderer/extensions/vueNodes/layout/ensureCorrectLayoutScale.ts:130`) applies inverse transform at load. Tag updated to `'Vue-corrected'`. Migration **not re-persisted until re-save** — re-applied every open until saved.

### 3.7 PrimitiveNode Copy/Paste Loses `widgets_values`

`LGraphCanvas._serializeItems()` → `item.clone()?.serialize()`. `PrimitiveNode.clone()` creates fresh node with no widgets → `LGraphNode.serialize()` at line 972 skips `widgets_values` when `this.widgets` is empty. `control_after_generate` and all secondary widget state silently dropped. See also ADR-0006.

### 3.8 `__type__: 'CURVE'` Wrapper

`executionUtil.ts:112` wraps curve arrays as `{ __type__: 'CURVE', __value__: array }`. Backend only strips `__value__` — `__type__` is inert. If backend code inspects input before `__value__` unwrap, it receives the wrapper dict.

### 3.9 GroupNode ID String Hack

`zNodeId` = `z.union([z.number().int(), z.string()])` with comment "Remove it after GroupNode is redesigned." GroupNode inner nodes use string IDs `"groupNodeId:innerIndex"`. Marked for removal since GroupNode was introduced; GroupNode has not been redesigned.

### 3.10 `configure()` Blind Property Assignment (`LGraph.ts:2602–2608`)

```typescript
for (const i in data) {
  if (LGraph.ConfigureProperties.has(i)) continue
  // @ts-expect-error #574 Legacy property assignment
  this[i] = data[i]
}
```

Any unknown key in serialized graph is blindly assigned to `LGraph` instance. `LGraph.ConfigureProperties` set (`LGraph.ts:190–206`) gates explicit handling. Any new top-level graph field must be added to this set.

### 3.11 Missing Node Name Sanitization Corrupts Saved Workflows (`app.ts:1231–1258`)

When a node type is missing, `n.type = sanitizeNodeName(n.type)` strips `&<>"'\`=` characters. If user re-saves, corrupted name persists permanently.

### 3.12 `widgets_values` Array vs. Object Type (`workflowSchema.ts:214`)

Schema allows array or record. Some custom nodes use a pseudo-array dict (has `length` and index access, not a real array). `configure()` iterates with numeric index at `LGraphNode.ts:917–924` — breaks on pseudo-array dicts.

### 3.13 Reactive Proxy Stripping in `widgets_values` (`LGraphNode.ts:978–981`)

Object-valued widgets use `JSON.parse(JSON.stringify(val))` to strip Vue reactivity proxies. Breaks for circular references or non-JSON-serializable values — silently corrupts or throws.

---

## Part 4: Current Known Issues

| # | Location | Issue |
|---|---|---|
| 4.1 | `api.ts:730–734` | `executing` event discards `prompt_id` — stale events highlight wrong node on reconnect |
| 4.2 | `api.ts:612–620`, `GraphView.vue:254` | No reconnect-state recovery — execution overlay stuck on mid-execution disconnect |
| 4.3 | `apiSchema.ts:104–113` | `execution_error` Zod schema marks `node_id` required; cloud backends send `null` for service-level errors; schema wrong |
| 4.4 | `workflowSchema.ts:214` | `widgets_values` typed as array OR record; array methods unsafe on pseudo-array dicts |
| 4.5 | `executionUtil.ts:139–141` | TODO: nodes without `comfyClass` slip past `isVirtualNode` guard, included in prompt with `class_type: undefined` — backend rejects |
| 4.6 | `executionUtil.ts:132–133` | `parseInt` on already-integer `origin_slot` masked by `@ts-expect-error` |
| 4.7 | `LGraphNode.ts:978–981` | Reactive proxy stripping via `JSON.parse(JSON.stringify(val))` — silent corruption on non-JSON values |

---

## Part 5: Maintenance Rules

### Adding a New Widget Type
Three-flag permutation (see `docs/WIDGET_SERIALIZATION.md`):
- Both workflow JSON + prompt: neither flag set
- Workflow JSON only: `widget.options.serialize = false`
- Neither (display-only): `widget.serialize = false`

Changing `widget.serialize` after users have saved workflows = breaking change; all subsequent widget indices shift.

### Changing Widget Order or Count
`configure()` assigns `widgets_values` entries by position (`LGraphNode.ts:918–924`). Inserting/removing/reordering widgets silently assigns wrong values to saved workflows. Mitigation: `onConfigure` callback with named patch in `app.ts` loading block. Systemic relief: `widgets_values_named` (PR #10392) eliminates index sensitivity — requires `fallbackWidgetsValuesNames` in node's `/object_info`.

### Modifying `ISerialisedGraph` Shape
New top-level graph field must be added to `LGraph.ConfigureProperties` or it falls through to blind `this[i] = data[i]`. The `extra` envelope is `LGraphExtra extends Dictionary<unknown>` — structurally any key valid. `_configureBase()` (line 2507) calls `structuredClone(extra)` and explicitly deletes `linkExtensions` (line 2510). New auto-generated keys that must not persist must also be deleted here.

### Modifying the Prompt Body
`QueuePromptRequestBody` (`api.ts:72`) is authoritative. New `extra_data` fields that nodes need: declare as `"hidden": { "myField": "MY_FIELD_KEY" }` in `INPUT_TYPES()`. Credentials/tokens: add to `SENSITIVE_EXTRA_DATA_KEYS` in `execution.py:151`.

### Modifying WebSocket Event Handling
- `executing` loses `prompt_id` at `api.ts:731` — any multi-job/reconnect feature must fix dispatch
- `execution_error` with `node_id = null` is a real production case — make `node_id` optional in `apiSchema.ts` before calling `.parse()`
- `executionStore` has no reconnect-state recovery — new reactive state needs cleanup in `resetExecutionState()`

---

## Key File Locations

| File | Role |
|---|---|
| `src/utils/executionUtil.ts` | `graphToPrompt()` — canvas state → workflow JSON + API prompt |
| `src/lib/litegraph/src/LGraphNode.ts` | `serialize()` (line 944), `configure()` (line 832) |
| `src/lib/litegraph/src/LGraph.ts` | `serialize()` (line 2378), `asSerialisable()` (line 2438), `configure()` (line 2519) |
| `src/lib/litegraph/src/types/serialisation.ts` | All serialized type definitions |
| `src/scripts/api.ts` | `queuePrompt()` (line 854), WebSocket dispatcher (line 718) |
| `src/scripts/app.ts` | Workflow loading (line 1185+), legacy patches (line 1360+), `executed` handler (line 729) |
| `src/platform/workflow/validation/schemas/workflowSchema.ts` | Zod schemas for workflow JSON (v0.4 and v1) and API prompt |
| `src/schemas/apiSchema.ts` | Zod schemas for WebSocket messages |
| `src/stores/nodeOutputStore.ts` | Stores execution outputs by execution ID |
| `src/utils/litegraphUtil.ts` | `compressWidgetInputSlots()` (line 259) |
| `src/lib/litegraph/src/subgraph/ExecutableNodeDTO.ts` | `resolveInput()` — subgraph boundary traversal for prompt |
| `src/renderer/extensions/vueNodes/layout/ensureCorrectLayoutScale.ts` | Vue coordinate migration on load |
| `src/utils/migration/migrateReroute.ts` | Legacy Reroute node migration (not auto-applied) |
| `docs/WIDGET_SERIALIZATION.md` | `widget.serialize` vs `widget.options.serialize` permutation table |
| `docs/adr/0006-primitive-node-copy-paste-lifecycle.md` | PrimitiveNode copy/paste `widgets_values` loss |
| `ComfyUI/server.py:915` | `/prompt` route handler |
| `ComfyUI/execution.py:1091` | `validate_prompt()`, `__value__` unwrap (line 956) |
| `ComfyUI/comfy_execution/graph_utils.py:7` | `is_link()` |

---

## Relevance to This Project

### I-WS (lazy widget serialization)
This doc is the definitive reference. The two `serialize` flags (§ The critical distinction above) are the exact mechanism I-WS must work with. `widgets_values_named` (PR #10392) is the systemic fix for I-WS.3's index-sensitivity problem.

### D7 (widget shape & persistence)
§ Adding a New Widget Type / §3.4 Index Drift directly inform D7's three-tier persistence matrix. `docs/WIDGET_SERIALIZATION.md` should be cross-referenced as the authoritative flag permutation table.

### S6.A1 (graphToPrompt patching, blast-radius #1)
§Stage 2 gives the full internal anatomy of `graphToPrompt()`. Extensions patch this because:
1. There is no `beforePrompt` / `beforeSerialize` app-level hook
2. Virtual node resolution (PrimitiveNode, Reroute, cg-useeverywhere) happens inside this function
3. Custom metadata injection has no other path

UWF Phase 3 (per `notion-uwf-frontend-impl-plan.md`) is the resolution path for S6.A1.

### D5 (event typing)
§4.1 (`executing` drops `prompt_id`), §4.3 (`execution_error` Zod mismatch), §Stage 4 (`executed` handler) give concrete implementation details for all execution events.

### PKG2 (declaration file)
§3.1 dual-schema types, §3.9 GroupNode `zNodeId` union, §4.3 Zod schema mismatch — type-level problems the public API barrel must not inherit.

### I-NEW.1 (ADR-0006 copy/paste)
§3.7 confirms the exact `LGraphCanvas._serializeItems()` → `clone()` → empty widgets path.

### New patterns for touch-point DB
See staging file `research/touch-points/staging/R-SER-new-patterns.yaml`.
