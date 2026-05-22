# D-unify-widget-mount-model — drop the DOMWidget/non-DOM distinction; one mount path for every widget

- **Status**: PROPOSED — 2026-05-21 (wave-19, W19.A9). Flips to **ACCEPTED** when PR #11939 (Alex's ECS branch) merges and the Phase B cascade begins.
- **Decider:** Christian (user direction; Slack proposal — see §Rationale)
- **Wave:** 19
- **Axioms cited:** A1 (widget-centric), A5 (3-tier widget state — Schema immutable; Props/Values mutable), A12 (Mount-Lifecycle as the Sole DOM Seam), A15 (Widget Declarativity)
- **Composes-with:** W19.A7 (recreate-vs-remount glossary — every mount IS a recreate event under this model), W19.A10 (`D-widget-promotion-semantics` — promotion gets coherent semantics once "DOM widget" stops being a special case)
- **Supersedes:** D7-widget-shape-and-persistence §Part 1 (the universal-vs-typed split was already SUPERSEDED by D14-widget-state-categories per D-api-surface-finalization; this ADR closes the remaining DOM/non-DOM dimension of D7)
- **Related:**
  - `decisions/D-widget-converge.md` (W6.P3 — already collapsed the v2-surface DOM/native distinction; this ADR completes the job by removing the *runtime concept* of a non-mount widget)
  - `decisions/D-widget-serialization-simplification.md` (wave-9 — same reduction-by-deletion shape; codified A15 + A16)
  - `decisions/D-api-surface-finalization.md` (wave-12 — Phase A surface freeze; this ADR is one of the new ACCEPTED ADRs that re-opens the surface at Phase B per §Re-opening criteria item 1)
  - AXIOMS.md §A12 (Mount-Lifecycle as the Sole DOM Seam — close cousin; A12 already commits to mount-as-sole-DOM-seam for the v2 surface, but does NOT commit to mount-as-sole-renderer-path for the runtime)
  - Foundation `src/extension-api/widget.ts` — current `mount` signature (already correct; this ADR commits to it being the *only* renderer path)
  - Glary-Bot Theorem 4 — Widget Recreation Safety (mount must be idempotent across host moves; derives from A5 Schema immutability)

## Context

Even after D-widget-converge (W6.P3.B PICK option iii, 2026-05-18) collapsed
the v2 *type-level* DOM/native split, two structurally separate widget
behaviors still exist at runtime:

1. **DOM widgets** — widgets that render via `mount(host, ctx) → cleanup?`.
   The runtime hands the widget an empty `<div>`; the widget appends DOM.
2. **Non-DOM ("native") widgets** — text inputs, sliders, number inputs,
   combos, seeds, buttons — that render via the v1 LiteGraph canvas-drawing
   path. They have no `mount`; the framework draws them onto the node canvas
   from `widget.type` + `widget.value` via per-type switch statements inside
   `LGraphCanvas.drawNodeWidgets` and friends.

D-widget-converge removed `addDOMWidget` / `widget.element` / `widget.inputEl`
/ `DOMWidgetOptions` from the *surface*, but the runtime still branches on
"do we render this widget through `mount(host)` or through canvas-draw?"
That branch is the source of every promotion edge case, every
graph↔app-mode lifecycle race, and every "why does this widget behave
differently from that one" question reviewers keep asking.

User direction (Slack, post-handoff-15):

> "There's an idea where a DOMWidget concept doesnt exist and all widgets
> are just dom widgets, then using more standard mounting/unmounting hooks
> becomes simple."

This ADR ratifies that direction as the Phase B architecture commitment.

## Decision

**One widget shape. One mount path. No `kind: 'dom'` discriminator anywhere
in the surface, the runtime, or the renderer.**

Concretely:

1. Every registered widget exposes the same lifecycle:
   `mount(host: HTMLElement, ctx: WidgetMountContext) → WidgetCleanup | void`
   (the A12 signature, unchanged).
2. The framework ships **default mount implementations** for the legacy
   widget types (text / number / slider / combo / seed / button / toggle / …).
   These defaults are framework-internal modules registered through the
   normal `defineWidget({ type, mount, … })` path so they have zero
   architectural privilege over author-registered widget types.
