---
source: in-house (I-TF.3.C1)
date: 2026-05-08
status: implemented — this doc describes the harness as built in C2/C3
worktree: /home/c_byrne/worktrees/ComfyUI_frontend/ext-v2__i-tf
harness_path: src/extension-api-v2/harness/
---

# Test Harness API Contract — I-TF.3.C1

Documents the design of the v2 extension API test harness: what it provides,
what it deliberately omits, and which ComfyApp surfaces each of the top-12
blast-radius patterns requires.

---

## Design goals

1. **No real LiteGraph, no real ECS.** All data lives in an in-memory Map.
   Tests that pass here are strictly "harness green," not "production green" —
   the distinction is called out in every file header.
2. **Compile now, run real code later.** `it.todo` stubs import `runV1` /
   `runV2` today; the actual snippet evaluation is deferred to Phase B when
   `@/ecs/world` and `@/ecs/commands` land.
3. **Evidence-driven.** `loadEvidenceSnippet(patternId, index)` surfaces
   the `excerpt:` field from R8 clone-and-grep rows so tests exercise real
   ecosystem code, not synthetic mocks.
4. **Per-test isolation.** `HarnessWorld.clear()` resets between tests;
   each `runV1/runV2` call creates a fresh `MiniComfyApp` unless the
   caller passes one in.

---

## Public API surface

### `createHarnessWorld(): HarnessWorld`

In-memory ECS stub. Entity IDs are monotone integers starting at 1.

```ts
interface HarnessWorld {
  addNode(input: {
    type: string
    comfyClass?: string
    position?: [number, number]
    size?: [number, number]
    title?: string
    properties?: Record<string, unknown>
  }): EntityId

  removeNode(entityId: EntityId): boolean
  findNode(entityId: EntityId): HarnessNodeRecord | undefined
  allNodes(): readonly HarnessNodeRecord[]
  findNodesByType(type: string): readonly HarnessNodeRecord[]
  clear(): void
}
```

**What it does NOT stub** (deferred to Phase B):
- Widget bags per node
- Reactive queries (`watch(() => world.queryAll(...))`)
- ECS components (NodeTag, LoadedFromWorkflow, etc.)
- Link / slot tables

---

### `createMiniComfyApp(world?): MiniComfyApp`

The smallest object shaped like the legacy `app` global that v1 snippets
reach for. Backed by `HarnessWorld`.

```ts
interface MiniComfyApp {
  graph: MiniGraph        // add / remove / findNodesByType
  extensions: MiniExtensionRegistration[]
  world: HarnessWorld     // for advanced assertions
  queuePrompt(): Promise<void>          // no-op, resolves immediately
  registerExtension(ext: {...}): void   // records ext in extensions[]
}
```

**What it does NOT stub:**
- `app.graphToPrompt` (BC.14 — deferred; mock via monkeypatch in Phase B)
- `app.loadGraphData` (BC.15)
- `app.nodeDefs` (BC.24)
- WebSocket / api events (BC.17)
- Sidebar / command manager (BC.25)

---

### `runV1(snippet: string, opts?): RunV1Result`

```ts
interface RunV1Result {
  app: MiniComfyApp
  registered: number   // app.extensions.length after run
  errors: Error[]
}
```

**Current status (Phase A — stub):** Does NOT evaluate `snippet`. Returns a
fresh `MiniComfyApp` and an empty errors array so `it.todo` stubs can chain
to it without throwing.

**Phase B upgrade path:** Replace the stub body with a sandboxed eval that
exposes `app`, `LiteGraph`, `LGraphNode`, `window.comfyAPI` globals. The
`RunV1Result` shape stays unchanged — test assertions need no edits.

---

### `runV2(snippet: string, opts?): RunV2Result`

```ts
interface RunV2Result {
  app: MiniComfyApp
  nodeExtensions: NodeExtensionOptions[]
  widgetExtensions: WidgetExtensionOptions[]
  errors: Error[]
}
```

**Current status (Phase A — stub):** Does NOT evaluate `snippet`. Returns
empty extension registries. Types come from `@/types/extensionV2` (which
does exist in the worktree today).

**Phase B upgrade path:** Replace stub body with a sandboxed eval that
exposes `defineNodeExtension`, `defineWidgetExtension` from the real
`@/services/extensionV2Service`. The `RunV2Result` shape stays unchanged.

---

### `loadEvidenceSnippet(patternId, index?): string`

