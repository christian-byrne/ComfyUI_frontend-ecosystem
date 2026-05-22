# ADR: <a href="/axioms#a12-refs" class="wiki-link">A12</a> Rationale — <a href="/glossary#mount" class="wiki-link">Mount</a>-Lifecycle as the Sole DOM Seam

**Status**: accepted
**Date**: 2026-05-21
**Wave**: W19.<a href="/axioms#a1-refs" class="wiki-link">A1</a>+<a href="/axioms#a2-refs" class="wiki-link">A2</a> (axiom prose simplification)
**Supersedes**: prose previously inline at `AXIOMS.md §A12` (lines 214–256 of the pre-W19 540-line version), specifically the "Why an axiom and not just an ADR" block

## Context

Pre-W19 §<a href="/axioms#a12-refs" class="wiki-link">A12</a> included a 4-sentence "Why an axiom and not just an ADR" block
explaining why the rule "DOM is a lifecycle seam, not a widget property" is
elevated to axiom status. Moved here so §<a href="/axioms#a12-refs" class="wiki-link">A12</a> keeps the hard rules + the new
W19.<a href="/axioms#a6-refs" class="wiki-link">A6</a> "What this changes for you" framing + the W19.<a href="/axioms#a7-refs" class="wiki-link">A7</a> host-remount vs
widget-recreate glossary inline.

## Decision

`AXIOMS.md §A12` keeps:
- Postulate (one <a href="/glossary#widget" class="wiki-link">Widget</a> shape, DOM via mount lifecycle only)
- Hard rules (no element/inputEl, mount closure, runtime-owned host,
  cleanup destruction-only, <a href="/api-docs/definewidget" class="wiki-link">defineWidget</a> registration, v1 sunset)
- **W19.<a href="/axioms#a6-refs" class="wiki-link">A6</a> "What this changes for you"** framing (handle accessor removed;
  element captured via mount closure; runtime-owned host `<div>` remains)
- **W19.<a href="/axioms#a7-refs" class="wiki-link">A7</a> host-remount vs widget-recreate** distinction
- Validation criteria

Moves to this ADR:
- The "Why an axiom" rationale block

## Rationale

### Why an axiom and not just an ADR

The rule "DOM is a lifecycle seam, not a widget property" is invoked by
every future widget-shape ADR:

- **<a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> (serialization-convergence)** — every "what serializes?" debate
  has to confirm that DOM-derived state (positions, scroll, focus) does
  NOT cross the serialization boundary because DOM is not a widget
  property in the first place.
- **Future D-widget-host-resize** — resize observers attach to the
  runtime-owned host, not to the widget; the axiom makes that
  attachment-point obvious.
- **Future D-custom-widget-renderer-events** — event handlers route
  through the mount closure, not through widget-level
  `widget.addEventListener` (which doesn't exist).
- **Future ADRs that don't exist yet** — every time someone asks "should
  we add `widget.foo` for direct DOM access?", A12 short-circuits the
  re-litigation.

The axiomatic status converts a per-ADR debate into a one-time decision.
If a future ADR wants to violate A12, that ADR must first depose A12 — a
much higher bar than merely justifying a single new surface.

### Historical context

In v1, widgets carried `widget.element` and (for DOM-input widgets)
`widget.inputEl` accessors. Extension authors used these to:

1. Attach event listeners directly to the element
2. Read computed style for layout decisions
3. Modify element attributes (class, data-*, aria-*)
4. Walk the DOM tree from the widget outward

All four use-cases are *legitimate*, but the implementation via direct
accessor coupled the widget identity to the element identity. When the
runtime needed to move the widget (<a href="/api-docs/graph" class="wiki-link">graph</a>↔app mode, subgraph promotion,
`<KeepAlive>` shuffle) the element accessor became stale or wrong. The
mount-closure pattern (the element is captured in the mount closure's
scope; later code paths reach it through the closure binding) preserves
all four use-cases while letting the runtime move the host underneath.

The pre-W19 prose buried this historical context inside hard-rule bullet 2;
W19.<a href="/axioms#a6-refs" class="wiki-link">A6</a> surfaces it as a "What this changes for you" paragraph so v1
authors immediately see the migration path is straightforward.

### Cross-axiom interaction

- **<a href="/axioms#a1-refs" class="wiki-link">A1</a> (widget-centric)** — A12 specifies the DOM seam shape; <a href="/axioms#a1-refs" class="wiki-link">A1</a> specifies
  the entity.
- **<a href="/axioms#a5-refs" class="wiki-link">A5</a> (3-tier widget state)** — DOM is not a fourth tier; it's a derived
  output of mounting against <a href="/glossary#schema" class="wiki-link">Schema</a> + Props + Values.
- **<a href="/axioms#a11-refs" class="wiki-link">A11</a> (ECS principles)** — entities don't own DOM; mount is the
  rendering side-effect that materializes a component query into a DOM
  subtree.
- **<a href="/axioms#a13-refs" class="wiki-link">A13</a> (single coordinate space)** — mount hosts are runtime-positioned;
  the mount body never converts canvas-to-CSS coordinates because the
  runtime guarantees the host's CSS placement matches the widget's
  canvas position.

## Consequences

- ✅ §A12 reads as postulate + hard rules + the two new W19 framings +
  validation, without the meta-discussion of why-an-axiom.
- ✅ Future ADRs that need to invoke A12 cite this rationale ADR for the
  axiom-status justification.
- ⚠️ Any future request to add a widget-level DOM accessor must first
  read this ADR's "Why an axiom" section and explicitly justify
  deposition.

## Cross-references

- `AXIOMS.md §A12` — postulate + hard rules (post-W19)
- `decisions/D-widget-converge.md` — implementation ADR (the source of A12)
- `decisions/D14-widget-state-categories.md` — three-tier model interaction
- `decisions/D-axiom-A1-rationale.md` — sibling rationale ADR
- `decisions/D-axiom-A13-rationale.md` — coordinate-space rationale
- `research/wave-19-axiom-coverage-matrix.md` — disposition tracking
