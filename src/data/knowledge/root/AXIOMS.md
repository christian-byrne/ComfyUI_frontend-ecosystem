# Extension API v2 — Design Axioms & Constraints

> **Status**: Living document. Updated 2026-05-21 (wave-19 prose simplification).
> **Source**: Meeting transcript `Frontend-Standup-ef8d2f8d-17b7.json` (2026-05-18),
> Notion "Centralized Graph State Package" + "RFC Extension: Canonical Workflow Model",
> Slack design feedback 2026-05-21.

## Preamble — Widget Contract (after Austin Mroz, 2026-05-21)

A robust widget follows Postel's law:

1. **A widget displays a valid representation of the current Value.**
2. **When a user interaction with the widget causes a display change, the new value is assigned back to the Value.**
3. **A widget is liberal in what it accepts (any current Value), conservative in what it emits (always schema-valid).**

The axioms below formalize the consequences. The derived theorems in
[`axioms-theorems.md`](./axioms-theorems.md) follow logically from the
axioms. Long-form rationale per axiom lives in
`decisions/D-axiom-A{N}-rationale.md` ADRs (cross-linked below).

---

## A1: Widget-Centric Philosophy

**Widgets are the singular extension surface. Nodes are topology; widgets
are user-facing.** Extensions interact with widgets directly; nodes never
"look down" to enumerate or modify widgets.

- Widgets must survive across promotion, app mode, partial graph views, and linked-instance clones (blueprints).
- Widgets know their parent node (`widget.parentNode`); nodes cannot enumerate widgets (`node.getWidget()` / `node.getWidgets()` are bilaterally excluded — see A14).
- Extensions register widgets via `defineWidget({type, mount, …})`; node hooks cannot reference widget state.

**Rationale**: see [`decisions/D-axiom-A1-rationale.md`](./decisions/D-axiom-A1-rationale.md).
**Implementation**: `decisions/D-no-node-widget-access.md` (bilateral closure); `decisions/D11-naming-defineNode-defineWidget.md`.

---

## A2: Minimal API Surface

**Start with the absolute minimum. Add by necessity, not by usage pattern.**
Surfaces are comment-out-by-default; restoration requires a validated
ecosystem use case, an audit against A1–A13, and behavior-triplet test coverage.

- "Egregious" observed use patterns are signal to NOT expose that surface.
- Phase A exclusions are catalogued in §A14 (commented out — may return).
- Permanent exclusions are catalogued in §A14 (REMOVED — never returning).

**Rationale**: see [`decisions/D-axiom-A2-rationale.md`](./decisions/D-axiom-A2-rationale.md).
**Implementation**: §A14 below; `scripts/check-axiom-compliance.sh`.

---

## A3: Linked Subgraph Constraint

**Linked subgraphs (blueprints) exist: same graph definition manifests across
multiple instances.** All API designs must be tested against the
linked-instance scenario.

- ID strategy must be stable across clone boundaries (A4).
- Widget state must not assume single instance (Theorem 1, Theorem 7 in `axioms-theorems.md`).
- Event dispatch may fire in multiple contexts (per-clone, not per-source).
- Serialization must not assume single workflow (A7).

**Implementation**: `decisions/D-linked-subgraph-constraint.md`; `decisions/D12-scope-clone-on-copy.md`.

---

## A4: ID Strategy — Abstract Handles, Not Raw IDs

**Extension authors should never need raw IDs in the ideal world.**
IDs are scope-managed; handles auto-dispose when scope ends.

- Abstract handle objects (`NodeHandle`, `WidgetHandle`) wrap internal ECS IDs.
- Extensions don't need to know about subgraphs at the ID level.
- Internal ECS IDs (UUIDs per D20) are distinct from extension-facing handles.
- Locator IDs vs execution IDs distinction deferred (open question — see D-uwf-drafting-board).

**Rationale**: see [`decisions/D-axiom-A4-rationale.md`](./decisions/D-axiom-A4-rationale.md).
**Implementation**: `decisions/D20-id-type-convergence.md`; `decisions/D4-gap-analysis.md`.

---

## A5: Widget State — Three-Tier Model (Schema / Props / Values)

**Widget state is three tiers with distinct mutability.**

1. **Schema** — immutable for widget lifetime (type, name, presence of constraints; dynamic combos: schema fixed, sub-widgets derived from parent schema).
2. **Props** — mutable runtime configuration (disabled, hidden, min/max, callback).
3. **Values** — user-facing data (Vue `modelValue`-style; mutual binding with props where appropriate).

