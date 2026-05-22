# ECS + Vue Extension API — Glossary

> Capitalized Terms of Art used throughout AXIOMS.md and the ADRs in
> `decisions/`. Each entry: a one-sentence definition, a concrete example,
> a non-example (what it is _not_), and cross-references to the axioms and
> ADRs that introduce or constrain the term.
>
> First occurrence per page in workspace markdown is auto-linked to
> `/glossary#term-slug` by `scripts/wiki-link.mjs` (cap of 1 per term per
> file — see W18.K + W19.A3 notes).

## Widget

**Definition**: the central display/edit unit of the extension API — a
declarative bundle of `schema`, `props`, and `values` that renders into a
runtime-owned host `<div>` and reads/writes a single user-facing Value.

**Example**: a numeric slider declared via
`defineWidget({ name: 'cfg', schema: { type: 'number', min: 0, max: 30 } })`
— framework mounts it, manages its host element, persists its Value.

**Non-example**: a node-level menu item, a sidebar tab, a topbar badge.
Those are Shell-UI extensions (`defineSidebarTab`, `defineTopbarBadge`),
not Widgets — they have no Value and no Schema.

**Cross-refs**: A1, A5, A12, A15, D-widget-converge, D-define-widget-augmenter,
D-no-node-widget-access.

---

## Value

