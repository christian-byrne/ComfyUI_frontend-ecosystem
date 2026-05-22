# <a href="/decisions/D-ban-runtime-addwidget" class="wiki-link">D-ban-runtime-addwidget</a> — Enforcement of <a href="/axioms#a15-refs" class="wiki-link">A15</a> (<a href="/glossary#widget" class="wiki-link">Widget</a> Declarativity) on the v1 surface

**Status**: ACCEPTED — 2026-05-20 (wave-10 follow-up to <a href="/decisions/D-widget-serialization-simplification" class="wiki-link">D-widget-serialization-simplification</a>)

## Context

**Wave-9 (2026-05-20)** codified **AXIOMS.md <a href="/axioms#a15-refs" class="wiki-link">A15</a> (Widget Declarativity)**:
widgets originate from Python `INPUT_TYPES` declarations. There is no
runtime widget addition by frontend extensions, and there is no concept of
a "frontend-only widget."

The v2 surface already complies: `node.addWidget(...)` and
`node.addDOMWidget(...)` were excluded per the <a href="/axioms#a14-refs" class="wiki-link">A14</a> REMOVED table and the
v2 `NodeHandle` does not expose either method. However, three loose ends
remained at the end of wave-9:

1. **JSDoc remnants in the v2 surface** — five `@example` blocks in
   `node.ts`, `widget.ts`, `types.ts`, and `lifecycle.ts` still showed
   `node.addWidget(...)` as a valid call. These are documentation
   contradicting the actual surface.
2. **Dead implementation in the v2 service** — `extension-api-service.ts`
   still contained `addWidget(...)` and `addDOMWidget(...)` shims (lines
   ~530 + ~542) that dispatched `CreateWidget` commands. With the public
   `NodeHandle` surface no longer exposing these methods, the shims are
   unreachable from any v2 extension — pure dead code.
3. **v1 surface (LGraphNode prototype)** — `LGraphNode.addWidget`,
   `LGraphNode.addCustomWidget`, and `LGraphNode.prototype.addDOMWidget`
   are still freely callable from any v1 `ComfyExtension`
   (`Comfy.*.beforeRegisterNodeDef` etc.). Per <a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a> parallel-paths the v1
   surface stays functional, but <a href="/axioms#a15-refs" class="wiki-link">A15</a> enforcement requires extension
   authors be told *now* that this pattern is going away and given the
   concrete migration paths.

Wave-9 ADR §Open follow-ups tracked this as wave-10 work. User direction
2026-05-20: **"we dont need soft deprecate for beforeSerialize OR
addWidget — they just simply shouldnt be present in the new API. for the
old api surfaces, we can just add deprecations with the suggested
remediation."**

## Decision

**Three-part enforcement, atomic in the foundation commit:**

### Part 1 — v2 surface: absent, period (no soft-deprecate)

- Delete the dead `addWidget` and `addDOMWidget` methods from
  `src/services/extension-api-service.ts`, along with the
  `domWidgetElements` side-table and its `onScopeDispose` cleanup. The
  v2 `NodeHandle` returned by the service no longer carries these keys.
- Scrub all v2 JSDoc `@example` blocks that show
  `node.addWidget(...)`. Replace examples with one of A15's three
  remediation paths: boxed/composed widget, non-widget UI primitive, or
  schema input.
- Files touched: `src/extension-api/node.ts`, `widget.ts`, `types.ts`,
  `lifecycle.ts`, `src/services/extension-api-service.ts`,
  `src/extension-api/index.ts` (barrel — drop unused `DOMWidgetOptions`
  re-export if applicable).

### Part 2 — v1 surface: `@deprecated` + once-per-node `console.warn`

- Add `@deprecated` JSDoc with **explicit migration text** on:
  - `LGraphNode.addWidget` (`src/lib/litegraph/src/LGraphNode.ts`)
  - `LGraphNode.addCustomWidget` (same file)
  - `LGraphNode.prototype.addDOMWidget` (`src/scripts/domWidget.ts`)
- Emit `console.warn` once per `LGraphNode` instance (deduped via a
  `WeakSet<LGraphNode>` module-private flag) on first call from each
  node. Pattern matches the wave-9 `node.on('beforeSerialize')`
  deprecation in `extension-api-service.ts:653`.
