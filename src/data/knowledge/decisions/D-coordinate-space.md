# <a href="/decisions/D-coordinate-space" class="wiki-link">D-coordinate-space</a> — Canvas vs client-pixel vs CSS coordinate convergence

**Status**: **ACCEPTED** — 2026-05-18 (handoff-9; PICK by Christian, human-in-the-loop) — Option **(iii) hide spaces, canvas-only handles**, with documentation-first migration strategy. Skeleton authored 2026-05-14; R1+R2+R3 evidence landed 2026-05-18.

## Context

Three coordinate spaces co-exist in the LiteGraph + Vue + DOM stack:

1. **Canvas coords** — LiteGraph internal units. `node.pos`, `node.size`,
   `event.canvasX/Y`. Independent of zoom/pan.
2. **Client/screen pixels** — after the canvas's pan+zoom transform.
   `event.clientX/Y`, `getBoundingClientRect()`. What the user actually
   sees on screen.
3. **CSS pixels** — DOM-overlay coordinate system used to position DOM
   widgets and overlays inside the page layout. Affected by
   `devicePixelRatio` on hi-DPI displays.

Today the v2 surface picks canvas coords as the default
(`getPosition()` / `getSize()` return canvas units), but every other
extension touchpoint that reads pointer events, draws to the canvas, or
sizes a DOM overlay has to pick its own space and convert manually.

Design-review-12142.md row #10 flagged this as leakage:

> "I wonder if we need to try to expose or clarify the canvas vs
> client/pixel vs CSS size complexity at the boundary? Does it leak up
> to immediate implementations?"

CB's response (row #10): audit ecosystem usage; if extensions almost
always want LiteGraph (canvas) coords, **standardize on that** and add
invariant assertions + documentation. There is a `core` `assert()` in
flight that can carry the invariant checks.

Touch-points DB evidence (W6.P4.A will expand):

- **S2.N9 `onDrawForeground` patching** — every "draw extra UI on the
  node" pattern works in canvas coords (the `ctx` is already
  canvas-transformed at draw time).
- **S2.N10 `onMouseDown` patching** — receives `LiteGraph.canvas`
  pointer events whose `event.canvasX/Y` is canvas-space; raw
  `clientX/Y` is also present. Authors picking the wrong one is a
  recurring bug class.
- **S2.N11 `computeSize` patching** — returns canvas-space `[w, h]` but
  many DOM-widget authors compute via `getBoundingClientRect()` and
  forget to divide by zoom.
- **S4.W2 `node.addDOMWidget`** — the DOM overlay path needs a
  canvas→CSS conversion for positioning.
- **R4 P7 `LGraphCanvas.prototype.*` patching** — canvas-level keyboard
  + context-menu patching frequently mixes spaces.

## Decision

**Picked: Option (iii) — hide spaces, canvas-only handles.**

The v2 surface exposes **a single coordinate space — canvas units —
through every public accessor**. `NodeHandle.getPosition()` /
`getSize()` / `setPosition()` / `setSize()` return and accept canvas
units. Pointer-event helpers, when added, will deliver canvas units.
DOM-widget mount provides pre-positioned hosts; the mount body does not
do its own canvas→CSS conversion. The `convert*ToCanvas` /
`convert*ToOffset` LiteGraph helpers are NOT re-exported on the v2
public surface.

Rationale (Christian, PICK transcript): *"single unified concept and
then we just document the nuance thoroughly such that 3rd party devs
and their agents see it"*. The 2,617-hit / 71-repo bug class
(client-symbol-no-conversion) is closed at the seam — there is no
client-space accessor for authors to reach for in the first place. The
2,720 UNMIGRATABLE cells are paid as a documented cliff:
- Legitimate screen-space cases (hi-DPI math, floating overlays,
  custom hit-testing) drop to the v1 escape-hatch
  `window.app.canvas.ds.*` and `window.app.canvas.canvas.getBoundingClientRect()`
  with an explicit "escape hatch" callout in the migration guide. The
  escape-hatch is the same shape extension authors are already using
  today (per R1 sweep — 213 dpr hits / 27 repos / ★31,188 already
  reach for `window.devicePixelRatio` or canvas-DS directly).
- Vendor packs that mix client/canvas spaces will see compile-time
  removal of the surface in the v2 cut-over wave (mirrors the
  W6.P3 <a href="/decisions/D-widget-converge" class="wiki-link">D-widget-converge</a> "hard cut, no compat shim" precedent for
  `node.addDOMWidget`).

The documentation-first commitment is load-bearing here — the PICK is
contingent on the migration guide explaining the three spaces, the
single-space policy, the escape hatch, and the dpr policy clearly
enough that both human authors AND their AI coding agents pick the
right path on first read.

### Documentation contract (load-bearing for the PICK)

The migration guide MUST cover, at minimum:

1. **The three spaces in plain prose** — canvas vs client/screen vs
   CSS — with a 1-paragraph explanation each + a worked example showing
   how the three diverge under zoom + pan + hi-DPI.
2. **The single-space policy** — `NodeHandle.*` and any future
   pointer-event helper deliver canvas units; period.
3. **The escape hatch** — `window.app.canvas.ds.scale` /
   `.offset` for the transform, `window.app.canvas.canvas` for the
   `<canvas>` element, `window.devicePixelRatio` for hi-DPI. Marked
   `@stability escape-hatch` (NOT `@stability stable`) so author
   tooling flags the dependency as deliberate-but-fragile.
4. **The dpr policy** — invisible to extensions through the public
   handles; if the author needs it (custom GPU canvas, very-hi-DPI
   PNG export), the escape-hatch covers it.
5. **The cliff** — explicit list of removed APIs (none currently
   exist on the v2 public surface, but the migration guide MUST
   explain why `addDOMWidget` clients DO get pre-converted positioning
   for free now, and why `node.pos` reads CANVAS even on a 2× display).
6. **Agent-friendly examples** — every code sample in the guide names
   the space in a code comment (`// canvas units`) so AI agents
   parsing the docs see the convention reinforced at every site.

### What's NOT being added

- No `Viewport` accessor on the public surface (would re-expose the
  three-space distinction we're hiding).
- No `getScreenPosition()` / `getCSSPosition()` methods on
  `NodeHandle`.
- No branded coord types — the only type is `Point = readonly [number, number]`
  in canvas units (already shipped via W6.P8.C).
- No `space` parameter on any handle method.

Three other candidate shapes were considered:

### Option (i) — Branded coordinate types + explicit converters

```ts
type CanvasPoint = { x: number; y: number; readonly __brand: 'canvas' }
type ClientPoint = { x: number; y: number; readonly __brand: 'client' }
type CSSPoint    = { x: number; y: number; readonly __brand: 'css' }

namespace coords {
  function clientToCanvas(p: ClientPoint, viewport: Viewport): CanvasPoint
  function canvasToClient(p: CanvasPoint, viewport: Viewport): ClientPoint
  function clientToCSS(p: ClientPoint): CSSPoint
  function cssToClient(p: CSSPoint): ClientPoint
}
```

Strongest type-safety; `node.pos` returns `CanvasPoint`; pointer-event
helpers return `ClientPoint`; DOM-widget mount API returns `CSSPoint`.
Authors cannot accidentally pass canvas coords where client is expected
(or vice versa). Cost: branded types add a small ergonomic tax — every
literal `{ x, y }` needs construction via `coords.canvas(x, y)` or a
typed assertion.

### Option (ii) — Single `Point` type + explicit `space` parameter on every API

```ts
interface Point { x: number; y: number }

interface NodeHandle {
  getPosition(space?: 'canvas' | 'client' | 'css'): Point   // default 'canvas'
  setPosition(p: Point, space?: 'canvas' | 'client' | 'css'): void
}
```

No type-system enforcement; runtime opt-in. Every coordinate-touching
API gains a `space` parameter that defaults to canvas. Mid-weight
ergonomics. Lets authors pick whichever space they're already in. Cost:
no compile-time guarantee against passing a `Point` from one space into
another API expecting a different default — the very bug the audit is
meant to prevent.

### Option (iii) — Hide the spaces entirely; expose only canvas via handles

```ts
interface NodeHandle {
  getPosition(): { x: number; y: number }   // always canvas
  setPosition(p: { x: number; y: number }): void
  // no getScreenPosition / getCSSPosition exposed
}

// Pointer events arrive in canvas space; DOM widget mount provides
// pre-converted positioning automatically.
```

Maximally simple. Internal renderer takes responsibility for every
canvas↔client↔CSS conversion authors needed today. Aligns with CB's
"if they all want LiteGraph, standardize on that" hypothesis. Cost: the
~5–10% of extensions that legitimately need screen coords (e.g. for
floating overlays, custom hit-testing on hi-DPI) would have to drop to
the v1 escape hatch (`window.app.canvas.ds.convertCanvasToOffset` or
similar).

## Consequences

**Common (any option):**

- The R4 P7 canvas-prototype patching surface (G13 in <a href="/decisions/D4-gap-analysis" class="wiki-link">D4</a>) needs an
  explicit story whether the chosen option closes that gap or whether a
  separate `defineCanvasExtension` ADR is still required.
- Hi-DPI handling (devicePixelRatio) is currently invisible to
  extensions; whichever option lands must document the policy.
- The `core` `assert()` PR can carry runtime invariant checks for the
  canvas/client mix-up class regardless of which option is chosen —
  belt-and-suspenders alongside type-system enforcement.

**Per-option deltas** are intentionally not enumerated yet — those land
during W6.P4.B.

## Alternatives considered

> **DATA-ONLY framing** — the Verdict column stays TBD per Wave-6
> process discipline. R1+R2+R3 evidence (8,424 EXT hits / 103 repos /
> ★41,621) is summarised below per option; the PICK lands in W6.P4.B
> with Christian human-in-the-loop.

### Per-option migration-cost (from R3 effects matrix)

| Option | ZERO | TS-ERR | SILENT-NOOP | REWRITE-METHOD | UNMIGRATABLE |
|---|---:|---:|---:|---:|---:|
| (i) branded types + converters       | 1,305 | **5,524** |     0 | 1,595 |     0 |
| (ii) single <a href="/api-docs/point" class="wiki-link">Point</a> + space param      | **5,619** |     0 | **1,559** | 1,246 |     0 |
| (iii) hide spaces, canvas-only       | 4,314 |     0 |     0 | 1,390 | **2,720** |

(Bold cells = the "headline cost" each option pays.)

### Bug-class headline (DATA)

The recurring bug — author got `clientX/Y` (or `pageX/Y`, `offsetX/Y`,
`getBoundingClientRect`) without any conversion present, when the
unambiguous local context suggests they wanted canvas space — fires
**2,617 times across 71 repos (cum ★40,040)**. That's 31% of all EXT
coordinate-touching hits. Manual conversions (`/scale`, `*scale`,
`ds.offset`) appear in only 361 hits / 25 repos (cum ★23,226) — 4.3%
of call sites. The audit hypothesis (CB's "if extensions almost always
want LiteGraph (canvas) coords, standardize on that") matches the
data.

### Per-option pros + cons (grounded in R1/R2/R3)

| Option | Pro (evidence) | Con (evidence) | Verdict |
|---|---|---|---|
| (i) branded types + converters | Catches the 2,617-hit bug class at **compile time** for new authors; native muscle memory for the 919 existing `ds.scale`/`ds.offset` callers; converters already exist in the surface for the 34 explicit-convert callers across 8 repos | **5,524 TS errors on consumer cut-over** — 3,965 of those land in canvas-symbol hits (`node.pos`/`node.size`), not just the bug-class ones; biggest single victim `rgthree-comfy` (★3,066) absorbs 249 TS-errs; branded literals add ergonomic tax on every `{x, y}` constructor | **Rejected** — TS-err blast radius punishes canvas-symbol authors (the majority) for the client-symbol authors' bug class. Branded literals also fail the "agent-friendly" criterion: AI agents writing extension code don't naturally construct branded values. |
| (ii) single <a href="/api-docs/point" class="wiki-link">Point</a> + space param | Cheapest to adopt — **5,619 ZERO cells**, 67% of all hits; no breaking change for existing canvas-symbol callers; `space` param can default to canvas to match observed-intent skew | **1,559 SILENT-NOOP cells** — the bug class still ships with no type-system signal; no compile-time guarantee against the very gap the audit is meant to prevent; top-10 silent-noop repos identical to top-10 unmigratable repos for opt (iii) — same broken behavior, different label | **Rejected** — leaves the bug class open (just with a different label). Multiple-truth surface is the opposite of the "single unified concept" PICK criterion. |
| (iii) hide spaces, canvas-only handles | Simplest API; closes the bug class entirely for client-space cases; matches the W6.P3 <a href="/decisions/D-widget-converge" class="wiki-link">D-widget-converge</a> precedent ("hard cut, no compat shim"); 4,314 ZERO cells for canvas-symbol users; existing `convert*` API is barely adopted (34 hits / 8 repos) — hiding it loses very little ecosystem muscle memory | **2,720 UNMIGRATABLE cells across 71 repos** — biggest single loser `guido-gfv_gfv_pro_upgrade` (455 hits, mostly bbox + clientX/Y); forces escape-hatch usage (`window.app.canvas.ds.*`) for legitimate hi-DPI math (213 dpr hits) and floating-overlay use cases; cliff is concentrated in the same top-10 repos as opt (ii) SILENT-NOOP | **ACCEPTED 2026-05-18 (Christian, handoff-9).** Cliff cost paid as documented escape-hatch + migration-guide rows. Per Christian: "single unified concept and then we just document the nuance thoroughly such that 3rd party devs and their agents see it". |
| (iv) keep status quo (canvas default, no doc, no enforcement) | Zero work | Leaves the 2,617-hit / 71-repo / ★40,040 bug class open; rejected by W6.P4 framing | Rejected |

### Cross-option observations (DATA, no preference)

1. **Bug-class footprint is identical across (ii) and (iii)** — same
   top-10 consumers absorb 66% of opt (iii) UNMIGRATABLE cells AND 60%
   of opt (ii) SILENT-NOOP cells. The two options differ in *label*,
   not in *behavior locus*. Opt (i) redistributes that footprint toward
   canvas-symbol callers (`node.pos`/`node.size`).

2. **Converter calls already exist in the wild** — 919 `ds.scale` /
   `ds.offset` hits across 51 repos; 34 explicit `convert*` calls
   across 8 repos. Any option that exposes a `Viewport` accessor lands
   on existing muscle memory; opt (iii) forces those 51+ authors off
   the explicit-transform path.

3. **Hi-DPI is a separate axis** — 213 `devicePixelRatio` hits / 27
   repos / ★31,188. Smallest cluster, highest cum-stars density. Cost
   cells assume dpr stays caller-owned for (i)/(ii); opt (iii) folds
   it into the canvas-only handle. Whichever option lands, the dpr
   policy must be documented explicitly.

4. **<a href="/decisions/D-widget-converge" class="wiki-link">D-widget-converge</a> precedent (<a href="/axioms#a12-refs" class="wiki-link">A12</a> / W6.P3.C `2f102353fa`)** —
   accepted hard-cut hiding the DOM seam in favor of `mount(host, ctx)`,
   absorbing UNMIGRATABLE cells via migration-guide rows. Opt (iii)
   extends that pattern; opts (i) and (ii) don't. Observation only —
   precedent ≠ verdict.

5. **`convert*` API adoption is low (34 hits / 8 repos)** — author
   awareness of the converter helpers is low today. Any option that
   ships a `Viewport` accessor with a converter as its primary surface
   needs to bake the migration-guide examples around it, not assume
   authors know it exists.

Evidence artifact: `research/architecture/D-coordinate-space-blast-radius.md`

## Implementation plan

| Step | Action | Owner | Verification |
|---|---|---|---|
| 1 | Expand JSDoc on `NodeHandle.getPosition` / `setPosition` / `getSize` / `setSize` to explicitly state **canvas units**, name the other two spaces in prose, point to the escape-hatch, and link to <a href="/axioms#a13-refs" class="wiki-link">A13</a> + this ADR | foundation | grep `node.ts` for "canvas units" appears in each of the 4 method JSDocs |
| 2 | Author **Axiom <a href="/axioms#a13-refs" class="wiki-link">A13</a>: Single Coordinate Space (Canvas)** in `AXIOMS.md` codifying the policy + the escape-hatch + the dpr policy | foundation | <a href="/axioms#a13-refs" class="wiki-link">A13</a> present + cross-linked from <a href="/axioms#a12-refs" class="wiki-link">A12</a> |
| 3 | Add `@stability escape-hatch` JSDoc tag explanation to the package README so `@stability stable` keeps its meaning | pkg | README mentions the new tag |
| 4 | Author migration-guide section `extensions/development.md` § "Coordinate spaces — single-unified-concept policy" covering all 6 documentation-contract items above. Every code sample comments the space inline (`// canvas units`) | embedded-docs | All 6 items present + at least 3 worked examples |
| 5 | Pkg `.d.ts` regen | pkg | `pnpm build`; `WidgetCleanup` etc. unchanged; JSDoc visible in build output |
| 6 | Ext example demonstrating the escape-hatch correctly (one of the existing `*.v2.ts` files annotated, or a new `dprAwareCanvas.v2.ts` showing the `window.app.canvas.canvas` access path) | ext | Ext example references the escape-hatch with the comment `// escape-hatch — see D-coord-space §Decision` |
| 7 | TF: no new tests required at decision time — surface unchanged. R4 DB amend adds `S2.N9b/S2.N10b/S3.C*/S2.N17` patterns. R5 dashboard refresh surfaces the policy via the docgen pipeline | tf + dashboard | rollup.yaml updated; dashboard preview shows new patterns |
| 8 | Comment on PR #12142 with PICK summary + commit SHAs + link to migration-guide section | PR | comment posted |

Implementation = light because `getPosition` / `getSize` / `setPosition` /
`setSize` already return canvas units (per W6.P8.C `df921f3512`). The
PICK ships primarily as **documentation + axiom**, with the
ext-example as the executable canary that the documented pattern
actually works.

## References

- design-review-12142.md row #10 (the open-research item this ADR closes)
- W6.P4 task block in `todo.md` (Wave-6 section)
- <a href="/decisions/D4-gap-analysis" class="wiki-link">D4</a> — gap analysis (BLOCKER G13: canvas-level extension surface; closely related but distinct)
- research/touch-points/database.yaml entries S2.N9, S2.N10, S2.N11, S4.W2, R4 P7
- ComfyUI_frontend `core` assert() PR (in flight, exact PR# pending lookup) — runtime invariant carrier
- AGENTS.md "Decision propagation rules" — once accepted, must reach (a) commit on PR #12142, (b) this ADR, (c) dashboard JSON
