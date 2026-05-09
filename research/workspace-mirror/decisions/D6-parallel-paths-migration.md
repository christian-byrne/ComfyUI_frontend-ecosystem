# ADR-D6: Parallel Paths Migration Strategy

**Status**: accepted (with revisions per 2026-05-08 user review — see "Resolutions" section)
**Date**: 2026-05-08
**Last revised**: 2026-05-08 (user review)
**Related cluster**: Reviewer Feedback Cluster A (F10, F12, F13)

## Context

Cluster A reviewer comments (F10, F12, F13) ask whether `getX()/setX()/isX()`
methods on handles should become accessor sugar (`get x()`, `set x()`,
`get x()` for booleans). D3.3 (Events Over Signals) deliberately chose method
form to:

1. Make mutation visibly side-effecting (you can't tell `node.position = p`
   dispatches a CRDT command, but you can tell `node.setPosition(p)` does).
2. Honor ADR 0003 (every mutation = serializable command) at the API
   ergonomics level.

Counter-argument from this session's review:

> if we ever want people to be able to easily migrate then the accessor
> approach to everything is something we will have to do right?

This is the core trade-off: **D3.3's "command honesty" principle vs. the
strangler-fig migration ergonomics that let v1 extensions become v2
extensions with minimal source change**.

This ADR also names and decides the broader question this cluster surfaced:
**how do v1 and v2 coexist during the transition period?** The reviewer
floated three possible separation seams:

1. Keep `app.registerExtension()` entry point, add new hooks alongside old.
2. Add a parallel `app.registerExtensionV2()` (or rename — see §"Naming") entry
   point with a fundamentally different `ComfyExtension` interface.
3. Some hybrid (single entry point, new shape detected by interface duck
   typing).

## Decision

### Part 1 — Coexistence model: parallel entry points, separate interfaces

**Revised on user review (2026-05-08).** Original proposal used
`app.extensions.define(...)` for the v2 entry point. User preferred the
**module-level `defineExtension`** import from the published
`@comfyorg/extension-api` package. Rationale: removes the dependency on
`window.app` being initialized at registration time (extensions can be
authored as pure modules, testable in isolation), matches modern TS
package convention (Vue's `defineComponent`, React's no-globals model).

```ts
// v1 (existing, deprecated but supported)
app.registerExtension({
  name: 'MyExt',
  nodeCreated(node) { /* ... */ },
  beforeRegisterNodeDef(nodeType, ...) { /* ... */ }
})

// v2 (new, recommended) — module-level, no window.app dependency
import { defineExtension } from '@comfyorg/extension-api'

export default defineExtension({
  name: 'MyExt',
  setup(ctx) {
    ctx.onNodeMounted((node) => { /* ... */ })
  }
})
```

The host loader (in `src/services/`) discovers `defineExtension`-produced
modules and registers them at app boot. Authors never call `app.foo()` at
registration time.

Two distinct entry points, two distinct interfaces, two distinct lifecycle
models. The v1 path stays exactly as it is, with deprecation warnings on the
specific hooks we've already deprecated (DEP1: `beforeRegisterNodeDef`, DEP2:
`useChainCallback`). The v2 path is the new shape and is the one we
document, type, and publish.

**Status: tentative.** If extension-author feedback during D6 Phase A
indicates this entry-point model is friction (e.g. authors strongly prefer
`app.registerExtension` muscle memory), reconsider via the alternatives in
"Future Pivots" below.

**Why two entry points instead of one shape-detected entry point?**
Shape detection (look at the keys on the object passed to `registerExtension`
and route to v1 or v2 internally) sounds clean but produces:

- Confusing docs ("you can pass either of these two unrelated objects to the
  same function")
- Type inference hell (the parameter is a discriminated union with 50+
  members, half of them deprecated)
- Silent miscategorization when an extension author mixes keys from both

Two entry points is two doc pages and zero type-inference ambiguity.

### Part 2 — Sunset cadence

| Phase    | What happens                                                       | Telemetry required? |
|----------|--------------------------------------------------------------------|---------------------|
| Phase A  | Both APIs ship. v2 marked stable. v1 unchanged. No warnings yet.  | no |
| Phase B  | v1 hooks emit deprecation warnings (per DEP1, DEP2). v2 docs only. | no |
| Phase C  | v1 entry point emits a single load-time deprecation warning.       | no |
| Phase D  | v1 removed. **Earliest: 12 months after Phase C AND <5% v1 usage AND telemetry exists to measure it.** | **yes — gating** |

**External timeline reference:** The ComfyUI frontend team's internal "Evolution of Frontend Build/Bundling" doc (`research/architecture/notion-build-bundling-and-api-surface.md`) describes an identical migration structure (dual mode → deprecation warnings → hard cutoff) and states **"18–24 month migration, extension author effort."** Treat 18 months post-Phase-C-launch as the practical lower bound for Phase D, not just 12. The 12-month gate is the earliest possible; ecosystem reality suggests 18–24.

**Threshold rationale (decided 2026-05-08):**

- 5% chosen as the default v1-usage cutoff for Phase D. Rationale: matches
  conventional "long tail" cutoffs in browser/runtime sunset decisions
  (Chrome use-counter deprecation thresholds, Node.js LTS removal).
- Phase D is **strictly gated by the existence of telemetry**. If we never
  ship telemetry, Phase D never happens; v1 lives forever. This is a
  feature, not a bug — CONTEXT.md notes "0 of our ICPs use ComfyUI
  without custom nodes" and breaking 1 in 20 ICPs without measurement
  would be reckless.
- Telemetry instrument suggested: `window.comfy.__extensionApiVersion`
  (or equivalent privacy-preserving counter) recorded at each
  registration. Telemetry implementation is out of scope for this ADR;
  tracked separately.
- Phases A → B → C can ship without telemetry. Only D blocks on it.

### Part 3 — Accessor/method ergonomics: hybrid rule (Option C)

**Revised on user review (2026-05-08).** Original proposal was "methods for
all mutable state, accessors for invariants only" (Option A). User
preferred a softer hybrid that drops verbose method form when there's no
hidden side effect (Option C).

**Final rule — three categories, not four:**

| Property kind                              | API form         | Examples                    |
|--------------------------------------------|------------------|-----------------------------|
| **Read-only invariant** (set at construction; never changes) | Accessor (`get`) | `node.id`, `node.type`, `node.comfyClass`, `widget.name`, `widget.widgetType` |
| **Property-shaped state** (no hidden side effect beyond the property itself) | Accessor pair (`get`/`set`) | `node.position` (getter + setter — assignment moves the node, but moving a node IS the side effect; nothing else fires), `node.size`, `node.title` |
| **Action-shaped state** (mutation has effects beyond the property — events fire, commands dispatch, undo entries created, validators run, async work begins) | Method (`setX`) | `widget.setValue(v)` (fires `valueChange`, dispatches command, hits undo stack), `widget.setOption('hidden', true)` |

Rationale:

- **Accessors** are the right shape when "set X" *is* "do X" with no hidden
  second effect. ADR 0003 (commands) is honored because the command IS the
  observable consequence — there's nothing being silenced.
- **Methods** are the right shape when mutation triggers other observable
  events. `widget.setValue(v)` firing `valueChange` events on subscribers is
  exactly the case where method form earns its keep — it tells the reader
  "calling this fans out."
- **Boolean predicates**: leave as methods (`isHidden()`, `isSelected()`)
  because consistency with action-shaped reads (`getValue()`) wins.

**This makes the current `extensionV2Service.ts` mostly correct as-is.**
The accessors already there for `node.id`, `node.type`, `widget.name`,
`widget.widgetType` are right. The `setPosition`/`setSize` methods become
accessor pairs. `setValue`, `setOption`, `setHidden` stay as methods. The
inconsistency from cluster A reviewer feedback resolves not by picking one
shape but by drawing a principled line between them.

**Status: tentative.** "Hybrid" decisions can drift over time as edge cases
appear. If the line between "property-shaped" and "action-shaped" turns out
to be unclear in practice, fall back to Option A (everything is a method)
per "Future Pivots" below.

### Naming

The "v2" suffix is a working tag, not a permanent identifier. Once Phase D
ships, the surviving API is just "the extension API" and the
`@comfyorg/extension-api` package is on its own semver track. File names
during the transition:

- `src/extension-api/` — the new public folder (no `v2` in path)
- `src/extension-api-v1-compat/` — the v1 path, named explicitly as
  legacy/compat layer
- Transitional `extensionV2.ts` and `extensionV2Service.ts` are renamed during
  the consolidation work in plan P2.

## Consequences

- ✅ Clean entry-point separation eliminates "is this a v1 or v2 extension?"
  ambiguity.
- ✅ Extension authors can ship a single repo with both v1 and v2 entry points
  during the transition (separate `registerExtension` and `extensions.define`
  calls).
- ✅ Type-checker sees two unrelated interfaces; no degenerate union type.
- ✅ Telemetry-gated sunset prevents premature breakage of long-tail extensions.
- ⚠️ Doubles the doc surface during transition (two API pages).
- ⚠️ Doubles the test surface — every interaction must be tested under both
  APIs until Phase D.
- ⚠️ Internal implementation has to bridge: v1 hooks need to fire in a way
  that doesn't break v2 expectations and vice versa. This is the single
  hardest bit — needs its own design doc (call it D6.1, deferred).

## Alternatives Considered

1. **Single entry point, shape detection.** Rejected — see Part 1 rationale.
2. **Single entry point, source-compatible drop-in.** Rejected — would force
   the v2 API to inherit every v1 misfeature including monkey-patchable
   prototypes (R4 P3, P4, P5).
3. **Big-bang migration (no parallel period).** Rejected — CONTEXT.md flags
   "0 of our ICPs use ComfyUI without custom nodes" and "if unstable with
   custom nodes, ComfyUI is unstable" (Jacob, meeting). Big-bang would
   break the product for 100% of ICPs the day it shipped.
4. **Accessor sugar everywhere (the reviewer-suggested win for migration
   ease).** Rejected — see Part 3 rationale. Migration is already
   non-source-compatible by design; accessor sugar buys nothing on top.

## Open Sub-Questions

- Q1 — D6.1: internal bridge architecture. How does the v2 ECS-backed
  implementation expose a v1-shaped surface for v1 extensions? Two World
  views? Adapter layer? Deferred to its own ADR.
- Q2 — Phase B trigger: which v1 hooks emit warnings on which call
  patterns? Some hooks (e.g. `setup`) are shape-compatible with v2's
  `setup(ctx)` and might never warn.
- Q3 — Telemetry implementation: privacy-preserving counter design.
  `window.comfy.__extensionApiVersion` ping at registration is one
  option; needs design before Phase D can be planned.
- **Q4 — App-level serialization hook (I-UWF.4.F2 analysis, 2026-05-08):**
  Does the v2 API need an app-level `beforePrompt` / `beforeWorkflowSave`
  event for cross-node transforms? Analysis and recommendation below.

### Q4 Analysis — App-level serialization hook (GAP-UWF-1)

**Background.** F1 survey (I-UWF.4.F1) confirmed three high-blast-radius
repos do genuine graph-wide cross-node transforms at `graphToPrompt` time
that cannot be expressed as per-node `node.on('beforeSerialize')`:

| Repo | Stars | Transform type | Per-node possible? |
|---|---|---|---|
| ComfyUI-Manager | ★14,554 | Filters disabled nodes, rewrites component node inputs | No — reads and mutates arbitrary nodes |
| ComfyUI-KJNodes Set/Get | ★2,568 | Resolves named values across the graph (virtual wiring) | No — must enumerate all Get nodes |
| cg-use-everywhere | ★1,243 | Auto-wires matching output→input pairs across the whole graph | No — graph-wide topology mutation |

All three are `uwf-resolved` per I-PG.B2 taxonomy — UWF Phase 3 save-time
materialization is their long-term migration path, not v2 extension API
alone. But UWF Phase 3 is 12–18 months out. During the transition, these
extensions need a v2-compatible replacement for the `graphToPrompt` patch.

**Options evaluated (four from todo.md, plus one derived):**

**(a) `defineExtension({ onBeforeWorkflowSave(spec) {...} })`**
App-level callback receives the full `WorkflowSpec` / prompt object.
- **Pro:** Clean, module-level, no `window.app` dependency at registration
  (aligns with D6 Part 1). Extension authors import from
  `@comfyorg/extension-api` and never touch `app`.
- **Pro:** Graph-wide mutations are natural here — spec is the whole graph.
- **Con:** `WorkflowSpec` is a large, evolving type. Passing the mutable
  spec object to extensions risks untyped mutations that UWF's schema cannot
  validate. Extensions that write invalid spec fields cause backend crashes
  with no early warning.
- **Con:** Harder to test in isolation — the harness must construct a full spec.

**(b) `app.on('beforePrompt', handler)` — event on a new app handle**
Event fires before submission; handler receives mutable prompt.
- **Pro:** Fits the D3.3 events-over-signals model.
- **Con:** Requires `app` to be accessible at event-subscription time.
  If the subscription happens at module load (before `window.app` is
  initialized), it breaks D6 Part 1's hard constraint.
  Can be resolved by routing through the `defineExtension` setup context
  (`ctx.on('beforePrompt', fn)`) — but that's Option (a) with event syntax.
- **Con:** Same schema-mutation risk as (a).

**(c) Extension declares virtual-node behavior at node-type registration time**
Instead of a global hook, each node type declares how its outputs resolve
into real spec edges via `defineNodeExtension({ resolveConnections(inputs) })`.
- **Pro:** No graph-level mutation — the runtime materializes edges
  deterministically without extension code running at queue time.
- **Pro:** Zero `window.app` dependency; fully module-level.
- **Pro:** Directly enables UWF Phase 3 save-time materialization — this is
  what the UWF plan actually requires.
- **Con:** Paradigm shift for extension authors. KJNodes Set/Get nodes would
  need to re-express their resolution logic as a per-type function — doable,
  but requires guidance.
- **Con:** cg-use-everywhere's auto-wiring is topology-driven (matches types
  across the whole graph), not per-node. Node-type declaration cannot express
  this pattern.

