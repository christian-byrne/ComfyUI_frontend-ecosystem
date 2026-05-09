# Cross-Framework Hook/Signal Comparison
<!-- source: generated | task: S2-research | date: 2026-05-08 -->
## Implications for ComfyUI v2 Extension API

> **Purpose:** Inform `NodeInstanceScope` + `defineNodeExtension` design decisions by surveying how React, Solid, Svelte 5, TC39 Signals, and Vue each solve scope/lifetime/primitives.
>
> **Cross-refs:** D3.3 (events-over-signals), D3.5 (reactive dispatch alignment), scope-registry-spike.md

---

## 1. Primitive Comparison Table

| Aspect | React hooks | Solid | Svelte 5 runes | TC39 Signals (Preact impl) | Vue (our internal) |
|---|---|---|---|---|---|
| **State primitive** | `useState` → `[val, setter]` | `createSignal` → `[getter(), setter()]` | `$state` (compiler keyword) → `source()` | `signal(v)` → `.value` get/set | `ref(v)` → `.value` |
| **Derived/computed** | `useMemo(fn, deps)` | `createMemo(fn)` | `$derived` → `derived()` | `computed(fn)` | `computed(fn)` |
| **Side effects** | `useEffect(fn, deps)` | `createEffect(fn)` | `$effect` → `effect_root(fn)` | `effect(fn) → dispose` | `watch(src, fn)` / `watchEffect(fn)` |
| **Cleanup** | return fn from `useEffect` | `onCleanup(fn)` in owner tree | return fn from effect / `effect_root` returns disposer | return fn from `effect` callback | `onScopeDispose(fn)` / `watchStopHandle()` |
| **Scope/lifetime** | Fiber node (component instance) | Owner tree (`createRoot` → parent/child chain) | Effect tree (`create_effect` → `parent` link) | No built-in scope; manual `dispose()` | `EffectScope` + `scope.stop()` |
| **Auto-tracking** | Explicit deps array | Implicit (read during tracking context) | Implicit (compiler-injected `get()`) | Implicit (`evalContext` during `.value` read) | Implicit in `watchEffect`; explicit in `watch` |
| **Rules/constraints** | Rules of Hooks: top-level, same call order | None — no fiber, no hook index | Compiler-enforced (Svelte context only) | None — plain objects | None — `setup()` runs once |
| **Composability** | Custom hooks: plain functions calling hooks | Plain functions calling any primitive | Svelte modules with runes | Wrap in `createModel` for dispose tracking | Composables: plain functions |
| **Framework coupling** | Requires React renderer + Fiber | Requires Solid `createRoot` | Requires Svelte compiler | None — standalone library | Requires Vue app or manual `EffectScope` |

---

## 2. Key Mechanisms (from source)

### React (`ReactFiberHooks.js`)

Hooks are a **linked list on the Fiber node**. Each call to `mountWorkInProgressHook()` appends one `Hook` object (`{ memoizedState, queue, next }`). The list is walked in order on re-renders, which is why call order must be stable — the Nth hook call always maps to the Nth slot.

```
currentlyRenderingFiber.memoizedState → Hook₁ → Hook₂ → Hook₃ → null
```

`useState` mounts by appending a hook with an `UpdateQueue`. `useEffect` appends a hook whose `memoizedState` is an `Effect` descriptor (`{ create, deps, cleanup }`). Cleanup runs during commit phase, not in render.

**Lifetime:** tied to Fiber node. When the component unmounts, React runs all pending cleanups and discards the Fiber. There is no explicit "scope object" to hold — the Fiber is the scope.

**Rules of Hooks source:** `resolveDispatcher()` reads `ReactSharedInternals.H`. If called outside render (H === null), error. The call-order constraint is enforced structurally — the hook list has no names, only positions.

### Solid (`solid/packages/solid/src/reactive/signal.ts`)

The global `Owner` variable is the current reactive owner. `createComputation` registers itself into `Owner.owned`:

```ts
if (!Owner.owned) Owner.owned = [c];
else Owner.owned.push(c);
```

`createRoot(fn)` creates a new owner, sets `Owner = root`, runs `fn`, then restores `Owner`. The dispose function returned by `createRoot` calls `cleanNode(root)`, which recursively runs `node.cleanups` and disposes `node.owned`.

`onCleanup(fn)` pushes to `Owner.cleanups`. No function index — cleanups are just an array on the owner, called in order on dispose.

**Why no rules-of-hooks:** Solid tracks which computations are created during a reactive context, not their positions. `createSignal` can be called anywhere — it only matters if a computation reads it. `createEffect` registers itself as a child of the current Owner regardless of call order or nesting.

### Svelte 5 (`svelte/packages/svelte/src/internal/client/reactivity/`)

