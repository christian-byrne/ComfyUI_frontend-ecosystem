# Vue Component Lifecycle & State Hoisting

> **Provenance**
> - **Source**: `vuejs/core` repository (cloned at `core/`)
> - **Commit**: `57545e958ae28ed17aa9e0ed321abcd8dc99f752`
> - **Date accessed**: 2026-05-06
> - **Files cited**: `packages/runtime-core/src/component.ts`, `packages/runtime-core/src/renderer.ts`, `packages/runtime-core/src/componentRenderUtils.ts`, `packages/runtime-core/src/components/KeepAlive.ts`
> - **Scope**: Complementary to `reactivity-system.md` and `runtime-core-hooks.md`. Focus is on (1) component instance creation, (2) setup-context creation, (3) state hoisting, (4) re-render mechanics, (5) `<KeepAlive>` cache semantics — and how each maps to the ComfyUI custom-node DOM-move problem.

---

## 1. The `ComponentInternalInstance` — Vue's "hoisted state container"

Every component in Vue is, at runtime, a single long-lived **`ComponentInternalInstance`** object. The vnode and the rendered DOM may come and go, but the instance object — and everything hanging off it — is what makes user state survive re-renders. This is the fundamental "hoisting" mechanism we want to mirror.

### 1.1 Where it is created

`createComponentInstance(vnode, parent, suspense)` builds the instance once, when the vnode is first patched into the tree. The shape (verbatim from `component.ts:614-715`) is the canonical inventory of "what survives across renders":

```ts
// component.ts:624-701
const instance: ComponentInternalInstance = {
  uid: uid++,
  vnode,                                  // the *current* vnode (mutated on update)
  type,                                   // the component definition
  parent, root: null!,
  next: null,                             // the *next* vnode pending in updateComponent
  subTree: null!,                         // the rendered child tree
  effect: null!,                          // ReactiveEffect wrapping componentUpdateFn
  update: null!,                          // bound effect.run
  job: null!,                             // bound effect.runIfDirty (scheduler)
  scope: new EffectScope(true /* detached */),
  render: null,
  proxy: null, exposed: null, exposeProxy: null, withProxy: null,
  provides: parent ? parent.provides : Object.create(appContext.provides),
  ids: parent ? parent.ids : ['', 0, 0],
  accessCache: null!, renderCache: [],
  components: null, directives: null,
  propsOptions: normalizePropsOptions(type, appContext),
  emitsOptions: normalizeEmitsOptions(type, appContext),
  emit: null!, emitted: null,
  propsDefaults: EMPTY_OBJ,
  inheritAttrs: type.inheritAttrs,
  // state -- *the hoisted slots*
  ctx: EMPTY_OBJ,
  data: EMPTY_OBJ,
  props: EMPTY_OBJ,
  attrs: EMPTY_OBJ,
  slots: EMPTY_OBJ,
  refs: EMPTY_OBJ,
  setupState: EMPTY_OBJ,
  setupContext: null,
  // suspense related ...
  // lifecycle hook arrays (bc, c, bm, m, bu, u, um, bum, da, a, rtg, rtc, ec, sp)
  isMounted: false, isUnmounted: false, isDeactivated: false,
}
```

### 1.2 Slots that are intentionally long-lived

| Slot                | Created by                 | Recreated on rerender? | Purpose                                                 |
| ------------------- | -------------------------- | ---------------------- | ------------------------------------------------------- |
| `setupState`        | `proxyRefs(setupResult)`   | **No**                 | Refs/reactives returned from `setup()` — *the* hoisted store |
| `data`              | `applyOptions` (Options API) | **No**                | Reactive data object                                    |
| `ctx`               | `createDevRenderContext` / `{_:instance}` | **No** | Backing target for the public proxy                     |
| `proxy`             | `new Proxy(ctx, PublicInstanceProxyHandlers)` | **No** | The `this` you see in templates / Options API           |
| `provides`          | inherited via prototype    | **No**                 | DI map; child instances chain off parent.provides       |
| `scope`             | `new EffectScope(true)`    | **No**                 | Owns every effect/watch/computed registered during setup |
| `bc/c/bm/m/bu/u/um/bum/da/a/...` | `injectHook` during setup | **No**       | Lifecycle hook callback arrays                          |
| `vnode`             | reassigned in `updateComponentPreRender` | **Yes** (mutated) | Always points to the *current* vnode                |
| `subTree`           | reassigned each render     | **Yes**                | Rendered output                                         |
| `props`/`attrs`/`slots` | mutated in place, not replaced | shape preserved | Reactive containers refilled by `updateProps`/`updateSlots` |

