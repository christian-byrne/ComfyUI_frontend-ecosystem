# <a href="/decisions/D-api-surface-finalization" class="wiki-link">D-api-surface-finalization</a> — Phase A surface freeze; open-decision closure

**Status**: ACCEPTED — 2026-05-20 (wave-12 — user direction "finalize the
API surface, answer all open questions, make all open decisions firm
and decided and logged")

## Context

User direction 2026-05-20 (handoff-15):

> "all core internal widget/extension migrations we will defer to the
> next milestone. for now just focusing on finalizing the api surface,
> answering all open questions, making all open decisions firm and
> decided and logged and then shipping/deploying/propagating/syncing"

A repo-wide audit of `decisions/` and `design-review-12142.md` against
the live `src/extension-api/*.ts` surface (post wave-11 hygiene
cleanup, foundation `ee0537fdb5`) found:

- **Zero `TODO` / `FIXME` / `XXX` / `TBD` markers** in
  `src/extension-api/`. The surface is structurally final.
- **Every row in `design-review-12142.md` §Decisions** has been
  closed across the three propagation legs (commit, ADR, dashboard)
  — verified by `scripts/check-decision-propagation.sh` (0 orphans
  of 13 tracked rows).
- **Five ADRs still carry "proposed" / "scoping" / "draft" status**:
  <a href="/decisions/<a href="/decisions/D7-widget-shape-and-persistence" class="wiki-link">D7</a>-widget-shape-and-persistence" class="wiki-link"><a href="/decisions/D7-widget-shape-and-persistence" class="wiki-link">D7</a>-widget-shape-and-persistence</a>, <a href="/decisions/<a href="/decisions/D10-lifecycle-context-and-ordering" class="wiki-link">D10</a>-lifecycle-context-and-ordering" class="wiki-link"><a href="/decisions/D10-lifecycle-context-and-ordering" class="wiki-link">D10</a>-lifecycle-context-and-ordering</a>,
  <a href="/decisions/<a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a>-serialization-convergence" class="wiki-link"><a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a>-serialization-convergence</a>, <a href="/decisions/<a href="/decisions/D8-world-vue-reactive-adapter" class="wiki-link">D8</a>-world-vue-reactive-adapter" class="wiki-link"><a href="/decisions/D8-world-vue-reactive-adapter" class="wiki-link">D8</a>-world-vue-reactive-adapter</a>,
  <a href="/decisions/<a href="/decisions/D13-ecs-alignment-audit" class="wiki-link">D13</a>-ecs-alignment-audit" class="wiki-link"><a href="/decisions/D13-ecs-alignment-audit" class="wiki-link">D13</a>-ecs-alignment-audit</a>. **All five have been factually superseded
  or are explicitly Phase B work**, but their status headers had
  not been updated.
- **`D-uwf-drafting-board.md` carries three open UWF-adjacent
  questions (N11, N12, N13)** about app-level `beforePrompt`, virtual
  wiring declaration, and cross-node value sync. Per user direction,
  these defer to the next milestone with the core internal migrations.
- **`D6.2-types-package-sunset-criteria` is intentionally PROPOSED
  pending Phase B telemetry** — this is the deferred-by-design case
  and stays as-is.

This ADR is the **single-source registry** of the Phase A surface
freeze: it enumerates every open ADR, records the closure verdict
for each, and states that the v2 extension-api surface is FINAL for
Phase A.

## Decision

**Phase A surface is FROZEN as of foundation HEAD `ee0537fdb5`
(wave-11 hygiene cleanup).** No further public-API surface changes
land in Phase A absent a new ACCEPTED ADR. All open ADRs receive
explicit closure verdicts below; status headers updated in the same
foundation-status-only commit.

### Per-ADR closure verdicts

| ADR | Pre-wave-12 status | Verdict | Successor / pointer |
|-----|---------------------|---------|---------------------|
| **<a href="/decisions/<a href="/decisions/D7-widget-shape-and-persistence" class="wiki-link">D7</a>-widget-shape-and-persistence" class="wiki-link">D7-widget-shape-and-persistence</a>** | proposed | **SUPERSEDED** | Part 1 (universal-vs-typed split) → <a href="/decisions/<a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a>-widget-state-categories" class="wiki-link">D14-widget-state-categories</a> §Categories. Part 2 (3-tier persistence) → <a href="/decisions/D-immutability-enforcement" class="wiki-link">D-immutability-enforcement</a> (Hybrid C: ReadonlyArray<Readonly<T>>). Part 3 (value-envelope) → <a href="/decisions/D14-widget-state-categories" class="wiki-link">D14-widget-state-categories</a> §Options bag. Part 4 (4→2 serialization surfaces) → <a href="/decisions/D14-serialization-convergence" class="wiki-link">D14-serialization-convergence</a> + <a href="/decisions/D-widget-serialization-simplification" class="wiki-link">D-widget-serialization-simplification</a> (final shape: one `widget.on('beforeSerialize')` hook, <a href="/axioms#a16-refs" class="wiki-link">A16</a>). Part 5 (<a href="/api-docs/widgethandle" class="wiki-link">WidgetHandle</a> shape) → live `src/extension-api/widget.ts` (post wave-11). |
| **<a href="/decisions/<a href="/decisions/D10-lifecycle-context-and-ordering" class="wiki-link">D10</a>-lifecycle-context-and-ordering" class="wiki-link">D10-lifecycle-context-and-ordering</a>** | proposed | **SUPERSEDED** | Lifecycle context, hook ordering, async-setup, setupState wrap all decided in **<a href="/decisions/D-bootstrap-hooks" class="wiki-link">D-bootstrap-hooks</a>** (W6.P6.C, ACCEPTED 2026-05-14). Setup-context implementation in `src/extension-api/lifecycle.ts` (`onMounted`/`onBeforeMount`/`onUnmounted`/`onActivated`/`onDeactivated`). Sub-decisions SD-1 (tagged-union ctx) / SD-2 (parallel-slots pragmatic) / SD-3 (lazy invocation) / SD-4 (module-level singletons + auto-dispose) / SD-5 (typed handler map) all resolved handoff-11. |
| **<a href="/decisions/D14-serialization-convergence" class="wiki-link">D14-serialization-convergence</a>** | proposed (pending implementation) | **ACCEPTED + SHIPPED** | Implementation shipped wave-9 via **<a href="/decisions/D-widget-serialization-simplification" class="wiki-link">D-widget-serialization-simplification</a>** + AXIOMS.md <a href="/axioms#a15-refs" class="wiki-link">A15</a> (Widget Declarativity) + <a href="/axioms#a16-refs" class="wiki-link">A16</a> (Unified Serialization Target). Live in `src/extension-api/widget.ts` — `WidgetBeforeSerializeEvent` has no `context` / `skip()` (<a href="/axioms#a16-refs" class="wiki-link">A16</a>); zero serialization disable knobs (A16); `widget.on('beforeSerialize')` is the sole interface. Node-level `node.on('beforeSerialize')` stays `@deprecated` + runtime-warned per ADR-0010 (not banned per user direction wave-9). |
| **<a href="/decisions/<a href="/decisions/D8-world-vue-reactive-adapter" class="wiki-link">D8</a>-world-vue-reactive-adapter" class="wiki-link">D8-world-vue-reactive-adapter</a>** | scoping / blocker | **DEFERRED to Phase B** | Implementation depends on Alex's ECS branch (PR #11939) merging. Phase A ships the API contracts (`node.on(...)`, `widget.on(...)`) against the v1 LiteGraph + monkey-patched adapter; Phase B replaces the adapter with the World↔Vue bridge per D8. No public-API surface change required at Phase B switchover — the change is transparent to extension authors. |
| **<a href="/decisions/<a href="/decisions/D13-ecs-alignment-audit" class="wiki-link">D13</a>-ecs-alignment-audit" class="wiki-link">D13-ecs-alignment-audit</a>** | draft (living) | **LIVING — Phase A ongoing** | Document is intentionally a living audit log of ECS-branch divergences. Re-stated as "living during Phase A; closes when Phase B rebase lands". No closure required for surface freeze. |
| **<a href="/decisions/<a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a>.1-entry-point-shape" class="wiki-link"><a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a>.1-entry-point-shape</a>** | (informational primer) | **CLOSED — informational only** | Primer doc, not a decision. The actual entry-point decision is **<a href="/decisions/D18-pure-functions-loader-registration" class="wiki-link">D18</a> (pure functions + loader registration)** ACCEPTED 2026-05-14. No status header needed; this ADR adds a §Closure-pointer to <a href="/decisions/D18-pure-functions-loader-registration" class="wiki-link">D18</a>. |
| **<a href="/decisions/<a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a>.2-types-package-sunset-criteria" class="wiki-link">D6.2-types-package-sunset-criteria</a>** | PROPOSED | **STAYS PROPOSED — by design** | ADR explicitly defers until Phase B telemetry data exists. Not an "open question affecting surface" — this is the deferred-by-design case. No change. |
| **<a href="/decisions/D-uwf-drafting-board" class="wiki-link">D-uwf-drafting-board</a> (N11, N12, N13)** | DRAFT FOR DISCUSSION | **DEFERRED to next milestone** | N11 (app-level `beforePrompt`), N12 (virtual wiring declaration), N13 (cross-node value sync) all add NEW Phase B surfaces. Per user direction wave-12, defer with the core internal widget/extension migrations. Drafting board stays as-is for future-milestone agents to pick up; no Phase A surface impact. |
| **<a href="/decisions/<a href="/decisions/D12-scope-clone-on-copy" class="wiki-link">D12</a>-scope-clone-on-copy" class="wiki-link"><a href="/decisions/D12-scope-clone-on-copy" class="wiki-link">D12</a>-scope-clone-on-copy</a>** | (`**Status:** accepted` format slipped grep) | **CONFIRM accepted** | Already accepted 2026-05-08. Status header normalized in this wave to canonical `**Status**: ACCEPTED — 2026-05-08`. |
| **<a href="/decisions/D14-widget-state-categories" class="wiki-link">D14-widget-state-categories</a>** | (`> Status: *implemented*` format slipped grep) | **CONFIRM implemented** | Already shipped. Status header normalized to canonical `**Status**: ACCEPTED — implemented in `src/extension-api/widget.ts` (D7 Part 1 + Part 3 successor)`. |
| **<a href="/decisions/D-widget-serialization-simplification" class="wiki-link">D-widget-serialization-simplification</a>** | (status line uses `**Status:** ACCEPTED` — different bullet pattern) | **CONFIRM accepted** | Already shipped wave-9. Status header normalized to canonical `**Status**: ACCEPTED — 2026-05-20 (wave-9)`. |
| **<a href="/decisions/D-linked-subgraph-constraint" class="wiki-link">D-linked-subgraph-constraint</a>** | (`**Status:** accepted` format slipped grep) | **CONFIRM accepted** | Already accepted 2026-05-18. Status header normalized. |

### Surface freeze content

The Phase A surface, as frozen at foundation `ee0537fdb5`, is the
union of:

- All exports from `src/extension-api/index.ts` (the barrel).
- All `@publicAPI`-tagged surfaces in the per-entity files
  (`node.ts`, `widget.ts`, `lifecycle.ts`, `events.ts`,
  `imperatives.ts`, `registrations.ts`, `shell.ts`, `types.ts`,
  `brand.ts`, `identifiers.ts`).
- All surfaces enumerated in `packages/extension-api/build/index.d.ts`
  (the published `.d.ts` mirror, hand-patched per AGENTS.md Rule 8).

The frozen surface is enforced by:

- `scripts/check-axiom-compliance.sh` — strict-fails any
  re-introduction of <a href="/axioms#a14-refs" class="wiki-link">A14</a>-REMOVED or <a href="/axioms#a15-refs" class="wiki-link">A15</a>/A16-banned symbols.
- `scripts/check-decision-propagation.sh` — strict-fails any
  design-review row without all three propagation legs.
- `scripts/check-branch-divergence.sh` — strict-fails any drift
  between `*-v2` and `*-restratify` pairs.

### Re-opening criteria

The Phase A surface re-opens only on:
1. A new ACCEPTED ADR in `decisions/D-*.md` documenting the surface
   change with axiom-compliance verification.
2. The Phase B ECS rebase (PR #11939 merge) — which is a known,
   planned transition with its own ADR cascade (D8 + W6.P8.FREEZE +
   D-uwf-* family).

## Consequences

### Phase A

- **Zero net source change** — this wave only updates ADR status
  headers and adds cross-reference text. No `src/extension-api/*.ts`
  edits, no `packages/extension-api/build/index.d.ts` edits.
- **Surface is shippable** — every public-API surface is either
  ACCEPTED + shipped, COMMENTED OUT per <a href="/axioms#a14-refs" class="wiki-link">A14</a>, or REMOVED per <a href="/axioms#a14-refs" class="wiki-link">A14</a>.
- **Open-question backlog closes** — 5 superseded ADRs + 3 deferred
  UWF questions + 1 deferred-by-design (D6.2) + 1 living draft
  (D13) + 1 Phase-B-blocked (D8) = the whole `decisions/` directory
  now has a clear verdict per ADR.

### Phase B (forward-looking)

- D8 reactive adapter, D-uwf-* family, D6.2 sunset, and W6.P8.FREEZE
  are the four work-streams that re-open at Phase B. Each has its
  own ADR; this ADR does not pre-empt their decisions.
- Internal core widget/extension migrations (preview/progress/audio
  per <a href="/axioms#a15-refs" class="wiki-link">A15</a> follow-up, dynamicPrompts.v2 stub, others) are tracked
  separately and explicitly deferred per user direction wave-12.

### Compatibility (D6 parallel-paths)

- v1 path remains fully functional; nothing in this wave touches v1.
- v2 path is **what npm consumers will get when
  `@comfyorg/extension-api` publishes** from foundation `ee0537fdb5`
  + the hygiene cleanup .d.ts.

### CI

- No code change — `pnpm lint && pnpm format:check` continue to
  pass (Rule 8 carve-out applies to codecov/patch/e2e/perf/playwright
  during Phase A as always).

## Implementation checklist

- [x] Draft ADR (this file)
- [x] Foundation commit (status-header normalization only):
  - [x] D7: status → `SUPERSEDED — see D-api-surface-finalization`
  - [x] D10: status → `SUPERSEDED — see D-api-surface-finalization`
  - [x] D14-serialization-convergence: status →
    `ACCEPTED + SHIPPED via D-widget-serialization-simplification`
  - [x] <a href="/decisions/<a href="/decisions/D12-scope-clone-on-copy" class="wiki-link">D12</a>-scope-clone-on-copy" class="wiki-link">D12-scope-clone-on-copy</a>: status header normalized
  - [x] D14-widget-state-categories: status header normalized
  - [x] D-widget-serialization-simplification: status header
    normalized
  - [x] <a href="/decisions/D-linked-subgraph-constraint" class="wiki-link">D-linked-subgraph-constraint</a>: status header normalized
- [x] No source code edits — Phase A surface is frozen at
  `ee0537fdb5`
- [x] No `.d.ts` edit (no surface change)
- [x] No cascade to pkg/ext/tf (no source change to propagate)
- [x] Dashboard refresh verification — re-run
  `scripts/refresh-api-docs.sh` and confirm zero MDX diff (proves
  the surface is byte-identical to wave-11)
- [x] AGENTS.md `§Reconciliation history` — prepend wave-12 row
  above wave-11
- [x] `bash scripts/sync.sh` clean
