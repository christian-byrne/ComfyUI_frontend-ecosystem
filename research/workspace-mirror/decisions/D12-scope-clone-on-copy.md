# D12 — `NodeInstanceScope` Copy/Paste Semantics

**Status:** accepted
**Date:** 2026-05-07
**Accepted:** 2026-05-08 — open questions resolved with defaults (see §Open Questions below)
**Origin:** I-NEW.1b (spawned by I-NEW.1 finding that ADR 0006 does NOT answer the scope-on-copy question)
**Related:**
- ADR 0006 (PrimitiveNode copy/paste lifecycle — *narrowly* about widget value loss; orthogonal to this decision). Summary: [`research/architecture/adr-0006-primitive-copy-paste-summary.md`](../research/architecture/adr-0006-primitive-copy-paste-summary.md).
- D2 (Vue setup function primer — defines `NodeInstanceScope` ≈ Vue `ComponentInternalInstance` + `EffectScope`)
- D3.5 (Reactive dispatch & scope alignment — defines mount/unmount via `watch(() => world.queryAll(NodeType))` and `LoadedFromWorkflow` tag)
- D6 (parallel paths migration), D7 (widget shape & persistence)
- I-SR.1 (NodeInstanceScope definition — DONE), I-SR.2 (scope registry — pending; this ADR feeds its design)

---

## Context

### Why this matters

A node entity in ComfyUI can be **copied** (Ctrl-C / Ctrl-V, duplicate, drag-with-modifier, paste from clipboard JSON, paste from another tab). When that happens, a new entity is created — a new `NodeEntityId`, a new place in the World, the new node will be picked up by the reactive mount watcher in D3.5 and have extensions mounted for it.

