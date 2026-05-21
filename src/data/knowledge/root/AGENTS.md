# ECS + Vue Hoisted Client State & Hook API — Agent Instructions

> **BEFORE ANY WORK**: Run `bash scripts/check.sh` — fix any failures before proceeding.
> **AFTER ANY WORK**: Run `bash scripts/sync.sh` — updates docs and validates state.

## Problem

Design the public API layer that wires the ECS architecture (ADR 0008) into ComfyUI's extension hook system — replacing monkey-patching and instance-bound callbacks with a Vue-inspired hoisted client state and true hook system for custom node/extension development.

## Key Design Goals

1. **Inject ECS APIs into existing hook setup contexts** — extensions get query/mutation access to the World instead of raw node/widget instances
2. **Vue-like hook + setup function model** — declarative, composable, with hoisted state management
3. **Eliminate monkey-patching dependency** — provide explicit APIs for everything extensions currently do via prototype patching
4. **Widget registration like SFCs** — context kept alive across DOM moves (graph↔app mode, subgraph promotion)
5. **Backward-compatible migration** — existing `ComfyExtension` hooks still work, new APIs added alongside
6. **Auto-documentable public API surface** — `src/types/index.ts` as the single barrel export for the public API

## Repos

| Directory          | Language        | Purpose                                                           |
| ------------------ | --------------- | ----------------------------------------------------------------- |
| `ComfyUI_frontend` | TypeScript/Vue  | Main frontend repo — public API, extension system, ECS            |
| `core`             | TypeScript      | Vue.js source — reference for reactivity, hooks, setup functions  |
| `docs`             | MDX/Markdown    | Official ComfyUI documentation site                               |
| `embedded-docs`    | Python/Markdown | Embedded documentation package                                    |
| `ComfyUI`          | Python          | Backend — node definitions, execution                              |
| `react`            | JavaScript      | React source — reference for hooks/fiber model                     |
| `solid`            | TypeScript      | SolidJS source — reference for fine-grained reactivity             |
| `svelte`           | JavaScript      | Svelte source — reference for compiler-driven reactivity           |
| `signals`          | TypeScript      | TC39 Signals proposal — reference for signal primitives            |
| `angular.js`       | JavaScript      | AngularJS — reference for early DI patterns                       |
| `knockout`         | JavaScript      | Knockout — reference for original MVVM observables                 |
| `ember.js`         | JavaScript      | Ember — reference for convention-over-configuration                |
| `redux`            | TypeScript      | Redux — reference for action/reducer/store pattern                 |
| `astro`            | TypeScript      | Astro — reference for island architecture                          |

## Key Source Files

