# D2 — Vue Setup Function Primer: How Hoisted State Works

> **Audience**: ComfyUI frontend team (Vue-fluent) + external contributors designing/consuming the ECS hook + setup-function API
> **Purpose**: Build a shared mental model of Vue's `setup → scope → lifecycle` pattern so we can faithfully port it to `defineNodeExtension(setup)`
> **Cross-refs**: [D1 — Vue Reactivity Primer](./D1-vue-reactivity-primer.md), [D3.5 — Reactive Dispatch & Scope Alignment](./D3.5-reactive-dispatch-and-scope-alignment.md), [research/vue-internals/runtime-core-hooks.md](../research/vue-internals/runtime-core-hooks.md)

---

## TL;DR

- **`setup()` runs exactly once** per component instance (not per render). Everything declared inside is a stable closure for that instance's entire lifetime.
- **"Hoisted state" = state that lives above the render boundary.** Refs, computeds, watchers created in `setup()` survive every re-render; they only die when the component instance dies (`scope.stop()`).
- **Two storage slots after setup**: `instance.setupState` (the returned object, ref-unwrapped, used by render) and `instance.ctx` (the proxy backing `this` in templates). State you `return` lives in `setupState`; private state stays in setup's closure.
- **Lifecycle hooks (`onMounted`, etc.) and `provide/inject` work via an implicit `currentInstance` global** that Vue sets before calling your `setup()` and restores after. No explicit instance argument needed.
- **We copy this model verbatim for ComfyUI extensions**: `defineNodeExtension({ setup(ctx) { ... } })` runs once per node entity, owns an `EffectScope`, captures lifecycle hooks via `currentExtension`, and survives DOM moves (graph ↔ app, subgraph promotion) because the scope is bound to the ECS entity, not the DOM node.

---

## 1. The Setup Function Lifecycle

### 1.1 When it runs

`setup()` is called once, inside `setupStatefulComponent()`, during the component's mount phase — *before* the first render. From `core/packages/runtime-core/src/component.ts:829`:

```ts
function setupStatefulComponent(instance) {
  // 1. Build the public proxy that backs `this` in templates
  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers)

  // 2. Pause tracking — setup itself must not become a reactive dep of any outer effect
  pauseTracking()

  // 3. Set the global + activate the instance's EffectScope
  const reset = setCurrentInstance(instance)
  //   → currentInstance = instance
  //   → instance.scope.on()    ← all watch/computed/effect calls now register here

  // 4. Call the user's setup() — USER CODE RUNS HERE
  const setupResult = callWithErrorHandling(
    setup, instance, ErrorCodes.SETUP_FUNCTION,
    [instance.props, setupContext]
  )

  // 5. Restore prior global + tracking state
  reset()
  resetTracking()

  // 6. Bind the return value to the instance
  handleSetupResult(instance, setupResult)
}
```

The five things that happen during step 4 — and *only* during step 4 — are the foundation of hoisted state:

1. `ref()`, `reactive()`, `computed()` — create reactive cells
2. `watch()`, `watchEffect()` — create effects, auto-registered into `instance.scope`
3. `onMounted()`, `onBeforeUnmount()`, etc. — push callbacks onto `instance.m`, `instance.bum`, etc. (captured via `currentInstance`)
4. `provide(key, val)` — clones `instance.provides` (if needed) and sets the key
5. `return { ... }` — becomes `instance.setupState`

### 1.2 What it returns, where the return value lives

`handleSetupResult()` (`component.ts:929`) does:

```ts
function handleSetupResult(instance, setupResult) {
  if (typeof setupResult === 'function') {
    instance.render = setupResult                 // setup returned a render fn
  } else if (isObject(setupResult)) {
    instance.setupState = proxyRefs(setupResult)  // setup returned bindings
  }
  finishComponentSetup(instance)
}
```

So setup's return value has exactly two valid shapes:

- **A function** → becomes `instance.render`. Used when you write a render function in JSX/h() form instead of using `<template>`.
- **An object** → becomes `instance.setupState`, wrapped in `proxyRefs()` so templates auto-unwrap `.value`.