**(d) Out of scope for v2 Phase A; park behind UWF Phase 3 timeline**
Don't add an app-level hook now. Extensions that need it keep patching
`graphToPrompt` (v1). Migration path is UWF Phase 3, not v2 API.
- **Pro:** Zero additional API surface in Phase A. Reduces scope risk.
- **Con:** Phase A still tells extension authors to migrate to v2, but
  gives them no replacement for their most-used pattern (S6.A1 is #1
  blast-radius). Documentation becomes "use v2, except for the thing you
  most commonly use v1 for."
- **Con:** Leaves the three highest-blast-radius repos on v1 indefinitely.

**Recommendation: Option (a) scoped to `defineExtension` setup context,
deferred to Phase B, with Option (c) as the UWF Phase 3 endgame.**

Concretely:

```ts
// Phase B addition — after ECS World lands:
import { defineExtension } from '@comfyorg/extension-api'

export default defineExtension({
  name: 'my-ext',
  setup(ctx) {
    // Fires before the workflow spec is submitted to the backend.
    // `spec` is a readonly view; mutations go through typed mutator methods.
    ctx.on('beforePrompt', (event) => {
      const nodes = event.spec.nodes.filter(n => n.type === 'MyGet')
      for (const node of nodes) {
        event.resolveVirtualInput(node.id, 'value', computedValue)
      }
    })
  }
})
```