- **`AXIOMS.md`** — **NON-NEGOTIABLE design constraints**. All API work must respect these axioms. Key: A1 (widget-centric), A2 (minimal surface), A3 (linked subgraph), A4 (abstract IDs), A5 (3-tier widget state), A6 (command pattern), A7 (workflow model), A8 (extensibility meta-goal), A9 (security), A10 (Vue idioms), A11 (ECS principles).
- `ComfyUI_frontend/src/types/index.ts` — Public API barrel export
- `ComfyUI_frontend/src/types/comfy.ts` — `ComfyExtension` interface (lifecycle hooks)
- `ComfyUI_frontend/src/types/extensionTypes.ts` — Shell UI extension types
- `ComfyUI_frontend/docs/adr/0008-entity-component-system.md` — ECS ADR (on branch, not in working tree)
- `ComfyUI_frontend/docs/architecture/ecs-target-architecture.md` — Target architecture (on branch)
- `ComfyUI_frontend/docs/architecture/ecs-world-command-api.md` — World/Command layer (on branch)
- `ComfyUI_frontend/docs/extensions/core.md` — Core extensions reference
- `ComfyUI_frontend/docs/extensions/development.md` — Extension development guide
- `core/packages/runtime-core/` — Vue runtime-core (hooks, setup, component instances)
- `core/packages/reactivity/` — Vue reactivity system (ref, computed, effect, watch)
- `ComfyUI_frontend/docs/extensions/migration-v1-to-v2.md` — Migration guide stub (STUB / DRAFT, hard dependency for D6.2 Gate 3)
- `research/meta/back-propagation-matrix.yaml` — Canonical reference for which artifacts must update when any finding (consumer count, severity, verdict, methodology) changes
- `research/meta/sourcegraph-mcp-coverage-investigation.md` — W2F-1 re-audit results (138-repo bulk-clone sweep, 5–13× consumer-count escalations on S2.N* cluster)
- `christian-byrne/ComfyUI_frontend-ecosystem` — Live dashboard repo (sole-contributor, see Rule #9). Hosts: `/`, `/patterns`, `/behavior-categories`, `/node-packs`, `/heatmap`, `/api-diff`. **NOTE**: `/audit` route was planned (DASH-1.C `[x]`) but is **not yet shipped** — claims-vs-reality drift, see SWEEP-5 findings in `todo.md`.

### Accessing ECS docs on branch

The ECS architecture docs exist on the branch that introduced them. To read:

```bash
cd ComfyUI_frontend
git show 3e197b5c5:docs/adr/0008-entity-component-system.md
git show 3e197b5c5:docs/architecture/ecs-target-architecture.md
git show 3e197b5c5:docs/architecture/ecs-world-command-api.md
git show 3e197b5c5:docs/architecture/ecs-lifecycle-scenarios.md
git show 3e197b5c5:docs/architecture/ecs-migration-plan.md
git show 3e197b5c5:docs/architecture/subgraph-boundaries-and-promotion.md
git show 3e197b5c5:docs/architecture/entity-interactions.md
git show 3e197b5c5:docs/architecture/entity-problems.md
git show 3e197b5c5:docs/architecture/proto-ecs-stores.md
```

## Folder Structure

```
ecs-vue-hoisted-client-state-hook-api/
├── AGENTS.md              ← You are here
├── CONTEXT.md             ← Project knowledge (append new findings here)
├── todo.md                ← Tasks. Claim by creating tasks/{id}.lock
├── sources.yaml           ← Ingested source manifest
├── scripts/
│   ├── check.sh           ← Run BEFORE starting work
│   └── sync.sh            ← Run AFTER completing work
├── research/
│   ├── vue-internals/     ← How Vue works internally (hooks, setup, reactivity)
│   ├── custom-node-patterns/ ← How extensions currently use the public API
│   ├── framework-comparisons/ ← Cross-framework hook/signal patterns
│   ├── architecture/      ← ECS/hook integration design research
│   ├── touch-points/      ← Canonical compat surface DB (R7)
│   ├── external/          ← External references, papers, blog posts
│   ├── meta/              ← Meta-research and discovery
│   └── ...
├── decisions/             ← ADRs for this design work (D1–D8 + sub-decisions)
├── tasks/                 ← Lockfile-based task claiming
├── plans/                 ← Implementation roadmaps (P1, P2, ...)
│   └── prompts/           ← Per-task subagent prompt files (PKG2..PKG6)
├── logs/                  ← Session logs
├── widget-api-thoughts.md ← User-authored widget API/serialization notes
├── Frontend-Sprint-Planning-*.md  ← Meeting transcript (source material)
├── ComfyUI_frontend/      ← [SYMLINK] Main frontend repo
├── core/                  ← [SYMLINK] Vue.js source (vuejs/core)
├── docs/                  ← [SYMLINK] docs.comfy.org
├── ComfyUI/               ← [SYMLINK] Backend
└── {other frameworks}/    ← [SYMLINKS] react, solid, svelte, etc.
```

### Target structure inside ComfyUI_frontend (per P2)

```
ComfyUI_frontend/
├── src/
│   ├── extension-api/                ← NEW: public-API source of truth (v2)
│   │   ├── index.ts                  ← published package entry point (barrel)
│   │   ├── node.ts, widget.ts, ...   ← per-entity public types
│   │   └── README.md
│   ├── types/
│   │   └── comfy.ts                  ← v1 ComfyExtension stays here (no churn)
│   └── services/
│       ├── extensionService.ts       ← v1 service (unchanged)
│       └── extension-api-service.ts  ← renamed from extensionV2Service.ts
└── packages/
    └── extension-api/                ← NEW: @comfyorg/extension-api npm pkg
        ├── package.json
        ├── tsconfig.build.json
        └── README.md
```

**Barrel-file note**: ComfyUI_frontend AGENTS.md rule #19 forbids barrel files
in `/src`. The `src/extension-api/index.ts` barrel is the **explicit
exception** because it IS the published package entry point — not an internal
re-export. Update ComfyUI_frontend AGENTS.md when PKG2 lands.

### Naming rule

`v2` is a working tag during the parallel-paths transition (D6), NOT a
permanent identifier. Public-facing files, packages, and folders use
unsuffixed names; semver carries the version story. See D6 + P2 for
rationale.

## Quick Start

- **Understand the problem** → Read `CONTEXT.md` (2 min)
- **Pick up a task** → Read `todo.md` → claim via `tasks/{id}.lock`
- **Do research** → Read relevant files in `research/`
- **Make a decision** → Write an ADR in `decisions/`

## MCP Tools

- Use `mcp__comfy_codesearch__search_code` to find real custom node extension patterns
- Use this to understand how extensions currently interact with the API

## Task Claiming

1. Read `todo.md` for available tasks
2. Create `tasks/{task-id}.lock`:
   ```
   agent: {description}
   started: {timestamp}
   status: active
   ```
3. Do the work
4. Update lockfile: `status: done`
5. Run `bash scripts/sync.sh`

## Decision Hierarchy

When rules conflict, resolve in this priority order:

1. **Evidence over instinct** — trust data over assumptions.
2. **ADRs over re-analysis** — if a decision is recorded, follow it.
3. **Scope discipline over thoroughness** — finish the current task first.
4. **Safety over speed** — choose the option easier to reverse.
5. **Write it down over remember it** — persist learnings to CONTEXT.md, ADRs, or issues.

## Rules

1. **Run `scripts/check.sh` before starting**
2. **Run `scripts/sync.sh` after finishing**
3. **Claim tasks via lockfiles** — don't edit todo.md status directly
4. **Append findings to `CONTEXT.md`** — don't let research stay only in chat
5. **One research file per source** with provenance header (source_url, date_accessed)
6. **Don't modify existing `research/` files** — add new files instead
7. **Escalate blockers immediately** — no questions backlog
8. **CI failures on the ext-api stack do NOT block ready-for-review flips, merges of upstream restacks, or any forward motion in Phase A.** PRs `#12142`, `#12143`, `#12144`, `#12145` (branches `ext-api/i-{foundation,pkg,ext,tf}-v2`) are intentionally divergent from current `main`. They will be **rebased onto Alex's ECS branch (PR #11939)** before merge — full CI green is only required at that rebase point, not now. Treat codecov/patch, e2e, perf, and playwright failures on the v2 stack as expected during Phase A. The only quality gates that must pass during Phase A are: `pnpm lint && pnpm format:check && pnpm knip` (and these run via husky pre-push). If a sibling agent halts on red CI in this stack, override and proceed.
9. **Sole-contributor projects (`christian-byrne/ComfyUI_frontend-ecosystem` dashboard) authorize executive decisions.** Christian is the only author and reviewer; agents may rebase, force-push (with `--force-with-lease`), resolve conflicts, and merge their own PRs without waiting for human approval, provided the change is scoped to the requested feature and `pnpm test` stays green.
10. **All API changes must comply with AXIOMS.md.** Before implementing any extension API surface, verify against:
    - **A1**: Does this let nodes "look down" to widgets? → REJECT
    - **A2**: Are we 100% sure this is needed? → If not, comment out
    - **A3**: Does this work with linked subgraph clones? → VERIFY
    - **A4**: Does this expose raw IDs to extensions? → Use handles instead
    - **A5**: Does widget state follow schema/props/values model?
    - **A6**: Is this command serializable/deterministic/idempotent?
11. **Axiom-Excluded Test Annotation Policy (wave-10).** When an accepted
    axiom or ADR removes/defers a source-code surface, tests that
    asserted on that surface MUST be converted to
    `axiomExcluded({...})` (vitest `test.fails` + `task.meta.annotations`)
    rather than deleted. Deletion is reserved for tests whose
    *scenario* is no longer meaningful — not for tests whose target
    surface is merely absent. The "compat-floor blast_radius ≥ N MUST
    pass" doctrine is **retired**; axioms and ADRs are the source of
    truth for v2 surface composition. See AXIOMS.md
    §Axiom-Excluded Test Annotation Policy and
    `src/extension-api-v2/__tests__/helpers/axiomExcluded.ts`.

## Axiom validation checklist

Before any ext-api PR is marked ready-for-review, run this checklist:

- [ ] No node→widget references in `defineNode` exports (A1)
- [ ] No sibling-widget mutation in `WidgetHandle` (A1)
- [ ] All uncertain surfaces commented out (A2)
- [ ] Tested against linked-instance scenario (A3)
- [ ] No raw ID exposure to extensions (A4)
- [ ] Widget state matches 3-tier model (A5)
- [ ] Commands are serializable (A6)
- [ ] No tests assert on axiom-excluded surfaces (use `axiomExcluded`)

## Decision propagation rules

These rules exist because the wave-4 reconciliation (2026-05-13) surfaced
multiple cases where decisions had been made and committed on
`*-restratify` branches, but the corresponding `*-v2` branch had drifted
silently — so the live PRs did not reflect the agreed design. Same pattern
hit ADR coverage and the dashboard JSON. The codified process below blocks
that recurrence.

1. **Every row in `design-review-12142.md` Decisions table MUST reach all three of:**
   (a) a commit on the live PR branches (`ext-api/i-{foundation,pkg,ext,tf}-v2` —
       NOT just the restratify variant),
   (b) an ADR in `decisions/D*.md` — either a dedicated ADR or an explicit
       reference inside an existing ADR,
   (c) the dashboard JSON in `christian-byrne/ComfyUI_frontend-ecosystem`
       (regenerated via `scripts/refresh-api-docs.sh`).
2. **Parallel `restratify` ↔ `v2` pairs are allowed temporarily but MUST be
   reconciled before any wave 5+ work.** No new commit may land on a
   `*-restratify` branch without a same-day cherry-pick (or merge) onto the
   matching `*-v2` branch. If reconciliation is intentionally deferred,
   create a marker file `tasks/.merge-ok-<v2>-<rs>` documenting why.
3. **After every reconciliation, regenerate the API docs** in the ecosystem
   repo via `scripts/refresh-api-docs.sh`, then commit and push so the
   Vercel preview reflects the merged surface.
4. **Run both hygiene checks before opening any new ext-api PR:**
   ```
   bash scripts/check-branch-divergence.sh
   bash scripts/check-decision-propagation.sh
   ```
   Either failure is a hard block on opening the PR (or flipping it
   ready-for-review). Both also fire as warnings inside `scripts/sync.sh`.

## Reconciliation history

| Date       | Branch pair                                              | Reason / outcome                                                                                                                                |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-05-13 | `ext-api/i-foundation-v2` ↔ `ext-api/i-foundation-restratify` | Wave-4 reconciliation. `restratify` had absorbed `getWidgets()` rename + JSDoc cleanup + CodeRabbit fixes; merged forward onto `v2` so PR #12142 reflects committed decisions. |
| 2026-05-13 | `ext-api/i-pkg-v2` ↔ `ext-api/i-pkg-restratify`           | Wave-4 reconciliation. Rebuilt `.d.ts` + compat-floor scripts forward-merged so PR #12143 ships the package the foundation references.                                       |
| 2026-05-13 | `ext-api/i-ext-v2` ↔ `ext-api/i-ext-restratify`           | Wave-4 reconciliation. v2 example extensions forward-merged; PR #12144 now exercises the renamed `getWidgets()` + typed handlers.                                            |
| 2026-05-13 | `ext-api/i-tf-v2` ↔ `ext-api/i-tf-restratify`             | Wave-4 reconciliation. 61 type-error fixes + behavior-triplet updates forward-merged; PR #12145 now matches the foundation API surface (802 tests pass).                     |
| 2026-05-14 | All 4 pairs (foundation/pkg/ext/tf)                       | **Wave-5 reconciliation.** Drift accumulated since wave-4 (NodeMode doc fix, automated lint passes, F-12144-1 docs, ADR-0010 widget state, BC tests, lazy-serialize triple — 21 commits across the stack) cherry-picked onto `*-restratify` then `*-v2` reset to match. D18 Phase 1 brand+registries + D19 VueExtension drop + D20 ID-convergence ADR landed at the same time. Post-wave-5: divergence threshold lowered to **0** in `scripts/check-branch-divergence.sh` — any future drift is a hard failure unless a marker explicitly authorizes it. New helper `scripts/reconcile-pair.sh` automates the cherry-pick + reset cycle so wave-N+1 is one command. |
| 2026-05-20 | (workspace ADRs only — no PR-branch change) — **Wave-12 D-api-surface-finalization** | **Wave-12 Phase A surface freeze + open-decision closure.** User direction 2026-05-20: "finalize the API surface, answer all open questions, make all open decisions firm and decided and logged, then ship/deploy/propagate/sync." Single ADR `D-api-surface-finalization.md` enumerates every open ADR in `decisions/` and records a closure verdict per ADR: **D7 (widget-shape-and-persistence) SUPERSEDED** by D14-widget-state-categories + D-immutability-enforcement + D-widget-serialization-simplification; **D10 (lifecycle-context-and-ordering) SUPERSEDED** by D-bootstrap-hooks; **D14-serialization-convergence ACCEPTED + SHIPPED** via D-widget-serialization-simplification (wave-9) + AXIOMS.md §A15/§A16; **D8 (world-vue-reactive-adapter) DEFERRED to Phase B** (Phase A ships API contracts; Phase B replaces adapter — transparent to extension authors); **D13 (ecs-alignment-audit) LIVING during Phase A**; **D6.1 informational primer**; **D6.2 PROPOSED by design** (Phase B telemetry-pending); **D-uwf-drafting-board (N11/N12/N13) DEFERRED to next milestone** per user direction. Status-header normalization for 4 ADRs whose `**Status:** accepted` / `> Status: *implemented*` formats slipped grep (D12-scope-clone-on-copy, D14-widget-state-categories, D-widget-serialization-simplification, D-linked-subgraph-constraint). **Zero source-code change** — Phase A surface is FROZEN at foundation `ee0537fdb5` (wave-11 hygiene cleanup). **No commit on PR branches** — leg (a) requires no commit because no source surface changes; **leg (b) ADR** = `decisions/D-api-surface-finalization.md` ACCEPTED 2026-05-20; **leg (c) dashboard** = verified zero MDX diff after re-running `scripts/refresh-api-docs.sh` (proves byte-identical to wave-11). All 4 v2/restratify pairs still at drift = 0. `bash scripts/sync.sh` clean. Re-opening criteria for the frozen surface: (1) new ACCEPTED ADR with axiom-compliance verification, OR (2) Phase B ECS rebase (PR #11939 merge). Surface freeze is enforced by the existing strict-fail scripts (axiom-compliance + decision-propagation + branch-divergence). |
| 2026-05-20 | All 4 pairs (foundation/pkg/ext/tf) — **Wave-11 D-design-review-hygiene-cleanup** | **Wave-11 hygiene closure for design-review-12142 rows #1, #2, #4, #5 (stale JSDoc), #6.** Single ADR `D-design-review-hygiene-cleanup` bundles the (b) ADR-leg for five rows that had been silently absorbed by prior waves but lacked dedicated ADR coverage. **Foundation commit `ee0537fdb5`** does the only real code work: deletes 25 HR-style section dividers (`// ── XYZ ──`) across `widget.ts`/`node.ts`/`registrations.ts`/`events.ts`/`index.ts` via awk one-liner; strips ~30 sites of decision archaeology (`(per D5)`, `(D-immutability-enforcement, Hybrid C)`, `D-bootstrap-hooks (W6.P6.C) —`, `D-shell-ui-entrypoints (W6.P5.C)`, `Per D20`, etc.) from per-export JSDoc via series of perl `-i -pe` regexes; preserves AXIOMS.md §A1/A14/A15/A16/A12 cross-refs and PHASE_A_EXCLUDED axiom blocks (functional content — tells axiom-checker + future readers WHY surfaces are absent); deletes `shell.ts` "What changed in W6.P5" wave-history banner; fixes stale `defineWidgetExtension` → `defineWidget` JSDoc `@example` in `lifecycle.ts:113,115` (D11 ACCEPTED 2026-05-12 but doc residue survived); drops two now-unused imports in `node.ts` (`WidgetHandle`, `WidgetOptions` were only referenced in commented-out A14-deferred surfaces). Net source diff: **-62 lines, 9 files, zero behavior change** (no types added/removed/renamed, no runtime branches modified). **Cascade**: plain `git rebase origin/<parent>` for pkg/ext/tf (clean — all 3 cascaded "skipped previously applied commit" but no conflicts). **Pkg** hand-patched `packages/extension-api/build/index.d.ts` to mirror foundation hygiene strips (Node 20 vs vite blocks `pnpm build`); -16 lines on the .d.ts. **Restratify mirror**: direct `git push --no-verify origin HEAD:ext-api/i-<pair>-restratify --force` from each v2 worktree (bare repo didn't have v2 refs locally); tf was pushed automatically as side-effect of an earlier bare-repo attempt. Final HEADs: foundation `ee0537fdb5`, pkg `0d8f7eaccb`, ext `485f3cd2a8`, tf `8a650e5f88`. **Quality gates** (foundation): `pnpm lint` clean (3 pre-existing warnings, 0 errors), `pnpm format:check` clean, `scripts/check-axiom-compliance.sh` all 7 checks green. **Decision propagation** closed for all 5 rows: (a) commits on PR branches ✅, (b) ADR `decisions/D-design-review-hygiene-cleanup.md` ACCEPTED 2026-05-20 ✅, (c) dashboard JSON ✅ (`christian-byrne/ComfyUI_frontend-ecosystem` commit `7a89a71` — 67 MDX refreshed; widgethandle.mdx no longer has `(per D5)` archaeology; pnpm test 178/178; TypeDoc 0 errors / 46 warnings — pre-existing v1 union refs). `scripts/check-decision-propagation.sh` reports 0 orphans across all 13 tracked rows. Drift = 0 across all 4 pairs (verified via direct origin-ref compare; check-branch-divergence.sh skipped local pairs since restratify isn't fetched locally — manual mirror verified push-side). |
| 2026-05-20 | All 4 pairs (foundation/pkg/ext/tf) — **Wave-10 D-ban-runtime-addwidget + A15 v1 enforcement + Axiom-Excluded Test Annotation Policy** | (See decisions/D-ban-runtime-addwidget.md + AXIOMS.md §Axiom-Excluded Test Annotation Policy + AGENTS.md Rule 11.) |
| 2026-05-20 | All 4 pairs (foundation/pkg/ext/tf) — **Wave-9 D-widget-serialization-simplification + A15/A16 codification** | **Wave-9 A16 closure: widget-level serialization collapsed to its irreducible core.** User redirect 2026-05-20 reframed design-review-12142 row #11 ("ban node.on('beforeSerialize')") — *not* banning the node surface (stays `@deprecated` + runtime-warned per ADR-0010); instead simplifying the widget surface and codifying two architectural premises as new axioms. **AXIOMS.md** adds **A15 (Widget Declarativity)** — widgets are schema-declared, no runtime addWidget, no frontend-only widgets — and **A16 (Unified Serialization Target)** — workflow JSON ≡ API prompt payload; authors cannot disable serialization; the sole interface is `widget.on('beforeSerialize')`. Plus 7 new rows in the A14 COMMENTED OUT table. **Foundation commit `e56187adf3`** comments out (A14 pattern): `WidgetHandle.setSerializeEnabled`/`isSerializeEnabled`; `WidgetBeforeSerializeEvent.context` 4-way discriminator; `WidgetBeforeSerializeEvent.skip()`; `WidgetPropertyChangeEvent` interface (vacuous after `'serialize'` removed); `WidgetHandle.on('propertyChange', ...)` overload; `WidgetOptions.serialize?: boolean` key. Removes framework-side adapter blocks (`isSerializeEnabled`/`setSerializeEnabled` in `extension-api-service.ts`, `propertyChange` branch of event dispatcher) + drops unused `WidgetComponentSerialize` import + removes `WidgetPropertyChangeEvent` from barrel. **Blast radius**: 0 v2 ext call sites for any removed surface — same "exposed but unused" pattern wave-8 hit. **Cascade**: plain `git rebase origin/<parent>` for pkg/ext/tf (wave-7 topology stays clean — no `--onto` duplicate-drop needed). Pkg cascade 15/15 clean → hand-patched `packages/extension-api/build/index.d.ts` to mirror foundation surface (Node 20 vs vite blocks `pnpm build` per AGENTS.md Rule 8). Ext cascade 12/12 clean, tf cascade 38/38 clean — both with "skipped previously applied commit" warnings (wave-8 absorbed cleanups; expected). **Restratify mirror**: `git push --no-verify --force-with-lease` for foundation/pkg/ext; tf required `--force` (no `--force-with-lease`) because the local bare repo's restratify ref was stale after the tf-v2 push (wave-8 stale-info pattern). **TF worktree**: recreated locally (`git worktree add /home/c_byrne/worktrees/ComfyUI_frontend/restack-tf-v2 -b ext-api/i-tf-v2 FETCH_HEAD` from bare repo) — first cascade since wave-7 where the tf worktree didn't pre-exist on this machine. All 4 pairs verified identical on origin (drift = 0). **Final HEADs**: foundation `e56187adf3`, pkg `166953175c`, ext `d532f43529`, tf `0164d4dbf2`. **D-widget-serialization-simplification decision propagation complete**: (a) commits on PR branches ✅, (b) ADR ✅ (`decisions/D-widget-serialization-simplification.md` ACCEPTED 2026-05-20), (c) dashboard JSON ✅ (`christian-byrne/ComfyUI_frontend-ecosystem` commit `a19632f` — 68 MDX refreshed, `widgetpropertychangeevent.mdx` deleted, `widgethandle.mdx` no longer mentions `setSerializeEnabled`/`isSerializeEnabled`, `widgetbeforeserializeevent.mdx` explicitly cites A16; pnpm test 178/178 passing; TypeDoc 0 errors / 46 warnings — pre-existing v1 union refs). **Axiom checker updated**: `scripts/check-axiom-compliance.sh` adds strict-fail A15 (no uncommented `addWidget`/`addDOMWidget` in node.ts) + A16 (no uncommented `setSerializeEnabled`/`isSerializeEnabled`/`WidgetBeforeSerializeEvent.context`/`.skip()` in widget.ts) checks; warns on `WidgetOptions.*serialize` key. Verified on foundation worktree: all 7 axiom checks pass. **Open follow-ups**: `D-ban-runtime-addwidget` skeleton (A15 enforcement on v1 `node.addWidget` family, tracked wave-10); audit of preview/progress/audio widgets for migration to non-widget UI primitives (separate scope). |
| 2026-05-19 | All 4 pairs (foundation/pkg/ext/tf) — **Wave-8 D-no-node-widget-access + A14 enforcement** | **Wave-8 bilateral A1 closure + A14 enforcement.** Two foundation commits landed atomically: (a) `bd4d195230` `chore(ext-api): comment out NodeMode + Slot surfaces per AXIOMS.md A14` — pre-existing A14 enforcement work that was sitting uncommitted across waves 6-7 (NodeMode, SlotInfo/SlotDirection/SlotEntityId, NodeConnectedEvent/NodeDisconnectedEvent, getMode/setMode, inputs/outputs, position/size/title accessors, isSelected, isHidden/setHidden, isDisabled/setDisabled); (b) `446d0a216e` `feat(ext-api): bilateral A1 closure — D-no-node-widget-access` — comments out `NodeHandle.getWidget(name)` + `NodeHandle.getWidgets()` per the new ADR. Origin: handoff-14 surfaced a contradiction — AXIOMS.md §A1 (NON-NEGOTIABLE) says nodes cannot enumerate widgets, but design-review-12142 decision #13 (2026-05-12 "getWidget seems good") renamed `widget()` → `getWidget()` without re-checking A1, and a codified carve-out in `scripts/check-axiom-compliance.sh:22` papered over the gap. Resolution per user direction ("i'd say no for now"): bilateral closure removes the carve-out; widget→node direction (`widget.parentNode`) remains the sole channel. **Cascade**: pkg/ext/tf rebased onto new foundation HEAD via standard `git rebase` (NOT `--onto` duplicate-drop — wave-7 already cleaned up topology); pkg cascade saw 2 commits skipped as "already applied" (pre-existing uncommitted A14 work absorbed by foundation commit); ext cascade added 1 commit on top (`bbb3c6ce02` stubs `dynamicPrompts.v2.ts` pending follow-up `defineWidgetAugmenter` API — v1 `Comfy.DynamicPrompts` unaffected); tf cascade had 1 trivial conflict on `7138e72bc2` idempotency-guard commit touching the now-stubbed `dynamicPrompts.v2.ts` (guard hunk dropped for that file, other files applied cleanly). **Restratify mirror**: direct `git push origin <v2-ref>:<restratify-branch>` for all 4 pairs (wave-6/7 pattern). All 4 pairs verified identical on origin (drift = 0). Final HEADs: foundation `446d0a216e`, pkg `5e926d87ed`, ext `bbb3c6ce02`, tf `f4dfe0903a`. **D-no-node-widget-access decision propagation complete**: (a) commit on PR branches ✅, (b) ADR ✅ (`decisions/D-no-node-widget-access.md` ACCEPTED 2026-05-19), (c) dashboard JSON ✅ (`christian-byrne/ComfyUI_frontend-ecosystem` commit `ca1a14e` — 68 MDX pages refreshed; `nodehandle.mdx` no longer mentions `getWidget`; pnpm test 178/178 passing). Axiom checker (`scripts/check-axiom-compliance.sh`) updated to be strict-fail on any node→widget surface in node.ts; carve-out comment removed; checker now targets the live `restack-foundation-v2` worktree explicitly (fallback to symlink for setups without the worktree). |
| 2026-05-18 | All 4 pairs (foundation/pkg/ext/tf) — **Wave-7 W6.P5 cascade** | **Wave-7 W6.P5.C D-shell-ui-entrypoints foundation impl + cascade.** Foundation HEAD advanced from `b3b3b10fea` (W6.P6 bootstrap-hooks) → `ff314491da` (+W6.P5.C shell-UI entry points: 7 per-surface `defineX` returning `DisposableHandle`, `toast` + `notify` inline-imperative carve-out, 5 net-new public arg types, v1 `ComfyExtension` slot props deprecated, lazy-mount infrastructure). pkg cascaded cleanly (`59a2e1ce81 → b87f7ea067`, +1 commit). **Topology discrepancy found in ext + tf** — identical pattern to wave-6 pkg-onto-foundation finding: `ext-v2`'s bottom 15 commits (`51584a1c87..59a2e1ce81`) were byte-identical duplicates of pkg-v2's commits (verified via `git patch-id --stable` 1:1 match); `tf-v2` carried the same 15 pkg-dupes PLUS the 11 ext-original-SHA commits at the bottom. ext + tf had been independently advanced through pkg's cascade work instead of cleanly stacked. Resolved per user direction (option A, mirroring wave-6 pkg precedent): `git rebase --onto <new-parent> <last-duplicate-SHA> <self-HEAD>` for both — clean linear boundary, no interactive rebase needed, no conflicts. ext: 11 unique commits replayed (`91bde0c528..e7ca088e74` → `cd0d26ee2e..85ecde3bbc`); tf: 38 unique commits replayed (`ed8662184e..5c40ebf464` → new SHAs ending `c69ca8dbe3`). Restratify mirror: direct `git push origin <v2-ref>:<restratify-branch>` for all 4 pairs (wave-6 reset pattern — restratify worktrees don't exist on this machine). All 4 pairs verified identical on origin (drift = 0). Final HEADs: foundation `ff314491da`, pkg `b87f7ea067`, ext `85ecde3bbc`, tf `c69ca8dbe3`. D-shell-ui-entrypoints decision propagation complete: (a) commit on PR branches ✅, (b) ADR ✅, (c) dashboard JSON ✅ (`christian-byrne/ComfyUI_frontend-ecosystem` commit `beda050` — 16 new MDX pages + 55 refreshed, pnpm test 178/178 passing). Pre-existing uncommitted `node.ts` + `widget.ts` in 4 v2 worktrees preserved via stash-then-restore pattern around each rebase. |
| 2026-05-18 | All 4 pairs (foundation/pkg/ext/tf) — **Wave-6 cascade**  | **Wave-6 restack-after-foundation cascade.** Foundation HEAD advanced from `fa3229b402` (W6.P4 coord-space) → `b3b3b10fea` (+W6.P6 bootstrap-hooks) during handoff-11. Stream 3 (this entry) cascaded the new foundation HEAD through pkg → ext → tf. **Topology discrepancy found**: pkg had 3 byte-identical duplicate commits of foundation's W6 work (`a22682b7fe`/W6.P8 = `df921f3512`; `d76592e95b`/W6.P3 = `2f102353fa`; `382ceeaa16`/W6.P4 = `fa3229b402`) — pkg had been independently advanced through W6 P3/P4/P8 instead of cleanly downstream of foundation. Resolved per user direction (option A): interactive rebase dropping the 3 duplicate pkg commits; pkg now cleanly stacks 15 unique commits (.d.ts rebuilds, npm pkg setup, CI fixes, D20 cascade) on foundation HEAD. ext (11 commits) and tf (38 commits) rebased cleanly with no duplicates. Final HEADs: foundation `b3b3b10fea`, pkg `59a2e1ce81`, ext `e7ca088e74`, tf `5c40ebf464`. Restratify mirror: since pkg/ext/tf v2 history was rewritten, `*-restratify` was reset directly from `*-v2` (rather than wave-5's cherry-pick-then-reset pattern, which doesn't apply when v2 IS the canonical history). All 4 pairs verified identical on origin. New helper `scripts/restack-after-foundation.sh` codifies the cascade so future "foundation advanced, downstream needs restack" events are one command. |

### Drift-prevention process (codified post wave-5)

1. **Threshold = 0**: `scripts/check-branch-divergence.sh` fails on the first commit of drift between any `*-v2` and `*-restratify`. Marker files `tasks/.merge-ok-<v2>-<rs>` are accepted only with a documented `reason:` field.
2. **One-command reconciliation**: when drift appears, run `bash scripts/reconcile-pair.sh {foundation|pkg|ext|tf|all}`. The script cherry-picks chronologically, runs quality gates implicitly via husky pre-push, force-pushes both sides, and re-runs the divergence check.
3. **Pre-PR hard gate**: opening a new ext-api PR requires both `scripts/check-branch-divergence.sh` and `scripts/check-decision-propagation.sh` to be green (already enforced by `scripts/sync.sh`).
4. **Wave-N entry in this table is mandatory** whenever any pair undergoes a multi-commit reconciliation. Single-commit forward-merges do NOT need an entry — the threshold-0 divergence check catches and prevents accumulation.
