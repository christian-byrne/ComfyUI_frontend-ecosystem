---
source_url: file://core/packages/runtime-core/
type: repo
date_accessed: 2026-04-14
relevance: 5
---

# Vue Runtime-Core: Setup Functions, Lifecycle Hooks, and Hoisted State

## Summary

Vue's runtime-core implements a component system where a `setup()` function runs once per component lifetime, creating reactive state that persists across re-renders ("hoisted state"). Lifecycle hooks (`onMounted`, etc.) register callbacks by capturing the implicit `currentInstance` global. Dependency injection (`provide`/`inject`) uses a prototype-chain pattern for O(1) lookups. The entire system is coordinated by `EffectScope` — each component instance owns a scope that collects all reactive effects created during setup, enabling automatic cleanup on unmount.

## Evidence Table

| # | Finding | Source | Confidence | Key Quote |
|---|---------|--------|------------|-----------|
| 1 | `currentInstance` is a module-level global; `setCurrentInstance()` sets it and activates the instance's `EffectScope` | `component.ts:718,773-781` | high | `internalSetCurrentInstance(instance); instance.scope.on()` |
| 2 | `setupStatefulComponent()` calls `setCurrentInstance()`, then invokes the user's `setup()` function with props and setupContext | `component.ts:829-927` | high | `const reset = setCurrentInstance(instance); const setupResult = callWithErrorHandling(setup, instance, ...)` |
| 3 | Lifecycle hooks use `createHook()` factory: captures `currentInstance` at call time, pushes wrapped callback onto instance's hook array | `apiLifecycle.ts:20-79` | high | `const hooks = target[type] \|\| (target[type] = []); hooks.push(wrappedHook)` |
| 4 | `injectHook()` wraps user callbacks with `pauseTracking()` + `setCurrentInstance(target)` — re-establishes context at invocation time | `apiLifecycle.ts:30-44` | high | `pauseTracking(); const reset = setCurrentInstance(target); const res = callWithAsyncErrorHandling(hook, target, type, args); reset(); resetTracking()` |
| 5 | `provide()` creates a new provides object via `Object.create(parentProvides)` — prototype chain enables O(1) inject | `apiInject.ts:10-34` | high | `provides = currentInstance.provides = Object.create(parentProvides)` |
| 6 | `inject()` traverses the provides prototype chain; falls back to appContext provides for root components | `apiInject.ts:47-85` | high | `if (provides && (key as string \| symbol) in provides) return provides[key]` |
| 7 | Each component instance gets a detached `EffectScope` at creation time | `component.ts:636` | high | `scope: new EffectScope(true /* detached */)` |
| 8 | Component instance inherits parent's `provides` object by reference; only creates own when `provide()` is called | `component.ts:643` | high | `provides: parent ? parent.provides : Object.create(appContext.provides)` |
| 9 | `SetupContext` exposes `attrs`, `slots`, `emit`, and `expose()` — this is the second argument to `setup()` | `component.ts:288-300` | high | `{ attrs, slots, emit, expose }` |
| 10 | `handleSetupResult()`: if setup returns an object, it becomes `instance.setupState` wrapped in `proxyRefs()` | `component.ts:929-967` | high | `instance.setupState = proxyRefs(setupResult)` |

## Detailed Analysis

### The Setup Function Execution Model

The core sequence in `setupStatefulComponent()`:

1. **Create proxy**: `instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers)` — this becomes `this` in templates
2. **Pause tracking**: `pauseTracking()` — setup shouldn't track reactive deps (that's the render effect's job)
3. **Set current instance**: `setCurrentInstance(instance)` — makes this instance the `currentInstance` global AND activates its `EffectScope`
4. **Call setup()**: `setup(props, setupContext)` — user code runs. Any `onMounted()`, `watch()`, `computed()` calls inside capture this instance
5. **Reset**: `reset()` restores previous instance; `resetTracking()` restores tracking state
6. **Handle result**: If setup returns an object → becomes template-accessible state; if function → becomes render function

### How Lifecycle Hooks Capture Context