3. For the v1 canvas-drawing aesthetic, the framework's default mount
   implementations may render *into a host that the runtime composites onto
   the node canvas* (a "canvas-renderer host" — implementation detail of
   the runtime, not a v2 surface concept). Authors who want pixel-identical
   v1 visuals get them for free; authors who want HTML get them for free;
   neither is special.
4. **The `DOMWidget` concept is permanently retired** — from the surface,
   the runtime, the renderer, and the mental model. The PHASE_A_EXCLUDED
   entries for `DOMWidgetOptions` / `kind: 'dom'` / `widget.element` /
   `widget.inputEl` / `addDOMWidget` (already in AXIOMS.md §A14 REMOVED +
   §A12) move from "deferred / commented out" to "permanently removed —
   under no circumstance returns to the surface."
5. **`defineWidget({ type, mount, … })` is the sole widget registration
   entry point.** A widget type with no `defineWidget` registration does
   not render (matches D-widget-converge §Clarification 3).

## Rationale

### Glary-Bot Theorem 4 — Widget Recreation Safety (forced corollary)

Derivation: AXIOMS.md §A5 fixes Schema for the widget's lifetime;
AXIOMS.md §A1 says widgets must survive context shifts (promotion, app
mode, partial-graph views, linked instances). Therefore the *only* safe
implementation of "move a widget across host contexts" is to treat every
host re-attachment as a re-mount against a fresh host — i.e. `mount()`
must be **idempotent** across host moves. Once mount is idempotent, the
question "is this a DOM widget or a native widget?" becomes moot — the
*only* difference between them was that DOM widgets had a `mount` and
native widgets had a canvas-draw branch. Unifying on mount removes the
branch.

### Christian's Slack quote (Phase B direction)

Reproduced verbatim from W19 task brief:

> "There's an idea where a DOMWidget concept doesnt exist and all widgets
> are just dom widgets, then using more standard mounting/unmounting hooks
> becomes simple."

The architectural read: "standard mounting/unmounting hooks" = Vue
`onMounted` / `onUnmounted` ergonomics, which D-bootstrap-hooks already
ships for extensions and `mount()` already shadows for widgets. Unifying
the widget runtime removes the last "two paths, two mental models" pocket.

### Austin's split-view race-condition argument — non-issue under unified mount

Austin raised (handoff-13, internal review) that if two linked-subgraph
instances of the same widget both fire value-change listeners, the
listeners could race and re-trigger each other. Under the current
canvas-draw-vs-mount split, this was a real concern because canvas-draw
widgets share a single render path while mount widgets get per-instance
DOM. **Under the unified model the concern dissolves:** every widget
instance gets its own `mount()` invocation with its own `ctx` and its own
listener registrations. There is no shared rendering state to race against.
Multi-instance value-listener safety reduces to "mount is idempotent" —
which Theorem 4 already gives us.

### D-widget-converge precedent

D-widget-converge picked option (iii) "single Widget + `mount(host, ctx)`
lifecycle" on the *type* side. The implementation cascade (W6.P3.C
foundation commit `2f102353fa` + downstream) deleted `DOMWidgetOptions` /
`addDOMWidget` / `widget.element` / `widget.inputEl` from
`src/extension-api/*.ts`. This ADR finishes the work by committing to the
same shape on the *runtime* side at Phase B — when PR #11939 removes the
v1 LiteGraph adapter and the runtime can be rewired without surface churn.

## Consequences

### Surface

- **Zero Phase A surface change.** `widget.ts` already exposes
  `WidgetMountFn` / `WidgetMountContext` / `WidgetCleanup` (A12).
  `defineWidget` already takes `mount`. The Phase A surface is frozen at
  foundation `ee0537fdb5` (per D-api-surface-finalization) and remains so.
- **At Phase B flip:** PHASE_A_EXCLUDED entries for `DOMWidgetOptions` /
  `addDOMWidget` / `kind: 'dom'` / `widget.element` / `widget.inputEl`
  promote from "commented out / removed" to "permanently absent —
  restoration criteria revoked." AXIOMS.md §A14 REMOVED rows for
  `addDOMWidget` get a forward-pointer to this ADR.

### Runtime / renderer

