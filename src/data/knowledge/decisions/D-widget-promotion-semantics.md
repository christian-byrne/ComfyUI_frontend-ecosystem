# D-widget-promotion-semantics — widget promotion creates a new Topology entity, not a Value mutation

- **Status**: PROPOSED — 2026-05-21 (wave-19, W19.A10). Flips to **ACCEPTED** when PR #11939 (Alex's ECS branch) merges AND W19.A9 (`D-unify-widget-mount-model`) is ACCEPTED. Composability gate prevents single-step landings.
- **Decider:** Christian (user direction; Slack agreement — see §Rationale)
- **Wave:** 19
- **Axioms cited:** A1 (widget-centric), A4 (ID strategy — abstract handles, IDs auto-dispose with scope), A5 (3-tier widget state — Schema immutable), A7 (canonical workflow model — Topology operations produce reversible commands), A11 (ECS principles — entities are IDs, components plain data)
- **Composes-with:** W19.A9 (`D-unify-widget-mount-model.md` — unified mount + this ADR together replace the current "widget becomes node" promotion code path)
- **Supersedes:** none (this is a NEW semantic for promotion; current implementation is documented but not codified as an ADR — see §Context)
- **Related:**
  - `decisions/D-unify-widget-mount-model.md` (W19.A9 — composes-with; both ADRs land together at Phase B)
  - `decisions/D-no-virtual-nodes-in-api.md` (sister direction — same instinct: stop hiding behavior in "virtual" categories)
  - `decisions/D-immutability-enforcement.md` (Values are immutable references; promotion cannot mutate the source Value)
  - `axioms-theorems.md` Theorem 6 — *Value Promotion Impossibility* (derives from A4 + A5 that promotion CANNOT mutate the source Value, must create a new Topology entity)
  - `AXIOMS.md` §A1 §A4 §A5 §A7 §A11 — premises

## Context

In v1 and the current Phase-A v2 surface, "widget promotion" (the user
right-clicks a widget and selects "promote to node" on a subgraph) is
implemented by **mutating the widget**: the widget instance is replaced
in-place by a new node that holds the widget's value. The widget *becomes*
a node. The Value moves with it.

This pattern predates the axiom set. Re-examining it against:

- **A4** (Values independent of Topology — implicit in current AXIOMS.md
  via A11 ECS principles + the four-layer workflow model of A7),
- **A5** (Schema immutable for widget lifetime),
- **A11** (entities are IDs, components are plain data, no inheritance,
  no implicit mutation),

…reveals that the current behavior **violates each premise**. A widget
that "becomes" a node either:

1. Mutates its own Schema (which A5 forbids — schemas are immutable for
   the widget's lifetime), OR
2. Disappears from the widget registry while a new node entity appears
   in the Topology with no causal link to the source Value (which makes
   undo + linked-instance projection unsafe per A3 + A7).

Glary-Bot's W19.A4 *Theorem 6 (Value Promotion Impossibility)* makes
the impossibility explicit:

> If Values are independent of Topology (A4-equivalent) and Value Schema
> is immutable (A5), then "promoting" a widget to the graph must create
> new Topology entities, not modify the Value. The current DOM widget
> promotion pattern (where a widget "becomes" a node) is axiomatically
> wrong — it must instead create a new node in Topology that references
> the original Value.

Christian's Slack agreement (2026-05-21) confirmed direction:

> "you're right that DOM widgets would need to change how they currently
> work w.r.t. promotion on the graph, would need to look into it a bit
> more" — Christian Byrne

## Decision

**Widget promotion is a Topology operation that produces a new entity
holding a Reference to the source Value. The source widget is unchanged.**

Concretely:

1. The user invokes "promote widget" on a widget instance.
2. The runtime issues a `Command.PromoteWidget` (serializable, reversible
   per A6 / A7) containing `{sourceValueRef, schemaSlug, targetGraphId}`.
3. The Command's reducer creates a NEW node entity in the target graph,
   pre-populated with a widget instance bound to the same Value
   Reference. The new node's widget reads/writes the same Value.
4. The source widget remains intact (still rendered, still bound to the
   same Value). If the user wanted the source widget gone, they delete
   it as a separate Topology operation — promotion does not implicitly
   delete.

The Reference can be one of:

- **Direct Value reference** — the new node's widget binds to the same
  underlying Value cell. Edits in either place propagate immediately
  (multi-instance consistency, Theorem 7).
- **Cloned Value** — the new node holds a fresh Value initialized from
  the source. Subsequent edits diverge. (Useful for "fork from current
  state" workflows.)

The default is **direct reference**; the cloned-value variant is opt-in
via a Command parameter. The user-visible UX (one click vs. modifier
key) is out of scope for this ADR and tracked separately.

### Sequence (current vs. proposed)

**Current (axiomatically wrong):**

```
User right-clicks widget → "Promote"
  → widget instance mutates: detaches from node, attaches to new node entity
  → schema must change to accommodate new container (violates A5)
  → undo replays as "demote" custom op, not "remove node + restore widget"
  → linked-instance projection: source widget disappears in every clone
    of the parent graph (often unintentional)
```

**Proposed:**

```
User right-clicks widget → "Promote"
  → Command.PromoteWidget{sourceValueRef, schemaSlug, targetGraphId} issued
  → Reducer creates new Node entity with Widget bound to sourceValueRef
  → source Widget continues to exist, still bound to sourceValueRef
  → undo replays as Command.RemoveNode{newNodeId}
  → linked-instance projection: new node appears in every clone
    (Topology change projects, source widget unchanged)
```

## Consequences

- **API surface change**: `Command.PromoteWidget` is a new public Command
  schema. The widget-instance-mutation path is removed.
- **Backward compatibility**: legacy workflows containing
  "widget-became-node" promotions auto-rewrite at load time via a
  1-version transition shim (`scripts/migrations/widget-promote-shim.ts`).
  The shim detects the old pattern (orphan widget reference + new node
  with no original Value link) and emits a `Command.PromoteWidget` with
  the cloned-Value variant (since the original Value is gone and we
  must materialize a new one to keep behavior identical).
  - Shim sunset: 2 minor versions after Phase B GA. Documented in
    migration guide.
- **Implementation locality**: this change touches
  `ComfyUI_frontend/src/lib/litegraph/` (the promotion code path) and
  the v2 extension-api Command schema. It does NOT change `defineWidget`
  or `defineNode` author-facing APIs.
- **Undo correctness**: promotion + undo + redo now produces the same
  end state as a single promotion (idempotent + reversible per A6/A7).
  Today, undo of legacy "widget-became-node" is brittle.
- **Linked-instance correctness**: in a blueprint scenario, the
  promotion projects through clones cleanly because the operation is a
  Topology-add, not a Widget-mutate. Today, it's the latter and produces
  surprising results.

## Rationale

The current "widget mutates into node" pattern was an implementation
shortcut from the v1 era when widgets and nodes shared a single OOP
hierarchy. After D-widget-converge (W6.P3) and the ECS-alignment work
of D13, widgets and nodes are *components on entities*, not
inheritance-related objects. There is no shared base class to mutate
across; the "widget becomes node" pattern requires explicit
serialize-rehydrate-with-different-schema acrobatics that violate every
axiom in §Axioms cited.

The proposed semantics are *additive*: the new Command joins the
existing Command set, the shim handles legacy data, and no
extension-author API changes. Phase B implementation is straightforward
because the design work (Theorem 6 derivation, A4/A5 implications) is
already in axiom form — no fresh ADR discussion required.

## Alternatives considered

1. **Keep mutation, document as escape hatch** — Rejected. The pattern
   has surprising linked-instance behavior and brittle undo. Documenting
   surprise as "feature" is anti-A8 (extensibility) and anti-A11 (clean
   ECS semantics).

2. **Drop promotion entirely** — Rejected. The UX is widely used; users
   expect to promote widgets out of subgraphs.

3. **Promote via copy-paste** — Rejected. Copy-paste is a distinct
   Command (handled by D12-scope-clone-on-copy). Promotion is a
   *first-class* user action that deserves its own Command for clarity
   in command-log replay + collaborative-editing scenarios.

4. **Defer indefinitely** — Rejected per user direction (W19.A10
   approved as PROPOSED ADR in Slack feedback absorption pass,
   2026-05-21).

## Implementation Plan (Phase B, gated on W19.A9 ACCEPTED + #11939 merge)

1. Author `Command.PromoteWidget` schema in extension-api Command set.
2. Implement reducer in `src/lib/litegraph/` Topology layer.
3. Update right-click context menu handler to issue the new Command.
4. Author migration shim `scripts/migrations/widget-promote-shim.ts`
   for legacy workflows.
5. Behavior-triplet test coverage: promotion + undo + redo, linked
   instance projection, cloned vs. direct Reference variants.
6. Documentation: migration-v1-to-v2.md amendment + Command-Reference
   page on dashboard.
7. Shim sunset notice in changelog at Phase B GA + N+2.

Sunset of the legacy promotion code path is gated on (a) shim runtime
emitting zero `legacy-promotion-detected` telemetry events for 1 minor
version AND (b) extension ecosystem audit confirming no third-party
extension intercepts the legacy promotion event hook.

## Validation

- `pnpm test -- --grep promote-widget` covers reducer + shim.
- E2E: promote + undo + redo round-trip preserves Value identity.
- E2E: promotion in linked-blueprint context projects correctly.
- `scripts/check-axiom-compliance.sh` extends to strict-fail on any
  re-introduction of in-place widget mutation in promotion path.

## Cross-references

- `AXIOMS.md §A1 §A4 §A5 §A7 §A11` — premises
- `axioms-theorems.md` Theorem 6 — derivation
- `decisions/D-unify-widget-mount-model.md` (W19.A9) — composes-with
- `decisions/D-no-virtual-nodes-in-api.md` — sister "stop hiding behavior" direction
- `decisions/D-immutability-enforcement.md` — Value immutability premise
- `decisions/D14-widget-state-categories.md` — Schema/Props/Values taxonomy
- Slack thread 2026-05-21 — Christian's agreement quote
