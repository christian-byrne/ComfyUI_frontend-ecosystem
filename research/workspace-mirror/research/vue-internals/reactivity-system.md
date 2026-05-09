---
source_url: file://core/packages/reactivity/
type: repo
date_accessed: 2026-04-14
relevance: 5
---

# Vue Reactivity System Internals

## Summary

Vue's reactivity system is a dependency-tracking signal system built on three core primitives: `Dep` (dependency), `Subscriber`/`ReactiveEffect` (consumer), and `Link` (the edge connecting them). Refs and reactive proxies create `Dep` instances; effects, computed values, and watchers are `Subscriber` instances that auto-track which deps they read. When a dep is mutated, it notifies all linked subscribers via a batched scheduling system.

## Evidence Table

| # | Finding | Source | Confidence | Key Quote |
|---|---------|--------|------------|-----------|
| 1 | `ref()` creates a `RefImpl` with a `Dep` instance; `.value` getter calls `dep.track()`, setter calls `dep.trigger()` | `ref.ts:114-165` | high | `get value() { this.dep.track(); return this._value }` |
| 2 | `Dep.track()` creates a `Link` between the dep and the current `activeSub` subscriber | `dep.ts:108-165` | high | `link = this.activeLink = new Link(activeSub, this)` |
| 3 | `Link` is a node in TWO doubly-linked lists — one for the subscriber's deps, one for the dep's subscribers | `dep.ts:32-62` | high | `nextDep, prevDep, nextSub, prevSub` |
| 4 | `ComputedRefImpl` implements `Subscriber` — it's both a dep (has `.dep`) AND a subscriber (has `.deps`) | `computed.ts:47-154` | high | `class ComputedRefImpl<T = any> implements Subscriber` |
| 5 | Computed uses dirty flags + `globalVersion` for lazy evaluation; only re-runs getter when deps changed | `effect.ts:365-419` | high | `if (computed.globalVersion === globalVersion) return` |
| 6 | `ReactiveEffect.run()` sets `activeSub = this`, runs fn, then restores previous — this is how dependency tracking works | `effect.ts:151-181` | high | `activeSub = this; shouldTrack = true; try { return this.fn() }` |
| 7 | `EffectScope` collects effects and child scopes; `stop()` stops all effects and runs cleanups | `effectScope.ts:6-165` | high | `this.effects[i].stop()` then `this.cleanups[i]()` |
| 8 | `watch()` creates a `ReactiveEffect` with a getter that traverses source, and a scheduler that calls the user callback | `watch.ts:120-329` | high | `effect = new ReactiveEffect(getter); effect.scheduler = scheduler ? () => scheduler(job, false) : job` |
| 9 | `globalVersion` increments on every reactive change, giving computed a fast-path to skip re-evaluation | `dep.ts:19,167-171` | high | `this.version++; globalVersion++; this.notify(debugInfo)` |
| 10 | Batch system: `startBatch()`/`endBatch()` defer effect execution until the batch completes | `effect.ts:236-249` | high | `sub.flags |= EffectFlags.NOTIFIED; sub.next = batchedSub; batchedSub = sub` |

## Detailed Analysis

### ref() — The Reactive Reference

`ref(value)` creates a `RefImpl` instance:
- **Constructor**: Stores raw value and converts non-shallow values via `toReactive()` (wraps objects in Proxy)
- **get value()**: Calls `this.dep.track()` which links the current `activeSub` to this ref's `Dep`
- **set value()**: Compares via `hasChanged()`, updates raw + reactive values, calls `this.dep.trigger()`
- Each `RefImpl` owns exactly one `Dep` instance (created at construction time)

### computed() — Lazy Derived Values

`ComputedRefImpl` is both a `Dep` (other effects can depend on it) AND a `Subscriber` (it tracks its own dependencies):
- **Flags**: Uses `EffectFlags.DIRTY` to know when re-evaluation is needed
- **get value()**: Calls `dep.track()` (so consumers subscribe), then `refreshComputed(this)` which only re-runs the getter if dirty
- **Lazy**: Never runs the getter until `.value` is accessed
- **globalVersion fast path**: If `globalVersion` hasn't changed since last refresh, skips entirely — O(1) cached access

