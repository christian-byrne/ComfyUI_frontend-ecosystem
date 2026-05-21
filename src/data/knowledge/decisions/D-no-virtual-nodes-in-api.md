# D-no-virtual-nodes-in-api — N12 closure: virtual nodes are not a v2 API concept

**Status**: ACCEPTED — 2026-05-20 (wave-13, user direction)
**Closes**: `D-uwf-drafting-board.md` §N12

## Context

`D-uwf-drafting-board.md` §N12 asked how virtual nodes (nodes that
exist in the editor graph but do not correspond to a backend Python
node — i.e. they get rewritten away during workflow → prompt
conversion) should declare their wiring. Three options were sketched:

- **Option A** — Declarative `virtualWiring` in node-type registration
- **Option B** — Synchronous resolver function
- **Option C** — Hybrid (declarative with function fallback)

Virtual node examples that triggered the question:
- The built-in **Reroute** node (passes value through a single slot
  with no backend execution)
- The built-in **Primitive** node (lifts a widget value into a
  reusable graph node)
- Hypothetical extension-authored "math expression" nodes that
  resolve client-side
- Hypothetical "conditional" / "branching" nodes that select between
  inputs at workflow build time

## Decision

**REJECTED — v2 API does not support extension-authored virtual
nodes. There is no `virtualWiring`, no client-side resolver, no
"runs in the frontend only" node category in the v2 surface.**

User direction 2026-05-20 (verbatim):

> "virtual nodes should not be allowed at all. exception being our
> reroute and primitive nodes internally but we want to migrate that
> eventually anyway. we shouldnt supporting or encouraging that in the
> API"

The decision is firm. Reroute and Primitive remain as internal
implementation details of the runtime (with eventual migration away
from the "virtual node" pattern) — they are *not* a reference for
extension authors.

## Rationale

Virtual nodes break the WorkflowSpec axiom (A7):

> "WorkflowSpec is canonical for semantics. Layout never affects
> execution. Prompt is derived, never authored directly."

A virtual node sits in the WorkflowSpec but resolves to a different
shape in the ExecutionPrompt — which means either:
- The WorkflowSpec is not canonical for semantics (some semantics
  live in the resolver, not the spec), violating A7.
- The Prompt is partly authored (by the resolver), violating A7.

Either way, the round-trip invariant breaks: replaying a
RunSnapshot may produce different output than the original run
if the resolver's behavior depended on frontend state.

Additional failure modes:

1. **Resolver order dependence** — when two extensions wrap the same
   node type with different virtual-wiring, who wins?
2. **Backend / frontend desync** — the prompt the backend sees is
   not the workflow the user saved; debugging is hard.
3. **Serialization ambiguity** — does the saved workflow store the
   virtual node or the resolved form? Either choice has problems
   (former: requires the extension to be present to replay; latter:
   loses the user's authored intent on round-trip).
4. **Type safety** — virtual nodes erase backend type guarantees;
   the frontend has to recreate / validate the resolved shape.
5. **Composition with subgraphs (A3)** — virtual-node resolvers
   running inside linked subgraphs (blueprints) compound all the
   above failure modes per-instance.

Reroute and Primitive avoid these failure modes only because they
are first-party, well-known, hand-coded into the runtime — not
because virtual nodes are a sound general pattern. Migrating those
two away from the virtual-node mechanism (separate work, not
scoped here) removes the last in-tree reference and frees the
v2 API surface to be unambiguous: **every node in the workflow
corresponds to a backend Python node**.

## Consequences

### Phase A
- Zero new surface. No `virtualWiring` field on `NodeExtensionOptions`
  / `defineNode` options. No `resolver` / `expand` / `materialize`
  callback in the public surface.
- `nodeTypes` in `defineNode` continues to filter by Python
  `comfyClass` strings — every value must correspond to a real
  Python node definition.
- The runtime keeps Reroute + Primitive handling internal (in
  `src/extensions/core/` v1 path); these are NOT v2 reference
  implementations.

### Migration
- v1 extensions using virtual-node patterns (e.g.
  `nodeType.prototype.serialize` returning a different shape) stay
  on the v1 path through the D6 parallel-paths window. Migration
  guide documents the v2 alternative as: "If you need client-side
  evaluation, declare a real backend node with the evaluation logic
  in Python; the frontend only sees real nodes."
- Extension authors who today ship virtual-node patterns are
  pointed at:
  - Real backend node + Python eval (preferred)
  - Boxed widget with embedded UI (per A15) for "lift one widget
    to its own card"
  - `defineNode({nodeCreated})` + author-managed store for
    cross-node observation (per D-cross-node-observation, N13)

### Internal Reroute + Primitive
- Stay functional for now; no migration deadline set in this ADR.
- Tracked as separate follow-up work — when migrated, the runtime
  no longer carries the virtual-node mechanism at all and this
  ADR's enforcement becomes hard (compile-time impossible to
  author a virtual node).

### CI
- No new axiom check required (the absence of the surface is the
  enforcement). If a future ADR proposes virtual-node support, it
  will need to address all 5 failure modes above.

## Restoration criteria

This decision re-opens only if:
1. A use case appears that fundamentally cannot be served by a
   real backend node (true frontend-only computation that has no
   prompt representation).
2. The 5 failure modes above are addressed in the new ADR
   (resolver ordering, backend/frontend sync, serialization
   semantics, type safety across the resolver, subgraph composition).
3. An axiom amendment to A7 is proposed and accepted to permit
   workflow-time graph rewriting.

Bar set deliberately high — virtual nodes are an A7 violation
class, not a missing-feature class.

## Validation

- No `virtualWiring` / `resolver` / `expand` / `materialize`
  field on `NodeExtensionOptions` in `src/extension-api/types.ts`.
- No `defineVirtualNode` / `registerVirtualNode` export from
  `src/extension-api/index.ts`.
- Migration guide section "Virtual nodes" documents the
  rejection with the 5-failure-mode rationale.
