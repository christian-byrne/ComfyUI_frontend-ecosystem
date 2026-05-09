---
source: internal code audit — ComfyUI_frontend src/ + ECS branch commits
date_accessed: 2026-05-08
task: I-SR.2.B1
---

# Scope Registry Spike — I-SR.2.B1

## Summary

**The scope registry and EffectScope wiring already exist in `extension-api-service.ts`.**
`@vue/reactivity` is NOT needed as a separate dep — everything comes from `'vue'` directly.
The `src/world/` module exists on the ECS branch commits and is the correct import target for B2.

---

## 1. EffectScope / watch import path

**Answer: import from `'vue'`, not `'@vue/reactivity'`.**

All existing codebase usage imports from `'vue'`:
```ts
import { EffectScope, onScopeDispose, pauseTracking, resetTracking, watch } from 'vue'
```

`@vue/reactivity` is not listed as a direct dep in `package.json`. The `vue` package
re-exports everything from `@vue/reactivity` — no separate dep needed, no path aliasing
required. This is consistent across all 30+ files using effectScope/onScopeDispose in src/.

**Confirmed existing usages outside our service:**
- `src/renderer/glsl/useGLSLPreview.ts` — `effectScope` for lazy inner scope per node
- `src/platform/cloud/subscription/composables/useSubscriptionCancellationWatcher.ts` — `onScopeDispose`
- `src/platform/missingModel/missingModelStore.ts` — `onScopeDispose`
- `src/components/builder/useAppModeWidgetResizing.ts` — `onScopeDispose`
- `src/renderer/extensions/vueNodes/composables/useNodePointerInteractions.ts` — `onScopeDispose`

**`useGLSLPreview.ts` is the best parallel:** it uses `effectScope()` to create a lazy inner
scope for each node (created when the node is detected, destroyed on removal). This is
architecturally identical to what I-SR.2.B2 needs.

---

## 2. What already exists in extension-api-service.ts

`src/services/extension-api-service.ts` already implements:

| Item | Location | Notes |
|------|----------|-------|
| `scopeRegistry` | line 78 | `Map<string, EffectScope>` keyed by `"${extensionName}:${entityId}"` |
| `getOrCreateScope(extensionName, entityId)` | line 88 | Creates `new EffectScope(true)` (detached) on first call |
| `stopScope(extensionName, entityId)` | ~line 100 | Calls `scope.stop()` + deletes from map |
| `mountExtensionsForNode(nodeId)` | ~line 363 | scope.run() → pauseTracking → hook → resetTracking |
| `unmountExtensionsForNode(nodeId)` | ~line 393 | Iterates all extensions, calls stopScope |
| `startExtensionSystem()` | ~line 400 | Calls `watch(() => world.queryAll(...))` — **stub, world not real yet** |

**B2 is NOT starting from scratch.** It's wiring the existing scaffold to the real World.

---

## 3. The `src/world/` module — what exists on ECS branch

