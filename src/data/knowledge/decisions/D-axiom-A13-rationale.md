# ADR: <a href="/axioms#a13-refs" class="wiki-link">A13</a> Rationale — Single Coordinate Space (Canvas) + Escape Hatch

**Status**: accepted
**Date**: 2026-05-21
**Wave**: W19.<a href="/axioms#a1-refs" class="wiki-link">A1</a>+<a href="/axioms#a2-refs" class="wiki-link">A2</a> (axiom prose simplification)
**Supersedes**: prose previously inline at `AXIOMS.md §A13` (lines 259–319 of the pre-W19 540-line version), specifically the "escape-hatch" code block + the "Why an axiom and not just an ADR" block

## Context

Pre-W19 §<a href="/axioms#a13-refs" class="wiki-link">A13</a> was the longest axiom (~60 lines) because it carried:

- Postulate (one coordinate space — canvas units)
- 5 hard rules covering accessors, pointer events, mount hosts, helper
  re-exports, and devicePixelRatio
- A code block demonstrating the *escape hatch* — how to reach screen-space
  coordinates when canvas-space isn't enough
- A "Why an axiom" rationale block

The escape-hatch and the why-an-axiom material moved here.

## Decision

`AXIOMS.md §A13` keeps the postulate + 5 hard rules + validation criteria
inline. This ADR carries the escape-hatch documentation and the
axiom-status justification.

## Rationale

### The escape hatch (deliberately fragile)

There are legitimate cases that need screen-space coordinates:

- Hi-DPI math on a custom GPU canvas
- Floating overlays anchored to absolute browser coordinates
- Custom hit-testing outside the LiteGraph canvas

For those cases, the v2 surface does NOT export coordinate-conversion
helpers. Authors who need them reach through `window.app.canvas`:

```ts
// escape-hatch — see D-coord-space.md § Documentation contract
const scale = window.app.canvas.ds.scale            // zoom factor
const [ox, oy] = window.app.canvas.ds.offset        // pan offset (canvas units)
const rect = window.app.canvas.canvas.getBoundingClientRect()  // CSS pixels
const dpr = window.devicePixelRatio                  // hi-DPI factor
```

**Rules of the escape hatch:**

1. Authors reaching for the escape hatch MUST annotate the use site with
   the `escape-hatch` comment so reviewers (human or AI) can see the
   dependency is deliberate.
2. The escape hatch is NOT a stability promise — it can change shape with
   internal renderer refactors.
3. If a use case for the escape hatch becomes common enough to justify a
   stable surface, a new ADR proposes the surface; the escape hatch is
   not the answer.

The asymmetry (canvas-space stable + first-class; screen-space available
but unstable) deliberately makes the right thing easy and the wrong thing
clearly marked.

### Why an axiom and not just an ADR

The rule "one coordinate space at the boundary" is invoked by every
future surface that touches geometry:

- **Pointer-event helpers** (future ADR) — deliver canvas-space `{x, y}` only
- **Drag-and-drop ADRs** — drag targets and drop zones speak canvas units
- **Future viewport ADRs** — viewport queries return canvas-space bounds
- **Selection-rectangle helpers** — selection bounds are canvas-space
- **Custom `onDraw*` patching replacements** — draw callbacks receive
  canvas-space context

<a href="/axioms#a13-refs" class="wiki-link">A13</a> short-circuits the per-ADR coordinate-space debate. If a future ADR
wants to expose CSS pixels or screen coordinates as a stable type, that
ADR must depose A13.

### Why canvas units, specifically

The choice of canvas units (not CSS pixels, not screen pixels, not
device pixels) follows from three constraints:

1. **Canvas units are device-independent.** They survive DPR changes,
   browser zoom, monitor swaps. CSS pixels move with browser zoom;
   device pixels move with DPR. Canvas units are the workflow's
   intrinsic coordinate system.

2. **Node positions are persisted in canvas units.** A workflow saved
   on a low-DPR monitor and loaded on a hi-DPR monitor places nodes at
   the same logical positions. Any other unit would require
   conversion at every save/load boundary.

3. **The pan/zoom transform is the only conversion the runtime owns.**
   By keeping the public surface in canvas units, the conversion math
   stays in exactly one place (the renderer) and never leaks into
   extension code.

### Documentation contract (6 items)

The migration guide must cover, per D-coord-space:

1. Why canvas units, not CSS or screen
2. How the runtime positions mount hosts
3. How to reach screen coordinates via escape hatch
4. How to annotate escape-hatch use
5. How to migrate v1 patterns that used `clientX` / `clientY`
6. What the dpr policy is (the runtime owns dpr math)

## Consequences

- ✅ §A13 reads as postulate + 5 hard rules + validation only.
- ✅ Escape-hatch documentation has a single stable home.
- ✅ Future geometry-related ADRs cite this rationale for the
  axiom-status justification.
- ⚠️ Future requests to expose CSS / screen coordinates as stable
  surface must depose A13.

## Cross-references

- `AXIOMS.md §A13` — postulate + hard rules (post-W19)
- `decisions/D-coordinate-space.md` — implementation ADR (the source of A13)
- `decisions/D-axiom-A12-rationale.md` — sibling rationale ADR (DOM seam)
- `research/wave-19-axiom-coverage-matrix.md` — disposition tracking