`proxyRefs()` is what makes `{{ count }}` work in templates instead of `{{ count.value }}` — it intercepts get/set on a wrapper object and unwraps refs transparently.

---

## 2. Hoisted State: `setupState` vs `ctx` vs Closure

After `setup()` returns, a Vue component instance carries three relevant state buckets. Understanding the distinction is the key to "what is hoisted":

| Slot | Created by | What's in it | Visible to template? | Survives re-render? |
|------|-----------|--------------|---------------------|---------------------|
| **`instance.setupState`** | `return { ... }` from setup, wrapped via `proxyRefs` | Refs, computeds, plain values you returned | ✅ Yes (via proxy auto-unwrap) | ✅ Always |
| **`instance.ctx`** | `createRenderContext(instance)` | Internals: `_`, `$el`, `$slots`, plus dev tooling. Backs `this` in templates. | ✅ Yes (via PublicInstanceProxyHandlers) | ✅ Always |
| **Setup closure** | Locally `const`-declared in `setup()`, not returned | Anything you didn't return — private state, helpers | ❌ No (no `this`-access) | ✅ Always (held by closures of returned fns / watchers) |

### 2.1 What "survives re-render" really means

A re-render is when the component's render effect re-runs because a tracked ref changed. During a re-render:

- `setup()` is **not** called again.
- `instance.setupState` is **not** rebuilt — the same refs are read.
- `instance.ctx` is **not** rebuilt — same proxy, same backing object.
- Only the render function runs, producing a new vnode tree, which the renderer then diffs.

Compare with React: a function component **is** re-invoked every render; `useState` survives only because React stashes it in the fiber and re-hydrates it via call-order indexing. Vue side-steps this entirely — there's nothing to "rehydrate" because the closure never tore down.

### 2.2 What does *not* survive

- **Local `let` rebindings inside callbacks** — those rebind on each callback invocation, as in any JS closure.
- **Anything created in the render function** — the render fn runs each render, so `const x = h('div')` is per-render.
- **Anything created in a watcher callback** — same, per invocation.
- **The component instance itself across mount cycles** — unmounting destroys the instance and its scope. (`<KeepAlive>` is the exception: it pauses unmount and keeps the instance + scope cached. This is the closest Vue analog to ComfyUI's "node survives DOM moves" requirement, and it's what motivates our entity-scoped lifecycle.)

### 2.3 Hoisted state across DOM moves (the ComfyUI requirement)

ComfyUI nodes can move between graph mode and app mode, and can be promoted into / out of subgraphs. The DOM widget can be detached and re-attached. We need extension state to behave like `<KeepAlive>` *by default*: the scope is bound to the ECS entity ID, not to a DOM node or render slot.

```
Graph Mode               Subgraph Promotion              App Mode
╭───────────╮                                         ╭───────────╮
│ Widget A  │                                         │ Widget A  │
│ scope: S1 │  ────  scope S1 survives the move ────▶ │ scope: S1 │
│ entityId  │        entity unchanged                 │ entityId  │
╰───────────╯                                         ╰───────────╯
       same refs, same watchers, same provide/inject tree
```

This is the *whole reason* we are adopting Vue's setup model rather than React's hooks model: hooks-as-call-order assume a re-execution boundary aligned with renders, which is exactly what we don't want for cross-mode-stable extensions.

---

## 3. Lifecycle Hooks: How They Attach to the Current Instance

`onMounted`, `onBeforeUnmount`, `onUpdated`, etc. are all built from one factory in `apiLifecycle.ts:20`:

```ts
export const createHook = <T extends Function = () => any>(
  lifecycle: LifecycleHooks
) => (hook: T, target = currentInstance) => {
  if (!isInSSRComponentSetup || lifecycle === LifecycleHooks.SERVER_PREFETCH) {
    injectHook(lifecycle, (...args) => hook(...args), target)
  }
}

export const onMounted        = createHook(LifecycleHooks.MOUNTED)
export const onBeforeUnmount  = createHook(LifecycleHooks.BEFORE_UNMOUNT)
// etc.
```

