---
task: I-WS.3
date: 2026-05-08
source: generated
status: spec
depends_on:
  - I-WS.1  # widget-serialization-state.md — four-surface audit
  - I-WS.2  # per-extension confirm of hot-path edge cases
  - I-UWF.8 # widgetValueStore compatibility analysis (§7 of I-WS.1 doc)
  - D5      # WidgetBeforeSerializeEvent shape (context enum, setSerializedValue, skip)
  - D7      # first-class fields: label, hidden, disabled, serialize
blocks:
  - I-WS.4  # test triple for lazy-serialize category
  - I-PG.B1 # strangler: Phase B handle methods must use this getter
---

# I-WS.3 — Lazy Widget Serialization: Design Spec

## Problem statement (from I-WS.1)

Four distinct v1 surfaces all converge on the same goal — "produce the right
value for the workflow or prompt at save/queue time" — but with divergent
invocation contexts, collision semantics, and async support:

| Surface | Scope | Context | Async? | Collision model |
|---------|-------|---------|--------|-----------------|
| `widget.value` direct read | per-widget | workflow + copy | No | None — last writer wins |
| `widget.serializeValue` | per-widget | prompt only | Yes | Last assigner wins silently |
| `node.onSerialize(o)` | per-node (append) | workflow only | No | Last assigner wins silently |
| `nodeType.prototype.serialize` | per-node (wrap) | workflow + copy | No | Prototype stomping — CRITICAL |

I-WS.3 collapses these to a single **`widget.on('beforeSerialize', handler)`**
event (already in the v2 type surface, see `widget.ts:157`) that:
- fires on all contexts (`workflow`, `prompt`, `clone`, `subgraph-promote`)
- is the only async-allowed event per D10c
- has a registered-handler list (not last-writer-wins)
- routes through `widgetValueStore` per the I-UWF.8 analysis

This document specs (a) the runtime behaviour of the event, (b) the
`getSerializedValue(context)` internal resolver, (c) the node-level
`beforeSerialize` event for the `onSerialize` / `prototype.serialize`
use-case, and (d) the v1 migration shims that intercept legacy assignments.

---

## 1. The unified serialization contract

### 1.1 Widget-level: `widget.on('beforeSerialize', handler)`

Already in `widget.ts`. The contract as specced in D5:

```ts
interface WidgetBeforeSerializeEvent<T = WidgetValue> {
  readonly context: 'workflow' | 'prompt' | 'clone' | 'subgraph-promote'
  readonly value: T                       // current getValue() at fire time
  setSerializedValue(v: unknown): void    // override what's written
  skip(): void                            // exclude from prompt (context='prompt' only)
}
```

**Handler list semantics:**
- Multiple `beforeSerialize` handlers on the same widget fire in
  registration order. The final output is the last `setSerializedValue`
  call that ran.
- Every handler receives the *original* `widgetValueStore` value in
  `event.value` — not the accumulated value from previous handlers. Each
  handler declares its transform independently. The accumulator is internal
  to the resolver (see §1.2 D-4).
- `skip()` is terminal: subsequent handlers still run, but their
  `setSerializedValue` calls are no-ops (the widget is already excluded).

**Async contract:**
- All `beforeSerialize` handlers are awaited sequentially before the value
  is written. Parallel execution would require a merge strategy for multiple
  `setSerializedValue` calls — sequential-in-registration-order avoids that.
- The caller (workflow-save or prompt-build) `await`s
  `widget.getSerializedValue(context)` as a whole. The async cost is only
  incurred when at least one handler returns a `Promise`.

### 1.2 Internal resolver: `widget.getSerializedValue(context)`

```ts
// internal — not on WidgetHandle public surface
async function getSerializedValue(
  widgetId: WidgetEntityId,
  context: 'workflow' | 'prompt' | 'clone' | 'subgraph-promote'
): Promise<{ skipped: boolean; value: unknown }>
```

**Algorithm:**

```
1. originalValue ← widgetValueStore.get(widgetId)     // authoritative intent value
2. resolvedValue ← originalValue
3. skipped ← false
4. for handler of registeredHandlers(widgetId, 'beforeSerialize'):
     event ← { context, value: originalValue,          // always the pre-loop original
                setSerializedValue(v) { resolvedValue = v },
                skip() { skipped = true } }
     await handler(event)
     if skipped: break
5. if context === 'workflow' | 'clone' | 'subgraph-promote':
     // Write back transformed value so widgets_values_named is correct
     // (only when value changed — avoid spurious reactivity)
     if resolvedValue !== originalValue:
       widgetValueStore.set(widgetId, resolvedValue)
6. return { skipped, value: resolvedValue }
```