**Rationale**: see [`decisions/D-axiom-A5-rationale.md`](./decisions/D-axiom-A5-rationale.md).
**Implementation**: `decisions/D14-widget-state-categories.md`; `decisions/D-immutability-enforcement.md`.

---

## A6: Command Pattern & Serialization

**All state transitions are serializable, deterministic, idempotent
commands.** Commands target entities by stable IDs and support atomic
multi-step transactions.

- Backend-agnostic (Python, WASM, Go).
- CRDT-compatible (collaborative editing, offline-first, conflict resolution).
- Reactive via refs (Vue-style reactivity per A10).
- State transitions are explicit (no hidden side effects), auditable (command log), reversible (undo/redo via command replay).

**Rationale**: see [`decisions/D-axiom-A6-rationale.md`](./decisions/D-axiom-A6-rationale.md).
**Implementation**: Notion "Centralized Graph State Package"; `decisions/D3.4-events-and-commands-reconciled.md`.

---

## A7: Canonical Workflow Model

**Workflow state is four layers: WorkflowSpec (semantic source), WorkflowLayout
(editor state), ExecutionPrompt (compiled), RunSnapshot (immutable run input).**

- WorkflowSpec is canonical for semantics; no layout, no editor state.
- Layout never affects execution.
- Prompt is derived from WorkflowSpec; never authored directly.
- RunSnapshot is immutable once created; used for replay, debugging.

**Implementation**: Notion "RFC Extension: Canonical Workflow Source and Run Snapshot Model"; `decisions/D-no-app-beforeprompt.md`; A16 unifies prompt + workflow JSON.

---

## A8: Extensibility as Meta-Goal

**We are building a meta-API, not just implementing features.** Every
surface added today must consider future extension points.

- API must be easy to extend/change in the future.
- Prefer composition over inheritance.
- Prefer explicit over implicit.
- Avoid locking into patterns that prevent evolution.

---

## A9: Security & Isolation

**Extensions get minimal required access; private graph structure remains
private.**

- **Least privilege**: scoped capabilities via handles, no blanket access to internals.
- **IP protection**: linked instances don't leak blueprint internals; serialization respects visibility boundaries.

---

## A10: Vue Reactivity Idioms

**The API follows Vue 3.5 patterns natively; non-Vue extensions work via
thin wrappers.**

- Refs for mutable reactive state; computed for derived values; watch for side effects.
- Setup function pattern for initialization (per D2 — `decisions/D2-vue-setup-function-primer.md`).
- Lifecycle hooks (`onMounted`, `onUnmounted`) for DOM timing.
- `provide()` / `inject()` is a framework-internal mechanism, NOT an extension-author API (see A14 row for `getWidget` rationale).

**Implementation**: `decisions/D1-vue-reactivity-primer.md`; `decisions/D2-vue-setup-function-primer.md`; `decisions/D8-world-vue-reactive-adapter.md`.

---

## A11: ECS Principles

**The underlying architecture is Entity-Component-System.**

- **Entities** are IDs, not objects.
- **Components** are plain data (no methods, no back-references to parent entities).
- **Systems** operate on component queries (pure functions).
- No inheritance hierarchies.
- Extensions interact via handles that wrap ECS queries.

**Implementation**: `decisions/D13-ecs-alignment-audit.md`; `decisions/D-widget-serialization-simplification.md`.

---

## A12: Mount-Lifecycle as the Sole DOM Seam

**There is one Widget shape. DOM is reached only through the optional
`mount(host, ctx) → cleanup?` lifecycle hook.** No DOM/native distinction in
the v2 extension-api surface.

### Hard rules

- No `widget.element` / `widget.inputEl` field. No `kind: 'dom'` discriminator. No `DOMWidgetOptions` subtype. No `node.addDOMWidget()`.
- Widget mount bodies capture the element via closure; later code paths reach the element through the closure binding.
- `host` is a runtime-owned `<div>`; mount bodies append into it but do not manage it. The runtime moves the host (graph↔app mode, subgraph promotion, `<KeepAlive>` shuffle) without involving the widget.
- `mount()`'s returned cleanup fires once, on widget destruction only. Host-remount (same instance, different host) fires `ctx.onBeforeRemount(fn)` / `ctx.onAfterRemount(newHostFn)` — separate from cleanup.
- Custom widget types register via `defineWidget({type, mount, …})`. No loose `addWidget('unregistered-type', …)` fallback — unregistered types do not render.
- v1 patterns (`addDOMWidget`, `widget.element`, `widget.inputEl`) remain available through the v1 path during the D6 parallel-paths window and break deliberately at D6 Phase D sunset.