`injectHook()` is the actual machinery:

```ts
export function injectHook(type, hook, target = currentInstance) {
  if (target) {
    const hooks = target[type] || (target[type] = [])
    const wrappedHook = hook.__weh || (hook.__weh = (...args) => {
      pauseTracking()                            // hooks shouldn't track deps
      const reset = setCurrentInstance(target)   // re-establish context for nested calls
      const res = callWithAsyncErrorHandling(hook, target, type, args)
      reset()
      resetTracking()
      return res
    })
    hooks.push(wrappedHook)
    return wrappedHook
  }
}
```

Three things to notice:

1. **Hooks are stored on the instance under a per-type array key**: `instance.m` (mounted), `instance.bum` (beforeUnmount), `instance.u` (updated), etc. The renderer iterates these arrays at the right phases.
2. **The `target` defaults to `currentInstance`** — captured *at the time you call `onMounted()`*. This is why hooks must be called synchronously inside `setup()` (or inside another hook that still has `currentInstance` set).
3. **`__weh` wrapper re-establishes context at invocation time** so that hooks-calling-hooks works (e.g., an `onMounted` callback that itself calls `provide()`).

### 3.1 Why "must call synchronously inside setup"

Outside of an active `currentInstance`, `target` is `undefined` and `injectHook` is a no-op (with a dev warning). This is the same constraint that powers our `defineNodeExtension(setup)` rule: lifecycle hooks declared outside the synchronous body of `setup` won't bind to anything.

---

## 4. `getCurrentInstance` and `provide`/`inject` — The Implicit Context Mechanism

### 4.1 `getCurrentInstance`

The escape hatch for advanced code that needs the raw instance:

```ts
export function getCurrentInstance(): ComponentInternalInstance | null {
  return currentInstance || currentRenderingInstance
}
```

It just returns the global. Because `currentInstance` is set during `setup()` and during hook invocations, `getCurrentInstance()` works in both — and returns `null` everywhere else.

We will provide an analogous `getCurrentNodeContext()` for power users, but the canonical API will pass `ctx` as the explicit first argument to `setup`. (Implicit globals are a footgun for the public API; we keep them for internal use to make hooks work.)

### 4.2 `provide` / `inject` — prototype-chain DI

```ts
// apiInject.ts — simplified
export function provide(key, value) {
  if (!currentInstance) return
  let provides = currentInstance.provides
  const parentProvides = currentInstance.parent && currentInstance.parent.provides
  if (parentProvides === provides) {
    // Lazily clone — only the first provide() in this instance creates a new object
    provides = currentInstance.provides = Object.create(parentProvides)
  }
  provides[key] = value
}

export function inject(key, defaultValue, treatDefaultAsFactory = false) {
  const instance = currentInstance || currentRenderingInstance
  if (!instance) return
  const provides = instance.parent
    ? instance.parent.provides
    : instance.vnode.appContext && instance.vnode.appContext.provides
  if (provides && key in provides) return provides[key]
  // ... fallback to defaultValue
}
```

The trick: `Object.create(parent.provides)` makes lookups walk the prototype chain, so `inject('theme')` is a single property access that automatically traverses ancestors. No tree walk, no map merge. O(1) lookup, O(1) write per key per instance.

For ComfyUI extensions, this gives us a clean way for a parent extension (e.g., a "subgraph host") to provide context to descendant extensions without explicit wiring.

---

## 5. `pauseTracking` Around Setup — Why We Copy It

Vue calls `pauseTracking()` immediately before invoking the user's `setup()`, and `resetTracking()` immediately after. The reason: setup runs *inside* a render-effect-adjacent context, and any read of a reactive ref during setup would otherwise register a dep on whatever effect is currently active. That would couple setup to renders in subtle, wrong ways.

