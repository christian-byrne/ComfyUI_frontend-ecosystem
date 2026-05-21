# D1 — Vue Reactivity Primer: How Signals Work in Vue

> **Audience**: ComfyUI frontend team reviewing the new extension hook + setup
> function API.
> **Purpose**: Build enough Vue reactivity intuition to (a) read the engine
> code we're shipping, (b) trust why the *external* extension API is
> event-based even though the *internal* engine is reactive.
> **Source of truth**: All "how Vue actually does it" claims cite
> [`research/vue-internals/reactivity-system.md`](../research/vue-internals/reactivity-system.md)
> by row number — when in doubt, read that file's evidence table or open
> `core/packages/reactivity/` directly.

---

## TL;DR

1. **Vue reactivity is a dependency-tracking signal system.** A `ref` is a
   signal; reading `.value` inside an effect auto-subscribes; writing to
   `.value` re-runs every subscriber. No manual `subscribe()`/`unsubscribe()`.
   ([reactivity-system.md row 1, 6](../research/vue-internals/reactivity-system.md))
2. **The whole engine is three things in a triangle.** `Dep` (the source),
   `Subscriber` (the consumer — an effect or computed), and `Link` (the edge,
   simultaneously a node in two doubly-linked lists). Everything else is
   sugar over this triangle. ([rows 2, 3](../research/vue-internals/reactivity-system.md))
3. **Computed values are lazy and double-roled.** A computed is *both* a Dep
   (others can subscribe to it) *and* a Subscriber (it tracks its own
   sources). It only re-runs the getter when accessed *and* a dependency
   actually changed. ([rows 4, 5](../research/vue-internals/reactivity-system.md))
4. **`EffectScope` is the cleanup story.** Every effect/computed/watch
   created while a scope is active gets registered into it. `scope.stop()`
   tears the whole subtree down — no leaks, no manual bookkeeping. This is
   what makes per-extension and per-node hoisted state safe.
   ([row 7](../research/vue-internals/reactivity-system.md))
5. **We use Vue reactivity *inside* the engine, not at the API boundary.**
   The framework adapts World mutations → Vue reactivity → user-visible
   *events*. Extensions see plain `.on('change', fn)` callbacks; the
   batching, deduping, and lifecycle cleanup come for free from Vue.
   See [D3.3](./D3.3-events-over-signals.md) for the rationale.

---

## The Mental Model: Dependency Tracking via Effect + Proxy

Vue's reactivity is one idea executed three ways:

> *"Reading a reactive value while an effect is running creates a subscription
> from that effect to that value. Writing the value re-notifies all
> subscriptions."*

There is no `subscribe()` call. There is no observable returning a
disposer. The subscription *is* the act of reading inside an effect.

### The two globals that make it work

```
activeSub        ── the currently running Subscriber (effect / computed)
activeEffectScope ── the currently active EffectScope
```

Both are plain module-level globals. A subscriber's `run()` saves the
previous value, assigns itself, executes the user function, then restores.
This is the same pattern Vue uses for `currentInstance` in
runtime-core — set, run, restore. ([row 6](../research/vue-internals/reactivity-system.md))

```
┌─ Effect runs ─────────────────────────┐
│  saved = activeSub                    │
│  activeSub = this effect              │
│                                       │
│  ref.value  ──→  dep.track()          │
│                  creates Link(this,   │
│                               dep)    │
│  ref2.value ──→  dep2.track()         │
│                  creates Link(this,   │
│                               dep2)   │
│                                       │
│  activeSub = saved                    │
└───────────────────────────────────────┘

Later, on mutation:
  ref.value = 5  ──→  dep.trigger()
                       walks dep.subs linked list
                       schedules each subscriber
                       (batched — see "Lifecycle")
```

### Why a Link is in *two* lists

A `Link` is the edge between one Dep and one Subscriber. It is
simultaneously a node in:

- the **subscriber's** `deps` list (so the subscriber knows everything it
  depends on, for cleanup/diffing)
- the **dep's** `subs` list (so the dep knows everyone to notify on change)

Result: `O(1)` add, `O(1)` remove, `O(1)` traversal in either direction.
([row 3](../research/vue-internals/reactivity-system.md))

### Why a Proxy?

`ref()` wraps a single value in a class with a getter/setter — no Proxy
needed. But `reactive(obj)` wraps a whole object so that *any* property read
becomes a `track()` call and *any* write becomes a `trigger()` call. That
needs a Proxy, because there's no other way to intercept arbitrary property
access in JS. ([rows 1 vs. "reactive() — Proxy-Based Deep Reactivity"
section](../research/vue-internals/reactivity-system.md))