### What this changes for you (W19.A6)

v1 code accessed the wrapping `<div>` via `widget.element` / `widget.inputEl`
on the widget handle. **v2 code captures the same element via the
`mount(host, ctx)` closure binding instead.** The element itself isn't
gone — only the handle accessor is removed. Both v1 and v2 widgets
ultimately render into a runtime-owned host `<div>` the framework manages;
v2 just makes the ownership explicit and prevents extensions from holding
stale element references after a host-remount.

### Remount vs Recreate (W19.A7 glossary)

Two distinct lifecycle scenarios; do not conflate them:

- **Remount** = *same widget instance, different host `<div>`*. Triggered by
  `<KeepAlive>` shuffle or single-pane subgraph navigation. The widget's
  internal state (closures, in-progress edits, listeners) survives. Fires
  `ctx.onBeforeRemount(fn)` then `ctx.onAfterRemount(newHostFn)`.
- **Recreate** = *fresh widget instance from spec*. Triggered by split-view
  (the same Value displayed in two panes — each pane has its own
  instance), subgraph promotion, or workflow load. The previous instance
  is destroyed (cleanup fires); a new instance is constructed from the
  schema declaration. Internal state does NOT survive.

The runtime decides which path applies based on the move context. Extension
authors who need cross-instance coordination should NOT rely on instance
identity — instead, use `defineWidgetExtension({on('valueChanged', fn)})`
which applies to every instance of a widget type. See `decisions/D-define-widget-augmenter.md`.

A future ADR ([`D-unify-widget-mount-model.md`](./decisions/D-unify-widget-mount-model.md),
PROPOSED) collapses non-DOM widgets onto the same mount path, making
recreate the canonical lifecycle for ALL widgets.

### Validation

- No `element` / `inputEl` / `DOMWidget*` symbols exported from `src/extension-api/widget.ts`, `node.ts`, `index.ts`, or `types.ts`.
- No `addDOMWidget` method on `NodeHandle`.
- All custom widget rendering routes through `defineWidget({mount})` and the runtime's per-widget host-`<div>` factory.

**Rationale**: see [`decisions/D-axiom-A12-rationale.md`](./decisions/D-axiom-A12-rationale.md).
**Implementation**: `decisions/D-widget-converge.md` (W6.P3, 2026-05-18).

---

## A13: Single Coordinate Space (Canvas)

**Public API speaks one coordinate space (canvas units, world space).**
No `clientX` / `clientY` / `pageX` / `pageY` / `getBoundingClientRect`
symbols on any public-API method signature.

- All four `NodeHandle` spatial methods carry JSDoc naming "canvas units" explicitly.
- Authors needing screen-space coordinates use the documented escape-hatch (`window.app.canvas.ds.scale` / `.offset` + `getBoundingClientRect` + `devicePixelRatio`) with a `// escape-hatch — see D-coord-space.md` annotation. The escape-hatch is NOT a stability promise.
- Migration-guide section "Coordinate spaces — single-unified-concept policy" covers all six documentation-contract items from `D-coordinate-space.md`.

### Validation

- No `Viewport` / `ScreenPoint` / `CSSPoint` types exported.
- All four `NodeHandle` spatial methods carry the "canvas units" JSDoc.

**Rationale**: see [`decisions/D-axiom-A13-rationale.md`](./decisions/D-axiom-A13-rationale.md).
**Implementation**: `decisions/D-coordinate-space.md`.

---

## A15: Widget Declarativity

**Widgets are schema-declared. Every widget originates from a Python node
class `INPUT_TYPES` declaration.** There is no runtime widget addition
by frontend extensions; there is no "frontend-only widget" concept.

- `node.addWidget(...)` and friends are NOT part of the v2 surface and will not be added back (`decisions/D-ban-runtime-addwidget.md` handles v1 enforcement).
- UI-only state options: (1) boxed/composed widget (BBOX-style — widget IS its own schema input value); (2) non-widget UI primitive (overlays, panels, custom DOM via `defineNode` / `defineExtension` setup); (3) schema input (accept that the data point belongs in the workflow — add it to `INPUT_TYPES`).

### Validation

- `src/extension-api/node.ts` exposes no `addWidget` / `addDOMWidget` surface (see §A14 REMOVED table).
- `scripts/check-axiom-compliance.sh` strict-fails on re-introduction.

**Rationale**: see [`decisions/D-axiom-A15-rationale.md`](./decisions/D-axiom-A15-rationale.md).
**Implementation**: `decisions/D-widget-serialization-simplification.md` (wave-9, 2026-05-20).