Key constraints on the shape:
1. **`ctx.on(...)` not `app.on(...)`** — subscription happens inside
   `setup(ctx)`, so `window.app` is never required at module load (D6 Part 1 ✓).
2. **Read-only `spec` + typed mutator methods** — prevents untyped object
   mutations that bypass UWF schema validation. `event.resolveVirtualInput`,
   `event.excludeNode`, `event.setMetadata` are the only mutation surfaces.
   This is narrower than passing a mutable spec object.
3. **Fires after all `node.on('beforeSerialize')` handlers** — ordering is
   per-node first, graph-level second. Matches the mental model (per-node
   transforms compose into the graph-level result).
4. **Phase B, not Phase A** — adding `ctx.on('beforePrompt')` to the
   `defineExtension` options bag is a non-breaking minor addition. Phase A
   ships without it; extensions that need it keep patching until Phase B.

**For cg-use-everywhere's topology-driven auto-wiring:** Option (c) is the
correct long-term answer (node-type declaration at registration time). This
is a separate decision tracked as I-UWF.5. The `ctx.on('beforePrompt')`
hook in option (a) serves as a transitional bridge until UWF Phase 3 and
I-UWF.5 land.

**Status: recommendation recorded, not yet formally accepted.** Requires
sign-off from Jacob/Alex before being added to the extension API surface.
Track as a Phase B deliverable — add to Phase B task list when I-PG.B1
planning begins.

- **Q5 — Virtual node registration API (I-UWF.5 analysis, 2026-05-08):**
  Does the v2 API need first-class "virtual node" declaration so UWF Phase 3
  can materialize edges without relying on `graphToPrompt` patching? Analysis
  and recommendation below.

### Q5 Analysis — Virtual node registration API (GAP-UWF-2)

**Background.** The KJNodes Set/Get pattern (S9.SG1, ★2,568) and similar
implementations (cg-use-everywhere auto-wiring, SpaceWarpStudio SetInput/GetOutput)
rely on `isVirtualNode = true` (S8.P1) plus a `graphToPrompt` patch that
rewrites `link.target_id` to resolve named virtual connections into real spec
edges. UWF Phase 3 requires the frontend to perform this resolution
deterministically at save time, without extension code running during queue
submission.