- v1 canvas-draw widget rendering paths in `LGraphCanvas.drawNodeWidgets`
  retire at Phase B. Built-in widget types (text / number / slider / combo
  / seed / button / toggle / …) ship as framework-internal
  `defineWidget({ type, mount, … })` registrations.
- v1 LiteGraph remains untouched during the D6 parallel-paths window.
  v1 path consumers (`Comfy.*` extensions, `node.addDOMWidget(...)`) keep
  working until D6 Phase D sunset.

### Test surface

- Any v2 BC test that asserted on `kind: 'dom'`, `widget.element`,
  `widget.inputEl`, `widget.type === 'dom'`, or
  `node.addDOMWidget(...)` converts to `axiomExcluded({...})` per
  AGENTS.md Rule 11 / AXIOMS.md §Axiom-Excluded Test Annotation Policy.
  Annotation block:
  - `axiom: "A12"` (or `"A14:REMOVED"` for the addDOMWidget cases)
  - `adr: "decisions/D-unify-widget-mount-model.md"`
  - `rationale: "DOMWidget concept retired; one widget shape with mount()."`
  - `migration: "Use defineWidget({type, mount}); capture element in mount closure."`

### Compose-with notes

- **W19.A7 (recreate-vs-remount glossary):** under the unified mount
  model, *every* host attachment IS a recreate event from the widget's
  perspective — there is no longer a "DOM widget that gets remounted"
  vs "native widget that gets re-drawn" asymmetry. The recreate vs
  remount distinction collapses to a clean dichotomy: cleanup fires on
  destruction; `onBeforeRemount` / `onAfterRemount` fire on host moves.
  The glossary in D-widget-converge gets a forward-pointer to this ADR.
- **W19.A10 (`D-widget-promotion-semantics`):** promotion semantics
  become coherent only after this ADR lands — see §Composability in
  W19.A10 for the dependency direction.

### Compatibility (D6 parallel-paths)

- v1 path remains fully functional through the D6 parallel-paths window.
  Vendor packs that monkey-patch `node.addDOMWidget` / read
  `widget.element` continue to work on v1.
- v2 path is **what npm consumers of `@comfyorg/extension-api` already
  get** (since wave-11). No new author-visible API at Phase B flip — the
  flip is purely a runtime architecture change.

## Restoration criteria (the absence is permanent)

A `DOMWidget` concept may re-enter the surface only if **all** of the
following hold:

1. An ACCEPTED axiom amendment **revokes A12** (Mount-Lifecycle as the
   Sole DOM Seam) — A12 is currently NON-NEGOTIABLE per AXIOMS.md.
2. A validated ecosystem use case is documented that **cannot** be
   served by `defineWidget({ type, mount, … })` with a closure-captured
   element.
3. The replacement surface is typed, lifecycle-safe across promotion /
   app-mode / linked-subgraph (A1, A3), and does not re-introduce the
   canvas-draw-vs-mount runtime branch.

Bar set deliberately high: every previous DOMWidget surface restoration
ask has reduced to "the author wanted to capture the element somewhere
other than the mount closure," which the unified mount model fully covers.

## Implementation Plan (Phase B — gated on PR #11939 merge)