---

## A16: Unified Serialization Target

**Workflow JSON and API prompt payload converge to a single serialization
output.** Authors cannot disable serialization at the widget level. The
sole extension-author interface to serialization is
`widget.on('beforeSerialize', handler)`.

- No matrix of disable knobs (commented out in §A14).
- No 4-context discriminator on the serialize event payload — clone and subgraph-promote are framework concerns; workflow and prompt converge.
- Hook fires once per serialization; handler returns (or awaits) a single value; framework writes that value to every transport.
- `node.on('beforeSerialize')` remains `@deprecated` + runtime-warned per ADR-0010 (not banned — structurally redundant after A15+A16, but ban deferred per user direction 2026-05-20).

### Validation

- `WidgetBeforeSerializeEvent` exposes no `context` field, no `skip()` method.
- `WidgetHandle` exposes no `setSerializeEnabled` / `isSerializeEnabled` methods.
- `WidgetOptions` type has no `serialize?` key.
- `scripts/check-axiom-compliance.sh` strict-fails on any of the above re-appearing in `widget.ts`.

**Rationale**: see [`decisions/D-axiom-A16-rationale.md`](./decisions/D-axiom-A16-rationale.md).
**Implementation**: `decisions/D-widget-serialization-simplification.md` (wave-9, 2026-05-20); `decisions/D14-serialization-convergence.md`.

---

## A14: Phase A Surface Exclusions

**The following surfaces are commented out or removed for Phase A.** They
may be restored in later phases if validated ecosystem use cases emerge.

### REMOVED (not commented — permanently excluded from v2)

| Symbol | File | Rationale |
|--------|------|-----------|
| `addWidget()` | node.ts | Widgets are defined in Python node schema (A15), not created at frontend runtime. Violates A1 — nodes mutating widget collection. |
| `addDOMWidget()` | node.ts | Collapsed into unified mount-lifecycle (A12). DOM widgets register via `defineWidget({mount})`. |

### COMMENTED OUT (Phase A exclusions — may return)

| Symbol | File | Rationale |
|--------|------|-----------|
| `getWidget(name)` / `getWidgets()` | node.ts | **Bilateral A1 closure** per `D-no-node-widget-access.md` (2026-05-19). Nodes cannot reference or enumerate widgets. The `widget→node` direction (`widget.parentNode`) remains the sole channel. Extensions needing per-widget coordination register via `defineWidget({mount, …})` and own their state internally — cross-entity coordination flows through the World event bus only (W19.A8: Vue `provide()` / `inject()` is a framework-internal mechanism, NOT an extension-author API). |
| `getMode()` / `setMode()` | node.ts | `nodeMode` access has "egregious" observed use patterns per meeting. A2. |
| `NodeMode` type | node.ts | Supporting type for mode access. A2. |
| `NodeModeChangedEvent` | node.ts | Event for mode changes. A2. |
| `on('modeChanged')` | node.ts | Event subscription for mode. A2. |
| `inputs()` / `outputs()` | node.ts | Slot introspection. Most use cases have better alternatives. A2. |
| `SlotInfo` / `SlotDirection` / `SlotEntityId` | node.ts | Supporting types for slot API. A2. |
| `NodeConnectedEvent` / `NodeDisconnectedEvent` | node.ts | Slot/connection events. A2. |
| `on('connected')` / `on('disconnected')` | node.ts | Slot event subscriptions. A2. |
| `getPosition()` / `setPosition()` | node.ts | Node spatial state. Deferred pending A13 stabilization. |
| `getSize()` / `setSize()` | node.ts | Node spatial state. Deferred. |
| `getTitle()` / `setTitle()` | node.ts | Node visual state. Uncertain use case. |
| `isSelected()` | node.ts | Node selection state. Uncertain use case. |
| `isHidden()` / `setHidden()` | widget.ts | Widget visibility. Deferred pending serialization convergence. |
| `isDisabled()` / `setDisabled()` | widget.ts | Widget enabled state. Deferred pending serialization convergence. |
| `setSerializeEnabled(bool)` / `isSerializeEnabled()` | widget.ts | **A16 closure** — authors cannot disable serialization. UI-only state belongs in boxed widgets, non-widget UI primitives, or schema inputs (A15). |
| `WidgetBeforeSerializeEvent.context` (4-way discriminator) | widget.ts | A16 — single serialization target. Workflow JSON ≡ prompt payload; clone / subgraph-promote are framework concerns. Hook fires once. |
| `WidgetBeforeSerializeEvent.skip()` | widget.ts | A16 — `skip()` IS a per-call disable. Removed alongside the discriminator. |
| `WidgetPropertyChangeEvent` | widget.ts | Vacuous after `'serialize'` removed from union (only member). |
| `on('propertyChange', handler)` overload | widget.ts | Subscriber for the vacated event. |
| `WidgetOptions.serialize?: boolean` | widget.ts | Contradicted A16 at the read site. Already write-blocked by `D-immutability-enforcement.md`; key now removed from the type. |