The `isVirtualNode = true` flag (S8.P1) currently signals to the canvas
to skip the node in `graphToPrompt`, but it carries no resolution logic —
the resolution is always in the extension's `graphToPrompt` patch. UWF
Phase 3 requires the runtime to know how to resolve virtual wiring without
that patch.

**Options evaluated (from todo.md):**

**(a) `defineNodeExtension({ virtual: true })` — layout-only flag**
Tells the runtime to exclude this node from `spec.edges` entirely.
- **Pro:** Simple — mirrors the existing `isVirtualNode = true` semantic
  in a typed, first-class way. No resolution logic needed.
- **Pro:** Directly replaces S8.P1 with a v2-idiomatic equivalent.
- **Con:** "Exclude from edges" is only half the story. The other half is
  how the virtual node's logical connections get materialized as real edges
  pointing to the actual source/target nodes. A `virtual: true` flag
  alone leaves UWF Phase 3 with no way to resolve the edge graph — it
  still needs extension code at queue time.
- **Con:** Does not cover cg-use-everywhere, where the "virtual node" is
  not a layout placeholder but a topology-inference engine operating on
  the whole graph.

**(b) `defineNodeExtension({ resolveConnections(inputs) → ResolvedEdges })` — per-type resolution function**
Extension provides a function that, given this node's inputs, returns the
set of real spec edges this node should collapse into.
- **Pro:** Sufficient for the KJNodes Set/Get pattern — the resolution
  function maps named Get inputs to their corresponding Set source.
  UWF Phase 3 can call it at save time without any `graphToPrompt` patch.
- **Pro:** Per-type, not per-instance — deterministic and cacheable.
  Runtime can call it for every virtual node during spec materialization.
- **Pro:** Extension logic stays in the registration call, not in a
  global hook. No `window.app` dependency (D6 Part 1 ✓).
- **Con:** Does not cover cg-use-everywhere's topology-driven auto-wiring.
  cg-use-everywhere scans the entire graph for type-matching pairs —
  that cannot be expressed as a per-node-type resolution function.
- **Con:** Paradigm shift for extension authors. KJNodes would need to
  re-express its Set/Get resolution as a typed function rather than
  `link.target_id` mutation.

**(c) UWF handles this internally by convention (reserved type prefixes); no extension API needed**
The UWF spec reserves node type prefixes (e.g. `Comfy.Virtual.*`) that
the frontend knows how to resolve natively — no extension hook required.
- **Pro:** Zero extension API surface. Extensions declare node types;
  UWF runtime resolves them.
- **Con:** Only works for node types the core UWF implementation knows
  about. Third-party virtual node patterns (KJNodes, SpaceWarpStudio)
  cannot be expressed this way — each implements its own resolution
  logic.
- **Con:** Pushes the resolution burden onto the core team for every
  new virtual node pattern that emerges in the ecosystem.

**Recommendation: Option (b) for the KJNodes/Set-Get class; Option (c) is not viable for third-party patterns; cg-use-everywhere requires `ctx.on('beforePrompt')` (Q4 recommendation) as a transitional bridge.**

Concretely:

```ts
// Phase B addition — virtual node type registration:
import { defineNodeExtension } from '@comfyorg/extension-api'

export default defineNodeExtension({
  name: 'KJNodes.SetGet',
  nodeTypes: ['SetNode', 'GetNode'],

  // Declares that these node types are layout-only.
  // UWF Phase 3 calls resolveConnections() at save time instead of
  // reading spec.edges for these nodes.
  virtual: true,
  resolveConnections(node, graph) {
    // node: read-only view of this virtual node's slots and properties
    // graph: read-only view of the full graph (find matching Set for each Get)
    // Returns: array of { from: NodeSlotRef, to: NodeSlotRef } real edges
    // that this virtual node logically represents.
    return resolveSetGetEdges(node, graph)
  }
})
```

Key constraints on the shape:
1. **`resolveConnections` is pure** — no side effects, no `link.target_id`
   mutation. Returns a value; the runtime materializes the edges.
2. **Read-only `graph` view** — same constraint as the Q4 recommendation;
   prevents extensions from mutating graph state during spec materialization.
3. **`virtual: true` required alongside `resolveConnections`** — the flag
   signals to the canvas that this node should not appear in `spec.edges`
   directly. Both must be present.
4. **Phase B, not Phase A** — same deferral as Q4. Phase A ships without
   virtual node registration; extensions that need it keep patching until
   Phase B.

