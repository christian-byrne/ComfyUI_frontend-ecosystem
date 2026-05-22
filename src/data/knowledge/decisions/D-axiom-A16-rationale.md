# ADR: <a href="/axioms#a16-refs" class="wiki-link">A16</a> Rationale — Unified Serialization Target

**Status**: accepted
**Date**: 2026-05-21
**Wave**: W19.<a href="/axioms#a1-refs" class="wiki-link">A1</a>+<a href="/axioms#a2-refs" class="wiki-link">A2</a> (axiom prose simplification)
**Supersedes**: prose previously inline at `AXIOMS.md §A16` (lines 364–406 of the pre-W19 540-line version), specifically the "Rationale" paragraph

## Context

Pre-W19 §<a href="/axioms#a16-refs" class="wiki-link">A16</a> carried the postulate (workflow JSON and prompt payload
converge; sole interface is `widget.on('beforeSerialize')`), four
consequence bullets, a rationale paragraph explaining that the four-context
discriminator inverted the direction of knowledge flow, and validation
criteria. Moved the rationale paragraph here so §<a href="/axioms#a16-refs" class="wiki-link">A16</a> stays tight.

## Decision

`AXIOMS.md §A16` keeps:
- Postulate
- Four consequences (no disable knobs, no 4-context discriminator,
  hook fires once, node.on('beforeSerialize') @deprecated not banned)
- Validation criteria

This ADR carries the rationale + cross-axiom analysis + the <a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> §Phase 4
historical context.

## Rationale

### Why the 4-context discriminator was wrong

The pre-W19 v1 surface had a beforeSerialize event payload with a
`context: 'workflow' | 'prompt' | 'clone' | 'subgraph-promote'` field.
Extension authors were expected to branch on `context` and produce
different output per branch.

This inverted the direction of knowledge flow. The framework owns
transport (it decides whether the bytes go to a `.json` save file, a
backend prompt, a clone operation, or a subgraph promotion). The
extension owns value (it decides what data point this widget represents).
Asking the extension to know about the transport per call:

1. **Leaks framework concerns into extension code.** Adding a fifth
   transport (e.g., "remote-collaborator-broadcast") would require
   every extension to update its `context` branching.

2. **Encourages divergent serialization per transport.** The same widget
   could serialize as A in workflow JSON and as B in prompt payload,
   making round-trip testing impossible and debugging painful.

3. **Confuses "what to serialize" with "where to send it".** Workflow
   JSON and prompt payload are different *transports* of the same
   *semantic value*. They are not different *values* that the extension
   should produce.

A16 inverts the relationship: the extension produces one value, and the
framework writes that value to every transport. If transport-specific
processing is needed (e.g., a workflow-only "user notes" field), that's
a framework concern (a separate side-channel), not an extension concern.

### Clone and subgraph-promote are framework concerns

The other two contexts in the discriminator (`clone`, `subgraph-promote`)
are not serialization at all — they're entity-lifecycle events. Clone
duplicates an entity's component state; subgraph-promote moves an entity
across a topology boundary. Both should fire their own dedicated events
(e.g., `widget.on('beforeClone')`, `widget.on('beforePromote')`) rather
than overload `beforeSerialize`. A16 deletes the discriminator and
leaves those two events to be added as separate ADRs if needed.

### Why `node.on('beforeSerialize')` is @deprecated but not banned

A16 explicitly *does not* ban the node-level hook. With <a href="/axioms#a15-refs" class="wiki-link">A15</a> (widgets
schema-declared) + A16 (unified serialization) in force, the node-level
hook is structurally redundant — there is nothing a node-level handler
can do that a widget-level handler can't do better. But banning it
outright would break existing extensions during the <a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a> parallel-paths
window without a corresponding migration recipe.

The disposition is:
- The hook remains exported and callable
- It carries `@deprecated` JSDoc + runtime warning per ADR-0010
- A future ADR may flip it to banned (probably as part of the <a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a> sunset)

Per user direction 2026-05-20: "we should ban this eventually but A16's
job is to specify the *new* surface, not to delete the old one. The
deprecation tag is the signal; the ban is the next-wave decision."

### <a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> §Phase 4 historical context

<a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> (serialization convergence) had a Phase 4 milestone that said "the
beforeSerialize hook fires once with a single payload". The 4-context
discriminator was a Phase 3 artifact that survived into Phase 4
implementation without anyone re-reading the Phase 4 spec. A16 makes
that Phase 4 milestone normative — the discriminator is removed, the
once-per-serialization semantics are axiomatized.

### Cross-axiom interaction

- **<a href="/axioms#a15-refs" class="wiki-link">A15</a> (widget declarativity)** — removes the cause; A16 removes the
  escape hatches. The two axioms work as a pair.
- **<a href="/axioms#a1-refs" class="wiki-link">A1</a> (widget-centric)** — the sole interface is widget-level, not
  node-level. <a href="/axioms#a1-refs" class="wiki-link">A1</a> makes that natural.
- **<a href="/axioms#a5-refs" class="wiki-link">A5</a> (3-tier widget state)** — Values serialize; Props and <a href="/glossary#schema" class="wiki-link">Schema</a> do
  not. The three tiers map cleanly onto the serialization boundary.
- **<a href="/axioms#a6-refs" class="wiki-link">A6</a> (command pattern)** — serialized values feed into commands;
  commands serialize for transport. A16 specifies the value-side; <a href="/axioms#a6-refs" class="wiki-link">A6</a>
  specifies the operation-side.

## Consequences

- ✅ §A16 reads as postulate + consequences + validation only.
- ✅ The "why the discriminator was wrong" reasoning has a stable home.
- ⚠️ Any future serialize-related ADR must verify A16 still holds — if
  a new use case seems to require the discriminator back, it actually
  requires a new dedicated event (clone/promote/etc.).

## Cross-references

- `AXIOMS.md §A16` — postulate (post-W19)
- `AXIOMS.md §A15` — paired axiom (widget declarativity)
- `AXIOMS.md §A14` — REMOVED + COMMENTED OUT tables (A16 closure rows)
- `decisions/D14-serialization-convergence.md` — origin ADR (Phase 4 milestone)
- `decisions/D-widget-serialization-simplification.md` — wave-9 implementation
- `decisions/D-axiom-A15-rationale.md` — sibling rationale ADR
- `research/wave-19-axiom-coverage-matrix.md` — disposition tracking