`createHook(lifecycle)` returns a function that:
1. Takes `hook` callback and optional `target` (defaults to `currentInstance`)
2. Calls `injectHook(lifecycle, hook, target)` which:
   - Gets/creates the hook array on the target instance: `target[type] || (target[type] = [])`
   - Wraps the user's hook in an error-handling wrapper (`__weh`) that:
     - Pauses tracking (hooks shouldn't create reactive deps)
     - Re-establishes `currentInstance` to the target instance
     - Calls the user's hook
     - Restores previous state

**Key insight**: The `currentInstance` global is what makes hooks work without explicit instance passing. It's set during `setup()` execution and during hook invocation, enabling nested hook calls.

### How Hoisted State Works

"Hoisted state" means: reactive state created in `setup()` lives for the component's entire lifetime, not per-render.

1. **setup() runs once** — when the component mounts, not on every render
2. **Closures capture refs**: `const count = ref(0)` creates a ref that persists across re-renders because `setup()` only runs once
3. **EffectScope captures effects**: Any `watch()`, `computed()`, `watchEffect()` called during setup are registered in the component's `EffectScope`
4. **Render effect reads refs**: The render function (returned by setup or compiled from template) runs inside a `ReactiveEffect` that tracks which refs it reads
5. **On unmount**: `scope.stop()` disposes all effects, watchers, and cleanups created during the component's lifetime

This is fundamentally different from React's hooks (which re-run on every render). Vue's setup runs once and creates stable closures.

### provide/inject — Prototype Chain DI

- **provide(key, value)**: If the instance's `provides` object is the same reference as its parent's, creates a new one via `Object.create(parentProvides)`. Then sets `provides[key] = value`.
- **inject(key)**: Looks up `key in instance.parent.provides` — because `provides` uses prototype chain, this automatically traverses ancestors in O(1).
- **App-level provides**: Root components fall back to `appContext.provides`.

### The EffectScope per Component

Each `ComponentInternalInstance` has:
- `scope: EffectScope` — created as detached (doesn't auto-nest in parent scopes)
- `setCurrentInstance(instance)` calls `instance.scope.on()` — makes this scope the `activeEffectScope`
- Any `watch()`, `computed()`, `effect()` called during this time auto-registers in this scope
- When the component unmounts, `scope.stop()` cleans up all reactive effects

### SetupContext

When `setup` has >1 parameter, a `SetupContext` is created exposing:
- `attrs` — non-prop attributes
- `slots` — template slots
- `emit` — event emitter bound to the instance
- `expose(exposed)` — declares which properties are accessible via template refs

## How Hoisted State Maps to ECS Extensions

| Vue Component Concept | ECS Extension Analog |
|----------------------|---------------------|
| `setup()` function | Extension's `setup(ctx)` — runs once when extension registers for a node/widget/hook |
| `currentInstance` global | `currentExtension` global — set during extension setup, enables hook capture |
| `EffectScope` per component | `EffectScope` per extension registration — collects watchers on World components |
| `provide()/inject()` | Extension → sub-extension DI, or `provide` ECS APIs into extension context |
| `SetupContext { attrs, slots, emit, expose }` | `HookContext { world, query, mutate, emit, expose }` — extension setup context |
| `proxyRefs(setupResult)` → `setupState` | Extension's returned state becomes accessible to the hook system |
| `onMounted()` captures `currentInstance` | `onNodeCreated()` captures `currentExtension` |
| Component proxy (`this`) | Not needed — extensions use composition API pattern, no `this` context |

### The Critical Pattern: Setup + Scope = Hoisted State

```
Extension registers → setup() called → EffectScope activated
  ├── const pos = useComponent(nodeId, Position)  // creates tracked ref
  ├── watch(pos, (newPos) => { ... })              // registered in scope
  └── onNodeRemoved(() => { ... })                 // registered in scope

Extension lifecycle ends → scope.stop()
  ├── watcher stopped automatically
  ├── computed refs invalidated
  └── cleanup callbacks invoked
```

This is the exact pattern needed for ComfyUI extensions: setup runs once, reactive state is hoisted and kept alive across DOM moves (graph↔app mode), and cleanup is automatic via scope.
