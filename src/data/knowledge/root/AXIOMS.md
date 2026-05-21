# Extension API v2 — Design Axioms & Constraints

> **Status**: Living document. Updated 2026-05-18 from design review meeting + Notion docs.
> **Source**: Meeting transcript `Frontend-Standup-ef8d2f8d-17b7.json` (2026-05-18),
> Notion "Centralized Graph State Package" + "RFC Extension: Canonical Workflow Model"

This document captures the **non-negotiable design constraints** that all Extension API v2
work must respect. Violations of these axioms are hard blockers.

---

## A1: Widget-Centric Philosophy

**Widgets are THE singular concept** for all node/graph extensions.

- Widgets must work **anywhere**: graph editor, app mode, without a node, without a graph
- No special-casing by context — if we can keep it general, we must
- "Widgets can potentially work anywhere" — they are the primary extension surface
- Nodes should **never "look down"** to widgets (D1 meeting decision)
  - Node hooks cannot reference/modify widgets
  - Widgets can know their parent node, but nodes cannot enumerate widgets
  - Rationale: Widgets can move (promotion, app mode), nodes cannot safely hold widget refs

> "Widgets are even able to live or exist and be functional even without a graph or a node."
> — Christian Byrne (on app mode constraint)

### Widget Contexts
Widgets must survive and function correctly across:
1. **Promotion** — widget moves from subgraph to parent graph
2. **App mode** — widget exists without visible graph
3. **Partial graph views** — subgraph boundaries hide some nodes
4. **Linked instances** (blueprints) — same graph instance across clones

---

## A2: Minimal API Surface

**Start with absolute minimum. Add by necessity, not by usage patterns.**

- Comment out anything we're not 100% sure about
- `nodeMode` is just ONE example — remove/comment-out all uncertain surfaces
- Slot/connection hooks → comment out for Phase A (most use cases have better alternatives)
- If we observe "egregious" use patterns, that's signal to NOT expose that surface
- Features added in phases based on **real necessity**, not ecosystem adoption patterns

> "We should have an API where however people use it, if they're only using it, things
> should just work." — Jacob Segal

### Phase A Exclusions (Comment Out)
- [ ] Slot/connection hooks
- [ ] `nodeMode` access
- [ ] Node→widget communication methods
- [ ] Any surface with primarily "egregious" observed use cases

---

## A3: Linked Subgraph Constraint

**Linked subgraphs (blueprints) exist: same graph instance across clones.**

This is a MAJOR design constraint that affects:
- ID strategy (IDs must be stable across clone boundaries)
- Widget state (must not assume single instance)
- Event dispatch (events may fire in multiple contexts)
- Serialization (must not assume single workflow)

All API designs must be tested against the linked-instance scenario.

---

## A4: ID Strategy — Abstract Handles, Not Raw IDs

**Extension authors should never need raw IDs in the ideal world.**

- Use abstract handle objects with automatic scope management
- IDs have scopes — auto-dispose when scope ends
- Extensions don't need to know about subgraphs at the ID level
- Internal ECS IDs are distinct from extension-facing handles
- Locator IDs vs execution IDs need further discussion (deferred)

---

## A5: Widget State — Three-Tier Model

**Schema + Props + Values (with mutual binding)**

1. **Schema** — Immutable for widget lifetime
   - Type, name, presence of constraints
   - Dynamic combos: schema is fixed, sub-widgets derived from parent schema

2. **Props** — Mutable runtime configuration
   - disabled, hidden, min/max values, callback, etc.

3. **Values** — User-facing data
   - Like Vue's `modelValue` — special by convention
   - Mutual binding between value and props where appropriate

> "Widget state is basically a collection of historical accidents and bad decisions."
> — Christian Byrne

---

## A6: Command Pattern & Serialization

From "Centralized Graph State Package" Notion doc:

### Must-Have Requirements
- **Backend-agnostic**: Interface must work with any backend (Python, WASM, Go)
- **Portable**: Generalizable interface not tied to specific runtime
- **Deterministic**: Commands produce same result given same state
- **Idempotent**: Same command can be applied multiple times safely
- **Serializable**: All commands must be serializable (JSON, protobuf, etc.)
- **Stable targeting**: Commands reference entities by stable IDs
- **Transactional**: Support for atomic multi-step operations
- **Reactive**: Via refs (Vue-style reactivity)

### CRDT Compatibility
Graph state must be CRDT-compatible for:
- Collaborative editing
- Offline-first workflows
- Conflict resolution

### Immutability
State transitions must be:
- Explicit (not hidden side effects)
- Auditable (command log)
- Reversible (undo/redo via command replay)