The key insight: **everything a user touches via `setup()` lives off `instance.setupState`, and `setupState` is built once and never reassigned for the life of the instance.**

---

## 2. Setup execution: `setupComponent` → `setupStatefulComponent`

### 2.1 Top-level entry (`component.ts:809-827`)

```ts
export function setupComponent(instance, isSSR = false, optimized = false) {
  isSSR && setInSSRSetupState(isSSR)
  const { props, children } = instance.vnode
  const isStateful = isStatefulComponent(instance)         // shapeFlag check
  initProps(instance, props, isStateful, isSSR)
  initSlots(instance, children, optimized || isSSR)

  const setupResult = isStateful
    ? setupStatefulComponent(instance, isSSR)
    : undefined
  ...
}
```

`initProps` and `initSlots` *fill* the existing `instance.props`/`instance.attrs`/`instance.slots` objects so that the references handed to the user inside `setup()` remain stable. This is the same pattern the renderer relies on for re-renders — see §4.

### 2.2 The setup invocation (`component.ts:829-927`)

Five operations happen in a strict order:

```ts
// 0. create render proxy property access cache
instance.accessCache = Object.create(null)
// 1. create public instance / render proxy
instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers)
// 2. call setup()
const { setup } = Component
if (setup) {
  pauseTracking()                                                      // (a)
  const setupContext = (instance.setupContext =
    setup.length > 1 ? createSetupContext(instance) : null)            // (b)
  const reset = setCurrentInstance(instance)                           // (c)
  const setupResult = callWithErrorHandling(
    setup, instance, ErrorCodes.SETUP_FUNCTION,
    [__DEV__ ? shallowReadonly(instance.props) : instance.props,
     setupContext],
  )
  resetTracking()                                                      // (a')
  reset()                                                              // (c')
  ...
  handleSetupResult(instance, setupResult, isSSR)
}
```

The four bracketed concerns are worth dissecting:

#### (a) `pauseTracking()` / `resetTracking()` — `reactivity/src/effect.ts`

Setup runs inside a **paused tracking window**: any `ref.value` reads inside `setup()` itself do *not* register dependencies on the calling effect. This matters because `setup()` is invoked synchronously from the renderer's `componentUpdateFn` (transitively via `setupComponent` → `mountComponent`), and we don't want construction-time reads to permanently couple the parent's render effect to those refs. Tracking resumes after setup returns, so subsequent reads inside `render()` *do* track normally.

#### (b) `createSetupContext` — `component.ts:1132-1188`

The second arg to `setup` (`{ attrs, slots, emit, expose }`) is a thin façade over the instance:

```ts
return Object.freeze({
  get attrs() { return attrsProxy ||= new Proxy(instance.attrs, attrsProxyHandlers) },
  get slots() { return slotsProxy ||= getSlotsProxy(instance) },
  get emit() { return (event, ...args) => instance.emit(event, ...args) },
  expose,
})
```

Every property is a live reference to the instance — there is no copying. `expose(obj)` writes back to `instance.exposed`, which `getComponentPublicInstance` (`component.ts:1190-1213`) wraps in a proxy when a parent grabs a template-ref to this child.

#### (c) `setCurrentInstance` — `component.ts:773-786`

```ts
export const setCurrentInstance = (instance) => {
  const prev = currentInstance
  internalSetCurrentInstance(instance)
  instance.scope.on()                  // *** activate the EffectScope ***
  return (): void => {
    instance.scope.off()               // *** restore previous scope ***
    internalSetCurrentInstance(prev)
  }
}
```

