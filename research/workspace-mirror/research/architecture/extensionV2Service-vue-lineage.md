---
source_url: file://ComfyUI_frontend/src/services/extensionV2Service.ts
type: analysis
date_accessed: 2026-04-14
relevance: 5
---

# extensionV2Service.ts — Vue Core Lineage

Each section of the service, what it does, and the Vue core code it mirrors.

---

### Scope Registry (L58–84)

One detached `EffectScope` per extension+entity pair, keyed by `"extName:entityId"`. Created on entity mount, stopped on entity removal. This is how Vue gives each component instance its own scope so all reactive effects created during that component's lifetime are automatically cleaned up on unmount.

**Vue core**: [`EffectScope` class](https://github.com/vuejs/core/blob/main/packages/reactivity/src/effectScope.ts#L6-L165) · [`instance.scope = new EffectScope(true)`](https://github.com/vuejs/core/blob/main/packages/runtime-core/src/component.ts#L636)

---

### WidgetHandle (L86–146)

A controlled surface for widget state. `getValue()`/`setValue()` are the `modelValue` equivalent — reads query the World's `WidgetValue` component, writes dispatch commands. The `on('change', fn)` event uses Vue's `watch()` on the component value internally, and `on('removed', fn)` delegates to `onScopeDispose()`.

**Vue core**: [`watch()` — creates a ReactiveEffect with scheduler](https://github.com/vuejs/core/blob/main/packages/reactivity/src/watch.ts#L120-L329) · [`onScopeDispose()` — registers cleanup in active scope](https://github.com/vuejs/core/blob/main/packages/reactivity/src/effectScope.ts#L196-L210)

---

### NodeHandle (L148–284)

A controlled surface for node state. Getters (`getPosition`, `getSize`, etc.) are World component queries. Setters (`setPosition`, `setSize`, etc.) dispatch serializable commands — the extension author gets undo/redo for free without knowing the command pattern exists. Events (`on('positionChanged', fn)`) use `watch()` on World components, converting Vue reactivity into plain callbacks.

**Vue core**: Same `watch()` pattern as WidgetHandle. The getter/setter split mirrors Vue's [`proxyRefs(setupResult)` pattern](https://github.com/vuejs/core/blob/main/packages/runtime-core/src/component.ts#L929-L967) where template access goes through a proxy that auto-unwraps refs.

---

### Extension Registry (L286–297)

A simple push-into-array registry for `defineNodeExtension()` and `defineWidgetExtension()`. Extensions self-register at module load time.

**Vue core**: Analogous to [`app.component()` registration](https://github.com/vuejs/core/blob/main/packages/runtime-core/src/apiCreateApp.ts#L210-L230) — a named registry that maps identifiers to definitions, resolved later at mount time.

---

### mountExtensionsForNode (L308–338)

The core setup sequence, directly modeled on `setupStatefulComponent()`. For each matching extension: (1) create/get a detached EffectScope, (2) `scope.run()` to activate it, (3) `pauseTracking()` to prevent the hook body from accidentally creating render-level deps, (4) call the extension's hook with a NodeHandle, (5) `resetTracking()`. Any `watch()` or `onScopeDispose()` called inside the hook auto-registers in the scope.

**Vue core**: [`setupStatefulComponent()`](https://github.com/vuejs/core/blob/main/packages/runtime-core/src/component.ts#L829-L927) — specifically lines 869–884 where it calls `pauseTracking()`, `setCurrentInstance(instance)` (which calls `instance.scope.on()`), invokes `setup()`, then `reset()` + `resetTracking()`.

---

### unmountExtensionsForNode (L340–349)

Calls `scope.stop()` for every extension bound to the removed entity. This stops all watchers, invalidates computed refs, and runs every `onScopeDispose()` cleanup registered during setup.

**Vue core**: [`unmountComponent()`](https://github.com/vuejs/core/blob/main/packages/runtime-core/src/renderer.ts#L2321-L2365) which calls `scope.stop()` · [`EffectScope.stop()`](https://github.com/vuejs/core/blob/main/packages/reactivity/src/effectScope.ts#L68-L103)

---

### startExtensionSystem (L351–384)

The reactive mount loop. A single `watch()` on `world.queryAll(NodeType)` diffs the entity list each tick — new entities trigger `mountExtensionsForNode`, removed entities trigger `unmountExtensionsForNode`. Uses `{ flush: 'post' }` so mounts happen after World mutations settle. This replaces imperative dispatch and ensures every code path that creates entities (add node, paste, load, undo, CRDT sync) automatically triggers extension mounting.

**Vue core**: Inspired by Vue's [`patch()` / `mountComponent()` / `unmountComponent()` cycle](https://github.com/vuejs/core/blob/main/packages/runtime-core/src/renderer.ts#L2241-L2365) in the renderer, which diffs the vnode tree and mounts/unmounts components reactively. Also similar to [`KeepAlive`'s activate/deactivate pattern](https://github.com/vuejs/core/blob/main/packages/runtime-core/src/components/KeepAlive.ts) which manages component scopes based on visibility.