---

## A7: Canonical Workflow Model

From "RFC Extension: Canonical Workflow Source and Run Snapshot Model" Notion doc:

### Four-Layer Model
1. **WorkflowSpec** — Semantic source of truth
   - The "code" of the workflow
   - No layout, no editor state

2. **WorkflowLayout** — Editor state
   - Node positions, zoom, selections
   - NOT part of execution

3. **ExecutionPrompt** — Compiled artifact
   - What actually runs
   - Derived from WorkflowSpec

4. **RunSnapshot** — Immutable run input
   - Frozen state at execution start
   - Used for replay, debugging

### Source-of-Truth Rules
- WorkflowSpec is canonical for semantics
- Layout never affects execution
- Prompt is derived, never authored directly
- RunSnapshot is immutable once created

---

## A8: Extensibility as Meta-Goal

**We are building a meta-API, not just implementing features.**

- API must be "easy to extend/change in the future"
- Avoid locking ourselves into patterns that prevent evolution
- Every surface added today must consider future extension points
- Prefer composition over inheritance
- Prefer explicit over implicit

---

## A9: Security & Isolation

### Least Privilege
- Extensions get minimal required access
- No blanket access to internals
- Scoped capabilities via handles

### IP Protection
- Private graph structure must remain private
- Linked instances don't leak blueprint internals
- Serialization must respect visibility boundaries

---

## A10: Vue Reactivity Idioms

The API follows Vue 3.5 patterns:

- **Refs** for mutable reactive state
- **Computed** for derived values
- **Watch** for side effects
- **Setup function** pattern for initialization
- **Provide/inject** for dependency injection
- **Lifecycle hooks** (mounted, unmounted) for DOM timing

Extensions that use Vue patterns should feel native; those that don't
should still work via thin wrappers.

---

## A11: ECS Principles

The underlying architecture is Entity-Component-System:

- **Entities** are IDs, not objects
- **Components** are plain data
- **Systems** operate on component queries
- No inheritance hierarchies
- Extensions interact via handles that wrap ECS queries

---

## A12: Mount-Lifecycle as the Sole DOM Seam

Per **D-widget-converge** (ACCEPTED 2026-05-18):

There is one `Widget` shape. DOM is reached **only** through the optional
`mount(host, ctx) → cleanup?` lifecycle hook. The DOM/native distinction does
not exist in the v2 extension-api surface.

**Hard rules:**

- No `widget.element` field. No `widget.inputEl` field. No `kind: 'dom'`
  discriminator. No `DOMWidgetOptions` subtype. No `node.addDOMWidget()`.
- The widget's mount body captures the element via closure; later code paths
  reach the element through the closure binding, not through the handle.
- `host` is a runtime-owned `<div>`; widget mount bodies append into it but
  do not manage it. This lets the runtime move the host (graph↔app mode,
  subgraph promotion, `<KeepAlive>` shuffle) without involving the widget.
- `mount()`'s returned cleanup fires **once, on widget destruction only.**
  Host remount fires `ctx.onBeforeRemount(fn)` / `ctx.onAfterRemount(newHostFn)`
  — these are separate from cleanup.
- Custom widget types register via `defineWidget({type, mount, …})`. There is
  no loose `addWidget('unregistered-type', …)` fallback — unregistered types
  do not render.
- v1 patterns (`addDOMWidget`, `widget.element`, `widget.inputEl`,
  `addWidget('custom-type')` without prior `defineWidget`) remain available
  through the v1 path during the D6 parallel-paths window and break
  deliberately at D6 Phase D sunset. The migration guide documents this as
  an explicit cliff, not a runtime promise.

**Why an axiom and not just an ADR:** the rule "DOM is a lifecycle seam, not
a widget property" is invoked by every future widget-shape ADR (D14
serialization-convergence applications, future `D-widget-host-resize`,
future `D-custom-widget-renderer-events`). A12 short-circuits the
re-litigation.

**Validation:**

- No `element` / `inputEl` / `DOMWidget*` symbols exported from
  `src/extension-api/widget.ts`, `node.ts`, `index.ts`, or `types.ts`.
- No `addDOMWidget` method on `NodeHandle`.
- All custom widget rendering routes through `defineWidget({mount})` and
  the runtime's per-widget host-`<div>` factory.

---

## A13: Single Coordinate Space (Canvas)

Per **D-coord-space** (ACCEPTED 2026-05-18):

The v2 extension-api surface speaks **one coordinate space — canvas units —
through every public accessor.** There is no `clientX`, no `pageX`, no
`getBoundingClientRect`, no CSS-pixel space exposed on any `NodeHandle`,
`WidgetHandle`, or future pointer-event helper.

