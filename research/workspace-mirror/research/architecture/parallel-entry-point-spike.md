---
source: code audit — ComfyUI_frontend src/scripts/app.ts, src/services/extensionService.ts,
         src/services/extension-api-service.ts, src/extension-api/index.ts
date_accessed: 2026-05-08
task: MIG1.E4
---

# Parallel Entry Point Spike — `defineExtension` vs `app.registerExtension`

## Question

Does `defineExtension` (v2 entry point, D6 Part 1) need access to `window.app`
at module evaluation time? Where in the boot sequence must the v2 discovery call
happen, and what is the minimum hook point required in the existing loader?

## What exists today

### v1 loader path (operational)

```
app.setup()                                   ← app.ts:857
  └── useExtensionService().loadExtensions()  ← extensionService.ts:31
        ├── import('../extensions/core/index') ← loads all core extensions
        │     └── core/index.ts calls useExtensionService().registerExtension({...})
        │         for each extension at import time — no window.app reference needed
        └── Promise.all(customExtensions.map(ext => import(api.fileURL(ext))))
              └── each custom extension file calls window['app'].registerExtension({...})
                  OR useExtensionService().registerExtension({...}) at module eval
```

Key: `app.registerExtension(extension)` is a thin shim on `app.ts:2026` that
delegates immediately to `useExtensionService().registerExtension(extension)`.
`useExtensionService()` is a composable that reads Vue stores — no `window.app`
needed at call time.

### v2 entry point (scaffolded, not wired)

**`src/extension-api/index.ts`** — the public barrel. Exports:
- `defineNodeExtension`, `defineExtension`, `defineWidgetExtension` — re-exported
  from `src/services/extension-api-service.ts`
- `startExtensionSystem` — also from `extension-api-service.ts`
- All public types

**`src/services/extension-api-service.ts`** — the v2 runtime. Exports:
- `defineNodeExtension(options)` — pushes into module-level `nodeExtensions[]` array
- `defineExtension(options)` — pushes into `appExtensions[]` array
- `defineWidgetExtension(options)` — pushes into `widgetExtensions[]` array
- `startExtensionSystem()` — starts the `watch(() => world.queryAll(NodeType))`
  reactive mount loop

**`@/extension-api` alias** resolves to `src/extension-api/` via `tsconfig.json`
`"@/*": ["./src/*"]` path mapping. Current `.v2.ts` core extensions import from
`@/extension-api`, which works at typecheck and runtime via Vite.

### The gap: `startExtensionSystem()` is never called

`startExtensionSystem` is exported but has **zero call sites** in the codebase.
`app.setup()` calls `useExtensionService().loadExtensions()` (v1 only). There is
no equivalent `startV2ExtensionSystem()` call anywhere in `app.ts` or `main.ts`.

The `.v2.ts` files (`dynamicPrompts.v2.ts`, `imageCrop.v2.ts`, `previewAny.v2.ts`)
are imported by nothing — they exist on disk but are not included in
`extensions/core/index.ts` and are never dynamically imported.

## Does `defineExtension` need `window.app` at module eval time?

**No.** The implementation in `extension-api-service.ts` pushes the options object
into module-level arrays (`nodeExtensions[]`, `appExtensions[]`). This is pure
registration — no app access, no store reads, no DOM:

```ts
export function defineNodeExtension(options: NodeExtensionOptions): void {
    nodeExtensions.push(options)   // ← just an array push
}
```

This is the same pattern as `useExtensionService().registerExtension()` in the v1
path — the actual wiring happens later when `startExtensionSystem()` / `loadExtensions()`
runs. `defineExtension` at module eval time is entirely decoupled from app state.

**Conclusion: D6 Part 1's "no window.app at registration time" constraint is already
satisfied by the current implementation.**

## What `app.setup()` needs to do to wire v2

Two changes required, both in `app.ts` (or a new `setupV2ExtensionSystem()` helper):

### Change 1 — Import `.v2.ts` files alongside their v1 counterparts

`extensions/core/index.ts` needs to import the `.v2.ts` files so their
`defineNodeExtension(...)` calls run at load time:

```ts
// extensions/core/index.ts — add alongside existing imports
import './dynamicPrompts.v2'
import './imageCrop.v2'
import './previewAny.v2'
```

For external custom node extensions loaded via `api.fileURL(ext)`, the existing
dynamic import loop already handles any file that calls `defineNodeExtension` at
module eval — **no change needed** for external extensions.

### Change 2 — Call `startExtensionSystem()` after extensions are loaded