### effect() / ReactiveEffect — The Subscriber

`ReactiveEffect` is the core subscriber:
- **run()**: Sets `activeSub = this`, calls `fn()`. During `fn()` execution, any `.value` reads auto-track deps
- **deps linked list**: `deps` → `depsTail` form a doubly-linked list of all deps this effect reads
- **Cleanup cycle**: `prepareDeps()` marks all links version=-1; `cleanupDeps()` removes links never re-accessed — automatic dep pruning
- **Scheduler**: `trigger()` calls `this.scheduler()` if set, else `this.runIfDirty()`
- **EffectScope integration**: Constructor auto-registers into `activeEffectScope.effects[]`

### watch() — Scheduled Observation

`watch(source, cb, options)` is built on `ReactiveEffect`:
- **Source normalization**: Ref → `() => source.value`; Reactive → `() => traverse(source)`; Function → used directly
- **Deep traversal**: `traverse(value, depth)` recursively reads all properties to track them
- **Job pattern**: Creates a `job()` closure that runs the effect, compares old/new values, calls user callback
- **Cleanup**: `onWatcherCleanup()` registers cleanup fns in a WeakMap keyed by effect
- **Handle**: Returns a `WatchHandle` with `.stop()`, `.pause()`, `.resume()`

### effectScope() — Lifecycle-Scoped Cleanup

`EffectScope` manages the lifetime of reactive effects:
- **Collection**: `scope.effects[]` collects all `ReactiveEffect` instances created while scope is active
- **Nesting**: Non-detached scopes register as children of `activeEffectScope`; `stop()` recurses into child scopes
- **Cleanups**: `scope.cleanups[]` holds arbitrary cleanup functions (registered via `onScopeDispose()`)
- **run()**: Sets `activeEffectScope = this`, runs fn, restores previous — same pattern as `activeSub`
- **on()/off()**: For manual scope activation (used by Vue's component system to activate component scope)

### reactive() — Proxy-Based Deep Reactivity

`reactive(target)` wraps objects in a Proxy:
- **targetMap**: `WeakMap<object, Map<key, Dep>>` — maps each reactive object's properties to their Dep instances
- **track(target, type, key)**: Creates/retrieves a Dep for the property and calls `dep.track()`
- **trigger(target, type, key, ...)**: Retrieves the Dep and calls `dep.trigger()` — handles ADD/DELETE/SET/CLEAR operations

### The Dep/Link/Subscriber Triangle

The core data structure is a bipartite graph:
- **Dep**: A trackable dependency. Owns a subscriber list (`subs` linked list of Links)
- **Subscriber**: An effect or computed. Owns a dependency list (`deps` linked list of Links)
- **Link**: The edge. Member of TWO linked lists simultaneously. Has `version` for staleness detection

This enables O(1) subscribe/unsubscribe and automatic cleanup of stale dependencies.

## Applicability to ECS Hook System

| Vue Concept | ECS Hook Analog |
|-------------|-----------------|
| `ref()` | World component query result wrapped as signal — e.g., `useComponent(nodeId, Position)` returns a ref-like signal |
| `computed()` | Derived ECS queries — e.g., `computed(() => world.queryAll(NodeType).filter(...))` |
| `watch()` | System triggers — watch for component changes and execute callbacks |
| `effectScope()` | Extension lifecycle scope — created when extension registers, stopped when extension unloads. Critical for cleanup |
| `activeSub` global | `currentExtension` global — during hook setup, the active extension context captures reactive subscriptions |
| `Dep.track()/trigger()` | World mutation notifications — when `setComponent()` is called, trigger deps for that entity+component |
| Batch system | Frame-aligned batching — collect all mutations, notify subscribers once per frame |

**Key insight**: Vue's `EffectScope` is the exact mechanism needed for "hoisted client state." An extension's setup function runs inside a scope; all reactive effects created during setup are captured by that scope; when the extension is torn down, `scope.stop()` cleans up everything automatically.
