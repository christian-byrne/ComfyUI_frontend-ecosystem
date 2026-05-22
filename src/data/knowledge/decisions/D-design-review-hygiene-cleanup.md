# <a href="/decisions/D-design-review-hygiene-cleanup" class="wiki-link">D-design-review-hygiene-cleanup</a> — Wave-11 closure of design-review rows #1, #2, #4, #5 stale JSDoc, #6

**Status**: ACCEPTED — 2026-05-20 (wave-11 hygiene pass)

## Context

`design-review-12142.md` carries five "hygiene" rows that have either
been **silently absorbed** by other waves (no dedicated ADR) or are
**partially landed** with stale residue left in the source. Per
AGENTS.md §Decision propagation rules every Decisions-table row must
reach all three of:
(a) a commit on the live PR branches,
(b) an ADR (dedicated or referenced inside an existing ADR), and
(c) the dashboard JSON.

A wave-10 status audit (handoff-15) found the following five rows
sitting outside that three-legged stool:

| # | Row | Verified state (2026-05-20) | Gap |
|---|-----|-----------------------------|-----|
| 1 | Comments & Documentation Hygiene | Partial — 25 HR-style section dividers (`// ── XYZ ──`) and ~60 decision-archaeology refs (`D5`, `D20`, `D-immutability-enforcement (Hybrid C)`) in per-export JSDoc across 10 `src/extension-api/*.ts` files | Per CB direction "remove all header/HR style comments, intuition for the rest" — HR dividers not yet stripped; decision refs in JSDoc not yet pared |
| 2 | `@stability stable` semantics | **Done** — zero `@stability stable` instances in `src/extension-api/`; all surfaces tagged `experimental` | (b) ADR leg missing |
| 4 | Drop `apiVersion` | **Done** — zero `apiVersion` references in `src/` repo-wide | (b) ADR leg missing |
| 5 | `defineNode` / `defineWidget` short-form naming | **Done** at exports (<a href="/decisions/D11-naming-defineNode-defineWidget" class="wiki-link">D11</a> ACCEPTED 2026-05-12) — but **one stale JSDoc example** in `src/extension-api/lifecycle.ts:113,115` still shows `defineWidgetExtension` | Doc residue contradicts <a href="/decisions/D11-naming-defineNode-defineWidget" class="wiki-link">D11</a> |
| 6 | <a href="/glossary#widget" class="wiki-link">Widget</a>-prefixed methods | **Done** — zero `widgetCreated` / `widgetMounted` / `widgetUnmounted` / `widgetActivated` / `widgetDeactivated` symbols in `src/extension-api/`; the v2 surface uses unprefixed names (`onMounted`, etc., per <a href="/decisions/D-bootstrap-hooks" class="wiki-link">D-bootstrap-hooks</a>) | (b) ADR leg missing |