The reactivity *concept* is the same in both cases — Dep + Link +
Subscriber. The Proxy is just the property-level instrumentation.

---

## Primitives

All citations are to [`research/vue-internals/reactivity-system.md`](../research/vue-internals/reactivity-system.md)
unless otherwise noted.

### `ref(value)` — A Reactive Reference

```ts
const count = ref(0)
count.value           // read → tracks current activeSub
count.value = 1       // write → triggers dep
```

- A `RefImpl` owns exactly one `Dep`, created at construction time. (row 1)
- Object values are auto-wrapped via `toReactive()` so `ref({...}).value.x`
  is also tracked.
- `hasChanged()` short-circuits the setter when the new value is equal to
  the old — no spurious notifications.

### `reactive(target)` — A Proxy-Based Object

```ts
const state = reactive({ x: 1, y: 2 })
state.x               // read → tracks
state.x = 5           // write → triggers
```

- Backed by a `WeakMap<object, Map<key, Dep>>` (`targetMap`) — one Dep per
  *property*, lazily created on first access.
- Handles `ADD`/`DELETE`/`SET`/`CLEAR` operations (the proxy traps).
- Deep by default — nested objects are recursively wrapped.

### `computed(getter)` — A Lazy Derived Signal

```ts
const doubled = computed(() => count.value * 2)
doubled.value         // runs getter only if dirty AND accessed
```

- `ComputedRefImpl` implements *both* `Dep` and `Subscriber`. It tracks the
  refs/reactives its getter reads, *and* it can be tracked by other
  effects. (row 4)
- Lazy: getter never runs until `.value` is read.
- Dirty-flag + `globalVersion` fast path: if no reactive change has
  happened anywhere since last refresh, `.value` returns the cached result
  in O(1). (rows 5, 9)

### `effect(fn)` — A Standalone Reactive Subscriber

```ts
effect(() => {
  console.log(count.value)   // logs immediately, then on every change
})
```

- Creates a `ReactiveEffect`; `run()` sets `activeSub = this`, calls `fn`,
  restores. (row 6)
- Maintains its own `deps` linked list. On each re-run, stale links are
  pruned via `prepareDeps()` / `cleanupDeps()` — so dynamic dependencies
  (e.g., `if` branches reading different refs) work correctly.
- `effect()` is the building block. Most user code uses `watch` /
  `watchEffect` / `computed` instead.

### `watchEffect(fn)` — Effect with a User Handle

```ts
const stop = watchEffect(() => {
  console.log('count is', count.value)
})
stop()                // disposes
```

- Same as `effect()`, plus returns a `WatchHandle` (`.stop()`, `.pause()`,
  `.resume()`).
- Runs once eagerly to collect deps; re-runs on any tracked dep change.

### `watch(source, cb, options)` — Source-then-Callback

```ts
watch(count, (newVal, oldVal) => { ... })
watch(() => state.x, (newX) => { ... }, { immediate: true, flush: 'post' })
```

- Source normalisation (row 8):
  - Ref → `() => source.value`
  - Reactive → `() => traverse(source)` (recursive read to track everything)
  - Function → used as-is
- Built on `ReactiveEffect`: the source getter is the effect body; a custom
  scheduler runs the user callback with `(new, old)`.
- `onWatcherCleanup(fn)` lets the callback register cleanup that runs
  before the *next* invocation (e.g., abort an in-flight fetch).

### Quick decision matrix

| You want to…                                  | Use            |
|-----------------------------------------------|----------------|
| Hold a single mutable value                   | `ref`          |
| Hold a structured object                      | `reactive`     |
| Derive a value lazily, cached                 | `computed`     |
| Run a side effect that auto-tracks            | `watchEffect`  |
| React to *specific* sources with old + new    | `watch`        |
| Build your own primitive on top               | `effect`       |

---

## Lifecycle: When Effects Run

This is where most surprises live, so it gets its own section.

### 1. Setting `activeSub` is synchronous

