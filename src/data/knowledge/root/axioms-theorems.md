# ECS + Vue Extension API — Derived Theorems

> Theorems that follow logically from the axioms in
> [AXIOMS.md](./AXIOMS.md). Each theorem cites its derivation chain (≥ 2
> axiom premises) and at least one ADR consequence.
>
> **Status**: Living document. Wave-19 W19.A4 (Agent-4, 2026-05-21).
> Derived from the Glary-Bot 8-theorem draft posted to Slack
> 2026-05-21 3:07 PM, re-anchored against the live A1..A16 axiom
> numbering.
>
> Theorems are **derived**, not axiomatic. Adding or modifying a
> theorem does not require an axiom change; *deleting* a theorem
> requires showing its derivation no longer holds (typically because
> a premise axiom was retired or restated).

---

## Theorem 1: Widget Identity Independence

**Premises**: A1 (Widget-Centric Philosophy — widgets must work anywhere
including app mode and partial graph views), A3 (Linked Subgraph
Constraint — same graph instance across clones).

**Statement**: Two `Widget` instances backed by the same `Value` must
function identically without any inter-instance coordination. A widget
cannot hold state whose correctness depends on it being the only live
instance for its `Value`.

**Derivation**: A1 requires widgets to survive promotion, app mode, and
linked-instance fan-out. A3 explicitly admits "same graph instance
across clones". The conjunction forbids any widget design that
implicitly assumes uniqueness — if two contexts can both render the
same `Value`, the widget code must run identically in both without
coordinating.

**Consequences**:

- [D-linked-subgraph-constraint](./decisions/D-linked-subgraph-constraint.md) — formalises the "same graph instance" rule that this theorem builds on.
- [D-widget-converge](./decisions/D-widget-converge.md) — single `Widget` shape with `mount()` closure capture is what makes per-instance independence achievable.

---

## Theorem 2: Schema Validation Boundary

**Premises**: A5 (Widget State Three-Tier Model — Schema is **immutable
for widget lifetime**), A1 (widget reflects its declared schema in any
context).

**Statement**: Schema validation occurs at the `Value`-assignment
boundary, never inside the widget lifecycle. A widget cannot coerce,
relax, or repair an invalid `Value`; it can only render the value its
schema admits.

**Derivation**: A5 makes Schema immutable, which means the widget
cannot rewrite its own constraints in response to bad input. A1
requires the same widget to behave identically wherever it appears, so
even per-instance coercion would diverge behaviour across contexts.
The only consistent place to reject invalid values is the assignment
boundary the runtime owns.

**Consequences**:

- [D-immutability-enforcement](./decisions/D-immutability-enforcement.md) — establishes the write-blocking discipline that makes this boundary enforceable.
- [D14-widget-state-categories](./decisions/D14-widget-state-categories.md) — separates Schema (immutable) from Props (mutable) from Value (user-facing), making the boundary explicit.

---

## Theorem 3: Topology-Value Separation

**Premises**: A7 (Canonical Workflow Model — WorkflowSpec is the
semantic source of truth; Layout never affects execution), A11 (ECS
Principles — Entities are IDs, Components are plain data, no
inheritance hierarchies).

**Statement**: Changing a widget's `Value` cannot directly modify node
relationships. Value mutation and topology mutation are disjoint
operations.

**Derivation**: A7 places node identity and connections in
WorkflowSpec, distinct from the data flowing through them. A11 stores
relationships as components on entities, decoupled from any specific
data payload. A `Value` mutation is therefore a component-write
addressing one entity; topology mutation requires re-keying
relationships. The two never collapse into a single primitive.

**Consequences**:

- [D-no-virtual-nodes-in-api](./decisions/D-no-virtual-nodes-in-api.md) — refuses to expose topology-changing surfaces through value-shaped APIs.
- [D14-widget-state-categories](./decisions/D14-widget-state-categories.md) — the three-tier model puts Values on a different axis from the connectivity graph.

---

## Theorem 4: Widget Recreation Safety

**Premises**: A1 (widgets must work anywhere — promotion, app mode,
partial views), A12 (Mount-Lifecycle as the Sole DOM Seam — mount
cleanup fires on widget destruction; host may be remounted), A7
(Canonical Workflow Model — WorkflowSpec is statically restorable).

**Statement**: Destroying a `Widget` and recreating it for the same
`Value` produces observationally identical behaviour. The dashboard
may freely tear down and re-instantiate widget instances to support
split views, subgraph projection, or `<KeepAlive>` shuffles.

**Derivation**: A12 explicitly carves `mount() → cleanup` as the only
DOM seam, with cleanup firing on destruction. A1 mandates that the
same widget survive being moved between contexts. A7 guarantees the
WorkflowSpec carries enough information to reconstruct any widget from
declared inputs. Together: tear-down then re-instantiate from spec is
always a valid operation.

**Consequences**:

- [D-widget-converge](./decisions/D-widget-converge.md) — the unified `Widget` shape with closure-captured element makes recreation a safe operation.
- [D-linked-subgraph-constraint](./decisions/D-linked-subgraph-constraint.md) — multiple live instances of the same widget rely on recreation being well-defined.