We have the same concern for extension setup, even though we don't have a "render effect" in the Vue sense. From [D3.5](./D3.5-reactive-dispatch-and-scope-alignment.md) §"Gap: `pauseTracking()` During Setup":

```ts
import { pauseTracking, resetTracking } from 'vue'

function mountExtensionForNode(ext, nodeId, hook) {
  const scope = getOrCreateScope(ext.name, nodeId)
  scope.run(() => {
    pauseTracking()
    try {
      ext[hook]!(createNodeHandle(nodeId))   // user's setup runs here
    } finally {
      resetTracking()
    }
  })
}
```

Without this, an extension whose `nodeCreated` happens to be invoked from inside another extension's `watch` callback would accidentally register dependencies on whatever refs that outer effect is tracking. With it, extension setup is clean: it can read any ref, create any computed, and nothing leaks outward.

This is one of two gaps D3.5 identifies between Vue's pattern and our first draft (the other being a `currentExtension` global, which we defer until implicit hooks are introduced).

---

## 6. Mapping to the ComfyUI Extension API

The whole reason this primer exists: `defineNodeExtension(setup)` is to ComfyUI nodes what `defineComponent({ setup })` is to Vue components. The two APIs are intentionally near-isomorphic.

### 6.1 Side-by-side: Vue component vs ComfyUI extension

```ts
// ─── Vue component ──────────────────────────────────────────────
import { defineComponent, ref, computed, watch, onMounted, onBeforeUnmount, provide } from 'vue'

export default defineComponent({
  name: 'Counter',
  props: { initial: { type: Number, default: 0 } },

  setup(props, { emit, expose }) {
    // 1. Reactive state — hoisted, stable across re-renders
    const count = ref(props.initial)
    const doubled = computed(() => count.value * 2)

    // 2. Watchers — auto-registered in instance.scope
    watch(count, (n) => emit('change', n))

    // 3. Lifecycle hooks — captured via currentInstance
    onMounted(() => console.log('Counter mounted'))
    onBeforeUnmount(() => console.log('Counter unmounting'))

    // 4. DI — provide to descendants
    provide('counterApi', { reset: () => (count.value = 0) })

    // 5. Expose for template refs (parent.$refs.counter.bump)
    expose({ bump: () => count.value++ })

    // 6. Return → becomes setupState, accessible in template
    return { count, doubled }
  }
})

// ─── ComfyUI extension (proposed) ───────────────────────────────
import { defineNodeExtension, ref, computed, watch, onNodeMounted, onNodeRemoved, provide } from '@comfyorg/extension-api'

export default defineNodeExtension({
  name: 'counter-node',
  matches: { type: 'CounterNode' },

  setup(ctx) {
    // 1. Reactive state, hoisted to the entity (survives graph↔app moves)
    const count = ref(ctx.initial ?? 0)
    const doubled = computed(() => count.value * 2)

    // 2. Watchers — auto-registered in the per-entity EffectScope
    watch(count, (n) => ctx.emit('change', n))

    // 3. Lifecycle hooks — captured via currentExtension
    onNodeMounted(() => console.log('Counter node mounted'))
    onNodeRemoved(() => console.log('Counter node removed'))

    // 4. DI — provide to descendant extensions / subgraph children
    provide('counterApi', { reset: () => (count.value = 0) })

    // 5. Expose for cross-extension access (other extensions inject this name)
    ctx.expose({ bump: () => count.value++ })

    // 6. Return → becomes the entity's extensionState, queryable via ECS
    return { count, doubled }
  }
})
```

### 6.2 Concept-by-concept correspondence

