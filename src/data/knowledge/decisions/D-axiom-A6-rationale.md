# ADR: <a href="/axioms#a6-refs" class="wiki-link">A6</a> Rationale — Command Pattern & Serialization (CRDT compatibility)

**Status**: accepted
**Date**: 2026-05-21
**Wave**: W19.<a href="/axioms#a1-refs" class="wiki-link">A1</a>+<a href="/axioms#a2-refs" class="wiki-link">A2</a> (axiom prose simplification)
**Supersedes**: prose previously inline at `AXIOMS.md §A6` (lines 103–127 of the pre-W19 540-line version)

## Context

Pre-W19 §<a href="/axioms#a6-refs" class="wiki-link">A6</a> carried both the must-have-requirements list (8 invariants) and
a separate "CRDT Compatibility" subsection covering collaborative editing,
offline-first workflows, and conflict resolution. The CRDT block is rationale
for *why* the 8 invariants exist; moved here so §<a href="/axioms#a6-refs" class="wiki-link">A6</a> keeps the invariants
inline.

## Decision

Keep the 8 must-have requirements inline in `AXIOMS.md §A6`. Move the CRDT
discussion + the auditability/reversibility justifications into this ADR.

## Rationale

### Why all 8 invariants together

The 8 invariants (backend-agnostic, portable, deterministic, idempotent,
serializable, stable targeting, transactional, reactive) are not 8
independent design preferences — they are the closure of "what commands need
to support CRDT-compatible <a href="/api-docs/graph" class="wiki-link">graph</a> state".

- **Backend-agnostic + portable + serializable** — commands cross the
  network and execute on different runtimes. The Python backend, a future
  WASM backend, a Go service, a peer in a P2P session all need to consume
  the same command stream.
- **Deterministic + idempotent** — CRDT merge replays operations; replaying
  a command must produce the same result whether it runs once or a
  thousand times.
- **Stable targeting** — commands reference entities by IDs that survive
  rename, restructure, and clone. (<a href="/axioms#a4-refs" class="wiki-link">A4</a>'s handles are the extension-facing
  side of this; commands operate on internal IDs.)
- **Transactional** — multi-step operations atomicize so partial-merge
  scenarios don't leave the <a href="/api-docs/graph" class="wiki-link">graph</a> in a torn state.
- **Reactive** — state observers (Vue refs, downstream computed) update
  on command application without polling.

Dropping any one invariant breaks CRDT compatibility. They're a package.

### CRDT compatibility (full rationale)

Graph state must be CRDT-compatible for three use-cases:

1. **Collaborative editing** — two users edit the same <a href="/api-docs/graph" class="wiki-link">graph</a> concurrently;
   merges resolve without explicit conflict markers. The command log is
   the natural CRDT operation log.

2. **Offline-first workflows** — the user works disconnected, accumulates
   a local command log, then reconciles on reconnect. Idempotency +
   determinism + stable targeting let the reconcile be mechanical.

3. **Conflict resolution** — when two histories diverge and the framework
   cannot resolve automatically, the user gets a meaningful diff because
   the command log is itself human-readable.

### Immutability (full rationale)

State transitions must be:

- **Explicit** (not hidden side effects) — every state change traces to a
  named command, not to "something happened during this method call"
- **Auditable** (command log) — the log is the truth; the current state is
  a function of the log
- **Reversible** (undo/redo via command replay) — undo is "replay the log
  up to step N-1", not "remember what changed and try to put it back"

These three properties are the difference between a state machine that
*can* be a CRDT and one that fundamentally cannot.

## Consequences

- ✅ §A6 reads as a postulate + 8 invariants + 3 immutability bullets.
- ✅ CRDT rationale and use-cases live in one place.
- ⚠️ Any future command-system change must verify all 8 invariants still
  hold, not just the ones obviously relevant to the change.

## Cross-references

- `AXIOMS.md §A6` — postulate + invariants (post-W19)
- Notion source: "Centralized Graph State Package"
  (https://www.notion.so/comfy-org/Centralized-Graph-State-Package-2736d73d3650804ea114c123ddd2c51e)
- `AXIOMS.md §A11` — ECS principles (components as plain data is a prerequisite)
- `research/wave-19-axiom-coverage-matrix.md` — disposition tracking
