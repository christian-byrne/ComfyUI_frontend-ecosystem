# D9 — Strangler Fig Phases for v2 Extension API Rollout

**Status:** Accepted (planning) 2026-05-08
**Origin:** Standup 2026-05-08; user-driven sequencing decision
**Related:** D6 (parallel paths migration), I-PG.A/B/C tasks in `todo.md`, P1, P2

## Context

The v2 extension API is rolling out across multiple branches and over multiple weeks/months. The "strangler fig" pattern is not a single design — it has **three distinct shapes** depending on which phase of the rollout the work is happening in.

The naive framing ("build a strangler fig that intercepts prototype patches") was correct for Phase C only and obscured what Phase A and Phase B actually look like. This ADR records the three-phase shape so future work doesn't conflate them.

## Decision: Three phases

```diagram
Phase A (this week, pre-Alex)         Phase B (post-rebase)        Phase C (much later)
╭──────────────────────────────╮      ╭────────────────────────╮   ╭──────────────────────╮
│ extension-v2-api-proposal    │      │ rebased on Alex's ECS  │   │ legacy-api strangler │
│ (HEAD: API surface only)     │ ───▶ │ branch; strangler now  │──▶│ over v1 hooks we     │
│                              │      │ dispatches to ECS      │   │ never rewrote        │
│ Goal: Simon + Austin can     │      │ commands; bridges      │   │ ("parallel path"     │
│ start converting core exts   │      │ legacy where needed    │   │ migration per D6)    │
│ against stable v2 surface    │      │                        │   │                      │
╰──────────────────────────────╯      ╰────────────────────────╯   ╰──────────────────────╯
```

### Phase A — Surface-only shim (this week, pre-Alex rebase)

**What ships:**
- Public `defineExtension`, `defineNodeExtension`, `NodeHandle`, `WidgetHandle`, event system from P1
- Internal handle methods are **thin pass-throughs** to existing system (LGraphNode prototypes, current widget classes)
- No new internal architecture; no ECS dispatch
- No interception or blocking of prototype patching — extensions can still patch as before
- v2 surface coexists alongside legacy ComfyExtension hooks

**Goal:**
Give Simon + Austin (and future community contributors) a stable v2 interface to build/convert against, before the engine underneath changes shape. The cost of converting an extension to v2 is bounded by the public surface, not by the internal churn happening on Alex's branch.

**Why this matters:**
If we don't lock the public surface first, every internal change forces every conversion to redo. The public surface is the contract; the strangler fig at this phase is just "make the contract callable."

**What is NOT a strangler-fig concern in Phase A:**
- Prototype-patching guards (these are Phase C)
- ECS World dispatching (this is Phase B)
- Compat warnings / deprecation logging (these are Phase B+C)

### Phase B — Closer-to-real strangler (post-Alex rebase, ~next week)

**Trigger:** Rebase `extension-v2-api-proposal` onto Alex's ECS branch (PR [#11939](https://github.com/Comfy-Org/ComfyUI_frontend/pull/11939) stacked on PR [#11811](https://github.com/Comfy-Org/ComfyUI_frontend/pull/11811)).

**What changes:**
- Internal handle methods stop being thin shims and start dispatching to ECS commands (`dispatch(SetWidgetValue, ...)`, etc.) and reading from the World (`world.getComponent(entityId, WidgetValue)`).
- For surfaces Alex's branch already migrates (e.g. widget value via `widgetValueStore` facade), v2 handles read/write through ECS-native paths.
- For surfaces Alex hasn't moved yet, v2 handles still bridge into legacy (LGraphNode prototypes, old stores) — these are explicitly tagged `strangler-bridge` so we know what's left to migrate.
- Per-pattern classification: `ECS-native` | `strangler-bridge` | `unchanged-legacy` | `uwf-resolved`. Tracked alongside R7 touch-point database.
  - `uwf-resolved` = migration path is UWF Phase 3 save-time materialization, not ECS dispatch or a strangler bridge. Known: **S6.A1** (graphToPrompt patching) and **S9.SG1** (virtual-node wiring). These patterns must NOT be marked `strangler-bridge` or `ECS-native` — they block on UWF Phase 3, not on Alex's ECS work. See `research/architecture/notion-uwf-frontend-impl-plan.md` §S6.A1/I-PG.B2.