| Vue concept | ComfyUI extension analog | Notes |
|-------------|--------------------------|-------|
| `defineComponent({ setup })` | `defineNodeExtension({ setup })` | Same shape, same once-per-instance contract |
| Component instance | ECS entity (node, widget, hook target) | Long-lived, stable ID |
| `instance.scope: EffectScope` | Per-entity-per-extension `EffectScope` | Created in `getOrCreateScope(ext.name, nodeId)` |
| `currentInstance` global | `currentExtension` global (deferred — see D3.5) | Same pattern, introduced when we add implicit hooks |
| `setup(props, setupContext)` | `setup(ctx: NodeHookContext)` | We collapse props + context into one typed `ctx` |
| `instance.setupState` | `entity.extensionState[ext.name]` | Returned object, ref-unwrapped, queryable |
| `instance.ctx` (template proxy) | Not needed | We don't have a `this`-binding template; ECS queries replace it |
| `onMounted` / `onBeforeUnmount` | `onNodeMounted` / `onNodeRemoved` | Same `currentInstance` capture trick |
| `provide` / `inject` | `provide` / `inject` (re-exported) | Vue's impl works as-is once we set `currentInstance = currentExtension` |
| `pauseTracking()` around setup | `pauseTracking()` around extension hook | See §5 + D3.5 |
| `scope.stop()` on unmount | `scope.stop()` on entity removal | Same auto-cleanup of watchers/computeds |
| `<KeepAlive>` cached instance | Default behavior — entity outlives DOM | The whole reason we picked this model |

### 6.3 What is *not* analogous

- **No template, no render function.** Extensions don't render UI in the Vue sense; they react to ECS world changes and mutate components. The "render output" of an extension is its set of side effects on the world.
- **No props validation pipeline.** Replaced by `matches` (a selector against ECS components) and the typed `ctx`.
- **No `emit` event declaration.** `ctx.emit` dispatches into the existing ComfyUI event bus; type safety comes from the events module, not from `defineNodeExtension`.
- **No `attrs` / `slots`.** Not meaningful for a non-rendering extension.

---

## 7. One-Page Mental Model

```
defineNodeExtension({
  setup(ctx) {                          ← runs ONCE per entity, per registration
    //                                    pauseTracking() in effect here
    //                                    currentExtension = this registration
    //                                    activeEffectScope = entity-bound scope
    const x = ref(0)                    ← stable for entity lifetime
    watch(x, fn)                        ← registered in the scope
    onNodeRemoved(cleanup)              ← pushed onto registration.bum
    provide('foo', api)                 ← Object.create-clones provides
    return { x }                        ← becomes entity.extensionState[name]
  }
})
        │
        ▼
Entity created in world
        │
        ▼
mountExtensionForEntity(ext, entityId)
  ├─ scope = getOrCreateScope(ext.name, entityId)
  ├─ scope.run(() => {
  │    pauseTracking()
  │    setCurrentExtension({ ext, entityId })   // future: when implicit hooks needed
  │    setup(ctx)                                ← USER CODE
  │    reset()
  │    resetTracking()
  │  })
  └─ entity.extensionState[ext.name] = proxyRefs(setupResult)

[ Entity exists. DOM may be created/destroyed/moved many times. Scope lives on. ]

        │
        ▼
Entity removed from world
  └─ scope.stop()                       ← all watchers, computeds, cleanups fire
```

If you remember one sentence: **`setup()` runs once, the scope owns everything reactive it created, and the scope's lifetime equals the entity's lifetime — not the DOM's.**

---

## 8. Open Questions / Follow-Ups

These belong to subsequent design docs but are worth flagging here:

- **`currentExtension` global**: D3.5 defers this; we'll need it the moment we ship `onNodeMounted` / `onNodeRemoved` as implicit-context hooks instead of methods on `ctx`.
- **`expose()` shape**: Vue's `expose` exposes for template `$refs`. Our equivalent — letting other extensions read state — needs an explicit registry, since there's no template ref system. Probable implementation: write into `entity.extensionState[name]` keyed by the exposed shape.
- **Hook ordering across multiple extensions on the same entity**: Vue runs lifecycle arrays in registration order. We need to decide whether extension order matters and, if so, document it (likely: registration order, with a tie-breaker on extension name for determinism).
- **Async setup**: Vue supports `async setup` via `<Suspense>`. We almost certainly want sync-only for v1 to avoid a whole class of "extension half-mounted" bugs.