`state(v)` calls `source(v)` which creates `{ f: 0, v, reactions: null, ... }` — a plain reactive value node. No owner registration at creation time. Effects register themselves via the `parent` link:

```js
var effect = { ctx: component_context, parent: active_effect, ... }
```

`effect_root(fn)` creates `ROOT_EFFECT | EFFECT_PRESERVED` and returns a disposer that calls `destroy_effect`. Cleanup: `effect.teardown` is called during `destroy_effect`.

**Compiler model:** `$state` is a compile-time keyword. The Svelte compiler transforms:
```js
let x = $state(0)  // compile-time
// → internal: let x = state(0)  // runtime call
```
The rune syntax is not importable — it only exists in `.svelte` files during compilation. This means Svelte's model is **not portable** to non-Svelte contexts (can't use `$state` in a plain TS class), which is relevant for our extension API design.

### TC39 Signals — Preact implementation (`signals/packages/core/src/index.ts`)

A signal is a plain object `{ _value, _version, _targets, ... }`. The global `evalContext` points to the currently-evaluating `Computed | Effect`. Reading `signal.value` calls `addDependency(signal)`, which links the signal into `evalContext._sources`.

`effect(fn)` creates an `Effect`, calls `_callback()` immediately, and returns `dispose`. No owner tree — effects are standalone. The only scope primitive is manual: `dispose()` unsubscribes the effect from all its sources.

`createModel(factory)` is the scope pattern: captures all effects created during `factory()` execution and provides `model[Symbol.dispose]()` to dispose them all. This is the closest TC39 has to `EffectScope`.

**Key difference from Solid/Vue:** No implicit parent/owner. Every `effect` must be explicitly disposed. `createModel` is an opt-in grouping, not a default lifetime.

### Vue (`EffectScope` — used internally, per scope-registry-spike.md + D3.5)

`effectScope()` creates a scope. `scope.run(fn)` sets `activeEffectScope` and runs `fn`; any `watch`/`watchEffect`/`computed` created during `fn` is registered in `scope.effects`. `scope.stop()` stops all effects. `onScopeDispose(fn)` registers cleanup in the active scope.

This is the closest model to what we need: a named scope object with explicit lifetime, that can register multiple reactive sources and clean them all up at once.

---

## 3. Implications for `NodeInstanceScope`

Our `NodeInstanceScope` (one per `node.id`, created in `getOrCreateScope`, stopped in `unmountExtensionsForNode`) maps most closely to **Vue's EffectScope + Solid's createRoot** model.

### What each model teaches us:

**React's hook-list model → rejected.** Call-order sensitivity is incompatible with our `setup()` model where extensions may have branching logic based on node type. Also: React's cleanup is implicitly managed by the Fiber; we need an explicit `scope.stop()` because node removal is an external event, not a render cycle.

**Solid's owner tree → partially adopted.** The key insight: register child computations into the parent owner at creation time, and dispose recursively. Our `scope.run(fn)` achieves the same: any `watch()` created inside gets registered in the scope and stopped on `scope.stop()`. No rules-of-hooks needed because we don't use a call-order index.

**Svelte's effect_root → similar to our model.** `effect_root` = "detached effect with manual disposer." This validates `scope.stop()` as the right primitive. Svelte's compiler-only `$state` is a warning: **reactive primitives that require a special context/compiler are not portable to extension code** — extensions are plain JS/TS files.

**TC39's explicit-dispose model → design constraint confirmed.** TC39 Signals have no implicit scope. This confirms that if we exposed signals directly to extension authors (as D3.2 proposed before D3.3), every extension would need to manually dispose every signal. With no owner tree, leaks would be near-certain in extensions that authors copy-paste without understanding cleanup. Our event+callback model avoids this entirely — the framework holds all reactive state; extensions only register handlers into our scope.

**Vue's EffectScope → our internal choice.** We get: named scope object (`scopeRegistry: Map<string, NodeInstanceScope>`), `scope.run(fn)` for setup isolation, `scope.stop()` for node removal, `onScopeDispose(fn)` for per-handler cleanup within setup. Exactly what we need.

### Decisions validated by this survey:

1. **`setup()` runs once per node entity, not per render** — correct. Only React re-runs setup on state change (because hooks track state inline). Solid/Svelte/Vue all run setup once and derive changes reactively. Our `mountExtensionsForNode` calling each extension's `nodeCreated` once matches Solid/Vue semantics.

2. **`scope.stop()` on node removal, not `scope.rerun()`** — correct. There is no re-render cycle for graph nodes. Removal is final. All frameworks dispose their equivalent scope on unmount; we do the same.

3. **No rules-of-hooks** — correct. We don't use a hook index (like React's linked list). Our scope collects registrations as a flat set of event listeners + Vue watches, not an ordered array. Extensions can call `node.on(...)` inside conditionals without breaking anything.