Two synchronized stacks are pushed:
1. `currentInstance` — read by `getCurrentInstance()`, lifecycle hooks (`onMounted` etc.), and `inject()`.
2. `EffectScope.activeEffectScope` — toggled by `scope.on()` / `scope.off()`. Any `effect`, `computed`, `watch`, `watchEffect` created inside `setup()` is auto-registered into `instance.scope`. This is what makes `scope.stop()` in `unmountComponent` (renderer.ts:2339) tear down everything in one call.

The `__SSR__` branch (`component.ts:740-771`) registers the setter into a global slot so multiple Vue copies can share `getCurrentInstance()` — irrelevant to us, but explains the indirection.

### 2.3 `handleSetupResult` — the moment state becomes "hoisted"

```ts
// component.ts:929-967
if (isFunction(setupResult)) {
  instance.render = setupResult                    // inline render fn
} else if (isObject(setupResult)) {
  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) instance.devtoolsRawSetupState = setupResult
  instance.setupState = proxyRefs(setupResult)     // *** the hoisting ***
}
finishComponentSetup(instance, isSSR)
```

`proxyRefs` wraps the returned object so that ref unwrapping happens at access time but the *underlying ref objects* are preserved by identity. The render function later reads from `setupState` (see §4.2), and because `setupState` is *the same object across every render*, all the user's `ref()`/`reactive()`/`computed()` retain identity across re-renders.

`finishComponentSetup` (`component.ts:993-1115`) compiles the template if necessary and — for the Options API — runs `applyOptions(instance)` inside another `setCurrentInstance` + `pauseTracking` window, populating `instance.data`, computed, methods, watch, lifecycle hooks.

---

## 3. State hoisting: what survives, what is rebuilt

### 3.1 The proxy chain seen from a render call

`renderComponentRoot` (`componentRenderUtils.ts:52-110`) destructures the instance and calls the user's render function with multiple aliases of the same state:

```ts
result = normalizeVNode(
  render!.call(
    thisProxy,        // this binding for Options API
    proxyToUse!,      // 1st arg: same as `this`
    renderCache,
    __DEV__ ? shallowReadonly(props) : props,
    setupState,       // <-- direct setupState reference
    data,
    ctx,
  ),
)
```

So a compiled template has *direct* lexical access to `setupState` — bypassing the proxy entirely for the hot path. Updates to a ref returned from setup → `proxyRefs(setupResult)` get/set traps → underlying ref → triggers the render effect.

### 3.2 What gets recreated each render

Inside `componentUpdateFn`'s "update" branch (renderer.ts:1466-1582):

- `nextTree = renderComponentRoot(instance)` — a brand-new vnode tree
- `instance.subTree = nextTree` — replaces the prior subtree
- `patch(prevTree, nextTree, ...)` — diff and apply DOM mutations
- `next.el = nextTree.el` — copy host-element pointer onto the new vnode
- `instance.vnode = next` is updated by `updateComponentPreRender` (renderer.ts:1616-1633) when the parent triggers the update with a new vnode

What is **not** rebuilt: `instance` itself, `setupState`, `data`, `ctx`, `proxy`, `scope`, all hook arrays, `provides`, `propsOptions`, `emitsOptions`, `accessCache`. Props/attrs/slots are *mutated in place* by `updateProps` / `updateSlots`.

### 3.3 The dev-time ergonomic detour

In dev (`component.ts:702-706`), `instance.ctx` is built by `createDevRenderContext` and `exposeSetupStateOnRenderContext` (called from `handleSetupResult`) walks `setupResult` keys and defines getters on `ctx` so `this.foo` shows up in DevTools. None of this changes the survivability story — it's only about what the *Vue extension* can see in the inspector.

---

## 4. Re-render mechanics: `setupRenderEffect` and `componentUpdateFn`

### 4.1 The reactive effect that drives renders

`setupRenderEffect` (renderer.ts:1306-1606) wires the render function as a `ReactiveEffect`:

```ts
// renderer.ts:1591-1601
instance.scope.on()
const effect = (instance.effect = new ReactiveEffect(componentUpdateFn))
instance.scope.off()

const update = (instance.update = effect.run.bind(effect))
const job: SchedulerJob = (instance.job = effect.runIfDirty.bind(effect))
job.i = instance
job.id = instance.uid
effect.scheduler = () => queueJob(job)
...
update()                                         // first run = initial mount
```

Three observations:

1. The effect itself is registered into `instance.scope`. When `unmountComponent` calls `scope.stop()`, the render effect is stopped along with every user-registered watch/computed.
2. Reactivity → `effect.scheduler` → `queueJob(instance.job)` → eventually `effect.runIfDirty()`. Updates are batched and de-duped by `instance.uid` (smaller uid = parent runs first).
3. `update()` is *the only entry point* into the component's render path. Whether triggered by `instance.update()` from `updateComponent` (parent-driven) or `effect.scheduler` (self-driven), control always lands in `componentUpdateFn`.

### 4.2 The two branches of `componentUpdateFn`

```ts
const componentUpdateFn = () => {
  if (!instance.isMounted) {
    // --- mount branch (renderer.ts:1316-1464) ---
    // beforeMount hooks (bm), render initial subTree, patch into DOM,
    // then mounted hooks (m), set isMounted = true.
  } else {
    // --- update branch (renderer.ts:1466-1582) ---
    let { next, bu, u, parent, vnode } = instance
    ...
    // pre-update sync: if parent gave us a new vnode, update props/slots
    if (next) {
      next.el = vnode.el
      updateComponentPreRender(instance, next, optimized)
    } else {
      next = vnode
    }
    // beforeUpdate hooks
    if (bu) invokeArrayFns(bu)
    ...
    const nextTree = renderComponentRoot(instance)   // <-- re-reads setupState
    const prevTree = instance.subTree
    instance.subTree = nextTree
    patch(prevTree, nextTree, hostParentNode(prevTree.el!)!, getNextHostNode(prevTree),
          instance, parentSuspense, namespace)
    next.el = nextTree.el
    ...
    if (u) queuePostRenderEffect(u, parentSuspense)  // updated hooks
  }
}
```

`updateComponentPreRender` (renderer.ts:1616-1633) is the place where **props/slots are refilled in place**:

```ts
const updateComponentPreRender = (instance, nextVNode, optimized) => {
  nextVNode.component = instance
  const prevProps = instance.vnode.props
  instance.vnode = nextVNode
  instance.next = null
  updateProps(instance, nextVNode.props, prevProps, optimized)
  updateSlots(instance, nextVNode.children, optimized)
  pauseTracking()
  flushPreFlushCbs(instance)                       // pre-flush watchers
  resetTracking()
}
```

Note: **`setup()` is never called again here.** The user's setup state is preserved verbatim; only props/slots are diffed and applied. That is the entire mechanism by which "re-render does not blow away local state" works in Vue.

### 4.3 Why setup state survives re-render

A simple chain of identity:

```
componentUpdateFn fires
  └─ renderComponentRoot(instance)
       └─ destructures `instance.setupState`
            └─ same object as before (set once in handleSetupResult)
                 └─ same proxyRefs wrapper
                      └─ same underlying refs
                           └─ same .value contents (modulo user mutations)
```

Combined with `pauseTracking()` during setup, the only effects that get registered as render dependencies are reads inside `render()` — never reads inside `setup()` itself.

---

## 5. `<KeepAlive>`: preserving instances across mount/unmount

This is the **most directly relevant** Vue mechanism for ComfyUI's "node moves between graph and app mode / subgraph promotion" problem. KeepAlive turns what would be a destroy + re-create into a deactivate + reactivate, with the entire `ComponentInternalInstance` (including `setupState` and any DOM state) preserved.

### 5.1 The cache structure (`KeepAlive.ts:111-113`)

```ts
const cache: Cache = new Map()       // CacheKey -> cached vnode (with .el, .component)
const keys: Keys = new Set()         // LRU ordering
let current: VNode | null = null
```

Cache keys are `vnode.key ?? component`, so the same component type rendered with different `key` props gets distinct cache slots. `max` enforces an LRU eviction (`KeepAlive.ts:362-365`).