**Key design decisions:**

**D-1: Read from `widgetValueStore`, not `widget.value` directly.**
`widgetValueStore` is the authoritative runtime state (per I-UWF.8 §1).
Reading `widget.value` directly would bypass the store and diverge from
`widgets_values_named`. The store always has the intent value; the getter
transforms it contextually.

**D-2: Write-back on non-prompt contexts only.**
For `workflow`, `clone`, and `subgraph-promote`, if a `beforeSerialize`
handler transforms the value (e.g. a future "normalise whitespace" handler),
the transformed value is written back to `widgetValueStore` so
`widgets_values_named` captures it. For `prompt`, the transform is ephemeral
(e.g. dynamic prompt resolution, upload filename). Writing it back would
corrupt the stored template.

**D-3: `skip()` produces `{ skipped: true }` — not `undefined`.**
The caller must distinguish "widget's value is `undefined`/`null`" from
"widget is excluded from prompt." A `skipped: true` sentinel is unambiguous.
The caller omits the widget's positional slot entirely when `skipped: true`.

**D-4: `event.value` is always the pre-loop original; `resolvedValue` accumulates.**
Every handler receives the original `widgetValueStore` value in `event.value`,
regardless of what earlier handlers passed to `setSerializedValue`. This
makes handlers independent: each declares its own transform without needing
to know what came before. The *final output* is the last `setSerializedValue`
call in registration order — so the last handler "wins", but all handlers
ran. For the real-world cases (dynamic prompts, upload), handlers are
exclusive: they check `context` and short-circuit; two handlers never
meaningfully compose on the same widget, so the last-wins rule is
unambiguous in practice.

### 1.3 Sync fast path

For widgets with no `beforeSerialize` handlers:

```ts
function getSerializedValueSync(
  widgetId: WidgetEntityId,
  context: 'workflow' | 'prompt' | 'clone' | 'subgraph-promote'
): { skipped: boolean; value: unknown } | null
```

Returns `null` if any handler is async (detected at registration time: if
the handler function is `AsyncFunction`, mark the widget as async). Returns
synchronously for widgets whose handlers are all synchronous, or for widgets
with no handlers.

The workflow-save path is typically synchronous today (no `await` in
`LGraph.serialize()`). Adding async forces the caller to become async too.
The fast path lets most widgets (number, string, toggle, combo) go through
the save path without making it async. Only widgets that registered at least
one `async` handler force the slow path.

**Detection heuristic:**
```ts
function isAsyncHandler(fn: Function): boolean {
  return fn.constructor.name === 'AsyncFunction'
    || fn.toString().startsWith('async ')
}
```

Register as a flag on the widget entity: `WidgetSerializerAsync: boolean`.
Set `true` when the first async handler is registered; cleared when all async
handlers are removed. Checked at call site to decide sync vs async path.

---

## 2. Node-level serialization: `node.on('beforeSerialize', handler)`

The `onSerialize` (S2.N6) and `prototype.serialize` (S2.N15) patterns are
node-scoped, not widget-scoped. They handle state with no widget
representation (canvas thumbnails, computed sidecar data, lazy upload
metadata). The widget-level event doesn't cover this case.

### 2.1 The node `beforeSerialize` event (already in `node.ts:198`)

```ts
interface NodeBeforeSerializeEvent {
  readonly context: 'workflow' | 'prompt' | 'clone' | 'subgraph-promote'
  readonly data: Record<string, unknown>   // mutable: mutate in place to append
  replace(fn: (orig: Record<string, unknown>) => Record<string, unknown>): void
}
```

This replaces both `onSerialize` (mutate `o` in place → use `event.data`)
and `prototype.serialize` (replace whole object → use `event.replace(fn)`).

**Handler list semantics (node-level):**
- Multiple handlers chain in registration order.
- `replace()` chains: handler A's `replace(fn)` followed by handler B's
  `replace(fn2)` results in `fn2(fn(original))`.
- `data` mutations and `replace()` calls compose: mutations apply first,
  then `replace()` wraps the result.

### 2.2 Invocation sites for node `beforeSerialize`

The node-level event must fire at all sites where `node.serialize()` is
called (see I-WS.1 §3):