4. **`_currentScope` global for `getCurrentScope()`** — validated by Solid's `Owner` global and React's `currentlyRenderingFiber`. All frameworks use a thread-local-equivalent global during setup execution to know which scope is active. Our `let _currentScope: NodeInstanceScope | null = null` set during `scope.run(fn)` is correct.

5. **Automatic cleanup via `onScopeDispose`** — validated by Solid's `onCleanup(fn)` registering into `Owner.cleanups`, Svelte's `effect.teardown`, and Vue's `onScopeDispose`. All frameworks attach cleanup to the owning scope, not to individual subscriptions. Our event listener cleanup should use `onScopeDispose` to avoid requiring extension authors to return cleanup functions.

---

## 4. Why Events Not Signals for Public API

> Cross-reference: `decisions/D3.3-events-over-signals.md`

Exposing signals (Solid/TC39 style) to extension authors would require them to:

1. **Understand auto-tracking** — reading `node.position.value` inside `createEffect(() => { ... })` implicitly subscribes. Missing the read means missing updates. Reading outside an effect means no subscription. This is a footgun that is not obvious from reading extension code.

2. **Manage disposal** — TC39 Signals have no owner tree. Every `effect(fn)` returns a `dispose` that must be called. Solid's `createRoot` provides an owner, but extensions are not Solid components — they have no natural root unless we create one per node (which is exactly what `NodeInstanceScope` does, but hidden from the extension author).

3. **Learn `.value` vs direct access** — `signal.peek()` for non-tracking reads, `signal.value` for tracking reads. The distinction is invisible in TypeScript's type system.

4. **Import the right framework primitives** — should extensions import from `@comfyorg/extension-api` or from `solid-js`? If we expose our internal Vue signals, we couple extensions to Vue's reactivity model and version.

**The cost of signals without implicit scope = mandatory manual dispose.** The TC39 Signals `createModel` pattern shows the only escape: capture all effects during factory, provide a group disposer. This is exactly what `NodeInstanceScope` does — internally. We give extension authors the benefits of the grouped-scope model (automatic cleanup on node removal) without exposing the signals themselves.

**The actual extension patterns don't need signals** (per D3.3 evidence):
- `onNodeCreated` + set values → single callback, no reactivity
- `onExecuted` + update widget → event handler, no derivation
- `widget.on('change')` + toggle others → imperative callback chain

All of these are push events, not pull signals. Signal auto-tracking adds value when you need pull semantics (compute X from Y and Z, automatically recompute when Y or Z change). Extensions never express this pattern.

**The right interface for extension authors is:**

```ts
// Event: pull semantics (extension decides when to read)
node.on('executed', (output) => {
  const pos = node.getPosition()      // explicit pull, no tracking
  widget.setValue(output.result)      // explicit push
})

// vs. hypothetical signal API (not our choice):
const executed = node.signal('executed')  // auto-tracking signal
const result = computed(() => executed.value?.result ?? '')  // derived
watchEffect(() => widget.value = result.value)  // auto-subscribed
// Who disposes these? When? What if executed isn't a signal type?
```

The event model is unambiguously simpler, typed without implicit tracking, and matches what extensions actually do.

---

## 5. Summary Table: Why We Made Each Choice

| Our choice | React analog | Solid analog | Svelte 5 analog | TC39 analog | Rationale |
|---|---|---|---|---|---|
| `NodeInstanceScope` per node entity | Fiber node | `createRoot` owner | `component_root` | `createModel` scope | One scope per logical entity; explicit lifetime |
| `scope.run(fn)` for setup isolation | Render phase (sets `currentlyRenderingFiber`) | Sets `Owner` | Sets `active_effect` parent | `startCapturingEffects` | Lets any primitives created inside register to the scope |
| `scope.stop()` on removal | Component unmount | `cleanNode(root)` | `destroy_effect` | `dispose()` per effect | Explicit, predictable, triggered by external event |
| No rules-of-hooks | React requires them (hook list) | Not needed | Not needed (compiler) | Not needed | We don't use call-order indexing |
| Events not signals for public API | N/A — React hooks are internal | `createSignal` would be exposed | `$state` compiler-only | `signal().value` exposure | Extensions don't compose reactive values; auto-tracking adds leaks without benefit |
| `_currentScope` global | `currentlyRenderingFiber` | `Owner` global | `active_effect` | `evalContext` | Standard thread-local-equivalent for "which scope am I in?" |
| `onScopeDispose(fn)` for cleanup | return from `useEffect` | `onCleanup(fn)` | return from effect / teardown | manual `dispose` | Attach cleanup to scope, not to caller; survives re-registration |