The World substrate lives on commits in this repo (not yet on main, pending Alex's PRs):

**Key commits (reachable from current HEAD via git log --all):**
- `b35d1f3b5` — `feat(world): slice 1` — original substrate
- `e364d69c4` — `refactor(world): move widget types to src/world/widgets/` — latest state

**Files in `src/world/` at `e364d69c4`:**
```
src/world/
├── brand.ts
├── componentKey.ts       ← defineComponentKey, defineComponentKeys, slot()
├── componentKey.test.ts
├── entityIds.ts          ← NodeEntityId, WidgetEntityId (string brands, NOT numbers)
├── entityIds.test.ts
├── world.ts              ← World interface + createWorld()
├── world.test.ts
├── worldInstance.ts      ← getWorld() / resetWorldInstance() singletons
└── widgets/
    ├── widgetComponents.ts  ← WidgetComponentValue/Display/Schema/Serialize/Container keys
    └── widgetState.ts
```

**Critical finding — EntityIds are strings, not numbers:**
```ts
// entityIds.ts
export type NodeEntityId = Brand<string, 'NodeEntityId'>
export type WidgetEntityId = Brand<string, 'WidgetEntityId'>
// Format: `node:${graphId}:${nodeId}`
```

**The service stub uses `number` for entityId in `getOrCreateScope(extensionName, entityId: number)`.**
This must change to `NodeEntityId` (string brand) in B2.

**Critical finding — World IS already Vue-reactive:**
```ts
// world.ts
import { reactive, shallowReactive } from 'vue'
// ...
const store = shallowReactive(new Map<AnyComponentKey, AnyBucket>())  // bucket map is reactive
const created = reactive(new Map<TEntity, TData>())  // each bucket is reactive
```

Each component bucket is a `reactive(Map)`. This means `watch(() => world.entitiesWith(NodeTypeKey))`
WILL trigger when entities are added/removed — no custom adapter needed for D8's most basic case.

**`entitiesWith(key)` returns `TEntity[]` from a `reactive(Map)` — `watch` will track it.**

---

## 4. The `useWorld()` vs `getWorld()` discrepancy

The service imports `useWorld` from `@/ecs/world`:
```ts
import { useWorld } from '@/ecs/world'  // this path DOES NOT EXIST
```

The actual world module is at `src/world/worldInstance.ts` and exports `getWorld()`, not `useWorld()`.

**For B2:** Replace `useWorld()` calls with `getWorld()` from `@/world/worldInstance`.
The `@/ecs/world` stub path was a placeholder. The real path is `@/world/worldInstance`.

Similarly, `@/ecs/commands`, `@/ecs/components`, `@/ecs/entityIds` → all map to `@/world/*`.

---

## 5. Component key mapping (service stub → real world keys)

The service stub imports from `@/ecs/components` (doesn't exist). Real keys are in `@/world/widgets/widgetComponents.ts`:

| Service stub import | Real world key | File |
|---------------------|---------------|------|
| `NodeType` | TBD — not in widget slice yet | needs B2 to define or stub |
| `LoadedFromWorkflow` | TBD — not in widget slice | needs B2 to define or stub |
| `WidgetValue` | `WidgetComponentValue` | `@/world/widgets/widgetComponents.ts` |
| `WidgetIdentity` | `WidgetComponentSchema` (has `type`) + `WidgetComponentDisplay` (has `label`) | `@/world/widgets/widgetComponents.ts` |
| `Position`, `Dimensions`, `NodeVisual` | Not yet in world — node components not in slice 1 | stub with `// TODO(#11939)` |
| `Connectivity`, `Execution` | Not yet in world | stub |

**Slice 1 only covers widget components.** Node-level components (Position, Dimensions, NodeType,
LoadedFromWorkflow, Connectivity, Execution) are NOT yet in world. B2 must stub these with
`// TODO(#11939)` markers and a synthetic `NodeTypeKey` ComponentKey defined locally.

---

## 6. `world.queryAll` vs `world.entitiesWith`

The service uses `world.queryAll(NodeType)` in `startExtensionSystem()`. The real API is:
```ts
world.entitiesWith(key): TEntity[]
```

`queryAll` doesn't exist. The B2 replacement:
```ts
watch(
  () => world.entitiesWith(NodeTypeKey),
  (currentIds, previousIds) => { /* mount new, unmount removed */ }
)
```

Since the bucket Map is `reactive()`, this watch will fire on entity add/remove.

---

## 7. Key type: scopeRegistry key format

Current: `"${extensionName}:${entityId}"` where entityId is `number`.
Correct for B2: `"${extensionName}:${nodeEntityId}"` where nodeEntityId is `NodeEntityId` (string brand like `"node:graphUuid:42"`).

No conflict — string brands format their own prefix. The composite key remains unambiguous.

---

## 8. Checklist for B2

- [ ] Change import `from '@/ecs/world'` → `from '@/world/worldInstance'`; use `getWorld()` not `useWorld()`
- [ ] Change import `from '@/ecs/commands'` → stub `dispatch` locally with `// TODO(#11939)`
- [ ] Change import `from '@/ecs/components'` → use real `@/world/widgets/widgetComponents` keys for widget components; define stub `NodeTypeKey` + `LoadedFromWorkflowKey` locally
- [ ] Change import `from '@/ecs/entityIds'` → `from '@/world/entityIds'` (already has `NodeEntityId`, `WidgetEntityId`)
- [ ] Fix `getOrCreateScope(extensionName, entityId: number)` → `entityId: NodeEntityId`
- [ ] Fix `startExtensionSystem`: `world.queryAll(NodeType)` → `world.entitiesWith(NodeTypeKey)`
- [ ] The diff/mount/unmount logic in `startExtensionSystem` needs old/new array comparison — Vue `watch` provides `(newIds, oldIds)` for this
- [ ] `EffectScope(true)` is correct — detached (not child of current scope), intentional

---

## 9. D8 assessment (implicit finding)

**D8 is partly solved already.** The World's component buckets are `reactive(Map)` — Vue's
reactivity system tracks reads from them. `watch(() => world.entitiesWith(key))` will fire.

What D8 still needs to solve:
- `watch(() => world.getComponent(nodeId, PositionKey))` — will this track? Yes, `reactive(Map).get(id)` is tracked.
- **Per-entity component change notifications** (e.g. `node.on('positionChanged', fn)`) require a
  `watch` per entity per component. Scale concern: 100 nodes × 10 events = 1000 watchers.
  D8 spike needs to assess whether Vue's scheduler handles this without frame-rate issues.
- `world.onSystemEvent` (used in `createNodeHandle`) doesn't exist on the World interface — needs
  to either be added to World or replaced with per-entity component watches.

The core reactivity mechanism works. D8's open question is per-entity event efficiency, not
"does reactivity work at all."