- Warning text:

  > `[LiteGraph] node.addWidget(...) is deprecated and will be removed
  > in v1.0. Widgets must be declared in the Python node's INPUT_TYPES.
  > Migration paths: (1) boxed widget — declare a single rich-value
  > INPUT_TYPES field (e.g. BBOX [x,y,w,h]) and compose the multi-control
  > UI inside one widget; (2) non-widget UI primitive — mount custom DOM
  > from <a href="/api-docs/definenode" class="wiki-link">defineNode</a>/<a href="/api-docs/defineextension" class="wiki-link">defineExtension</a> setup() via bootstrap-hooks
  > lifecycle, owned by the extension not the widget system;
  > (3) schema input — add it to INPUT_TYPES and let the frontend render
  > it normally. See AXIOMS.md A15 + decisions/<a href="/decisions/D-ban-runtime-addwidget" class="wiki-link">D-ban-runtime-addwidget</a>.md.`

- Warning text for `addDOMWidget` mirrors the above with the additional
  note that DOM-widget registration in v2 happens via
  `defineWidget({ type, mount })` (per <a href="/decisions/D-widget-converge" class="wiki-link">D-widget-converge</a> / <a href="/axioms#a12-refs" class="wiki-link">A12</a>) not
  `addDOMWidget`.

### Part 3 — First-party core call sites: silenced via no-op

- First-party core extensions (`src/extensions/core/uploadAudio.ts`,
  `load3d.ts`, `webcamCapture.ts`, `customWidgets.ts`) plus the
  `widgets.ts` valueControl + comboFilter helpers (`src/scripts/widgets.ts`)
  still call `addWidget` — the migration to one of A15's three paths is
  tracked separately as the **"Preview/progress/audio widgets migration
  audit"** wave-9 follow-up.
- These call sites pass an internal sentinel `__suppressDeprecationWarning:
  true` on the options bag. The deprecation warner short-circuits when
  that flag is present, so the dev console stays quiet for first-party
  code that hasn't migrated yet.
- The sentinel is **not exported** and is stripped before the widget
  options reach any external observer. Its presence is documented as
  `@internal` in the LGraphNode JSDoc.

## Consequences

### v2 (immediate)

- Zero net public-API change — the v2 surface had nothing to remove
  externally; this just deletes dead code and contradictory examples.
- Bundle size shrinks by ~30 lines (`extension-api-service.ts` dead
  shim + `domWidgetElements` side-table).
- No more "see node.addWidget()" tooltip references confusing v2
  consumers.

### v1 (migration runway)

- Existing custom-node packs (Eclipse, KJNodes, Copilot, etc. — 5+
  evidenced in R7 sweep) continue to work. They will see one
  console.warn per node on first `addWidget` call with concrete
  migration text linking to the ADR.
- First-party core extensions are silenced until their separate
  migration audit lands. The audit work-item is preserved as wave-9
  follow-up #2.
- Axiom checker (`scripts/check-axiom-compliance.sh`) already
  strict-fails on any re-introduction in `src/extension-api/node.ts`
  per A15 (added wave-9). No checker changes needed.

### Compatibility (<a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a> parallel-paths)

- v1 path remains fully functional. Deprecation is a soft signal,
  not a runtime block. No throw, no exception, no behavior change
  beyond the once-per-node console message.
