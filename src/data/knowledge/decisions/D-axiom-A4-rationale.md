# ADR: <a href="/axioms#a4-refs" class="wiki-link">A4</a> Rationale — ID Strategy (Abstract Handles)

**Status**: accepted
**Date**: 2026-05-21
**Wave**: W19.<a href="/axioms#a1-refs" class="wiki-link">A1</a>+<a href="/axioms#a2-refs" class="wiki-link">A2</a> (axiom prose simplification)
**Supersedes**: prose previously inline at `AXIOMS.md §A4` (lines 71–79 of the pre-W19 540-line version)

## Context

`AXIOMS.md §A4` carried both the postulate (extension authors should never
need raw IDs) and a deferred-discussion note ("Locator IDs vs <a href="/api-docs/execution" class="wiki-link">execution</a> IDs
need further discussion").

## Decision

Keep the postulate + implications inline in `AXIOMS.md §A4`. Move the
deferred-discussion note into this ADR's "Open questions" section so the
axiom prose stays tight and the deferral is still cite-able.

## Rationale

### Why handles, not IDs

ID exposure is a stability foot-gun. Once an extension stores an ID, the
runtime owes the extension that any future ID stays stable across:

- Workflow save/load round-trips
- <a href="/glossary#subgraph" class="wiki-link">Subgraph</a> promotion and demotion
- Linked-instance clones
- Undo/redo state restoration
- Collaborative edits (CRDT merge)

Handles invert that burden. The handle is the extension's reference; the
runtime owns the mapping from handle to internal ID. When the runtime needs
to renumber, restructure, or clone, the handle indirection absorbs the
change without the extension ever observing it.

`D20-id-type-convergence.md` covers the internal ID type system (the
runtime's side); <a href="/axioms#a4-refs" class="wiki-link">A4</a> covers the extension-facing surface (no raw IDs at the
boundary).

### Open questions (deferred)

- **Locator IDs vs <a href="/api-docs/execution" class="wiki-link">execution</a> IDs** — pre-W19 §<a href="/axioms#a4-refs" class="wiki-link">A4</a> flagged that distinguishing
  identifiers used for *finding* an entity from identifiers used at
  *<a href="/api-docs/execution" class="wiki-link">execution</a> time* needs further discussion. Tracked as a Phase B follow-up
  alongside `D20-id-type-convergence.md`.

### Scope-managed handles

Auto-disposal is a critical part of A4. A handle that outlives its scope is
a leak that violates <a href="/axioms#a9-refs" class="wiki-link">A9</a> (least privilege). The intended pattern:

```ts
// Inside an extension's setup function:
const widget = ctx.useWidget(...)
// `widget` is a handle; when this setup scope tears down, the handle is
// auto-disposed and any side-tables keyed by it are GC-reachable for cleanup.
```

This means extension authors never have to remember to "release" a handle;
the scope <a href="/api-docs/graph" class="wiki-link">graph</a> does it.

## Consequences

- ✅ `AXIOMS.md §A4` stays a 5-bullet implication list.
- ✅ Deferred-discussion notes are still searchable from this ADR.
- ⚠️ Phase B work on locator-vs-execution IDs must update both this ADR
  (rationale + open questions) and `D20-id-type-convergence.md`.

## Cross-references

- `AXIOMS.md §A4` — postulate (post-W19)
- `decisions/D20-id-type-convergence.md` — internal ID type system
- `AXIOMS.md §A9` — security & isolation (handle scoping enforces least privilege)
- `research/wave-19-axiom-coverage-matrix.md` — disposition tracking