Reads `excerpt:` from the Nth evidence row of `patternId` in the snapshotted
DB (`__fixtures__/touch-point-database.json`). Skips rows without excerpts.
Throws on unknown `patternId`.

```ts
// Companion helpers:
listPatternIds(): string[]
countEvidenceExcerpts(patternId: string): number
```

The fixture JSON is refreshed from `database.yaml` via
`scripts/sync-touch-point-db.mjs`.

---

## Two-phase mount simulation (BC.37 requirement)

BC.37 (VueNode bridge timing) requires the harness to simulate two distinct
phases:

1. **Phase 1 (LiteGraph side ready):** `nodeCreated` fires; VueNode
   component NOT yet mounted; `WidgetHandle.getValue()` available.
2. **Phase 2 (Vue side ready):** VueNode `onMounted` fires; Three.js
   renderer / ComponentWidgetImpl Vue props accessible.

**Current harness:** Does not model phases — all `HarnessNodeRecord` state
is available immediately. `// TODO(BC.37)` markers in test stubs flag this.

**Required addition (before C3 fills BC.37 tests):** Add
`world.simulateMountPhase(entityId, phase: 1 | 2)` and a `vueState` bag
on `HarnessNodeRecord` that is `undefined` until phase 2 is triggered.
This is a single-BC addition that does not affect any other category.

---

## ComfyApp stub coverage vs top-12 blast-radius patterns

| Rank | Pattern | blast_radius | Required stub | Status |
|------|---------|-------------|---------------|--------|
| 1 | S6.A1 graphToPrompt | 6.67 | `app.graphToPrompt` async method + result shape | ❌ Phase B |
| 2 | S2.N15 serialize | 5.01 | `node.serialize()` + `widgets_values` array | ❌ Phase B |
| 3 | S2.N4 onRemoved | 4.89 | `node.onRemoved()` lifecycle trigger | ❌ Phase B |
| 4 | S2.N3 onConnectionsChange | 4.41 | connection event dispatch | ❌ Phase B |
| 5 | S2.N12 onConnectInput | 4.22 | slot connect intercept | ❌ Phase B |
| 6 | S2.N13 onConnectOutput | 3.98 | slot connect intercept | ❌ Phase B |
| 7 | S2.N14 onWidgetChanged | 3.76 | widget change callback | ❌ Phase B |
| 8 | S2.N1 nodeCreated | 3.65 | `app.registerExtension` + nodeCreated dispatch | ✅ via registerExtension |
| 9 | S5.A1 api.addEventListener | 3.44 | api event bus | ❌ Phase B |
| 10 | S2.N6 onSerialize | 3.21 | node serialize hook | ❌ Phase B |
| 11 | S11.G4 setDirtyCanvas | 3.10 | canvas dirty-flag | ❌ Phase B (no-op ok) |
| 12 | S2.N18 onPropertyChanged | 2.98 | property bag mutation | ❌ Phase B |

**Current harness covers 1 of 12 top patterns directly** (S2.N1 via
`registerExtension`). The remaining 11 require Phase B eval sandbox.

This is intentional: Phase A goal is stable API *surface* for Simon/Austin
to write against, not a working behavioral test suite. The compat-floor gate
(I-TF.7) gates on stubs existing, not on stubs passing — passing comes in
Phase B.

---

## What C3 proved (smoke test results)

`harness.smoke.test.ts` passes four describe blocks without Phase B:

1. `HarnessWorld` add/find/remove roundtrip ✅
2. `MiniComfyApp` registerExtension + queuePrompt no-op ✅
3. `runV1` / `runV2` return usable stubs without throwing ✅
4. `loadEvidenceSnippet` returns non-empty excerpt for S4.W1 ✅

---

## Upgrade sequence for Phase B

When `@/ecs/world`, `@/ecs/commands`, `@/ecs/components` land (PR #11939):

1. Replace `runV1` stub body with sandboxed eval exposing `app` + LiteGraph shims.
2. Replace `runV2` stub body with sandboxed eval exposing `defineNodeExtension` etc.
3. Add `world.simulateMountPhase()` for BC.37.
4. Add `MiniComfyApp.graphToPrompt()` returning a fixture `PromptResult` for BC.14.
5. Add `MiniComfyApp.api` with an `addEventListener` stub for BC.17.
6. Run `scripts/sync-touch-point-db.mjs` to refresh fixtures if DB has new excerpts.

No test assertion changes needed — `RunV1Result` and `RunV2Result` shapes are frozen.