**Restoration criteria**: a surface moves from "commented out" to "shipped" when (1) a validated ecosystem use case is documented, (2) the surface has been audited against A1–A13, and (3) test coverage exists in the behavior-triplet suite.

**Validation**: no symbols from the "REMOVED" table appear in `src/extension-api/index.ts` barrel; symbols from "COMMENTED OUT" table are wrapped in `// PHASE_A_EXCLUDED` blocks.

---

## Axiom-Excluded Test Annotation Policy

**When a source-code surface is removed or deferred per an accepted axiom
or ADR, tests that asserted on the absent surface MUST be converted to
expected-failure annotations rather than deleted outright.**

The annotated test continues to run in CI; if the surface is ever
re-introduced (intentionally or by regression) the expected-failure flips
to a real failure and surfaces the policy violation.

### Mechanism

Tests use the project's `axiomExcluded({…})` helper (thin wrapper around
`test.fails` + `task.meta.annotations`):

- `axiom` — short id (`"A15"`, `"A14:REMOVED"`)
- `adr` — workspace ADR path
- `rationale` — one-sentence summary of *why* the surface is absent
- `migration` — one or more migration paths (e.g. `"declare in INPUT_TYPES"`, `"use boxed widget"`)
- `restoration` — optional cross-ref to ADR restoration criteria

### Compat-floor doctrine retired (wave-10)

The "compat-floor blast_radius ≥ N MUST pass before v2 ships" annotations
are retired. Compat floors based on ecosystem-consumer counts conflated
*evidence that a migration is needed* with *evidence that a specific
surface must exist to satisfy that migration*. Axioms and ADRs are the
source of truth for what the v2 surface contains; BC tests verify
behavior of admitted surfaces and use `axiomExcluded({…})` for everything else.

### When deletion is preferable

Delete a test outright (rather than annotating) only when the **test's
scenario** is no longer meaningful — not when the surface is gone but the
user-journey it tested still exists with a different surface. Rewrite
against the new surface in the latter case.

### Validation

- `src/extension-api-v2/__tests__/helpers/axiomExcluded.ts` is the canonical helper.
- Inline `test.fails(…)` / `test.skip(…)` without an attached axiom-excluded annotation is a process violation; future lint rule may enforce.

**Implementation**: `decisions/D-ban-runtime-addwidget.md` (wave-10, 2026-05-20).

---

## Future Constraints (Jacob to compile — FU-1)

- Parallel execution
- Streaming outputs
- Incremental computation
- Distributed execution

All current designs must not preclude these future capabilities.

---

## Cross-References

- **Axiom rationale ADRs**: `decisions/D-axiom-A{1,2,4,5,6,12,13,15,16}-rationale.md` (long-form rationale extracted per W19.A1+A2)
- **Derived theorems**: [`axioms-theorems.md`](./axioms-theorems.md) (W19.A4)
- **Glossary**: [`docs/glossary.md`](./docs/glossary.md) (W19.A3)
- **Phase B re-open ADRs (PROPOSED)**: `decisions/D-unify-widget-mount-model.md` (W19.A9); `decisions/D-widget-promotion-semantics.md` (W19.A10)
- **Decision records**: `decisions/D1`–`decisions/D20-id-type-convergence.md`
- **Plans**: P1 (`research/architecture/plans/`), P2 (extension-api package)
- **Meeting notes**: `research/external/meeting-2026-05-18-extension-api-design-review.md`
- **Notion docs**:
  - [Centralized Graph State Package](https://www.notion.so/comfy-org/Centralized-Graph-State-Package-2736d73d3650804ea114c123ddd2c51e)
  - [RFC Extension: Canonical Workflow Source and Run Snapshot Model](https://www.notion.so/comfy-org/RFC-Extension-Canonical-Workflow-Source-and-Run-Snapshot-Model-32e6d73d36508194a711c981b81b2b9a)
- **Slack checkpoint**: <https://comfy-organization.slack.com/archives/C09TX71RK5F/p1774736219050719>
- **Validation**: `scripts/check-axiom-compliance.sh`