**Hard rules:**

- `NodeHandle.getPosition` / `setPosition` / `getSize` / `setSize` —
  canvas units. No `space?: 'canvas' | 'client' | 'css'` parameter
  variant. No `getScreenPosition` / `getCSSPosition`.
- Pointer-event helpers (when added in a future ADR) deliver canvas-space
  `{ x, y }` only. The runtime performs the conversion before handing
  the event to the extension.
- `defineWidget({mount})` hosts are runtime-positioned. The mount body
  appends DOM into the host but does not run its own canvas↔CSS
  conversion; the runtime guarantees the host's visual placement matches
  its owning node's canvas position.
- `convertOffsetToCanvas` / `convertCanvasToOffset` / `convertEventToCanvas`
  LiteGraph helpers are NOT re-exported on the v2 public surface.
- `devicePixelRatio` is invisible to extensions through the public
  handles. The dpr policy is: the runtime owns dpr math; extensions
  using the documented surface never multiply or divide by dpr.

**The escape-hatch** (deliberately fragile, `@stability escape-hatch`):

For legitimate screen-space needs (hi-DPI math on a custom GPU canvas,
floating overlays anchored to absolute browser coordinates, custom
hit-testing outside the LiteGraph canvas):

```ts
// escape-hatch — see D-coord-space.md § Documentation contract
const scale = window.app.canvas.ds.scale          // zoom factor
const [ox, oy] = window.app.canvas.ds.offset      // pan offset (canvas units)
const rect = window.app.canvas.canvas.getBoundingClientRect()  // CSS pixels
const dpr = window.devicePixelRatio                // hi-DPI factor
```

Authors reaching for the escape-hatch MUST annotate the use site with the
`escape-hatch` comment so reviewers (human or AI) can see the dependency
is deliberate. The escape-hatch is NOT a stability promise — it can
change shape with internal renderer refactors.

**Why an axiom and not just an ADR:** the rule "one coordinate space at
the boundary" is invoked by every future surface that touches geometry
(pointer-event helpers, drag-and-drop ADRs, future viewport ADRs,
selection-rectangle helpers, custom `onDraw*` patching replacements).
A13 short-circuits the re-litigation.

**Validation:**

- No `clientX` / `clientY` / `pageX` / `pageY` / `getBoundingClientRect`
  symbols on any public-API method signature.
- No `Viewport` / `ScreenPoint` / `CSSPoint` types exported.
- All four `NodeHandle` spatial methods carry a JSDoc that names
  "canvas units" explicitly.
- Migration-guide section "Coordinate spaces — single-unified-concept
  policy" covers all six documentation-contract items from D-coord-space.

---

## A15: Widget Declarativity

Per **D-widget-serialization-simplification (wave-9, 2026-05-20)** and A1
(widget-centric), A5 (3-tier widget state):

**Widgets are schema-declared.** Every widget originates from a Python node
class `INPUT_TYPES` declaration. There is no runtime widget addition by
frontend extensions, and there is no concept of a "frontend-only widget."

### Consequences

- `node.addWidget(...)` and friends are **not part of the v2 surface** and
  will not be added back. A separate ADR (`D-ban-runtime-addwidget`, tracked
  as wave-10 follow-up) handles enforcement on the v1 surface during the
  parallel-paths transition (D6).
- If an extension needs UI-only state, the choices are:
  1. **Boxed/composed widget** (BBOX-style) — the widget IS its own schema
     input value; the box composes the UI but the value is a single
     schema-declared field.
  2. **Non-widget UI primitive** — overlays, panels, custom DOM not
     registered through the widget system. Lifecycle attaches via
     `defineNode` / `defineExtension` setup.
  3. **Schema input** — accept that the data point belongs in the workflow
     and add it to `INPUT_TYPES`.

### Rationale

Runtime widget addition was the *underlying reason* most of the
serialization-disable matrix existed: a widget added at runtime has no
backend schema slot, so its value had to be stripped from the prompt to
avoid backend rejection. Declarativity removes the cause; A16 removes the
escape hatch.

### Validation

- `src/extension-api/node.ts` exposes no `addWidget` / `addDOMWidget`
  surface (already enforced — see A14 "REMOVED" table)
- `scripts/check-axiom-compliance.sh` rejects re-introduction

---

## A16: Unified Serialization Target

Per **D-widget-serialization-simplification (wave-9, 2026-05-20)** and D14
(serialization convergence), A1 (widget-centric):

