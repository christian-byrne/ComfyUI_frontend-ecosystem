# ADR: <a href="/axioms#a2-refs" class="wiki-link">A2</a> Rationale — Minimal API Surface

**Status**: accepted
**Date**: 2026-05-21
**Wave**: W19.<a href="/axioms#a1-refs" class="wiki-link">A1</a>+<a href="/axioms#a2-refs" class="wiki-link">A2</a> (axiom prose simplification)
**Supersedes**: prose previously inline at `AXIOMS.md §A2` (lines 36–53 of the pre-W19 540-line version)

## Context

Pre-W19 `AXIOMS.md §A2` carried both the postulate ("start with absolute
minimum, add by necessity") and a Phase A exclusions checklist that
duplicates the canonical <a href="/axioms#a14-refs" class="wiki-link">A14</a> table. The Jacob Segal source quote and the
"egregious use patterns" heuristic were also there.

## Decision

Move the Jacob Segal quote and the longer "egregious-use heuristic"
discussion into this ADR. `AXIOMS.md §A2` keeps the postulate + 3 implication
bullets + a cross-ref to <a href="/axioms#a14-refs" class="wiki-link">A14</a> for the actual Phase A exclusion list.

## Rationale

### Why "add by necessity" not "add by adoption"

There is a tempting trap in extension-API design: count how many community
extensions use a given surface and treat the count as justification. The
problem is that community extensions encode current ecosystem constraints —
including the workarounds they had to invent because a better surface didn't
exist yet. A surface that 80% of extensions use today might be 80% workaround
and 20% legitimate use.

The <a href="/axioms#a2-refs" class="wiki-link">A2</a> heuristic flips the logic: if we observe an "egregious" use pattern
(monkey-patching, prototype pollution, polling for state), that is a signal
to **not** expose that surface in v2 — those uses indicate the absence of a
proper API, not its presence.

The Phase A exclusion list in <a href="/axioms#a14-refs" class="wiki-link">A14</a> (slot/connection hooks, nodeMode, node→widget
communication) was built by applying this heuristic to the v1 surface.

### Source quote

> "We should have an API where however people use it, if they're only using
> it, things should just work."
> — Jacob Segal, 2026-05-18 design review

This quote pairs with the egregious-use heuristic. The aspiration is that
the v2 surface contains only things that are safe to use in any combination —
no foot-guns whose only safe use is the narrow case the original author had
in mind.

### Phase A exclusions (now canonical in A14)

Pre-W19 §A2 listed:
- Slot/connection hooks
- `nodeMode` access
- Node→widget communication methods
- Any surface with primarily "egregious" observed use cases

These are all captured in the A14 COMMENTED OUT table with per-surface
rationale. The §A2 list is removed to eliminate duplication.

## Consequences

- ✅ Phase A exclusions live in exactly one place (A14).
- ✅ The "egregious-use heuristic" has a single explanatory home.
- ⚠️ Future "should we add this surface?" debates must reference both A2
  (the principle) and A14 (the current state).

## Cross-references

- `AXIOMS.md §A2` — postulate (post-W19)
- `AXIOMS.md §A14` — canonical Phase A exclusions table
- `decisions/D-axiom-A1-rationale.md` — sibling rationale ADR (widget-centric)
- `research/external/meeting-2026-05-18-extension-api-design-review.md` — source
- `research/wave-19-axiom-coverage-matrix.md` — disposition tracking