**For cg-use-everywhere's topology-driven auto-wiring:** `resolveConnections`
per-type cannot express graph-wide type inference. The Q4 recommendation
(`ctx.on('beforePrompt', event => event.resolveVirtualInput(...))`) is the
correct bridge for this pattern until UWF Phase 3 provides a first-class
topology-declaration API. The two hooks are complementary: `resolveConnections`
handles per-type virtual resolution; `beforePrompt` handles graph-wide
topology transforms.

**Relationship to S8.P1 and S9.SG1:**
- S8.P1 (`isVirtualNode = true`) → replaced by `virtual: true` in
  `defineNodeExtension`. Migration: mechanical rename + add `resolveConnections`.
- S9.SG1 (full KJNodes Set/Get pattern) → resolved by `virtual: true` +
  `resolveConnections`. Classified `uwf-resolved` per I-PG.B2 taxonomy —
  UWF Phase 3 is the migration path, not ECS dispatch alone.

**Status: ACCEPTED (I-UWF.5, 2026-05-08).** Option (b) — `virtual: true` +
`resolveConnections(node, graph) → ResolvedEdges`. Phase B deliverable.
Requires Jacob/Alex sign-off before merging into extension API surface.
BC.28 test stubs updated to reflect this shape.

## Future Pivots

Decisions in this ADR are **tentative** in two specific places. If
post-Phase-A author feedback indicates problems, pivot per below:

### Entry-point shape (Part 1)

| Pivot | Shape | When to consider |
|---|---|---|
| **B.** Single entry point with shape detection | `app.registerExtension({...})` accepts both v1 and v2 shapes | If extension authors strongly resist learning a new entry-point name and adoption stalls. **Rejected for now** — discriminated-union type errors are bad UX. |
| **C.** `app.registerExtension` aliased to `defineExtension` | `app.registerExtension({ setup(ctx) {...} })` works for v2 too | Compromise — keeps muscle memory but uses new shape. Re-litigates the discriminated-union problem from B at the type level. |

### Accessor/method rule (Part 3)

| Pivot | Rule | When to consider |
|---|---|---|
| **A.** Methods for all state | `setPosition(p)`, `setTitle(t)`, `setValue(v)` everywhere | If the "property-shaped vs action-shaped" line proves unclear in practice and contributors keep asking which to use. Strict and consistent — no judgment calls. |
| **B.** Accessors for everything | `node.position = p`, `widget.value = v` | If author feedback indicates method form feels archaic / reduces adoption. Conflicts with ADR 0003 honesty about command dispatch — would need explicit doc note that "assignment dispatches a command." |

### Entry-point shape — import-path versioning (GH #4668 alternative, NOT adopted)

Branch `feat/import-based-api-versioning` (SHA 97547434b, GH issue #4668) implements a
concrete alternative: extensions declare their API version at import time via internal
path aliases (`import { app } from '@/scripts/app/v1_2'`), and `extensionService.ts`
fans out hook dispatch to version-grouped extensions with `VersionProxies` arg
transformation.

**Not adopted.** Fails our two hard constraints:
1. Still `app.registerExtension(...)` at the call site — window.app dependency at
   registration time (user-stated constraint, D6 Part 1).
2. Import paths are internal Vite aliases — not consumable by external custom node
   authors without vendoring frontend source. Our `@comfyorg/extension-api` npm
   package (PKG2–PKG6) is required for the external-author case.

**Extractable component:** The `VersionProxies` canonical↔v1 bidirectional Proxy
transform *is* what our D9 Phase C strangler (I-PG.C1) needs. Study
`VersionProxies.createV1Proxy` + `transformCanonicalToV1Property` when I-PG.C1 lands.

**Extractable telemetry:** `getExtensionVersionReport()` (groups by `ext.apiVersion`)
is the signal D6 Phase D gates on. Add `apiVersion?: string` to `ExtensionOptions`
for parity (task I-EXT.3).

Artifact: `research/issues/issue-4668-import-based-api-versioning.md`.

## Cross-References

- D3.3 (events over signals — establishes "command honesty" principle)
- D3.4 (events and commands reconciled — domain handles ARE commands)
- ADR 0003 (CRDT/command pattern)
- CONTEXT.md "0 of our ICPs use ComfyUI without custom nodes" (meeting consensus)
- DEP1, DEP2 (deprecation runtime warnings already done)
- P2-extension-api-package.md (this ADR informs the package folder structure)
- GH issue #4668 + branch `feat/import-based-api-versioning` (rejected alternative, see Future Pivots above)