**Workflow JSON and API prompt payload converge to a single serialization
output.** Authors cannot disable serialization at the widget level. The
**sole** extension-author interface to serialization is
`widget.on('beforeSerialize', handler)`.

### Consequences

- No matrix of disable knobs (`widget.options.serialize`,
  `widget.setSerializeEnabled`, `event.skip()`) — all are commented out
  in A14.
- No 4-context discriminator (`'workflow' | 'prompt' | 'clone' |
  'subgraph-promote'`) on the serialize event payload. Clone and
  subgraph-promote are framework concerns; workflow and prompt converge.
- The hook fires **once per serialization**. The handler returns (or
  awaits resolution of) a single value, and the framework writes that
  value to every transport.
- `node.on('beforeSerialize')` remains `@deprecated` + runtime-warned
  per ADR-0010 — *not banned* by this axiom (per user direction
  2026-05-20). With A15 + A16 in force the node-level surface is
  structurally redundant, but the ban itself is deferred.

### Rationale

The four-context discriminator inverted the direction of knowledge flow:
extensions had to know which transport fired in order to behave
correctly. The framework owns transport; extensions own value. Per D14
§Phase 4, the hook is supposed to fire once with a single payload —
A16 finishes that job.

### Validation

- `WidgetBeforeSerializeEvent` exposes no `context` field, no `skip()`
  method
- `WidgetHandle` exposes no `setSerializeEnabled` / `isSerializeEnabled`
  methods
- `WidgetOptions` type has no `serialize?` key
- `scripts/check-axiom-compliance.sh` strict-fails on any of the above
  re-appearing in `widget.ts`

---

## A14: Phase A Surface Exclusions

Per **2026-05-18 design review** and A2 (minimal API surface):

The following surfaces are **commented out or removed** for Phase A. They may
be restored in later phases if validated use cases emerge.

### REMOVED (not commented — permanently excluded from v2)

| Symbol | File | Rationale |
|--------|------|-----------|
| `addWidget()` | node.ts | Widgets are defined in Python node schema, not created at frontend runtime. Violates widget-centric philosophy (A1) — nodes mutating widget collection. |
| `addDOMWidget()` | node.ts | Collapsed into unified mount-lifecycle (A12). DOM widgets register via `defineWidget({mount})`. |

### COMMENTED OUT (Phase A exclusions — may return)

| Symbol | File | Rationale |
|--------|------|-----------|
| `getWidget(name)` / `getWidgets()` | node.ts | **Bilateral A1 closure** per D-no-node-widget-access (2026-05-19). Nodes cannot reference or enumerate widgets. The `widget→node` direction (`widget.parentNode`) remains the sole channel. Extensions needing per-widget coordination register via `defineWidget({mount, ...})` and share state through Vue `provide()` / `inject()` or the World event bus. |
| `getMode()` / `setMode()` | node.ts | nodeMode access has "egregious" use patterns per meeting. A2. |
| `NodeMode` type | node.ts | Supporting type for mode access. A2. |
| `NodeModeChangedEvent` | node.ts | Event for mode changes. A2. |
| `on('modeChanged')` | node.ts | Event subscription for mode. A2. |
| `inputs()` / `outputs()` | node.ts | Slot introspection. Most use cases have better alternatives. A2. |
| `SlotInfo` / `SlotDirection` / `SlotEntityId` | node.ts | Supporting types for slot API. A2. |
| `NodeConnectedEvent` / `NodeDisconnectedEvent` | node.ts | Slot/connection events. A2. |
| `on('connected')` / `on('disconnected')` | node.ts | Slot event subscriptions. A2. |
| `getPosition()` / `setPosition()` | node.ts | Node spatial state. Deferred pending A13 (coord space) stabilization. |
| `getSize()` / `setSize()` | node.ts | Node spatial state. Deferred. |
| `getTitle()` / `setTitle()` | node.ts | Node visual state. Uncertain use case. |
| `isSelected()` | node.ts | Node selection state. Uncertain use case. |
| `isHidden()` / `setHidden()` | widget.ts | Widget visibility. Deferred pending serialization convergence. |
| `isDisabled()` / `setDisabled()` | widget.ts | Widget enabled state. Deferred pending serialization convergence. |
| `setSerializeEnabled(bool)` / `isSerializeEnabled()` | widget.ts | **A16 closure** per D-widget-serialization-simplification (wave-9, 2026-05-20). Authors cannot disable serialization — there is no matrix to expose. UI-only state belongs in boxed widgets, non-widget UI primitives, or schema inputs (A15). |
| `WidgetBeforeSerializeEvent.context` (4-way discriminator) | widget.ts | A16 — single serialization target. Workflow JSON ≡ prompt payload; clone / subgraph-promote are framework concerns. Hook fires once. |
| `WidgetBeforeSerializeEvent.skip()` | widget.ts | A16 — `skip()` IS a per-call disable. Removed alongside the discriminator. |
| `WidgetPropertyChangeEvent` | widget.ts | Vacuous after `'serialize'` removed from union (only member). |
| `on('propertyChange', handler)` overload | widget.ts | Subscriber for the vacated event. |
| `WidgetOptions.serialize?: boolean` | widget.ts | Contradicted A16 at the read site. Already write-blocked by D-immutability-enforcement; key now removed from the type. |