---

## Theorem 5: Reversibility Completeness

**Premises**: A6 (Command Pattern & Serialization — commands are
deterministic, idempotent, reversible via replay), A11 (ECS Principles
— state lives in components addressed by entity IDs).

**Statement**: Every user action that modifies the relationship graph
or component state produces a tracked, undoable command. Ad-hoc DOM
mutation, raw component writes, or any side-effecting code path that
bypasses the command bus is an architectural defect.

**Derivation**: A6 requires "explicit, auditable, reversible" state
transitions and an "auditable command log". A11 ensures all stateful
mutation reduces to component writes addressed by entity IDs. The
intersection: any code that writes a component but not through a
serializable command escapes the audit log and breaks the reversibility
contract.

**Consequences**:

- [D3.4-events-and-commands-reconciled](./decisions/D3.4-events-and-commands-reconciled.md) — separates one-shot events (no replay) from commands (replayable), nailing down what "reversible" means on each surface.
- [D-immutability-enforcement](./decisions/D-immutability-enforcement.md) — write-blocking handles route every legal mutation through the command bus.

---

## Theorem 6: Value Promotion Impossibility

**Premises**: A5 (Schema is immutable for widget lifetime), A11 (ECS
Principles — entities are IDs; relationships are components).

**Statement**: "Promoting" a widget (lifting it from a subgraph to the
parent graph, or from one node to another) cannot be expressed as
mutation of an existing `Value`. Promotion always creates new topology
entities; the original `Value` is preserved unchanged or destroyed
alongside its owning entity.

**Derivation**: A5 forbids changing a widget's Schema after creation,
and Schema is what binds a Value to its owning entity. A11 forbids
re-keying entity IDs in place — an entity is an ID, not a mutable
container. Therefore "promote this widget" cannot translate to "rewrite
the entity ID on this Value"; it must translate to "create new
entities, optionally copy the Value, optionally destroy the old".

**Consequences**:

- [D-no-virtual-nodes-in-api](./decisions/D-no-virtual-nodes-in-api.md) — promotion-style surfaces that pretend to move state in place would violate this theorem.
- [D-widget-promotion-semantics](./decisions/d-widget-promotion-semantics) *(planned — W19.A10, Agent-2 in parallel)* — codifies the create-and-destroy semantics this theorem mandates.

---

## Theorem 7: Multi-Instance Consistency

**Premises**: A3 (Linked Subgraph Constraint — same graph instance
across clones; events may fire in multiple contexts; serialization
must not assume single workflow), A6 (Command Pattern — deterministic
and idempotent), A11 (ECS Principles).

**Statement**: Multiple live instances of the same widget converge to
identical state without any inter-instance coordination protocol.
Apparent races between instances are architectural bugs, not runtime
hazards extensions need to defend against.

**Derivation**: A3 admits parallel live instances of the same logical
widget. A6 requires every mutation to be deterministic and idempotent.
A11 ensures the underlying state lives in components addressed by
entity ID, not in per-instance object references. The composition: any
mutation broadcast to all instances of a shared entity produces the
same end state regardless of arrival order — convergence is a property
of the command algebra, not the widget code.

**Consequences**:

- [D-linked-subgraph-constraint](./decisions/D-linked-subgraph-constraint.md) — explicitly the "instance-safe" design constraint this theorem formalises.
- [D3.4-events-and-commands-reconciled](./decisions/D3.4-events-and-commands-reconciled.md) — commands (replayable, idempotent) vs events (one-shot, fire-and-forget) makes the convergence guarantee precise.

---

## Theorem 8: Schema Evolution Prohibition

**Premises**: A5 (Schema immutable for widget lifetime), A15 (Widget
Declarativity — widgets originate from Python `INPUT_TYPES`; no
runtime widget addition; no frontend-only widgets).

**Statement**: A node type change that modifies its declared widget
schema requires *new node instances* (re-creation from the updated
type), not in-place upgrade of existing instances. The frontend
extension API exposes no surface for "patch this widget's schema".

**Derivation**: A5 makes Schema immutable for the widget's lifetime,
so a live widget cannot grow new fields or change a type. A15 says
the only legitimate Schema source is the Python `INPUT_TYPES`
declaration of the node class — there is no runtime path that could
re-derive a Schema for an already-instantiated widget. The only way
to adopt a new Schema is to instantiate a new node from the updated
class definition.

**Consequences**:

- [D-widget-serialization-simplification](./decisions/D-widget-serialization-simplification.md) — A15+A16 closure that retired the runtime-addWidget escape hatch; this theorem is the user-facing version of "no schema patching".
- [D-ban-runtime-addwidget](./decisions/D-ban-runtime-addwidget.md) — enforces the runtime-addition ban on the v1 surface, plugging the only remaining workaround.

---

## Cross-References

- [AXIOMS.md](./AXIOMS.md) — A1..A16 source of premises.
- [decisions/](./decisions/) — full ADR catalog cited in Consequences.
- Slack origin: 2026-05-21 3:07 PM Glary-Bot draft (re-anchored to
  current axiom numbering by W19.A4).
