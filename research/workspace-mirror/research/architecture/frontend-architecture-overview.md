---
source_url: https://www.notion.so/comfy-org/ComfyUI-Frontend-Architecture-3536d73d365080589f10f0a19594fc83
date_accessed: 2026-05-08
page_last_edited: 2026-05-01
parent: 1:1 Frontend Q&A (Documents Hub)
author: internal (Comfy-Org)
---

# ComfyUI Frontend Architecture — Ingest Summary

## Four-layer stack

```
Layer 4 (Future)        ECS + CRDT Layout System           <- ADR-0003, ADR-0008 (planned)
Layer 3 (Present)       Pinia Stores + Vue 3 + Composables <- new code (93 composables, 46 stores)
Layer 2 (Transitional)  scripts/ global singletons         <- app.ts 71K, api.ts 42K, ui.ts 21K
Layer 1 (Foundation)    LiteGraph canvas engine            <- src/lib/litegraph/
```

All four layers coexist simultaneously. Mixing layers 2 and 3 is intentional, not a bug.

## Key stores (Layer 3)

| Store | Responsibility |
|-------|---------------|
| `executionStore` | Queue execution state |
| `nodeDefStore` | Node type definitions |
| `nodeOutputStore` | Node outputs and previews |
| `workflowStore` | Workflow management |
| `commandStore` | Commands and undo/redo |
| `toastStore` | Toast notifications |
| `domWidgetStore` | DOM widget registry |
| `canvasStore` | Canvas state and scale |
| `appModeStore` | App/builder/graph mode switching |

## Extension lifecycle timing (authoritative)

```typescript
{
  init()                // ComfyUI initializing — DOM may NOT exist yet
  setup()               // After ALL extensions have run init()
  nodeCreated()         // After LiteGraph node created — VueNode NOT YET MOUNTED
  afterConfigureGraph() // After workflow finishes loading
}
```

**Critical:** `nodeCreated` gives you the LiteGraph node. The VueNode Vue component has NOT mounted
yet at this point. This is why `waitForLoad3d` exists — it defers Three.js renderer access until
the Vue component's `onMounted` fires.

Implication for v2 API / I-SR: `setup()` inside `defineNodeExtension` cannot synchronously access
VueNode-backed state. Must use `onNodeMounted` lifecycle hook (which fires after Vue mount).

## VueNodes bridge pattern

`src/renderer/extensions/vueNodes/` renders Vue components as LiteGraph widgets via `ComponentWidgetImpl`:

```typescript
const widget = new ComponentWidgetImpl({
  node,
  name: 'my_widget',
  component: MyVueComponent,
  inputSpec: { type: 'string' },
  options: {}
})
addWidget(node, widget)
```

A VueNode has **dual identity**:
- LiteGraph side: `ComponentWidgetImpl` with `value`, `callback`, `name`
- Vue side: a Vue component instance with props, emits, lifecycle hooks

Read data through the widget (`node.widgets.find(w => w.name === 'xxx').value`);
trigger updates through callback (`widget.callback(newValue)`).

**`waitForLoad3d` deferral pattern** — concrete test fixture for BC.36 (VueNode bridge timing):
```typescript
// Extension registers nodeCreated, but VueNode not mounted yet.
// Must defer until Vue component's onMounted fires:
waitForLoad3d(node, (load3dInstance) => {
  // Three.js renderer now available
})
```

## `app.rootGraph` is NOT reactive

`app.rootGraph.nodes` is NOT Vue reactive. Reading it inside a `computed` or `watch` will NOT
trigger updates. This is the exact problem D8 (ECS World ↔ Vue reactive adapter) must solve.

Confirms: use Pinia stores (which update at the right moments) or read manually inside
`onMounted` / event callbacks — never inside a `computed` reading `app.rootGraph` directly.

## Key dev rules (already in AGENTS.md from ADR-0008)

- Do NOT add methods to `LGraphNode`, `LGraphCanvas`, or `LGraph` — 40+ external repos depend on these
- Do NOT model entities with OOP inheritance — use plain data components
- Do NOT set `node.pos` or `node.size` directly — future `layoutStore` (ADR-0003)
- `scripts/` is a backward-compatibility layer; new logic goes through Layer 3
- `onConnectionsChange`, `onRemoved`, similar callbacks affect 40+ repos — require migration guidance

## Testing standards

| Type | Framework | Location | Key rules |
|------|-----------|----------|-----------|
| Unit / Component | Vitest | `src/**/*.test.ts` | No mocking what you don't own |
| E2E | Playwright | `browser_tests/**/*.spec.ts` | No `waitForTimeout`; use `waitForResponse` or retrying assertions |
| Component | `@testing-library/vue` | `src/**/*.test.ts` | Behavior-driven; no asserting on CSS classes or styles |

## Where to put new code

```
Pure UI rendering?               -> Vue Component (.vue)
Reusable stateful logic?         -> Composable (useXyz.ts)
State shared across components?  -> Pinia Store (*Store.ts)
Domain business logic?           -> Service (*Service.ts)
Registering into LiteGraph?      -> src/extensions/core/ via app.registerExtension
```

## Other rules

- No `dark:` Tailwind variant — use CSS variable semantic tokens (e.g. `bg-node-component-surface`)
- No `!important` or `!` Tailwind prefix
- All user-visible strings via `vue-i18n` (ESLint + CI enforce this)
- No barrel files in `src/` (except `src/extension-api/index.ts` — documented exception)

## Relevance to this project

| Area | Implication |
|------|-------------|
| **D8** | `app.rootGraph` non-reactive confirmed — the exact problem D8 must solve |
| **I-SR.2.B2** | `nodeCreated` timing means `setup()` cannot sync-access VueNode state → `onNodeMounted` is necessary, not optional |
| **BC.36 (new)** | `waitForLoad3d` deferral = concrete test fixture for VueNode bridge timing hazard |
| **I-COORD.1** | Store list (domWidgetStore, appModeStore, etc.) tells us which stores converted extensions can use instead of `app.*` |
| **Test framework** | Official testing rules (no mock-what-you-don't-own, no waitForTimeout) apply to our I-TF test harness design |
| **Layer 2 rule** | Confirms D6 parallel-paths direction: `scripts/` is compat-only, new code goes through Layer 3 |