| Step | Action | File / location | Verification |
|------|--------|-----------------|--------------|
| 1 | Flip this ADR status header to `ACCEPTED — <date> (wave-N)` once PR #11939 merges and the Phase B cascade kicks off. | `decisions/D-unify-widget-mount-model.md` | grep `Status.*ACCEPTED` |
| 2 | Foundation cascade — `src/extension-api/widget.ts`: delete any remaining `// PHASE_A_EXCLUDED.*DOMWidget` blocks (kind:'dom', DOMWidgetOptions); confirm `mount` is the only widget rendering surface; add JSDoc cross-link to this ADR on `defineWidget`. | `ComfyUI_frontend/src/extension-api/widget.ts` | `pnpm lint && pnpm format:check && pnpm knip` |
| 3 | Foundation cascade — `src/extension-api/node.ts`: confirm no `addDOMWidget` / `addWidget` references re-appear (already A14-REMOVED + A15-banned). | `ComfyUI_frontend/src/extension-api/node.ts` | `bash scripts/check-axiom-compliance.sh` |
| 4 | Pkg cascade — regenerate `packages/extension-api/build/index.d.ts` and verify the .d.ts matches foundation; hand-patch if Node 20 / vite blocks `pnpm build` per AGENTS.md Rule 8. | `packages/extension-api/build/index.d.ts` | `git diff` matches foundation surface |
| 5 | Runtime change — implement framework-internal `defineWidget({ type, mount, … })` registrations for built-in widget types (text / number / slider / combo / seed / button / toggle / …) shipped as a Phase B internal module; retire `LGraphCanvas.drawNodeWidgets` switch-cases for migrated types. | `ComfyUI_frontend/src/lib/litegraph/` (NOT `src/extension-api/`) | per-type e2e demonstrating identical visual output |
| 6 | BC test conversion — every v1 test that asserted on `kind: 'dom'`, `widget.element`, `widget.inputEl`, `node.addDOMWidget(...)` etc. converts to `axiomExcluded({ axiom: "A12" \| "A14:REMOVED", adr: "decisions/D-unify-widget-mount-model.md", rationale, migration })`. | `src/extension-api-v2/__tests__/**` | vitest run shows `test.fails` markers + `task.meta.annotations` present |
| 7 | Axiom checker extension — `scripts/check-axiom-compliance.sh` adds strict-fail rules: no uncommented `kind:\s*['"]dom['"]`, no uncommented `DOMWidgetOptions`, no uncommented `widget\.element`/`widget\.inputEl` in `src/extension-api/*.ts`. | `scripts/check-axiom-compliance.sh` | checker exits 0 on clean foundation; exits 1 on synthetic regression |
| 8 | Restratify mirror — direct `git push --no-verify --force-with-lease origin <foundation-v2-HEAD>:ext-api/i-foundation-restratify` (wave-9 pattern). Cascade pkg / ext / tf identically. | local + `git push` | `bash scripts/check-branch-divergence.sh` → 0 |
| 9 | Dashboard refresh — `bash scripts/refresh-api-docs.sh` in `christian-byrne/ComfyUI_frontend-ecosystem`; confirm `widget.ts`-derived MDX no longer mentions DOMWidget / kind:'dom'. Commit + push `--no-verify` per AGENTS.md Rule 9. | dashboard repo | `pnpm test` 178/178; TypeDoc 0 errors |
| 10 | AGENTS.md `§Reconciliation history` — append wave-N row capturing the Phase B flip + cascade SHAs. | `AGENTS.md` | row present |
| 11 | `bash scripts/sync.sh` clean (drift = 0, no orphan decisions, axiom + decision-propagation checks pass). | workspace | sync exits 0 |

## Validation (Phase B post-merge)

- `scripts/check-axiom-compliance.sh` strict-fails on any uncommented
  `DOMWidgetOptions`, `kind:\s*['"]dom['"]`, `widget\.element`,
  `widget\.inputEl`, or `addDOMWidget` re-appearing anywhere under
  `ComfyUI_frontend/src/extension-api/`.
- Foundation `widget.ts` ships `defineWidget({ type, mount, … })` as the
  sole widget registration entry point (already true).
- The published `@comfyorg/extension-api` `.d.ts` mirrors the foundation
  surface byte-for-byte for the widget module (already true since
  wave-11; this ADR's Phase B cascade only removes commented blocks).
- A new e2e test demonstrates that a built-in widget type (e.g. `number`,
  `combo`) registered via the framework-internal `defineWidget` renders
  pixel-identical output to its v1 canvas-draw predecessor on a baseline
  workflow (visual regression covered by `pnpm test:e2e`).
- BC test suite has zero `test.fails` markers without an attached
  `axiomExcluded({...})` annotation (per AGENTS.md Rule 11).

## References

- W19.A9 task block in `todo.md`
- AXIOMS.md §A1, §A5, §A12, §A15, §Axiom-Excluded Test Annotation Policy
- `decisions/D-widget-converge.md` (surface-side predecessor)
- `decisions/D-widget-serialization-simplification.md` (reduction-by-deletion style template)
- `decisions/D-api-surface-finalization.md` §Re-opening criteria
- Glary-Bot Theorem 4 — Widget Recreation Safety (todo.md:89 derivation list)
- PR #11939 (Alex's ECS branch) — Phase B trigger
