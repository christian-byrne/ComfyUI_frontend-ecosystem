# ADR: A5 Rationale — Widget State Three-Tier Model

**Status**: accepted
**Date**: 2026-05-21
**Wave**: W19.A1+A2 (axiom prose simplification)
**Supersedes**: prose previously inline at `AXIOMS.md §A5` (lines 83–99 of the pre-W19 540-line version)

## Context

Pre-W19 §A5 carried the postulate (Schema + Props + Values), the per-tier
descriptions, and a Christian Byrne source quote about the historical mess
of widget state.

## Decision

Keep the postulate + per-tier implications inline. Move the source quote
and the historical-context rationale into this ADR.

## Rationale

### Why three tiers, not one

Pre-v2 widget state was a single bag of properties on a widget object:
type, name, current value, min/max, step, disabled, hidden, callback,
serialize-or-not, etc. Mutation rules were case-by-case:

- `type` was effectively immutable (changing it broke everything)
- `value` was meant to be mutable but had inconsistent change events
- `disabled` / `hidden` were mutable runtime config
- `min` / `max` / `step` were sometimes immutable, sometimes not
- `callback` was mutable but rarely meant to be
- `serialize` was a write-once "I didn't really mean this" escape hatch

The three-tier model gives each property a category:

1. **Schema** — set once at widget construction, never changes for the
   widget's lifetime. The Python `INPUT_TYPES` declaration is the source
   of schema. Dynamic widgets (e.g. combos that re-derive options) have a
   *fixed* schema declaration; only the derived values change.

2. **Props** — runtime configuration the framework or other extensions can
   change. `disabled`, `hidden`, min/max for clamping, callback handlers.
   Mutation is expected and reactive.

3. **Values** — the user-facing data the widget represents. Single
   "modelValue"-style binding (Vue convention). Mutual binding between
   value and props where relevant (e.g. a slider's value clamped by its
   props.max).

Three categories, three mutation policies, three sets of change-notification
semantics. The category answers "can I write this?" without case-by-case
lookup.

### Source quote

> "Widget state is basically a collection of historical accidents and bad
> decisions."
> — Christian Byrne, 2026-05-18 design review

This quote is the *reason* A5 exists as an axiom rather than a convention.
The historical-accidents observation is the empirical motivation for
locking in the three-tier categorization at the axiom level — any future
"can I just add this one property?" debate has to specify which tier the
property belongs to.

### Cross-axiom interaction

- A1 (widget-centric) — widgets are the unit; A5 specifies the unit's
  state model.
- A12 (mount-lifecycle DOM seam) — the mount closure sees Schema (frozen),
  Props (reactive), Values (reactive). The DOM is built against all three
  but is not itself a fourth tier.
- A15 (widget declarativity) — Schema's "immutable for lifetime" property
  is what makes "no runtime addWidget" enforceable; if Schema were mutable
  there would be no clean line between "configure" and "create".
- A16 (unified serialization target) — Values serialize; Props do not;
  Schema is regenerated from `INPUT_TYPES` on the backend side.
  The three-tier model maps cleanly onto the serialization boundary.

## Consequences

- ✅ A5 prose stays a 3-line postulate + 3 tier-bullets.
- ✅ The historical-accidents quote has a stable home outside the axiom
  itself (axioms shouldn't read as confessions).
- ⚠️ Any future widget-property debate must specify the tier; if a
  property doesn't fit one of the three tiers, the property is wrong, not
  the model.

## Cross-references

- `AXIOMS.md §A5` — postulate (post-W19)
- `AXIOMS.md §A12` — DOM seam (consumes all three tiers)
- `AXIOMS.md §A15` — widget declarativity (Schema's immutability is enabling)
- `AXIOMS.md §A16` — serialization (Values only)
- `decisions/D14-widget-state-categories.md` — operational definition of the tiers
- `research/wave-19-axiom-coverage-matrix.md` — disposition tracking
