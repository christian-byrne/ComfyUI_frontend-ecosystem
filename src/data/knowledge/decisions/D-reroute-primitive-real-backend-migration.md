# D-reroute-primitive-real-backend-migration — close the wave-13 N12 carve-out: built-in Reroute + Primitive migrate to real backend nodes

- **Status**: PROPOSED — 2026-05-21 (wave-19, W19.OP3). Flips to **ACCEPTED** when PR #11939 (Alex's ECS branch) merges AND Vue Nodes mode rolls out (W16.P3). Composability gate prevents single-step landings.
- **Decider:** Christian (user direction; Slack 2026-05-21 — see §Rationale)
- **Wave:** 19
- **Phase:** B
- **Axioms cited:** A1 (widget-centric — nodes never look down to widgets), A4 (ID strategy — extensions never see raw IDs), A5 (3-tier widget state — Schema immutable for lifetime; Values mutable through Postel's-law contract), A7 (canonical workflow model — WorkflowSpec is canonical; Prompt is derived, never authored directly), A15 (widget declarativity — every widget originates from a Python `INPUT_TYPES` declaration)
- **Composes-with:**
  - `decisions/D-no-virtual-nodes-in-api.md` (N12 closure — REJECTED extension-authored virtual nodes but carved out Reroute + Primitive as "temporary internal exception"; this ADR closes the carve-out)
  - `decisions/D-unify-widget-mount-model.md` (W19.A9 — Phase B unified-mount runtime makes the Primitive "lift a widget into a node" case trivially expressible as a normal `defineWidget` registration backed by a real node)
  - `decisions/D-widget-promotion-semantics.md` (W19.A10 — promotion produces a new Topology entity with a Reference to the source Value; Primitive's snapshot-on-instantiation pattern is the same shape: Topology-add + Value-copy)
- **Supersedes:** none (this is a NEW Phase B disposition; the wave-13 carve-out in `D-no-virtual-nodes-in-api.md` §Consequences "Internal Reroute + Primitive" explicitly noted "no migration deadline set in this ADR" — this ADR sets one)
- **Related:**
  - `axioms-theorems.md` Theorem 6 — *Value Promotion Impossibility* (Primitive's live back-reference shape is a Value-mutation pattern; Theorem 6 forces a Topology operation instead)
  - `decisions/D-immutability-enforcement.md` (Values are immutable references — Primitive's "edits propagate from source widget" pattern violates the contract; snapshot-on-instantiation restores it)
  - `decisions/D14-widget-state-categories.md` (Schema/Props/Values taxonomy — Primitive snapshot copies all three tiers at instantiation time)
  - `decisions/D-api-surface-finalization.md` §Re-opening criteria item 2 (Phase B ECS rebase = PR #11939 merge — Phase B trigger gate for this ADR)
  - `AXIOMS.md` §A1 §A4 §A5 §A7 §A15 — premises

## Context

`D-no-virtual-nodes-in-api.md` (wave-13, 2026-05-20) REJECTED
extension-authored virtual nodes with one explicit carve-out:

> "Reroute and Primitive remain as internal implementation details of
> the runtime (with eventual migration away from the 'virtual node'
> pattern) — they are *not* a reference for extension authors."

The ADR's §Consequences §Internal Reroute + Primitive section noted:

> "Stay functional for now; no migration deadline set in this ADR.
> Tracked as separate follow-up work — when migrated, the runtime no
> longer carries the virtual-node mechanism at all and this ADR's
> enforcement becomes hard (compile-time impossible to author a virtual
> node)."

That follow-up is this ADR.

Two built-in nodes today are implemented via the v1 virtual-node
mechanism (frontend-only nodes that rewrite themselves during workflow →
prompt conversion):

1. **Reroute** — a passthrough that "removes itself" from the
   ExecutionPrompt by redirecting its single input link to whatever the
   downstream consumers are connected from. The user sees one
   intermediate node on the canvas; the backend sees a direct
   connection.
2. **Primitive** — a "lift a widget into its own graph node" pattern.
   When the user right-clicks a widget and selects "Convert to input,"
   the widget collapses, a new Primitive node appears, and the
   Primitive's value live-links back to the original widget (the source
   widget's value follows the Primitive's value at every edit, and the
   Primitive serializes its value into the ExecutionPrompt slot where
   the source widget would have appeared).

Both patterns sit downstream of the wave-13 axiom set:

- Reroute is a workflow-time graph rewrite — it puts semantics in the
  serializer that aren't in the WorkflowSpec, violating A7.
- Primitive's live back-reference is a node→widget read (the Primitive
  node reads the source widget's value at prompt-build time and at
  every value change), violating A1 (NON-NEGOTIABLE). It also needs an
  abstract handle to the source widget across node boundaries, which
  A4 (extensions never see raw IDs) prevents the v2 surface from
  exposing.

The Vue Nodes mode rollout (W16.P3, Phase B) is the natural cut point:
new node UIs gate behind Vue Nodes; legacy LiteGraph-canvas UIs stay
unchanged until D6 Phase D sunset. That gives a clean two-version
transition window for each of Reroute + Primitive.

User direction 2026-05-21 (verbatim, Slack feedback absorption pass):

> "we shouldn't have any; deprecate old reroutes in Vue Nodes mode;
> primitives instantiated with copy of source state."

This ADR ratifies that direction as the Phase B disposition for the
two carve-out cases.

## Decision

**Both built-in virtual nodes migrate to real backend Python nodes. The
v2 frontend has no virtual-node concept at all once the migration
completes.**

### D-A: Reroute → real backend pass-through node

1. A new backend Python node `ComfyReroute` (final name TBD in the
   ComfyUI Python PR) ships as a no-op pass-through: one input, one
   output, identity function. The node is registered in the standard
   `INPUT_TYPES` / `OUTPUT_TYPES` table.
2. **Phase B (Vue Nodes mode ON)**:
   - The "Add reroute" canvas command instantiates the new backend node
     (not the virtual node).
   - Legacy virtual reroutes already present in a loaded workflow
     trigger a one-time runtime deprecation warning at load time:
     `[reroute] Virtual reroute deprecated; will auto-migrate at next
     save. See D-reroute-primitive-real-backend-migration.md.`
   - Frontend virtual-reroute rewriting in the workflow → prompt
     serializer remains functional for legacy workflows during this
     window.
3. **Phase B+1 (next minor version)**:
   - Workflow-load auto-rewrites legacy virtual reroutes to the new
     backend node in-place. The shim runs once per workflow load;
     subsequent saves persist the migrated form. Auto-migration emits
     a single telemetry event per workflow
     (`reroute-virtual-auto-migrated`) with the rewritten node count.
   - User-facing UX unchanged — a reroute node still looks like a
     reroute node; the only difference is the prompt payload now
     contains a real backend node entry instead of a "rewritten away"
     placeholder.
4. **Phase B+2 (second minor version after Phase B GA)**:
   - Virtual-reroute frontend support removed. The serializer no
     longer special-cases reroute nodes. Workflows still containing
     unmigrated virtual reroutes fail to load with a clear error
     pointing at the migration script and this ADR.
   - Telemetry-gated sunset: removal proceeds only when the
     `reroute-virtual-auto-migrated` event count drops below a
     threshold for one full minor version (matches the W16.P3 / D9
     Phase B sunset gate pattern).

### D-B: Primitive → snapshot-on-instantiation backed by real backend node

1. A new backend Python node family per primitive Value type (`PrimitiveInt`,
   `PrimitiveFloat`, `PrimitiveString`, `PrimitiveCombo`, `PrimitiveBool`,
   …; final naming TBD in the ComfyUI Python PR) ships. Each is a
   single-output node whose output is the constant Value declared in
   `INPUT_TYPES`.
2. **Snapshot semantics (the core behavioral change)**:
   - When the user "promotes" a source widget into a Primitive, the new
     Primitive node is instantiated with a **copy** of the source
     widget's Schema (per A5 immutability — Schema is duplicated, not
     shared) AND a copy of the source widget's current Value at that
     exact instant.
   - The back-reference between source widget and Primitive is
     **severed at instantiation**. Subsequent edits on either side
     are independent. The Primitive carries its own Value cell; the
     source widget carries its own Value cell.
   - This is the same shape as `D-widget-promotion-semantics.md`'s
     `Command.PromoteWidget` with the **cloned-Value variant** — the
     wave-19 promotion-semantics ADR already designed for this case;
     this ADR pins the Primitive flow to that variant by default.
3. **Phase B (Vue Nodes mode ON)**:
   - The "Convert to input" right-click action instantiates the new
     backend Primitive node with snapshotted Schema + Value.
   - Legacy live-link Primitives in loaded workflows trigger a one-time
     runtime deprecation warning: `[primitive] Live-link primitive
     deprecated; will snapshot at next save. See
     D-reroute-primitive-real-backend-migration.md.`
4. **Phase B+1**:
   - Workflow-load auto-rewrites legacy live-link Primitives:
     a. Resolve the back-reference one final time to read the source
        widget's current Value.
     b. Materialize a new backend-Primitive entry in the prompt
        carrying that Value.
     c. Drop the back-reference link.
   - Subsequent saves persist the snapshotted form. Telemetry event
     `primitive-livelink-auto-migrated` emitted per workflow with the
     migrated count.
5. **Phase B+2**:
   - Live-back-reference Primitive support removed. The serializer
     no longer special-cases Primitive read-from-source-widget. Same
     telemetry-gated sunset rule as D-A.

### Sequence summary

```
Phase B (PR #11939 merge + Vue Nodes mode rollout, W16.P3):
  - New backend Reroute + Primitive(*) nodes ship in ComfyUI Python repo.
  - Frontend: new instantiation paths use the backend nodes.
  - Frontend: legacy virtual instances still load + emit deprecation warning.

Phase B+1 (next minor):
  - Workflow-load auto-migration runs on legacy instances.
  - Telemetry tracks remaining live legacy population.

Phase B+2 (one minor after Phase B GA, telemetry-gated):
  - Virtual-reroute + live-link-primitive frontend support REMOVED.
  - Wave-13 D-no-virtual-nodes-in-api carve-out CLOSED.
  - Runtime no longer carries the virtual-node mechanism.
  - scripts/check-axiom-compliance.sh adds strict-fail rules forbidding
    re-introduction.
```

## Rationale

### A1 (widget-centric, NON-NEGOTIABLE) — Primitive's live back-reference is a node→widget reach

Primitive's current implementation has the Primitive node read the
source widget's Value at prompt-build time (and at every value-change
event in between). That is structurally a node "looking down" to a
widget on a different node — exactly the bilateral-A1-closure pattern
`D-no-node-widget-access.md` (wave-8) forbade.

Snapshot-on-instantiation removes the back-reference entirely: the
Primitive has its own Value cell from the moment it exists. There is
no node→widget read at any point in the lifecycle.

### A4 (no abstract-ID handles to other nodes' widgets)

A live link between source widget and Primitive requires the v2 API to
expose some kind of cross-node widget reference. A4 forbids that —
extension authors should never need raw IDs, and the abstract handles
the v2 surface offers (`WidgetHandle`, `NodeHandle`) deliberately don't
cross node boundaries the way Primitive would need.

Snapshotting at instantiation means the only cross-entity work happens
inside the Command reducer (which IS allowed to touch raw IDs because
it's framework code, not extension code) and produces a clean copy
that no longer needs a cross-node reference at all.

### A5 (3-tier widget state — Schema immutable, Values copied not shared)

The Primitive's Schema is independent from the source widget's Schema
once instantiated (snapshot copies the Schema declaration). The
Primitive's Values are independent of the source widget's Values
(snapshot copies the Value, severs the link). This is exactly the
canonical three-tier story.

The legacy live-link implementation, by contrast, conflates two
widgets' Value cells into a single shared mutation target — which is
the "Values are immutable references" failure pattern
`D-immutability-enforcement.md` was written to prevent.

### A7 (canonical WorkflowSpec — Prompt is derived, never authored)

A virtual Reroute violates A7 because the serializer must know to
*rewrite the graph* during workflow → prompt conversion. The rewrite
puts semantics in the serializer that aren't in the WorkflowSpec —
"some semantics live in the resolver, not the spec," exactly the
failure mode `D-no-virtual-nodes-in-api.md` cited as the primary A7
violation class.

A real backend Reroute restores A7 cleanly: the WorkflowSpec contains
the reroute node, the Prompt contains the reroute node, both ship the
exact same graph topology, and the round-trip invariant holds.

### A15 (widget declarativity — every widget from Python schema)

The new backend Primitive nodes' Values appear in the workflow exactly
the same way every other widget's Value does — as a slot declared in
`INPUT_TYPES`. There is no longer any "frontend-only widget that
materializes into a prompt slot via resolver code" path.

This closes the last open contradiction in the wave-9 A15 codification
(D-widget-serialization-simplification) where Primitive was the one
in-tree case of a widget Value flowing to the backend through a
non-declared path.

### Christian's Slack framing (2026-05-21)

Reproduced verbatim:

> "we shouldn't have any; deprecate old reroutes in Vue Nodes mode;
> primitives instantiated with copy of source state."

Three commitments in one sentence:
- "we shouldn't have any" → close the wave-13 carve-out.
- "deprecate old reroutes in Vue Nodes mode" → Phase B trigger is the
  Vue Nodes rollout (W16.P3), not the bare #11939 merge.
- "primitives instantiated with copy of source state" → snapshot
  semantics, not live link.

The implementation plan below operationalizes each commitment with
the standard two-minor-version transition window the codebase already
uses for similar deprecations.

## Consequences

### Phase A

- **Zero Phase A surface change.** This is an ADR-only change in
  workspace `decisions/`. Foundation worktree stays FROZEN at
  `24d893d401`. The Phase A surface freeze invariant is preserved.

### Phase B (gated on PR #11939 merge + Vue Nodes mode rollout)

- New backend nodes ship in the ComfyUI Python repo (separate PR;
  outside this workspace's scope).
- Frontend wires the new instantiation paths.
- Legacy virtual-node code paths remain functional but emit
  deprecation warnings at load.

### Phase B+1 (next minor after Phase B GA)

- Auto-migration runs on workflow load.
- Telemetry collects remaining live legacy population.

### Phase B+2 (telemetry-gated sunset)

- Virtual-reroute + live-link-primitive frontend support removed.
- `scripts/check-axiom-compliance.sh` adds strict-fail rules:
  - No `isVirtualNode` reference in `src/lib/litegraph/` or
    `src/extensions/core/` reroute / primitive paths.
  - No `getInputLink` override in any in-tree node definition.
  - No "frontend resolves to different prompt shape" pattern anywhere
    in the runtime.
- `D-no-virtual-nodes-in-api.md` "Restoration criteria" raised from
  "deliberately high" to "compile-time impossible to author" — the
  virtual-node mechanism is gone from the codebase entirely.

### Extension authors

- Authors who currently ship custom virtual nodes (the ~40 v1
  extensions catalogued in `research/touch-points/database.yaml` under
  S6.A1 / SG patterns) must migrate to real backend Python nodes
  before Phase B+2 sunset.
- The migration guide (`migration-v1-to-v2.md` §"Virtual nodes",
  already drafted per `D-no-virtual-nodes-in-api.md` §Validation) gets
  a new subsection citing this ADR and the Phase B+2 sunset date.
- User-facing UX of built-in reroute + primitive unchanged across all
  three phases — the migration is invisible to end users.

### Backward compatibility (D6 parallel-paths)

- v1 path remains fully functional through the D6 parallel-paths
  window. Vendor extensions that monkey-patch the v1 virtual-node
  hooks continue to work on v1.
- v2 path adopts the new disposition at Phase B; nothing changes for
  v2-author-visible APIs (no `addVirtualNode`, no `registerReroute`,
  no `registerPrimitive` exposed — same A2 minimalism as the rest of
  the v2 surface).

### Test surface

- Behavior-triplet tests for the new backend Reroute + Primitive nodes
  added per W16.P0 test contract.
- Existing v1 tests asserting on virtual-node behavior convert to
  `axiomExcluded({...})` per AGENTS.md Rule 11 with:
  - `axiom: "A1"` (Primitive cases) or `"A7"` (Reroute cases)
  - `adr: "decisions/D-reroute-primitive-real-backend-migration.md"`
  - `rationale: "Built-in reroute/primitive migrate to real backend
    nodes; virtual-node mechanism retired."`
  - `migration: "Use the real backend Reroute / Primitive(*) node
    families; auto-migration shim handles legacy workflows."`

### CI

- No new axiom check required at Phase B (transition window still
  active).
- At Phase B+2: axiom-compliance gets the two strict-fail rules
  enumerated above. Re-introduction of any virtual-node pattern fails
  CI.

## Restoration criteria

The Reroute or Primitive virtual-node implementation may re-enter the
runtime only if **all** of the following hold:

1. An ACCEPTED axiom amendment is proposed that addresses the A7
   (canonical WorkflowSpec) violation class — same bar as
   `D-no-virtual-nodes-in-api.md` §Restoration criteria.
2. A validated use case is documented that fundamentally cannot be
   served by a real backend node (true frontend-only computation with
   no prompt representation — which, per `D-no-virtual-nodes-in-api.md`,
   is itself disallowed under the current axiom set).
3. The 5 failure modes enumerated in `D-no-virtual-nodes-in-api.md`
   §Rationale are addressed in the restoration ADR.

Bar set deliberately high — virtual nodes are an A1+A7 violation
class, not a missing-feature class. The wave-13 carve-out was a
pragmatic concession to "we already shipped these two"; this ADR's
sunset is the loop-close.

## Implementation Plan (Phase B — gated on PR #11939 merge AND Vue Nodes mode rollout W16.P3)

| Step | Action | File / location | Verification |
|------|--------|-----------------|--------------|
| 1 | Flip this ADR status header to `ACCEPTED — <date> (wave-N)` when the Phase B trigger fires (PR #11939 merge + W16.P3 Vue Nodes rollout). | `decisions/D-reroute-primitive-real-backend-migration.md` | grep `Status.*ACCEPTED` |
| 2 | Author the ComfyUI Python PR for new backend nodes — `ComfyReroute` + `Primitive*` family (Int/Float/String/Combo/Bool/...). | `ComfyUI` (separate repo) | Python PR merged |
| 3 | Frontend wiring — "Add reroute" canvas command instantiates new backend node; "Convert to input" right-click instantiates snapshot-Primitive. | `ComfyUI_frontend/src/lib/litegraph/` + `src/extensions/core/` | per-command e2e demonstrating new node type in saved workflow |
| 4 | Deprecation warnings — load-time warning emitted once per workflow on legacy virtual reroute / live-link primitive. | `src/extensions/core/reroute.ts` + `src/extensions/core/primitive.ts` (or equivalents) | console + telemetry event present in browser e2e |
| 5 | Auto-migration shim (Phase B+1) — workflow-load rewrites legacy virtual instances to backend-node form; emit `*-auto-migrated` telemetry. | `src/lib/migrations/` (new directory if absent) | unit tests on shim + e2e load-save round-trip preserving migrated form |
| 6 | Sunset (Phase B+2) — remove virtual-node code paths; add axiom-compliance strict-fail rules. | `src/lib/litegraph/` + `scripts/check-axiom-compliance.sh` | `bash scripts/check-axiom-compliance.sh` exits 1 on synthetic regression; exits 0 on clean tree |
| 7 | BC test conversion — v1 tests asserting on virtual-reroute / live-link-primitive behavior convert to `axiomExcluded({...})` per AGENTS.md Rule 11. | `src/extension-api-v2/__tests__/**` | vitest run shows `test.fails` markers + `task.meta.annotations` present |
| 8 | Migration guide subsection — `migration-v1-to-v2.md` §"Virtual nodes" gets a "Built-in Reroute + Primitive" subsection citing this ADR + Phase B+2 sunset. | `ComfyUI_frontend/docs/extensions/migration-v1-to-v2.md` | grep `D-reroute-primitive-real-backend-migration` |
| 9 | AGENTS.md `§Reconciliation history` — append Phase B row capturing the trigger fire + cascade SHAs. | `AGENTS.md` | row present |
| 10 | Dashboard refresh — `bash scripts/refresh-api-docs.sh`; verify Reroute/Primitive MDX (if generated) cites this ADR. | dashboard repo | `pnpm test` clean; TypeDoc 0 errors |
| 11 | `bash scripts/sync.sh` clean (drift = 0, no orphan decisions, axiom + decision-propagation checks pass). | workspace | sync exits 0 |

## Validation

### Phase B (post-trigger)

- New backend Reroute + Primitive nodes available in node registry.
- Frontend "Add reroute" + "Convert to input" commands use new nodes.
- Legacy workflows still load + emit deprecation warning.

### Phase B+1

- Workflow load auto-rewrites legacy instances; telemetry events
  emitted; saved form is the new shape.
- Existing user-facing UX (right-click menus, canvas appearance,
  prompt payload behavior) unchanged from the user's perspective.

### Phase B+2 (sunset)

- `scripts/check-axiom-compliance.sh` strict-fails on any
  `isVirtualNode` reference in `src/lib/litegraph/` or
  `src/extensions/core/`.
- `scripts/check-axiom-compliance.sh` strict-fails on any
  `getInputLink` override in in-tree node definitions.
- Workflow → prompt serializer is a pure structural mapping with no
  virtual-node special cases.
- `D-no-virtual-nodes-in-api.md` carve-out CLOSED — that ADR's
  §Internal Reroute + Primitive section gets a forward-pointer to
  this ADR's Phase B+2 completion entry in AGENTS.md `§Reconciliation
  history`.

## References

- `decisions/D-no-virtual-nodes-in-api.md` — wave-13 N12 closure; carve-out this ADR closes
- `decisions/D-unify-widget-mount-model.md` (W19.A9) — Phase B unified-mount runtime
- `decisions/D-widget-promotion-semantics.md` (W19.A10) — `Command.PromoteWidget` cloned-Value variant = Primitive snapshot pattern
- `decisions/D-immutability-enforcement.md` — Values are immutable references; live-link Primitive violates the contract
- `decisions/D14-widget-state-categories.md` — Schema/Props/Values taxonomy
- `decisions/D-api-surface-finalization.md` §Re-opening criteria — Phase B trigger gate
- `AXIOMS.md` §A1 §A4 §A5 §A7 §A15
- `axioms-theorems.md` Theorem 6 — Value Promotion Impossibility
- `research/touch-points/database.yaml` S6.A1 / SG patterns — extension authors with custom virtual nodes (migration audience)
- Slack 2026-05-21 — Christian's "we shouldn't have any" direction
- PR #11939 (Alex's ECS branch) — Phase B trigger (component 1)
- W16.P3 Vue Nodes rollout — Phase B trigger (component 2)