- Phase B (post Alex's ECS branch merge) may upgrade the warning to
  a hard removal of `LGraphNode.addWidget`. That decision is out of
  scope for wave-10.

### CI

- `ext-api/*-v2` PRs (#12142–#12145) under AGENTS.md Rule 8 carve-out
  continue to be allowed to fail codecov/patch/e2e/perf/playwright
  until Phase B rebase.

## Testing policy (new — promulgated wave-10)

Wave-10 introduces and codifies the **Axiom-Excluded Test Annotation
Policy** (AXIOMS.md § same name; AGENTS.md Rule 11). When a source-code
surface is removed/deferred per an accepted axiom or ADR, tests that
asserted on the absent surface MUST be converted to
`axiomExcluded({...})` (a thin vitest `test.fails` + annotation wrapper)
rather than deleted outright.

### Concrete application in this ADR

The tf branch carries four BC test files that assert v2
`NodeHandle.addWidget` / `NodeHandle.addDOMWidget` exists as a
migration target:

- `src/extension-api-v2/__tests__/bc-05.v2.test.ts`
- `src/extension-api-v2/__tests__/bc-05.migration.test.ts`
- `src/extension-api-v2/__tests__/bc-11.v2.test.ts`
- `src/extension-api-v2/__tests__/bc-11.migration.test.ts`

A15 closes these migration targets. Per the new policy, the tests are
**not deleted**. Each `test(...)` is wrapped in `axiomExcluded({...})`
carrying:

- `axiom: 'A15'`
- `adr: 'decisions/D-ban-runtime-addwidget.md'`
- `rationale: 'Widgets are schema-declared per A15; v2 NodeHandle does not expose addWidget/addDOMWidget.'`
- `migration: ['Declare in INPUT_TYPES', 'Boxed widget (e.g. BBOX)', 'Non-widget UI primitive via bootstrap-hooks']`
- `restoration: 'D-ban-runtime-addwidget §Restoration criteria — bar set deliberately high'`

The annotated tests fail by design (their assertions hit undefined
methods); vitest converts the throw into a PASS via `test.fails`.
If a future commit accidentally restores the v2 surface, the tests
flip to FAIL and the regression is immediately visible.

The v1-path BC tests (`bc-05.v1.test.ts`, `bc-11.v1.test.ts`) remain
unchanged in scenario — they assert the v1 surface still works — but
their `addWidget` / `addDOMWidget` call sites pass
`__suppressDeprecationWarning: true` so the new console.warn does not
pollute test output.

### Compat-floor doctrine retired

The "compat-floor blast_radius ≥ N — MUST pass before v2 ships"
annotation block atop the original bc-05/bc-11 files is removed. That
doctrine conflated *evidence that a migration is needed* with *evidence
that a specific surface must exist*. Axioms + ADRs are the source of
truth for v2 surface composition.

## Restoration criteria

The v2 surface re-introduces `addWidget` / `addDOMWidget` only if:
1. A validated ecosystem use case is documented that cannot be served
   by any of A15's three remediation paths (boxed, non-widget UI,
   schema input).
2. An axiom amendment to A15 is proposed and accepted.
3. The replacement surface is typed, async-capable, and does not
   re-introduce frontend-only widget state lacking a schema slot.

(Bar set deliberately high — same posture as
<a href="/decisions/D-widget-serialization-simplification" class="wiki-link">D-widget-serialization-simplification</a>.)

## Implementation checklist

- [x] Draft ADR (this file)
- [x] Foundation commit:
  - [x] Scrub v2 JSDoc `@example` blocks (5 sites) — node.ts, widget.ts,
    types.ts, lifecycle.ts
  - [x] Delete dead `addWidget` + `addDOMWidget` methods + side-table
    in `extension-api-service.ts`
  - [x] Drop unused barrel re-exports (`DOMWidgetOptions` etc.) if any
  - [x] Add `@deprecated` JSDoc + WeakSet-deduped console.warn on
    `LGraphNode.addWidget`, `LGraphNode.addCustomWidget`,
    `LGraphNode.prototype.addDOMWidget`
  - [x] Add `__suppressDeprecationWarning` internal sentinel to
    first-party core call sites
- [x] Cascade pkg → ext → tf via plain `git rebase origin/<parent>`
- [x] Restratify mirror all 4 pairs via `git push --no-verify
  --force-with-lease`
- [x] Dashboard refresh from
  `christian-byrne/ComfyUI_frontend-ecosystem` via
  `EXT_API_WORKTREE=…/restack-pkg-v2 bash scripts/refresh-api-docs.sh`;
  commit + push `--no-verify` (sole-contributor per AGENTS.md Rule 9)
- [x] PR comments on #12142 (summary + decision-propagation matrix)
  + per-branch comments on #12143/#12144/#12145
- [x] AGENTS.md `§Reconciliation history` — prepend wave-10 row above
  wave-9
- [x] `bash scripts/sync.sh` clean — drift = 0, no orphan decisions,
  <a href="/axioms#a1-refs" class="wiki-link">A1</a>+<a href="/axioms#a2-refs" class="wiki-link">A2</a>+<a href="/axioms#a3-refs" class="wiki-link">A3</a>+<a href="/axioms#a4-refs" class="wiki-link">A4</a>+<a href="/axioms#a6-refs" class="wiki-link">A6</a>+A15+<a href="/axioms#a16-refs" class="wiki-link">A16</a> axiom checks pass