**Definition**: the user-facing data a Widget displays and assigns back to
on interaction — the only "client state" promoted to a persisted, Workflow-
serialized field (per Austin's Postel's-law preamble: "a Widget displays a
valid representation of the current Value; when user interaction causes a
display change, it is assigned back to Value").

**Example**: the `7.5` number that a CFG-slider Widget displays, edits, and
serializes into the WorkflowSpec `nodes[n].widgets_values[i]`.

**Non-example**: ephemeral DOM state like cursor position, hover, focus,
local input-buffer-before-blur. Those live in the Widget's mount closure,
never in the Value.

**Cross-refs**: A1, A4, A5, A15, A16, D-widget-converge,
D-widget-serialization-simplification, D-immutability-enforcement.

---

## Topology

**Definition**: the graph-structural data — which nodes exist, how their
slots are connected, where they sit on the canvas — _independent_ of the
Values stored in their Widgets.

**Example**: `nodes: [{id: 1, type: 'KSampler', pos: [100, 200]}, ...]`
plus `links: [[1, 0, 2, 0], ...]`. Editing a slider Value does not change
Topology.

**Non-example**: the contents of a text-input Widget; the selected option
in a combo. Those are Values, not Topology.

**Cross-refs**: A4, A7, A11, D-widget-promotion-semantics,
D-linked-subgraph-constraint.

---

## Schema

**Definition**: the immutable structural definition of a Widget — its
type, validation rules, allowed range, default. Set once at declaration,
never mutated at runtime.

**Example**: `schema: { type: 'number', min: 0, max: 30, step: 0.1 }` in a
`defineWidget` call.

**Non-example**: anything that changes after `defineWidget` returns. A
"runtime addWidget" call would violate Schema immutability — see A15.

**Cross-refs**: A5, A15, D-widget-converge, D-ban-runtime-addwidget.

---

## Reference

**Definition**: a directed pointer between Entities that the World resolves
to a live Handle — never a raw ID exposed to extension code.

**Example**: a node's input slot references the output slot of another
node; promotion creates a new Topology entity that references the original
Value.

**Non-example**: raw `widget.id` strings or `node.id` numbers handed to
extensions. Those violate A4 (extensions get Handles, never IDs).

**Cross-refs**: A4, A11, D-no-node-widget-access,
D-widget-promotion-semantics.

---

## Handle

**Definition**: the opaque accessor an extension uses to interact with an
Entity — typed (NodeHandle, WidgetHandle), lifecycle-aware, never exposing
internal storage layout.

**Example**: the `handle` parameter passed to a `defineWidget` `mount(host,
ctx)` callback — `handle.value`, `handle.on('valueChanged', ...)`,
`handle.parentNode`.

**Non-example**: a direct reference to an internal World map row. Handles
are the _only_ extension-author API surface; raw entity storage is private.

**Cross-refs**: A2, A4, A14, D-no-node-widget-access, D-cross-node-observation.

---

## Mount

**Definition**: the single DOM-seam lifecycle hook — a Widget's `mount(host,
ctx)` callback runs exactly once per Widget instance, binds the host
`<div>`, and returns cleanup via the `ctx` lifecycle hooks.

**Example**: `mount(host, ctx) { const input = h('input'); host.appendChild(
input); ctx.onUnmount(() => input.remove()) }`.

**Non-example**: re-mounting an existing instance on every `valueChanged`
event. That would defeat the purpose of Mount — see A12 + Recreate.

**Cross-refs**: A12, D-widget-converge, D-unify-widget-mount-model.

---

## Recreate

**Definition**: dispose the current Widget instance and construct a fresh
one from the Schema — the lifecycle used when "the same Value is displayed
in multiple panes" (split-view, Subgraph Promotion, KeepAlive shuffle).

**Example**: opening a split-view of the canvas — each pane gets its own
Widget instance via Recreate; Value-clamping flows via
`defineWidgetAugmenter({ on('valueChanged', clampValue) })` applied to all
instances.

**Non-example**: Remount — same instance, different host. Recreate ≠
Remount; both may coexist as separate exported lifecycle hooks (see W19.A7).

**Cross-refs**: A12, D-widget-converge (post-W19.A7 amendment),
D-unify-widget-mount-model.

---

## Remount

**Definition**: move an _existing_ Widget instance to a new host `<div>`
without disposing it — used for `<KeepAlive>` shuffles and single-pane
Subgraph navigation where instance identity must survive a DOM move.

**Example**: navigating into a Subgraph and back out — the same Widget
instance is Remounted into the new host without losing its mount-closure
state.

**Non-example**: split-view (Recreate, not Remount — each pane gets its
own instance).

**Cross-refs**: A12, D-widget-converge (W19.A7 amendment),
D-unify-widget-mount-model.

---

## Entity

**Definition**: a unique, opaque ID for a World object (node, widget, slot,
link, group, reroute) — the "E" of ECS, the primary key all Components and
Systems join on.

**Example**: `NodeEntityId`, `WidgetEntityId`, `SlotEntityId` — distinct
branded types so the type system prevents passing a widget id where a node
id is expected.

**Non-example**: a string label like `"KSampler"`. That's a Component
value (`type`), not an Entity.

**Cross-refs**: A11, D-no-virtual-nodes-in-api, D8-world-vue-reactive-adapter.

---

## Component

**Definition**: a data field attached to an Entity — the "C" of ECS, the
column in the wide row indexed by Entity ID.

**Example**: `position: {x, y}`, `widgetValue: 7.5`, `nodeType: 'KSampler'`
are all Components attached to a NodeEntityId.

**Non-example**: a Vue component file (`Slider.vue`). ECS Components are
data; Vue components are rendering primitives. Don't confuse them.

**Cross-refs**: A11, D8-world-vue-reactive-adapter.

---

## System

**Definition**: the "S" of ECS — logic that queries Entities by Component
set and reacts to changes (RenderSystem, SerializationSystem,
ExecutionSystem, LayoutSystem).

**Example**: SerializationSystem queries all Entities with `serializable:
true` Components and emits WorkflowSpec.

**Non-example**: a Vue composable used inside one component. Systems
operate at World scope; composables operate at component scope.

**Cross-refs**: A11, D-widget-serialization-simplification.

---

## World

**Definition**: the ECS container — owns all Entities, Components, and
Systems; provides query/mutation APIs to extensions via Handles only.

**Example**: `world.queryNodes({ type: 'KSampler' })` returns NodeHandles.

**Non-example**: a Pinia store. The World is the canonical state
container; Pinia stores are a Vue-reactivity adapter on top (see D8).

**Cross-refs**: A2, A11, A14, D8-world-vue-reactive-adapter,
D-cross-node-observation.

---

## Subgraph

**Definition**: a nested graph as a first-class Entity — a node-like
container that hosts its own child Entities and exposes inputs/outputs to
its parent World.

**Example**: collapsing a 5-node region into one Subgraph node; opening
the Subgraph navigates into its child World.

**Non-example**: a comment group (visual-only). Groups don't host child
Entities; Subgraphs do.

**Cross-refs**: A3, A11, D-linked-subgraph-constraint, D12-scope-clone-on-copy.

---

## Blueprint

**Definition**: the serialized template for instantiating an Entity — a
Schema + initial-Values pair, used by Promotion, copy-paste, and Linked
Subgraph clones.

**Example**: when a Subgraph is duplicated via "Clone Linked Subgraph", the
Blueprint is serialized once and instantiated N times; each clone gets its
own Entity IDs but shares the source Blueprint.

**Non-example**: a saved Workflow file. WorkflowSpec is the persistence
format; Blueprint is the in-memory instantiation template.

**Cross-refs**: A3, D12-scope-clone-on-copy, D-linked-subgraph-constraint.

---

## Promotion

**Definition**: the runtime act of materializing a contained surface into a
top-level Entity — a Widget's Value being "promoted" so it appears as a
graph-level node, or a node being promoted into a Subgraph.

**Example**: right-click a slider Widget → "Convert to Input"; the
framework creates a new Topology Entity (a primitive node) that holds a
Reference to the original Value. The Widget itself is not mutated.

**Non-example**: setting `widget.promoted = true`. Promotion creates new
Entities; it never mutates the source Widget (see Glary-Bot Theorem 6:
Value Promotion Impossibility).

**Cross-refs**: A4, A5, A7, A11, D-widget-promotion-semantics.

---

## BoxedWidget

**Definition**: a Widget whose Value is wrapped in a type-discriminated
container (`{ kind: 'int', value: 7 }` rather than the bare `7`) — used
when the Schema needs to carry runtime-type information alongside the data.

**Example**: a numeric Widget that can hold int, float, or seed-int —
BoxedWidget carries the `kind` discriminator so SerializationSystem and
ExecutionSystem read the correct type.

**Non-example**: a plain number Widget. Unboxed Values are the default;
BoxedWidget is the escape hatch for type-discriminated cases.

**Cross-refs**: A5, A16, D-widget-converge.

---

## ScopedHandle

**Definition**: a Handle whose lifetime is bound to a parent scope —
automatically disposed when the scope ends (e.g., the EffectScope of the
calling `defineWidget` instance).

**Example**: `ctx.scopedHandle(otherWidgetId)` inside a `mount(host, ctx)`
callback — when the Widget unmounts, the ScopedHandle is auto-disposed; no
manual cleanup required.

**Non-example**: a globally-stored Handle reference. Those leak when the
source Entity dies — use ScopedHandle for any cross-Entity observation.

**Cross-refs**: A14, D-cross-node-observation, D-no-node-widget-access.

---

## WorkflowSpec

**Definition**: the canonical, persisted Workflow JSON — the source of
truth for "what the user built", containing Topology + per-Widget Values +
positions + metadata.

**Example**: the `.json` file you download via "Save Workflow"; the
payload posted to `/prompt` by the API call (per A16).

**Non-example**: the in-memory World state. WorkflowSpec is a
serialization view of the World, not the World itself.

**Cross-refs**: A7, A16, D-widget-serialization-simplification.

---

## WorkflowLayout

**Definition**: the on-canvas visual state of a Workflow — node positions,
sizes, collapse state, group bounds — distinct from the Topology that
drives Execution.

**Example**: dragging a node updates WorkflowLayout (`pos: [x, y]`); the
Execution result is unchanged.

**Non-example**: the link routing between nodes (Topology). Layout is
visual-only; Topology drives Execution.

**Cross-refs**: A7, D-coordinate-space.

---

## ExecutionPrompt

**Definition**: the API-prompt payload sent to the backend `/prompt`
endpoint — per A16, structurally _equivalent_ to WorkflowSpec (same fields,
same shape; the unified-serialization target).

**Example**: the JSON body `{prompt: {1: {class_type: ...}, 2: ...}}`
posted by the queue-prompt action.

**Non-example**: a separate "API format" distinct from WorkflowSpec. A16
forbids divergence — workflow JSON ≡ API prompt payload.

**Cross-refs**: A16, D-widget-serialization-simplification.

---

## RunSnapshot

**Definition**: an immutable record of a completed Execution — the
ExecutionPrompt that was sent, the timestamps, the outputs, the cache
keys.

**Example**: an entry in the Queue/History sidebar; the JSON dump you can
replay to reproduce a generation.

**Non-example**: a mutable "currently running" record. RunSnapshots are
written once at completion; in-flight runs are RunState, a different
type.

**Cross-refs**: A7, A16, D-widget-serialization-simplification.

---

## NodeHandle

**Definition**: the typed Handle for a node Entity — exposes
`handle.title`, `handle.type`, lifecycle events, and (per A1 + A14) does
_not_ expose `getWidget()` or any node→widget descent.

**Example**: the `node` parameter passed to a
`defineNode({ on: { configured(node) { ... } } })` callback.

**Non-example**: a NodeHandle with `node.getWidget('cfg')` — that was
explicitly removed per D-no-node-widget-access (W8 bilateral A1 closure).

**Cross-refs**: A1, A14, D-no-node-widget-access, D-cross-node-observation.

---

## WidgetHandle

**Definition**: the typed Handle for a Widget Entity — exposes
`handle.value`, `handle.parentNode`, `handle.on('valueChanged', ...)` and
the lifecycle event surface defined in `WidgetEvents`.

**Example**: the `handle` parameter passed to `mount(host, ctx)` and to
`defineWidgetAugmenter({ on: { valueChanged(handle, ev) { ... } } })`.

**Non-example**: a WidgetHandle with `setSerializeEnabled` /
`isSerializeEnabled` — A16 forbids opt-out-of-serialization, so those
were comment-stripped in wave-9.

**Cross-refs**: A1, A12, A15, A16, D-widget-converge,
D-widget-serialization-simplification.

---

## Augmenter

**Definition**: an extension that decorates an _existing_ Widget surface
without owning its declaration — adds event handlers, transforms Values,
extends UI — via `defineWidgetAugmenter`.

**Example**: a third-party pack that adds a "clamp to multiple of 8" rule
to every numeric Widget via
`defineWidgetAugmenter({ targetSchema: 'number', on: { valueChanged: clamp8 } })`.

**Non-example**: a `defineWidget` call. Augmenters _decorate_; they don't
declare. If you're declaring a new Widget, use `defineWidget`.

**Cross-refs**: A1, A2, D-define-widget-augmenter, D-cross-node-observation.

---

## Disposable

**Definition**: the lifetime token returned by every `defineX` surface
(`defineWidget`, `defineNode`, `defineSidebarTab`, …) — calling
`.dispose()` removes the registration and runs all attached cleanup.

**Example**:

```ts
const disposer = defineWidget({ name: 'foo', ... })
// later:
disposer.dispose()  // unregisters; runs ctx.onUnmount on every instance
```

**Non-example**: a registration with no cleanup path. Every public
`defineX` MUST return a Disposable — that's a load-bearing contract for
HMR, plugin uninstall, and extension hot-reload.

**Cross-refs**: A2, A14, D-shell-ui-entrypoints, D-bootstrap-hooks.
