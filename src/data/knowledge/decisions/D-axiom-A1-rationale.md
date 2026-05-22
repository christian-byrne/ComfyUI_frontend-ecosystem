# ADR: <a href="/axioms#a1-refs" class="wiki-link">A1</a> Rationale — <a href="/glossary#widget" class="wiki-link">Widget</a>-Centric Philosophy

**Status**: accepted
**Date**: 2026-05-21
**Wave**: W19.<a href="/axioms#a1-refs" class="wiki-link">A1</a>+<a href="/axioms#a2-refs" class="wiki-link">A2</a> (axiom prose simplification)
**Supersedes**: prose previously inline at `AXIOMS.md §A1` (lines 12–33 of the pre-W19 540-line version)

## Context

The pre-W19 `AXIOMS.md §A1` mixed the **postulate** (widgets are the singular
concept), the **implications** (universal context, no node→widget references),
and a longer **rationale** block (why widgets, not nodes, are the unit of
extension) plus the originating quote from the 2026-05-18 design review.

W19.<a href="/axioms#a1-refs" class="wiki-link">A1</a>+<a href="/axioms#a2-refs" class="wiki-link">A2</a> requires every axiom to compress to postulate (≤2 sentences) +
implications (3–6 bullets) + inline validation. Rationale longer than one
paragraph extracts to a dedicated ADR (this one).

## Decision

Move the long-form rationale + source quotes for A1 out of `AXIOMS.md` and into
this ADR. `AXIOMS.md §A1` retains the postulate and implication bullets only.

## Rationale (extracted from pre-W19 §A1)

### Why widgets, not nodes, are the primary surface

Nodes are **topology**. They live in a <a href="/api-docs/graph" class="wiki-link">graph</a>, they connect through edges, and
they are the unit the backend executes. But the *user-facing* surface — the
piece an extension author sees when they want to add a slider, a dropdown, a
color picker, an audio player — is the **widget**.

Widgets must move in ways nodes cannot. A widget can be **promoted** from a
subgraph into the parent <a href="/api-docs/graph" class="wiki-link">graph</a>. A widget can appear in **app mode** with no
<a href="/api-docs/graph" class="wiki-link">graph</a> visible at all. A widget can render in a **partial graph view** where
its owning node is hidden by the subgraph boundary. A widget can be cloned
across **linked subgraph instances** (blueprints) where the same source
definition manifests in multiple instances.

None of those motions are safe for code that holds a node reference and walks
*down* to widgets. The reference can become stale, the enumeration can return
stale state, and the widget can render in a context where its owning node is
not reachable. Bilateral closure (`widget→node` reference preserved;
`node→widget` enumeration removed) is the structural answer — see
`D-no-node-widget-access.md` for the implementation.

### Source quote

> "Widgets are even able to live or exist and be functional even without a
> graph or a node."
> — Christian Byrne, 2026-05-18 design review (on app mode constraint)

This quote anchors the "anywhere" claim in the postulate. Widgets in app mode
have no visible graph; widgets pre-mounted in a tool palette have no node;
widgets in a deeply-nested subgraph render in a context where their owning
node is not in the user's current view. The "primary extension surface" is
the one that survives all of those transitions.

### Original A1 implications list (preserved for traceability)

The pre-W19 §A1 listed widget contexts a widget must survive:

1. **<a href="/glossary#promotion" class="wiki-link">Promotion</a>** — widget moves from subgraph to parent graph
2. **App mode** — widget exists without visible graph
3. **Partial graph views** — subgraph boundaries hide some nodes
4. **Linked instances** (blueprints) — same graph instance across clones

The post-W19 §A1 compresses these into a single implication bullet
("must survive across promotion / app mode / partial views / linked instances").
The four scenarios remain individually citeable from here.

## Consequences

- ✅ `AXIOMS.md §A1` reads as a postulate + bullet list (≤ 20 lines).
- ✅ Long-form rationale lives in one place and is cite-able from future ADRs.
- ✅ The four widget-context scenarios are still enumerable (this ADR + the
  W19.<a href="/axioms#a4-refs" class="wiki-link">A4</a> derived-theorems list will both cross-reference them).
- ⚠️ Any future change to A1 must update both this ADR (rationale) and
  `AXIOMS.md §A1` (postulate). The supersedes pointer makes the linkage
  explicit.

## Cross-references

- `AXIOMS.md §A1` — postulate (post-W19)
- `decisions/D-no-node-widget-access.md` — bilateral A1 closure implementation
- `decisions/D-widget-converge.md` — <a href="/axioms#a12-refs" class="wiki-link">A12</a> sibling axiom (mount-lifecycle DOM seam)
- `decisions/D11-naming-defineNode-defineWidget.md` — naming convention
- `research/external/meeting-2026-05-18-extension-api-design-review.md` — source
- `research/wave-19-axiom-coverage-matrix.md` — disposition tracking