A `ReactiveEffect.run()` is fully synchronous: assign the global, run the
user fn, restore the global. There is no async window where `activeSub` is
stale — *unless* the user's code awaits, in which case any `.value` read
*after* the await happens with the *wrong* `activeSub` (likely `undefined`
or someone else's effect). This is why Vue tells you not to `await` inside
`computed` or the body of `watchEffect` for tracking-sensitive code.

### 2. Triggering is *batched*, not synchronous

When you write `ref.value = 5`, the dep doesn't immediately call each
subscriber. It enqueues them into a global batch. The batch flushes when
the outermost `endBatch()` is reached. (row 10)

```
startBatch()
  ref.value = 1     // queued
  ref.value = 2     // queued (dedup'd — same sub already NOTIFIED)
  ref2.value = 9    // queued
endBatch()          // flush: each sub runs once
```

Practical consequence: a single mutation cycle that touches 50 refs only
runs each downstream effect *once*, not 50 times.

### 3. `globalVersion` is the computed fast path

Every `dep.trigger()` increments a single integer (`globalVersion`).
Computed values record the version they last evaluated at. On `.value`
access, if `globalVersion === lastSeenVersion`, the computed *cannot* be
dirty — return cache, skip everything. (row 9)

This is why touching one ref doesn't cascade-cost across hundreds of
unrelated computeds: the unrelated ones short-circuit on the version
check before doing any work.

### 4. Flush timing for `watch` (`pre`, `post`, `sync`)

`watch` has a `flush` option that controls *when* the callback fires
relative to Vue's render cycle:

| `flush`  | When the callback runs                                         |
|----------|----------------------------------------------------------------|
| `'pre'`  | Default. Before the next DOM update — batched into a microtask |
| `'post'` | After the next DOM update — useful for reading rendered DOM    |
| `'sync'` | Immediately, synchronously inside `dep.trigger()`              |

For our engine, "render cycle" = "frame tick". We will likely default to
`'pre'` semantics (microtask-batched) and expose `'sync'` only for
bridging into LiteGraph's existing imperative rendering loop.

### 5. Dep cleanup is automatic but version-driven

Each `Link` has a `version` field. Before re-running an effect, the engine
marks every existing link `version = -1`. As the effect runs and re-tracks
its deps, freshly-touched links get the current version. Links still at
`-1` afterwards were *not* re-read this run → they get unlinked. This is
how dynamic dependencies (e.g., `if (cond) ref1.value else ref2.value`)
shed dependencies that no longer matter.

---

## EffectScope — The Lifecycle Container

```ts
const scope = effectScope()

scope.run(() => {
  const x = ref(0)
  const doubled = computed(() => x.value * 2)
  watch(x, () => { /* ... */ })
  // All three are auto-registered into `scope.effects[]`
})

scope.stop()   // disposes ALL three at once
```

Key facts (row 7):

- `EffectScope` collects every `ReactiveEffect` created while
  `activeEffectScope === this`.
- Non-detached scopes nest: a child scope created inside a parent is added
  to `parent.scopes[]`. `parent.stop()` recurses.
- `onScopeDispose(fn)` registers an arbitrary cleanup (not necessarily an
  effect) — useful for closing sockets, clearing maps, etc.
- Vue uses one detached scope per component instance. We use one detached
  scope per **extension instance** and one per **node entity**.

This is the mechanism that makes "hoisted state" tractable. State that
lives "for as long as the extension is loaded" or "for as long as the
node exists" is just state created inside that scope. Tear-down is
exactly one call.

---

## Why We Use Vue Internally but Expose Events Externally

This is the most important part of this doc for reviewers, because it's
where D1 and [D3.3](./D3.3-events-over-signals.md) connect.

### What we get from Vue's reactivity *inside* the engine

- **Free batching.** A single frame may mutate a node's position, size,
  three widget values, and two property entries. Vue's batch system
  guarantees each downstream subscriber is notified once, in topological
  order, after the batch closes.
- **Free dedup.** Two writes to the same component value within a batch
  collapse into one notification. (`hasChanged()` at the ref level + the
  `NOTIFIED` flag at the batch level.)
- **Free transitive updates.** A computed that derives from a World query
  re-derives only when an upstream dep actually changed, with O(1)
  short-circuit via `globalVersion`.
- **Free cleanup.** When an extension unloads or a node is removed, one
  `scope.stop()` releases every watcher, every computed, every event
  binding wired through that scope.

### What extensions actually do (recapping D3.3 evidence)

```ts
// All real extension patterns reduce to:
event fires → read state → mutate state
```

No real extension composes multiple reactive sources. None derive computed
values from multiple refs. None need auto-tracking. They want callbacks.
([D3.3 §"Evidence: Real Extension Patterns"](./D3.3-events-over-signals.md))

### So we adapt one to the other

Internally:

```ts
// engine code, never seen by extension authors
scope.run(() => {
  watch(
    () => world.getComponent(entityId, Position),
    (newPos) => listeners.get('positionChanged')?.forEach(fn => fn(newPos))
  )
})
```

Externally:

```ts
// extension author API
node.on('positionChanged', (pos) => { ... })
```

The watcher *is* the bridge. The extension author writes a callback;
the engine writes a Vue `watch` that fans the callback out. Extensions
get a vocabulary of ~10 events; the engine gets all of Vue's batching,
deduping, and scope-based cleanup for free.

### What extensions *don't* see

- No `.value` accessor.
- No `WritableSignal` / `ReadableSignal` types.
- No "tracking context" — calls outside a setup function don't behave
  mysteriously differently.
- No need to learn `computed` vs. `watch` vs. `watchEffect`.
- No "why didn't my watcher fire?" debugging from forgotten `.value`
  reads.

### What reviewers should check in implementation PRs

1. Every `watch`/`watchEffect`/`effect` call in the engine must run inside
   a known scope (extension scope or entity scope). Loose effects =
   guaranteed leaks.
2. Event listener `Set`s registered via `node.on(...)` must register an
   `onScopeDispose` cleanup that removes the listener when the scope ends.
3. Public types must not leak `Ref<T>` or `ComputedRef<T>`. If you see
   either in a `.d.ts` exposed to extensions, that's a regression of D3.3.
4. Anywhere we cross the "event boundary" (Vue change → fired event), we
   must `pauseTracking()` around the user's callback so the user
   accidentally reading a ref doesn't subscribe their callback into our
   internal scope.

---

## Glossary

Terms reviewers will see in implementation PRs and design discussions.

| Term | Meaning |
|------|---------|
| **Dep** | A trackable dependency. Owns a doubly-linked list of `Link` nodes pointing to its subscribers. Created per-`ref` and per-property of a `reactive()` proxy. |
| **Subscriber** | Anything that consumes deps. Concrete forms: `ReactiveEffect`, `ComputedRefImpl`. Owns its own doubly-linked list of `Link` nodes pointing to its deps. |
| **Link** | The edge between exactly one Dep and one Subscriber. Holds a `version` field used for stale-dep cleanup. |
| **`activeSub`** | Module-level global. The Subscriber currently running. `dep.track()` reads this to know who to link to. |
| **`activeEffectScope`** | Module-level global. The EffectScope currently active. `new ReactiveEffect()` reads this to know which scope to register into. |
| **`globalVersion`** | A monotonically incrementing integer bumped on every `dep.trigger()`. Computed values use it as an O(1) "anything changed?" check. |
| **`ReactiveEffect`** | The runtime class that wraps a function as a Subscriber. `effect()`, `watch()`, `watchEffect()`, and Vue's render function all create one. |
| **`ComputedRefImpl`** | The class implementing `computed()`. Both Dep and Subscriber. |
| **`RefImpl`** | The class implementing `ref()`. Owns one Dep. |
| **EffectScope** | Container that collects all reactive effects created while it's active. `stop()` disposes the whole subtree. The unit of cleanup. |
| **`onScopeDispose(fn)`** | Registers an arbitrary cleanup callback into the active scope. Runs when the scope stops. |
| **Batch** | The window between `startBatch()` and the matching `endBatch()`. Subscribers triggered inside are queued and deduped, then run once on flush. |
| **`flush: 'pre' \| 'post' \| 'sync'`** | `watch` option controlling *when* the callback fires relative to render. We default to `'pre'`. |
| **`pauseTracking()` / `resetTracking()`** | Temporarily disable `activeSub` so reads inside don't create subscriptions. Used inside lifecycle-hook wrappers and event-listener invocations. |
| **`toRaw(x)`** | Returns the underlying non-proxied object. Useful when comparing identity or interfacing with non-reactive APIs. |
| **`shallowRef` / `shallowReactive`** | Variants that don't recurse into nested objects. Useful for big immutable payloads (e.g., serialized workflow JSON). |
| **`markRaw(x)`** | Marks an object so `reactive()` and friends will *not* wrap it. Used for class instances we never want proxied (LiteGraph nodes, Three.js objects). |
| **`triggerRef(ref)`** | Manual notification when you've mutated a `shallowRef`'s contents in place. |

---

## Further Reading

- [`research/vue-internals/reactivity-system.md`](../research/vue-internals/reactivity-system.md) — evidence-table deep dive into the reactivity package.
- [`research/vue-internals/runtime-core-hooks.md`](../research/vue-internals/runtime-core-hooks.md) — how Vue's `setup()` + lifecycle hooks compose with EffectScope. Read alongside [D2](./D2-vue-setup-function-primer.md).
- [D2 — Vue Setup Function Primer](./D2-vue-setup-function-primer.md) — what `setup()` does and how `currentInstance` works. Companion to this primer.
- [D3.3 — Events Over Signals](./D3.3-events-over-signals.md) — the design rationale for keeping the *external* surface event-based.
- [D3.5 — Reactive Dispatch and Scope Alignment](./D3.5-reactive-dispatch-and-scope-alignment.md) — how the event adapter is wired and which scope owns which listener.