`app.setup()` must call `startExtensionSystem()` after `loadExtensions()` returns,
so the reactive mount watcher fires against an already-populated `nodeExtensions[]`:

```ts
// app.ts setup() — proposed addition
await useExtensionService().loadExtensions()
// ↑ existing

import { startExtensionSystem } from '@/extension-api'
startExtensionSystem()                          // ← new: starts watch(queryAll) loop
// ↑ must be called AFTER loadExtensions() so all defineNodeExtension() calls
//   have already pushed into nodeExtensions[] before the first watcher tick
```

**Ordering constraint:** `startExtensionSystem()` must run after all extension
modules have been evaluated (after `loadExtensions()` resolves). If it runs before,
extensions whose files haven't loaded yet won't be in `nodeExtensions[]` when the
first `watch` tick fires. Straightforward sequential ordering handles this.

**D8 dependency:** `startExtensionSystem()` calls `watch(() => world.queryAll(NodeType))`.
This requires the ECS World to be reactive (D8 unresolved). Until D8 lands,
`startExtensionSystem()` can stub `world.queryAll` as `shallowRef([])` per the
`// TODO(D8)` pattern already documented in todo.md.

## Sequence diagram — proposed boot flow

```
app.setup()
│
├─ useExtensionService().loadExtensions()        [existing]
│   ├─ import('@/extensions/core/index')
│   │   ├─ dynamicPrompts.ts → registerExtension({name: 'Comfy.DynamicPrompts', ...})   [v1]
│   │   ├─ dynamicPrompts.v2.ts → defineNodeExtension({name: 'Comfy.DynamicPrompts.V2', ...})  [v2, NEW]
│   │   └─ ... other core extensions
│   └─ Promise.all(customExtensions.map(import))
│       └─ each custom ext → defineNodeExtension({...}) OR app.registerExtension({...})
│
├─ startExtensionSystem()                        [new — after loadExtensions resolves]
│   └─ watch(() => world.queryAll(NodeType))
│       └─ on first tick: mountExtensionsForNode() for every node already in World
│          on later ticks: mount for new nodes, unmount for removed nodes
│
└─ ... rest of app.setup()
```

## What this means for `defineExtension` (app-scoped, not node-scoped)

`defineExtension({ name, init?, setup? })` (the app-level analog) follows the same
pattern but its hooks fire at different points:

- `init()` — should fire during/after `loadExtensions()`, mirroring v1's `init` hook
  which is called by `invokeExtensionsAsync('init')` in `app.ts`.
- `setup()` — should fire after the graph is initialized, mirroring v1's `setup`.

These are **not** handled by `startExtensionSystem()` (which is node-entity-scoped).
A separate `invokeV2AppExtensions('init')` / `invokeV2AppExtensions('setup')` call
is needed in the same positions where `invokeExtensionsAsync('init')` /
`invokeExtensionsAsync('setup')` are called today. This is the `I-SR.3` / `MIG1`
scope — not blocking Phase A but must land before app-level v2 extensions work.

## Summary of findings

| Question | Answer |
|---|---|
| Does `defineExtension` need `window.app` at eval time? | **No** — pure array push, no app access |
| Is the v2 registration decoupled from app boot? | **Yes** — same as v1 `registerExtension` |
| Is `startExtensionSystem()` wired into `app.setup()`? | **No** — gap; needs 2-line addition |
| Are `.v2.ts` files imported anywhere? | **No** — gap; need adding to `core/index.ts` |
| Ordering constraint for `startExtensionSystem()`? | After `loadExtensions()` resolves |
| D8 blocking `startExtensionSystem()`? | Partially — stub `world.queryAll` with `shallowRef([])` unblocks Phase A |
| Does external custom-ext loader need changes? | **No** — existing dynamic import loop handles `defineNodeExtension` calls |

## Recommended next actions (MIG1)

1. **Add `.v2.ts` imports to `extensions/core/index.ts`** — 3 lines, unblocks testing
   the v2 registration path end-to-end.
2. **Add `startExtensionSystem()` call to `app.ts`** after `loadExtensions()`, with
   `world.queryAll` stubbed per `// TODO(D8)`.
3. **Defer `defineExtension` app-hooks** (`init`, `setup`) to I-SR.3 — need
   `invokeV2AppExtensions` calls in the two positions v1 uses `invokeExtensionsAsync`.

These three items together constitute the minimum wiring for Phase A (surface-only
shim) to be testable end-to-end without D8 or Alex's ECS rebase.
