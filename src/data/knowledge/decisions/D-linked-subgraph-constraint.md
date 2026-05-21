# D-linked-subgraph — Linked Subgraph (Blueprint) Constraints

**Status**: ACCEPTED — 2026-05-18 (per AXIOMS.md <a href="/axioms#a3-refs" class="wiki-link">A3</a> codification + 2026-05-18 design review). Header format normalized 2026-05-20 (wave-12) per <a href="/decisions/D-api-surface-finalization" class="wiki-link">D-api-surface-finalization</a>.
**Date:** 2026-05-18
**Origin:** AXIOMS.md <a href="/axioms#a3-refs" class="wiki-link">A3</a> (Linked Subgraph Constraint), design review meeting 2026-05-18
**Related:**
- <a href="/decisions/D12-scope-clone-on-copy" class="wiki-link">D12</a> (Scope clone-on-copy — different scenario: copy/paste creates new entityId)
- <a href="/decisions/D7-widget-shape-and-persistence" class="wiki-link">D7</a> (Widget shape & persistence)
- <a href="/decisions/D20-id-type-convergence" class="wiki-link">D20</a> (ID type convergence)
- AXIOMS.md <a href="/axioms#a3-refs" class="wiki-link">A3</a>, <a href="/axioms#a4-refs" class="wiki-link">A4</a>

---

## Context

### What are Linked Subgraphs (Blueprints)?

Linked subgraphs — internally called "blueprints" — allow the **same <a href="/api-docs/graph" class="wiki-link">graph</a> instance to exist across multiple clones**. Unlike copy/paste (<a href="/decisions/D12-scope-clone-on-copy" class="wiki-link">D12</a>), which creates new entity IDs, a linked subgraph shares entity identity across all instances.

```
┌─────────────────────┐      ┌─────────────────────┐
│  Workflow A         │      │  Workflow B         │
│  ┌─────────────┐   │      │  ┌─────────────┐   │
│  │ Blueprint X │   │      │  │ Blueprint X │   │
│  │  node:N7    │───┼──────┼──│  node:N7    │   │
│  │  widget:W3  │   │      │  │  widget:W3  │   │
│  └─────────────┘   │      │  └─────────────┘   │
└─────────────────────┘      └─────────────────────┘
         │                            │
         └────── SAME entity ID ──────┘
```

This is a **MAJOR design constraint** that affects every layer of the extension API.

### Why this matters for Extension API v2

Extensions that work correctly with single-instance nodes may break silently with blueprints:

1. **Closure captures**: An extension capturing `entityId` in a closure may be invoked from a different workflow context
2. **Event dispatch**: A widget value change in Blueprint X fires events that reach all workflows containing that blueprint
3. **Reactive state**: Vue watchers on shared entity state trigger across all contexts
4. **Serialization**: The same entity may serialize to multiple workflows

---

## Constraints

### C1: Entity IDs Must Be Context-Stable

Entity IDs (`NodeEntityId`, `WidgetEntityId`) must remain stable across blueprint boundaries. The same node in a blueprint has the same ID regardless of which workflow is viewing it.

**Implication for extensions:**
- Do NOT assume an entity ID maps to a single workflow
- Do NOT use entity IDs as keys for per-workflow state
- Use `ScopeId` or `WorkflowId` + `EntityId` for workflow-specific state

### C2: Widget State Is Shared

Widget values (ECS `WidgetValue` components) are shared across all blueprint instances. Changing a widget value in one workflow affects all workflows containing that blueprint.

**Implication for extensions:**
- `widget.setValue()` affects all instances simultaneously
- `widget.on('valueChange')` fires once, but the change is visible everywhere
- Extensions must NOT assume widget state is per-workflow

### C3: Event Handlers Must Be Blueprint-Aware

Event handlers registered on a node/widget may fire in a context different from where they were registered.

**Implication for extensions:**
- Never capture per-workflow context (canvas, viewport, DOM element) in an event handler closure
- Use `ctx.workflow` or `ctx.scope` accessors at event-fire time, not registration time
- Avoid closures that assume "the canvas I'm rendering on" is singular

### C4: Serialization Must Not Assume Single Workflow

A node may serialize to multiple workflows simultaneously. The `beforeSerialize` event context may differ between invocations.

**Implication for extensions:**
- `beforeSerialize` handlers receive a `context` parameter indicating the serialization target
- Do not cache "the workflow this node belongs to" — it may belong to many

### C5: No Global Widget State

Per AXIOMS.md A3, extensions must not use global/singleton state keyed by entity ID alone:

```ts
// ❌ WRONG — breaks with blueprints
const widgetCache = new Map<WidgetEntityId, CacheData>()

// ✅ CORRECT — scope-qualified key
const widgetCache = new Map<`${WorkflowId}:${WidgetEntityId}`, CacheData>()
// or: use provide/inject with workflow-scoped provider
```

---

## Validation

All API designs must be tested against the linked-instance scenario:

1. **Test case**: Create a blueprint with a counter widget
2. **Clone**: Include the blueprint in two separate workflows
3. **Mutate**: Increment the counter from workflow A
4. **Assert**: Counter is incremented in workflow B
5. **Assert**: Extension state is consistent across both views

### Axiom Compliance Check

`scripts/check-axiom-compliance.sh` checks for:
- `window.widgetState` or `globalThis.widget` patterns (A3 violation)
- EntityId-only Map keys without workflow qualifier (warning)

---

## Extension Author Guidance

### DO:
- Use `ctx.workflow` / `ctx.scope` accessors at event-fire time
- Qualify any caches by workflow + entity, not entity alone
- Treat entity IDs as potentially multi-context
- Test with linked subgraphs before shipping

### DON'T:
- Capture workflow/canvas/viewport in closures at registration time
- Use global Maps keyed by entity ID alone
- Assume `nodeCreated` fires once per visible node
- Assume widget state is private to one workflow

---

## Future Considerations

- **I-BLUEPRINT.1**: Full linked subgraph implementation (deferred)
- **FU-1 (Jacob)**: Constraints for parallel <a href="/api-docs/execution" class="wiki-link">execution</a>, streaming, incremental computation
- The current v2 API is designed to NOT preclude blueprint support

---

## Cross-References

- **AXIOMS.md A3**: Linked Subgraph Constraint (source axiom)
- **AXIOMS.md <a href="/axioms#a4-refs" class="wiki-link">A4</a>**: ID Strategy — Abstract Handles, Not Raw IDs
- **<a href="/decisions/D12-scope-clone-on-copy" class="wiki-link">D12</a>**: Scope clone-on-copy (different scenario — copy creates new IDs)
- **<a href="/decisions/D20-id-type-convergence" class="wiki-link">D20</a>**: ID type convergence (branded IDs enable compile-time safety)
- **<a href="/decisions/D7-widget-shape-and-persistence" class="wiki-link">D7</a>**: Widget shape & persistence
