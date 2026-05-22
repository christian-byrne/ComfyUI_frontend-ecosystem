# ADR: A15 Rationale — Widget Declarativity

**Status**: accepted
**Date**: 2026-05-21
**Wave**: W19.A1+A2 (axiom prose simplification)
**Supersedes**: prose previously inline at `AXIOMS.md §A15` (lines 323–360 of the pre-W19 540-line version), specifically the multi-paragraph "Rationale" block

## Context

Pre-W19 §A15 carried the postulate (widgets are schema-declared), three
consequence bullets, and a multi-paragraph rationale explaining why runtime
widget addition was the *underlying reason* most of the serialization-disable
matrix existed. Moved here so §A15 keeps the postulate + consequences +
validation inline.

## Decision

`AXIOMS.md §A15` keeps:
- Postulate (widgets schema-declared, no runtime addition, no frontend-only)
- Consequences (addWidget banned; three UI-state escape hatches: boxed
  widget / non-widget UI primitive / schema input)
- Validation criteria

This ADR carries the longer rationale + cross-axiom interaction analysis.

## Rationale

### Why declarativity matters: it removes the cause of the serialize matrix

Pre-A15 v1 had a complex matrix of "should this widget value serialize?"
knobs:

- `widget.options.serialize?: boolean`
- `widget.setSerializeEnabled(false)`
- `event.skip()` in beforeSerialize handlers
- Context-discriminated `'workflow' | 'prompt' | 'clone' | 'subgraph-promote'`

Most of these knobs existed because of **runtime widget addition**. A
widget added at runtime by an extension has no corresponding
`INPUT_TYPES` slot on the backend node class. Sending its value in the
prompt payload would cause backend rejection ("unexpected field"). The
serialize-disable knobs were the workaround.

A15 removes the cause: every widget originates from `INPUT_TYPES`, so
every widget has a backend slot, so every widget's value is safe to
serialize, so the disable matrix is unnecessary.

A16 (unified serialization target) is the consequence ADR: it removes
the escape hatches because A15 removed the need for them.

### The three UI-state escape hatches

Extension authors who previously reached for runtime `addWidget` to hold
UI-only state migrate to one of:

1. **Boxed / composed widget (BBOX-style)** — the widget IS its own
   schema input value. The box composes its UI internally but exposes a
   single schema-declared field to the backend. Example: a region-of-
   interest widget exposes `{x, y, w, h}` as its INPUT_TYPES value;
   internally it renders 4 sliders + a preview, but the schema sees one
   field.

2. **Non-widget UI primitive** — overlays, panels, custom DOM not
   registered through the widget system. Lifecycle attaches via
   `defineNode` / `defineExtension` setup. Examples: a timeline scrubber
   that floats above the canvas; a tutorial overlay; a search-results
   panel. None of these need to serialize, so none of them need to be
   widgets.

3. **Schema input** — the honest answer when the UI-only state really
   does belong in the workflow. Add it to `INPUT_TYPES`. The data point
   was lying about being UI-only.

The three options cover the full space. If a use case fits none of them,
the use case is likely violating A1 (widget-centric) by trying to make
widgets do something they shouldn't.

### Cross-axiom interaction

- **A1 (widget-centric)** — widgets are the singular extension surface;
  A15 specifies they come from schema, not from runtime registration.
- **A5 (3-tier widget state)** — Schema's "immutable for lifetime"
  property is what makes A15 enforceable.
- **A16 (unified serialization target)** — A15 removes the cause; A16
  closes the escape hatches.

### Enforcement

A15 is enforced by:

- `src/extension-api/node.ts` exposes no `addWidget` / `addDOMWidget`
  surface (A14 "REMOVED" table)
- `scripts/check-axiom-compliance.sh` rejects re-introduction (strict-fail)
- `D-ban-runtime-addwidget` (wave-10) is the matching ADR for v1 surface
  enforcement during the D6 parallel-paths transition

## Consequences

- ✅ §A15 reads as postulate + consequences + validation only.
- ✅ The "why the disable matrix existed" history lives in one place.
- ⚠️ Future debate about runtime widget addition must depose both A15
  and A16 to be coherent — the two axioms work as a pair.

## Cross-references

- `AXIOMS.md §A15` — postulate (post-W19)
- `AXIOMS.md §A16` — unified serialization target (paired axiom)
- `AXIOMS.md §A14` — REMOVED table (addWidget enforcement)
- `decisions/D-widget-serialization-simplification.md` — origin ADR (wave-9)
- `decisions/D-ban-runtime-addwidget.md` — v1 surface enforcement (wave-10)
- `decisions/D-axiom-A5-rationale.md` — Schema immutability is enabling
- `research/wave-19-axiom-coverage-matrix.md` — disposition tracking
