---
source_url: file://ComfyUI_frontend/docs/adr/0006-primitive-node-copy-paste-lifecycle.md
date_accessed: 2026-05-08
ingestion_task: I-NEW.1
status: ingested
---

# ADR 0006 — PrimitiveNode Copy/Paste Lifecycle (summary)

**Status in source:** Proposed (date 2026-02-22). No decision recorded; "Pending. Option A is the most pragmatic first step."

## What it's actually about

Narrowly: **PrimitiveNode loses secondary widget values on copy/paste.** PrimitiveNode creates widgets dynamically on connection. When copied, the clone has no `this.widgets`, so `LGraphNode.serialize()` drops `widgets_values` from clipboard data. Secondary widget values (e.g. `control_after_generate`) are lost on paste.

NOT about general node copy/paste lifecycle. NOT about extension state on copy. The title is broader than the scope.

Source links: issue [#1757](https://github.com/Comfy-Org/ComfyUI_frontend/issues/1757), PR [#8938](https://github.com/Comfy-Org/ComfyUI_frontend/pull/8938), `docs/WIDGET_SERIALIZATION.md#primitiveno-and-copypaste`.

## Three options enumerated

- **A. Minimal fix** — override `serialize()` on PrimitiveNode to fall back to `this.widgets_values` (set during `configure()`) when base impl omits widget values due to missing `this.widgets`.
  - + Lowest risk; doesn't touch connection lifecycle.
  - + Doesn't affect workflow save/load (already works via `onAfterGraphConfigured`).
  - − Doesn't fix the deeper design issue — primitives still empty on copy.
- **B. Clone-configured-instance lifecycle** — on copy, primitive is a clone of the configured instance (widgets intact); on disconnect/paste-without-connections, returns to empty state.
  - + Copy→serialize captures `widgets_values` correctly.
  - + Secondary widget state survives round-trips with no special-casing.
  - − `input.widget[CONFIG]` allows extensions to make PrimitiveNode create a _different_ widget than the target — widget config derived at connection time, not stored, so cloning configured state may not be faithful.
  - − Deserialization order: `configure()` runs before links restored. PrimitiveNode needs links to know what widgets to create. `onAfterGraphConfigured()` handles this for workflow load, but copy/paste uses a different code path.
  - − Higher extension-compat regression risk.
- **C. Projection model** (like Subgraph widgets) — primitives have no own state, just a projection of target widget's resolved value.
  - + Cleanest conceptual model; eliminates state duplication.
  - − Multi-target connections make projection ambiguous.
  - − Major architectural change.

## Decision in source

> "Pending. Option A is the most pragmatic first step. Option B can be revisited after Option A ships and stabilizes."

## Intersections with our project

- **I-WS (lazy widget serialization) — primary intersection.** Option A's "fall back to `this.widgets_values` when widgets missing" is *exactly* the runtime-vs-disk divergence I-WS is trying to collapse. Lazy on-access serialization (`widget.getSerializedValue()`) would naturally answer "what should the clipboard write?" without an `else if` branch in `serialize()`. ADR 0006 Option C ("projection model") and our I-WS goal are related — both are saying "stop duplicating state between widget and disk representation."
- **I-SR (scope registry) — secondary intersection.** Original assumption that ADR 0006 affected `NodeInstanceScope.clone-on-copy` was based on title only. Actual scope is narrow (widget values), not full extension state. I-SR copy semantics still need to be specified separately — that's an open question NOT answered by ADR 0006.
- **R7 touch-point database.** ADR 0006 reinforces patterns S2.N6 `onSerialize`, S2.N15 `prototype.serialize` direct patching, and S4.W3 `widget.serializeValue` — all serialization surfaces, all touched by extensions.
- **Subgraph widget promotion (Austin's PR #11811).** ADR 0006 Option C explicitly cites Subgraph widgets as the prior art for the projection model. PR #11811 (now landing on `extension-v2-api-proposal` via Alex's PR #11939 stack) implements promoted-widget instance state restoration — the same shape of problem.

## Recommendation for our planning

1. **Reframe I-NEW.1 finding in CONTEXT.md.** ADR 0006 is widget-serialization-adjacent, not scope-adjacent.
2. **Add to I-WS.1 audit explicitly.** When tabulating serialization surfaces, include the PrimitiveNode `widgets_values` fallback path. The lazy-on-access design must answer: "does PrimitiveNode benefit from this design? does it fix #1757?"
3. **Track ADR 0006's "Pending" status.** Our I-WS design might preempt the need for the ADR's three options — or we might want to coordinate with the ADR's author to land Option A as a wedge before our larger I-WS work.
4. **Decouple I-SR copy semantics.** Specify separately: when a node is copied, does its `NodeInstanceScope` clone, share, or reset? ADR 0006 doesn't answer this; we still need to.