### 5.2 The trick: a hidden DOM "storage container"

```ts
// KeepAlive.ts:129
const storageContainer = createElement('div')
```

When a child is "deactivated", its DOM is *moved* — not removed — into this off-document `<div>`. The `ComponentInternalInstance` and its `subTree.el` continue to point at the same live DOM nodes, just temporarily parked off-screen.

### 5.3 `activate` and `deactivate` (KeepAlive.ts:131-195)

```ts
sharedContext.activate = (vnode, container, anchor, namespace, optimized) => {
  const instance = vnode.component!
  move(vnode, container, anchor, MoveType.ENTER, parentSuspense)  // DOM back to live tree
  patch(instance.vnode, vnode, container, ...)                    // diff in case props changed
  queuePostRenderEffect(() => {
    instance.isDeactivated = false
    if (instance.a) invokeArrayFns(instance.a)                    // onActivated hooks
    ...
  }, parentSuspense)
}

sharedContext.deactivate = (vnode) => {
  const instance = vnode.component!
  invalidateMount(instance.m)
  invalidateMount(instance.a)
  move(vnode, storageContainer, null, MoveType.LEAVE, parentSuspense)  // park DOM
  queuePostRenderEffect(() => {
    if (instance.da) invokeArrayFns(instance.da)                  // onDeactivated hooks
    instance.isDeactivated = true
  }, parentSuspense)
}
```

Critically: **no `unmountComponent`, no `scope.stop()`, no `setupState` discard**. The instance is fully intact; only its `isDeactivated` flag flips.

### 5.4 How the renderer routes through these (renderer.ts:1171-1192, 2156-2158)

```ts
// processComponent (mount branch):
if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
  ;(parentComponent!.ctx as KeepAliveContext).activate(n2, container, anchor, namespace, optimized)
} else {
  mountComponent(n2, ...)
}

// unmount:
if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
  ;(parentComponent!.ctx as KeepAliveContext).deactivate(vnode)
  return
}
```

Two shape flags do the routing:
- `COMPONENT_SHOULD_KEEP_ALIVE` — set by KeepAlive in its render fn (`KeepAlive.ts:368`); intercepts unmount.
- `COMPONENT_KEPT_ALIVE` — set when KeepAlive picks an existing cache hit (`KeepAlive.ts:356`); intercepts mount, copies `vnode.el` and `vnode.component` from the cached vnode (`KeepAlive.ts:347-356`).

Tree-shaking note: the renderer never imports KeepAlive directly. Instead, KeepAlive's `setup()` writes `activate`/`deactivate` onto `instance.ctx` (`KeepAlive.ts:131-195`), and the renderer reads them via the typed `KeepAliveContext` (`KeepAlive.ts:64-74`). This is the same "context-injection across module boundaries" pattern we will likely want for ComfyUI extension hooks.

### 5.5 Cache eviction & ancestor-aware hooks

`pruneCacheEntry` (`KeepAlive.ts:218-229`) is the only thing that ever calls `unmount(cached)` — i.e., the only place a kept-alive instance actually gets destroyed. Eviction happens on:
- `include`/`exclude` prop changes (`KeepAlive.ts:232-240`),
- LRU overflow (`KeepAlive.ts:363-365`),
- KeepAlive itself unmounting (`KeepAlive.ts:261-275`).

`onActivated` / `onDeactivated` (`KeepAlive.ts:408-458`) walk the parent chain and *also* register the hook on every KeepAlive ancestor, so a deeply nested child can bubble up activation events without the renderer needing to walk the tree. The `__wdc` ("with deactivation check") wrapper short-circuits the hook if any ancestor is currently deactivated — this is the bit that prevents "ghost" lifecycle calls on parked subtrees.

---

## 6. Mapping to ComfyUI

ComfyUI custom nodes live across multiple lifecycle inflection points where today the node script and its state are torn down and re-instantiated:

| ComfyUI scenario                                  | Vue mechanism that solves the analogous problem | What we need to copy                                                                                                                                                                                                                                                                  |
| ------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node moves between graph view and app mode        | `<KeepAlive>` + `storageContainer`              | Maintain a per-node-id **NodeInstance** object (the analogue of `ComponentInternalInstance`). When the node leaves the visible graph, *park* its DOM into a hidden offscreen container instead of removing/recreating widgets. Re-attach on return.                                  |
| Subgraph promotion (node enters/exits subgraph)   | KeepAlive `activate`/`deactivate`               | Fire `onDeactivated` / `onActivated`-style hooks at the node level instead of `onCreated` / `onRemoved`. Preserve all setup-returned state by identity through the move.                                                                                                                |
| Node re-render (widget value change, prop diff)   | `componentUpdateFn` update branch + `updateComponentPreRender` | Treat widget-prop diffs as the equivalent of `updateProps` — refill the existing `inputs`/`widgets` containers in place, never re-run `setup()`. Render closure should read directly from a `setupState` map.                                                              |
| Node setup() runs once, hooks register cleanly    | `setCurrentInstance` + `EffectScope`            | Maintain a `currentNodeInstance` global stack and a per-node "scope" so calls like `useNodeState()`, `onNodeRemoved()`, `useWidget()` auto-register against the active node. One `scope.stop()` on real removal cleans up everything.                                                  |
| Setup-time state must not pollute parent effects  | `pauseTracking()` around `setup()`              | If we adopt `@vue/reactivity` (already used by ComfyUI_frontend), wrap node `setup()` invocation in `pauseTracking()`/`resetTracking()` so reads during construction do not couple us to whoever triggered the construction.                                                          |
| Proxy-based access to props/state in render fn    | `instance.proxy` + `setupState` direct param    | Expose a stable `node.state` proxy and pass it to user render/draw callbacks; never copy state into a new object on each draw.                                                                                                                                                         |
| Renderer ↔ extension communication via instance.ctx | KeepAlive injects `activate`/`deactivate` onto `ctx` | For ComfyUI we can mirror this: extensions write capability functions onto `node.ctx` and the litegraph runtime calls them by duck-typed interface, avoiding hard imports.                                                                                                              |
| Cache eviction policy for off-screen nodes        | KeepAlive `max` LRU                             | If memory becomes an issue (many parked subgraph nodes), expose a `max` knob and LRU-evict the oldest parked NodeInstance, calling its real `onRemoved` chain at that point.                                                                                                            |
| Per-instance lifecycle hook arrays                | `instance.bm/m/bu/u/um/bum/da/a/...`             | Define a fixed set of hook-array slots on NodeInstance (`onMounted`, `onBeforeUpdate`, `onActivated`, `onDeactivated`, `onUnmounted`) and a single `injectHook(type, cb, target=currentNodeInstance)` registrar. Call sites then use lightweight wrappers (`onActivated(cb)` etc.). |

### Key design decisions implied

1. **NodeInstance must be created once per node-id and persisted across DOM-attach/detach cycles** — graph deletion is the only thing that destroys it.
2. **Setup state must be returned from a `setup()` callback and stored as `instance.setupState`, untouched by re-renders.** This is the *only* way to guarantee identity-preservation of refs/widgets across moves.
3. **A `currentNodeInstance` stack is mandatory** — it is what makes the `useX()` ergonomic possible without forcing users to thread the instance through every call.
4. **An EffectScope-equivalent should own everything registered during setup** so that single-call teardown is correct on real removal.
5. **DOM moves should be implemented as `move()` (re-parent) not `remove()` + `mount()` again** — preserves any imperative DOM state (focus, scroll position, third-party widget internals) for free.

### Open questions for downstream research

- Does litegraph already separate "node logical removal" from "node DOM detach", or do we need to introduce that distinction? (Likely R5/R6 territory.)
- Does ComfyUI_frontend already vendor `@vue/reactivity` such that we can directly reuse `EffectScope`/`ReactiveEffect`, or do we need a minimal re-implementation?
- For subgraph promotion specifically: which event hook in litegraph corresponds to "this node will be moved to a different graph"? That is the trigger for our `deactivate` analogue.