**Restoration criteria:** A surface moves from "commented out" to "shipped" when:
1. A validated ecosystem use case is documented
2. The surface has been audited against A1–A13
3. Test coverage exists in the behavior-triplet suite

**Validation:**

- No symbols from the "REMOVED" table appear in `src/extension-api/index.ts` barrel
- Symbols from "COMMENTED OUT" table are wrapped in `// PHASE_A_EXCLUDED` blocks

---

## Axiom-Excluded Test Annotation Policy

Per **D-ban-runtime-addwidget (wave-10, 2026-05-20)** and as the test-side
companion to A14 (Phase A Surface Exclusions), A15, and A16.

**When a source-code surface is removed or deferred per an accepted axiom
or ADR, tests that asserted on the absent surface MUST be converted to
expected-failure annotations rather than deleted outright.** The
annotated test continues to run in CI; if the surface is ever
re-introduced (intentionally or by regression) the expected-failure
flips to a real failure and surfaces the policy violation.

### Mechanism

Vitest convention. Tests use the project's `axiomExcluded({...})`
helper (a thin wrapper around `test.fails` that writes structured
metadata to `task.meta.annotations`). The annotation block carries:

- `axiom` — short id, e.g. `"A15"` or `"A14:REMOVED"`
- `adr` — workspace ADR path, e.g. `"decisions/D-ban-runtime-addwidget.md"`
- `rationale` — one-sentence summary of *why* the surface is absent
- `migration` — one or more migration paths the original consumer
  should take (e.g. `"declare in INPUT_TYPES"`, `"use boxed widget"`)
- `restoration` — optional cross-ref to the ADR's restoration criteria
  if the surface can re-enter

### Compat-floor doctrine retired

Previously the v2 BC test suite carried "compat-floor blast_radius ≥ N
— MUST pass before v2 ships" annotations on tests that asserted on
specific v1→v2 migration targets. **This doctrine is retired as of
wave-10.** Compat floors based on ecosystem-consumer counts conflated
*evidence that a migration is needed* with *evidence that a specific
surface must exist to satisfy that migration*. Axioms and ADRs are the
correct source of truth for what the v2 surface contains; BC tests
verify behavior of surfaces the design admits, and use
`axiomExcluded({...})` for everything else.

### When deletion is preferable to annotation

Delete a test outright (rather than annotating) only when the **test's
scenario** is no longer meaningful — not when the surface is gone but
the user-journey it tested still exists with a different surface. In
the latter case, rewrite the test against the new surface; in the
former case, deletion is the honest signal.

### Validation

- `src/extension-api-v2/__tests__/helpers/axiomExcluded.ts` is the
  canonical helper; tests must import from there, not inline
  `test.fails(...)`
- Inline `test.fails(...)` (or `test.skip(...)`) without an attached
  axiom-excluded annotation is a process violation; future lint rule
  may enforce

---

## Future Constraints (Jacob to compile — FU-1)

- Parallel execution
- Streaming outputs
- Incremental computation
- Distributed execution

All current designs must not preclude these future capabilities.

---

## Cross-References

- D1–D8 ADRs in `decisions/`
- D14 (serialization convergence)
- P2 (extension-api package plan)
- Meeting notes: `research/external/meeting-2026-05-18-extension-api-design-review.md`
- Notion docs:
  - [Centralized Graph State Package](https://www.notion.so/comfy-org/Centralized-Graph-State-Package-2736d73d3650804ea114c123ddd2c51e)
  - [RFC Extension: Canonical Workflow Source and Run Snapshot Model](https://www.notion.so/comfy-org/RFC-Extension-Canonical-Workflow-Source-and-Run-Snapshot-Model-32e6d73d36508194a711c981b81b2b9a)
- Slack checkpoint (save format PRD review): https://comfy-organization.slack.com/archives/C09TX71RK5F/p1774736219050719
- Validation: `scripts/check-axiom-compliance.sh`