**Still "slightly strangler":**
Not every code path goes through ECS; legacy paths exist for hooks Alex hasn't moved. The strangler is real but partial.

**What is NOT a Phase B concern:**
- Prototype-patching interception. v1 ComfyExtension hooks still receive raw LGraphNode references; extensions can still patch. The Phase B strangler is between v2 handles and the engine, not between extensions and the engine.

### Phase C — Legacy-API strangler (much later)

**Trigger:** v2 API stable; majority of `src/extensions/core/*` migrated; ecosystem migration guide published; deprecation telemetry shows < 5% of core users still on v1 (per D6 sunset criteria).

**What ships:**
- Strangler over v1 ComfyExtension hooks we explicitly chose NOT to rewrite (per D6 "parallel paths" decision — some legacy hooks are kept indefinitely as compat bridges).
- Choose interception mechanism (deferred until Phase C — see I-PG.C2):
  - **(a)** `Object.freeze(LGraphNode.prototype)` + Proxy façade
  - **(b)** `Object.defineProperty` getter trap that warns + redirects to v2
  - **(c)** Preserve patching, but record into a per-extension shadow that the v2 dispatcher consults
- Each blocked/translated patch attempt logs structured deprecation event with stack frame + recommended v2 replacement (sourced from P3 migration guide).
- Eventual Phase D (per D6): v1 hooks become read-only shims that emit hard errors.

**Why deferred to Phase C:**
- Choosing the interception mechanism before we know which legacy hooks survive D6's sunset is premature.
- We need real telemetry on which v1 surfaces are still in use to know what's worth strangling vs what we can just delete.
- The mechanism choice depends on whether ECS dispatch is fast enough to absorb translated calls — that's only knowable after Phase B.

## Consequences

### Positive

- Each phase has a clear success criterion and a clear "what does internal point at" answer. No accidental conflation.
- Phase A unblocks Simon + Austin without waiting for Alex's branch to land.
- Test framework (I-TF) can validate each phase independently: Phase A tests v1 contracts unchanged + v2 surface callable; Phase B tests ECS-native dispatch matches legacy semantics; Phase C tests interception/translation/warnings.
- Decision on interception mechanism is deferred until we have evidence to make it well.

### Negative

- More moving parts; risk that Phase B rebase reveals incompatibilities forcing Phase A surface changes (mitigated by I-COORD.1 converting representative core extensions early).
- Longer total timeline than "build the full strangler once" — but lower regression risk and better collaboration shape.

### Risks

- **Alex's branch may pivot.** From Slack: "It might be worth just keeping the tests from #11811 and solving the issue differently in the ECS." The exact set of ECS-native surfaces in Phase B may change before rebase.
- **Phase A's pass-through internals may leak prototype-patching ergonomics into the v2 surface design.** Mitigation: I-COORD.1 — convert real core extensions in Phase A and use them to stress-test the v2 ergonomics before Phase B locks them in.

## Open questions

- I-COORD.2 — What's the exact rebase target? Alex's PR #11939 is `Draft for review`; should we wait for it to be ready, or rebase onto its current state and chase it?
- D11 (deferred per Phase C deferral) — Which interception mechanism (a/b/c)? Decide after Phase B telemetry.
- D10 (a/b/c/d) — Lifecycle context, hook ordering, async setup, setupState wrap. Open; tracked as TODOs.

## References

- `todo.md` §I-PG.A/B/C — task breakdowns
- `decisions/D6-parallel-paths-migration.md` — the parallel-paths sunset strategy that Phase C strangles
- `plans/P1-comfy-extension-v2-api.md` — the v2 surface that Phase A wires up
- `plans/P2-extension-api-package.md` — the npm package plan
- Alex's PRs: [#11811](https://github.com/Comfy-Org/ComfyUI_frontend/pull/11811) (subgraph widget promotion), [#11939](https://github.com/Comfy-Org/ComfyUI_frontend/pull/11939) (ECS substrate slice 1, stacked on #11811)
