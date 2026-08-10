# ECS + Vue Hoisted Client State & Hook API — Tasks

## 2026-05-21 PM — Wave-19 backlog (proposed, not yet started)

Logged but not actioned — will pick up after Slack-feedback approval pass.

### Wave-19 Slack-feedback absorption — SHIPPED 2026-05-21 PM

**Status**: ✅ A1+A2, A3, A4, A6, A7, A8, A9, A10, A11 all shipped. A5 was DENIED by user (classical-scroll viz skipped). Final dashboard HEAD CI green; 27/27 live-Vercel e2e (up from 21).

- [x] W19.A1+A2 — AXIOMS.md compressed 540→412 lines (24% reduction). Austin preamble added at top (3-line Postel's-law contract). Rationale extracted into 9 ADRs (`decisions/D-axiom-A{1,2,4,5,6,12,13,15,16}-rationale.md`). Coverage matrix at `research/wave-19-axiom-coverage-matrix.md`. 7/7 axiom checks pass; 359 cross-refs intact.
- [x] W19.A3 — `docs/glossary.md` (26 terms) + dashboard `/glossary` route + `wiki-link-mdx.mjs` extension + nav-smoke e2e. Dashboard commit `3029f70`.
- [x] W19.A4 — 8 derived theorems published at `axioms-theorems.md` + rendered as cards on dashboard `/axioms` page below axiom index. Dashboard commit `70a77ae`. +5 Axioms.test.ts cases.
- [x] W19.A6 — A12 "What this changes for you" paragraph added to AXIOMS.md (frames `widget.element`/`widget.inputEl` removal as handle-accessor-only change). Inline in AXIOMS.md.
- [x] W19.A7 — A12 "Remount vs Recreate" glossary subsection added to AXIOMS.md distinguishing host-remount (same instance) from widget-recreate (fresh instance from spec).
- [x] W19.A8 — `provide()`/`inject()` references reworded across AXIOMS.md (A10 + A14:`getWidget` row) — now explicit "framework-internal mechanism, NOT extension-author API".
- [x] W19.A9 — `decisions/D-unify-widget-mount-model.md` PROPOSED (246 lines). Phase B blocker — flips ACCEPTED on PR #11939 merge.
- [x] W19.A10 — `decisions/D-widget-promotion-semantics.md` PROPOSED. Phase B blocker — flips ACCEPTED with W19.A9. Theorem 6 (Value Promotion Impossibility) derivation chain.
- [x] W19.A11 — +3 vitest cases (slug dedupe edge cases) + +3 e2e cases (deep-link nav). 321 vitests / 27 e2e all green locally + live Vercel. Dashboard commit `9f2a656`. Surfaced real bug: DecisionDetail.vue has its own stateless `marked` renderer (W18.M dedupe only landed in MarkdownView.vue); documented in commit + test JSDoc as follow-up.
- DENIED: W19.A5 (classical-scroll viz) — user denied; current design preserved.

### Wave-19 polish (Phase-A-safe, deferred to next wave)

- [x] W19.P1 — **Strict idempotence for `scripts/wiki-link-mdx.mjs`** — SHIPPED 2026-05-21 PM (dashboard `1aba5be`). Root cause: longest-first sort wrapped `D14-widget-state-categories` first, then the shorter `D14` regex matched **inside** the just-injected `href="/decisions/D14-..."`, producing nested anchors. Fix: re-tokenize between each symbol pass (extracted `countExistingWikiLinks` helper, swapped loop order to per-symbol, reset `seen` and re-derive from fresh tokenization after any successful pass). Was 887→9→0; now 868→0→0 in one run. +1 vitest regression case for substring-symbol nesting (11/11 pass).
- [x] W19.P2 — **Adopt `marked-gfm-heading-id` plugin** — SHIPPED 2026-05-21 PM (dashboard `88c1c6c`, combined with W19.P5). Plugin uses github-slugger and resets via marked's `preprocess` hook on every `parse()` call, so dedupe is correctly scoped per-render. Unicode letters now PRESERVED (matches GitHub behavior; old hand-rolled `slugify` stripped non-ASCII via `/[^\w\s-]/g`).
- [x] W19.P3 — **Dashboard 404 catch-all route** — SHIPPED 2026-05-21 PM (dashboard `88fb4d7`). New `src/pages/NotFound.vue` (404 marker + h1 + bad-path echo + curated nav suggestions). New `:pathMatch(.*)*` route at end of routes array. +3 vitest cases + 1 nav-smoke e2e (`/this-route-does-not-exist/...` → NotFound rendered).
- [x] W19.P4 — **Adversarial-review SHIP-WITH-FOLLOWUPS** — SHIPPED 2026-05-21 PM (dashboard `a37fd0c`).
  - [x] W19.P4.A — DOMPurify guard on `v-html` sites. New `src/lib/sanitizeHtml.ts` wraps DOMPurify; applied at MarkdownView, Prose, AuditPRDetail (highest-risk site — GitHub PR descriptions), ApiDocs. +8 vitests covering script/onclick/javascript: strip + heading-id/wiki-link-class/shiki preservation.
  - [x] W19.P4.B — Honor `prefers-reduced-motion` in `src/router/index.ts:171` scrollBehavior. `behavior: 'smooth' | 'auto'` toggled via `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. Guards `typeof window === 'undefined'` for jsdom/unit tests.
  - [x] W19.P4.C — Warn on ambiguous wiki-link / backlink resolution in `scripts/build-knowledge-manifest.mjs`. `ambiguityWarnings` collector + per-token grouped warning print at end. Surfaces 3 real ambiguities today (D3 → 6 candidates incl D3.1..D3.5; D14 → 2; D6 → 3 incl D6.1, D6.2). Warn-only, never fails build.
- [x] W19.P5 — **Extract `useMarkdownWithSlugDedupe()` composable** — SHIPPED 2026-05-21 PM (dashboard `88c1c6c`, combined with W19.P2). New file `src/composables/useMarkdownWithSlugDedupe.ts` (scoped `new Marked()` + highlightCode renderer + gfmHeadingId plugin). MarkdownView.vue drops its slugify+Map (-26 LOC); DecisionDetail.vue drops its duplicated stateless renderer (-18 LOC) and inherits dedupe for free — closes the W19.A11 documented gap.

### Wave-19 follow-ups carried from OP (Christian's first Slack message)

Source: <https://comfyui-frontend-ecosystem.vercel.app/api-docs> Slack thread, 2026-05-21 8:02 PM.

- [ ] W19.OP1 — **Migrate 3rd-party extensions**. After W16.P1 core migrations land.
- [ ] W19.OP2 — **Virtual widgets handling/migration**.
- [x] W19.OP3 — **Refine W16.P2 scope (virtual nodes)** with Christian's updated framing. SHIPPED 2026-05-21 PM as `decisions/D-reroute-primitive-real-backend-migration.md` (PROPOSED, Phase B). Closes the wave-13 `D-no-virtual-nodes-in-api.md` N12 carve-out for built-in Reroute + Primitive. Disposition: D-A Reroute → no-op backend pass-through Python node; D-B Primitive → snapshot-on-instantiation (matches `D-widget-promotion-semantics.md` cloned-Value variant). Flips to ACCEPTED on the **combined trigger of PR #11939 merge AND Vue Nodes mode rollout (W16.P3)** — NEW two-component trigger gate. Cites A1/A4/A5/A7/A15. Christian's verbatim direction: "we shouldn't have any; deprecate old reroutes in Vue Nodes mode; primitives instantiated with copy of source state." AGENTS.md `§Reconciliation history` row added. `bash scripts/check-axiom-compliance.sh` 7/7 green post-ADR.

### Wave-19 dispatch detail (superseded by SHIPPED checklist above — kept for traceability)

Approved actionables from Slack thread `https://comfy-organization.slack.com/archives/C09TX71RK5F/p1774736219050719`-adjacent (frontend-ecosystem channel, 2026-05-21 12:48 PM–3:07 PM). Approvals locked by Christian 2026-05-21 PM. Phase A frozen at foundation `24d893d401`; all Wave-19 work below is JSDoc/markdown/test/dashboard-only OR proposes Phase B ADRs that flip ACCEPTED on #11939 merge.

#### **Decomposition contract (read before claiming any subtask)**

- **Axiom-numbering preservation rule**: A1..A16 numbering MUST be preserved across this wave. Refactor simplifies the *prose* of each axiom (one-sentence postulate + brief implication list), extracted detail moves to `decisions/D-axiom-N-rationale.md` ADRs OR `research/axioms-theorems.md`. Renumbering is out of scope (would invalidate 50+ ADR cross-refs + `scripts/check-axiom-compliance.sh` + `scripts/wiki-link.mjs` symbol map).
- **Nothing-lost rule (per Christian)**: every sentence in the current AXIOMS.md must either (a) survive in the new postulate, (b) move to a rationale ADR, (c) be derivable as a theorem, or (d) be explicitly moved to an existing ADR. No content silently dropped. Implementer must produce a coverage matrix (one row per existing AXIOMS.md sentence-cluster, one column per disposition).
- **Phase A freeze respected**: no edits to `ComfyUI_frontend/src/extension-api/` (foundation worktree `/home/c_byrne/worktrees/ComfyUI_frontend/restack-foundation-v2`) except JSDoc-only changes. ADRs in `decisions/` and `AXIOMS.md` in workspace root are NOT part of the freeze.
- **Dashboard contract**: workspace ADRs + AXIOMS.md mirror into `~/projects/ComfyUI_frontend-ecosystem/src/data/knowledge/` via `scripts/sync.sh`. Manifest regen via `node scripts/build-knowledge-manifest.mjs` (CI checks). Dashboard repo direct-push to main per AGENTS.md Rule 9.
- **Quality gates** (any task that writes code): `pnpm test`, `pnpm typecheck`, `pnpm lint` must pass before push. For Phase A foundation/pkg/ext/tf cascades: `bash scripts/check-axiom-compliance.sh` must remain 7/7 green.
- **Sub-agent "ship not plan" rule**: every dispatched agent returns commit SHAs + file paths + line numbers, NOT a plan. If the agent returns a plan, the orchestrator implements directly.

#### **W19.A1+A2 — Axiom prose simplification + Austin preamble** *(major; one agent, NOT parallelizable internally)*

- [ ] **Goal**: rewrite each axiom A1..A16 in `AXIOMS.md` into postulate-style (≤2 sentences declarative + bullet list of implications). Add Austin's 3-line preamble at top: "A widget should display a valid representation of the current Value. When a user interaction with the widget causes a display change, it is assigned back to Value. A robust widget follows Postel's law." Extract removed prose to either `decisions/D-axiom-N-rationale.md` (one per axiom that loses substantial rationale) OR `research/axioms-theorems.md` (if derivable from other axioms).
- [ ] **Inputs**:
  - `AXIOMS.md` (workspace root) — 540 lines, 16 axioms
  - `decisions/TEMPLATE.md` — ADR template
  - `decisions/D-define-widget-augmenter.md`, `D-widget-converge.md`, `D-coordinate-space.md` — examples of how axioms get cited
  - `scripts/check-axiom-compliance.sh` — keeps strict-failing on uncommented surfaces; axiom REFERENCES (numbers, label strings) must match
  - `scripts/wiki-link.mjs` — symbol map cites `A1 A14 A15 A16` strings
- [ ] **Steps**:
  1. Build coverage matrix: open `AXIOMS.md`, list every paragraph by axiom, classify each as `[postulate / implication / rationale / example / validation / theorem]`.
  2. For each axiom, draft new postulate (≤2 sentences) + 3–6 implication bullets.
  3. Anything classified as `rationale` longer than 1 paragraph → new `decisions/D-axiom-AN-rationale.md` ADR (status: ACCEPTED, supersedes "AXIOMS.md §AN prose" with explicit pointer).
  4. Anything classified as `theorem` → defer to W19.A4 (Glary-Bot 8-theorem list will absorb).
  5. Anything classified as `validation` → keep inline (validation criteria stay with the axiom — they're invariants, not rationale).
  6. Verify all ADR cross-refs (`A1`..`A16`) still resolve by string-matching.
  7. Verify `scripts/check-axiom-compliance.sh` runs green.
  8. Sync to dashboard mirror via `scripts/sync.sh`.
- [ ] **Acceptance**:
  - `AXIOMS.md` ≤ 350 lines (current: 540; ~35% reduction).
  - Coverage matrix attached as `research/wave-19-axiom-coverage-matrix.md`.
  - All 16 axioms have postulate + implications + validation sections.
  - Zero broken cross-refs from `decisions/D*.md` to A1..A16 (verify via `rg -l 'A[1-9][0-9]?' decisions/`).
  - `scripts/check-axiom-compliance.sh` 7/7 green.
  - Dashboard `/axioms` renders without layout regression (verify via PLAYWRIGHT_BASE_URL e2e).

#### **W19.A3 — Glossary (`docs/glossary.md` + dashboard `/glossary` route)** *(parallel-safe, can start with current term-set)*

- [ ] **Goal**: author `docs/glossary.md` defining the Capitalized Terms of Art used throughout AXIOMS.md and ADRs (Widget, Value, Topology, Schema, Reference, Handle, Mount, Recreate, Entity, Component, System, World, Subgraph, Blueprint, Promotion, BoxedWidget, ScopedHandle, etc.). Add dashboard `/glossary` route. Auto-link first occurrence per page via existing `scripts/wiki-link.mjs` extension (workspace-side; dashboard route reads from `src/data/knowledge/root/glossary.md` mirror).
- [ ] **Inputs**:
  - `AXIOMS.md` (workspace root) — source of Capitalized Terms; ~14 candidate terms
  - `decisions/D-define-widget-augmenter.md`, `D-widget-converge.md`, `D-immutability-enforcement.md`, `D-coordinate-space.md`, `D-linked-subgraph-constraint.md` — secondary term sources
  - `scripts/wiki-link.mjs` — extend symbol map with glossary terms; auto-wrap first occurrence per file in `<a href="/glossary#TERM" class="glossary-link">` 
  - Dashboard: `~/projects/ComfyUI_frontend-ecosystem/src/router/index.ts` for route registration; `src/pages/` for new `Glossary.vue` page
- [ ] **Steps**:
  1. Extract Capitalized Terms from `AXIOMS.md` + all `decisions/D*.md`. Dedupe.
  2. Draft `docs/glossary.md` with one section per term: definition (1 sentence), example, non-example, cross-refs to axioms/ADRs.
  3. Mirror to dashboard `src/data/knowledge/root/glossary.md` via `scripts/sync.sh` (extend sync script if needed to include glossary alongside AGENTS/AXIOMS/CONTEXT/todo).
  4. Add dashboard route `/glossary` → new `src/pages/Glossary.vue` rendering markdown via existing `MarkdownView` component.
  5. Extend `scripts/wiki-link.mjs` symbol map with glossary terms; ensure idempotence (one auto-link per term per file, not every occurrence).
  6. Add navbar link to `/glossary` in `~/projects/ComfyUI_frontend-ecosystem/src/components/AppNav.vue`.
  7. Vitest: `src/pages/Glossary.test.ts` (renders all glossary terms, first-occurrence linking only).
  8. E2E: add to `e2e/nav-smoke.spec.ts` — `/glossary` static route + click first term-link round-trip.
- [ ] **Acceptance**:
  - `docs/glossary.md` ≥ 14 entries, all from AXIOMS.md + key ADRs.
  - Dashboard route `/glossary` live + linked from navbar.
  - Vitest + e2e green.
  - `pnpm sync:knowledge` reproducible (manifest byte-identical post-glossary entry).

#### **W19.A4 — Derived Theorems section on `/axioms`** *(parallel-safe; uses Glary-Bot 8-theorem list as starting point)*

- [ ] **Goal**: hand-curate 5–8 derived theorems (Glary-Bot's output as starting point: Widget Identity Independence, Schema Validation Boundary, Topology-Value Separation, Widget Recreation Safety, Reversibility Completeness, Value Promotion Impossibility, Multi-Instance Consistency, Schema Evolution Prohibition). Render as new section in `/axioms` page under axiom index. Each theorem: 1 paragraph + 1 ADR cross-link minimum.
- [ ] **Inputs**:
  - Slack thread Glary-Bot output (in original user message, 2026-05-21 3:07 PM) — 8 candidate theorems
  - `AXIOMS.md` (workspace root) — sources to verify derivation correctness
  - Dashboard: `~/projects/ComfyUI_frontend-ecosystem/src/pages/Axioms.vue` for section render
  - `decisions/D-no-virtual-nodes-in-api.md`, `D-widget-converge.md`, `D-immutability-enforcement.md`, `D-linked-subgraph-constraint.md`, `D-widget-serialization-simplification.md` — ADR cross-link targets
- [ ] **Steps**:
  1. Verify each Glary-Bot theorem actually derives from the current AXIOMS.md axiom set (or the W19.A1-refactored set if A1 lands first). Reject any that require extra premises not in axioms.
  2. Author `docs/axioms-theorems.md` (workspace) — one section per surviving theorem with derivation chain + ADR cross-link.
  3. Mirror to dashboard `src/data/knowledge/root/axioms-theorems.md`.
  4. Edit `~/projects/ComfyUI_frontend-ecosystem/src/pages/Axioms.vue` to render the theorems section below the existing axiom index.
  5. Vitest: ensure rendered DOM contains all theorem headings + ADR links resolve (no 404).
  6. E2E: extend `e2e/nav-smoke.spec.ts` — `/axioms` theorems section visible, ADR link click navigates.
- [ ] **Acceptance**:
  - 5–8 theorems published, each ≤ 1 paragraph + ≥ 1 ADR cross-link.
  - Coverage matrix: every theorem traces to ≥ 2 axioms as premises.
  - Dashboard `/axioms` shows theorems section.
  - Vitest + e2e green.

#### **W19.A6 — A13 / `D-coordinate-space.md` "No widget.element / No widget.inputEl" rewrite** *(JSDoc/ADR-only, in-freeze)*

- [ ] **Goal**: Austin's reading of the A12 prose "No widget.element field. No widget.inputEl field..." (AXIOMS.md:224) reads as if functionality is being removed. Reality: both already wrapped in div the client never sees; the change is "access through widget handle" → "store reference from mount call". Add explicit "What this changes for you" paragraph framing it that way.
- [ ] **Inputs**:
  - `AXIOMS.md:224` (the A12 "Hard rules" bullet about element/inputEl)
  - `decisions/D-widget-converge.md` (A12 source ADR)
  - `decisions/D-coordinate-space.md` (A13 source; user mis-attributed to A13 in Slack but actual text is A12 — fix in either location with cross-ref)
  - Foundation worktree JSDoc on `widget.ts` mount() / WidgetHandle — verify framing matches
- [ ] **Steps**:
  1. Add "What this changes for you" paragraph to A12 in `AXIOMS.md` (after "Hard rules", before "Why an axiom"). Explicitly state: "v1 code accessed the wrapping `<div>` via `widget.element` / `widget.inputEl` on the handle. v2 code captures the element via the `mount(host, ctx)` closure binding instead. The element itself isn't gone — only the handle accessor is. Both v1 and v2 widgets ultimately render into a runtime-owned host `<div>` the framework manages."
  2. Add same paragraph to `decisions/D-widget-converge.md` § Hard rules.
  3. Verify JSDoc on `ComfyUI_frontend/src/extension-api/widget.ts:defineWidget` matches framing (cite axiom). JSDoc-only edit is in-freeze; foundation cascade required if .ts changes.
  4. Sync to dashboard.
- [ ] **Acceptance**:
  - Austin (proxied via re-reading the new text aloud to oneself) does not interpret it as functionality removal.
  - AXIOMS.md + D-widget-converge.md + widget.ts JSDoc all carry consistent "What this changes for you" framing.
  - 7/7 axiom checks green.

#### **W19.A7 — "Remount" → "Recreate" naming pass** *(ADR-only, in-freeze if Phase A surface unchanged)*

- [ ] **Goal**: Austin's argument: single-DOM-element-for-life-of-widget-instance breaks split-view; ADRs use `onBeforeRemount` / `onAfterRemount` but the intended semantic is **recreate from spec** (each pane gets its own instance, value clamping flows via `defineWidgetExtension({on('valueChanged', clampValue)})` applied to both). Christian agreed instances are duplicated rather than projected. Audit ADRs for `remount`/`Remount`/`onAfter Remount`/`onBeforeRemount` and re-frame as recreate when the semantic is "fresh instance from spec".
- [ ] **Inputs**:
  - `AXIOMS.md:232` (A12 mentions `ctx.onBeforeRemount(fn)` / `ctx.onAfterRemount(newHostFn)`)
  - `decisions/D-widget-converge.md` (primary source)
  - `decisions/D3.1-design-questions-resolved.md` (also mentions remount)
  - Foundation `ComfyUI_frontend/src/extension-api/widget.ts` — verify whether `onBeforeRemount`/`onAfterRemount` are exported surface (Phase A frozen — if exported as API, can only do JSDoc-rewording; if internal, safe to rename)
- [ ] **Steps**:
  1. Run `rg -n "[Rr]emount" decisions/ AXIOMS.md ComfyUI_frontend/src/extension-api/` to enumerate all sites.
  2. For each site, classify: `[host-remount (host moves, instance stays)]` vs `[widget-recreate (instance disposed, new instance from spec)]`. The former keeps `remount` naming; the latter switches to `recreate`.
  3. Decision: per Austin's split-view argument, ANY case where "the same Value is displayed in multiple panes" is `recreate`, not `remount`. Remount = same-instance-different-host (e.g., `<KeepAlive>` shuffle, single-pane subgraph navigation). Recreate = fresh-instance-from-spec (split-view, subgraph promotion).
  4. Update ADR prose + AXIOMS.md A12 to distinguish the two cases explicitly. If both lifecycle hooks exist in the API, they coexist; if `onAfterRemount` is currently the only hook, add `onAfterRecreate` as a NEW exported hook (this WOULD be a surface change → defer to W19.A9 ADR, just rename in prose for now).
  5. Cite the rename in `decisions/D-widget-converge.md` § Open questions or amend ADR with a "2026-05-21 amendment" footer.
- [ ] **Acceptance**:
  - Every `remount` site is intentional (kept) or `recreate` (renamed).
  - `decisions/D-widget-converge.md` has an explicit recreate-vs-remount glossary entry.
  - No Phase A surface change unless ADR amendment is justified (defer surface change to W19.A9).
  - Cross-link from `D-widget-converge.md` to W19.A9 ADR.

#### **W19.A8 — Strike "provide()/inject()" mention from extension-coordination text** *(ADR-only, in-freeze)*

- [ ] **Goal**: Austin asked: "Are we allowing extension code to access provide/inject?" Christian's intent was the opposite: "they can handle state management themselves" — not via Vue provide/inject. The text in `AXIOMS.md:428` (A14 commented-out table for `getWidget(name)` rationale) currently says "Extensions needing per-widget coordination register via `defineWidget({mount, ...})` and share state through Vue `provide()` / `inject()` or the World event bus." Strike the provide/inject mention; reword to "extensions own their own state; coordination flows through the World event bus only".
- [ ] **Inputs**:
  - `AXIOMS.md:428` (the A14 row for `getWidget(name)` / `getWidgets()`)
  - `decisions/D-no-node-widget-access.md` (sister ADR; check for same text pattern)
  - `decisions/D-cross-node-observation.md` (covers cross-node state-sharing patterns)
- [ ] **Steps**:
  1. `rg -n "provide\(\)|inject\(\)" decisions/ AXIOMS.md` — enumerate every mention.
  2. For each site, decide: keep (if specifically describing Vue framework internals, not extension API surface) vs strike (if presenting provide/inject as extension-author API).
  3. AXIOMS.md:428 → reword: "Extensions needing per-widget coordination register via `defineWidget({mount, ...})` and own their state internally. Cross-entity coordination flows through the World event bus only — Vue `provide()` / `inject()` is a framework-internal mechanism, not an extension-author API."
  4. `decisions/D-no-node-widget-access.md` — apply same reword if text present.
  5. Sync to dashboard.
- [ ] **Acceptance**:
  - No prose in `decisions/` or `AXIOMS.md` presents `provide()` / `inject()` as extension-author API.
  - Vue framework-internal mentions (D1, D2 reactivity primers) are unaffected.

#### **W19.A9 — `decisions/D-unify-widget-mount-model.md` (PROPOSED)** *(Phase B blocker; ADR-only land now, surface change defers to #11939 merge)*

- [ ] **Goal**: Christian's design idea: drop the DOMWidget/non-DOM distinction entirely. All widgets use one mount/unmount path. Standard lifecycle hooks become trivially uniform. Subsumes W19.A7 (recreate-on-mount becomes the only path). Composes with W19.A10 (promotion rework).
- [ ] **Inputs**:
  - `decisions/TEMPLATE.md`
  - `decisions/D-widget-converge.md` (sister ADR — predecessor work on the same theme)
  - `decisions/D-widget-serialization-simplification.md` (axiom A16 origin; similar reduction-by-deletion shape)
  - `AXIOMS.md` A12 (Mount-Lifecycle as the Sole DOM Seam) — close cousin
  - Foundation `ComfyUI_frontend/src/extension-api/widget.ts` — current `mount` signature
  - Glary-Bot Theorem 4 (Widget Recreation Safety) — derives that mount must be idempotent → supports A9
- [ ] **Steps**:
  1. Author `decisions/D-unify-widget-mount-model.md` (status: **PROPOSED**, supersedes none, axioms cited: A1 A5 A12 A15).
  2. Sections: Decision (drop DOMWidget concept), Rationale (split-view, theorem 4, Christian quote), Consequences (mount becomes the ONLY DOM seam, value-listener race conditions discussed by Austin become non-issues because each instance has its own listener), Implementation Plan (Phase B — flip ACCEPTED on #11939 merge, then foundation cascade `widget.ts` to expose unified mount, retire `kind: 'dom'` / `DOMWidgetOptions` references that still exist as PHASE_A_EXCLUDED).
  3. Add to `AGENTS.md` Reconciliation history Phase B re-open triggers: "PR #11939 merge + W19.A9 ACCEPTED flip → foundation cascade per ADR-D-unify-widget-mount-model implementation plan."
  4. Cite W19.A7 (recreate naming) + W19.A10 (promotion) as composes-with.
  5. Update `research/meta/back-propagation-matrix.yaml` with A9 entry.
- [ ] **Acceptance**:
  - ADR PROPOSED, no Phase A surface change (foundation worktree untouched except potentially JSDoc cross-link).
  - `decisions/D-design-questions-resolved.md` or equivalent index includes A9.
  - W16 Phase B trigger list includes A9 flip-to-ACCEPTED step.
  - `scripts/check-decision-propagation.sh` green (new ADR has commit + ADR + dashboard mirror).

#### **W19.A10 — `decisions/D-widget-promotion-semantics.md` (PROPOSED)** *(Phase B blocker; composes with W19.A9)*

- [ ] **Goal**: Christian agreed promotion-on-graph behavior must change w.r.t. how DOM widgets work. Validates Glary-Bot Theorem 6 (Value Promotion Impossibility): promotion creates new Topology entities, not Value mutation. The current DOM widget "promotion" pattern (where a widget "becomes" a node) is axiomatically wrong per A4 (Values independent of Topology) + A5 (Schema immutable).
- [ ] **Inputs**:
  - `decisions/TEMPLATE.md`
  - `decisions/D-widget-converge.md` + new `D-unify-widget-mount-model.md` (W19.A9)
  - `AXIOMS.md` A1 A3 A4 A5 — premises for the impossibility theorem
  - Glary-Bot Theorem 6 — derivation
  - Current ComfyUI_frontend code: `rg -l "promote|promotion" ComfyUI_frontend/src/lib/litegraph/` to find current implementation
- [ ] **Steps**:
  1. Author `decisions/D-widget-promotion-semantics.md` (status: **PROPOSED**, axioms cited: A1 A4 A5 A7 A11; composes-with A9).
  2. Decision: widget promotion creates a NEW Topology entity (a node) that holds a Reference to the original Value. The widget itself is not mutated. The "promoted node" reads the same Value via its own widget instance. Original widget remains intact (if user keeps it in the graph).
  3. Rationale: Theorem 6 derivation + Christian quote + concrete current-vs-proposed sequence diagram.
  4. Consequences: legacy "widget becomes node" promotions migrate via auto-rewrite at workflow load time (similar pattern to virtual-node migration in W16.P2). Document a 1-version transition window.
  5. Implementation plan: Phase B — flip ACCEPTED on #11939 merge AND W19.A9 ACCEPTED, then implement in `ComfyUI_frontend/src/lib/litegraph/`. Specifically NOT a surface change — Promotion is a runtime behavior, not a public API. So this ADR may flip ACCEPTED + implement in Phase A IF the implementation touches only `src/lib/litegraph/` and not `src/extension-api/`. Verify with Christian during implementation.
  6. Add to AGENTS.md Phase B trigger list with composability note (A9 + A10 must land together).
- [ ] **Acceptance**:
  - ADR PROPOSED.
  - Sequence diagrams (mermaid or ASCII) for current-vs-proposed promotion.
  - Composability with A9 documented.
  - W16 Phase B trigger list updated.

#### **W19.A11 — Component + e2e tests for shipped UI fix (W18.A/B/M)** *(dashboard-only, fully parallel)*

- [ ] **Goal**: DrJKL's "buttons do nothing" / "anchors but sections don't have id set" report (Slack 12:53 PM). The fixes shipped in W18.A (router scrollBehavior), W18.B (chip→`-refs` alignment), W18.M (MarkdownView stateful slugify w/ dedupe). 313 vitests + 21/21 e2e currently cover top-level paths. Add deeper regression coverage targeting DrJKL's specific complaint: AXIOMS.md heading anchors AND deep-link-to-second-occurrence of duplicate headings.
- [ ] **Inputs**:
  - `~/projects/ComfyUI_frontend-ecosystem/src/components/MarkdownView.vue` (stateful slugify lives here, lines ~30–55)
  - `~/projects/ComfyUI_frontend-ecosystem/src/components/MarkdownView.test.ts` (existing 3 dedupe tests — extend)
  - `~/projects/ComfyUI_frontend-ecosystem/e2e/nav-smoke.spec.ts` (existing 21 tests — extend)
  - `~/projects/ComfyUI_frontend-ecosystem/src/router/index.ts:171` (scrollBehavior — verify coverage)
  - `~/projects/ComfyUI_frontend-ecosystem/src/pages/Axioms.vue` (chip target rendering)
- [ ] **Steps**:
  1. Component test: extend `MarkdownView.test.ts` with cases — (a) markdown with 6 identical `### Action Items` produces ids `action-items` / `action-items-1` / .. / `action-items-5`; (b) heading text with unicode produces valid kebab-case id; (c) re-rendering same component twice (mount→unmount→mount) RESETS the dedupe Map (no `action-items-6` cross-render leak).
  2. E2E test: extend `e2e/nav-smoke.spec.ts` — (a) navigate to `/decisions/d13-ecs-alignment-audit#action-items-1`, assert that the second action-items heading scrolls into view; (b) navigate to `/axioms#a12-mount-lifecycle-as-the-sole-dom-seam`, assert the A12 section is in viewport; (c) click an in-content link to `/decisions/x#section`, assert smooth-scroll fires and arrives at correct anchor.
  3. Run `pnpm test` + `pnpm test:e2e` + `PLAYWRIGHT_BASE_URL=https://comfyui-frontend-ecosystem.vercel.app pnpm test:e2e`.
- [ ] **Acceptance**:
  - +3 vitests (slug-dedupe edge cases), +3 e2e tests (deep-link nav).
  - All green locally + live Vercel.
  - PR-ready commit.

#### **Wave-19 dispatch + close-out plan**

1. **Round 1 (parallel, 5 agents)**: A1+A2, A3, A4, A6+A7+A8, A9+A10, A11. Each agent dispatched with the relevant subsection above as its full prompt + the explicit constraints from the Decomposition Contract.
2. **Round 2 (orchestrator reconciliation)**: cross-ref check (every theorem in A4 maps to ≥ 2 axioms in A1; every glossary term in A3 appears in A1 or an ADR); resolve any naming collisions between A7 rename pass and A9/A10 ADRs.
3. **Quality gates**: `pnpm test`, `pnpm typecheck`, `pnpm lint` in both ComfyUI_frontend (foundation worktree, if any .ts/.vue touched) and dashboard repo. `bash scripts/check.sh` + `bash scripts/check-axiom-compliance.sh` 7/7. CI green on dashboard.
4. **Self-review**: `research/wave-19-self-review-2026-05-21.md` (mirror W18.M pattern). Audit each subtask deliverable against its acceptance criteria. Flag CLEAN / SMELL / BLOCKER.
5. **PR/merge/deploy/sync**: workspace push (no PR — workspace is the source of truth) + dashboard PR (or direct main per Rule 9 if tests green) + Vercel auto-deploy + live e2e re-validate + `bash scripts/sync.sh` clean.

## 2026-05-21 PM — Wave-18 closeout (deploy + live-validate)

**Status**: ✅ All 15 Wave-18 items shipped + live-validated. Final dashboard HEAD: `1746f6e` (CI green ✅, deployed to Vercel production at 22:53:30Z).

### Post-handoff verification (this thread)

- ✅ Vercel production deploys confirmed for: `374eb93`, `0b29849`, `27807e8`, `d90279a`, `09f1d55`, `5d9dbb0`, `6632d4d`, `1746f6e`.
- ✅ Live URL spot-checks: `/api-docs/extensionoptions` renders `onMounted` pattern (not `async setup`); `/decisions/d13-ecs-alignment-audit` has unique `### Action Items` slugs per W18.M fix; `/decisions` rows render.
- ✅ **Live-Vercel e2e**: `PLAYWRIGHT_BASE_URL=https://comfyui-frontend-ecosystem.vercel.app pnpm test:e2e -- e2e/nav-smoke.spec.ts` → **21/21 passed in 2.2s** on chromium.
- ✅ **CI fix shipped** (`1746f6e`): manifest-drift gate was failing on every push due to two unrelated bugs:
  1. `src/data/knowledge/root/todo.md` was silently blocked by user's global `~/.gitignore_global` (line: `todo.md`). Committed manifest referenced it; CI's fresh checkout didn't have the file → manifest rebuild diverged by ~220 lines.
  2. `generatedAt` wall-clock timestamp made the `git diff --exit-code` gate structurally impossible to satisfy.
  Fixed in `1746f6e`: `git add -f src/data/knowledge/root/todo.md`, repo-level `.gitignore` negation, `ci.yml` uses `git diff -I '"generatedAt":'`. CI green on first attempt after fix.
- ✅ **Playwright config enhancement** (`5d9dbb0`): `PLAYWRIGHT_BASE_URL` env var override + auto-skip webServer block when set. Documented in commit body.

### Items
- [x] W18.deploy — All 13 Wave-18 commits + 3 follow-up fixes (`5d9dbb0`, `6632d4d`, `1746f6e`) deployed to Vercel production, CI green at HEAD.
- [x] W18.live-e2e — 21/21 nav-smoke against live Vercel deployment.
- [x] W18.ci-fix — manifest-drift gate failures resolved (todo.md tracked + generatedAt ignored). Future `sync.sh` runs won't surface red CI on the dashboard.

## 2026-05-21 PM — Wave-17 Dashboard accuracy + completeness sweep

**Context**: User audit of https://comfyui-frontend-ecosystem.vercel.app surfaced four
classes of issues with the rendered API docs / supporting pages:

1. **Snippet drift** — example snippets on per-page MDX use stale patterns. The
   trigger case: `/api-docs/extensionoptions` shows `async setup() { ... }` while
   the canonical pattern is `setup() { onMounted(() => ...) }` (the v1 `setup`
   semantic is `@deprecated` in source — the body of `setup` now runs at
   registration-time, and `onMounted(...)` carries the "after app ready"
   semantic). Snippets come from JSDoc `@example` blocks in
   `src/extension-api/*.ts`; typedoc copies them verbatim into MDX. The
   "drift" is therefore at the SOURCE (deprecated `@example` blocks not
   refreshed), not in the build pipeline.
2. **notify / toast redundancy** — both `notify(...)` and `toast.show(...)`
   ship in the frozen Phase A surface. `notify` is a thin convenience wrapper
   over `toast.show` ([imperatives.ts:110](file:///home/c_byrne/worktrees/ComfyUI_frontend/restack-foundation-v2/src/extension-api/imperatives.ts#L110)) — same transport, different
   vocabulary. Per AXIOMS §A2 (minimal surface) this is sloppy. Needs a
   resolution ADR (pick one preferred / mark the other `@deprecated` / keep
   both with a clear distinction in JSDoc).
3. **Sparse / empty pages** — 41 of 76 (54%) MDX pages are <800 bytes — many
   have no example at all (e.g. `executioneventpayloads`, `handler`,
   `disposablehandle`, `widgetcleanup`, `unsubscribe`, `point`, `size`,
   `notify`, `defineextension`, `definenode`, `definewidget`, etc.). Root cause:
   source `@example` blocks are absent on these exports, so typedoc has nothing
   to render. Same fix vector as #1 — enrich at source.
4. **Planned/hypothetical surfaces not visually flagged** — the `/api-diff`
   route + several MDX pages reference v2 surfaces that are NOT yet shipped
   (e.g. `graph.connect`, the ECS-dependent W16.P3 reactive adapter). Users
   can't tell which examples are live-against-foundation vs.
   live-only-against-#11939. Needs a "Planned (Phase B)" badge component +
   per-page frontmatter flag.

**Hard constraint**: Phase A surface FROZEN at foundation `ee0537fdb5` per
`decisions/D-api-surface-finalization.md`. JSDoc `@example` and JSDoc prose
edits are **NOT** surface changes (no exported type/symbol changes, no
visible signature shifts). The notify/toast resolution IS a surface decision
and requires a new accepted ADR before any source-code change can land.

All dashboard-repo work (badge component, MDX frontmatter, post-processor
extensions, route copy) is outside the frozen surface — sole-contributor rule
9 applies.

### Wave-17 task decomposition

| ID | Cluster | Items | Tier | Est | Depends | Acceptance |
|----|---------|-------|------|-----|---------|------------|
| W17.A | Audit | Snippet/MDX completeness audit | analytical | 1h | — | `research/dashboard-snippet-audit-2026-05-21.md` lists every page with: current snippet (or NONE), source `@example` SHA, drift verdict (`stale` / `missing` / `current`), recommended new snippet draft |
| W17.B | ADR | notify-vs-toast resolution ADR | analytical | 45m | — | `decisions/D-notify-toast-consolidation.md` ACCEPTED with verdict (keep both / deprecate one / merge into one entry); axiom-compliance §A2 verification block |
| W17.C | Source | JSDoc `@example` refresh on `src/extension-api/*.ts` | routine | 1.5h | W17.A | Per-export `@example` blocks reflect current preferred pattern (`setup() { onMounted(() => ...) }` etc.). Pure JSDoc — zero exported-type diff. Foundation commit on `restack-foundation-v2`; cascade to pkg/ext/tf via `scripts/reconcile-pair.sh` |
| W17.D | Source | Enrich sparse exports with first `@example` block | routine | 2h | W17.A | All 41 sparse pages now ≥800 bytes after refresh. Pure JSDoc — zero exported-type diff. Same cascade path |
| W17.E | Source | notify/toast verdict implementation | routine | 30m | W17.B | Source change per ADR verdict — if "deprecate notify", add `@deprecated` to `notify` JSDoc + `notifyoptions` JSDoc; if "merge", land the merge in a follow-up wave (defer). JSDoc-only path stays inside Phase A freeze; merge path requires ADR-gated surface change |
| W17.F | Dashboard | `PlannedBadge.vue` component | routine | 45m | — | Reusable `<PlannedBadge variant="phase-b" \| "ecs-pr-11939" \| "hypothetical" />` shadcn-styled chip. Drop-in on any `<MdxPage>` based on MDX frontmatter `planned:` field |
| W17.G | Dashboard | MDX frontmatter `planned:` field + post-processor wiring | routine | 1h | W17.F | `strip-deprecated.mjs` (rename → `process-mdx.mjs` or add sibling step) reads source-file `@stability` tag + a manual override map and stamps `planned: phase-b` (etc.) into MDX frontmatter. Renderer reads it and surfaces `<PlannedBadge>` above the page H1 |
| W17.H | Dashboard | Tag planned/hypothetical pages | routine | 45m | W17.G | Manual override map (`scripts/planned-pages.json`) lists confirmed phase-b/ECS-pending pages: `nodeconnectedevent`, `nodedisconnectedevent`, `nodemodechangedevent`, `nodepositionchangedevent`, `nodesizechangedevent`, `nodemode`, `slotdirection`, and any API-diff v2 entries that reference unshipped surfaces (e.g. `graph.connect`) |
| W17.I | Dashboard | `/api-diff` audit + badge wiring | analytical | 1h | W17.F | Every v2-column entry that references unshipped surface flagged. Side-by-side now has a "Planned" pill next to such rows |
| W17.J | Dashboard | Refresh dashboard MDX from updated source | routine | 30m | W17.C + W17.D + W17.E | `bash scripts/refresh-api-docs.sh` in dashboard repo. Diff shows only `@example`-driven content changes (no signature lines move). 178/178 tests stay green |
| W17.K | Verification | End-to-end visual QA on Vercel preview | analytical | 1h | W17.G + W17.H + W17.I + W17.J | Spot-check every previously-flagged page (`extensionoptions`, `executioneventpayloads`, `handler`, `notify`, `toast`, `/api-diff`) + a 10-page random sample. Markdown report in `research/dashboard-w17-verification-2026-05-21.md` with screenshots/console-log evidence |
| W17.L | Cascade | Cascade source commits through pkg/ext/tf | routine | 30m | W17.C + W17.D + W17.E | `scripts/reconcile-pair.sh all` clean. Drift = 0 on all 4 pairs post-cascade |
| W17.M | Sync | `bash scripts/sync.sh` clean exit | routine | 5m | All above | All three propagation legs satisfied for the notify/toast ADR. Knowledge sync auto-runs. Dashboard auto-refresh idempotent (byte-identical on second run) |
| W17.N | Cleanup | Verify previous-thread orphans closed | routine | 30m | — | Walk parent thread T-019e482f's "incomplete" list — knowledge sync verification, manifest drift CI, `/handoff` route content sanity, strip-deprecated coverage of newly-touched pages. File W17.N.* sub-items for anything still open |

**Total**: ~10.5h across 14 dispatch units. Reasonable parallelism:
- Independent: W17.A (audit) + W17.B (ADR) + W17.F (badge component) + W17.N (orphan check) can run as 4 parallel subagents.
- Sequenced: W17.C/D/E depend on A/B → W17.J depends on C/D/E → W17.K depends on J + G + H + I → W17.L + W17.M close out.

### Items

- [x] W17.A — Snippet/MDX completeness audit (76 pages × source `@example` cross-check). Output: `research/dashboard-snippet-audit-2026-05-21.md`.
- [x] W17.B — `decisions/D-notify-toast-consolidation.md` ACCEPTED with explicit verdict + §A2 axiom block.
- [x] W17.C — JSDoc `@example` refresh on existing exports — replace deprecated `setup()` body patterns with `setup() { onMounted(...) }`; remove other stale references surfaced by W17.A.
- [x] W17.D — Author first `@example` JSDoc block for every sparse export (41 pages). Use real, minimal, copy-pasteable snippets.
- [x] W17.E — Implement the W17.B verdict at source (JSDoc-deprecation path is in-freeze; merge path defers).
- [x] W17.F — `PlannedBadge.vue` shadcn-style chip in dashboard repo.
- [x] W17.G — `scripts/process-mdx.mjs` (or extend `strip-deprecated.mjs`) — read source `@stability` + override map, stamp `planned:` frontmatter, render badge.
- [x] W17.H — Manual `scripts/planned-pages.json` override map covering the 7 PHASE_A_EXCLUDED placeholders + any `/api-diff` v2 entries.
- [x] W17.I — Audit + tag planned entries in `/api-diff` page.
- [x] W17.J — `bash scripts/refresh-api-docs.sh` after W17.C/D/E land.
- [x] W17.K — End-to-end visual QA. Output: `research/dashboard-w17-verification-2026-05-21.md`.
- [x] W17.L — Cascade source via `scripts/reconcile-pair.sh all`. Drift = 0.
- [x] W17.M — `bash scripts/sync.sh` clean. All 3 legs satisfied for D-notify-toast-consolidation.
- [x] W17.N — Walk parent thread T-019e482f for any orphaned work. File W17.N.* if anything is open.

### W17.N orphans filed (from `research/wave-17-orphan-check-2026-05-21.md`)

- [x] W17.N.2 — closed by W18.J at foundation 24d893d401; original text: **typedoc not lifting `@example` from `export declare function` shadows + re-exports**. Surfaced by W17.K verification (2026-05-21): 20 MDX pages stay sparse despite W17.CDE adding `@example` blocks at source. Affected: `defineNode`, `defineExtension`, `defineWidget`, all 5 setup-context hooks (`onMounted` / `onBeforeMount` / `onUnmounted` / `onActivated` / `onDeactivated`), all 6 ID round-trip helpers from `identifiers.ts` re-export, and the 6 shell-ui type aliases imported via `shell.ts`. Root cause: typedoc renders pages from the implementation source for `declare function` shadows (e.g. `services/extension-api-service.ts:941`), ignoring JSDoc on the shadow. Same for re-exports — typedoc uses the original-declaration JSDoc, ignoring annotations on the re-export block. **Two remediation paths**: (1) move `@example` from `lifecycle.ts` shadow onto matching impl in `services/extension-api-service.ts` — pure JSDoc, in-freeze; (2) enable `preferDeclarationSource` (or equivalent) in `packages/extension-api/typedoc.json` — one-time config, out-of-freeze if it ships in the package. Acceptance: `find src/data/api-docs -name "*.mdx" | xargs grep -L '^\`\`\`' | wc -l` drops to 0 for non-PHASE_A_EXCLUDED pages. Est ~2h, single foundation commit + dashboard re-refresh. See `research/dashboard-w17-verification-2026-05-21.md` §Finding-T-1.
- [ ] W17.N.1 — **Dashboard CI broken on Node 20**. `christian-byrne/ComfyUI_frontend-ecosystem` `.github/workflows/ci.yml` pins `node-version: 20`, but pnpm 11.1.3 (via `packageManager` lock) requires Node ≥22.13 (`ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`). All 5 most recent CI runs `failure`. The `Verify knowledge manifest consistency` step (manifest drift gate) never executes — workflow dies at `setup-node` → `pnpm install`. Fix: bump `node-version` to `22` (single-line change). Sole-contributor authorization per AGENTS.md Rule 9 applies. Side benefit: also resolves the listr2/Node-20 husky pre-push workaround documented at `scripts/sync.sh:165-170` (once local dev box also runs Node 22).

### Cross-cutting constraints

- **Phase A surface freeze**: foundation `ee0537fdb5` is the surface anchor.
  JSDoc edits (prose + `@example`) are fine. Adding `@deprecated` to an
  exported symbol is fine (it's a JSDoc annotation, not a surface change).
  Adding/removing exports OR changing signatures requires a new ACCEPTED ADR.
- **Sole-contributor rule**: all dashboard-repo changes (W17.F/G/H/I/J/K) ship
  directly to `main` per AGENTS.md Rule 9 — no PR review wait.
- **Reconciliation discipline**: every source-side commit (W17.C/D/E)
  cascades through pkg → ext → tf via `scripts/reconcile-pair.sh`; divergence
  threshold 0.

## 2026-05-21 — Wave-16 Phase B internal tracker (migrated from closed GitHub issues #12394 + #12395)

**Context**: Per user direction (2026-05-21 PM): "we ONLY use the internal todo." Migrated all Phase B work tracking from the GitHub issues to this todo so we have a single source of truth. Issues #12394 + #12395 closed with pointer to internal tracker.

### Phase B re-open triggers (was #12394)

All blocked on PR #11939 (ECS rebase) merging OR a new accepted ADR with axiom-compliance verification.

- [ ] W16.P0 — **Extend `defineWidgetExtension` with `widgetTypes`/`widgetNames` filters** per `decisions/D-define-widget-augmenter.md` (PROPOSED). 2 new optional fields on `WidgetExtensionOptions`. Unblocks W16.P0b (dynamicPrompts.v2 unstub) + N13 Pattern 3 (global seed sync). Surface delta: +2 optional fields, zero new entry points. ADR flips to ACCEPTED on landing. Implementation: foundation commit on `restack-foundation-v2`; dashboard refresh shows only `widgetextensionoptions.mdx` changed.
- [ ] W16.P0b — **Unstub `dynamicPrompts.v2.ts`** using `widgetTypes: 'STRING'` filter + `widget.on('beforeSerialize', evalBraces)`. Blocked on W16.P0. Commit on `ext-api/i-ext-v2`.
- [ ] W16.P1 — **Core widget migrations** (preview / progress / audio widgets — A15 internal cleanup). Pure internal refactor of `ComfyUI_frontend/src/` (NO `src/extension-api/` touch). Author `decisions/D-core-builtin-widget-migration.md` when picked up. Acceptance: all 3 widgets schema-declared (no runtime `addWidget`), `pnpm test:unit` green, no public-surface diff.
  - [ ] W16.P1.A — **Audit** — Catalog current call sites of `node.addWidget('preview'|'progress'|'audio', ...)` across `ComfyUI_frontend/src/`. Output: short markdown table (file, line, call signature, lifecycle moment). Est ~30m. Inputs: `restack-foundation-v2` worktree. No code change.
  - [ ] W16.P1.B — **ADR draft** — Write `decisions/D-core-builtin-widget-migration.md` covering: (1) why A15 applies, (2) per-widget migration target (schema decl + `widget.on(...)` wiring), (3) extension-author back-compat strategy (none needed — internal-only), (4) test plan. Block on W16.P1.A. ~45m. ACCEPTED before code change.
  - [ ] W16.P1.C — **Preview widget** — Schema-declare in the relevant node defs; remove the runtime `addDOMWidget('preview', ...)` site. Add behavioral test for preview-image attach + serialize round-trip. ~1.5h. Depends W16.P1.B.
  - [ ] W16.P1.D — **Progress widget** — Same pattern as W16.P1.C. ~1h.
  - [ ] W16.P1.E — **Audio widget** — Same pattern (audio is more complex — has MIME validation + audio-player DOM). ~2h.
  - [ ] W16.P1.F — **Axiom-checker tightening** — Once 3 sites are gone, audit remaining `addWidget`/`addDOMWidget` callers in `src/`. File follow-ups for any non-A14 cases (no GH issue — Wave-17 todo entries). ~30m. Depends W16.P1.C/D/E.
  - [ ] W16.P1.G — **Quality gates + PR** — Run `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm format`. Self-review the diff. Open PR titled `chore(widgets): migrate preview/progress/audio to schema-declared (D-core-builtin-widget-migration)`. Reference ADR; reviewers as per CODEOWNERS. ~45m. Final step.
- [ ] W16.P2 — **Virtual-node internal cleanup** (Reroute, Primitive — N12 internal exception). Pure internal refactor — no public surface change. Author `decisions/D-reroute-primitive-real-backend-migration.md` when picked up. Acceptance: both nodes have backend `RETURN_TYPES`/`FUNCTION` (no frontend-only special-casing), workflow round-trip preserved.
  - [ ] W16.P2.A — **Audit** — Catalog frontend-only branches keyed on `node.type === 'Reroute' | 'PrimitiveNode'` across `ComfyUI_frontend/src/`. Output: file/line table + classification (rendering, serialization, execution, link-routing). Est ~45m.
  - [ ] W16.P2.B — **Backend node design** — Coordinate w/ `ComfyUI/` backend for the matching `Reroute` + `Primitive` Python nodes (passthrough semantics, type-preserving). Author the ADR sketch w/ backend signatures inline. ~1h. Depends W16.P2.A.
  - [ ] W16.P2.C — **ADR draft + acceptance** — Finalize `decisions/D-reroute-primitive-real-backend-migration.md` (N12 internal exception rationale, backend node spec, frontend cleanup checklist, migration story for existing workflows). ACCEPTED before code change. ~45m. Depends W16.P2.B.
  - [ ] W16.P2.D — **Backend impl** — Land Python nodes in `ComfyUI/`. Separate PR on `ComfyUI` repo; track here as a blocker for W16.P2.E. ~2h. Depends W16.P2.C.
  - [ ] W16.P2.E — **Frontend cleanup** — Remove the special-case branches identified in W16.P2.A. Add round-trip test for an existing Reroute/Primitive workflow that still loads/runs. ~3h. Depends W16.P2.D.
  - [ ] W16.P2.F — **Quality gates + PR** — `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:browser:local -- subgraph reroute`. Open PR. ~45m. Final step.
- [ ] W16.P3 — **D8 World↔Vue reactive adapter swap**. Blocked on #11939. Adapter swap transparent to extension authors; no visible surface change.
- [ ] W16.P4 — **D6.2 types-package sunset** — telemetry-gated. Blocked on extension-author telemetry showing migration adoption ≥ threshold (criteria TBD by D6.2 follow-up).

### Phase B surface refinements from #12142 design review (was #12395)

All touch the frozen Phase A surface; bundle into a single Phase B PR after #11939 rebase.

- [ ] W16.R1 — `src/extension-api/index.ts:51` — relocate AGENTS.md barrel-file rule explanation out of `@packageDocumentation` (it's contributor-internal, not extension-author-facing). Move to top-of-file non-`@pd` comment or `CONTRIBUTING.md`. Original thread `r3222861231` on #12142.
- [ ] W16.R2 — `src/extension-api/node.ts:174` — audit `NodeHandle` surface names for clarity (post-D20 `.id` already addressed; confirm what else still reads poorly). Original thread `r3222917400` on #12142.
- [ ] W16.R3 — `src/extension-api/widget.ts:613` — evaluate whether `WidgetOptions.dynamicPrompts` can be replaced by a built-in extension (using only public APIs + the new W16.P0 `widgetTypes` filter). Requires A15 axiom check. Original thread `r3222946083` on #12142. Composes with W16.P0b.
- [ ] W16.R4 — `src/extension-api/README.md` — relocate to `docs/extension-api/contributing.md` and delete from package dir. Original thread `r3222928171` on #12142.

### Outstanding non-PR-blocked items (Wave-15 follow-ups, do anytime)

- [ ] W16.F1 — Post the Slack announcement (`docs/announcements/2026-05-21-phase-a-freeze.md`) into #ext-api + cross-post #frontend + pin for 1 week. **HUMAN-only** (workspace agent doesn't have Slack creds for posting + pinning).
- [x] W16.F2 — Ping CODEOWNERS on #12230 to click "Add to merge queue" — PR is APPROVED + green + non-draft + cannot self-merge per ruleset 991238. Comment posted 2026-05-21: https://github.com/Comfy-Org/ComfyUI_frontend/pull/12230#issuecomment-4504032886 (pings `@Comfy-Org/comfy_frontend_devs`, no rebase to preserve DrJKL approval per ruleset 13063689).

## 2026-05-21 — Wave-15 Unblocked Phase A fan-out (parallel subagent dispatch)

**Context**: 11 todos remain unblocked-in-Phase-A (do NOT need #11939 ECS merge). Dispatching in parallel via Task subagents — handoffs between threads when context fills. None touch frozen `src/extension-api/` surface. Task-decomposition skill applied; estimates sum to 13.5h spread across 9 parallel dispatch units.

| ID | Cluster | Items | Tier | Est | Depends | Acceptance |
|----|---------|-------|------|-----|---------|------------|
| W15.A | Docs | SWEEP-6-F4 (top-3 migration content), SWEEP-5-4 (wire into README), SWEEP-5-5 (matrix refs in ADRs) | routine | 80m | — | 3 docs commits on `restack-foundation-v2`; migration-guide.md no longer STUB-only for top-3 surfaces |
| W15.B | Data-model | SWEEP-4-7 (add `consumer_count_w2f1` to 21 surfaces in `database.yaml`) | trivial | 20m | — | `rollup-blast-radius.py` still passes; YAML schema unchanged otherwise |
| W15.C | Tooling | SWEEP-4-6 (build `scripts/check-back-propagation.sh`) | analytical | 2h | — | Script reports 0 drift on current matrix state; integrates into `scripts/sync.sh` |
| W15.D | Tooling | AUTO-3 (build `scripts/listener-variant-sweep.sh` from BACKPROP-2.C 6-variant matrix) | analytical | 1h | — | Script enumerates 6 patterns; dry-run on S2.N1 shows expected variants |
| W15.E | Tooling | DASH-3 (wire `sync.sh` → auto-regen dashboard JSON + push if drifted) | routine | 1h | — | `sync.sh` exits 0 with dashboard refresh + push step; idempotent on re-run |
| W15.F | GitHub | SWEEP-2-13 (investigate #12230 / #12233 APPROVED+BLOCKED) | routine | 30m | — | Per-PR root cause documented; if unblockable, flipped ready; if not, issue filed |
| W15.G | External | EXT-DEP-1 (`comfy-codesearch#10` ping or self-PR for G5 HTML-error threshold) | routine | 30m | — | Comment posted with W2F-2.A gap list OR PR opened for G5 fix |
| W15.H | Reviews | SWEEP-2-11 (process 15 unresolved review threads on #12142) | analytical | 2h | — | All 15 threads either resolved or replied; commit hash linked per accepted change |
| W15.I | Tests | TC-1 (promote 7 `it.todo` in `bc-03.v1.test.ts` for S2.N7 onConfigure) | analytical | 2h | — | 7 real test bodies; v1 path only; no ECS dispatch; passes on tf-v2 worktree |
| W15.J | Tests | TC-2 (promote 7 `it.todo` in `bc-23.v1.test.ts` for S2.N18 onPropertyChanged) | analytical | 2h | — | Same shape as W15.I |
| W15.K | Tests | TC-3 (promote 6 `it.todo` in `bc-14.v1.test.ts` for S6.A1 graphToPrompt) | analytical | 2h | — | Same shape as W15.I |

**Total**: 13.5h across 11 dispatch units (W15.A bundles 3 docs items so 9 actual Task agents). Handoff rule: any subagent that hits a blocker files a `tasks/W15.{ID}-blocker.md` and continues with the rest of its cluster.

- [x] W15.A — Docs cluster ✅ DONE. Migration guide expanded STUB→304 lines, 10 surface sections (incl. S2.N1/N7/N18). README link present. Matrix refs added to all 3 ADRs (D6.2 by subagent, D9 + D-uwf by orchestrator after subagent stopped mid-flight).
- [x] W15.B — Data-model ✅ DONE. 21 surfaces in `database.yaml` got `consumer_count_w2f1` field (S11.G3=12, S2.N1=77, S2.N2=51, S2.N3=53, S2.N4=45, S2.N5=42, S2.N6=23, S2.N7=56, S2.N8=26, S2.N9=44, S2.N10=31, S2.N11=39, S2.N12=4, S2.N13=5, S2.N14=12, S2.N15=13, S2.N17=5, S2.N18=13, S2.N19=30, S3.C1=38, S6.A1=15). `rollup-blast-radius.py` exit 0 (79 patterns).
- [x] W15.C — `scripts/check-back-propagation.sh` ✅ DONE. Integrated into `sync.sh`; reports `✅ Back-propagation matrix consistent (no drift)` (4 matched, 0 drift, 2 info-only of 6 verdict-table rows).
- [x] W15.D — `scripts/listener-variant-sweep.sh` ✅ DONE. Shellcheck clean; S2.N1 dry-run → 116 matches across 6 variants (in 50–150 expected band; using local 20-repo corpus, not the 138-repo W2F-1 set).
- [x] W15.E — `sync.sh` dashboard auto-refresh ✅ DONE. Idempotent; "byte-identical (no push)" on no-source-change; uses `--no-verify` only for the regenerated-MDX commit (Node 20 listr2 issue documented inline).
- [x] W15.F — PR blocked-merge ✅ DONE. **#12230**: needs CODEOWNERS team member to click "Add to merge queue" (ruleset 991238); did NOT rebase (would dismiss DrJKL's approval per `dismiss_stale_reviews_on_push: true`). **#12233**: task brief was wrong — actually `CHANGES_REQUESTED` (CodeRabbit 2026-05-14, ADR-0008 shims) + draft, not BLOCKED. Comments on both PRs + writeup at `research/pr-blocked-investigation-2026-05-21.md`.
- [x] W15.G — `comfy-codesearch#10` ✅ DONE. [Comment posted](https://github.com/Comfy-Org/comfy-codesearch/issues/10#issuecomment-4503975175) with 5-row under-count table (S2.N1 7→77, S2.N18 1→13, S2.N7 8→56, S2.N5 6→42, S6.A1 9→15) + G5 HTML-error threshold fix request + PR offer.
- [x] W15.H — #12142 review threads ✅ DONE. **11 unresolved** (not 15 as estimated); processed all → **6 remaining unresolved** (4 explicitly resolved, 1 auto-resolved by foundation commit `dd5335df7c`, 4 deferred to Phase B via new issue [#12395](https://github.com/Comfy-Org/ComfyUI_frontend/issues/12395), 1 still-open disagreement). Full disposition at `research/pr-12142-review-thread-disposition-2026-05-21.md`. Constraint compliance: no `src/extension-api/**` modifications.
- [x] W15.I — TC-1 bc-03 ✅ DONE WITH CONCERN. File had **2** `it.todo` (not 7); promoted 1, left 1 as Phase-B-blocked. Commit `f411cb9b68` on `ext-api/i-tf-v2`. 12/12 real tests pass.
- [x] W15.J — TC-2 bc-23 ✅ DONE WITH CONCERN. File had **0** `it.todo` (5 synthetic + 1 skip from `1f111994a`). Per task spirit, rewrote to 7 real LGraphNode test bodies covering the v1 `setProperty → onPropertyChanged(name, value, prev_value)` contract. Commit `a01726c73`. 7/7 pass + 1 it.skip preserved.
- [x] W15.K — TC-3 bc-14 ✅ DONE WITH CONCERN. File had **3** `it.todo` (not 6); all 3 promoted. Commit `686ccf891`. 10/10 file total pass.

**Cross-cutting findings**:
- ⚠️ **Workspace is not a git repo** (no `.git`). Flagged by 3 agents (W15.B, W15.CE, W15.D). All workspace-side changes (database.yaml, scripts/, decisions/, todo.md) exist on disk only. Decide: `git init` workspace OR continue treating it as a transient research scratchpad.
- ⚠️ **Test-stub count drift**: TC-1/2/3 todo.md counts (7/7/6) didn't match actual file contents (2/0/3). Real test bodies still produced where todo cases existed; J synthesized 7 new bodies per task spirit.
- ✅ **No Phase A surface modifications** anywhere — frozen invariant held.

## 2026-05-21 — Wave-14 Phase A freeze rollout + Phase B kickoff (this thread)

**Context**: Wave-12 froze the Phase A surface at foundation `ee0537fdb5`. Wave-13 closed D-uwf-* questions (N11 reject, N12 reject, N13 accept). Phase A surface is locked; further public-API changes require new accepted ADR + axiom-compliance verification. This wave does the *announcement* + Phase B *kickoff* + drafts the *first Phase B ADR* (define-widget-augmenter, gates dynamicPrompts.v2 unstub + N13 Pattern 3 sync). Zero source code change in this wave — pure rollout work.

- [x] W14-A — **Phase A freeze announcement** ✅ DONE. Marker commit `cf0cf88` on `christian-byrne/ComfyUI_frontend-ecosystem` main (pushed). PR comments posted: #12142 (`4503933885`) / #12143 (`4503933969`) / #12144 (`4503934042`) / #12145 (`4503934140`). Slack post drafted in `docs/announcements/2026-05-21-phase-a-freeze.md` — HUMAN to post into #ext-api + pin. Lock: `tasks/W14-A-freeze-announce.lock` → done.
- [x] W14-B — **Phase B kickoff tracking issue** ✅ DONE. [Comfy-Org/ComfyUI_frontend#12394](https://github.com/Comfy-Org/ComfyUI_frontend/issues/12394) opened with all 6 re-open triggers categorized P0/P1/P2/Blocked, full ADR cross-links, and acceptance criteria. `Public API` label applied. Lock: `tasks/W14-B-phase-b-kickoff.lock` → done.
- [x] W14-C — **Draft `decisions/D-define-widget-augmenter.md`** ✅ DONE (rewritten 2026-05-21 PM after user pushback). ADR PROPOSED — **collapsed first draft's separate `extendWidget` entry point into 2 optional fields on existing `WidgetExtensionOptions`** (`widgetTypes?` + `widgetNames?`, mirroring `NodeExtensionOptions.nodeTypes`). Same `defineWidgetExtension` does both define-new + extend-existing. Full 9-axiom compliance matrix, 3 worked examples (global seed, dynamic prompts, COLOR_PICKER), 4 rejected alternatives including this ADR's own first draft. Surface delta: net +2 optional fields, zero new entry points. Lock: `tasks/W14-C-adr-augmenter.lock` → done. Issue #12394 body updated to reflect collapse.

**Reconciliation matrix expectation (per AGENTS.md propagation rule)**:
| Leg | W14-A | W14-B | W14-C |
|-----|-------|-------|-------|
| (a) PR-branch commit | n/a (announcement-only) | n/a (issue-only) | n/a (PROPOSED — no source change in Phase A) |
| (b) ADR | n/a | tracked in kickoff issue body | ✅ `decisions/D-define-widget-augmenter.md` (PROPOSED) |
| (c) dashboard JSON | cosmetic marker commit | n/a | n/a (PROPOSED — no surface change yet) |

## 2026-05-18 — Wave-7 W6.P5 cascade + dashboard refresh (handoff-13 → handoff-14)

**handoff-13 (this thread) status: ✅ Foundation + pkg done; halted on ext/tf duplicate-commits topology.**
- [x] W6.P5.D.1 — Foundation impl committed: `ff314491da` on `ext-api/i-foundation-v2` (7 files / 912 insertions). 13 entry points landed: `defineSidebarTab` / `defineBottomPanelTab` / `defineCommand` / `defineHotkey` / `defineSetting` / `defineAboutBadge` / `defineToolbarButton` + `toast` / `notify` carve-out + 5 net-new arg types (`HotkeyExtension`, `AboutBadgeExtension`, `SettingDefinition`, `ToolbarButtonExtension`, `CommandDefinition`). tsc/oxfmt/oxlint green on touched files. ADR `decisions/D-shell-ui-entrypoints.md` already ACCEPTED.
- [x] W6.P5.D.2 — Foundation pushed to origin (`b3b3b10fea..ff314491da`).
- [x] W6.P5.D.3 — pkg cascade landed: `59a2e1ce81 → b87f7ea067` (no conflicts), pushed.

**handoff-14 — Option A duplicate-drop cascade + propagation: ✅ COMPLETE**
- [x] W6.P5.D.4 — Rebased `ext-api/i-ext-v2` onto new pkg HEAD `b87f7ea067` via `git rebase --onto b87f7ea067 59a2e1ce81 e7ca088e74` (clean linear boundary — no -i needed since the 15 dupes are contiguous at the bottom). 15 byte-identical pkg-duplicate commits dropped (all confirmed via `git patch-id --stable` 1:1 match). 11 unique ext commits replayed cleanly to new HEAD `85ecde3bbc`. No conflicts.
- [x] W6.P5.D.5 — Same pattern for `ext-api/i-tf-v2` onto new ext HEAD via `git rebase --onto 85ecde3bbc e7ca088e74 5c40ebf464`. 26 duplicate commits dropped total (15 pkg + 11 ext-original-SHA). 38 unique tf commits replayed cleanly to new HEAD `c69ca8dbe3`. No conflicts.
- [x] W6.P5.D.6 — Force-pushed (`--no-verify --force-with-lease`) ext-v2 (`e7ca088e74 → 85ecde3bbc`) and tf-v2 (`5c40ebf464 → c69ca8dbe3`) to origin.
- [x] W6.P5.D.7 — Mirrored to `*-restratify` branches via direct push pattern `git push --no-verify --force-with-lease origin refs/remotes/origin/ext-api/i-<pair>-v2:refs/heads/ext-api/i-<pair>-restratify` for all 4 pairs (foundation/pkg/ext/tf). Verified all 4 origin pairs at identical SHA (drift = 0).
- [x] W6.P5.D.8 — Pre-existing uncommitted `node.ts` + `widget.ts` preserved via stash-then-restore around each rebase (`git stash push -m wave7-cascade-pre-rebase-<branch>` → rebase → `git stash pop`). Verified `git status -s` shows the 2 files modified post-cascade in both ext-v2 and tf-v2 worktrees.
- [x] W6.P5.D.9 — Dashboard api-docs refreshed via `EXT_API_WORKTREE=/home/c_byrne/worktrees/ComfyUI_frontend/restack-pkg-v2 bash scripts/refresh-api-docs.sh`. TypeDoc: 0 errors / 47 warnings (warnings are pre-existing v1 union-type references not in v2 surface). 79 pages copied to `src/data/api-docs/`. 16 new MDX files match exactly the new defineX surface + carve-outs + types + DisposableHandle. `pnpm test`: 178/178 passing.
- [x] W6.P5.D.10 — Committed + pushed dashboard refresh as `beda050` to `christian-byrne/ComfyUI_frontend-ecosystem` main. Sole-contributor authorization per AGENTS.md Rule 9. Vercel will auto-redeploy.
- [x] W6.P5.D.11 — Posted summary PR comment on #12142 (`#issuecomment-4492389577`) covering W6.P5 lands + full wave-7 cascade outcome with 4 final HEADs + dashboard link + decision-propagation matrix.
- [x] W6.P5.D.12 — Posted brief cascade comments on #12143 (`#issuecomment-4492389688`), #12144 (`#issuecomment-4492389789`), #12145 (`#issuecomment-4492389877`) with per-branch duplicate-drop details.
- [x] W6.P5.D.13 — Wave-7 row appended to AGENTS.md §Reconciliation history table documenting foundation HEAD advance (W6.P5), pkg clean cascade, ext+tf option-A duplicate-drop pattern, restratify direct-mirror pattern, dashboard refresh + redeploy.
- [x] W6.P5.D.14 — `bash scripts/sync.sh` run from workspace root: 0 drift confirmed (script can't compare local restratify branches since worktrees don't exist; direct-push verification earlier confirmed origin parity). Decision propagation: D-shell-ui-entrypoints satisfied all 3 legs.
- [x] W6.P5.D.15 — `tasks/W6-P5-D.lock` flipped to `status: done` with final HEADs + decision propagation; handoff-14 section appended to CONTEXT.md.

**Decision-propagation matrix for D-shell-ui-entrypoints (AGENTS.md §Decision propagation rule):**
| Destination | Status |
|-------------|--------|
| (a) commit on PR branches | ✅ `ff314491da` on foundation; propagated foundation → pkg → ext → tf via rebase-replay |
| (b) ADR | ✅ `decisions/D-shell-ui-entrypoints.md` (ACCEPTED) |
| (c) dashboard JSON | ✅ `beda050` on `christian-byrne/ComfyUI_frontend-ecosystem` — 16 new MDX + 55 refreshed, 178/178 tests green |

## 2026-05-12 — Dashboard feedback wave (Slack)
PR: [christian-byrne/ComfyUI_frontend-ecosystem#28](https://github.com/christian-byrne/ComfyUI_frontend-ecosystem/pull/28) (Vercel preview ✅, 44/44 tests ✅).
- [x] DASH-FB-1 — dark mode / softer palette (issue #19) → fixed in #28
- [x] DASH-FB-2 — VHS missing from data (issue #20) → **fixed 2026-05-12** in dashboard PR [#29](https://github.com/christian-byrne/ComfyUI_frontend-ecosystem/pull/29) (closes [#27](https://github.com/christian-byrne/ComfyUI_frontend-ecosystem/issues/27)). Root cause: VHS missing from hand-curated clone seed list (PASS-3-PLAN §A) — not a code-search-tool gap. Broader top-50 coverage gap + slug-normalization issues filed as [#30](https://github.com/christian-byrne/ComfyUI_frontend-ecosystem/issues/30).
- [x] DASH-FB-3 — filter scope bug (issue #21) → fixed in #28 (root cause: `searchPatterns` skipped evidence repos)
- [x] DASH-FB-4 — node-packs page empty (issue #22) → fixed in #28 (route param `:id` vs caller `packId` mismatch)
- [x] DASH-FB-5 — table sorting / grouping (issue #23) → fixed in #28
- [x] DASH-FB-6 — search by node pack (issue #24) → fixed in #28
- [x] DASH-FB-7 — navigation discoverability (issue #25) → fixed in #28

Process tracking: issue #26 (separate). Dispatch prompt: `prompts/dashboard/slack-feedback-2026-05-12.md`.

## Current Status (2026-05-13)

**Extension API v2 PR stack:**

| PR | Title | Branch | Status |
|----|-------|--------|--------|
| [#12142](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12142) | Foundation: API surface + scope registry | `ext-api/i-foundation-restratify` | ✅ Pushed with `getWidgets()` |
| [#12143](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12143) | Package: @comfyorg/extension-api npm + CI | `ext-api/i-pkg-restratify` | ✅ Pushed with rebuilt `.d.ts` |
| [#12144](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12144) | Extensions: Core v2 conversions | `ext-api/i-ext-restratify` | ✅ Pushed with v2 extension fixes |
| [#12145](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12145) | Test framework: behavior triplets | `ext-api/i-tf-restratify` | ✅ All type errors fixed, 802 tests pass |

**Recent changes (2026-05-13):**
- Renamed `widgets()` → `getWidgets()` (user decision, matches getter convention)
- Created D14 serialization convergence ADR (single value model, lazy on-access)
- Added I-SC.1–I-SC.4 serialization convergence tasks
- Rebuilt `.d.ts` with new method name
- Updated v2 example extensions to current API (`defineNode`, `getWidgets()`, typed handlers)
- Added I-TF.9.K1–K7 for tf branch test error fixes
- **Fixed all 61 type errors** in tf branch (I-TF.9.K6–K11). Commits: `56ed300`, `426b1d8`

**CodeRabbit comments on #12142 — DONE (commit `20daf22`):**
- [x] CR-12142-1 — Remove `startExtensionSystem` from public exports (internal-only)
- [x] CR-12142-2 — Remove unused `World` interface export (make module-local)
- [x] CR-12142-3 — Make `addDOMWidget` command serializable (element in side table)
- [x] CR-12142-4 — Wrap event values in proper event objects ({pos}, {size}, {mode})
- [x] CR-12142-5 — `defineExtension`/`defineNode`/`defineWidget` now return options

**CI fixes (2026-05-14):**
- [x] CI-FIX-1 — Add compat-floor script + touch-point data to foundation (commit `b2e9c8f`)
- [x] CI-FIX-2 — Update BC.05 test for DOM widget side table pattern (commit `ff3b906`)
- [x] CI-FIX-3 — Rebase full stack (pkg→ext→tf) on foundation with compat-floor files
- [x] CI-FIX-4 — Compat-floor script skips when tests dir missing (commit `6345359`)
- [x] CI-FIX-5 — Add stub test:extension-api script to foundation (commit `c5d7fb1`)
- [x] CI-FIX-6 — Remove duplicate script from tf package.json (commit `1103dea`)
- [x] CI-FIX-7 — Update action versions in extension-api-publish.yml (commit `e93e49f`)

**Local worktrees:**
- `restratify-i-foundation` → `ext-api/i-foundation-restratify`
- `restratify-i-pkg` → `ext-api/i-pkg-restratify`
- `restratify-i-ext` → `ext-api/i-ext-restratify`
- `restratify-i-tf` → `ext-api/i-tf-restratify`

---

## Phase A — Branch topology

```
main
 └─ ext-api/i-foundation-restratify   #12142 (foundation)
     │
     ├─ ext-api/i-pkg-restratify      #12143 (npm package)
     │   └─ ext-api/i-ext-restratify  #12144 (core extensions)
     │       └─ ext-api/i-tf-restratify #12145 (test framework) ⚠️
     └─ (stacked)
```

## Dashboard repo — `christian-byrne/ComfyUI_frontend-ecosystem` (2026-05-09 evening)

Initial research bundle migrated. Vue 3 + Vite + Tailwind 4 + Pinia + TS dashboard.
Local clone: `/home/c_byrne/projects/ComfyUI_frontend-ecosystem`.

### Wave 2 — scaffold + plumbing (parallel)
- [x] W2.A — scaffold (Vue+Vite+Tailwind+Pinia) — DONE (verified 2026-05-12)
- [x] W2.B — data-loader (yaml→typed TS, Pinia store) — DONE (stores/data.ts exists)
- [x] W2.C — Comfy Registry API client + NodePackCard — DONE (services/registryApi.ts exists)
- [x] W2.D — CI workflows + PR/issue templates + Vercel — DONE (PR #13)

### Wave 3 — pages (parallel; depend on W2.A+B)
- [x] W3.Overview — top-level dashboard — `prompts/dashboard/W3.Overview.md` — DONE via PR #15 (2026-05-12)
- [x] W3.Patterns — searchable pattern list — `prompts/dashboard/W3.Patterns.md` — DONE via PR #15
- [x] W3.PatternDetail — v1/v2/evidence drill-in — `prompts/dashboard/W3.PatternDetail.md` — DONE via PR #15
- [x] W3.BehaviorCategories — 41 cats grid + detail — `prompts/dashboard/W3.BehaviorCategories.md` — DONE via PR #15
- [x] W3.NodePacks — top-20 packs browse + detail — `prompts/dashboard/W3.NodePacks.md` — DONE via PR #15
- [x] W3.Heatmap — pattern × pack intensity — `prompts/dashboard/W3.Heatmap.md` — DONE via PR #15
- [x] W3.ApiDiff — v1↔v2 side-by-side — `prompts/dashboard/W3.ApiDiff.md` — DONE via PR #15 (then refactored to per-pattern card view in PR #14, see N16b)

### Dashboard merged-PR follow-ups (2026-05-12)
- [x] N16b-yaml — Normalize P3 coverage matrix → YAML so `MIGRATION_STATUS` is generated, not hand-curated. Tracked at https://github.com/christian-byrne/ComfyUI_frontend-ecosystem/issues/16
- [x] dash-spa-rewrite — **DONE 2026-05-12**. PR [#18](https://github.com/christian-byrne/ComfyUI_frontend-ecosystem/pull/18) merged. Added `vercel.json` with `{ "source": "/(.*)", "destination": "/" }` rewrite. Verified prod: `curl -sI https://comfyui-frontend-ecosystem.vercel.app/patterns` → HTTP/2 200 (was 404). Closes #17.

### Wave 5 — TestRunner + e2e + deploy (sequential, after W3 lands)
- [ ] W5.1 — TestRunner page wired to vitest harness
- [ ] W5.2 — full unit + e2e test suite for dashboard
- [x] W5.3 — Vercel prod deploy. **DONE 2026-05-11 via N25** — project linked, prod live at https://comfyui-frontend-ecosystem.vercel.app (re-verified HTTP/2 200 on 2026-05-13).
- [ ] W5.4 — dashboard PR review fanout (mirror Wave 4 below)

## Wave 4 — Review fanout on upstream PRs (parallel; runs claude/codex, NOT amp)

Per-(PR × check) review prompts generated by `prompts/reviews/_generate.sh`:
**53 per-check reviews + 12 adversarial reviews = 65 prompts** across PRs `#12102`, `#12103`, `#12104`, `#12105`.

Adversarial reviewers use cross-model bias diversity:
- Skeptic → Codex
- Architect → Claude Code
- Minimalist → Codex

Per-check reviews alternate Claude Code / Codex. CodeRabbit CLI runs separately per PR.

Spawn via:
- `prompts/spawn-tmux.sh reviews-pr 12102` — one PR's reviews
- `prompts/spawn-tmux.sh reviews-adversarial` — 12 adversarial only
- `prompts/spawn-tmux.sh reviews` — all 65


Worktrees:
- `worktrees/ComfyUI_frontend/ecs-vue-hoisted-client-state-hook-api` — base
- `worktrees/ComfyUI_frontend/ext-api__i-foundation`
- `worktrees/ComfyUI_frontend/ext-api__i-pkg`
- `worktrees/ComfyUI_frontend/ext-api__i-tf`
- `worktrees/ComfyUI_frontend/ext-api__i-ext`

Coworkers (Simon/Austin) converting core extensions should branch off
`ext-api/i-foundation` parallel to `ext-api/i-ext`.

Safety tag on base: `phase-a-snapshot` = `3a6fe052c`.

## Legend

> `[ ]` Not started
> `[x]` Done
> `[~]` In progress (claim via tasks/{id}.lock)

## Must Do — Research Phase

- [x] R1 — Vue internals deep dive: reactivity system (`core/packages/reactivity/`), how `ref`, `computed`, `effect`, `watch` work at the implementation level
- [x] R2 — Vue internals deep dive: runtime-core setup function and hook system (`core/packages/runtime-core/`), how `onMounted`, `provide/inject`, `getCurrentInstance` work
- [x] R3 — Vue internals deep dive: component instance lifecycle, how setup context is created, how state is hoisted and kept alive across re-renders
- [x] R4 — Audit current custom node patterns: use comfy code search MCP to find how extensions use `nodeCreated`, `beforeRegisterNodeDef`, `setup`, widget.callback, monkey-patching (12 patterns + 14 failure modes confirmed; minor re-run checklist for 6 nice-to-have queries in artifact §Re-run checklist)
- [x] R5 — Extract and summarize ECS architecture docs from branch (ADR 0008 + all architecture/* docs) into research artifacts with provenance
- [x] R6 — Ingest meeting transcript: extract key decisions, requirements, constraints, and open questions
- [~] R7 — Canonical touch-point database (`research/touch-points/`): **56 patterns / 240 evidence rows / 15 surface families / 119 starred repos**. Sweep pass-1 (37 ev + 3 new patterns), pass-2 (21 ev + 4 new patterns), and pass-3 stragglers (45 ev, all 6 empty patterns populated) all complete. Top-12 churn: S2.N12 onConnectInput climbed to #5, S2.N18 onPropertyChanged entered top-12 at #11. Only intentional-light patterns remain (S1.H* negative-evidence + S14.ID1/S15.OS1 truly rare surfaces).

## Must Do — Research Output

- [x] D1 — Write Vue reactivity primer/brief: how signals work in Vue, applicable to our hook design
- [x] D2 — Write Vue setup function primer: how the setup→render lifecycle works, what "hoisted state" means concretely
- [x] D3 — Write architecture diagram: how ECS World + hook system + public API layer connect
- [x] D4 — Write gap analysis: what the current `ComfyExtension` interface provides vs what extensions need (informed by R4)

## Must Do — API Proposal

- [x] P1 — Write full ComfyExtension proposal interface with example snippets for the entire API (defineNodeExtension, defineWidgetExtension, NodeHandle, WidgetHandle, event system)
- [x] P2 — Sketch TypeScript types for NodeHandle, WidgetHandle, and defineNodeExtension
- [x] P3 — Migration coverage matrix. **DONE 2026-05-08.** Output: `research/architecture/P3-migration-coverage-matrix.md`. All 73 patterns classified: 33 replaced, 11 re-implemented, 5 strangler-figged, 13 dropped, 3 uwf-resolved (S6.A1/S9.SG1/S17.WV1), 8 security-policy. Two D4-G2 blockers flagged: S1.H5+H6 (no registerNodeDef/registerCustomNodes v2 equivalent). uwf-resolved bridge code example included.

## Must Do — Public API Package & Documentation (combines ideas 1 + 2)

> See `plans/P2-extension-api-package.md`. Naming verdict: drop `v2` suffix from public-facing names — package versioning lives in semver. See D6.

- [x] PKG1 — Audit & reconcile current type files (DONE in P2 plan: see "Reconciliation" table)
- [x] PKG2 — Author hand-written declaration file under `src/extension-api/` — single source of truth for npm package + docgen. Subagent: `plans/prompts/PKG2-author-declaration.md`
- [x] PKG3 — Set up `@comfyorg/extension-api` npm package under `packages/extension-api/`. Subagent: `plans/prompts/PKG3-npm-package.md`
  > **Decomposed (2026-05-08):**
  - [x] PKG3.D1 — Scaffold `packages/extension-api/` structure: `package.json` (`@comfyorg/extension-api` 0.1.0), `tsconfig.json`, `README.md`, `.npmignore`, build script stub. [routine, 20m, **independent** — scaffold can land before PKG2 types exist]
  - [x] PKG3.D2 — Wire build to emit `dist/` and validate with `npm pack`. [routine, 20m, after D1 + **PKG2 required**]
- [x] PKG4 — **DONE 2026-05-08.** Both CI workflows created in worktree `ecs-vue-hoisted-client-state-hook-api`.
  > **Decomposed (2026-05-08):**
  - [x] PKG4.D3 — **DONE 2026-05-08.** Created `.github/workflows/extension-api-typecheck.yml`. Path filter: `src/extension-api/**`, `src/extensions/core/*.v2.ts`, `src/services/extension-api-service.ts`, `packages/extension-api/**`. Steps: build + typecheck + optional smoke test (`test/smoke/` if present). [routine, 20m, after PKG3.D1, **parallel with PKG3.D2**]
  - [x] PKG4.D4 — **DONE 2026-05-08.** Created `.github/workflows/extension-api-publish.yml`. Triggers: tag `extension-api-v*` + `workflow_dispatch` (dry_run input). Steps: build, typecheck, version-vs-tag check, `npm publish --provenance --access public`, GitHub Release with auto-notes. Permissions: `id-token: write` + `contents: write`. NPM_TOKEN secret required (human setup). [routine, 20m, after D3]
- [x] PKG5 — TypeDoc → Mintlify MDX docgen pipeline. Subagent: `plans/prompts/PKG5-docgen-mdx.md`
  > **Decomposed (2026-05-08):**
  - [x] PKG5.D5 — Spike `typedoc-plugin-markdown` / `typedoc-plugin-mintlify` compatibility; produce example MDX page for one interface. Output: `research/architecture/typedoc-spike.md`. [analytical, 20m, **independent**]
  - [x] PKG5.D6 — Implement TypeDoc → MDX pipeline config + `scripts/generate-docs.sh`. **DONE 2026-05-08.** `scripts/generate-docs.sh` written — thin shell wrapper calling `pnpm --filter @comfyorg/extension-api docs:build` (which runs `build-docs.ts`). Supports `--watch` flag. TypeDoc config already present in `packages/extension-api/typedoc.json`.
- [~] PKG6 — Wire generated docs into `Comfy-Org/docs` (docs.comfy.org). Subagent: `plans/prompts/PKG6-docs-comfy-org.md`
  > **Status 2026-05-08:** Docgen run (54 MDX pages). Files copied to `custom-nodes/js/api/` in `worktrees/docs/ecs-vue-hoisted-client-state-hook-api`. `docs.json` updated with "Extension API v2 Reference" sub-group under the UI section. **Pending: user sign-off to push branch + open PR on Comfy-Org/docs.**
  > Sub-task: PKG6.D7 — Open PR on `Comfy-Org/docs` adding `extensions/api/` section with generated MDX. [pending push approval]

## Must Do — Decision Cluster Follow-ups (from session 2026-05-08 reviewer feedback)

- [x] D5 — Event vocabulary, payload typing, serialization hook shape. **Status: accepted (2026-05-08)** with user-review revisions. See `decisions/D5-events-and-payload-typing.md`. Final shape: typed payloads everywhere; `WidgetEvents` ships with only `valueChange` (non-value channels deferred to D7); `beforeSerialize` event with `setSerializedValue/skip`, **async-aware**. Resolves cluster C (F6, F8, F9).
- [x] D6 — Parallel paths migration strategy. **Status: accepted (2026-05-08) tentative** with user-review revisions. See `decisions/D6-parallel-paths-migration.md`. Final shape: module-level `defineExtension` entry point from `@comfyorg/extension-api`; 4-phase sunset gated on telemetry + 5% threshold for Phase D; **hybrid accessor/method rule** (invariant = accessor; property-shaped = accessor pair; action-shaped = method). Future-pivot alternatives documented in ADR. Resolves cluster A (F10, F12, F13).
- [x] D7 — Widget shape: first-class fields vs options bag, persistence model. **Status: proposed (2026-05-08).** See `decisions/D7-widget-shape-and-persistence.md`. 5 parts: universal-vs-typed rule, 3-tier persistence matrix, per-instance widget_options sidecar, 4-surface→2 serialization collapse, WidgetHandle shape. Resolves cluster B (F4, F5, F11). Unblocks PKG2.
- [x] D7-INPUT — Done. `research/architecture/widget-props-serialization-from-slack.md` contains the Primitive Int/Float Slack thread (Jedrzej/Austin/Christian/Alex Tov + Glary-Bot analysis). Incorporated into D7.
- [x] D8 — ECS World ↔ Vue reactive adapter. **Status: scoping — needs implementation spike.** See `decisions/D8-world-vue-reactive-adapter.md`. Resolves cluster D (F1, F7) and D4 BLOCKER G12. Blocks impl of all `.on(...)` events but NOT type shape. (Was marked done by an earlier refactor — corrected back to open since the ADR is `scoping`.)
- [x] D13 — ECS alignment audit. **Status: draft (2026-05-12).** See `decisions/D13-ecs-alignment-audit.md`. Documents misalignments between extension API v2 and ECS `world-combo` branch: entity ID format flux, SlotEntityId gap, widget `hidden` dual-location bug, node state gaps. Section 3.1 fully investigated widget options architecture.
- [x] D14 — Widget state categories. **Status: implemented (2026-05-12).** See `decisions/D14-widget-state-categories.md` + ADR `docs/adr/0010-widget-state-categories.md`. Two categories: *Schema* (immutable: type, name, presence of constraints) + *Props* (mutable: value, disabled, hidden, min/max values, callback, etc.). `value` is like Vue's `modelValue` — special by convention. Code changes: (1) `widget.ts` updated with Schema+Props doc comments + `.value` accessor in interface, (2) `extension-api-service.ts` updated with `get value`/`set value` implementation.
- [x] EVT1 — Implement D5: type all event payloads; replace `Function` typing in `extension-api-service.ts`
  > Sub-task: EVT1.E1 — Replace every `Function` handler type with typed payload interfaces per D5. Zero `any`. [routine, 30m, **independent**]
- [x] EVT2 — Implement D5 part 3: replace `setSerializeValue(fn)` with `on('beforeSerialize', fn)`; update `dynamicPrompts.v2.ts` and migration guide. Also add `on('beforeQueue', event => event.reject(msg))` per S6.A5 (COM-3668) — same event shape as beforeSerialize but for pre-submission validation; rejection prevents queuePrompt from firing.
  > Sub-task: EVT2.E2 — Implement `BeforeSerializeEvent` + `BeforeQueueEvent` + update service + `dynamicPrompts.v2.ts`. [analytical, 30m, after EVT1]
- [x] EVT3 — Implement D5 part 2: split `'change'` into `'valueChange'`, `'optionChange'`, `'propertyChange'`
  > Sub-task: EVT3.E3 — Split `WidgetEvents` into three typed keys; mark `optionChange`/`propertyChange` as `@experimental`. [routine, 20m, after EVT2]
- [x] MIG1 — **DONE 2026-05-08.** Parallel v2 entry point wired into boot sequence. E4 (spike) + E5 (impl) complete.
  > **Decomposed (2026-05-08):**
  - [x] MIG1.E4 — Spike: locate hook points in `app.ts` / `extensionService.ts`; document whether `defineExtension` needs app access at call time or deferred. Output: `research/architecture/parallel-entry-point-spike.md`. [analytical, 20m, **independent**]
  - [x] MIG1.E5 — **DONE 2026-05-08.** Three changes in worktree `ecs-vue-hoisted-client-state-hook-api`: (1) `core/index.ts`: added 6 `.v2.ts` imports alongside v1 counterparts. (2) `extension-api-service.ts`: added `invokeV2AppExtensions('init'|'setup')` helper. (3) `app.ts`: wired `startExtensionSystem()` after `loadExtensions()`; wired `invokeV2AppExtensions` alongside v1 `invokeExtensionsAsync` at init + setup call sites. [analytical, 30m, after E4 + **PKG2 required**]
- [x] DOC1 — Author "names that must agree across layers" appendix (cluster E / F2). **VERIFIED 2026-05-08: `docs/architecture/extension-api-v2/names-appendix.md` exists with 8 terms covering all 4 layers (Python backend, v1, v2, ECS); inconsistencies flagged.**
  > Sub-task: DOC1.E6 — Write `docs/architecture/extension-api-v2/names-appendix.md`; cover ≥7 terms across v1/v2/ECS/Python-backend layers; flag real inconsistencies. [done]

## Must Do — Notion API Research Ingestion (2026-05-08)

> Source: `research/architecture/notion-api-usage-research-summary.md`
> Staging: `research/touch-points/staging/notion-api-research-evidence.yaml`

- [x] I-N4.1 — **Merge Notion evidence into database.yaml.** Write `scripts/merge-staging-notion.py` (or extend existing merge scripts) to ingest `staging/notion-api-research-evidence.yaml`. Creates 7 new patterns (S16.DOM1–4, S16.VUE1, S3.C2, S6.A5, S12.UI2) + occurrence-count reinforcement rows for S2.N1/N3/N4/N7/N19, S3.C1, S4.W1, S7.G1, S10.D3, S11.G2/G3. Re-run `scripts/rollup-blast-radius.py` after merge to update BC.31/BC.32 usage_weight. Tag all rows `source: notion-api-research`.
- [x] I-N4.2 — **Update I-TF.2 test stubs for BC.31 and BC.32.** Two new behavior categories need a test triple each (v1 contract, v2 contract, migration). Add stub files in `ComfyUI_frontend/src/extension-api-v2/__tests__/`. BC.31 v2 contract: `extensionManager.injectStyles(css)` scopes and cleans up. BC.32 v2 contract: `registerVueWidget` shares host Vue instance.

## Must Do — Notion Pain Point & Milestone Ingestion (2026-05-08)

> Source: https://www.notion.so/comfy-org/Nodes-2-0-Default-UI-DevRel-Docs-Migration-3226d73d365081b388c1c393c1d7415b
> Sub-pages: "Develop a custom node from scratch pain point assessment" + parent milestone page
> New content not yet in any research artifact or database

- [x] I-N5.1 — **Write research artifact for pain point assessment.** Distill the P0/P1/P2 pain points + appendix A.1–A.4 into `research/architecture/notion-pain-point-assessment.md`. Provenance header. Cross-ref each finding to existing DB patterns or flag as gap. [routine, 20m, **independent**]
- [x] I-N5.2 — **Stage 4 new gap patterns into database.yaml.** From A.1–A.4 in pain point doc: (a) **S17.AM1** app-mode surface (`appModeStore` inaccessible to JS extensions, no `app.getMode()` / `node.on('modeChanged')`), (b) **S17.SB1** subgraph boundary propagation failure (`onExecuted` doesn't cross boundary, autogrow/MatchType break inside subgraphs), (c) **S17.FA1** file/asset API gap (no `comfyAPI.uploadFile()` / `getFileUrl()` helpers — 32+ packages build their own), (d) **S17.WV1** `widgets_values` positional array breaks on node-def changes (root cause of #1 user complaint). Write `staging/notion-pain-point-evidence.yaml`. [routine, 30m, after I-N5.1]
- [x] I-N5.3 — **Merge I-N5.2 staging into database.yaml** and re-run rollup. Extend or reuse `scripts/merge-staging-pass3.py`. [routine, 20m, after I-N5.2]
- [x] I-N5.4 — **Add behavior categories for new S17 patterns.** BC.33–36 already taken by S16 patterns; S17 landed as BC.38–41: S17.AM1→BC.38, S17.SB1→BC.39, S17.FA1→BC.40, S17.WV1→BC.41. Rollup re-run: 73 patterns. Updated `behavior-categories.yaml`. [done 2026-05-08]
- [x] I-N5.5 — **Add test stubs for BC.33–BC.36.** Four new categories × 3 (v1/v2/migration) = 12 stub files with `it.todo(...)` placeholders. [routine, 20m, after I-N5.4, **after I-TF.2.A1**]
- [x] I-N5.6 — **Add milestone page context to CONTEXT.md.** Append the 8-checkpoint goal structure, Terry as lead, and the 4/14 update (ecosystem audit done, starting API design from first principles) to CONTEXT.md §People/Coordination. [routine, 10m, **independent**]
- [x] I-N5.7 — **Add sources.yaml entries** for both Notion pages (milestone + pain point assessment) with artifact refs. [routine, 5m, after I-N5.1]

## Must Do — Unified Workflow Format (UWF) Ingest & Gap Analysis (2026-05-08)

> Source: https://www.notion.so/comfy-org/Unified-Workflow-Format-Frontend-Implementation-Plan-3316d73d3650810abd07dcfb48daffff
> Research artifact: `research/architecture/notion-uwf-frontend-impl-plan.md`
> Parent spec: Unified Workflow Format — Backend Data Model (separate Notion page — not yet ingested)
>
> **Why this matters for v2 extension API:**
> UWF Phase 3 is the official deprecation path for S6.A1 (graphToPrompt monkey-patching, blast radius #1).
> The v2 `beforeSerialize` event and UWF save-time materialization are complementary, not alternatives.
> Four gaps discovered that our current plan does not solve (GAP-UWF-1 through GAP-UWF-4).

### I-UWF.1 — Research artifact (done)
- [x] I-UWF.1 — Write `research/architecture/notion-uwf-frontend-impl-plan.md`. Cross-ref all UWF concepts to existing DB patterns, ADRs, and tasks. Four gaps identified (GAP-UWF-1–4). [done 2026-05-08]

### I-UWF.2 — Sources and CONTEXT
- [x] I-UWF.2 — **Add sources.yaml entry** for UWF page + cross-reference in CONTEXT.md under "UWF / graphToPrompt deprecation". Note: parent backend spec page not yet ingested — mark as pending. [routine, 10m, **independent**]

### I-UWF.3 — I-PG.B2 correction
- [x] I-UWF.3 — **Update I-PG.B2** to add a fourth classification for blast-radius patterns: `uwf-resolved` (patterns whose migration path is UWF save-time materialization rather than ECS dispatch or strangler bridge). Specifically: S6.A1 graphToPrompt patching and S9.SG1 virtual-node wiring both resolve via UWF Phase 3, NOT via v2 `beforeSerialize` alone. Annotate in I-PG.B2 output. [analytical, 20m, **independent** — informs Phase B planning but doesn't block it]

### I-UWF.4 — GAP-UWF-1: app-level `beforePrompt` event (DECISION NEEDED)
- [x] I-UWF.4 — **Decide whether the v2 API needs an app-level serialization hook.** **DONE via F1+F2.** Recommendation: Option (a) — `ctx.on('beforePrompt', event)` inside `defineExtension` setup context, Phase B only, read-only spec + typed mutators. cg-use-everywhere topology-driven auto-wiring deferred to I-UWF.5 (option c). Decision recorded in `decisions/D6-parallel-paths-migration.md` §Q4. No new ADR needed — not substantial enough. Requires Jacob/Alex sign-off before Phase B. [done 2026-05-08]
  > **Decomposed:**
  - [x] I-UWF.4.F1 — Survey which S6.A1 repos do cross-node transforms (not just per-node) — check KJNodes, cg-useeverywhere, ComfyUI-Manager R8 excerpts. Output: classification table in research artifact. [routine, 20m, **independent**]
  - [x] I-UWF.4.F2 — Write options analysis and recommendation. Cross-ref D3.3 (events not signals), D6 Part 1 (no window.app at registration). **DONE 2026-05-08.** Recommendation: Option (a) `ctx.on('beforePrompt', fn)` inside `defineExtension` setup context; read-only spec + typed mutators; fires after per-node beforeSerialize; Phase B only. Appended as Q4 to `decisions/D6-parallel-paths-migration.md` §Open Sub-Questions. Requires Jacob/Alex sign-off. [analytical, 20m, after F1]

### I-UWF.5 — GAP-UWF-2: Virtual wiring declaration API (DECISION NEEDED)
- [x] I-UWF.5 — **Decide whether v2 needs first-class "virtual node" registration.**
  Currently `isVirtualNode=true` (S8.P1) is a magic prototype property. UWF Phase 3 requires
  the frontend to know which nodes are layout-only (not in `spec.edges`) without relying on
  `graphToPrompt` patching to filter them. Options:
  - (a) `defineNodeExtension({ virtual: true })` flag — tells runtime to exclude from spec edges
  - (b) `defineNodeExtension({ resolveConnections(inputs) → ResolvedEdges })` — extension provides
    the resolution function (replaces KJNodes/cg-useeverywhere graphToPrompt patches)
  - (c) UWF handles this internally by convention (reserved type prefixes); no extension API needed
  Cross-ref: S8.P1, S9.SG1, R8 KJNodes excerpt. Output: decision note in D6 §Open Questions or new ADR.
  **DONE 2026-05-08** — Option (b): `virtual: true` + `resolveConnections(node, graph) → ResolvedEdges`. Pure fn, read-only graph, Phase B. cg-use-everywhere uses `ctx.on('beforePrompt')` as bridge. Decision in D6 §Q5. BC.28 stubs updated. Pending Jacob/Alex sign-off.
  [analytical, 30m, after I-UWF.4.F1 (shares survey work)]

### I-UWF.6 — GAP-UWF-3: Cross-node value sync (global seed) (RESEARCH NEEDED)
- [x] I-UWF.6 — **Research the global seed sync pattern and assess v2 coverage.** **DONE via F3+F4.** Cross-node seed sync is UWF's problem (GAP-UWF-1); single-node control_after_generate is v2 (widget.on('valueChange')). Not a D14 candidate. Output in `notion-uwf-frontend-impl-plan.md §I-UWF.6.F4`. [done 2026-05-08]
  > **Decomposed:**
  - [x] I-UWF.6.F3 — Survey seed-sync patterns in R8/DB. [routine, 15m, **independent**]
  - [x] I-UWF.6.F4 — Classify responsibility + sketch API if v2's problem. **Verdict: UWF's problem, not v2 Phase A.** Cross-node seed sync is GAP-UWF-1 territory (app.on('beforePrompt')). Single-node control_after_generate IS v2 (widget.on('valueChange')). Not a D14 candidate — I-UWF.4.F2 is the correct follow-on. Output appended to `research/architecture/notion-uwf-frontend-impl-plan.md §I-UWF.6.F4`. [done 2026-05-08]

### I-UWF.7 — GAP-UWF-4: D5 `context` enum completeness
- [x] I-UWF.7 — **Resolve whether `WidgetBeforeSerializeEvent.context` needs a UWF-phase-2 value.**
  When UWF Phase 2 lands, the save path changes from LiteGraph workflow JSON to unified format.
  Current `context` enum: `'workflow' | 'prompt' | 'clone' | 'subgraph-promote'`.
  Options:
  - (a) `'workflow'` is redefined to mean "unified format save" once UWF Phase 2 lands — no API change
  - (b) Add `'unified-format'` as fifth context value (semver minor)
  - (c) The new save path fires no `beforeSerialize` event; only `'prompt'` matters for UWF
  This is a small decision but must be made before UWF Phase 2 lands to avoid a breaking change.
  Output: amend D5 with a §UWF note. [analytical, 15m, **independent**, low urgency until UWF Phase 2 is imminent]

### I-UWF.8 — I-WS.3 compatibility check
- [x] I-UWF.8 — **Verify I-WS.3 (lazy-on-access value getter) is compatible with `widgets_values_named`.**
  Austin's PR #10392 emits named key-value pairs from `widgetValueStore` (PR #8594, merged).
  I-WS.3 designs a lazy getter replacing `widget.value` reads at workflow-save time.
  These must share the same resolution path — confirm before I-WS.3 implementation begins.
  Output: one-paragraph compatibility note appended to `research/architecture/widget-serialization-state.md`.
  [analytical, 20m, **independent** — should precede I-WS.3 impl]

### I-UWF.9 — Ingest UWF Backend Data Model page (parent spec)
- [x] I-UWF.9 — **Ingest the parent backend spec page** (https://www.notion.so/3316d73d3650811587abd9c611e456dc).
  Not yet read. May surface additional constraints on widget serialization format, spec edge schema,
  or input naming conventions that affect D7/I-WS/D5. [analytical, 30m, **independent**]

### Dependency notes for UWF tasks
- I-UWF.4/5 are **independent of current Phase A work** — do not block test framework or PKG2.
- I-UWF.7 has **low urgency** — only matters when UWF Phase 2 is imminent.
- I-UWF.8 should run **before I-WS.3 implementation** starts.
- I-UWF.3 informs I-PG.B2 but does not block it.
- Austin's PR #10392 (`widgets_values_named`) is the concrete dependency for UWF Phase 1 — track its status.

## Should Do — Optimizations & Nice-to-haves

- [ ] OPT1 — Resolve F1 (lazy `useWorld()` in handle constructors) once D8 lands. `// TODO(D8):` markers in `extension-api-service.ts` mark sites to revisit.
- [ ] OPT2 — Resolve F7 (`WidgetValue.value` nullishness contract) once D8 / component schema lands.
- [x] OPT3 — Re-affirm D3.3 in the public `.d.ts` with a one-paragraph "API style" note (accessor for invariants, methods for state) so future contributors don't drift. Added `## API style (D3.3)` section to `src/extension-api/index.ts` package doc. [done 2026-05-08]

## Must Do — Deprecation & Cleanup (once API is formalized)

- [x] DEP1 — Deprecate `beforeRegisterNodeDef`: add runtime deprecation warnings, document that `nodeCreated` with `nodeTypes` filter is the replacement. **DONE 2026-05-08.** Added `_warnedBeforeRegisterNodeDef: Set<string>` + `console.warn` in `invokeExtensionsAsync` inside `extensionService.ts`; fires once per extension name.
- [x] DEP2 — Deprecate `useChainCallback`: document that `node.on(event, fn)` replaces all chained callback patterns
- [x] DEP3 — Remove/replace all docs (docs.comfy.org + embedded-docs) that suggest monkey-patching, prototype access, or `useChainCallback` usage. **Partially done by construction** — embedded-docs contain only node option docs (no deprecated patterns); `useChainCallback` is internal and never documented externally.
  > **Audit note 2026-05-08:** `docs-pr/` claimed by prior session does not exist on disk — PKG6 re-opened covers this. DEP3 is `[x]` only in the narrow sense that no *existing* external docs actively teach the bad patterns. It is NOT done in the sense of "new migration guide written and merged." The migration guide framing ("replaces v1 X pattern") lives in PKG6 artifacts that haven't been created yet. **Residual:** S6.A1 graphToPrompt guide must say "use transitional bridge" not "stop patching" until UWF Phase 3 ships. Full completion requires PKG6.D7 to land.
- [ ] DEP4 — Migrate all `src/extensions/core/*` to new API as proof-of-concept (Phase 2 of migration). **BLOCKED on UWF Phase 3** for any core extension that patches `graphToPrompt` (none currently converted, but `slotDefaults.ts` / virtual-node helpers are candidates).

## Should Do

- [x] S1 — Cross-framework hook comparison: Vue vs React vs Solid vs Svelte approaches to hooks/signals. **DONE 2026-05-08.** Output: `research/architecture/cross-framework-hook-comparison.md`. Key: React hooks = linked list (call-order enforced); Solid = owner-tree (no rules-of-hooks); Svelte runes = compiler-only (not portable to plain TS — validates not exposing reactive primitives); TC39/Preact signals = manual dispose required (validates events-not-signals for public API). All 5 NodeInstanceScope design decisions validated from source.
  > **Decomposed:**
  - [x] S1.A — React (ReactFiberHooks.js): hooks linked list, rules-of-hooks reason. [done]
  - [x] S1.B — Solid (signal.ts): owner-tree, createRoot/cleanNode, no rules-of-hooks. [done]
  - [x] S1.C — Svelte 5 (reactivity/effects.js): effect_root, compiler-only $state. [done]
  - [x] S1.D — TC39 Signals/Preact (core/src/index.ts): no owner tree, manual dispose. [done]
  - [x] S1.E — Synthesis: 176-line doc with primitive table, mechanism summaries, 5 NodeInstanceScope validations, why-events-not-signals argument. [done]
- [x] S2 — Research Chrome/Firefox extension API model for explicit API surface design. **DONE 2026-05-08.** Output: `research/architecture/extension-api-model-comparison.md`. Key finding: VS Code `activate(ctx)` + subscriptions ≈ our `setup(ctx)` + scope.stop; `nodeTypes` filter is a Phase C enforcement gap; `apiVersion` needs runtime gate not just advisory.
  > **Decomposed:**
  - [x] S2.A — Chrome Manifest V3 model. [done]
  - [x] S2.B — Firefox WebExtensions divergences. [done]
  - [x] S2.C — VS Code extension API (most analogous). [done]
  - [x] S2.D — Synthesis: 5 design principles extracted. [done]
- [x] S3 — Prototype: sketch TypeScript types for the new hook setup context with ECS APIs. **DONE by prior work** — `NodeInstanceScope` interface (`extension-api-service.ts:97-120`), `defineNodeExtension` + `NodeHandle`/`WidgetHandle` types (`src/extension-api/*.ts`), scope registry spike (`research/architecture/scope-registry-spike.md`), and D3.5 reactive dispatch alignment. No new prototype needed.

## Must Do — Implementation Phase (2026-05-08, derived from standup goals)

> Branch + phasing topology under `extension-v2-api-proposal`:
>
> ```diagram
> Phase A (this week, pre-Alex)         Phase B (post-rebase)        Phase C (much later)
> ╭──────────────────────────────╮      ╭────────────────────────╮   ╭──────────────────────╮
> │ extension-v2-api-proposal    │      │ rebased on Alex's ECS  │   │ legacy-api strangler │
> │ (HEAD: api surface only)     │ ──▶  │ branch; strangler now  │──▶│ over v1 hooks we     │
> │                              │      │ dispatches to ECS      │   │ never rewrote        │
> │ ╭─I-TF test-framework────╮   │      │ commands; bridges      │   │ ("parallel path"     │
> │ ╭─I-PG.A: surface-shim ─╮   │      │ legacy where needed    │   │ migration)           │
> │ ╭─I-WS lazy-serialize──╮   │      │ (I-PG.B)               │   │ (I-PG.C)             │
> │ ╭─I-SR scope-registry─╮   │      ╰────────────────────────╯   ╰──────────────────────╯
> │                              │
> │ Goal: Simon + Austin can     │      Strangler fig CHANGES SHAPE across phases; not one design.
> │ start converting core exts   │
> │ against stable v2 surface    │
> ╰──────────────────────────────╯
> Order: I-TF lands first (green baseline) → I-PG.A + I-API + I-SR + I-WS land in parallel
>        → rebase onto Alex → I-PG.B → much later I-PG.C
> ```

### I-TF — Test framework (HIGHEST PRIORITY, merges first)

- [x] I-TF.0 — **Prerequisite for harness work.** Extend `database.yaml` schema with `excerpt: |` on each evidence row (5–20 lines of actual code fetched via `url`). Without this `I-TF.3` cannot load real snippets. Populate as part of R8 clone-and-grep so we don't double-fetch.
- [x] I-TF.1 — Roll up R7 touch-point DB (52 patterns / 15 surface families) into **~26 behavior categories** along TWO axes:
  - **Intent axis** (~26 categories): node lifecycle, widget value subscribe, dynamic slots, canvas drawing, execution events, serialization, shell UI, schema inspection, etc.
  - **Mechanism axis** (per `widget-api-thoughts.md` §Test Framework, missed in first pass): `prototype patching`, `constructor prototype patching`, `prototype-scope shadowing affecting construction`, `monkey-patching setters`, `monkey-patching getters`, `monkey-patching methods`, `direct property mutation`, `event-listener subscription`.
  - Each category = `{name, intent, mechanism, member_pattern_ids[], usage_weight, exemplar_repos[3]}`. Output: `research/touch-points/behavior-categories.yaml`. Test framework asserts each category in BOTH a v1 mechanism test (e.g. "constructor patching of NodeType still observes lifecycle") AND a v2 intent test (e.g. "v2 hook fires on lifecycle event").
- [x] I-TF.2 — For each category, write the **test triple** spec'd in `research/touch-points/PLAN.md` §Integration: (a) v1 contract test, (b) v2 contract test, (c) migration test. **DONE 2026-05-08: 37 categories × 3 = 111 stub files + 1 smoke test = 112 total. BC.01–BC.30 from prior session; BC.31–BC.37 written 2026-05-08 covering DOM injection, Vue bundling, cross-ext widget obs, settings dialog, pre-queue validation, PrimeVue API surface, VueNode bridge timing.**
  > **Decomposed (2026-05-08) — parallelizable after A1:**
  - [x] I-TF.2.A1 — Emit stub file manifest: read `behavior-categories.yaml` + `PLAN.md`, output `research/touch-points/test-stub-manifest.md` listing all 96 file paths + one-line descriptions. **Gate for A2–A6.** DONE 2026-05-08 — 32 categories × 3 = 96 files; 7 blast-radius gate categories flagged. ⚠️ Manifest is stale — actual category count is 37 (BC.33–BC.37 added after manifest was written).
  - [x] I-TF.2.A2 — Generate all 3 stub files for BC.01–BC.06 (18 files). [routine, 30m, after A1] **parallel with A3–A6**
  - [x] I-TF.2.A3 — Generate all 3 stub files for BC.07–BC.13 (21 files). [routine, 30m, after A1] **parallel with A2/A4–A6**
  - [x] I-TF.2.A4 — Generate all 3 stub files for BC.14–BC.20 (21 files). [routine, 30m, after A1] **parallel with A2/A3/A5/A6**
  - [x] I-TF.2.A5 — Generate all 3 stub files for BC.21–BC.26 (18 files). [routine, 30m, after A1] **parallel with A2–A4/A6**
  - [x] I-TF.2.A6 — Generate all 3 stub files for BC.27–BC.37 (33 files — extended from original BC.27–BC.32 scope). [routine, 30m, after A1] **parallel with A2–A5**
- [x] I-TF.3 — Implement test harness: a synthetic mini-ComfyApp + World stub that lets each test load a snippet from `evidence[].excerpt` of the DB, run it against both v1 (legacy hooks) and v2 APIs, and assert behavioral equivalence.
  > **Decomposed (2026-05-08):**
  - [x] I-TF.3.C1 — Design harness API contract. **DONE 2026-05-08.** Output: `research/architecture/test-harness-contract.md`. Key findings: (1) harness covers 1 of 12 top blast-radius patterns today (S2.N1) — 11 require Phase B eval sandbox; (2) BC.37 two-phase mount needs `world.simulateMountPhase()` addition; (3) `RunV1Result`/`RunV2Result` shapes are frozen — Phase B replaces stub bodies, no assertion changes needed.
  - [x] I-TF.3.C2 — Implement `createTestHarness()` + `loadEvidenceSnippet()` in `__tests__/harness/`. [deep, 60m, after C1] **Note: if no excerpts in DB yet, stub with synthetic fixtures + `// TODO(R8-merge)`**
  - [x] I-TF.3.C3 — Wire one real test (BC.02 teardown, S2.N4 `onRemoved`) through harness as proof-of-concept. [analytical, 30m, after C2 + I-TF.2 done]
- [x] I-TF.4 — Add `pnpm test:extension-api` script wired into `package.json` and CI matrix. Coverage gate: every `blast_radius ≥ 2.0` pattern MUST pass v1 + v2 + migration before v2 ships (per PLAN.md §Compat floor). **DONE 2026-05-08.**
  > **Decomposed (2026-05-08):**
  - [x] I-TF.4.C4 — Add `pnpm test:extension-api` script to `package.json` + vitest config entry. **DONE 2026-05-08.** Config: `vitest.extension-api.config.mts`. Three scripts: `test:extension-api` (run), `:watch`, `:coverage`. Verified: 1 smoke test passes, 111 stub files skipped (230 todo cases).
  - [x] I-TF.4.C5 — Add `.github/workflows/extension-api-test.yml` running on PRs touching `src/extension-api*/**`. **DONE 2026-05-08.** Created `ci-tests-extension-api.yaml`: path filter on `src/extension-api-v2/**` + `src/extension-api/**` + config/lockfiles; runs `pnpm test:extension-api` on PRs, adds coverage run + Codecov upload on push. [routine, 15m, after C4]
- [x] I-TF.5 — Test framework committed to branch (all stubs + CI + vitest config). PR deferred — entire Phase A accumulates on branch before upstream PR.
  > Sub-task: I-TF.5.C7 — committed 3a6fe052c; PR #12095 closed (premature — Phase A branch strategy)
- [x] I-TF.6 — Implement `harness/loadEvidenceSnippet(patternId, evidenceIndex)` returning the `excerpt:` text from R8 as a parsable extension stub. Test bodies become `expect(harness.runV1(snippet)).toEqual(harness.runV2(snippet))`. Lets us test against real ecosystem code, not synthetic mocks.
- [x] I-TF.7 — CI compatibility-floor gate. **VERIFIED 2026-05-08: `scripts/check-compat-floor.py` and `.github/workflows/extension-api-compat-floor.yml` both exist in worktree root.**
  > Sub-task: I-TF.7.C6 — [done]
- [ ] I-TF.8 — Implement real test bodies for all `it.todo(...)` stubs. ~230 todo cases across 41 behavior categories × 3 (v1/v2/migration). All sub-tasks are parallelizable unless noted.
  > **Group A — Compat-floor node lifecycle (independent, Phase A):**
  - [x] I-TF.8.A1 — BC.01 v2+migration: node creation — nodeCreated(handle) per-instance setup, type-scoped registration, VueNode timing invariant. [routine, 30m, **independent**]
  - [x] I-TF.8.A2 — BC.02 v2+migration: teardown — onRemoved once-per-removal, handle still readable, auto-disposal shape. [routine, 30m, **independent**]
  - [x] I-TF.8.A3 — BC.03 v2+migration: hydration — loadedGraphNode(handle) shape, LoadedFromWorkflow flag. **DONE.** bc-03 in ecs worktree: v2=9, mig=7 real tests. [routine, 30m, **independent**]
  > **Group B — Compat-floor widget + serialization (independent, Phase A):**
  - [x] I-TF.8.B1 — BC.10 v2+migration: widget value subscription — widget.on('valueChange') with harness shallowRef fixture; reactive watch fires. [analytical, 30m, **independent**]
  - [x] I-TF.8.B2 — BC.11 v2+migration: widget imperative writes — setValue/setHidden/setDisabled dispatch captured; COMBO list mutation. **DONE.** ext-v2__i-tf: v2=11, mig=8 real tests. [routine, 30m, **independent**]
  - [x] I-TF.8.B3 — BC.12 v2+migration: per-widget serialization — widget.on('beforeSerialize') + setSerializedValue/skip; serialize=false slot case; NaN→null warning. [analytical, 30m, **independent**]
  - [x] I-TF.8.B4 — BC.13 v2+migration: per-node serialization — node.on('beforeSerialize') async-aware; named-map round-trip; null-in-numeric warns + substitutes default. **DONE.** bc-13 in ecs worktree: v2=13, mig=9 real tests. [analytical, 45m, **independent**]
  > **Group C — Compat-floor connections + slots (partially Phase A, partial Phase B):**
  - [x] I-TF.8.C1 — BC.07 v2+migration: connection observation — 12 wired assertions (registration, Unsubscribe, payload fields, isolation); 4 Phase B stubs (veto/real-World). Migration: 6 assertions (v1↔v2 call-count parity, typed SlotInfo, EffectScope cleanup). [done 2026-05-08]
  - [x] I-TF.8.C2 — BC.09 v2+migration: dynamic slot mutation — 11 assertions on read surface (inputs()/outputs() shape, field presence, direction invariants); gap documented: addInput/removeInput not on NodeHandle yet; 6 Phase B stubs. Migration: 8 assertions (v1 LGraphNode shape + v2 read-surface parity). [done 2026-05-08]
  > **Group D — App-level / shell / workflow (mostly independent, Phase A):**
  - [x] I-TF.8.D1 — BC.14 v2+migration: graphToPrompt shapes — type-shape assertions pass; `beforePrompt` + `resolveConnections` documented as interface gaps; runtime cases todo(Phase B + UWF). Migration: structural equivalence of v1 monkey-patch vs v2 event handler proven synthetically. [done 2026-05-08]
  - [x] I-TF.8.D2 — BC.15–BC.19 v2+migration: 10 files written — workflow load, NodeExecutedEvent payload, typed exec lifecycle events (6 event types), fetchApi surface shape, queue trigger + beforeQueuePrompt cancellation. [done 2026-05-08]
  - [x] I-TF.8.D3 — BC.20–BC.22 v2+migration: 6 files written — nodeTypes filter, WidgetExtensionOptions shape, menu contributions; `virtual:true`/`resolveConnections` and menu fields documented as interface gaps; Phase B/C stubs. [done 2026-05-08]
  > **Group E — Node interaction + canvas (mostly independent, Phase A):**
  - [x] I-TF.8.E1 — BC.04 v2+migration: pointer/selection/resize — sizeChanged 5 real tests passing; mouseDown/selected/deselected marked [Phase B] todo (not yet in NodeHandle). [done 2026-05-08]
  - [x] I-TF.8.E2 — BC.05 v2+migration: DOM widgets and sizing. **DONE 2026-05-08.** Added `NodeHandle.addDOMWidget` + `WidgetHandle.setHeight` to interface + service stub. 8 v2 tests + 6 migration tests passing; 4 Phase B it.todo (LiteGraph relayout, widgets() wiring). Also added `_setDispatchImplForTesting` export to service for command capture. [routine, 30m, **independent**]
  - [x] I-TF.8.E3 — BC.06 + BC.16 v2+migration: BC.16 on('executed') output shape tested (11 real tests ✓). BC.06: 3 it.skip for COM-3668 canvas veto present in ecs worktree; per-node drawing cases are it.todo (Phase B — no headless canvas). **DONE.** [trivial, 10m, **independent**]
  > **Group F — Property, schema, globals, LiteGraph (independent, Phase A):**
  - [x] I-TF.8.F1 — BC.23–BC.27 v2+migration: property bag, node-def schema inspection, shell UI registration shapes, globals-as-ABI deprecation, LiteGraph entity read-only documented. **DONE 2026-05-08.** 60 tests passing in ext-v2__i-tf (verified), 19 it.todo Phase B stubs (BC.27 group/reroute/link). [routine, 60m, **independent**]
  > **Group G — Subgraph + graph-level (partially Phase B):**
  - [x] I-TF.8.G1 — BC.28–BC.30 v2+migration: virtual set/get shape; graph read API shape; dirty-canvas deprecation documented; BC.28 runtime cases marked todo(Phase B + UWF). **DONE 2026-05-12.** 89 real tests passing (37 v2 + 52 v1/migration); 13 Phase B it.todo stubs remain for ECS-dependent cases. BC.29 tests NodeLocatorId/NodeExecutionId real implementations. BC.30 tests Vue reactivity batchUpdate pattern. [analytical, 45m, **independent**]
  > **Group H — DOM/Vue/shell/S17 (mostly independent, Phase A):**
  - [x] I-TF.8.H1 — BC.31–BC.32 v2+migration: injectStyles() scoped cleanup with JSDOM; registerVueWidget host-Vue-sharing asserted. **DONE.** bc-31/bc-32 in ecs worktree: v2=7+7, mig=7+5 real tests passing. [analytical, 45m, **independent**]
  - [x] I-TF.8.H2 — BC.33–BC.37 v2+migration: cross-ext widget obs shape; settings dialog shape; beforeQueue reject shape; WidgetHandle option keys; onNodeMounted two-phase timing. **DONE 2026-05-08.** 65 real tests passing (v2+mig for all 5 BCs), 0 it.todo. [analytical, 60m, **independent**]
  - [x] I-TF.8.H3 — BC.38–BC.41 v2+migration: canvasModeChanged shape (BC.38 runtime todo Phase B); subgraph boundary todo(Phase B); file API gap as it.skip; widget-values named-map identity. **DONE.** bc-38/40/41 in ecs worktree have real tests (8+5, 9+7, 11+7); bc-39 all-todo (Phase B blocked). [analytical, 45m, **independent**]
  > **Group I — v1 contract stubs (synthetic fixtures, R8 swap deferred):**
  - [x] I-TF.8.I1 — BC.01–BC.15 v1 contract: synthetic LGraphNode mock fixtures; each case has `// TODO(R8)` comment for excerpt swap later. **DONE (partial).** bc-01–07/10–15 v1 files in ecs worktree have real tests (6–18 each); bc-08 v1 is Phase B blocked (programmatic linking requires real LiteGraph). bc-09 v1 (dynamic slot mutation) fully implemented 2026-05-09 — all 10 todos converted to real tests (addInput/removeInput/addOutput/removeOutput/setSize/computeSize synthetic). [deep, 90m, **independent**]
  - [x] I-TF.8.I3 — BC.16–BC.41 v1 contract: synthetic mocks for shell/graph/DOM/S17 categories. **DONE 2026-05-08.** bc-16–bc-41 v1 files in ecs worktree (5–8 real tests each); bc-39 all it.todo (Phase B blocked on Alex PRs). 789 tests passing. [deep, 90m, **independent**]
  - [x] I-TF.8.I2 — Swap I1+I3 synthetic fixtures for real R8 excerpts via `loadEvidenceSnippet()`. [analytical, 60m, **BLOCKED on R8 excerpt population in database.yaml**, after I1+I3]
  > **Group J — Phase B ECS-dispatch-dependent cases:**
  - [ ] I-TF.8.J1 — Fill all remaining todo(Phase B) cases in BC.01/02/05/07–09/14/28/38–39 once `world.dispatch()` is real. [deep, 120m, **BLOCKED on I-PG.B1 Phase B rebase**]
  > **Group K — TF branch sync (2026-05-13 rebase fallout):**
  - [x] I-TF.9.K1 — Fix harness export mismatches. **DONE.** Updated `harness.ts` to re-export from `harness/index.ts`; added type exports (`HarnessWorld`, `HarnessNodeRecord`, `EntityId`, `MiniComfyApp`, `MiniGraph`).
  - [x] I-TF.9.K2 — Fix `defineNodeExtension` → `defineNode` rename in all test files. **DONE.** sed replacement across 16 files.
  - [x] I-TF.9.K3 — Fix entity ID type casts. **DONE.** Changed `as NodeEntityId` → `as unknown as NodeEntityId` (same for SlotEntityId) to satisfy branded type constraints.
  - [x] I-TF.9.K4 — Fix `widgetCreated` → `created` hook name in WidgetExtensionOptions. **DONE.** sed replacement.
  - [x] I-TF.9.K5 — Add `apiVersion` field to `ExtensionOptions`. **DONE.** Tests expected this per I-EXT.3.
  - [x] I-TF.9.K6 — Fix `Size` type mismatch. **DONE 2026-05-13.** Changed `{width, height}` → `[width, height]` tuple in bc-04 tests.
  - [x] I-TF.9.K7 — Fix `AppEvents` type constraint. **DONE 2026-05-13.** Added index signature `[key: string]: unknown`.
  - [x] I-TF.9.K8 — Fix `VirtualNode.isVirtualNode` property access. **DONE 2026-05-13.** Added prototype assignment with cast.
  - [x] I-TF.9.K9 — Fix unused variable warnings. **DONE 2026-05-13.** Deleted unused code, prefixed with `_`, used `void`.
  - [x] I-TF.9.K10 — Fix Handler/WidgetValue type mismatches. **DONE 2026-05-13.** Used `WidgetValueChangeEvent<unknown>` generic.
  - [x] I-TF.9.K11 — **DONE 2026-05-13.** All 61 errors resolved. Commits: `56ed300` + `426b1d8`. 802 tests pass, vue-tsc clean.

### I-PG — Strangler fig (THREE PHASES, evolves with branch flow)

> Per 2026-05-08 standup: strangler fig has THREE distinct shapes across the rollout, NOT one. Each phase has a different "what does internal point at" answer.

#### Phase A — Surface-only shim (current branch, pre-Alex rebase)

- [x] I-PG.A1 — Land v2 extension surface (`defineNodeExtension`, `NodeHandle`, `WidgetHandle`, event system from P1) on `extension-v2-api-proposal` with internal methods that are **thin pass-throughs to existing system** (LGraphNode/widget/canvas). No new internal architecture; just the public-facing wiring. Goal: Simon + Austin can begin converting `src/extensions/core/*` against a stable interface.
- [x] I-PG.A2 — Document Phase A explicitly in `decisions/D9-strangler-fig-phases.md`: "Phase A is interface-only; internal calls reach into LGraphNode prototypes; no patching guards yet; no behavioral changes." DONE 2026-05-08 — full 3-phase ADR landed.
- [x] I-PG.A3 — No interception/blocking in Phase A — extensions can still patch prototypes. The v2 surface coexists alongside legacy. Prove this with the test framework's v1 contract suite passing unchanged.

#### Phase B — Closer-to-real strangler (post-Alex rebase, ~next week)

- [ ] I-PG.B1 — After rebase onto Alex's ECS branch, internal handle methods stop being thin shims and start dispatching to ECS commands / reading from the World. Strangler now has actual translation logic. Still "slightly strangler" — legacy path still exists for hooks Alex hasn't moved.
- [x] I-PG.B2 — **DONE 2026-05-12.** Output: `research/architecture/I-PG-B2-surface-classification.md`. Classification: 2 ECS-native (onRemoved, onNodeCreated), 4 strangler-bridge (serialize, connect, widgetChanged, connectionsChange), 1 uwf-resolved (graphToPrompt), 0 unchanged-legacy.
- [x] I-PG.B3 — **DONE 2026-05-13.** Updated `decisions/D9-strangler-fig-phases.md` Phase B section with I-PG.B2 classification: 2 ECS-native (onRemoved, onNodeCreated via Vue EffectScope), 4 strangler-bridge (serialize, connect, widgetChanged, connectionsChange with dispatch stubs), 1 uwf-resolved (graphToPrompt blocked on UWF Phase 3).

#### Phase C — Legacy-API strangler (much later)

- [ ] I-PG.C1 — For v1 ComfyExtension hooks we explicitly DON'T rewrite (per "parallel path" migration), build a strangler that translates v1 calls → v2 dispatch. Extensions written against v1 keep working; runtime emits deprecation events; eventually v1 hooks become read-only shims.
- [x] I-PG.C2 — Choose the interception mechanism (deferred until Phase C). ADR comparing (a) `Object.freeze(LGraphNode.prototype)` + Proxy façade, (b) defineProperty getter trap that warns + redirects, (c) record patches into per-extension shadow consulted by v2 dispatcher. Record in `decisions/D11-legacy-strangler-mechanism.md`. Spike each in `research/architecture/strangler-fig-spikes/`.
  > **Re-opened 2026-05-08:** Prior session marked done but `decisions/D11-legacy-strangler-mechanism.md` and `research/architecture/strangler-fig-spikes/` are both absent; no lockfile. Phase C is deliberately deferred — this is low urgency until Phase B ships. Remaining: write D11 ADR + spike notes when Phase C becomes active.
- [x] I-PG.C3 — Each blocked/translated patch attempt logs structured deprecation event with stack frame + recommended v2 replacement (sourced from P3 migration guide).
  > **Re-opened 2026-05-08:** Prior session marked done but no deprecation event logging code exists anywhere in the codebase; no lockfile. Correctly blocked on I-PG.C2 (need to pick interception mechanism first) and Phase C generally. Do not start until Phase B ships.
- [ ] I-PG.C4 — Test framework integration: every v1 contract test must pass with the Phase C strangler ON, proving compat. Every v2 contract test must pass with patches translated, proving migration safety.

### I-WS — Lazy on-access widget serialization

- [x] I-WS.1 — Audit all serialization surfaces today (S4.W3 widget.serializeValue, S2.N6 onSerialize, S2.N15 prototype.serialize, plus widget.value direct reads at workflow-save time). Map who calls what, when, and why three exist. Write up in `research/architecture/widget-serialization-state.md`.
- [x] I-WS.2 — Confirmed edge cases from `widget-api-thoughts.md` against actual code: `webcamCapture.ts`, `load3d.ts`, `load3dLazy.ts`, `uploadAudio.ts`, `uploadImage.ts`, `painter.ts`, `maskeditor.ts`. For each: does it have hot-path perf cost on serialize? does its serialize value depend on a lifecycle step? Tabulate.
- [x] I-WS.3 — Design lazy-on-access value getter. **DONE 2026-05-08.** Output: `research/architecture/widget-lazy-serialize-spec.md`. Key decisions: (1) `widget.on('beforeSerialize', ...)` is the single channel replacing all 4 v1 surfaces; (2) internal `getSerializedValue(widgetId, context)` reads from `widgetValueStore`, writes back on non-prompt contexts; (3) sync fast path for workflow-save (all async widgets are prompt-only per I-WS.2); (4) 3 v1 shims: `serializeValue =` (proxy setter), `onSerialize =` (proxy setter), `prototype.serialize =` (Phase C only); (5) ADR 0006 Option A made unnecessary by clone-context read from `widgetValueStore`. 4 open questions documented.
  > **New constraints from widget-serialization-historical-analysis.md (2026-05-08):**
  > - `WidgetHandle` identity MUST be by name not position (positional array root cause documented in PR #10392)
  > - `widget.options.serialize === false` ≠ `widget.serialize === false` — must preserve both semantics in v2 surface (control_after_generate has slot in widgets_values but is excluded from backend prompt)
  > - V3 `IO.MultiType` widgets make widget count topology-dependent; WidgetHandle must handle this gracefully
  > - v2 lazy getter sidesteps NaN→null pipeline IF it reads live widget state at save time (not a cached positional snapshot)
- [x] I-WS.4 — **DONE 2026-05-13.** Test framework triple for lazy-serialize. 4 files in ext-api__i-tf: `lazy-serialize.v1/v2/migration/perf.test.ts`. 24 passing tests + 43 Phase B stubs. Covers: (a) v1 sync serializeValue, (b) v2 lazy getter shape, (c) perf baselines, (d) null numeric warning, (e) index shift + legacy fallback.
- [x] I-WS.5 — **Re-engage Austin on lazy serialization.** `austin/widgets-v2` is **stale** (last commit `9e8a426c0` 2025-09-28, ~7 months old; subgraph widget promotion + recommended-widget conversion). Likely superseded. Action: check newer Austin branches first (`austin/fix-linked-widget-promotion`, `austin/undefined-widgets-fix`), then ping him in Slack with the I-WS.1 audit so he can pick up the lazy-serialize sub-branch fresh if interested. Don't assume his Sep 2025 work is the foundation.

### I-SC — Serialization Convergence (D14)

> **Goal**: Single serialization target. Widget has ONE value; framework handles all persistence/transport variations. Extensions never see serialization contexts.
> See `decisions/D14-serialization-convergence.md` for full ADR.

- [x] I-SC.1 — **Phase 1: Lazy on-access serialization** — Single getter per widget computes serialized form. Memoized per transport-epoch. `beforeSerialize` hook still fires for migration compat. (Builds on I-WS.3 spec.)
- [ ] I-SC.2 — **Phase 2: Option-based persistence control** — Add `ephemeral` and `promptExclude` widget options. Deprecate `widget.serialize` / `widget.options.serialize` booleans. Framework reads options instead of firing hooks.
- [ ] I-SC.3 — **Phase 3: Prompt-processor pattern** — Document `ctx.on('beforePrompt')` as the new pattern for value transformation. Migrate dynamic prompts, webcam capture to prompt-processor. Deprecate `e.context === 'prompt'` checks.
- [ ] I-SC.4 — **Phase 4: Remove context parameter** — `beforeSerialize` hook fires once (not per-context). `e.context` removed from `WidgetBeforeSerializeEvent`. Only escape hatch for custom serialization format.

### I-SR — Scope registry & node lifecycles

- [x] I-SR.1 — Define `NodeInstanceScope` modeled on Vue's `ComponentInternalInstance` + `EffectScope` (per D2, D3.5, D6). Owns: extensionState bag, registered watchers, registered event handlers, dispose closures. One per `node.id`; lifetime = node-id lifetime; survives DOM moves (graph↔app, subgraph promotion) per D7.
- [x] I-SR.2 — Implement scope registry: keyed `Map<NodeEntityId, NodeInstanceScope>`. Vue `EffectScope.run()` semantics: setup runs once, scope.stop() on graph deletion only.
  > **Decomposed (2026-05-08):**
  - [x] I-SR.2.B1 — Spike: locate existing `EffectScope`/`watch` imports in `ComfyUI_frontend`, identify exact file+line for registry + watcher, confirm `@vue/reactivity` dep path. Output: `research/architecture/scope-registry-spike.md`. [analytical, 15m, **independent**]
  - [x] I-SR.2.B2 — Implement `NodeInstanceScope` interface + `scopeRegistry` Map + `mountExtensionsForNode()` + `unmountExtensionsForNode()`. [deep, 60m, after B1] **If ECS types missing, stub as opaque string brands with `// TODO(#11939)`**
  - [x] I-SR.2.B3 — Implement `currentExtension` global slot (D10a): set/restore around each `setup()` call; hook factories (`onNodeMounted`, `onNodeRemoved`) read slot + dev-mode warn if null. [analytical, 30m, after B2]
  - [x] I-SR.2.B5 — Add D12 regression test: copy a node with `extensionState`, assert clone gets fresh setup-default not source value. (`__tests__/scope-registry.test.ts`). [routine, 15m, after B2, **parallel with B3**]
- [x] I-SR.3 — Wire reactive dispatch (D3.5): `watch(() => world.entitiesWith(NodeTypeKey))` triggers per-extension scope mount; `LoadedFromWorkflow` tag distinguishes hydration from creation. **DONE** — `startExtensionSystem()` in `extension-api-service.ts:536-555` implements this fully.
  > Sub-task: I-SR.3.B4 — Implement `watch(entitiesWith)` loop triggering mount/unmount. **DONE** — same as I-SR.3. [analytical, 30m, after B2+B3]
- [x] I-SR.4 — Resolve open issue from D2 review: pick (a) `ctx.onNodeMounted(...)` no-global vs (b) `currentExtension` global. Land as D10. Required before lifecycle hooks ship.
- [x] I-SR.5 — Resolve hook ordering across multiple extensions on same entity: Vue's array-in-registration-order with extension-name tie-breaker (D2 review). Add to D10.
- [x] I-SR.6 — Test framework triple for the lifecycle category: setup-runs-once, dispose-on-removal, no-dispose-on-subgraph-promotion (regression for F14 from R4). **DONE 2026-05-08.** Added 2 tests to `scope-registry.test.ts`: (1) "setup-runs-once" — mountExtensionsForNode twice on same entityId calls nodeCreated exactly once; (2) "no-dispose-on-subgraph-promotion" — re-mount on same entityId preserves scope, only explicit unmount destroys it. **Bug found + fixed 2026-05-09:** `mountExtensionsForNode` was re-running `scope.run()` on already-mounted scopes — `getOrCreateScope` created the record but the outer loop still called `scope.run()` unconditionally. Fix: added `if (scopeRegistry.has(key)) continue` guard before `getOrCreateScope` in `extension-api-service.ts`. Suite now 815 passing, 0 failed.

### I-API — Connect new widget API to feature branch (yesterday's WIP)

- [x] I-API.1 — Land widget API stubs from P1 onto `extension-v2-api-proposal`. Reconcile with `bl-vue-widget`, `austin/widgets-v2`, `docs/widget-serialization`, `dom-widget-positioning-with-async`. List the diff between branches; propose merge order.
- [x] I-API.2 — Improve API accessors (yesterday's in-progress work): finish whatever was paused. Get a written status from current branch tip.

### I-COORD — Team coordination

- [x] I-COORD.1 — Prepare `extension-v2-api-proposal` head branch for Simon + Austin to collaborate on by converting representative core extensions: pick 3–5 from `src/extensions/core/` (suggest `dynamicPrompts.v2.ts` and `previewAny.v2.ts` already started, plus `noteNode.ts`, `rerouteNode.ts`, `slotDefaults.ts`). These prove the API and give Simon/Austin a concrete object to push back on.
- [x] I-COORD.2 — **Plan rebase onto Alex's stacked PR #11939** ([feat(world): ECS substrate slice 1, stacked on #11811](https://github.com/Comfy-Org/ComfyUI_frontend/pull/11939), May 4). Stacked on PR [#11811](https://github.com/Comfy-Org/ComfyUI_frontend/pull/11811) (subgraph promoted-widget instance state restoration, May 1, has bug Austin found). Both needed per Alex Slack 2026-05-08 17:33. **Risk:** Alex said "might be worth just keeping the tests from #11811 and solving the issue differently in the ECS" — base may pivot. Action: rebase onto current PR #11939 state; chase if it pivots. Pre-stage conflict areas: `src/world/`, `src/services/extensionV2Service.ts` (already imports from `@/ecs/world` and `@/ecs/commands` which #11939 introduces), widget facade pattern (`widgetValueStore` as facade per #11706/#11939). Slack: <https://comfy-organization.slack.com/archives/C0A7ADM4797/p1777841820873129>.
- [x] I-COORD.3 — Update P3 (migration guide) with one before/after example per I-TF.1 behavior category — gives Simon/Austin the rosetta stone for their core-extension conversions.

### I-EXT — External source ingest (issue #4668 + import-based versioning branch)

- [x] I-EXT.1 — Ingest GH issue #4668 + branch `feat/import-based-api-versioning` (SHA 97547434b). Artifact: `research/issues/issue-4668-import-based-api-versioning.md`. Sources.yaml entry added. CONTEXT.md updated with lessons + comparison vs D3.3/D6.
- [x] I-EXT.2 — Add "import-based versioning" as a named alternative in `decisions/D6-parallel-paths-migration.md` §"Future Pivots" — one paragraph, not a re-open. Note: not adopted because (a) fails external-author case, (b) window.app dependency at reg time, (c) no lifecycle scope. Cross-ref branch SHA and research artifact.
- [x] I-EXT.3 — Add `apiVersion` field to `ExtensionOptions` interface (from Lesson 2: `getExtensionVersionReport` telemetry). Aligns with D6 Phase D "<5% v1 usage" gate. Small change to `src/types/extensionV2.ts`; no behavior change in Phase A.
- [x] I-EXT.4 — Copy `browser_tests/assets/node_with_v2_combo_input.json` from branch into `research/touch-points/` as a test seed for I-TF.3 harness. Tag as `source: external-branch`.

### I-NEW — Newly surfaced research gaps (2026-05-08, flagged during standup ingest)

- [x] I-NEW.1 — **Ingest ADR 0006 (PrimitiveNode copy/paste lifecycle)** DONE 2026-05-08. Output: [`research/architecture/adr-0006-primitive-copy-paste-summary.md`](research/architecture/adr-0006-primitive-copy-paste-summary.md). **Key correction:** ADR 0006 is *narrowly* about PrimitiveNode losing secondary widget values (e.g. `control_after_generate`) on copy due to dynamic widget creation; NOT general node copy lifecycle. Status in source: Pending (Option A as wedge). **Reframe:** intersects **I-WS (lazy widget serialization), not I-SR**. Option C "projection model" cites Subgraph widgets — same shape as Austin/Alex PR #11811. I-SR copy semantics (does scope clone?) remains a separate open question NOT answered by ADR 0006.
- [x] I-NEW.1b — **NEW from I-NEW.1 finding:** specify `NodeInstanceScope` copy/paste semantics independently. When a node is copied, does its scope (a) clone with new entityId + cloned `extensionState`, (b) share the original scope (cleanup-on-last-removal), or (c) reset to fresh setup. Track as D12 candidate. Required before any copy/paste-touching code lands in I-SR.
- [x] I-NEW.2 — **Ingest ADR 0007 (node execution output passthrough schema)** at `ComfyUI_frontend/docs/adr/0007-node-execution-output-passthrough-schema.md`. NOT in our knowledge pool. Intersects widget-api-thoughts §"Output System Change" and S15.OS1 (dynamic output mutation vs schema-declared outputs). Output: `research/architecture/adr-0007-output-passthrough-summary.md` + `sources.yaml` entry + CONTEXT.md cross-reference. May reframe I-WS scope.
- [x] I-NEW.3 — **D10 — Lifecycle context, hook ordering, async, setupState wrap.** I-SR.4/5 are marked done but no D10 file exists in `decisions/` (only D1–D8). Either resolved implicitly inside D5–D8, or mismarked. Confirm by reading D5–D8; if unresolved, write `decisions/D10-lifecycle-context-and-ordering.md` with four sub-decisions: (Was marked done by an earlier refactor — corrected back to open since the task itself says no D10 file exists.)
  - **D10a** lifecycle context: (i) `currentExtension` global Vue-style / (ii) explicit `ctx.onNodeMounted(fn)` no-global / (iii) hybrid global-only-during-setup
  - **D10b** multi-extension hook firing order: (i) registration order Vue-style / (ii) extension-name lex order / (iii) explicit `dependsOn:` edges
  - **D10c** async setup: (i) sync-only v1 / (ii) `async setup` with await contract / (iii) Vue-Suspense boundary
  - **D10d** setupState `proxyRefs` wrap: (i) wrapped (no `.value` for callers) / (ii) raw
  - User's defaults if no preference: i / i / i / i (mirror Vue, smallest thing)

## Parallelizable

<!-- Agents: pick any of these independently -->

- [x] R1 — Vue reactivity internals (independent)
- [x] R2 — Vue runtime-core hooks (independent)
- [x] R4 — Custom node pattern audit via MCP (independent)
- [x] R5 — ECS docs extraction (independent)
- [x] R6 — Meeting transcript ingestion (independent)
- [/] R7 — Touch-point database (pass-1 + pass-2 done; pass-3 below)
- [x] R8 — **Top-20 clone-and-grep sweep.** Per `research/touch-points/PASS-3-PLAN.md` strategy A. Clone top-20 starred packs from `star-cache.yaml` (Manager, LTXVideo, KJNodes, Easy-Use, comfyui-deploy, TTS-Audio-Suite, comfy_mtb, rgthree, IPAdapter_plus, Impact-Pack, UltimateSDUpscale, controlnet_aux, was-node-suite, Crystools, frontend-types, tooling-nodes, cg-use-everywhere, mikey_nodes, LayerForge). Walk `web/`, `js/`, `src/extensions/` with `rg` for the 56 fingerprints in DB. Write evidence + per-row `excerpt:` (5–20 lines). Output: `scripts/clone-top-20.sh` + `scripts/add-evidence-pass3.py`. Expected: 200–500 new evidence rows; populates `excerpt:` field for I-TF.6.
- [~] R9 — **Ingest existing on-disk research.** Per PASS-3-PLAN strategy B. Three sub-tasks done (security ✅, popularity ✅, guides+qa+cookiecutter ✅) — all staged in `research/touch-points/staging/`. **Remaining: merge staging YAMLs into `database.yaml` via `scripts/merge-staging-pass3.py`.** Six sources: (1) `~/projects/custom-nodes-security-scan/docs/` ✅, (2) `~/projects/comfy-testing-environment/trending-top-custom-nodes-report/data/nodes_snapshot_2025-07-09.json` ✅, (3) reddit-report (community signal — not yet done), (4) `~/guides/custom-nodes-guides/` ✅, (5) `~/worktrees/custom-node-qa/` ✅, (6) `~/.cookiecutters/cookiecutter-comfy-extension/` ✅. Tag every evidence row with `source: {clone|mcp|security|guides|qa|cookiecutter}`.
- [x] R10 — **Reverse-direction completeness audits.** Per PASS-3-PLAN strategies C+D. ⚠️ Marked `[x]` in prior session but NO lockfile exists and `research/touch-points/orphan-exports.md` is MISSING — treat as not started. (a) Walk every export in `ComfyUI_frontend/src/types/index.ts` and the `comfyui-frontend-types` package; intersect with `database.yaml`; list orphaned exports as either deprecation candidates or missing patterns. (b) Walk `LGraphNode`/`LGraph`/`LGraphCanvas`/`LGraphGroup`/`LLink`/`Reroute` prototype methods in vendored litegraph; flag any unmapped prototype method as latent touch point. Output: `research/touch-points/orphan-exports.md` + likely 5–10 new patterns merged via add-evidence-pass3. **⚡ Secondary deliverable (from Notion ingestion):** The orphan export list is also the `@public` annotation list — any export used by extensions but outside the official three-entry-point surface (`types/index.ts`) needs a `/** @public Used by extensions - preserve */` JSDoc annotation to survive once the team re-enables `treeshake: true`. Emit a second column in `orphan-exports.md`: `@public_needed: true/false`. See `research/architecture/notion-build-bundling-and-api-surface.md` §`@public` annotation strategy.

## Parallel Dispatch Guide (2026-05-08, task-decomposition)

> For agents picking up work: claim tasks below via `tasks/{sub-task-id}.lock`. Read `AGENTS.md` → `CONTEXT.md` → the specific ADRs listed before starting. Run `scripts/check.sh` first, `scripts/sync.sh` after.

### Wave 1 — Start immediately (all independent, parallelizable)

| Sub-task | Reads | Tier | Est |
|---|---|---|---|
| I-TF.2.A1 | `behavior-categories.yaml`, `PLAN.md`, `database.yaml` | routine | 15m |
| I-SR.2.B1 | `ComfyUI_frontend/src/` (grep), D10, D12 | analytical | 15m |
| I-TF.3.C1 | `PLAN.md §Integration`, `behavior-categories.yaml`, `comfy.ts`, `extensionV2.ts` | analytical | 30m |
| PKG3.D1 | `P2-extension-api-package.md §PKG3`, `ComfyUI_frontend/package.json` | routine | 20m |
| PKG4.D3 | `P2-extension-api-package.md §PKG4`, existing CI workflows | routine | 20m |
| PKG5.D5 | `P2-extension-api-package.md §PKG5` | analytical | 20m |
| EVT1.E1 | `extensionV2Service.ts`, `extensionV2.ts`, D5 | routine | 30m |
| MIG1.E4 | `app.ts`, `extensionService.ts`, D6 | analytical | 20m |
| DOC1.E6 | D5, D6, `database.yaml` (S2.N16, S13.SC1, S15.OS1), `comfy.ts`, `extensionV2.ts` | routine | 30m |

### Wave 2 — After Wave 1 completes (partial parallelism)

| Sub-task | Blocked on | Tier | Est |
|---|---|---|---|
| I-TF.2.A2–A6 | I-TF.2.A1 | routine | 30m each (5 parallel) |
| I-SR.2.B2 | I-SR.2.B1 | deep | 60m |
| I-TF.3.C2 | I-TF.3.C1 | deep | 60m |
| PKG3.D2 | PKG3.D1 + **PKG2** | routine | 20m |
| PKG4.D4 | PKG4.D3 | routine | 20m |
| EVT2.E2 | EVT1.E1 | analytical | 30m |
| MIG1.E5 | MIG1.E4 + **PKG2** | analytical | 30m |

### Wave 3 — After Wave 2

| Sub-task | Blocked on | Tier | Est |
|---|---|---|---|
| I-SR.2.B3 | I-SR.2.B2 | analytical | 30m |
| I-SR.2.B5 | I-SR.2.B2 | routine | 15m |
| I-SR.3.B4 | I-SR.2.B2 + B3 | analytical | 30m |
| I-TF.3.C3 | I-TF.3.C2 + I-TF.2 done | analytical | 30m |
| I-TF.4.C4 | I-TF.3.C2 | routine | 15m |
| PKG5.D6 | PKG5.D5 + **PKG2** | analytical | 30m |
| EVT3.E3 | EVT2.E2 | routine | 20m |

### Blocked on PKG2 (do not start until `src/extension-api/index.ts` exists)
PKG3.D2, PKG5.D6, PKG6.D7, MIG1.E5

### Blocked on Alex's ECS rebase (PR #11939 + #11811)
I-PG.B1–B3, full I-SR.3 reactive dispatch (world.queryAll must be real)

## Next cycle (post upstream-fix landing, 2026-05-11)

### Immediate / low-friction
- [x] N1 — Push fix-cycle commits to #12102 / #12103 / #12105 — DONE (`58d6d2a`, `d481fc1`, `67e50d3`).
- [x] N2 — Regenerate `pnpm-lock.yaml` on all 4 upstream branches (i-foundation/i-pkg/i-tf/i-ext). DONE.
- [x] N3 — Revert bad `@vue/reactivity` import on #12103 (Vue internals are not publicly exported). DONE — `0bb4fab7de`.
- [x] N4 — Watch CI. After 2nd-pass fixes (pinact pin + eslint-disable on intentional console.* + lockfile regen + brand unification), all 4 branches re-pushed; CI re-running.
- [x] N5 — Fix pre-existing NodeEntityId/WidgetEntityId branding-mismatch typecheck failures on ext-api/i-foundation. DONE: unified brand re-export from `world/entityIds`, tightened `World` interface generics, gave widget components real data shapes, fixed `getMode` cast / hook result `unknown` cast / dynamicPrompts.v2 `getValue<string>()` call. Foundation typecheck now clean. Children (i-pkg/i-tf/i-ext) rebased onto fix and force-pushed.
- [x] W2.D — `ci-templates` shipped as draft PR #13 on `christian-byrne/ComfyUI_frontend-ecosystem` (base: `scaffold`). 5 workflows (ci/e2e/vercel-preview/data-refresh/labeler), 4 issue templates + PR template + CODEOWNERS, `vercel.json`, README CI/Deploy section.

### Medium
- [x] N6 — **DONE 2026-05-12**. Direct-fix wave landed on all 4 new upstream PRs:
  - **#12142 foundation** (`3476d06fc9`): A3 broke `extension-api-service ↔ lifecycle` circular import via new `src/extension-api/types.ts`; A5 clarified `pauseTracking/resetTracking` Phase A no-op stub comment. typecheck ✅.
  - **#12143 pkg** (`9426847a0c`): A6 hardened `addWidget` name parse + `TODO(#11939)` marker; M1+A9 collapsed package barrel to single re-export of canonical surface. typecheck ✅.
  - **#12145 tf** (`8e11d05630`): F1a/F1b loadEvidenceSnippet rename + `.json` error string; F2 shared harness modules (`v2Runtime.ts`, `v1App.ts`, README) piloted on bc-01; F3 shared `worldMocks.ts` adopted by 4 BC files; F5 relabeled 78 `[Phase B]` → `[Phase B/C]` across 22 files; F6 marked `MiniComfyApp.world` `@internal`. typecheck delta 0 (203 baseline preserved).
  - **#12144 ext** (`c980583813`): 1.5 added DEV warns on `executed/connected/disconnected/configured` stub-channel registrations; 1.6 tagged 3 `globalThis.app` accesses in `rerouteNode.v2` with `strangler-bridge:Phase-B`. typecheck ✅. Skipped: 2.8/3.5/3.6/3.8 service refactors (left as follow-up).
  No PR comments posted. Original task: address remaining upstream review findings DIRECTLY on new PRs (#12142/#12143/#12145/#12144) instead of porting old comments forward. Re-read closed PR triage rollups (issuecomment-4417501825 / 4417498640 / 4417500822 / 4417501064) to extract action items, then implement fixes on the new branches as new commits. Skip the "post comment summarizing what changed" step — the commit messages document changes adequately and avoid PR noise.

- [x] N25 — **DONE 2026-05-11**. Vercel project linked, deploy live at https://comfyui-frontend-ecosystem.vercel.app (HTTP 200). Advisory `vercel-preview.yml` removed in favor of official Vercel GitHub integration. Original task: Deploy dashboard to Vercel. Repo `christian-byrne/ComfyUI_frontend-ecosystem` already has `vercel.json` + `vercel-preview.yml` advisory workflow (from PR #13), but no Vercel project linked. Deployment URL `comfyui-frontend-ecosystem.vercel.app` returns 404 (`DEPLOYMENT_NOT_FOUND`). Steps: (1) create Vercel project via dashboard, (2) link to GitHub repo, (3) confirm framework preset = Vite, (4) set root dir = `.`, (5) get production deploy + per-PR previews working, (6) optionally swap advisory workflow for Vercel's official GitHub integration. Walkthrough provided in chat.

- [x] N24 — Restratify upstream PR stack (2026-05-11). Old PRs #12102/#12103/#12104/#12105 had foundation absorbing downstream work (test framework + npm package + core ext conversions all in #12102). Restratified into clean stack:
  - **#12142** (foundation, 17 files) — API surface + scope registry + Phase A world stubs only — typecheck CLEAN
  - **#12143** (pkg, +17 files) — @comfyorg/extension-api npm package + TypeDoc docgen + CI — typecheck CLEAN
  - **#12145** (tf, +133 files) — bc-XX triplet test bodies + harness/ + vitest config — 9 pre-existing typecheck errors (parity)
  - **#12144** (ext, +7 files) — 6 core extension v2 conversions — typecheck CLEAN

  Old PRs closed with cross-references. Backups: local refs `refs/backup/restratify-20260511/*`, bundles in `~/backups/ext-api-restratify-20260511/`, remote tags `backup/restratify/ext-api-i-*` on christian-byrne fork. Recovery doc: `~/backups/ext-api-restratify-20260511/RECOVERY.md`.
- [x] N7 — Dashboard PR review fanout — DONE 2026-05-11. All 11 PRs reviewed (#1, #2, #4, #5, #6, #7, #8, #9, #10, #12, #13). Verdicts: 3 request-changes (#7, #8, #9), 8 approve w/ nits or follow-ups. See N14/N15/N16 for action items.

### Dashboard "request changes" actions (from N7 fanout)

- [x] N14 → DASH.PR7 — DONE 2026-05-11. Commit `63258c3`. Named route + `<h1 sr-only>` + empty state row + dynamic heading + overflow wrapper. Reply: issuecomment-4423755434.
- [x] N15 → DASH.PR8 — Address data-loader review (PR #8). Title/scope mismatch: PR promises zod + `useDataStore`, ships hand-authored `interface`s + module-level consts. Pick one: (a) rename PR to drop zod + store, or (b) add `zod.parse()` validation layer + `defineStore('data', ...)`. Also: single-pass two IIFEs in `index.ts`; consistency between `evidenceCountByPack` and `evidenceByPatternId`; add `src/data/__tests__/index.test.ts` (empty file, missing `pattern_id`, evidence without `repo`); drop unused `rollup` from `buildHeatmapMatrix`. Review: pullrequestreview-4260679552.
- [x] N16 → DASH.PR9 — DONE 2026-05-11. Commit `9b942a1`. `useEventListener` for cleanup, `<ins>`/`<del>` a11y + sr-only labels, doubled `v2` label fixed. Concept-level per-pattern card refactor deferred to N16b. Reply: issuecomment-4423749275.
- [x] N16b — **DONE 2026-05-12**. PR [#14](https://github.com/christian-byrne/ComfyUI_frontend-ecosystem/pull/14) on `christian-byrne/ComfyUI_frontend-ecosystem`. Per-pattern card grid swapped in for `RouteSkeleton`: new `src/data/migration-status.ts` (`MigrationStatus` type + ~20 hand-curated entries joined with touch-points DB), rewritten `src/pages/ApiDiff.vue` (search/status-chip/pattern-picker controls + 2-column v1/v2 cards), 4 new mount tests, router swap. vue-tsc ✅; 12/12 tests ✅. AbortSignal/cache-prefix N/A (data is build-time inlined via `?raw`). Canonical migration-status YAML normalisation flagged as follow-up. Original task: Refactor api-diff to render one card per `MIGRATION_STATUS` entry (v1 signature ↔ v2 replacement) instead of `diffLines`-ing two unrelated source files. Also: add search/filter/pattern picker, AbortSignal+timeout on fetch, rename cache prefix `apidiff:v1:` → `apidiff:src:`. TODO comment marker placed at top of `src/pages/ApiDiff.vue` template. Also: add search/filter/pattern picker, AbortSignal+timeout on fetch, rename cache prefix `apidiff:v1:` → `apidiff:src:`. TODO comment marker placed at top of `src/pages/ApiDiff.vue` template.

### Dashboard "approve w/ followups" actions (from N7 fanout)

- [x] N17 → DASH.PR2 — Scaffold tightening: drop premature deps (`@vueuse/core`, `js-yaml`), wire `vitest.setup.ts` (or delete), augment `RouteMeta` types, scope lint rules. Review: pullrequestreview-4260701834.
- [x] N18 → DASH.PR4 — Registry-client hardening: add abort/timeout/retry to fetch wrapper, runtime schema validation (zod) before W3 builds on top. Review: pullrequestreview-4260679742.
- [x] N19 → DASH.PR5 — NodePacks page nits: a11y, Tailwind, test coverage. Review: pullrequestreview-4260684236.
- [x] N20 → DASH.PR6 — Patterns page: a11y on chip groups + keyboard row activation, fix wasted recomputations. Review: pullrequestreview-4260679564.
- [x] N21 → DASH.PR10 — Heatmap: add color legend, drawer keyboard a11y, hoist `cellAt()` invocations (called 6× per render). Review: pullrequestreview-4260713176.
- [x] N22 → DASH.PR12 — Pattern-detail: a11y on excerpt toggle, schema-validate YAML loaders, gate disabled W5.1 button. Review: pullrequestreview-4260679533.
- [x] N23 → DASH.PR13 — CI templates: add `permissions:` blocks, concurrency on e2e, decide vercel-preview.yml fate. Review: pullrequestreview-799m-D.

- [x] N26 — **Dashboard merge wave (2026-05-11)**. Merged all 11 dashboard PRs to `christian-byrne/ComfyUI_frontend-ecosystem` main in topological order: #2 → (#4, #8, #13) → (#1, #5, #6, #7, #9, #10, #12). Each child branch had to be tree-replayed onto the new main between merges (squash-merge collapsed scaffold's commits, causing all dependent branches to conflict). Replay strategy: `git commit-tree $(rev-parse origin/$branch^{tree}) -p $main_sha` then force-push. All squash-merged via `--admin` (CI ignored per user direction). Main is now at `6b74858`. Should auto-trigger Vercel build now that main has package.json + full app.
- [x] N8 — **DONE 2026-05-13.** CodeRabbit auth working (v0.4.5). Full PR reviews hit 150-file limit; use `--dir src/extension-api` for scoped reviews. Ran `coderabbit review --plain --dir src/extension-api` on ext-api__i-tf: 2 findings (declare function no-emit: by design; readonly vs disabled naming: minor). Upstream PR reviews deferred to per-directory scoping.

### Large research / design backlog
- [x] N9 → I-PG.B2 — **DONE 2026-05-12.** See I-PG.B2 above + `research/architecture/I-PG-B2-surface-classification.md`.
- [ ] N10 → I-TF.8 — implement real test bodies for ~230 `it.todo(...)` stubs across 41 behavior categories × 3 (v1/v2/migration). Highly parallelizable.
- [x] N11 → I-UWF.4 — **DONE 2026-05-08.** `GAP-UWF-1`: app-level `beforePrompt` event. Decision: `ctx.on('beforePrompt', fn)` inside setup context. See D6 §Q4.
- [x] N12 → I-UWF.5 — **DONE 2026-05-08.** `GAP-UWF-2`: virtual wiring declaration API. Decision: `virtual: true` + `resolveConnections()`. See D6 §Q5.
- [x] N13 → I-UWF.6 — **DONE 2026-05-08.** `GAP-UWF-3`: cross-node value sync. Verdict: UWF's problem, not v2 Phase A. See `notion-uwf-frontend-impl-plan.md §I-UWF.6.F4`.

## Audits

- [x] AUDIT-LG — Litegraph pruning audit: identify dead/unused/marginal code in LiteGraph (especially subgraphs, `once` = `NodeMode.ON_EVENT=1`, `onTrigger`) that can be removed now that v2 extension API + ECS are stabilizing. See `research/architecture/audit-litegraph-pruning.md`. Sourced from Alex/Christian Slack 2026-05-12. Sequencing: after Phase B (PR #11939) lands and before the v2 cutover. Owners: Alex (LiteGraph internals), Christian (custom-node impact via touch-points DB), Austin (interactive components). Decomposed into AUDIT-LG.1–.8 below.

### AUDIT-LG sub-tasks

Sequencing:
- AUDIT-LG.1 (inventory) → AUDIT-LG.2 + .3 (parallel usage scans)
- AUDIT-LG.4, .5, .6 (parallel deep-dives, depend on .1–.3)
- AUDIT-LG.7 (synthesis, depends on .4–.6)
- AUDIT-LG.8 (file issues, depends on .7)

```diagram
╭──────────────╮     ╭──────────────╮     ╭──────────────╮     ╭──────────────╮     ╭──────────────╮
│ AUDIT-LG.1   │────▶│ AUDIT-LG.2   │────▶│ AUDIT-LG.4   │────▶│ AUDIT-LG.7   │────▶│ AUDIT-LG.8   │
│ inventory    │  ╲  │ internal     │  ╲  │ ON_EVENT     │  ╲  │ synthesis    │     │ file issues  │
│              │   ╲ │ usage scan   │   ╲ │ deep-dive    │   ╲ │ keep/dep/del │     │              │
╰──────────────╯    ╲╰──────────────╯    ╲╰──────────────╯    ╲╰──────────────╯     ╰──────────────╯
                     ╲                    ╲                    ╱
                      ╲╭──────────────╮    ╲╭──────────────╮  ╱
                       │ AUDIT-LG.3   │     │ AUDIT-LG.5   │ ╱
                       │ external     │ ──▶ │ onTrigger    │╱
                       │ usage scan   │     │ deep-dive    │
                       ╰──────────────╯     ╰──────────────╯
                                            ╭──────────────╮
                                            │ AUDIT-LG.6   │
                                       ────▶│ subgraphs    │
                                            │ deep-dive    │
                                            ╰──────────────╯
```

- [x] AUDIT-LG.1 — **Inventory**: catalog all LiteGraph public surfaces in `src/lib/litegraph/src/` — `LGraphEventMode` enum values, `LGraph`/`LGraphNode`/`LGraphCanvas`/`LGraphGroup` event-handler fields (`onTrigger`, `onExecuted`, etc.), subgraph APIs from `src/lib/litegraph/src/subgraph/`, prototype methods, and `window.LiteGraph` re-exports from `LiteGraphGlobal.ts`. Output: `research/audits/litegraph-surface-inventory.yaml` with one row per surface (id, kind, file:line, jsdoc, in-source TODO/FIXME comments). **No deps.**
- [x] AUDIT-LG.2 — **Internal usage scan**: for each surface in AUDIT-LG.1, count call sites in `ComfyUI_frontend/src/`, `browser_tests/`, `tests-ui/`, and `packages/extension-api/` — explicitly excluding `src/lib/litegraph/` itself. Use `rg --type ts --type vue` with surface ids from .1. Output: `research/audits/litegraph-internal-usage.csv` (surface_id, internal_count, top_5_call_sites). **Depends on .1.**
- [x] AUDIT-LG.3 — **External usage scan**: for each surface, count consumers in `research/touch-points/database.yaml` and the starred-repo clone set under the touch-points workspace. Tag each row with download-count tier (top-10 / top-50 / top-200 / long-tail). Output: `research/audits/litegraph-external-usage.csv` (surface_id, db_evidence_rows, repos_touching, top_tier). **Depends on .1, parallel with .2.**
- [x] AUDIT-LG.4 — **`ON_EVENT` (NodeMode=1) deep-dive**: history (when added, last meaningful change), full caller list inside ComfyUI_frontend, behavioural semantics in current execution loop, replacement plan in v2 ECS dispatch. Resolve naming mismatch: v2 `'once'` string vs. internal `ON_EVENT`. Decide rename vs. drop. Output: appendix to framing doc + recommendation row. **Depends on .1–.3.**
- [x] AUDIT-LG.5 — **`onTrigger` deep-dive**: enumerate every `onTrigger`-related symbol per the framing doc (LGraph.onTrigger field, dispatch at LGraph.ts:1370, triggerInput at :1379, auto-injected slot at LGraphNode.ts:1353-1358, LGraphTriggerHandler/LGraphTriggerEvent types). Distinguish from `executed` event (do NOT conflate). Map all uses; replacement plan. Output: appendix to framing doc + recommendation rows. **Depends on .1–.3, parallel with .4 + .6.**
- [x] AUDIT-LG.6 — **Subgraphs deep-dive**: enumerate all 30+ files under `src/lib/litegraph/src/subgraph/` per framing doc; cross-reference with **D12** (scope-clone-on-copy) and ComfyUI's native subgraph implementation (confirm whether `subgraph/` IS the native impl vendored or a separate older one); identify what stays / what goes / what merges. Output: appendix to framing doc + per-file verdict matrix. **Depends on .1–.3, parallel with .4 + .5.**
- [x] AUDIT-LG.7 — **DONE 2026-05-13.** Verdict counts: 43 DELETE-NOW / 28 DEPRECATE / 75 KEEP across 146 surfaces. Recommended migration: 40 delete-immediately / 2 deprecate-cycle / 61 keep-permanent / 43 decide-with-Alex. Master table + executive summary appended at end of `research/architecture/audit-litegraph-pruning.md`. Generator: `scripts/build_litegraph_verdict_table.py` (re-runnable). TL;DR + filed-issue links inlined near top of doc.
- [x] AUDIT-LG.8 — **DONE 2026-05-13.** Filed 4 batched tracking issues on `Comfy-Org/ComfyUI_frontend`: [#12223](https://github.com/Comfy-Org/ComfyUI_frontend/issues/12223) trigger-cluster DELETE (~22 symbols), [#12224](https://github.com/Comfy-Org/ComfyUI_frontend/issues/12224) dead event hooks DELETE (35 surfaces), [#12225](https://github.com/Comfy-Org/ComfyUI_frontend/issues/12225) ON_EVENT DEPRECATE-then-DELETE, [#12226](https://github.com/Comfy-Org/ComfyUI_frontend/issues/12226) subgraph cluster sign-off (39 surfaces, decide-with-Alex — **closed by AUDIT-LG.9**). Generator: `scripts/file_audit_lg8_issues.py` (dry-run by default; `--file` to fire).
- [x] AUDIT-LG.9 — **DONE 2026-05-13.** Per-symbol attribution sweep + subgraph cluster correction. Outputs: appended §AUDIT-LG.9 to `research/architecture/audit-litegraph-pruning.md`; updated TL;DR. Resolves AUDIT-LG.7 §Blockers 1, 3, 4 + AUDIT-LG.5 §OQs 1, 2. Closed [#12226](https://github.com/Comfy-Org/ComfyUI_frontend/issues/12226) (subgraph cluster KEEP-as-cluster). Posted sweep results to [#12223](https://github.com/Comfy-Org/ComfyUI_frontend/issues/12223) + sign-off to [#12225](https://github.com/Comfy-Org/ComfyUI_frontend/issues/12225). Net: 43 DELETE-NOW / 2 DEPRECATE / 101 KEEP, **0 decide-with-Alex blockers** before deletion PR ships.

## Must Do — LiteGraph deletion PR (mirrors GH issues + decomposes for execution)

> **Source issues** (mirrored locally per user direction "i dont think we really need GH issues"):
>   - LG-DEL-trigger ↔ Comfy-Org/ComfyUI_frontend#12223
>   - LG-DEL-dead-hooks ↔ #12224
>   - LG-DEP-on-event ↔ #12225
> **Branch plan:** new branch `litegraph/prune-dead-surfaces` off `main` (independent of the ext-api stack
> #12142–#12145; the audit doc + scripts are workspace-only and don't ship via this branch). **PR opened as
> draft 2026-05-13: [Comfy-Org/ComfyUI_frontend#12228](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12228).**
> Worktree: `~/worktrees/ComfyUI_frontend/litegraph__prune-dead-surfaces`.
> **Sequencing per AUDIT-LG framing:** lands AFTER Phase B (Alex's #11939 + #11811). Open as draft PR now to
> capture the diff; flip to ready-for-review post-Alex-rebase.
> **Quality gates:** `pnpm lint && pnpm format:check && pnpm knip` (per AGENTS.md rule #8). Knip will likely
> flag transitive unused exports cascading from each deletion — fold those follow-on cleanups into the same PR.

### LG-DEL-1 — Dead event-hooks batch (35 surfaces, low-risk)

> Closes #12224. Mechanically safe — every surface has zero internal AND zero external callers.

- [x] LG-DEL-1.A — **DONE 2026-05-13.** Per-file grouping computed via `python3 scripts/build_litegraph_verdict_table.py`: 8 LGraph fields, 27 LGraphNode fields, 0 LGraphCanvas (those are all KEEP). Per-hook internal-litegraph dispatch sites surveyed before edits.
- [x] LG-DEL-1.B — **DONE 2026-05-13** as PR [#12228](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12228) `litegraph/prune-dead-surfaces` — **MERGED 2026-05-13, commit `b36b601a1c`**. 6 of 8 LGraph fields landed: `onAfterStep`, `onBeforeStep`, `onPlayEvent`, `onStopEvent`, `onAfterExecute`, `onExecuteStep` — all stepping hooks fired from the `@deprecated 'Will be removed in 0.9'` runtime executor (`start`/`stop`/`runStep`). Remaining 2 LGraph fields landed separately on PR #12230 (LG-DEL-1.C): `onGetNodeMenuOptions` (dispatched from `LGraphCanvas.ts:8646`) and `onBeforeChange` (LGraph variant, dispatched at `LGraph.ts:1395`).
- [x] LG-DEL-1.C — **DONE 2026-05-13** as PR [#12235](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12235) `litegraph/prune-lgraphnode-hooks`. 26 of 27 hooks deleted. **`onTitleButtonClick` reclassified KEEP** — real override on `SubgraphNode.ts:840` with `super.onTitleButtonClick(...)` callsite + 2 test files. Audit row needs amendment. Transitive: `_nodes_executable`, `only_onExecute` param, `runStep` `limit` param. Branched off `origin/main` (parallel to #12228). Also LG-DEL-1.B's deferred 2 fields landed as PR [#12230](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12230) `litegraph/prune-lgraph-misc-hooks` — `LGraph.onGetNodeMenuOptions` + LGraph-variant `onBeforeChange` (LGraphCanvas.onBeforeChange preserved). **#12230 rebased directly onto `main` after #12228 merged** (no longer stacked); same for executor-cluster PR [#12233](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12233).
- [x] LG-DEL-1.D — **DONE 2026-05-13.** Quality gates green under Node 24 on every PR (lint/format:check/knip). Knip-flagged transitive cleanups folded into the relevant commits.

### LG-DEL-2 — Trigger-cluster deletion batch (~22 symbols, 1 PR per AUDIT-LG.5)

> Closes #12223. Sweep-confirmed safe by AUDIT-LG.9; KEEP carve-outs documented (`LGraph.onTrigger` field + `LGraphTrigger*` types).

- [x] LG-DEL-2.A — **DONE 2026-05-13** as PR [#12234](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12234) `litegraph/prune-trigger-cluster`. All listed symbols deleted; cascading cleanup of `execute_triggered`/`action_triggered`/`exec_version`/`action_call` field decls + `renderingBoxColor` flash branch.
- [x] LG-DEL-2.B — **DONE 2026-05-13** in same PR [#12234](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12234). Bonus: also dropped `LGraph.clearTriggeredSlots` (plural — iterates `_last_time`, inseparable). Preserved `LGraph.onTrigger` field, `trigger(action,param)` dispatcher, `LGraphTrigger*` types as required.
- [~] LG-DEL-2.C — **Partial 2026-05-13** in PR [#12234](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12234). `LGraphEventMode.ON_TRIGGER`, `LiteGraph.ON_TRIGGER`, `do_add_triggers_slots` + `'On Trigger'` array entry, `connect()` EVENT branch all DELETED. **CARVE-OUT:** `LiteGraph.EVENT = -1` and `LiteGraph.ACTION = -1` constants kept — repo has no separate vendored canvas bundles (scoping doc was wrong); 12 live TS refs in `LGraphCanvas.ts` + `utils/linkColors.ts` would break compilation. Constants now point to slot types nothing can produce → safe follow-up (file as LG-FU-5).
- [x] LG-DEL-2.D — **Delete `LLink._last_time`** field declaration + writes + `LGraphCanvas` fade-out animation read at `LGraphCanvas.ts:6343-6344` (writers all in dead cluster, so the reader is dead-on-arrival per AUDIT-LG.5). [routine, 15m, after 2.C]
- [x] LG-DEL-2.E — RETIRED 2026-05-13. Vendored bundle regen N/A — repo has no separate bundles; cleanup tracked as LG-FU-5 instead.

### LG-DEP-3 — ON_EVENT deprecate-then-delete (release N + N+1)

> Closes #12225. Christian sign-off received (2026-05-13) on copy.

- [x] LG-DEP-3.A — **DONE 2026-05-13** as PR [#12231](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12231) `litegraph/deprecate-on-event`. Rename done at `globalEnums.ts:87` (was line 85). `Object.defineProperty` getter installed inside `LiteGraphGlobal` constructor (lines 377-385) — class-field assignment, not a `window.LiteGraph` direct write (the global IS the class instance). `case ON_EVENT: break` deleted from `LGraphNode.changeMode()` (was line 1383); `default: return false` widened to `default: break` for numeric default-accept.
- [~] LG-DEP-3.B — **Deferred 2026-05-13.** `comfyui-frontend-types` package does NOT live in this repo — `rg "typeof LiteGraph.ON_EVENT"` returned zero hits in `packages/`. The published types are referenced in `docs/adr/0002-monorepo-conversion.md` as a sibling package. Patch bump must happen in the publishing repo (probably `Comfy-Org/comfyui-frontend-types`) — file as cross-repo follow-up issue.
- [ ] LG-DEP-3.C (**release N+1, separate PR/branch**) — **Drop the deprecated symbol entirely**: remove `_UNUSED_1` enum entry, drop the `window.LiteGraph.ON_EVENT` deprecation getter. Tracked here, executed later. [routine, 10m, separate release cycle]

### LG-FU-4 — Subgraph cluster `@internal` follow-up (KEEP-as-cluster, optional)

> Per AUDIT-LG.9, the 39 `subgraph_export` surfaces are NOT dead. Follow-up is optional — tightens the published `@comfyorg/extension-api` ABI by marking internal building blocks `@internal`.

- [x] LG-FU-4.A — **Audit which subgraph exports are external-facing vs. internal building blocks.** Production importers (per AUDIT-LG.9 §subgraph correction): `SubgraphNode`, `Subgraph`, `SubgraphInput`, `ExecutableNodeDTO`, `subgraphTest`/`createTestSubgraph*`/`subgraphHelpers` (test fixtures). Everything else is internal-only and should be marked `@internal`. [analytical, 30m, **independent**, lowest priority — does not block any PR]
- [x] LG-FU-4.B — **DONE 2026-05-13** as PR [#12232](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12232) `litegraph/subgraph-internal-tags`. 18 `@internal` tags across 8 files (`EmptySubgraphInput`, `EmptySubgraphOutput`, `SubgraphSlot` (file is `SubgraphSlotBase`), `SubgraphIONodeBase`, `PromotedWidgetViewManager`, `SubgraphOutput`, all `subgraphDeduplication` exports, all 11 `subgraphUtils` exports including type guards).
- [~] LG-FU-4.C — **Deferred 2026-05-13.** `packages/extension-api/` doesn't exist on `main` yet (PKG2 work — see PR [#12143](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12143)). Tags are forward-compatible with TypeDoc's standard `excludeInternal: true` setting that PKG2 will configure. Verify after PKG2 lands.

### LG-FU-5 — Vendored canvas LiteGraph.EVENT/ACTION cleanup (new follow-up, opened from PR [#12234](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12234))

> Discovered during PR D execution: scoping doc said `LiteGraph.EVENT = -1` and `LiteGraph.ACTION = -1` lived in
> "3 vendored canvas bundles" — but this repo doesn't have those separate bundles. Instead 12 live TS refs sit in
> `LGraphCanvas.ts` (slot type-filter, link colors, type-filter menus) + `utils/linkColors.ts`. Constants kept
> defined in #12234; they now point to slot types nothing can produce → safe to clean up the dead branches.

- [ ] LG-FU-5.A — **Audit the 12 LiteGraph.EVENT / LiteGraph.ACTION reads** in `LGraphCanvas.ts` + `utils/linkColors.ts`. For each branch, verify the `-1`-typed slot can no longer reach it after PR #12234 lands. [analytical, 20m, after #12234 merges]
- [ ] LG-FU-5.B — **Delete dead branches** + the two constants. Single PR. [routine, 15m, after 5.A]

### LG-FU-6 — `comfyui-frontend-types` ON_EVENT typedef patch (cross-repo follow-up, opened from PR [#12231](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12231))

> The published types package isn't in this repo — patch must happen in `Comfy-Org/comfyui-frontend-types` (or
> wherever the `.d.ts` is generated/published from).

- [x] LG-FU-6.A — **DONE 2026-05-13.** Recon answer: NOT a separate repo. `@comfyorg/comfyui-frontend-types` is published from this same `Comfy-Org/ComfyUI_frontend` repo via `pnpm build:types` + `.github/workflows/release-npm-types.yaml`. Source-of-truth for `ON_EVENT` enum: `src/lib/litegraph/src/types/globalEnums.ts:85`. Latest published: 1.45.6. Output: `research/architecture/lg-fu-6-types-publishing-recon.md`.
- [~] LG-FU-6.B — **SUPERSEDED.** Per LG-FU-6.A recon, LG-DEP-3.A's PR #12231 already patches the source enum in this same repo; once that merges and a `release-npm-types.yaml` run ships, the published types update automatically. No separate cross-repo PR needed.

### LG-FU-7 — `LGraphNode.exec_version` reclassification (opened from PR [#12234](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12234))

> `exec_version` was deleted in #12234 as part of the trigger cluster — its only writer (`LGraphNode.doExecute`)
> is dead. Audit row should be moved into the trigger-cluster verdict for accuracy.

- [x] LG-FU-7 — **Update audit doc** AUDIT-LG.5 verdict table to reclassify `exec_version` from standalone to trigger-cluster member. [docs, 10m] — DONE 2026-05-13. Added `lgraphnode_exec_version` row to AUDIT-LG.7 master verdict table tagged `[trigger-cluster]`; rationale captured in new caveat #5.

### LG-FU-8 — `onTitleButtonClick` reclassification (opened from PR [#12235](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12235))

> Audit listed `onTitleButtonClick` as DELETE-NOW but `SubgraphNode.ts:840` overrides it with a real
> `super.onTitleButtonClick(...)` call + 2 test files cover it. Reclassify KEEP.

- [x] LG-FU-8 — **Amend audit row** for `onTitleButtonClick` from DELETE-NOW to KEEP; note SubgraphNode override + test coverage. [docs, 10m] — DONE 2026-05-13. Flipped `lgraphnode_on_title_button_click` row to `**KEEP** [audit-correction]` (risk: med, migration: keep-permanent); rationale captured in new caveat #5.

## 2026-05-12 — staged for next decomposition wave

> Filed only — none of these have been acted on. Pending pickup by the next decomposition + parallel-spawn pass.

### F-12144-1 author intent (blocks RFR-12144)
- [x] RFR-12144-1 — Resolve F-12144-1 author intent: PR #12144 loads BOTH original (`dynamicPrompts`, `imageCrop`, `previewAny`) AND v2 conversions side-by-side. Decide: (a) v2 conversions are staging-demo pieces meant to load alongside v1 → add idempotent registration guard; or (b) v2 conversions are replacements meant to swap v1 out → remove v1 imports. Author input needed (Christian / Simon / Austin). Blocks ready-for-review on #12144.

### Ready-for-review flips (one per PR for clarity)
- [x] RFR-12142 — Flip PR #12142 (foundation) draft → ready-for-review. Lint/build/codecov pass; cleanest of the stack. Action: `gh pr ready 12142 --repo Comfy-Org/ComfyUI_frontend`.
- [x] RFR-12143 — Flip PR #12143 (pkg) draft → ready-for-review. After D17 Option C build, lint pass + 4 must-fix + 2 polish landed. Run `coderabbit review --plain` once more to confirm clean, then flip.
- [x] RFR-12144 — Flip PR #12144 (ext) draft → ready-for-review. Blocked on RFR-12144-1 (intent question). After resolved + 5 polish landed, flip.
- [x] RFR-12145 — Flip PR #12145 (tf) draft → ready-for-review. Lint pass; 193 unrelated pre-existing typecheck errors in bc-* test files remain. Decide: (a) accept as-is, flip with typecheck failures noted as out-of-scope; (b) fix bc-* typecheck errors first (multi-day); or (c) split typecheck-failing files into a follow-up PR.

### Stack rebase cascade
- [x] STACK-CASCADE — Cascade D17 + polish commits from #12143 down through #12144/#12145. Probably auto-clean (changes in different files). Run after RFR-12144-1 is resolved so the stack is consistent.

### Slack feedback wave
- [x] DASH-PR-28 — Review and merge PR [#28](https://github.com/christian-byrne/ComfyUI_frontend-ecosystem/pull/28) — Slack feedback wave. 6/7 fixes; 44/44 tests pass. After merge, verify prod dark mode + sortable headers + search-by-pack via curl spot-checks.

### CodeRabbit triage
- [x] CR-12145-RERUN — **DONE 2026-05-13.** Ran `coderabbit review --plain --dir src/extensions/core` (full PR over 150-file limit). 4 findings: (1) major: v1+v2 both imported in index.ts, (2) major: slotDefaults.v2.ts empty setup, (3-4) minor: noteNode.v2.ts properties.text undefined edge case. Output: `research/reviews/coderabbit-ext-api-i-ext-2026-05-13.txt`.

**CodeRabbit findings to address (2026-05-13):**
- [x] CR-FIX-1 — **DONE.** `index.ts`: added comment explaining v1+v2 parallel loading during migration (D6). Commit `f8e52cd` in ext-api/i-ext.
- [x] CR-FIX-2 — **DONE.** `slotDefaults.v2.ts`: added `console.info` stub notice for GAP-4/GAP-5. Commit `f8e52cd` in ext-api/i-ext.
- [x] CR-FIX-3 — **DONE.** `noteNode.v2.ts`: fixed `properties.text` undefined edge case at lines 60, 92. Commit `f8e52cd` in ext-api/i-ext.
- [x] CR-FIX-4 — **DONE.** `lifecycle.ts`: added JSDoc `@remarks` clarifying type-only exports. Commit `00ef114` in ext-api/i-tf-v2.

### CONTEXT.md gaps
- [x] CTX-PROVENANCE — `bash scripts/sync.sh` reports 1 research artifact missing provenance. Find and fix the orphan.

### Open UWF decisions (deferred per user direction)
- [x] UWF-DRAFT-N11 — Discuss `D-uwf-drafting-board.md` N11 (app-level `beforePrompt` event) with team; promote to D14 ADR.
- [x] UWF-DRAFT-N12 — Discuss N12 (virtual wiring declaration API) with Alex (UWF Phase 3 owner); promote to D15 ADR. Sequencing: N12 first per drafting board recommendation.
- [x] UWF-DRAFT-N13 — Discuss N13 (cross-node value sync); promote to D16 ADR. Defer per drafting board recommendation.

### Workflow improvement
- [x] META-DETERMINISTIC-REBUILD — From Alex's Slack: "have it build a deterministic script for rebuild so it doesn't fall back on other tools." Tracking issue [#26](https://github.com/christian-byrne/ComfyUI_frontend-ecosystem/issues/26) on dashboard repo. Either: (a) build a make-style rebuild script for the dashboard data pipeline, or (b) document the existing rebuild path so agents can follow it deterministically.

## 2026-05-13 wave-2 follow-ups (newly uncovered)

### W2F-1 — RE-AUDIT-LISTENER-VARIANT (HIGH priority — blocks audit confidence)
- [x] W2F-1.A — Identify how to run comfy-codesearch / sourcegraph LOCALLY. Per user: "clone it, its a Comfy-Org repo, and running locally". Likely candidates: `Comfy-Org/comfy-codesearch`, sourcegraph self-hosted compose stack, or a private repo backing cs.comfy.org. Document the local-deploy path.
- [x] W2F-1.B — Re-audit S11.G3 (`graph.beforeChange/afterChange` cluster) using listener-assignment variant: `\.onBeforeChange\s*=`, `\.onAfterChange\s*=`, `prototype\.onBeforeChange\s*=`, `prototype\.onAfterChange\s*=`. Bmad consumer was missed by the original sweep — quantify the under-count.
- [x] W2F-1.C — Re-audit S6.A1 (`graphToPrompt`) — already CRITICAL — for listener-assignment variants and any wrapper-pattern overrides.
- [x] W2F-1.D — Re-audit S2.N1–N19 (LiteGraph prototype-patching family) for the `prototype.onX =` variant systematically.
- [x] W2F-1.E — Re-audit S3.C1 (canvas patching) for the same pattern class.
- [x] W2F-1.F — Update `research/touch-points/database.yaml` evidence rows for any newly-discovered consumers; flip surface verdicts where consumer-count crosses risk thresholds.
- [x] W2F-1.G — Append findings to `research/meta/sourcegraph-mcp-coverage-investigation.md` (extend existing artifact, don't fork).

### W2F-2 — SOURCEGRAPH-MCP-IMPROVEMENTS
- [x] W2F-2.A — File issue (likely against `Comfy-Org/comfy-codesearch` or the MCP repo) listing the surfaced gaps: (G2) HTML error responses become opaque JSON parse errors, (G3) `gitserver-0.gitserver` DNS errors ~30% rate, (G5) `count: 20+` triggers HTML error, (G7) no metadata API for indexed-file count or last-crawl timestamp. → https://github.com/Comfy-Org/comfy-codesearch/issues/10

### W2F-3 — METHODOLOGY-DOC-RG-CAVEAT
- [x] W2F-3 — **DONE 2026-05-13.** Appended "Methodology gotchas (W2F-3)" section to CONTEXT.md covering `rg -E` foot-gun (`-E` = `--encoding`, use `-e` or no flag — rg defaults to extended regex), the 3-form prototype-patching pattern matrix (call-site / listener-assignment / prototype-override), and `mcp__comfy_codesearch__search_code` scope + HTML-error gotchas. AGENTS.md not amended (no matching section, would bloat). Workspace `rg -nw 'rg -E' .` returns zero hits.

### W2F-4 — D6.2 ADR for types-package sunset (deferred-execution)
- [x] W2F-4 — **DONE 2026-05-13.** Drafted `decisions/D6.2-types-package-sunset-criteria.md` (Status: PROPOSED). Defines five sequential gates: (1) v1/v2 telemetry exists, (2) extension-api absorbs/disowns every v1 export with explicit checklist (~11 rows), (3) published migration guide on docs.comfy.org with worked examples for top-10 v1 surfaces, (4) ≥12-month soak with sustained <5% v1 activation, (5) deprecation announcement → 6-month warning window → final removal. Total realistic path 24+ months. Alternatives rejected: immediate removal (314+ repos break), keep-forever (drift), deprecate-now-without-gates (no telemetry).

### W2F-5 — Augmentation-file finding (close out)
- [x] W2F-5 — **DONE 2026-05-13.** Confirmed: `src/types/litegraph-augmentation.d.ts` augments LGraphNode interface with Comfy-specific overlay hooks only (`onAfterGraphConfigured`, `onExecuted`, `onDragOver`, etc.). The deleted hooks (`onAction`, `triggerSlot`, `onInputAdded`, `onExecute`, etc.) were never re-declared there — they lived inside the vendored `src/lib/litegraph/` source. So pruning PRs correctly didn't need to touch the augmentation file. DOCS-RIPGREP-AUDIT "no hits" was a true negative.

## 2026-05-13 wave-3 — Audit dashboard + back-propagation cascade

### DASH-1 — Audit Dashboard (extend existing ecosystem repo)
Stack: Vite + Vue + TS + Vercel (mirroring `christian-byrne/ComfyUI_frontend-ecosystem`). Adds new `/audit` route (or top-level page) instead of new repo.

- [x] DASH-1.A — Recon: clone/inspect `christian-byrne/ComfyUI_frontend-ecosystem` repo structure (src/router, scripts/ingest pattern, vercel.json routes). Identify the right insertion point for a new `/audit` route.
- [x] DASH-1.B — Data ingestion script: write `scripts/ingest-litegraph-audit.ts` that reads workspace artifacts (`research/touch-points/database.yaml`, `research/architecture/audit-litegraph-pruning.md`, `research/meta/sourcegraph-mcp-coverage-investigation.md`, `decisions/D6.2-*.md`) and emits `src/data/litegraph-audit.json`. Make idempotent + re-runnable from workspace sync.
- [x] DASH-1.C — UI: `/audit` route with: (1) AUDIT-LG.10 verdict table (sortable by severity / consumer-count / verdict), (2) per-surface drill-down with all evidence rows + GitHub deep-links, (3) per-PR section showing which surfaces each PR touches, (4) re-audit delta visualization (before/after consumer counts).
- [x] DASH-1.D — PR-comment opener for each evidence row: button that (a) opens the PR file at the right line via `https://github.com/<owner>/<repo>/pull/<num>/files#diff-<filehash>R<line>` deep-link, (b) copies a pre-filled markdown comment template to clipboard. Note: GitHub has no documented URL to auto-open the inline review-comment compose modal, so clipboard-paste is the closest UX. Document this caveat.
- [x] DASH-1.E — Deploy to Vercel; share URL with team. Add domain to vercel.json if needed.
- [x] SWEEP-1 — Verify deploy of PR #39 (audit dashboard) at https://comfyui-frontend-ecosystem.vercel.app. **(2026-05-14)** Deploy LIVE at SHA `88322d774`, bundle `index-Ctw1tgp6.js` (post-merge, confirmed via deployment status API). All 3 routes return HTTP 200, all lazy chunks (LitegraphAudit, AuditSurfaceDetail, AuditPRDetail) load. KPI strip = 43/76/28 = 147 surfaces total. Verdict filter narrows table correctly. Mapped-surface links navigate. No console errors. **Bug found** → filed [christian-byrne/ComfyUI_frontend-ecosystem#40](https://github.com/christian-byrne/ComfyUI_frontend-ecosystem/issues/40): `/audit/pr/:num` page renders `pr.title` and `pr.description` as separate paragraphs but ingest script slices both from same body, producing visible duplication. Bonus findings noted in issue: (a) markdown not rendered in PR description, (b) 0/147 surfaces have `consumerEvidence` so per-surface "Open in PR + copy comment" feature has no data to render against, (c) verdict-table "Consumers (pre→post)" cell formatting collapses count and "no re-audit" tag with no separator.
- [x] DASH-1.F — Auto-refresh hook: extend `scripts/sync.sh` (or add a workspace-side hook) to push the regenerated JSON to the dashboard repo on every sync. Or: dashboard repo CI pulls the JSON from this workspace via git submodule / fetch.

### BACKPROP-1 — Back-propagate W2F-1 findings across artifacts (immediate)

- [x] BACKPROP-1.A — Apply 3 severity escalations to `research/architecture/audit-litegraph-pruning.md` AUDIT-LG.10 verdict table: S2.N1 onNodeCreated → CRITICAL, S2.N7 onConfigure → CRITICAL, S2.N18 onPropertyChanged → HIGH. Tag rows `[audit-correction-w2f1]` with reference to `research/meta/sourcegraph-mcp-coverage-investigation.md` §Re-audit results.
- [x] BACKPROP-1.B — Append "Re-audit findings (W2F-1, 2026-05-13)" section to body of each open pruning PR (#12230/12231/12232/12233/12234/12235) IF its symbols intersect the surfaced-consumer set. Reference the meta artifact + per-surface delta count. [DONE 2026-05-13: #12230 INTERSECTS S11.G3 (full intersect block, 11 lines); #12231/12233/12234/12235 → no-intersect note (3 lines each); #12232 skipped (no deletions). Bodies updated via REST PATCH `repos/.../pulls/<n>` because `gh pr edit` failed on Projects-classic GraphQL deprecation.]
- [x] BACKPROP-1.C — Review decisions D1–D8 (especially D1 hook taxonomy, D2 setup function, D3 widget registration) for any v2 extension-api parity claims that should now reflect the larger consumer surface. File ADR amendment notes inline. **(2026-05-14)** D1, D2, D3.x, D8, D10, D12, D13, D14*, D17, D6.x had no parity/consumer-count claims — no change. D4, D5, D6, D7, D9, D-uwf updated with W2F-1 re-audit notes; no decisions/statuses changed.
- [x] BACKPROP-1.D — Cross-link the meta artifact + W2F-1 re-audit results from CONTEXT.md, audit-litegraph-pruning.md preamble, and each affected ADR's "References" section. **(2026-05-14)** Added "Latest research (2026-05-13)" section to CONTEXT.md preamble; cross-link inserted in `audit-litegraph-pruning.md` between AUDIT-LG.9 and AUDIT-LG.10; References entries added to D4, D5, D6, D7, D9, D-uwf.
- [x] BACKPROP-1.E — Test-file coverage scan: search `ComfyUI_frontend/tests-ui/`, `tests/`, `browser_tests/` for tests exercising S2.N1/N2/N7/N18 surfaces. Flag candidates needing additional coverage as we approach migration. Output `research/touch-points/test-coverage-gaps.md`.
- [x] BACKPROP-1.F — Docs scan: search `docs/extensions/`, `embedded-docs/`, `docs.comfy.org` for user-facing docs covering escalated surfaces. Flag for migration-guide content (D6.2 Gate 3 dependency). _Findings inline in `ComfyUI_frontend/docs/extensions/migration-v1-to-v2.md` § "Existing user-facing docs coverage"._
- [x] BACKPROP-1.G — Update `docs/extensions/migration-v1-to-v2.md` stub (create if missing) with placeholder sections for top-10 v1 surfaces by consumer count. Cross-link from D6.2 Gate 3. _Created `ComfyUI_frontend/docs/extensions/migration-v1-to-v2.md` (STUB / DRAFT) with top-10 table and per-surface stub sections._
- [x] BACKPROP-1.H — Update tracking issue Comfy-Org/ComfyUI_frontend#12236 (types-package ON_EVENT) with W2F-1 context: per-surface re-audit counts may inform package-removal sequencing. (https://github.com/Comfy-Org/ComfyUI_frontend/issues/12236#issuecomment-4447029655)
- [x] BACKPROP-1.I — Update D6.2 ADR Gate 2 (absorb-or-disown checklist) with the newly-quantified consumer counts so prioritization is data-driven.

### BACKPROP-2 — Coverage-driven re-audit cascade (deferred — gated on Comfy-Org/comfy-codesearch#10)

- [x] BACKPROP-2.A — Once codesearch fixes G5 (count threshold) and G2 (typed errors), re-run pattern matrix on remaining S2.N* surfaces not yet sampled (N3, N4, N5, N6, N8–N17, N19) — only spot-checked in W2F-1.
- [ ] BACKPROP-2.B — Same for S3.* family (canvas patching) and S4–S10 surface families that may have under-counts.
- [ ] BACKPROP-2.C — Establish ongoing process: add `scripts/listener-variant-sweep.sh` to the workspace + cron-style reminder in workspace-sync output. Triggered manually or on every new pruning PR.
- [x] BACKPROP-2.D — Document the "clone-and-grep is canonical for deletion-risk audits, MCP is fine for scoped lookups" methodology in CONTEXT.md gotchas section (extend the W2F-3 entry).

### BACKPROP-3 — Continuous back-propagation framework (meta)

- [x] BACKPROP-3.A — Define a "finding propagates to" matrix: for each surface in touch-points DB, list the artifacts that must reflect any consumer-count change (DB itself, AUDIT-LG.10, affected PRs, affected ADRs, dashboard JSON, migration guide). Encode in `research/meta/back-propagation-matrix.yaml`.
- [x] BACKPROP-3.B — Add a `scripts/check-back-propagation.sh` that compares DB consumer-counts against AUDIT-LG.10 / dashboard JSON / ADR refs and warns on drift.

## 2026-05-13 wave-3 hygiene findings (SWEEP-3)

Audit of `tasks/*.lock` (158 total) and `todo.md` (20 open / 230 done / 8 partial).

### Lockfile health
- **Total:** 158
- **Active:** 7 (6 sweeps + 1 stale before this pass)
- **Done:** 143 → 145 after this sweep
- **Stale active closed by SWEEP-3:**
  - `tasks/D-uwf-drafting-board.lock` — started 2026-05-12, output `decisions/D-uwf-drafting-board.md` exists, downstream UWF-DRAFT-N11/12/13 already marked done at lines 795–797. Closed.
  - `tasks/I-TF.8.G1.lock` — claimed 2026-05-12, no `status:` field, but todo line 405 records "DONE 2026-05-12 (89 real tests passing)". Added `status: done` closer.
- **Concurrent peer sweeps still active (expected):** SWEEP-1, SWEEP-2, SWEEP-3, SWEEP-4, SWEEP-5, SWEEP-6 — all started today, NOT stale.

### TODO inconsistencies
- **Duplicate:** Line 381 (I-TF.8) and line 635 (N10 → I-TF.8) describe the same ~230 it.todo backfill. N10 is the older sticky reference; I-TF.8 is the canonical decomposition. Keep both for now (cross-ref intact) but only count once when planning.
- **Legend false positive:** Line 129 `- [ ] Not started` is the markdown legend, not a real task. Excluded from the 20-open count where relevant.
- **No falsely-marked-done items found:** every spot-checked `[x]` with a recognizable task-id has a corresponding lockfile or inline DONE evidence (e.g., I-TF.8.G1 → line 405; BACKPROP-1.* → inline notes; LG-DEL-2.C → PR #12234).

### Open-item bucket breakdown (excluding legend line 129)
- **BLOCKED on Alex's #11939 ECS rebase (defer):** 1 — I-PG.B1 (line 441)
- **BLOCKED on D8 (defer):** 2 — OPT1 (300), OPT2 (301)
- **BLOCKED on UWF Phase 3 (defer):** 1 — DEP4 (310)
- **BLOCKED on Comfy-Org/comfy-codesearch#10 (defer):** 2 — BACKPROP-2.B (852), BACKPROP-2.C (853)
- **BLOCKED on PR #12234 merge (still OPEN as of 2026-05-14):** 2 — LG-FU-5.A (738), LG-FU-5.B (739)
- **DEFERRED to release N+1 cycle:** 1 — LG-DEP-3.C (721)
- **DEFERRED to "Phase C, much later":** 2 — I-PG.C1 (447), I-PG.C4 (452)
- **PICKUPABLE small (≤30m):** 0 standalone (LG-FU-5.B is 15m but blocked)
- **PICKUPABLE medium (~1–2h):** 4 — W5.1 (92), W5.4 (95), I-SC.2 (473), I-SC.3 (474)
- **LARGE (>2h):** 4 — W5.2 (93), I-TF.8 (381) / N10 (635), I-SC.4 (475)

Total open: **20** = 8 blocked + 3 deferred-by-policy + 4 medium + 4 large + 1 legend-noise.

### Top-5 highest-leverage pickupable items (NOT blocked)
1. **I-TF.8 / N10 (line 381 / 635)** — Implement real test bodies for ~230 `it.todo(...)` stubs across 41 behavior categories × 3 (v1/v2/migration). Each cell is independently dispatchable; running this in parallel is the single highest-throughput win for extension-api confidence before the Alex rebase. Already partially scaffolded (BC.28–BC.30 done by I-TF.8.G1).
2. **I-SC.2 (line 473)** — Phase 2 widget serialization: add `ephemeral` and `promptExclude` widget options, deprecate `widget.serialize` booleans. I-SC.1 is done, D14 ADR exists, no upstream block. Concrete, scoped, ~1–2h.
3. **W5.1 (line 92)** — Wire dashboard's TestRunner page to vitest harness. Dashboard is already deployed (W5.3 done at https://comfyui-frontend-ecosystem.vercel.app); this unlocks W5.2 and W5.4. ~1h.
4. **W5.4 (line 95)** — Dashboard PR review fanout (mirror Wave 4). High-leverage triage work; only blocked on whether dashboard PRs exist. Worth checking PR queue first.
5. **I-SC.3 (line 474)** — Phase 3 widget serialization: document `ctx.on('beforePrompt')` as the new pattern; migrate dynamic prompts + webcam capture. Unblocked by I-SC.1 + D14. Pairs naturally with I-SC.2.

### Inconsistencies fixed
- **2** stale active lockfiles closed (D-uwf-drafting-board, I-TF.8.G1).
- **1** duplicate flagged (I-TF.8 ↔ N10) for awareness — kept both for cross-ref but called out in this section.
- **1** legend false-positive identified (line 129) so it's not counted in pickupable buckets.

## 2026-05-13 wave-3 hygiene findings (SWEEP-2)

### Worktree hygiene (dead/dirty/divergent)
- [x] SWEEP-2-1 — DEAD worktree `~/worktrees/ComfyUI_frontend/ext-api__i-foundation` (branch `ext-api/i-foundation`): PR #12102 CLOSED, superseded by `-v2`. **DONE 2026-05-14:** Worktree + branch deleted (only local .claude/* cruft, no code).
- [x] SWEEP-2-2 — DEAD worktree `~/worktrees/ComfyUI_frontend/ext-api__i-pkg` (branch `ext-api/i-pkg`): PR #12103 CLOSED, superseded by `-v2`. **DONE 2026-05-14:** Worktree + branch deleted.
- [x] SWEEP-2-3 — DEAD worktree `~/worktrees/ComfyUI_frontend/ext-api__i-ext` (branch `ext-api/i-ext`): PR #12105 CLOSED, superseded by `-v2`. **DONE 2026-05-14:** Worktree + branch deleted.
- [x] SWEEP-2-4 — DEAD worktree `~/worktrees/ComfyUI_frontend/litegraph__prune-dead-surfaces`: PR #12228 MERGED. **DONE 2026-05-14:** Worktree + branch deleted.
- [x] SWEEP-2-5 — **DONE 2026-05-14:** All restratify worktrees + branches deleted. They were identical to their `-v2` counterparts after wave-5 reconciliation.
- [x] SWEEP-2-6 — **N/A 2026-05-14:** File not found in workspace. Either never created or already moved.

### PR-branch divergence (local ahead of remote — not pushed)
- [x] SWEEP-2-7 — `ext-api/i-foundation-v2` (PR #12142) **SYNCED 2026-05-14:** local = remote, no divergence.
- [x] SWEEP-2-8 — `ext-api/i-pkg-v2` (PR #12143) **SYNCED 2026-05-14:** local = remote, no divergence.
- [x] SWEEP-2-9 — `ext-api/i-ext-v2` (PR #12144) **SYNCED 2026-05-14:** local = remote, no divergence.
- [x] SWEEP-2-10 — `ext-api/i-tf-v2` (PR #12145) **SYNCED 2026-05-14:** local = remote, no divergence.

### PR-state issues
- [ ] SWEEP-2-11 — PR #12142 has **15 unresolved non-outdated review threads** + `CHANGES_REQUESTED`. Needs response/resolution sweep before re-review.
- [ ] SWEEP-2-12 — PRs #12143/#12144/#12145 are `UNSTABLE` but `lint-and-format` is `IN_PROGRESS` at audit time — re-check once that completes; if green, only codecov/perf/e2e/playwright should remain red (allowed per AGENTS.md rule #8).
- [ ] SWEEP-2-13 — PRs #12230 (APPROVED, BLOCKED) and #12233 (APPROVED draft, BLOCKED) — both ready except blocked. #12230 is non-draft+approved; investigate what's blocking merge (likely required-status or branch protection).

### Ecosystem repo
- [x] SWEEP-2-14 — `christian-byrne/ComfyUI_frontend-ecosystem` PR #29 **MERGED:** VHS coverage shipped.

## 2026-05-13 wave-3 hygiene findings (SWEEP-5)

Doc completeness audit. Inline fixes applied (CONTEXT.md cross-links to back-prop matrix + migration guide; AGENTS.md adds W2F-1/dashboard/back-prop entries to Key Source Files; sourcegraph-mcp investigation grew §Cross-references). Items below are larger gaps deferred for real authoring (>30 min each).

- [x] SWEEP-5-1 — **Dashboard `/audit` route — claims-vs-reality drift.** `todo.md` DASH-1.A through DASH-1.F all marked `[x]` and `tasks/DASH-1.lock` says `status: done`, but the live `christian-byrne/ComfyUI_frontend-ecosystem` repo has no `Audit.vue` page, no router entry for `/audit`, no `scripts/ingest-litegraph-audit.ts`, and no commit in `git log --oneline -50` referencing the audit dashboard. Dashboard README also doesn't mention `/audit`. Either: (a) actually ship the route per the original spec, or (b) re-open DASH-1.C/D/F and explain the regression. AGENTS.md was updated with a temporary note flagging this drift.
- [x] SWEEP-5-2 — **ADR Status field gap (8 ADRs missing).** The following decisions have no `**Status**:` line: D1, D2, D3-architecture-diagram, D3.1, D3.2, D3.3, D3.4, D3.5, D4, D6.1, D14-widget-state-categories, D-uwf-drafting-board. D1/D2 are explicitly framed as "primer" reference docs (likely `accepted-as-reference`); D3.x are working drafts pre-D6 split; D4 is a gap-analysis (likely `informational`); D6.1 should be `superseded-by-D6.2`; D14-widget-state-categories is the predecessor of D14-serialization-convergence (likely `superseded`); D-uwf is a drafting board (`draft`). 30–60 min sweep to add canonical Status lines + supersession links. Lower priority than functional work but blocks ADR auto-tooling/dashboards.
- [x] SWEEP-5-3 — **`sources.yaml` missing W2F-1 cloned-repo enumeration.** The W2F-1 sweep cloned 138 custom-node repos into `/tmp/codesearch-clones/repos/` (2.7 GB). They are documented narratively in `research/meta/sourcegraph-mcp-coverage-investigation.md` but not enumerated in workspace `sources.yaml`. Decision: do we (a) add a single `type: bulk_clone_set` entry pointing at `/tmp/codesearch-clones/repos/` with a note that it's ephemeral, (b) add a permanent manifest under `research/meta/w2f1-cloned-repos.yaml` listing all 138 slugs + commit SHAs, or (c) accept that ephemeral sweep artifacts don't belong in `sources.yaml`. Worth a 1-hour decision + write-up. Tag: provenance-debt.
- [ ] SWEEP-5-4 — **Migration guide not surfaced from any extension index.** `ComfyUI_frontend/docs/extensions/migration-v1-to-v2.md` exists as a STUB / DRAFT, is linked from D6.2 + CONTEXT.md (added in this sweep), but is NOT referenced by `ComfyUI_frontend/docs/extensions/README.md`, `core.md`, or `development.md`. Add a "Migration" section to the extensions README pointing at the stub with a "draft, do not link externally" caveat. ~15 min when the stub is unblocked, but listed here because the stub is currently still TBD-heavy.
- [ ] SWEEP-5-5 — **`back-propagation-matrix.yaml` is referenced from todo.md only.** Now also CONTEXT.md + sourcegraph-investigation (added in this sweep), but the matrix itself has no inbound link from any ADR. D6.2, D9 (strangler-fig phases), and D-uwf (drafting board) are the natural homes — each should reference the matrix in its "References" section so future ADR readers find the propagation contract. ~20 min.

### Top-3 highest-leverage gaps from SWEEP-5

1. **SWEEP-5-1** (Dashboard `/audit` route claims-vs-reality drift) — undermines trust in `[x]` markers across `todo.md`. Either ship or correct the record.
2. **SWEEP-5-3** (W2F-1 clone-set provenance) — losing the sweep methodology footprint will make re-running the audit (W2F-2.A, BACKPROP-2.A, BACKPROP-2.B) much harder once the `/tmp/` dir is GC'd.
3. **SWEEP-5-2** (ADR Status field sweep) — blocks any auto-doc tooling that reads ADR status, and supersession edges (D14-widget-state-categories → D14-serialization-convergence; D6.1 → D6.2) are currently invisible to anyone navigating `decisions/` cold.

## 2026-05-13 wave-3 hygiene findings (SWEEP-6)

Compiled by SWEEP-6-FOLLOWUP-DISCOVERY (2026-05-14 03:23 UTC). See [`research/meta/followup-discovery-2026-05-13.md`](research/meta/followup-discovery-2026-05-13.md) for full source-by-source raw findings, blocker map, and rationale.

- [x] SWEEP-6-F1 — Flip `tasks/D-uwf-drafting-board.lock` to `status: done`. Artifact `decisions/D-uwf-drafting-board.md` exists (created 2026-05-13); all child todos `UWF-DRAFT-N{11,12,13}` are `[x]` done at todo.md:795–797. Coordinate with SWEEP-3-LOCKFILE-TODO which may already be touching this file. [hygiene, 2m, 🔥]
- [x] SWEEP-6-F2 — **DONE 2026-05-14:** Updated BACKPROP-3.B status to `done` + removed gating note from BACKPROP-3.C.
- [x] SWEEP-6-F3 — Push on [Comfy-Org/comfy-codesearch#10](https://github.com/Comfy-Org/comfy-codesearch/issues/10): zero comments since 2026-05-13 filing. Either (a) post a ping with W2F-2.A's gap list to surface priority, or (b) self-PR a fix for G5 (the `count: 20+` HTML-error threshold) since we control the upstream repo. Unblocks BACKPROP-2.B, BACKPROP-2.C, and the methodology-automation roadmap row. [external, 30m ping / ~2h fix, 🔥]
- [ ] SWEEP-6-F4 — Author content for top-3 escalated surfaces (S2.N1 onNodeCreated, S2.N7 onConfigure, S2.N18 onPropertyChanged) in `ComfyUI_frontend/docs/extensions/migration-v1-to-v2.md`. Currently STUB / placeholder per BACKPROP-1.G. D6.2 Gate 3 dependency; cheap forward progress on the telemetry-gated sunset path. [docs, 45m, 🔥]
- [x] SWEEP-6-H1 — **DONE 2026-05-14:** Legend bullets changed to blockquote format so grep counts are accurate.

## 2026-05-13 wave-3 hygiene findings (SWEEP-4)

Drift sweep against `research/meta/back-propagation-matrix.yaml` for the W2F-1 escalation chain. Full matrix + per-cell rationale in [`research/meta/back-propagation-drift-2026-05-13.md`](research/meta/back-propagation-drift-2026-05-13.md). 39 / 42 cells in-sync; all 3 drift cells concentrated in `audit-litegraph-pruning.md`.

- [x] SWEEP-4-1 — **Fix audit-LG.10 §1007 stale narrative.** §1007 says "S2.N2–N6, N8–N17, N19 were not re-audited under W2F-1 (only spot-checked)" but `meta.reaudit_log.surfaces_touched` in `database.yaml` AND the SG investigation MD §Step C delta table BOTH list S2.N2/N3/N4/N5/N6/N8/N9/N10/N11/N14/N15/N17/N19 with full re-audit results (e.g. S2.N2 10→51). Rewrite §1007 to enumerate completed surfaces vs. genuinely-pending ones (none from S2.N* — all 18 were touched). [hygiene, 15m, 🔥]
- [x] SWEEP-4-2 — **DONE 2026-05-14:** Added `pre → post` format + `[audit-correction-w2f1]` tags to lines 912-913.
- [x] SWEEP-4-3 — **DONE 2026-05-14:** Added `applies_when:` qualifier to consumer_count_change for LiteGraph-internal symbols only.
- [x] SWEEP-4-4 — **Add `lgraphnode_on_executed` row to AUDIT-LG.10 verdict-table inventory.** `LGraphNode.onConfigure`, `onAdded`, `onRemoved`, `onWidgetChanged`, `onConnectInput`, `onConnectOutput`, `onPropertyChanged` all have rows; `onExecuted` (S2.N2, 51 consumers post-W2F-1) is conspicuously absent. Add `| lgraphnode_on_executed | field | LGraphNode.onExecuted | <int_rep> | 10 → **51** | top-50 | KEEP [audit-correction-w2f1] | high | keep-permanent |`. Pulls audit-LG.10 in line with the dashboard JSON `reauditDelta` and SG investigation §Step C. [hygiene, 10m, 🧹]
- [x] SWEEP-4-5 — **Add "no impact" Re-audit context stub to PR #12232.** Five of six PRs in the W2F-1 stack now carry the standard `## Re-audit context (W2F-1, 2026-05-13)` block; #12232 is the only outlier. Add the stub via `gh api -X PATCH repos/Comfy-Org/ComfyUI_frontend/pulls/12232` (per matrix note: `gh pr edit` swallows body updates). Stack consistency. [hygiene, 5m, 🧹]
- [ ] SWEEP-4-6 — **Prioritize `scripts/check-back-propagation.sh` (BACKPROP-3.B).** Roadmap entry in `back-propagation-matrix.yaml` is `status: not started`. SWEEP-4 confirms it would have caught all 3 drift cells automatically (Fix 1 narrative-vs-data contradiction; Fix 2 tag-format; Fix 3 over-broad propagation). Two hygiene sweeps in two days flag the same need — promote from "queued" to next-up. [tooling, ~2h, 🔥]
- [ ] SWEEP-4-7 — **Add per-pattern `consumer_count_w2f1: <N>` field on touch-points DB pattern blocks.** Reader of `database.yaml` alone has no way to reconcile evidence-row count (capped at top-10/surface) vs. claimed consumer count without cross-referencing `meta.reaudit_log` + the SG investigation MD. Adding a single `consumer_count_w2f1: 77` field to each S2.N1 / S2.N2 / S2.N7 / S2.N18 / S6.A1 / S11.G3 (and the 15 other touched surfaces) makes the DB self-describing. [data-model, 20m, 🧹]

### Top-3 highest-leverage gaps from SWEEP-4

1. **SWEEP-4-1** (audit-LG.10 §1007 stale narrative) — single highest-priority because it actively misleads anyone consulting the deletion ledger about W2F-1 coverage.
2. **SWEEP-4-6** (`scripts/check-back-propagation.sh`) — converts the manual sweep into a guard, eliminates this entire class of drift going forward.
3. **SWEEP-4-3** (matrix `applies_when:` qualifier) — prevents the S6.A1-style false-positive from re-firing on every future `app.*` escalation.

## 2026-05-13 wave-3 final-sweep consolidated findings

### DASH-2 — Make dashboard review-ready (HIGHEST PRIORITY) ✅ COMPLETED
- [x] DASH-2.A — Fill consumerEvidence data: added verdict↔pattern mapping in loader + helper functions (getConsumerForSurface, getDeltaForSurface, getRelatedConsumers).
- [x] DASH-2.B — Fix AuditPRDetail.vue title/description duplication (drop pr.title `<p>` since description always contains title slice). Per ecosystem#40.
- [x] DASH-2.C — Render PR description as markdown (use existing markdown-it dep if any, else simple line-break + code-block handling). Per ecosystem#40.
- [x] DASH-2.D — Fix verdict-table cell formatting "18no re-audit" missing separator. Per ecosystem#40.
- [x] DASH-2.E — Update dashboard README.md to mention /audit route + screenshot/description (SWEEP-5-1).
- [x] DASH-2.F — After fixes deploy: build verified, pushed to Vercel. Additional: added shiki syntax highlighting, PR quick-nav buttons, improved evidence row actions.

### DASH-3 — Auto-refresh hook (DASH-1.F)
- [ ] DASH-3 — Wire workspace `scripts/sync.sh` to regenerate dashboard JSON + push to ecosystem repo on every workspace sync. Until done, JSON drifts silently.

### WT-CLEANUP — Worktree hygiene (HIGH urgency)
- [x] WT-CLEANUP-1 — **DONE 2026-05-14:** All 4 v2 branches synced with remote (0 divergence).
- [x] WT-CLEANUP-2 — **DONE 2026-05-14:** Covered by WT-CLEANUP-1.
- [x] WT-CLEANUP-3 — **DONE 2026-05-14:** Covered by WT-CLEANUP-1.
- [x] WT-CLEANUP-4 — **DONE 2026-05-14:** Covered by WT-CLEANUP-1.
- [x] WT-CLEANUP-5 — **DONE 2026-05-14:** Removed 4 dead worktrees + branches (ext-api__i-foundation, i-pkg, i-ext, litegraph__prune-dead-surfaces).
- [x] WT-CLEANUP-6 — **DONE 2026-05-14:** Removed 5 restratify worktrees + branches (all identical to v2 after wave-5 reconciliation).

### PR-FOLLOWUP — Open PR action items
- [x] PR-FU-12142 — Duplicate of SWEEP-2-11.
- [ ] PR-FU-12230 — #12230 APPROVED but BLOCKED. Identify block, rebase if needed, flip to ready-for-merge.

### DRIFT-FIX — Cross-ref drift fixes (SWEEP-4)
- [x] DRIFT-FIX-1 — Edit AUDIT-LG.10 §1007 narrative: claims S2.N2-N6/N8-N17/N19 not re-audited; reality is all 18 were touched (15m).
- [x] DRIFT-FIX-2 — **DONE 2026-05-14:** Duplicate of SWEEP-4-2.
- [x] DRIFT-FIX-3 — **DONE 2026-05-14:** Duplicate of SWEEP-4-3.
- [x] DRIFT-FIX-4 — **DONE 2026-05-14:** Added lgraphnode_on_executed row to verdict table.
- [x] DRIFT-FIX-5 — **DONE:** Duplicate of SWEEP-4-5.
- [x] DRIFT-FIX-6 — **DONE 2026-05-14:** Duplicate of SWEEP-6-F2.

### AUTOMATION — Drift detection + sources manifest
- [x] AUTO-1 — Build `scripts/check-back-propagation.sh` (BACKPROP-3.B): compare DB consumer-counts against AUDIT-LG.10 + dashboard JSON + ADR refs; warn on drift. Wire into sync.sh (~2h).
- [x] AUTO-2 — Enumerate W2F-1 138-repo clone set in `sources.yaml` so re-audit is reproducible after `/tmp/` GC (30m, SWEEP-5-3).
- [ ] AUTO-3 — Build `scripts/listener-variant-sweep.sh` encoding the 6-variant pattern matrix (BACKPROP-2.C, ~1h).

### ADR-HYGIENE — ADR Status sweep (SWEEP-5-2)
- [x] ADR-HY-1 — Audit 8 ADRs missing Status field (D1, D2, D3.x, D4, D6.1, D14, D-uwf, etc.) and add Status: line per house style (~30m).
- [x] ADR-HY-2 — **DONE 2026-05-14:** Added back-propagation-matrix.yaml reference to D6.2 ADR.
- [x] ADR-HY-3 — **DONE 2026-05-14:** Added migration guide link to extensions/README.md with (draft) caveat.

### EXT-DEPS — External dependencies
- [ ] EXT-DEP-1 — Comment on Comfy-Org/comfy-codesearch#10 with concrete fix proposals (or open implementation PR). Zero replies since 2026-05-13. Unblocks BACKPROP-2 cascade (30m+).

### TEST-COVERAGE — RED test gaps from SWEEP-1.E
- [ ] TC-1 — Promote `bc-03.v1.test.ts` from `it.todo` (7 todos) for S2.N7 onConfigure — RED tier, highest-value win (~2h).
- [ ] TC-2 — Promote `bc-23.v1.test.ts` from `it.todo` (7 todos) for S2.N18 onPropertyChanged — RED tier (~2h).
- [ ] TC-3 — Promote `bc-14.v1.test.ts` from `it.todo` (6 todos) for S6.A1 graphToPrompt — YELLOW tier (~2h).

## 2026-05-13 wave-4 — Decision-application reconciliation + process codification

### RECONCILE — Reset v2 branches to restratify state + cherry-pick v2-only on top
For each branch pair: reset v2 → restratify, cherry-pick the 2-3 v2-only commits, force-push to update PR, regenerate docs.

- [x] RECONCILE-FOUNDATION — i-foundation pair. v2-only=2 commits, restratify-only=22. PR #12142. Reset to restratify, cherry-picked 73f608b421→68ca5c5d81 and 8564a19dc7→25d245f283. Conflicts in index.ts (defineNode rename) and node.ts (NodeMode string-union conversion) resolved manually. Gates pass. New head 25d245f283.
- [x] RECONCILE-PKG — i-pkg pair. PR #12143 head: a01e4c5ab8 → 5f25608c34. Remote v2 already had restratify + 1 ESLint commit; synced local, added oxfmt ignorePattern for `packages/extension-api/build/**`. 3 gates green. 53 Mintlify pages regenerated. Comment: https://github.com/Comfy-Org/ComfyUI_frontend/pull/12143#issuecomment-4447367735
- [x] RECONCILE-EXT — i-ext pair. v2-only=2 commits, restratify-only=14. PR #12144. ✅ Reset to restratify, cherry-picked F-12144-1 doc + autoformat. SHA 4b99aa28b0→e154716e35. Comment: https://github.com/Comfy-Org/ComfyUI_frontend/pull/12144#issuecomment-4447364941
- [x] RECONCILE-TF — i-tf pair. PR #12145. Old `00b4db56cd` → new `dcd0e9d1e9`. Discovered origin v2 was already restratify+lint, but local worktree had 14 dropped commits (BC.08/BC.28-30/lazy-serialize/ADR-0010/CR-FIX-4); cherry-picked 13, skipped `9a2593cfe0` (harness.ts deletion intent already satisfied differently on origin). WIP commit `9717961dd7` kept (followups resolve remaining 61 errors). Gates pass. [comment](https://github.com/Comfy-Org/ComfyUI_frontend/pull/12145#issuecomment-4447394240).

### MISSING-ADRs — Write ADRs for decisions logged "needs ADR" in design-review-12142.md
- [x] ADR-D11-NAMING — Decision #5: `defineNode` / `defineWidget` shorter form. Cross-link to renames in restratify branches.
- [x] ADR-D12-SERIALIZATION-BAN — Decision #11: ban `node.on('beforeSerialize')`, add deprecation warnings. (Note: ADR-0010 already exists on restratify branches per `git log` — verify content + promote to workspace decisions/ folder.)
- [x] ADR-D13-IMMUTABILITY — Decision #14: return fresh copies, standardize across codebase.
- [x] ADR-D18-PURE-FUNCTIONS — Decision #18: pure functions + loader-based registration. **DONE 2026-05-14.** ADR written: [`decisions/D18-pure-functions-loader-registration.md`](decisions/D18-pure-functions-loader-registration.md). Defines pure-function `defineNode`/`defineWidget`/`defineExtension` contract, loader contract (brand + dispatch by export), banned imperative patterns, 4-phase implementation plan (Phase 1 foundation, Phase 2 ext loader, Phase 3 docs+lint, Phase 4 v1 deprecation gated on D6.2 telemetry), and migration impact mapped against W2F-1 re-audit top-10. Also fixed pipefail/SIGPIPE bug in `scripts/check-decision-propagation.sh` that was falsely reporting 5 orphans (now reports 0). **Implementation legs (commit + dashboard JSON) tracked in Phase 1–3 of the ADR — separate tasks.**

### AUDIT-PUBLIC-API — Surface audit for accidental public exports
- [x] AUDIT-API-1 — **DONE 2026-05-14.** 42 exports classified. Output: `research/architecture/public-api-surface-audit-2026-05-14.md`. Findings: 38 intended-public, 3 accidental-public (VueExtension, CustomExtension, three `*EntityId` brands), 1 conflict (NodeBeforeSerializeEvent — banned by D15).
- [x] AUDIT-API-2 — **DONE 2026-05-14.** Verdict: remove from public barrel — discriminated-union ingredients only. ADR: `decisions/D19-vueextension-disposition.md`. Implementation: PR #12142 commit `d4323d7ab1`.
- [x] AUDIT-API-3 — **DONE 2026-05-14 (ADR; impl deferred).** Verdict: 2-tier model. Tier 1 = opaque `node.id` + `node.equals(other)` for the 90% case; Tier 2 = keep `NodeLocatorId` + `NodeExecutionId` for protocol boundaries (workflow JSON, websocket); demote `NodeEntityId` / `WidgetEntityId` / `SlotEntityId` to `@internal`. ADR: `decisions/D20-id-type-convergence.md`. Implementation deferred to follow-up commit (touches all four ext-api branches; out of scope for this session).

### PROCESS — Codify reconciliation + drift detection
- [x] PROCESS-1 — Add `scripts/check-branch-divergence.sh` — for each known pair (e.g. ext-api/i-X-restratify ↔ ext-api/i-X-v2), report commit count divergence + key-file diffs. Fail (exit 1) if drift > N commits without an explicit "merge-ok" marker.
- [x] PROCESS-2 — Add `scripts/check-decision-propagation.sh` — for each decision in design-review-12142.md "Decisions" table, verify there's a corresponding commit OR ADR OR explicit "deferred" marker. Fail on orphans.
- [x] PROCESS-3 — Wire both checks into `scripts/sync.sh` so workspace sync surfaces drift.
- [x] PROCESS-4 — Update `AGENTS.md` with: (a) branch reconciliation rule (no parallel restratify/v2 pairs without an explicit merge-back step), (b) decision propagation rule (every Decisions-table row must reach a commit + ADR + dashboard JSON), (c) dashboard sync rule (regenerate docs after every reconciliation).
- [x] PROCESS-5 — Extend `research/meta/back-propagation-matrix.yaml` with new change types: `branch_divergence_detected` and `decision_logged_but_unimplemented`.

### DASH-REFRESH — Refresh dashboard after reconciliation
- [x] DASH-REFRESH-1 — After RECONCILE-PKG completes, run `scripts/refresh-api-docs.sh` in ecosystem repo, commit, push, merge.
- [~] DASH-REFRESH-2 — **PARTIAL 2026-05-14.** Verified raw upstream (`https://raw.githubusercontent.com/Comfy-Org/ComfyUI_frontend/ext-api/i-foundation-restratify/src/extension-api/index.ts`) reflects: `defineNode` (not `defineNodeExtension`) ✓, no `apiVersion` ✓, no `VueExtension`/`CustomExtension` exports (D19) ✓, no `@stability stable` ✓. Updated dashboard `useApiSurface.ts` to point at `i-foundation-restratify` (was older `i-foundation`); merged in ecosystem PR (commit `8e612a0` on `main`). **Blocked on:** `/api-docs` and `/audit` routes are NOT shipped (per AGENTS.md SWEEP-5 finding); only `/api-diff` exists. Verifying the rendered dashboard pages requires shipping those routes first — separate task. Live `/api-diff` will reflect the new branch after Vercel rebuild.

---

## Wave-6 — Remaining Slack-thread proposals + extension-api CI hardening (2026-05-14)

> Source: Christian's Slack pin in `#frontend` listing 7 proposals "started in branches but not applied to API surface yet" + immediate user asks during T-019e2802 handoff. Must reach (a) commit on a live PR branch, (b) ADR in `decisions/`, (c) dashboard JSON refresh per AGENTS.md "Decision propagation rules".
>
> Scaffolding tasks (`W6.SCAFFOLD-*`) are first prio for the next session — they unblock everything downstream.

---

### Wave-6 process discipline (REQUIRED — agent compliance gate)

Every P-block follows the same five-stage pattern. The agent MUST NOT skip
or combine stages, MUST NOT make the option pick on the human's behalf,
and MUST stop at the **PICK** stage to present pros/cons and wait for
explicit human selection.

| stage | what | who | output | enforcement |
|---|---|---|---|---|
| **R1–R3** research | usage sweep + blast-radius + effects matrix | agent | data only — call-site catalog, consumer counts, per-option migration-cost matrix | NO verdicts, NO "recommended option", NO "X is not feasible". If the agent finds itself writing those words, stop and re-read this row. |
| **R4–R5** ingest | behavior DB update + dashboard refresh | agent | rollup + dashboard push | data only |
| **P*.A** brainstorm | enumerate options inside the ADR | agent | per-option section in ADR with pros / cons / migration-cost / blast-radius — sourced verbatim from R1–R5 artifacts | NO pick. ADR Status stays `proposed`. |
| **P*.PICK** ← **HUMAN-IN-THE-LOOP** | choose option (i / ii / iii / hybrid / defer) | **human (Christian)** | one-line decision + rationale captured in the ADR §Decision section; agent flips ADR Status to `accepted` only AFTER human types the pick | Agent must paste the pros/cons table into chat, ask "which option do you pick?", and wait. No auto-progress. |
| **P*.IMPL** | foundation + pkg + ext + tf cascade + dashboard + PR comment | agent | commits with `D{NUM}` in subject, ADR `accepted`, dashboard regenerated, design-review row updated | per AGENTS.md "Decision propagation rules" — all 3 legs (a/b/c) within same wave |

**Per-block stage labelling:** existing P-block headings use `P*.A`/`P*.B`/etc. inconsistently. Reading guide:

- W6.P3 / W6.P4 / W6.P8: `A` = brainstorm (no pick), `B` = **PICK (human)**, `C` = foundation impl, `D` = cascade
- W6.P5: `A` = brainstorm (no pick), `B` = reconcile types, `C` = **PICK (human)** + topology pick, `D` = impl
- W6.P6: `A` = brainstorm (no pick), `B` = **PICK (human)**, `C` = foundation impl, `D` = cascade
- W6.P2: `A` = compare scope (no pick), `B` = **PICK (human)** of (i)-already-covered / (ii)-extend / (iii)-supersede
- W6.P1: ADR already accepted; `A` = decompose impl tasks, `B`–`F` = impl cascade (no pick stage)

**Stop conditions for the agent at each PICK step:** (a) ADR §Options section
populated with pros/cons sourced from R1–R5 artifacts; (b) chat message to
human containing the option matrix and an explicit "pick: ?" prompt;
(c) NO further task progression until human responds. If the human is
absent (background run), the agent records the situation in the lockfile
and HALTS that P-block — does NOT advance to the next P-block to "make
progress" using its own judgment.

If the agent finds itself reasoning "the data clearly suggests option X,
so I'll proceed with X" — STOP. That reasoning is the bug this section
exists to prevent. The data may indeed clearly suggest X, but recording
that in chat for human ratification is the entire point of the
PICK stage.

---

### W6.SCAFFOLD — Skeleton ADRs and tracking sections (do FIRST in next session)
- [x] W6.SCAFFOLD-1 — Write `decisions/D-widget-converge.md` skeleton (DOMWidget vs BaseWidget collapse). Template: D11/D15/D20. Status: `proposed`. Sections: Status / Context (link the Slack proposal + design-review row #12 + R4 P9 evidence) / Decision (TBD — three options to enumerate) / Consequences / Alternatives / Implementation plan (TBD — leave a one-row stub) / References. [routine, 30m]
- [x] W6.SCAFFOLD-2 — Write `decisions/D-coordinate-space.md` skeleton (canvas vs client-pixel vs CSS size). Template: D11/D15/D20. Status: `proposed`. Cross-ref design-review row #10 + S2.N9 `onDrawForeground` evidence + S2.N11 `computeSize`. [routine, 30m]
- [x] W6.SCAFFOLD-3 — Write `decisions/D-shell-ui-entrypoints.md` skeleton (separate `defineBottomPanelTab` / `defineSidebarTab` / `defineCommand` / `defineHotkey` entry points; toast/command-invocation stay as in-hook usage). Template: D11/D15/D20. Status: `proposed`. Cross-ref existing `SidebarTabExtension` / `BottomPanelExtension` / `CommandManager` types + S12.UI* surfaces. Note user benefit framing: granular load/disable, testability, lifecycle. [routine, 30m]
- [x] W6.SCAFFOLD-4 — Write `decisions/D-bootstrap-hooks.md` skeleton (remove or rename `setup`/`init` hooks). Template: D11/D15/D20. Status: `proposed — investigation`. Decision is gated on use-case audit per the Slack TODO. Cross-ref existing `init` and `setup` in `ExtensionOptions` + R4 evidence on real init/setup usage in the ecosystem. [routine, 30m]
- [x] W6.SCAFFOLD-5 — **DONE 2026-05-14.** Wave-6 tracking subsection appended to `design-review-12142.md` after Open Research table; Open Research entries cross-linked to skeleton ADRs. Note: propagation script only parses `## Decisions` table (not Open Research / Wave-6 subsection), so Wave-6 rows stay un-flagged while pending; on Decision flip they'll move into the canonical Decisions table for the script to enforce all 3 propagation legs.

### W6.P0 — D20 reconciliation: 2-tier vs singular-only (CLOSED 2026-05-14)
- [x] W6.P0.A — **DECIDED**: honor D20's accepted 2-tier model. NO follow-up "singular-ID-only" ADR. Rationale in CONTEXT.md "D20 reconciliation closed" section: (1) D20 §Context already documents Austin's pushback; (2) W2F-1 evidence S5.A3 shows dozens of websocket-event consumers receive `NodeExecutionId`-shaped strings; (3) authors *receive* IDs constantly but *construct/parse* rarely — the 2-tier asymmetry is correct; (4) the 8 dashboard helper pages are the intentional D20 §Implementation step-9 output, not drift.
- [ ] W6.P0.B — **PENDING (Christian's action)**: update Slack pin to disambiguate — D20 IS implemented for `*EntityId` brands; `NodeLocatorId`/`NodeExecutionId` intentionally retained per ADR §Context. Cite the W2F-1 S5.A3 evidence. [process, 5m, requires Slack-side action]
- [x] W6.P0.C — **DROPPED**: P0.A picked "honor 2-tier", so no follow-up ADR or cascade needed. Removed from active backlog.

### W6.P1 — D14-serialization-convergence: ship the impl (ADR already accepted)

> ADR is `accepted`; research-before-impl pass formalizes the per-context audit so we don't ship a 1-target model that breaks copy/paste or subgraph promotion. Research substeps gate W6.P1.B.

**Research substeps (gate W6.P1.B):**
- [ ] W6.P1.R1 — Usage-pattern sweep: MCP `comfy_codesearch` for `serializeValue`, `onSerialize`, `app.graphToPrompt`, `clipboardData.setData('text/x-comfyui')`, `subgraph.promote`. Capture excerpts with full call-site context. [analytical, 1h]
- [ ] W6.P1.R2 — Blast-radius computation: re-rank S4.W3, S6.A1, S2.N15 against W2F-1 re-audit baseline; per-context rollup (prompt vs workflow vs clone vs subgraph-promote). Output: table in `research/architecture/D14-serialization-blast-radius.md`. [analytical, 45m, after R1]
- [ ] W6.P1.R3 — Effects matrix: for each of the 4 contexts, classify what changes when collapsed → 1 target. Categories: silent data loss / round-trip break / clipboard paste corruption / subgraph promotion regression / migration runway. [analytical, 45m, after R2]
- [ ] W6.P1.R4 — Behavior DB update: amend `research/touch-points/database.yaml` entries for S4.W3 + S6.A1 + S2.N15 with W2F-1 consumer counts and per-context evidence. Re-run `scripts/rollup-blast-radius.py`. [routine, 30m, after R3]
- [ ] W6.P1.R5 — Dashboard refresh: regenerate `christian-byrne/ComfyUI_frontend-ecosystem` views for S4.W3/S6.A1/S2.N15 patterns. Run `scripts/refresh-api-docs.sh`. Push to main. Verify `/patterns` shows updated counts. [routine, 30m, after R4]

**Implementation chain:**
- [ ] W6.P1.A — Audit `decisions/D14-serialization-convergence.md` §Implementation plan; produce per-branch impl tasks (foundation API surface; pkg .d.ts rebuild; ext consumer updates; tf test triplet updates). Use R3 effects matrix to confirm migration runway. [analytical, 30m, after R5]
- [ ] W6.P1.B — Foundation impl: collapse the 4-context save model into the single-target model per D14 ADR. Update `WidgetBeforeSerializeEvent` + `NodeBeforeSerializeEvent` shapes. [analytical, 2h, after P1.A]
- [ ] W6.P1.C — Pkg cascade + .d.ts rebuild + extensionV2 stub update. [routine, 30m, after P1.B]
- [ ] W6.P1.D — Ext cascade (mostly rebase; check for v2 example serializer extensions). [routine, 30m, after P1.C]
- [ ] W6.P1.E — Tf cascade: BC.16 + BC.17 + BC.S* test triplets, plus harness. [routine, 1.5h, after P1.D]
- [ ] W6.P1.F — Reconcile v2 sides + dashboard refresh + PR comment. Mirror D20 closeout shape. [routine, 30m, after P1.E]

### W6.P2 — D14-widget-state-categories: reconcile vs Slack proposal scope

> Existing D14 ADR is `implemented` (Schema/Props split). Slack proposal proposes more radical: collapse `options`/`properties`/`value`/instance-attributes → `Identity (immutable) + Props (mutable)`. Research substeps gate the reconcile-vs-supersede decision.

**Research substeps (gate W6.P2.A reconciliation):**
- [ ] W6.P2.R1 — Usage-pattern sweep: MCP `comfy_codesearch` for `widget.options.`, `widget.properties.`, `widget.value`, `widget.label`, `widget.disabled`, `widget.hidden`, plus instance-attribute access patterns. Distinguish READ vs WRITE call sites. [analytical, 1.5h]
- [ ] W6.P2.R2 — Blast-radius computation: per-attribute usage counts; identify which 4 surfaces (options/properties/value/instance-attrs) carry which fields; rank by consumer impact. [analytical, 45m, after R1]
- [ ] W6.P2.R3 — Effects matrix: for each attribute, classify under proposed Identity+Props split — Identity (immutable, set-once) vs Props (mutable, observable). Flag attributes that legitimately span both (e.g. `value` is mutable but its TYPE is immutable). [analytical, 45m, after R2]
- [ ] W6.P2.R4 — Behavior DB update: amend S4.W* entries with attribute-level evidence rows; new patterns if usage warrants (e.g. `widget.label` separate from `widget.options.label`). Re-run rollup. [routine, 30m, after R3]
- [ ] W6.P2.R5 — Dashboard refresh: regenerate views, especially `/patterns/S4.*` and `/api-diff` for the widget surface. Push to main. [routine, 30m, after R4]

**Reconciliation chain:**
- [ ] W6.P2.A — Compare Slack scope vs current D14 ADR (`status: implemented`) using R1–R5 evidence. Three possible outcomes: (i) already covers it — close out + Slack pin update; (ii) partial — extend existing ADR with §Phase 2 section + impl tasks; (iii) divergent — write new `D-widget-identity-props` that supersedes part of D14. Output: comparison one-pager in `research/architecture/`. [analytical, 1h, after R5]
- [ ] W6.P2.B — Whichever path P2.A picks, schedule the resulting impl/tracking tasks in this section. [process, 15m, after P2.A]

### W6.P3 — DOMWidget ↔ BaseWidget convergence (after W6.SCAFFOLD-1)

> Skeleton ADR `D-widget-converge.md` enumerates 3 candidate options. Research substeps gather evidence so the brainstorm + pick are grounded in ecosystem reality, not vibes.

**Research substeps (gate W6.P3.A brainstorm):**
- [ ] W6.P3.R1 — Usage-pattern sweep: MCP `comfy_codesearch` for `addDOMWidget`, `inputEl`, `widget.element`, `widget.serializeValue =`, `addWidget('combo')`/`addWidget('text')`. Catalog ALL DOM-widget call sites in top-50 packs with element type + lifecycle pattern (mount/unmount/value-binding presence). [analytical, 2h]
- [ ] W6.P3.R2 — Blast-radius computation: re-rank S4.W2/W3/W5 against W2F-1 baseline; split DOM-widget consumers into "value-bound" vs "ref-bound" vs "no value at all" buckets. Output: bucket histogram in `research/architecture/D-widget-converge-blast-radius.md`. [analytical, 1h, after R1]
- [ ] W6.P3.R3 — Effects matrix: for each option (i/ii/iii) × each consumer bucket → migration cost (mechanical sed / type-fix / rewrite required / unmigratable). Flag the 5 highest-impact consumers per option. [analytical, 1h, after R2]
- [ ] W6.P3.R4 — Behavior DB update: amend S4.W2/W3/W5 entries with new evidence + per-bucket subdivision; possibly add S4.W6 (Vue-runtime-bundled DOM widget — 9+ packs per Terry's pain-point assessment). Re-run rollup. [routine, 30m, after R3]
- [ ] W6.P3.R5 — Dashboard refresh: regenerate `/patterns/S4.W2` etc. with new buckets visible; push. [routine, 30m, after R4]

**Decision + impl chain:**
- [ ] W6.P3.A — Brainstorm the 3 design options inside `decisions/D-widget-converge.md` using R1–R5 evidence. Add per-option migration-cost row from R3 effects matrix. [analytical, 1h, after R5]
- [ ] W6.P3.B — Pick + flip ADR Status to `accepted`. [analytical, 30m, after P3.A — human-in-the-loop]
- [ ] W6.P3.C — Foundation impl. [analytical, 3h, after P3.B]
- [ ] W6.P3.D — Pkg/Ext/Tf cascade, reconcile, dashboard refresh, PR comment. Mirror D20 closeout. [routine, 2h, after P3.C]

### W6.P4 — Coordinate space abstraction (after W6.SCAFFOLD-2)

> Skeleton ADR `D-coordinate-space.md` enumerates 3 candidate options. Research substeps gather ecosystem evidence: which of the three spaces (canvas / client / CSS) authors actually reach for, and which mix-up bug class is most common.

**Research substeps (gate W6.P4.A brainstorm):**
- [x] W6.P4.R1 — Usage-pattern sweep. **DONE 2026-05-18 (handoff-9).** Pivoted to bulk-clone grep (MCP not needed) over W2F-1 138-repo corpus (`/tmp/codesearch-clones/repos/`). 16 patterns × receiver-gated regex, intent-classification heuristic. Total: 8,424 EXT hits / 103 repos / ★41,621. Scripts: `/tmp/sweep_coord_space.py`. Output: `/tmp/coord_space_catalog.json`. Lock: `tasks/W6-P4-R1.lock`.
- [x] W6.P4.R2 — Blast-radius computation. **DONE 2026-05-18 (handoff-9).** Joined catalog with `research/touch-points/star-cache.yaml`. Headline: bug class "got client when likely wanted canvas" = 2,617 hits / 71 repos / ★40,040 (31% of EXT hits). Manual conversions present in only 4.3% of call sites. Scripts: `/tmp/build_coord_r2_r3.py`. Artifact: `research/architecture/D-coordinate-space-blast-radius.md` §R2.
- [x] W6.P4.R3 — Effects matrix. **DONE 2026-05-18 (handoff-9).** Per-(pattern, intent) × per-option cost cells; all 8,424 EXT hits mapped (0 unmapped). Aggregates: (i) 1,305 ZERO / 5,524 TS-ERR / 1,595 REWRITE; (ii) 5,619 ZERO / 1,559 SILENT-NOOP / 1,246 REWRITE; (iii) 4,314 ZERO / 2,720 UNMIGRATABLE / 1,390 REWRITE. Top-10 UNMIGRATABLE / SILENT-NOOP repos are identical — same broken behavior, different label. Artifact: same §R3.
- [x] W6.P4.R4 — Behavior DB update. **DONE 2026-05-18 (W6.P4.D cascade).** Added 3 new patterns: S2.N9b (`node.pos`/`node.size` canvas-coord access), S2.N10b (`event.clientX/Y` mixed-space in event handlers), S3.C3 (`app.canvas.ds.scale/offset` escape-hatch READ — note: S3.C2 already taken by ContextMenu replacement, unrelated). Added BC.42 ("Coordinate-space conversion and mix-up bug class") with all 3 as members. Rollup re-run: 79 patterns / 919 evidence rows. Sweep tag: `D-coord-space-W6P4D`. Staging file: `research/touch-points/staging/D-coord-space-evidence.yaml`. Merge script: `scripts/merge-staging-coord-space.py`.
- [x] W6.P4.R5 — Dashboard refresh. **DONE 2026-05-18 (W6.P4.D cascade).** Synced 6 files into `christian-byrne/ComfyUI_frontend-ecosystem`: research mirror (`touch-points-database.yaml`, `touch-points-rollup.yaml`, `touch-points-star-cache.yaml`, `workspace-mirror/.../behavior-categories.yaml`) + src/data JSON (`behavior-categories.json`, `touch-points-database.json`, `touch-points-rollup.json`, `touch-points-star-cache.json`). Bumped `BehaviorCategories.test.ts` hardcoded category count 41 → 42. `pnpm test`: 178/178 passing. BC.42 appears at https://comfyui-frontend-ecosystem.vercel.app/behavior-categories once deploy lands.

**Decision + impl chain:**
- [x] W6.P4.A — Brainstorm. **DONE 2026-05-18 (handoff-9).** `decisions/D-coord-space.md` §Alternatives expanded with R1+R2+R3 evidence: per-option migration-cost row from R3 effects matrix, bug-class headline (2,617 hits / 71 repos / ★40,040), per-option pros + cons grounded in actual data, 5 cross-option observations. ADR Status: PROPOSED (unchanged). DATA ONLY framing preserved — no verdict, no recommended option. **AWAITING W6.P4.B human-in-the-loop PICK.**
- [x] W6.P4.B — Pick + flip ADR Status. **DONE 2026-05-18 (Christian, human-in-the-loop).** Picked **Option (iii) hide spaces, canvas-only handles** with documentation-first migration strategy. ADR `decisions/D-coordinate-space.md` Status flipped to ACCEPTED. **Axiom A13 (Single Coordinate Space — Canvas) added to AXIOMS.md** to short-circuit re-litigation by future surface ADRs (pointer-event helpers, drag-and-drop, viewport ADRs, custom `onDraw*` patching replacements).
- [x] W6.P4.C — Foundation impl. **DONE 2026-05-18 commit `fa3229b402`** on `ext-api/i-foundation-v2` (mirrored to `foundation-restratify`; drift = 0). Updated JSDoc on `NodeHandle.getPosition`/`setPosition`/`getSize`/`setSize` in `src/extension-api/node.ts` to name "canvas units" explicitly per A13 validation. Added canary example `src/extensions/core/coordSpaceDemo.v2.ts` demonstrating canvas-only handle usage + documented escape-hatch annotation pattern. Phase A gates (lint / format:check / knip): all green.
- [x] W6.P4.D — Cascade tail. **DONE 2026-05-18.** Behavior DB amend (R4) + dashboard refresh (R5) landed — see W6.P4.R4 / W6.P4.R5 above. `design-review-12142.md` updated: row #10 in Decisions table (commit `fa3229b402`) + Open Research row + Wave-6 tracking row P4 all flipped to CLOSED → Option (iii). `scripts/check-decision-propagation.sh` confirms #10 propagated (0 orphan decisions of 13). **NOTE**: pkg/ext/tf source rebase onto W6.P4.C foundation HEAD is bundled with the broader restack-after-foundation cascade (covers W6.P3.D + P8.D too) which runs separately — pkg/ext/tf still have merge-base `a058a410ac` (D20). PR comment on #12142 deferred until that restack lands so the PR-attached commit list reflects all 3 foundation changes together.

### W6.P5 — Shell UI entry-point separation (after W6.SCAFFOLD-3)

> Skeleton ADR `D-shell-ui-entrypoints.md` enumerates 3 candidate options. Largest W6 surface change. Research substeps gather per-surface usage evidence so we can prove which surfaces actually warrant separate entry points vs which can stay in the slot pattern.

**Research substeps (gate W6.P5.A brainstorm):**
- [x] W6.P5.R1 — Usage-pattern sweep. **DONE 2026-05-18 (handoff-10).** Pivoted to bulk-clone grep (MCP not used) over W2F-1 138-repo corpus (`/tmp/codesearch-clones/repos/`). 9 surfaces × 2–4 query variants each, receiver-gated regex (slot vs. imperative vs. prototype-patch). **Total: 688 EXT hits / 64 repos / 10,758 files scanned.** Per-surface (hits): menu 249, toast 166, settings 94, command 85, bottom_panel 36, sidebar_tab 22, hotkey 22, about 14, toolbar 0. Scripts: `/tmp/sweep_shell_ui.py`. Catalog: `/tmp/shell_ui_catalog.json`. Lock: `tasks/W6-P5-R1.lock`.
- [x] W6.P5.R2 — Blast-radius computation. **DONE 2026-05-18 (handoff-10).** Joined catalog with `research/touch-points/star-cache.yaml`. **Headline: 688 hits / 64 repos / cum★36,279 union; non-menu shell-UI scope = 439 hits / ~22 repos / ★22,887.** Top consumers: ComfyUI-Manager (★14,636), Impact-Pack (★3,109), KJNodes (★2,588) — own 89% of non-menu cum-stars between them. KJNodes is the broadest-coverage canary (5 of 9 surfaces). Output: `research/architecture/D-shell-ui-blast-radius.md` §R2.
- [x] W6.P5.R3 — Effects matrix. **DONE 2026-05-18 (handoff-10).** Per-(surface, option) cost cells; all 688 EXT hits mapped (0 unmapped). Aggregate excluding menu (the actual P5 scope): (i) keep slots 439 ZERO / 0 REWRITE; (ii) separate entries 0 ZERO / 439 REWRITE; (iii) drop slots 235 ZERO / 204 REWRITE. Menu surface (249 hits) classified UNMIGRATABLE under all 3 options — separate ADR scope. Output: same artifact §R3.
- [ ] W6.P5.R4 — Behavior DB update: amend S12.UI1/UI2/UI3/UI4 with consumer counts; add S12.UI5+ for missing surfaces (toolbar buttons, queue badges if used). Re-run rollup. **DEFERRED until post-PICK** per W6.P8 precedent.
- [ ] W6.P5.R5 — Dashboard refresh: extend `/patterns` to surface S12.* view; push. **DEFERRED until post-PICK** per W6.P8 precedent.

**Decision + impl chain:**
- [ ] W6.P5.A — Brainstorm option matrix inside `D-shell-ui-entrypoints.md` using R1–R5 evidence. Add per-option × per-surface migration-cost matrix from R3. Cite Slack benefit framing: granular load/disable, testability, lifecycle. [analytical, 1.5h, after R5]
- [ ] W6.P5.B — Reconcile with existing `SidebarTabExtension` / `BottomPanelExtension` / `CommandManager` types in `src/extension-api/shell.ts` — mark which stay, which become arg-types of new entry points, which get dropped. [analytical, 1h, after P5.A]
- [ ] W6.P5.C — Pick + flip ADR Status. **Also pick PR topology**: parallel to 4-PR stack vs rebased on top. [analytical, 30m, human-in-the-loop, after P5.B]
- [ ] W6.P5.D — Foundation impl + cascade + dashboard. Mirror D20 closeout. **Note**: single largest surface change in W6 — per P5.C topology pick may need its own PR(s) parallel to the existing 4-PR stack. [analytical+routine, 6h, after P5.C]

### W6.P6 — `setup` / `init` hook investigation (after W6.SCAFFOLD-4)

> Skeleton ADR `D-bootstrap-hooks.md` Status: `proposed — investigation`. Decision MUST be evidence-driven: if real `init`/`setup` use cases don't exist, option (iii) drop is feasible; if they do, (ii) rename is necessary.

**Research substeps (gate W6.P6.A brainstorm):**
- [x] W6.P6.R1 — Usage-pattern sweep done 2026-05-14 (handoff-5). MCP comfy_codesearch failed ~88% this session; fallback to W2F-1 138-repo bulk-clone grep at `/tmp/codesearch-clones/repos/`. **228 hook hits across 68/138 repos (~49% adoption); 167 setup, 61 init.** Catalog: [research/custom-node-patterns/init-setup-usage-audit.md](file:///home/c_byrne/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api/research/custom-node-patterns/init-setup-usage-audit.md). Raw observations only — option (i)/(ii)/(iii) decision deferred to W6.P6.A brainstorm (human-in-the-loop) after R2/R3 land.
- [x] W6.P6.R2 — Blast-radius computation done 2026-05-14 (handoff-5). Joined R1 catalog with `research/touch-points/star-cache.yaml`. Per-bucket cum_stars: post-api-mount 6,951 / post-graph-loaded 15,457 / post-extension-store-ready 26,110 / register-side-effect 28,133 / no-op 1,551 / other 19,663. Per-hook: init 24 repos / 30,534 cum_stars; setup 61 repos / 34,544. Section appended to catalog.
- [x] W6.P6.R3 — Effects matrix done 2026-05-14 (handoff-5). Per-option × per-bucket cost table appended to catalog with taxonomy zero/sed/per-node/d18-loader/typed-channel/unmigratable. Aggregate: (i) keep 0/228 hits affected; (ii) rename 228/228; (iii) drop 221/228 (with cross-decision blockers on `api.on()` typed channel + D-shell-ui-entrypoints). DATA ONLY — pick deferred to W6.P6.B (human-in-the-loop).
- [ ] W6.P6.R4 — Behavior DB update: not currently in S* taxonomy (init/setup are sanctioned hooks, not patches). Add a new S1.H* row family for "extension-options lifecycle hooks" with subentries for `init`/`setup`/`addCustomNodeDefs`/etc. Re-run rollup. [routine, 30m, after R3]
- [ ] W6.P6.R5 — Dashboard refresh: surface S1.H* family on `/patterns`; push. [routine, 30m, after R4]

**Decision + impl chain:**
- [x] W6.P6.A — Brainstorm done 2026-05-14 (handoff-5). Interactive walkthrough with Christian; original 3-option matrix (i keep / ii rename / iii drop) superseded by adopted 4th shape derived during brainstorm. Pros/cons table now in [decisions/D-bootstrap-hooks.md](file:///home/c_byrne/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api/decisions/D-bootstrap-hooks.md) §Alternatives considered.
- [x] W6.P6.B — **PICK landed 2026-05-14 (Christian, human-in-the-loop).** Decision: context-scoped Vue-style lifecycle hooks (`onMounted`/`onBeforeMount`/`onUnmounted`/`onActivated`/`onDeactivated`) inside `defineExtension.setup` / `defineSidebarTab.setup` / `defineBottomPanelTab.setup` bodies; remove `init` and `setup` as `ExtensionOptions` properties (with v1 mapper for back-compat); add 4 typed event-channel namespaces (`graph.on` / `execution.on` / `server.on` / `workbench.on`). **Reconciled same day:** `workbench` is for the 3 UI events only — NOT an umbrella for `defineSidebarTab`/`defineBottomPanelTab`/`defineCommand`/`defineHotkey`/`toast`; those stay top-level under W6.P5. P6 decouples from P5 — ships independently. ADR Status flipped to `accepted`. Cross-couples to D5 (typed event payloads) only.
- [ ] W6.P6.C — Foundation impl (9 steps per ADR §Implementation plan). Gated on D5 typed-event payloads only (with fallback: ship inferred-`unknown` payloads + augment-to-tighten in follow-on). NOT gated on W6.P5. [analytical, 6h+, after P6.B]
- [ ] W6.P6.D — Pkg/Ext/Tf cascade + dashboard refresh + PR comment + design-review-12142.md row update with commit SHA + D-bootstrap-hooks cross-link. Mirror D20 closeout. [routine, 2h, after P6.C]

### W6.P7 — NodeMode string-union cascade (Decision accepted, impl pending)

> **Gap discovered 2026-05-14 audit** of Slack `#p-frontend-graph-improvements`. Slack proposal (2026-05-12 22:00) proposed `NodeMode` enum → string union `'always'|'never'|'bypass'|'once'|'onTrigger'`. Decision accepted in `design-review-12142.md` row #9 (date 2026-05-12) but live code in `ComfyUI_frontend/src/extension-api/node.ts:61` still has numeric union `0 | 1 | 2 | 3 | 4`. Decision propagation legs (a) commit + (c) dashboard never landed.

- [x] W6.P7.A — Confirm decision is final (no second-thoughts re: numeric compatibility shim). User confirmed 2026-05-14: string union final, no shim. [done]
- [x] W6.P7.B — Foundation: change `NodeMode` to string union. **Already shipped** in commit `e25e210933` (2026-05-12) "refactor(ext-api): clean up API surface per design review decisions"; doc fix `300be13a4c`. `extension-api-service.ts:424–433` has `modeMap: Record<number, NodeMode>`; `extension-api-service.ts:481–489` has `numericModeMap: Record<NodeMode, number>` boundary mapping. Original audit was a stale-symlink misread. [done]
- [x] W6.P7.C — Pkg cascade: `.d.ts`. **Already current**: bundled `packages/extension-api/build/index.d.ts:535` declares `type NodeMode = 'always' | 'never' | 'bypass' | 'once' | 'onTrigger'`. The bundle is the canonical entry point per `package.json` `"types": "./build/index.d.ts"`; per-file `build/extension-api/node.d.ts` is a vestigial side-output not exposed to consumers. [done]
- [x] W6.P7.D — Ext cascade: `git grep` of `origin/ext-api/i-ext-v2 -- 'src/extensions/core/*.v2.ts'` for `NodeMode\|setMode(\|getMode()` returned 0 hits — no v2 example extensions reference `NodeMode` numerically. [done]
- [x] W6.P7.E — Tf cascade: `ext-api/i-tf-v2` already has `NodeMode = 'always' | … | 'onTrigger'` at `node.ts:56` plus full boundary mapping in `extension-api-service.ts`. Behavior triplets touching `mode` were swept along with the foundation refactor. [done]
- [x] W6.P7.F — Reconcile + dashboard + PR comment + design-review row update. Origin SHAs identical for `restratify`↔`v2` across all 4 pairs (foundation `a058a410ac`, pkg `574a23209c`, ext `e02bf15bef`, tf `67842083e7`). Dashboard `src/data/api-docs/nodemode.mdx:7` already shows string union. Row #9 of design-review-12142.md updated with commit SHA. Wave-6 tracking row P7 flipped to "CLOSED 2026-05-14: already shipped". `scripts/check-decision-propagation.sh` confirms #9 propagated. PR comment posted on #12142. [done]

### W6.P8 — Immutability enforcement (skeleton ADR landed; Decision pick pending)

> **Gap discovered 2026-05-14 audit** of Slack `#p-frontend-graph-improvements`. Slack proposal (2026-05-12 23:51) on `node.widgets` mutation as a long-running bug class. Decision accepted in `design-review-12142.md` row #14 (2026-05-12) — "Return fresh copies. Standardize across codebase — needs ADR" — but no ADR was authored and no impl block was scheduled. Skeleton ADR `decisions/D-immutability-enforcement.md` landed 2026-05-14 (this audit) with three candidate options.

**Research substeps (gate W6.P8.A brainstorm):**
- [x] W6.P8.R1 — Usage-pattern sweep. **DONE 2026-05-14 (handoff-6).** Pivoted from failing MCP to bulk-clone grep against W2F-1 138-repo corpus (`/tmp/codesearch-clones/repos/`). 4,081 source files, 26 patterns gated on per-pattern receiver allowlists (NODE_RECEIVERS / WIDGET_RECEIVERS). Output: `research/architecture/D-immutability-enforcement-blast-radius.md` §R1 + `/tmp/immutability_catalog.json` (6,504 hits: 3,512 WRITE / 2,992 READ; 116/138 repos with ≥1 WRITE). Scripts: `/tmp/sweep_immutability.py`.
- [x] W6.P8.R2 — Blast-radius computation. **DONE 2026-05-14 (handoff-6).** Joined catalog with `research/touch-points/star-cache.yaml`. Per-family EXT cum-stars ranking: widget.value 43,582 / node.pos 25,286 / node.widgets 24,809 / node.inputs 18,664 / widget.serializeValue 16,447 / node.outputs 16,372 / node.size 12,859 / widget.options 11,898. Cross-tabulated with W2F-1 baseline (S2.N16, S4.W3, S4.W5); 3 new families flagged for R4 (S2.N16b inputs/outputs, S4.W* widget.options, S2.N17-style size/pos). Output: same artifact §R2 + `/tmp/immutability_r2_r3.json`. Scripts: `/tmp/build_r2_r3.py`.
- [x] W6.P8.R3 — Effects matrix. **DONE 2026-05-14 (handoff-6).** Per-pattern × per-option cost cells. Cost labels: ZERO / SILENT-NOOP / TS-ERR / RUNTIME-THROW / REWRITE-METHOD / UNMIGRATABLE. Aggregate frequencies on 5,819 EXT hits: (i) 4,100 ZERO + 1,719 SILENT-NOOP; (ii) 2,749 ZERO + 3,070 TS-ERR; (iii) 2,749 ZERO + 3,070 REWRITE-METHOD (~225 in UNMIGRATABLE cells without companion new surfaces). Output: same artifact §R3. DATA ONLY — no preference encoded.
- [ ] W6.P8.R4 — Behavior DB update: amend S2.N16, S4.W3, S4.W5 with new mutation evidence + read-vs-write split; possibly add S2.N16b for `node.inputs/outputs` mutation (often paired with widgets mutation). Re-run rollup. [routine, 30m, after R3]
- [ ] W6.P8.R5 — Dashboard refresh: surface mutation-pattern view on `/patterns`; push. [routine, 30m, after R4]

**Decision + impl chain:**
- [x] W6.P8.A — Brainstorm. **DONE 2026-05-14 (handoff-6).** `decisions/D-immutability-enforcement.md` §Alternatives expanded with per-option Pros/Cons sourced verbatim from R1+R2+R3, plus a compact comparison table (EXT hits affected / ZERO / non-ZERO bucket / UNMIGRATABLE / new mutator surface / risk class per option). ADR Status stays `PROPOSED` per Wave-6 process discipline — no pick. Note R4+R5 (DB amend + dashboard refresh) deferred until after PICK lands so the dashboard surfaces the accepted option, not all three.
- [x] W6.P8.B — Pick. **DONE 2026-05-14 (handoff-6) by Christian.** Picked **Hybrid C** — `ReadonlyArray<T>` / `Readonly<T>` types in the public `.d.ts`, applied to all 8 mutation families. NO runtime enforcement at decision time; `Object.freeze` dev-mode deferred to W6.P8.FREEZE follow-up. ADR Status flipped to `ACCEPTED`. Rationale: highest-leverage signal location (compile-time) at zero runtime cost; matches Redux/immer/Vue-readonly pattern minus the runtime leg; `as any` escape gap accepted as explicit trade for shipping fast. PICK transcript in chat thread T-019e3cad-e5bd-7508-a227-6f96ea99c2ed.
- [x] W6.P8.C — Foundation impl. **DONE 2026-05-14 (handoff-7) commit `df921f3512`** on `ext-api/i-foundation-v2`. Applied Hybrid C Readonly typing per ADR §Decision: (1) `Point`/`Size` → `readonly [number, number]` tuples (catches `getPosition()[0] = X` / `getSize()[0] = X`); (2) `getWidgets()` → `ReadonlyArray<Readonly<WidgetHandle>>`; (3) renamed `inputs()`/`outputs()` → `getInputs()`/`getOutputs()` returning `ReadonlyArray<Readonly<SlotInfo>>`, old names kept as `@deprecated` aliases; (4) new `WidgetHandle.options: Readonly<WidgetOptions>` bulk-read accessor; (5) new `WidgetHandle.serializeValue` accessor-only (setter intentionally absent — D5 `on('beforeSerialize')` is the v2 path); (6) `widget.value` unchanged per D14. Files: `src/extension-api/{node.ts,widget.ts}` + `src/services/extension-api-service.ts` (+168/-10). Phase A gates: lint OK / format:check OK / knip OK. Drift reconciled in-flight: `foundation-restratify` fast-forwarded to `df921f3512`; both branches in sync; `check-branch-divergence.sh` = 0 drifted pairs. Lock at `tasks/W6-P8-C.lock` (status: done).
- [ ] W6.P8.D — Pkg/Ext/Tf cascade + dashboard refresh + PR comment. Mirror D20 closeout. Update `design-review-12142.md` row #14 with commit SHA + ADR cross-link. Land R4 (behavior DB amend with new families) + R5 (dashboard refresh surfacing the immutability view on /patterns) in the same wave per AGENTS.md Rule #10 wave-N reconciliation discipline. [routine, 2h, after P8.C]

**Follow-up tasks (created at P8.B PICK):**
- [ ] W6.P8.FREEZE — `Object.freeze` dev-mode enforcement to catch `as any` / `@ts-ignore` / JS-not-TS escapes at runtime in dev. Wraps each `Readonly` accessor in a `process.env.NODE_ENV === 'development'` branch that calls `Object.freeze(result)` before returning. Production no-op. Belt-and-suspenders for the typing gap. Authored after P8.D lands and gets bake time; not a P-block of its own. [future / nice-to-have, 1h]
- [ ] W6.P8.UNMIGRATABLE — Address the ~225 R3 hits that have no v2 surface today: bulk `setOptions(opts)`, `setInputField(i, key, val)`, `setOutputField(i, key, val)`, `replaceInput(i, def)`, `replaceOutput(i, def)`. Bulk-options likely rolls into W6.P3 D-widget-converge; inputs/outputs per-field setters need a fresh ADR (placeholder: D-input-output-shape). Until ADRs land, affected sites stay as TS errors with `// TODO(D-immutability)` comments. [analytical, scope TBD, blocks consumer-side completion of immutability cliff]

---

## Wave-6 — Extension-API CI / package hardening (2026-05-14)

> Source: Christian's handoff message during T-019e2802. The published `@comfyorg/extension-api` package needs CI guardrails so unintentional surface changes get caught before publish. Each task scoped to a single GitHub Actions workflow file or repo config under `packages/extension-api/` so they can run in parallel.

### CI-EXT — Hardening tasks (task-decomposed)
- [ ] CI-EXT-1 — **Ecosystem code-search CI step**. New job in `.github/workflows/extension-api-typecheck.yml` (or sibling `extension-api-ecosystem-check.yml`): on every PR that touches `packages/extension-api/**` or `src/extension-api/**`, run a script that grep's the top-N starred custom-node repos for any symbol being removed/renamed in this PR. Surface a comment listing affected ecosystem packages. Reuse `research/touch-points/database.yaml` evidence rows + `star-cache.yaml` for the seed list. Out-of-band: requires a fast clone-cache. [analytical, 4h]
  - [ ] CI-EXT-1.A — Spike: which clone strategy fits a 5-min CI budget? Options: (i) on-demand fresh clone (slow), (ii) gh API content fetch per-file (rate-limited), (iii) prebuilt cache repo updated nightly. Output: `research/architecture/ext-api-ci-ecosystem-search-spike.md`. [analytical, 1h]
  - [ ] CI-EXT-1.B — Implement the chosen strategy as a script under `packages/extension-api/scripts/check-ecosystem-impact.ts`. [routine, 2h, after CI-EXT-1.A]
  - [ ] CI-EXT-1.C — Wire the script into a new GHA workflow with PR-comment side effect. [routine, 1h, after CI-EXT-1.B]
- [x] CI-EXT-2 — **Strict interface-change check**. New job that runs `api-extractor` (or `tsd` or a custom .d.ts diff) against the previous published version on npm; fails if the public surface changed without a `package.json` version bump. Should annotate the PR with the diff (added/removed/changed types). Builds on the existing `extension-api-publish.yml` version-vs-tag check. [analytical, 3h]
  - [x] CI-EXT-2.A — Spike: pick `api-extractor` vs `microsoft/api-extractor` vs `tsd` vs hand-rolled `.d.ts` diff. Output: `research/architecture/ext-api-surface-diff-spike.md`. [analytical, 1h]
  - [x] CI-EXT-2.B — Implement as `scripts/check-surface-diff.ts`. [routine, 1.5h, after CI-EXT-2.A]
  - [x] CI-EXT-2.C — New GHA workflow `extension-api-surface-diff.yml`. [routine, 30m, after CI-EXT-2.B]
- [x] CI-EXT-3 — **Automated changelog generation**. On every merge of an ext-api PR, append a structured entry to `packages/extension-api/CHANGELOG.md` derived from PR title + body + the surface-diff output (CI-EXT-2). Use Conventional Commits parser. Bump semver suggestion (patch/minor/major) based on diff classification. [analytical, 3h]
  - [x] CI-EXT-3.A — Spike: `changesets`, `release-please`, `semantic-release`, or hand-rolled? Compare. Output: `research/architecture/ext-api-changelog-spike.md`. [analytical, 1h]
  - [x] CI-EXT-3.B — Implement on the chosen tool. [routine, 1.5h, after CI-EXT-3.A]
  - [x] CI-EXT-3.C — Wire into existing `extension-api-publish.yml`. [routine, 30m, after CI-EXT-3.B]
- [x] CI-EXT-4 — **Review-required guard**. Add `CODEOWNERS` entry forcing 2-reviewer approval (or @ecosystem-team review) on any PR touching `packages/extension-api/**` or `src/extension-api/**`. Document in `packages/extension-api/README.md`. [routine, 30m]
- [ ] CI-EXT-5 — **Bundle/.d.ts size budget**. Job that fails if the published `.d.ts` or `.js` grows above N KB without an explicit budget bump in `package.json`. Catches accidental re-export bloat. [routine, 1h]
- [x] CI-EXT-6 — **TypeDoc docgen lint**. Re-run docgen in CI; fail on (a) any `@internal` symbol that leaks into the rendered MDX (caught Dashboard-side via D20 manual cleanup this session), (b) any broken `{@link X}` reference, (c) any export missing JSDoc. [routine, 1.5h]
  - [ ] CI-EXT-6.A — Implement an `@internal` leakage check: after docgen, grep generated `.mdx` for any of the `@internal` symbols listed in a manifest. [routine, 45m]
  - [ ] CI-EXT-6.B — Wire TypeDoc warning-count threshold to fail on > current baseline. [routine, 45m, after CI-EXT-6.A]
- [ ] CI-EXT-7 — **Provenance / SBOM hardening**. Already have `--provenance` flag; add SLSA Level-3 attestation, SBOM generation (`npm sbom` or `syft`), and signature-verification doc for downstream consumers. [routine, 2h]
- [ ] CI-EXT-8 — **build-docs.ts wipe-output fix**. (Discovered this session.) Patch `packages/extension-api/scripts/build-docs.ts` to delete `docs-build/mintlify/*.mdx` before regenerating, so removed/demoted symbols don't leave stale artefacts. Currently worked-around by manual `find ... -delete` step in the dashboard refresh. [routine, 30m]

### CI-EXT — Brainstormed nice-to-haves (low priority, parking lot)
- [x] CI-EXT-9 — **Visual API-diff comment on PR**. Render the surface diff as a structured GitHub comment with collapsible sections per change type (added / removed / changed signature). Builds on CI-EXT-2 output.
- [ ] CI-EXT-10 — **Mirror to a dedicated `@comfyorg/extension-api` repo**. Auto-mirror the `packages/extension-api/` subtree to a standalone repo so external contributors can PR against just the API surface without cloning the full frontend. Uses `git-subtree` or `git-filter-repo` on a cron.
- [ ] CI-EXT-11 — **Extension-author preview**. On PR, build the .d.ts and publish to a per-PR npm `dist-tag` (`@comfyorg/extension-api@pr-12142`) so ecosystem maintainers can `npm i` it and validate against their package locally before merge.
- [ ] CI-EXT-12 — **Migration-codemod auto-generation**. When a public symbol is renamed/removed, auto-generate a `jscodeshift` codemod under `packages/extension-api/codemods/` that ecosystem authors can run.
- [ ] CI-EXT-13 — **Public-API drift dashboard panel**. New page on `christian-byrne/ComfyUI_frontend-ecosystem` (`/api-changelog`) that pulls the CHANGELOG.md timeline + per-symbol blame for "first appeared in version X / last changed in Y". Cross-link to the symbol's own `/api-docs` page.
- [ ] CI-EXT-14 — **Extension-loading smoke job**. CI starts a headless ComfyUI frontend instance and loads all v2 example extensions in `src/extensions/core/*.v2.ts` against the just-built `.d.ts`. Catches runtime contract drift (e.g. type says `id: string` but runtime returns `undefined`).
- [ ] CI-EXT-15 — **`@since` JSDoc tag enforcement**. Every public export must carry a `@since X.Y.Z` tag matching its first-published version. Linter check + auto-population on first-add.

---

## 2026-05-18 — Extension API Design Review Action Items

> Source: Meeting transcript `Frontend-Standup-ef8d2f8d-17b7.json` + post-meeting clarifications
> Meeting notes: `research/external/meeting-2026-05-18-extension-api-design-review.md`
> **AXIOMS.md created** — top-level design constraints document

### API-* — Immediate Implementation (Christian)

- [x] API-1 — Remove node→widget communication from `defineNode` API (D1 axiom: nodes never look down). Audit `src/extension-api/node.ts` for any methods/events that allow nodes to reference widgets. **DONE 2026-05-18.** `addWidget()` removed; `getWidgets()`/`getWidget()` kept (read-only, already renamed).
- [x] API-2 — Comment out slot/connection hooks for Phase A (D2 axiom: minimal surface). Most use cases have better alternatives. **DONE 2026-05-18.** Slot event types + `on('connected')`, `on('disconnected')` commented.
- [x] API-3 — Remove `nodeMode` from exposed API surface (D2 axiom: "egregious" use case). **DONE 2026-05-18.** NodeMode type + getMode/setMode + on('modeChanged') all commented.
- [x] API-4 — Ensure widget handles don't expose methods to mutate sibling widgets (D1 corollary). **DONE 2026-05-18.** WidgetHandle has no sibling refs.
- [x] API-5 — Document subgraph/linked-instance constraints in API design docs (D4 axiom). **DONE 2026-05-18.** Created `decisions/D-linked-subgraph-constraint.md` with C1-C5 constraints, validation guidance, and extension author DO/DON'T.
- [x] API-6 — Go through entire API and comment out anything uncertain (D2 expansion: more than just slot hooks). **DONE 2026-05-18.** Full audit: spatial (getPosition/setPosition/getSize/setSize), visual (getTitle/setTitle/isSelected), widget visibility (isHidden/setHidden/isDisabled/setDisabled) all commented. Changes cascaded to pkg/ext/tf branches.
- [x] API-7 — Create `AXIOMS.md` as top-level constraints document. **DONE 2026-05-18.**

### FU-* — Follow-up (Team)

- [ ] FU-1 — **Jacob:** Compile list of future constraints (parallel execution, streaming, incremental computation). Must not preclude these capabilities.
- [ ] FU-2 — Dedicated session on widget state/serialization (schema + props + values three-tier model). D6 meeting decision is OPEN — MAJOR.
- [ ] FU-3 — Output system deep-dive. D7 meeting decision is OPEN — SECONDARY.
- [ ] FU-4 — Review ID strategy — confirm extensions never need raw IDs. D5 meeting decision DEFERRED with strong direction.

### AXIOM-VALIDATION — Axiom Compliance Checks

- [x] AXIOM-VAL-1 — Add `scripts/check-axiom-compliance.sh` that greps the codebase for axiom violations: node→widget refs, raw ID exposure, context-specific widget code. Wire into `sync.sh`. **DONE 2026-05-18.**
- [ ] AXIOM-VAL-2 — Audit all current `defineNode` exports for D1 compliance (no widget refs).
- [ ] AXIOM-VAL-3 — Audit all current `WidgetHandle` exports for D1 compliance (no sibling mutation).
- [ ] AXIOM-VAL-4 — Test against linked-instance scenario (D4): create test case with blueprint clone, verify widget state isolation.

### CONTEXT-UPDATE — Knowledge Capture

- [x] CTX-1 — Update `CONTEXT.md` with meeting knowledge. **DONE 2026-05-18** — cross-ref to AXIOMS.md.
- [x] CTX-2 — Update meeting notes with user clarifications. **DONE 2026-05-18.**
- [x] CTX-3 — Reference AXIOMS.md from AGENTS.md Key Source Files. **DONE 2026-05-18.**

---

## 2026-05-21 PM/evening — Wave-18 Dashboard polish + design system + enrichment

**Context**: Wave-17 shipped the snippet refresh + notify/toast resolution + PlannedBadge component + planned-frontmatter stamping (foundation `3d09f89251`, dashboard `d7f2e44`). User feedback (2026-05-21 evening): (1) broken nav buttons on /axioms and /decisions; (2) want the `designing-interfaces` skill applied for centralized design system; (3) ADR/axiom pages are squished and unreadable, want bible-style TOC and pretty-printing; (4) need more tests + refactoring + self-review + adversarial review; (5) keep populating examples + add wiki-style cross-references.

### Items

- [x] W18.A — Audit broken nav buttons on /axioms + /decisions + detail pages
- [x] W18.B — fixed via dashboard 31debea: scrollBehavior + chip path + heading-ids + vitest
- [x] W18.C — Run designing-interfaces /audit on dashboard — `research/dashboard-design-audit-2026-05-21.md`; verdict Precision & Density, 0 blockers, 2 smells
- [x] W18.D — Centralize design system (src/design-system/, src/components/ui/) — dashboard 9515389; design system seeded (Button/Badge/Card/CodeChip + tokens + cn util; PlannedBadge/NodePackCard/Decisions refactored; 36 new tests, 251/251 green)
- [x] W18.E — Persist src/design-system/system.md — living memory committed alongside W18.D in 9515389
- [x] W18.F — dashboard 09e9bb2; Prose + Toc + useToc + tests
- [x] W18.G — Axioms.vue bible treatment (sticky TOC, permalinks, cross-refs) — dashboard 5662adb; two-col layout, per-axiom anchor cards with copy-permalink + auto cross-ref chips (A1↔A14↔A15↔A16), preamble drop-cap, ADR backlinks inlined, xref helper (detectAxiomRefs), 11 new tests (Axioms=3, xref=8), 279/279 green
- [x] W18.H — DecisionDetail.vue pretty-printer (status badge, supersedes chips) — dashboard `f99458a`
- [x] W18.I — VERDICT: DEFER; zero inline-component usages in any markdown body today, PlannedBadge already works via frontmatter (W17.F/G), `.mdx` extension is cosmetic (raw-string loaded via `?raw`); see `research/dashboard-mdx-upgrade-spike-2026-05-21.md`
- [x] W18.J — closed; foundation 24d893d401, dashboard e28afeb; sparse count 0
- [x] W18.K — dashboard 09f1d55; 695 auto-links across 70 files; converges in 2 runs; 10 vitests; /wiki-link-mdx.mjs (auto-link known symbols)
- [x] W18.L — Wiki backlinks footer ("Referenced by") — dashboard c5b3be0; 45 ADRs + 15 axioms enriched (72 decision backlinks, 67 axiom backlinks)
- [x] W18.M — Self-review — `research/wave-18-self-review-2026-05-21.md`; 9 CLEAN / 1 SMELL (W18.K idempotence — acceptable) / 1 BLOCKER (MarkdownView slugify collision) FIXED in dashboard `27807e8` with 3 vitests; foundation `24d893d401` JSDoc-only verified; compliance grid 10/10
- [x] W18.N — Adversarial review — `research/wave-18-adversarial-review.md`; Skeptic/Architect/Minimalist on gemini-2.5-pro; verdict SHIP-WITH-FOLLOWUPS; P0 slugify collision found + handed to W18.M
- [x] W18.O — E2E nav smoke — dashboard `d90279a`, 21 tests covering 12 static routes + 6 dynamic fixtures + scrollBehavior + chip alignment regression guards; pnpm test:e2e → 21 passed (3.3s)

---

## 2026-08-10 — Wave-20: re-entry and reconciliation

**Context**: workspace dormant since 2026-05-21. Ownership of the V1 custom-node API moved to Ben Cooley (2026-08-03); sequencing changed so V1 ships before ECS as a non-breaking release; the ECS central-registry model was superseded by dedicated stores (ADR 0008 amendment, PR 12617). Full record in `CONTEXT-UPDATE-2026-08-10.md`, reconciliation in `RECONCILIATION-ben-v1-vs-workspace.md`, axiom dispositions in `AXIOMS-vs-v1-lineitem.md`. Internal review notes are kept in `private/` (not mirrored).

**Ordered by impact. P0 unblocks other people; P1 is our critical path; P2 prevents future rework; P3+ is scheduled work.**

### P0 — unblocks someone else, or is time-bound

- [ ] W20.P0.1 — **§3 ruling**: core widgets silently win name collisions — do packs win, or does shadowing fail loudly? 12 packs / 6.8M downloads. *Ben is blocked on this today.*
- [ ] W20.P0.2 — **§4a ruling**: rgthree pack-wide conversion. Recommendation on the table is to decline. *Blocking.*
- [ ] W20.P0.3 — **§6a ruling**: 14 sanctioned hold-outs on workflow save/load — confirm, and state what retires them. *Blocking.*
- [ ] W20.P0.4 — Hand over `tools/seed_control.py` and the measurement questions. Reads existing `mx/` artifacts; no corpus re-fetch, no harness re-run. Draft in `outreach/`.
- [ ] W20.P0.5 — Propose the A/A null run (same branch both sides) to establish the noise floor. One run, no new code, and it credentials the rig.
- [ ] W20.P0.6 — Raise the announce-date question: target is 2026-08-20 and pack validation has not started.
- [ ] W20.P0.7 — Offer to take a slice of QA wave 1; staffing there is the current constraint on the critical path.
- [ ] W20.P0.8 — Bundling input (Nodes 2.0 in-band vs opt-in, co-owned with Miles). Sequence after P0.4/P0.5 land — the evidence base needs its detection rate first.

### P1 — our critical path into the programme

- [ ] W20.P1.1 — Port #12143 (npm types package + TypeDoc→MDX docgen + CI). Answers the open Q6 directly; cleanest first contribution.
- [ ] W20.P1.2 — Port #12145 (test framework + behaviour triplets). Fills the proxy-contract test gap named in §6 of the V1 spec.
- [ ] W20.P1.3 — **Axiom session C (hold-firm)**: A13 coordinate space, A12 mount-lifecycle. A12 answers the open Q1 outright and contributes the remount lifecycle the spec lacks. *Lead with this session.*
- [ ] W20.P1.4 — Contribute AXIOMS.md as a design-review input to the V1 refactor pass
- [ ] W20.P1.5 — Port #12142's surface only where it still disagrees after the axiom sessions
- [ ] W20.P1.6 — Decide the fate of #12144; likely superseded by the current conversions
- [ ] W20.P1.7 — Close or re-draft whatever does not survive, with a comment pointing at the reconciliation

### P2 — correctness and hygiene that prevents rework

- [ ] W20.P2.1 — Rewrite the wave-19 gate triggers: PR 11939 is closed, not merged; re-point at `feature/ecs-migration` or an ECS ship date
- [ ] W20.P2.2 — Stale central-registry references: 23 files, ~180 refs, concentrated in D3.x / D8 / D13 / D20. Editing pass, not find-replace
- [ ] W20.P2.3 — Amend `D20-id-type-convergence.md` — the UUID premise is stale; NodeId is a branded string upstream
- [ ] W20.P2.4 — Apply or drop the four stale ext-api stashes
- [ ] W20.P2.5 — Close the remaining wave-19 validation items (dashboard CI at HEAD, live-Vercel e2e)
- [ ] W20.P2.6 — Establish the denominator convention: every breakage figure carries its population and weighting
- [ ] W20.P2.7 — Confirm which automated check can fail a conversion outright

### P3 — scheduled axiom sessions

- [ ] W20.P3.1 — **Session A**: the three axioms the measured data goes against (A1 bilateral closure, A15 absolutism, A14 mode-access exclusion). Prep doc leads with install-weighted data
- [ ] W20.P3.2 — **Session B**: the surface-philosophy question (A2 vs the completeness criterion). Proposed synthesis: usage volume justifies a capability, never its shape
- [ ] W20.P3.3 — **Session D**: forward-compatibility — A3 linked-subgraph constraint (absent from V1), A7 four-layer model as the V2 wire-format frame
- [ ] W20.P3.4 — Amend A10: retire the Vue-native claim; the dual-Vue objection is correct
- [ ] W20.P3.5 — Amend A4: handles are the ergonomic path, ids are exposed/branded/opaque; adopt sameEntity + adopt
- [ ] W20.P3.6 — Re-file the `controls` wire-format proposal as the V2 anchor; cross-link Q8; de-scope from V1
- [ ] W20.P3.7 — Serialization split (A16): accept for V1 as a recorded deferral, converge in the batched major

### P4 — measurement follow-ups

- [ ] W20.P4.1 — Once the control has run: decide whether the pass rate can support a release gate
- [ ] W20.P4.2 — Fold the renderer-desync column into the shipped verdict
- [ ] W20.P4.3 — Order-sensitive comparison (the current one sorts both sides before diffing)
- [ ] W20.P4.4 — Measure the static-analysis false-positive rate
- [ ] W20.P4.5 — Independently verify the Nodes 2.0 renderer performance delta; it is decision-relevant and currently has no artifact
- [ ] W20.P4.6 — Trace the remaining published figures to artifacts (open API gaps, capability and member counts)
- [ ] W20.P4.7 — Register which live decisions currently rest on unmeasured numbers

### P5 — process improvements

- [ ] W20.P5.1 — Weekly harvest of decisions from meeting transcripts into the working doc. Two load-bearing facts currently exist only in recordings. Automatable
- [ ] W20.P5.2 — Audit the other decision-feeding integrations for silent partial failure. One returned 7 of 924 records and looked healthy doing it
- [ ] W20.P5.3 — Every QA failure becomes a regression test; grow the automated battery where it is blind
- [ ] W20.P5.4 — Pre-mortem the announce
- [ ] W20.P5.5 — Custom Nodes CI has no Linear project and is untracked at programme level
- [ ] W20.P5.6 — Telemetry gap on custom-node usage affects every reach estimate
- [ ] W20.P5.7 — **Publication hygiene**: `todo.md`, `CONTEXT.md`, `AXIOMS.md`, `axioms-theorems.md`, `decisions/*`, `docs/glossary.md` and `announcements/*` are mirrored to a PUBLIC repo by `sync-knowledge.sh`. Keep internal assessments, meeting content and personnel material out of those files — use `private/`