Wave-11 closes all three legs for these rows. The two rows requiring
real code edits (Row #1 + Row #5 stale JSDoc) get the smallest correct
edit; the three rows already shipped (Rows #2, #4, #6) get this ADR as
their (b) leg and the dashboard refresh as their (c) leg.

## Decision

**One bundled hygiene-only ADR — no design changes — covering five
review-table rows.** Behavior of every public surface is unchanged.
The scope is text-only: kill HR comments, pare decision archaeology
from JSDoc, fix the lifecycle.ts stale example, and document the
already-shipped rows so the propagation matrix balances.

### Part 1 — Row #1 (Comments hygiene)

**Delete from `src/extension-api/*.ts`:**

- All HR-style section dividers of the form `// ── LABEL ─────...`
  (25 sites across `widget.ts`, `node.ts`, `lifecycle.ts`).
  Rationale: per CB "remove all header/HR style comments". The
  dividers were debugging-time scaffolding; per-export JSDoc carries
  the same information for IDE readers.
- File-top **"What changed in WX.PY"** wave history blocks where
  present (e.g., `shell.ts` lines ~10–30). Wave history belongs in
  ADRs + AGENTS.md §Reconciliation history, not the published `.d.ts`.

**Strip from per-export JSDoc:**

- Bare parenthetical decision refs of the form `(per D5)`,
  `(D-immutability-enforcement)`, `(D20)` where the surrounding
  sentence still parses without them. The JSDoc keeps its technical
  content; only the archaeology label is removed.
- Cross-references like `D11/D-immutability-enforcement` collapse
  to the technical description ("Renamed to align with the `getX()`
  accessor convention").

**Preserve:**

- `PHASE_A_EXCLUDED per AXIOMS.md A14` block-comments on commented-out
  surfaces. These are *functional* — they tell future readers (human +
  axiom-checker) why the surface is absent and which axiom enforces
  it. Removing them would resurrect the original "why is this gone?"
  archaeology problem in a worse form.
- Technical content embedded inside the decision ref. E.g.,
  `**Immutable per D-immutability-enforcement (Hybrid C).**` → keep
  the "Immutable. The returned object is `Readonly<WidgetOptions>`"
  meaning, drop the `(Hybrid C)` label.
- `@axiom`, `@deprecated`, `@stability`, `@example`, `@publicAPI`,
  `@internal` tags — every formal JSDoc tag stays.

### Part 2 — Row #5 stale JSDoc fix

`src/extension-api/lifecycle.ts:113,115` contains a `@example` block
showing `import { defineWidgetExtension }` and
`export default defineWidgetExtension({…})`. Both names contradict the
short-form exports <a href="/decisions/D11-naming-defineNode-defineWidget" class="wiki-link">D11</a> ACCEPTED on 2026-05-12 and the surrounding
function declaration on line 117 (`export declare function
<a href="/api-docs/definewidget" class="wiki-link">defineWidget</a>(...)`).

Fix: rename to `defineWidget` in the example body. One commit-line
change; same edit pattern as the wave-10 v2 JSDoc scrub
(`d5d5692928`).

### Part 3 — Rows #2, #4, #6 documentation closure (no code change)

These three rows are already enforced in the live `src/extension-api/`
surface:

- **Row #2 (`@stability stable`)** — `rg @stability` shows 31 hits,
  all `experimental`. No `stable` tag survives.
- **Row #4 (`apiVersion`)** — `rg apiVersion src/` shows 0 hits.
- **Row #6 (Widget-prefixed methods)** — `rg
  widgetCreated|widgetMounted|widgetUnmounted` shows 0 hits. The v2
  bootstrap-hooks surface uses unprefixed `onMounted` /
  `onBeforeMount` / `onUnmounted` / `onActivated` / `onDeactivated`
  per <a href="/decisions/D-bootstrap-hooks" class="wiki-link">D-bootstrap-hooks</a>.

This ADR is the (b) ADR-leg of the propagation triple for those
three rows. The (a) commit-leg was the earlier wave that incidentally
absorbed them (Row #2 + #4 in the original PR #12142 cleanup pass;
Row #6 in W6.P6.C bootstrap-hooks foundation `b3b3b10fea`). The (c)
dashboard-leg lands with this wave's refresh.

## Consequences

### Source size

- ~25 lines of HR comments deleted across `widget.ts` + `node.ts`
  + `lifecycle.ts`.
- ~30 lines of decision-archaeology JSDoc text pared (estimate; final
  diff in foundation commit).
- One JSDoc `@example` block fixed in `lifecycle.ts`.
- Net `.ts` line delta: ~ -60.

### Behavior

- Zero behavior change. No types renamed, no exports added or
  removed, no runtime branches modified. Foundation `pnpm test`
  expected to pass without churn.

### Decision propagation

- Five design-review rows (#1, #2, #4, #5, #6) reach the three-legged
  stool atomically in this wave:
  - (a) commit on PR branches: this wave's foundation commit
    + cascade to pkg/ext/tf.
  - (b) ADR leg: this file.
  - (c) dashboard leg: refresh via
    `scripts/refresh-api-docs.sh` against the post-edit
    `restack-foundation-v2` HEAD (HR + archaeology removal feeds into
    the generated MDX so consumer-facing docs match the live source).

### Migration

- Zero v2 consumer impact (no surface change).
- Zero v1 consumer impact (v1 surfaces untouched).
- IDE tooltip text for v2 surfaces gets shorter and less
  "implementation-team-meeting-archaeology". Net win for external
  authors.

### CI

- `ext-api/*-v2` PRs (#12142–#12145) continue under AGENTS.md Rule 8
  carve-out — codecov/patch/e2e/perf/playwright failures expected
  until Phase B rebase. Only `pnpm lint && pnpm format:check && pnpm
  knip` must stay green (enforced by husky pre-push).

## Implementation checklist

- [x] Draft ADR (this file)
- [x] Foundation commit:
  - [x] Delete HR-style section dividers across
    `widget.ts`/`node.ts`/`lifecycle.ts`
  - [x] Strip parenthetical decision archaeology from per-export
    JSDoc; preserve technical content + PHASE_A_EXCLUDED axiom refs
  - [x] Fix `lifecycle.ts:113,115` — `defineWidgetExtension` →
    `defineWidget`
  - [x] Delete any file-top wave-history banner blocks
- [x] Cascade pkg → ext → tf via plain `git rebase origin/<parent>`
- [x] Restratify mirror all 4 pairs via `git push --no-verify
  --force-with-lease`
- [x] Dashboard refresh from
  `christian-byrne/ComfyUI_frontend-ecosystem` via
  `EXT_API_WORKTREE=…/restack-pkg-v2 bash scripts/refresh-api-docs.sh`;
  commit + push `--no-verify` (sole-contributor per AGENTS.md Rule 9)
- [x] PR comments on #12142 (summary + decision-propagation matrix
  showing all 5 rows now three-legged)
- [x] AGENTS.md `§Reconciliation history` — prepend wave-11 row above
  wave-10
- [x] `bash scripts/sync.sh` clean — drift = 0, no orphan decisions