But copy/paste also implies that the *user expects* some relationship between the source and the clone. At minimum, the clone has the same node type, the same widget values (modulo ADR 0006's PrimitiveNode bug), and the same connections to the extent the user wanted to preserve them. The question this ADR resolves is the orthogonal one:

> When a node is copy/pasted, what happens to its `NodeInstanceScope`?
> Specifically: the extension-owned reactive state (`extensionState`, `EffectScope`-registered watchers, lifecycle-hook callbacks, `provide`/`inject` bindings) created by extension `setup()` against the original entity.

### Why ADR 0006 doesn't answer this

I-NEW.1 ingested ADR 0006 and found its title ("PrimitiveNode Copy/Paste Lifecycle") oversells its scope. ADR 0006 is *only* about the narrow case where `LGraphNode.serialize()` drops `widgets_values` because PrimitiveNode lazily creates `this.widgets` on connection. It says nothing about extension state, `EffectScope` lifetime, or what should happen to a `provide('counterApi', ...)` binding when the providing node is duplicated.

Two of ADR 0006's three options (B "clone-configured-instance lifecycle" and C "projection model") are widget-data-shape decisions. The scope-on-copy decision is independent of all three: whichever serialization shape we pick for widgets, we still must define what happens to the per-entity `EffectScope` on copy.

### Why "do nothing" is not an option

The reactive mount watcher in D3.5 will *automatically* call `mountExtensionsForNode(newEntityId)` for the pasted node, because the new entity satisfies `world.queryAll(NodeType)`. This means **the framework will run extension `setup()` against the new entity no matter what we decide here**. The decision is about whether — and what — state we hand to that new setup call:

```diagram
                                copy/paste
   ╭─────────────────╮          ─────▶          ╭─────────────────╮
   │ Source entity   │                          │ Clone entity    │
   │   id: N7        │                          │   id: N42       │
   │   scope: S7     │       this ADR ───▶      │   scope: ???    │
   │   extState: {…} │                          │   extState: ??? │
   ╰─────────────────╯                          ╰─────────────────╯
```

The reactive mount system (D3.5) already builds `S42` and runs `setup()` against `N42`. The three choices below differ only in **what `S42` and its `extensionState` start out containing**.

---

## Options

In all three options, the source `NodeInstanceScope` is left untouched: source `S7` continues to live, watch, and dispatch as before. The difference is purely about the clone.

### Option (a) — Clone-on-copy (Vue-component-clone analog)

A new entity, a new scope, and the source's `extensionState` is **deep-cloned (snapshot)** into the new entity *before* the reactive mount watcher runs `setup()` against the clone. `setup()` then runs against an entity that already has a populated `extensionState`, and is expected to detect this and rehydrate rather than initialize from scratch.

```ts
// In the copy/paste handler, before world.addEntity(cloneId, …)
function copyNodeEntity(sourceId: NodeEntityId): NodeEntityId {
  const cloneId = world.createEntity()
  copyComponents(sourceId, cloneId)              // NodeType, widgets, etc.

  // NEW: snapshot extension state for the clone
  const sourceState = entityExtensionState.get(sourceId)
  if (sourceState) {
    entityExtensionState.set(
      cloneId,
      structuredClone(toRaw(sourceState))         // deep, ref-aware snapshot
    )
    world.addComponent(cloneId, ClonedFromSource, { sourceId })
  }
  return cloneId
}

// Extension setup must opt into rehydration
defineNodeExtension({
  name: 'counter',
  setup(ctx) {
    const prior = ctx.priorState                  // populated for clones
    const count = ref(prior?.count ?? 0)
    return { count }
  }
})
```

This mirrors the closest thing Vue actually has to "component clone": *nothing*. Vue components are not cloneable; a parent vnode that produces a "duplicated" subtree just mounts a fresh instance. (See §"What is *not* analogous" in D2 — Vue has no clone primitive.) Option (a) is therefore an analog we are *inventing*, not one we are inheriting.

### Option (b) — Share-and-refcount

Both source and clone point at **the same** `NodeInstanceScope` (and the same `extensionState` object). The scope holds a refcount equal to the number of entities referencing it; `scope.stop()` only fires when the last referent is removed.

```ts
function copyNodeEntity(sourceId: NodeEntityId): NodeEntityId {
  const cloneId = world.createEntity()
  copyComponents(sourceId, cloneId)

  const sourceScope = scopeRegistry.get(sourceId)
  if (sourceScope) {
    scopeRegistry.set(cloneId, sourceScope)
    sourceScope.refcount = (sourceScope.refcount ?? 1) + 1
  }
  return cloneId
}

function unmountExtensionsForNode(nodeId: NodeEntityId): void {
  const scope = scopeRegistry.get(nodeId)
  if (!scope) return
  scope.refcount = (scope.refcount ?? 1) - 1
  if (scope.refcount <= 0) scope.stop()
  scopeRegistry.delete(nodeId)
}
```

In this world the reactive watcher must learn to *not* run `setup()` for an entity whose scope already exists from a sharing arrangement.

### Option (c) — Reset-to-fresh-setup

A new entity, a new scope, an **empty `extensionState`**, and the reactive mount watcher runs `setup()` fresh against the clone — exactly as if the clone were a brand-new node typed in by the user. `setup()` has no `priorState` parameter and no rehydration path; whatever `setup()` does with the World/widget data of the new entity is what the clone gets.

```ts
function copyNodeEntity(sourceId: NodeEntityId): NodeEntityId {
  const cloneId = world.createEntity()
  copyComponents(sourceId, cloneId)              // includes widget values
  // Nothing else. Reactive watcher in D3.5 will call mountExtensionsForNode(cloneId)
  // which runs ext.setup(createNodeHandle(cloneId)) against an empty extensionState.
  return cloneId
}

defineNodeExtension({
  name: 'counter',
  setup(ctx) {
    // Always starts from zero. If the user wants per-node state to round-trip
    // copy/paste, they must persist it via widgets / serialization, not via
    // extensionState.
    const count = ref(0)
    return { count }
  }
})
```

This is the same shape as the reactive watcher's existing "new node" path. Copy/paste becomes invisible to extensions; they cannot tell whether `setup()` is running for a freshly-typed node, a freshly-pasted node, or a freshly-loaded-from-workflow node *without* opting into the `LoadedFromWorkflow` distinction (D3.5).

---

## Tradeoffs

| Dimension                | (a) Clone-on-copy                                                                 | (b) Share-and-refcount                                                                              | (c) Reset-to-fresh                                                       |
|--------------------------|-----------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------|
| **Perf (copy)**          | O(state) deep clone per copy; `structuredClone` over arbitrary user data          | O(1) — pointer aliasing                                                                             | O(1) — nothing copied                                                    |
| **Perf (steady state)**  | Two scopes, two effect graphs; no shared work                                     | One scope, one effect graph for both nodes — half the watcher cost                                  | Two scopes, two effect graphs                                            |
| **Correctness — value semantics** | ✅ Each node has its own state; mutating clone doesn't affect source       | ❌ Mutating one mutates the other — *spooky action at distance*; almost certainly wrong for users  | ✅ Each node has its own state; clone starts blank                       |
| **Correctness — rehydration**     | ✅ Possible if extension implements `priorState` rehydration                | ✅ Trivial — same memory                                                                            | ❌ Lost. Per-extension state cannot survive copy without going via widgets |
| **Correctness — refs/closures**   | ⚠️ `structuredClone` won't clone Vue refs faithfully; need custom `cloneScopeState` that re-wraps with `ref()`. Functions in state can't clone at all. | ✅ Identity preserved                                                                              | ✅ N/A — fresh setup                                                     |
| **Surprise factor**      | Medium — users may expect clone to be independent (good) but get rehydration that fires no mount hook (bad)                       | **High** — UI extensions where the clone toggles a checkbox and the source's checkbox flips too. This is a bug magnet. | Low — semantics match "fresh node"; the only surprise is "I had per-node state and it disappeared" |
| **Debuggability**        | Medium — two scopes, but the snapshot path is opaque                              | **Hard** — one scope shared across many entityIds; `console.log(scope)` doesn't tell you who owns it; lifecycle hooks fire once, not per entity | Easy — every node maps to exactly one fresh scope; no hidden state       |
| **Implementation cost**  | High — needs `priorState` on `NodeHookContext`, custom clone of ref-wrapped state, ADR + docs for rehydration contract, tests for cycles | Medium — refcounting is shallow but correctness corner cases (provide/inject parent identity, hook target ambiguity) are deep | **Low** — zero new code paths; the reactive watcher already does this |
| **Hook contract**        | `setup()` must be idempotent w.r.t. `priorState`. Either a new `onNodeRehydrated` hook fires *instead of* `onNodeMounted` for clones (more API surface), or `setup()` re-runs and we accept double-fire of mount-time effects. | `setup()` runs **once total** for the source, never for clones. Mount/unmount lifecycle hooks fire only on first-create / last-destroy — surprising for users who expect "I pasted a node, my `nodeCreated` should fire." | `setup()` runs once per entity exactly like every other code path. No new hook, no new contract.     |
| **Compat with D3.5 reactive mount** | Needs new tag (`ClonedFromSource`) and special-case in `mountExtensionsForNode` to feed `priorState` | Needs scope deduplication check in `mountExtensionsForNode` (skip if already mounted via share) | ✅ Just works — the watcher's "new entityId → mount" path is unchanged |
| **Compat with D7 widget persistence** | ⚠️ Two sources of truth on copy (cloned scope state vs. widget values may diverge) | ⚠️ Same — shared scope vs. unshared widget values diverge fast      | ✅ Single source of truth — only widgets carry copy-survival data. Forces extensions to use the persistence story we already designed. |
| **Subgraph promotion** (D2 §2.3, D7) | Subgraph promotion is *not* a copy — it's an entityId-preserving move. Unaffected.            | Same. Unaffected.                                                                                  | Same. Unaffected.                                                        |
| **Worst-case bug class** | Stale rehydration where the cloned `extensionState` references the *source* entity by id (e.g. cached `NodeHandle`) | Cross-node state corruption invisible to extension authors                                          | Lost UX state on paste — visible, fixable by routing state through widgets |

---

## Recommendation

**Pick Option (c) — Reset-to-fresh-setup.**

**Default if no preference: (c)**.

### Why (c)

1. **Simplest semantics.** A pasted entity is indistinguishable from a freshly-created entity at the extension layer. There is no new hook, no new context field, no `priorState` lookup, no refcount. The reactive mount watcher in D3.5 already does the right thing for `LoadedFromWorkflow` (re-fire `loadedGraphNode` instead of `nodeCreated`). Copy/paste needs *no* equivalent.

2. **Forces the right architecture for state that *should* survive copy.** If an extension wants a counter to round-trip copy/paste, the counter belongs in a widget (per D7) or in a serialized World component — not in an opaque `extensionState` bag. We already have a persistence story (widgets + serialization, ADR 0006's eventual outcome, I-WS); piping copy/paste through the same story keeps it the single source of truth.

3. **Hardest to misuse.** Option (b) creates spooky action at a distance that no extension author could reasonably anticipate. Option (a) creates a quiet rehydration path that runs setup against pre-populated state — a category of bug Vue chose not to inherit by *not* having a clone primitive in the first place. Option (c) has exactly one misuse mode ("my state didn't survive") and that misuse is loud, visible on the first paste, and has a documented fix.

4. **Lowest cost to land.** I-SR.2 already needs to implement the registry and the reactive mount loop. Option (c) is zero additional code in I-SR.2. Options (a) and (b) require new context fields, new tag components, new dedup logic, and a contract for what `setup()` is allowed to assume.

5. **Reversibility.** If we ship (c) and later discover that some extension genuinely needs cloned state, we can opt-in via a `cloneOnCopy: true` flag on `defineNodeExtension` that takes us to (a) for *that* extension. Going the other direction — shipping (a) or (b) and later trying to retract per-node value semantics — would break extensions in production.

### When (c) is *wrong*

If a credible extension use case appears that (1) cannot be expressed via widgets, and (2) genuinely requires the clone to inherit state, we revisit. Until then, (c) is the conservative choice.

### What (c) costs us

- **Loss of "scratch state" round-trips.** If an extension caches expensive computation in `extensionState` (e.g. a parsed AST of a code widget), the clone re-parses on first interaction. Almost always fine; if not, the extension can stash the cache in a widget or in a module-level Map keyed by node-content-hash.
- **No clean path for `provide('api', { …closures… })` to be inherited.** This is correct behavior: a closure capturing `entityId` should not silently start firing for a different `entityId`.

---

## Migration implications for I-SR.2

Concretely, here is what changes (and doesn't) in I-SR.2's implementation if D12 = (c) lands:

1. **`scopeRegistry` shape — unchanged.** Still `Map<NodeEntityId, NodeInstanceScope>`. No refcounts, no shared scopes.

2. **`mountExtensionsForNode(nodeId)` — unchanged.** No `priorState` lookup, no `ClonedFromSource` tag handling, no dedup-against-existing-scope check.

3. **`unmountExtensionsForNode(nodeId)` — unchanged.** `scope.stop()` fires on the entity removal, period; no refcount predicate.

4. **`copyNodeEntity(sourceId)` (whichever subsystem owns it — clipboard, drag-duplicate) — only copies World components (NodeType, widgets, position, color, …)**. No scope work, no `extensionState` work. The reactive watcher in D3.5 picks up the new entity and mounts.

5. **`NodeHookContext` shape — unchanged.** No new `priorState` field. No new `isCopyOfSource` flag. (If we later flip an extension into Option (a) via `cloneOnCopy: true`, *then* we add the field, opt-in only.)

6. **One small docs addition to the extension-author guide:** "If your extension needs per-node state to survive copy/paste, persist it via a widget. `extensionState` resets on copy, exactly like a fresh node."

7. **Test triple for I-SR.6 (already done) does NOT need to change** — the existing tests cover setup-runs-once, dispose-on-removal, no-dispose-on-subgraph-promotion. We should *add* one test for D12: "copy a node with extensionState, assert clone's extensionState is the setup-default, not the source's value at copy time." File this as a sub-task of I-SR.2 or a new I-SR.7.

---

## Open Questions — Resolved (2026-05-08)

1. **Cross-tab paste / paste-from-JSON-clipboard.** ✅ **Confirmed: yes.** Cross-tab paste behaves identically to "load from workflow" — fresh node + `LoadedFromWorkflow` tag from D3.5. Option (c) collapses these cases naturally; no special-case needed.

2. **Multi-paste of same source.** ✅ **Confirmed: no shared state.** Each paste is an independent fresh-mount. N pastes from the same source are N independent entity+scope pairs with no relationship to each other or the source.

3. **`cloneOnCopy: true` opt-in escape hatch.** ✅ **Confirmed: wait.** Do not ship in v1. Add only if/when a real use case surfaces. The escape hatch contract (`priorState`, idempotent setup, lifecycle hook semantics) is non-trivial and unused API is harder to remove than to add.

4. **Interaction with future ECS-promoted state.** Non-blocking observation: if extension state is later promoted into ECS World components, copy/paste of those components would clone-by-value (World copy semantics). D12's "(c) for `extensionState`" is consistent with that future — state in the World copies; state in scopes does not.

5. **Does I-WS lazy-on-access serialization change anything here?** No. I-WS is widget data; D12 is scope/extension state. Parallel, non-interacting.

---

## Cross-references

- **ADR 0006** ([summary](../research/architecture/adr-0006-primitive-copy-paste-summary.md)): orthogonal — widget value loss on copy, not scope state. D12 is the scope-side decision ADR 0006 explicitly does not make.
- **D2** §2.3, §6: `NodeInstanceScope` ≈ Vue `ComponentInternalInstance` + `EffectScope`; Vue has no clone primitive, so Option (a) is invented, not inherited.
- **D3.5**: defines the reactive mount loop that Option (c) reuses verbatim and that Options (a)/(b) modify.
- **D7**: widget shape & persistence — the persistence boundary D12 pushes "state that should survive copy" toward.
- **I-SR.1** (DONE): defines `NodeInstanceScope`. D12 specifies its copy semantics.
- **I-SR.2** (pending): registry implementation; this ADR locks its copy-path design (unchanged from new-node path).
- **I-SR.3** (pending): reactive dispatch wiring — unaffected by D12.
- **I-NEW.1**: ingestion task that surfaced this gap.
