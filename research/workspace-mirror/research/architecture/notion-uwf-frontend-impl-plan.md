---
source_url: https://www.notion.so/comfy-org/Unified-Workflow-Format-Frontend-Implementation-Plan-3316d73d3650810abd07dcfb48daffff
date_accessed: 2026-05-08
parent_spec: https://www.notion.so/3316d73d3650811587abd9c611e456dc
status: Draft (2026-03-28)
owner: Frontend team (TBD)
---

# Unified Workflow Format — Frontend Implementation Plan

## Summary

The frontend must evolve from the current dual-format model
(`graphToPrompt()` conversion at queue-time + separate save format) to
saving workflows directly in the **unified format** (spec + layout + metadata).
The unified format IS the API payload — the backend derives `ExecutionPrompt`
from it; the frontend does not submit a separate API format.

---

## Three Phases

### Phase 1 — Named Inputs (bridge, non-breaking)

Ship `widgets_values_named` (Austin's PR #10392): serialize inputs as named
key-value pairs alongside the existing positional `widgets_values` array.

- Non-breaking: old code ignores `widgets_values_named`, new code prefers it.
- Prerequisite: `widgetValueStore` infrastructure (DrJKL PR #8594, **merged**).
- Resolves the root cause of S17.WV1 (positional `widgets_values` breaks on
  node-def changes) by providing a named alternative.

### Phase 2 — Unified Format Save

Save workflows directly in the unified format structure (spec + layout +
metadata). Promoted inputs/outputs move from `graph.extra.linearData` into the
spec. Single payload on save — not two.

### Phase 3 — Deprecate graphToPrompt Monkey-Patching ⚠️ CRITICAL (S6.A1)

The stored format must be deterministic without runtime transformations.
Serialization moves to **on-change** (stored values always reflect resolved
state, not compile-time snapshots). Custom nodes that monkey-patch
`graphToPrompt` need a migration path.

This is the direct resolution path for **S6.A1** (blast radius #1, 23,604★,
15 repos). The UWF plan and our v2 extension API attack S6.A1 from different
angles — they must coordinate:
- UWF Phase 3: makes `graphToPrompt` deterministic so patching is unnecessary.
- v2 API: provides `node.on('beforeSerialize', e)` / `app.on('beforePrompt', e)`
  so extensions can still intercept serialization without monkey-patching.

---

## Virtual Wiring Resolution (save-time requirement)

`WorkflowSpec` must be independently executable without layout context.
At save time the frontend must materialize visual-only constructs as real edges:

| Construct | Current behavior | Required |
|---|---|---|
| Get/Set nodes | Resolved at `graphToPrompt` time by KJNodes/cg-useeverywhere patch | Resolve into real `spec.edges` at save time |
| Reroutes | Visual routing; resolved at runtime | Collapse to direct edges in spec |
| cg-useeverywhere auto-connections | Resolved in `graphToPrompt` patch | Materialized as explicit edges in spec |

These are the **exact patterns in S6.A1 and S9.SG1** — the two
highest-blast-radius patterns in the DB.

---

## Patterns That Must Be Resolved at Save/Edit Time (not queue time)

From the 3/26 meeting (each maps to existing patterns or open gaps):

| Pattern | UWF requirement | DB cross-ref | v2 API coverage | Gap? |
|---|---|---|---|---|
| Dynamic prompts | Resolve at save/edit time, not `graphToPrompt` | `widget.on('beforeSerialize', e)` (D5) is queue-time only | `dynamicPrompts.v2.ts` fires at `context='prompt'` — fine for UWF Phase 1/2; Phase 3 needs save-time resolve | **PARTIAL GAP** — see I-UWF.4 |
| Global seed sync | Seed values rewritten across multiple nodes → explicit values in spec | S4.W4 (`widget.options.values` mutation), no multi-node sync pattern in DB | No v2 API for cross-node value sync | **GAP** — see I-UWF.5 |
| Old switch nodes | Conditional execution that changes graph structure | S6.A1 (graphToPrompt patching is how they work today) | No first-class conditional model in v2 or ECS | **GAP** — out of scope, noted |
| Load 3D model | Captures frame buffer on frontend; needs headless alternative | `widget.on('beforeSerialize', async e)` supports async capture | v2 async `beforeSerialize` is the right hook; headless path TBD | **PARTIAL** |

---

## Intersection with Existing Tasks

### S6.A1 / I-PG.B2
Phase 3 of UWF is the `graphToPrompt` deprecation we already plan. I-PG.B2
asks us to classify S6.A1 as ECS-native | strangler-bridge | unchanged-legacy.
UWF Phase 3 resolves it via **save-time materialization**, not via ECS dispatch.
This is a third classification: **UWF-resolved**. I-PG.B2 must account for this.

### S17.WV1 / I-N5.2
`widgets_values_named` (UWF Phase 1, Austin PR #10392) is the direct fix for
S17.WV1. The pattern and the fix were already tracked; UWF confirms the
official roadmap item and owner.

### I-WS (lazy serialization) / D7
`widgetValueStore` (PR #8594, merged) is the infrastructure UWF Phase 1 builds
on. I-WS.3 (lazy-on-access value getter) and D7's three-tier persistence model
must be compatible with `widgets_values_named` — named values and the
per-widget `beforeSerialize` event need to share the same resolution path.

### D5 `beforeSerialize` / context flag
The UWF plan's Phase 3 "on-change serialization" means `context='workflow'`
must now produce a spec-compatible payload, not just a LiteGraph workflow JSON.
The `context` flag in `WidgetBeforeSerializeEvent` and `NodeBeforeSerializeEvent`
may need a new value (`'spec'` or `'unified-format'`) to distinguish the new
save path. Currently only: `'workflow' | 'prompt' | 'clone' | 'subgraph-promote'`.

### DEP3 / DEP4
UWF Phase 3 gives DEP3 (remove monkey-patching docs) and DEP4 (migrate core
extensions) a concrete prerequisite: UWF Phase 3 must land BEFORE we can
truthfully tell extension authors they no longer need to patch `graphToPrompt`.

---

## New Gaps Surfaced (not covered by existing v2 plan)

### GAP-UWF-1: No `app.on('beforePrompt')` event
Extensions that intercept `graphToPrompt` for cross-node transformations (seed
sync, virtual node resolution) need a replacement that fires before the unified
spec is submitted. The v2 API has `node.on('beforeSerialize')` (per-node) but
no app-level "before the entire workflow spec is built" hook. This is the
structural replacement for S6.A1 patching.

### GAP-UWF-2: Virtual wiring resolution API
No v2 API for extensions to declare that their nodes are "virtual" in the spec
sense (layout-only, not in `spec.edges`). The existing `isVirtualNode=true`
flag (S8.P1) tells the canvas to skip the node in `graphToPrompt`, but UWF
Phase 3 needs a first-class declaration so the frontend knows how to resolve
virtual wiring at save time without patching.

### GAP-UWF-3: Cross-node value sync (global seed)
No v2 API for expressing that multiple widgets share a value (global seed
sync). Extensions currently rewrite widget values in the `graphToPrompt` patch.
UWF Phase 3 requires this be expressed as explicit named values in the spec.

### GAP-UWF-4: `context` enum completeness in D5
`WidgetBeforeSerializeEvent.context` only covers `'workflow' | 'prompt' | 'clone' | 'subgraph-promote'`.
UWF Phase 2 introduces a third save path (unified-format). Need to decide:
(a) `'workflow'` is redefined to mean "unified format save" once UWF Phase 2
lands, (b) add `'unified-format'` as a new context value, or (c) the event
fires with `'workflow'` regardless and the distinction is below the API layer.

---

## Dependencies Table (from page)

| Item | Owner | Status |
|---|---|---|
| `widgets_values_named` serialization | Austin Mroz (PR #10392) | Open, changes requested by DrJKL |
| `widgetValueStore` infrastructure | DrJKL (PR #8594) | **Merged** |
| Deprecation plan for `graphToPrompt` monkey-patching | Frontend team | Agreed in meeting, not started |

---

## I-UWF.6.F4 — Cross-Node Value Sync: Responsibility Classification (2026-05-08)

> Added by I-UWF.6.F4. Based on F3 survey (R8 evidence + database.yaml grep) and
> the GAP-UWF-3 finding above.

### F3 Survey findings recap

The cross-node seed sync pattern exists in **two distinct forms** in the wild:

| Form | Repo | Mechanism | DB pattern |
|------|------|-----------|-----------|
| **Global seed event** | yolain/ComfyUI-Easy-Use | Patches `queuePrompt`; builds `seed_widgets` map of all seed widget positions; fires `easyuse-global-seed` CustomEvent; listener walks `graph._nodes_by_id` and rewrites each seed widget value | S6.A1 (graphToPrompt patch) + S4.W4 (widget.value write) |
| **Control-after-generate propagation** | yolain/ComfyUI-Easy-Use, native core | `control_after_generate` widget drives seed increment/randomize on the *same node* after each run; Easy-Use extends this to linked nodes | S4.W4 (widget.value write), S2.N14 (onWidgetChanged) |
| **XY plot value sync** | yolain/ComfyUI-Easy-Use | Writes widget values across nodes for grid runs — each cell in the XY matrix sets widgets on multiple nodes before queuing | S6.A1 (graphToPrompt patch) |

No distinct DB pattern exists for cross-node seed sync — it's a *usage mode* of S6.A1 + S4.W4 together, not its own surface. Blast radius is subsumed by S6.A1 (br 7.02, rank #1).

### Classification: Whose responsibility?

**Verdict: UWF's problem, not v2 extension API's problem — with one partial exception.**

Reasoning:

1. **The root mechanism is `graphToPrompt` patching (S6.A1).** Extensions sync seeds by intercepting serialization and rewriting widget values at queue time. UWF Phase 3 eliminates this mechanism entirely via save-time materialization. Once the spec is the payload, the "rewrite widget values at queue time" approach has no attach point.

2. **UWF Phase 3 requires explicit named values.** The seed value an extension writes must be present in `spec.inputs[widgetName]`. This is only achievable if:
   - (a) The ECS World holds the rewritten value (i.e., the extension mutated the widget *before* save-time serialization, not at queue time), or
   - (b) UWF provides a "pre-submit transform" hook where cross-node rewrites can be expressed as spec mutations.

3. **The `app.on('beforePrompt')` gap (GAP-UWF-1) is the correct v2 API surface for this.** Cross-node transforms that must fire *before* the spec is submitted are exactly what an app-level hook provides. The v2 `node.on('beforeSerialize')` hook is per-node and fires too late for cross-node rewrites.

4. **`control_after_generate` on a single node** is already v2's problem — it's a widget value that changes after execution, not at serialize time. This maps to `widget.on('valueChange')` + the ECS `SetWidgetValue` command. It does NOT require a cross-node sync API.

### What v2 needs (and what it doesn't)

| Concern | v2 scope? | Resolution path |
|---------|-----------|----------------|
| Single-node seed increment (control_after_generate) | **YES** — per D5 `valueChange` | `widget.on('valueChange', e)` + `widget.setValue()` from execution result handler |
| Cross-node seed rewrite at submit time | **NO for v2 Phase A** | Blocked on GAP-UWF-1 (`app.on('beforePrompt')`). If that hook lands, this is solved; if not, this remains UWF Phase 3 territory |
| Seed map persistence (save which nodes are seed nodes) | **NO** | UWF spec's `spec.inputs` naming makes seed widgets first-class named fields — no special extension API needed |
| XY plot cross-node value injection | **NO** — architectural | Needs a "run modifier" API that's out of Phase A scope; defer to post-UWF Phase 3 |

### D14 candidacy

**Not substantial enough for a standalone ADR.** The classification is clear: cross-node sync is GAP-UWF-1 territory, resolved when/if `app.on('beforePrompt')` lands (I-UWF.4.F2 owns that decision). No new ADR needed. Add a cross-reference in D6 §Open Questions pointing here.

**Action item**: I-UWF.4.F2 (write options analysis for `app.on('beforePrompt')`) is the correct follow-on — that decision would close the cross-node sync gap for v2 users who can't wait for UWF Phase 3.