| Site | Context |
|------|---------|
| `LGraph.serialize()` → workflow save | `'workflow'` |
| `LGraph.cloneNode()` | `'clone'` |
| `subgraphUtils.ts:224,230` | `'subgraph-promote'` |
| `useNodeReplacement.ts:174,284` | `'workflow'` (pre-replacement snapshot) |
| Prompt build (embedded workflow JSON) | `'workflow'` (note: fires TWICE on queue) |

The double-fire on queue (see I-WS.1 §3: "S2.N6 + S2.N15 + direct
`widget.value` all fire twice on every queue") is preserved — the first
fire produces the embedded workflow JSON, the second is part of the prompt
build. Handlers that want to short-circuit on the redundant fire can check
`context === 'workflow'` and debounce at the application layer if needed.
The v2 event does not attempt to collapse the double-fire; that is a
LiteGraph internals change.

---

## 3. Source-of-truth collapse: `widgetValueStore`

### 3.1 The three ways runtime ↔ disk can diverge (I-WS.1 §4.3)

1. **workflow JSON** — formerly direct `widget.value`; in v2: `getSerializedValue('workflow')`.
2. **prompt** — formerly `serializeValue?.(...)  ?? widget.value`; in v2: `getSerializedValue('prompt')`.
3. **PrimitiveNode rehydration** — reads `this.widgets_values[i]` from the snapshot.

The lazy getter collapses paths 1 and 2 by routing both through
`widgetValueStore`. Path 3 (PrimitiveNode) remains a special case because
`widgets` may be empty at `configure()` time — this is exactly the ADR 0006
Problem A. The fix:

**I-WS.3 resolution for ADR 0006:** When `getSerializedValue('clone')` is
called for a widget that is part of a PrimitiveNode conversion, if
`this.widgets` is empty (i.e. the clone hasn't been `configure()`d yet),
return the value from `widgetValueStore` (populated at clone time from the
source node's store). This makes the PrimitiveNode copy/paste case correct
without any `prototype.serialize` override — `widgets_values` is populated
from `widgetValueStore`, not from `this.widgets`.

```
Current (ADR 0006 bug):
  clone → node.serialize() → reads widget.value → widgets is [] → writes []

With I-WS.3:
  clone → getSerializedValue('clone') → reads widgetValueStore → 
  widgetValueStore populated from source at clone time → writes correct values
```

This makes ADR 0006 Option A unnecessary.

### 3.2 `widgets_values_named` alignment

Per I-UWF.8 analysis: `widgets_values_named` is populated from
`widgetValueStore` by name. I-WS.3's write-back in step 4 of the resolver
(§1.2 above) ensures that when a `beforeSerialize` handler transforms the
workflow-context value, the transformed value is written back to the store
before `widgets_values_named` is emitted. The timeline:

```
workflow-save:
  for each widget:
    result = await getSerializedValue(id, 'workflow')
    if !result.skipped:
      widgetValueStore.set(id, result.value)    ← write-back (D-2)
      widgets_values[i] = result.value
  widgets_values_named = widgetValueStore.snapshot()  ← correct
```

---

## 4. V1 migration shims

For the parallel-paths period (D6 Phase A/B), extensions using v1 surfaces
must still work. Three shims intercept legacy assignments and route them
through the v2 event system.

### 4.1 `widget.serializeValue =` shim

**Target:** `widget.serializeValue = (node, i) => ...`

**Shim behavior:** When a v1 extension assigns `serializeValue` on a widget,
a proxy setter intercepts the assignment, wraps the function in a
`beforeSerialize` handler, and registers it:

```ts
Object.defineProperty(widget, 'serializeValue', {
  set(fn: (node, i) => Promise<unknown> | unknown) {
    // Remove previously shim-wrapped handler for this widget if any
    removeShimmedHandlers(widgetId, 'serializeValue')
    if (!fn) return
    const handler = async (event: WidgetBeforeSerializeEvent) => {
      if (event.context !== 'prompt') return   // v1 serializeValue = prompt-only
      const result = await fn(/* node */ getNodeForWidget(widgetId), /* i */ getWidgetIndex(widgetId))
      if (result === undefined) {
        event.skip()
      } else {
        event.setSerializedValue(result)
      }
    }
    registerShimmedHandler(widgetId, 'serializeValue', handler)
    widgetHandle.on('beforeSerialize', handler)
  },
  get() {
    return getShimmedSerializeValue(widgetId)   // return wrapped fn for compat reads
  }
})
```

**Collision resolution:** The shim registers *one* handler per widget per
extension. If the same extension assigns `serializeValue` twice (as
`dynamicPrompts.ts` does in `nodeCreated` then re-sets it), the shim
replaces the previous handler. This matches the current last-writer-wins
behaviour.

### 4.2 `node.onSerialize =` shim

**Target:** `node.onSerialize = (o) => { o['my_key'] = ... }`

**Shim behavior:** Proxy setter on `LGraphNode.onSerialize`:

```ts
Object.defineProperty(node, 'onSerialize', {
  set(fn: (o: Record<string, unknown>) => void) {
    removeShimmedHandlers(nodeId, 'onSerialize')
    if (!fn) return
    const handler = (event: NodeBeforeSerializeEvent) => {
      // v1 onSerialize only ran on workflow-save, not on prompt second-pass
      // We preserve this by only firing for 'workflow' context
      // (but in practice the event fires for all contexts at LGraph.serialize() call sites)
      fn(event.data)
    }
    registerShimmedHandler(nodeId, 'onSerialize', handler)
    nodeHandle.on('beforeSerialize', handler)
  },
  get() { return getShimmedOnSerialize(nodeId) }
})
```

**Note on double-fire:** The v1 `onSerialize` fired only once per queue
(during the workflow-snapshot pass inside `graphToPrompt`). The v2 event
will fire twice per queue if the prompt-build path also calls `node.serialize()`.
The shim passes `event.data` both times, which is safe for append-only
mutations but could cause double-writes of computed fields. Extensions that
set `event.data['my_key'] = expensiveCompute()` will compute twice per queue
in Phase A. Fix: add a `context === 'workflow'` guard in the shim, or
document the behaviour in the migration guide (P3).

### 4.3 `nodeType.prototype.serialize =` shim (CRITICAL)

**Target:** `nodeType.prototype.serialize = function(...) { const r = orig.call(this); ... }`

This is the hardest shim because:
1. It operates at the prototype level, not the instance level.
2. The original function (`orig`) is captured at assignment time — the shim
   must not break the capture chain.
3. Multiple extensions wrapping the same prototype must still chain correctly.

**Shim strategy:** Use the `replace()` method on `NodeBeforeSerializeEvent`
to reproduce the "wrap the base implementation" pattern:

```ts
// Called from the Phase C strangler (I-PG.C1) when it detects a prototype assignment:
function shimPrototypeSerialize(
  NodeClass: typeof LGraphNode,
  wrappingFn: (this: LGraphNode) => ISerialisedNode
) {
  // Capture what the prototype currently points at
  const prev = NodeClass.prototype.serialize

  // Install transparent pass-through so the prototype chain still works for v1 callers
  NodeClass.prototype.serialize = prev  // no-op if already a pass-through

  // Register a replace() handler on node's beforeSerialize event
  // This fires for every instance of NodeClass
  nodeTypeExtension.on('beforeSerialize', (event) => {
    event.replace((orig) => {
      // Call the wrapping function with 'this' = the node instance
      // The wrapping function calls orig internally — we give it a fake node
      // whose serialize() returns orig, so the chain is preserved
      return wrappingFn.call(/* node */, () => orig)  // simplified
    })
  })
}
```

This shim is **Phase C work** (I-PG.C1) — it requires the strangler to
intercept prototype assignments before they happen. For Phase A/B, it is
sufficient to document the limitation and require extensions using
`prototype.serialize` to migrate explicitly using `node.on('beforeSerialize',
e => e.replace(fn))`.

**Emit deprecation warning** when a `prototype.serialize` assignment is
detected (if the Phase C interceptor is active):

```
[ComfyUI v2] DEPRECATION: nodeType.prototype.serialize assignment detected
in extension 'ExtensionName'. Migrate to:
  node.on('beforeSerialize', (e) => e.replace((orig) => ({ ...orig, my_key: ... })))
See: https://docs.comfy.org/extensions/api/interfaces/NodeBeforeSerializeEvent
```

---

## 5. Perf / async edge-case inventory

From I-WS.2 (confirmed against actual files):

| Widget | Extension | Pattern | Async? | Context |
|--------|-----------|---------|--------|---------|
| webcam `camera` | `webcamCapture.ts` | `serializeValue` uploads frame | **Yes** | prompt only |
| webcam `btn` | `webcamCapture.ts` | `() => undefined` (suppress) | No | prompt only |
| audio | `uploadAudio.ts` | `serializeValue` uploads blob | **Yes** | prompt only |
| 3D scene | `load3d.ts` | `serializeValue` serializes scene | **Yes** | prompt only |
| painter mask | `usePainter.ts` | `serializeValue` encodes canvas | **Yes** | prompt only |
| dynamic prompt | `dynamicPrompts.ts` | resolve template, mutate workflow | No | prompt (transforms); workflow (mutates `workflowNode.widgets_values`) |
| save-image extra | `saveImageExtraOutput.ts` | static placeholder string | No | prompt only |

**All async widgets are prompt-only** — they short-circuit on non-prompt
contexts. The workflow-save path therefore needs no `await` for any of
them, confirming that the sync fast path (§1.3) is viable for all
non-prompt contexts.

**`dynamicPrompts.ts` special case:** The current implementation directly
mutates `workflowNode.widgets_values[widgetIndex]` inside `serializeValue`
to keep the workflow copy in sync with the resolved value. With the v2 event,
this mutation is replaced by:
- `'prompt'` context: call `event.setSerializedValue(resolved)` → prompt gets resolved value.
- The write-back (D-2) does NOT apply to prompt context; workflow stays as template.
- To sync the template to the resolved value in the workflow (current
  behaviour), the extension would additionally need to call
  `widget.setValue(resolved)` or emit a separate `'workflow'` context event.
  **Decision:** do NOT replicate the `workflowNode.widgets_values` mutation
  in the shim. The current behaviour (save-workflow shows template, queue
  sends resolved) is correct and the mutual mutation is fragile. Migration
  note for P3: the dynamic-prompts author should audit whether the
  workflow-mutation was intentional or accidental.

---

## 6. `getSerializedValue` TypeScript signature

```ts
// Internal service function — not on WidgetHandle public surface
declare function getSerializedValue(
  widgetId: WidgetEntityId,
  context: 'workflow' | 'prompt' | 'clone' | 'subgraph-promote'
): Promise<{ skipped: boolean; value: unknown }>

// Sync fast path — returns null if any handler is async
declare function getSerializedValueSync(
  widgetId: WidgetEntityId,
  context: 'workflow' | 'prompt' | 'clone' | 'subgraph-promote'
): { skipped: boolean; value: unknown } | null
```

The public `WidgetBeforeSerializeEvent` interface (already in `widget.ts`)
is unchanged. The getter is an internal implementation detail.

**Not on `WidgetHandle`:** There is no `widget.getSerializedValue()` public
method. Extension authors never call the getter directly — they register
`beforeSerialize` handlers and let the runtime call the getter. The getter
is called by:
- `LGraph.serialize()` (workflow-save and prompt embedded workflow)
- `executionUtil.ts` prompt-build loop
- `LGraph.cloneNode()` clone path

---

## 7. What this unblocks

| Task | How |
|------|-----|
| **ADR 0006 Option A** | Unnecessary — `getSerializedValue('clone')` reads `widgetValueStore`, not empty `this.widgets` |
| **I-WS.4** | Test triple: v1 sync `serializeValue` shim passes → same bytes; v2 lazy getter; webcam perf |
| **I-PG.B1** | Phase B: handle `.on('beforeSerialize', ...)` dispatches through `getSerializedValue` instead of stub |
| **I-PG.C1** | Phase C: `prototype.serialize` strangler wraps via `event.replace()` |
| **I-SR.2.B2** | `NodeInstanceScope.dispose()` must call `removeShimmedHandlers(nodeId, ...)` |

---

## 8. Open questions / decisions NOT made here

| # | Question | Where to decide |
|---|----------|-----------------|
| OQ-1 | Does the workflow-save path become `async` (breaking `LGraph.serialize()` signature), or does the sync fast path always cover workflow-save? | **Recommendation:** sync fast path always covers workflow-save — all async shims are prompt-only per §5. No API change to `LGraph.serialize()` needed. |
| OQ-2 | PR #10392 (`widgets_values_named`) must be merged before `widgetValueStore` write-back (D-2) can be implemented. | Track PR status. I-WS.3 implementation blocks on merge or confirmed stable API. |
| OQ-3 | `dynamicPrompts.ts` workflow mutation — intentional or accidental? | P3 migration guide; out of I-WS.3 scope. |
| OQ-4 | Handler ordering when both a shim-registered handler and a direct `widget.on('beforeSerialize', ...)` handler exist on the same widget. | **Recommendation:** shim handlers register at the tail of the handler list (v1 compat is lower priority than v2). Direct v2 registrations go to the head (registration order among themselves). |
