---
source_url: https://www.notion.so/3316d73d3650811587abd9c611e456dc
date_accessed: 2026-05-08
page_last_edited: 2026-04-29
authors: Matt Miller, Kishore Shimikeri
status: Draft
related_tasks: I-UWF.9
related_decisions: D5, D7, I-UWF.4, I-UWF.5
---

# Tech Spec: Unified Workflow Format — Backend Data Model

**Status:** Draft | **Authors:** Matt Miller, Kishore Shimikeri | **Date:** 2026-03-28
**Linear:** COM-301
**Parent RFCs:** App Mode Backend RFC, Canonical Workflow Source and Run Snapshot Model

## Core goal

One JSON artifact that serves editing, storage, and execution. No more separate save format and API format.

## Four distinct objects

| Object | Purpose | Storage |
|--------|---------|---------|
| **WorkflowSpec** | Canonical semantic source: nodes, edges, promoted inputs, defaults | Persisted in unified format JSON (versioned) |
| **WorkflowLayout** | Editor-only: positions, groups, reroutes, colors | Stored alongside spec; backend never parses it |
| **ExecutionPrompt** | Compiled runnable artifact for ComfyUI (current API format) | Derived at execution time; never stored as part of unified format |
| **RunSnapshot** | Immutable record of one execution's inputs | Stored per job |

**Key rule:** These never collapse into each other. Layout is not workflow meaning. ExecutionPrompt is not authoring truth.

**WorkflowLayout is fully opaque to the backend.** Visual constructs (Get/Set nodes, reroutes, grouping) live in layout only. Their resolved effects (e.g. Get/Set → real edges) are captured in WorkflowSpec. The spec always contains resolved, executable truth.

## Versioning boundaries

| Change type | Examples | Effect |
|-------------|---------|--------|
| Structural | Add/remove nodes, change edges, change promoted input defs | New workflow version |
| Binding-only | Change prompt text, seed, uploaded image, steps, model | New RunSnapshot only (NOT new version) |
| Layout-only | Move nodes, resize, recolor, regroup | No version change |

## Unified format JSON structure

```json
{
  "version": 2,
  "spec": {
    "nodes": {
      "3": {
        "class_type": "KSampler",
        "inputs": {
          "seed":  { "value": 123,  "link": null },
          "steps": { "value": 20,   "link": null },
          "cfg":   { "value": 7.5,  "link": null },
          "model": { "value": null, "link": [1, 0] }
        },
        "outputs": [{ "name": "LATENT" }]
      }
    },
    "edges": [
      { "from": ["1", 0], "to": ["3", "model"] }
    ],
    "promoted_inputs": [
      { "node_id": "3", "input_name": "seed",  "display_name": "Seed" },
      { "node_id": "5", "input_name": "text",  "display_name": "Prompt" }
    ],
    "promoted_outputs": ["9", "12"]
  },
  "layout": { "_comment": "Backend ignores this entirely -- frontend-owned" },
  "metadata": {
    "name": "My Upscaler App",
    "description": "4x upscale with RealESRGAN",
    "node_versions": { "KSampler": "1.0.0" }
  }
}
```

**Unchanged from current API format:**
- Node IDs as string keys
- `class_type` per node
- Input names as keys (not positional arrays)
- Link references as `[nodeId, outputIndex]`

## New fields vs current API format

| Field | Purpose | Why needed |
|-------|---------|-----------|
| `version` | Format version number | Migration path + backward compat detection |
| `spec.promoted_inputs` | Which inputs are exposed in app mode | Required for headless execution, MCP tool generation, app-config endpoint |
| `spec.promoted_outputs` | Which output nodes to display | Filtering results in app mode and API responses |
| `spec.edges` | Explicit connection list | Currently embedded inline in inputs. Separate array enables graph traversal and validation |
| `spec.nodes.{id}.outputs` | Output type declarations per node | Currently not stored. Needed for edge validation and future type checking |
| `layout` | Positions, groups, reroutes, colors | Unified format carries both so one artifact serves editing and execution |
| `metadata` | Name, description, node_versions | Currently scattered or not stored at all |

## Restructured: values and links separated

**Before (current API format):** Mixed widget values and connections — can't tell them apart without node type definition.

```json
"inputs": { "seed": 123, "model": ["1", 0] }
```

**After (unified format):** Every input has explicit `value` and `link` fields.

```json
"inputs": {
  "seed":  { "value": 123,  "link": null },
  "model": { "value": null, "link": [1, 0] }
}
```

Backend can distinguish value vs connection without any type lookup.

## Key design decisions

1. **Named inputs, not positional arrays.** Eliminates widget shift bugs. Language-portable.
2. **Inputs do not embed types.** Spec stores values and links only. Types resolved from `object_info` at execution/query time. Backend always has node definitions (all cloud nodes must be registered).
3. **Edges are explicit.** No implicit link arrays. `from: [nodeId, outputIndex]`, `to: [nodeId, inputName]`.
4. **`class_type` is a free-form string.** Matches Python class name. No namespace collision protection currently. `node_versions` in metadata provides version tracking. Future: registry-qualified names (`publisher/node_name`).
5. **Promoted inputs use input names, not indices.** Backend resolves types from `object_info` without frontend help.

## ExecutionPrompt (derived, not stored)

Derived from `spec.nodes` + `spec.edges` + runtime overrides at execution time. Shape is the current ComfyUI API format (flat node dict). May be cached.

## RunSnapshot (immutable execution record)

Created per execution. Enables exact reruns and provenance.

```json
{
  "workflow_id": "abc-123",
  "spec_version": 3,
  "execution_prompt": { "...derived API format..." },
  "overrides": {
    "3.seed": 456,
    "5.text": "a cat astronaut in space"
  },
  "execution_mode": "frontend",
  "asset_manifest": [
    { "input_name": "image", "node_id": "10", "asset_id": "asset-xyz", "filename": "input.png" }
  ],
  "created_at": "2026-03-28T18:00:00Z"
}
```

## Validation rules

### On save
1. Schema validation — well-formed JSON, required fields (`version`, `spec.nodes`, `spec.edges`)
2. Node `class_type` exists — every node references a class_type known to the backend
3. Named inputs well-formed — non-empty string keys, values of expected primitive types
4. Promoted input validity — reference valid `node_id` + `input_name` pairs in the spec
5. Edge consistency — edges reference nodes/outputs/inputs that exist

### On execute (run by ID with overrides)
1. Type validation — override values match expected type from `object_info`
2. Promoted-only overrides — callers can only override promoted inputs, not arbitrary node values
3. Required inputs present — all required inputs have either a default or an override

### Not validated
- Custom nodes with ill-defined dynamic inputs that only resolve at prompt time

## Dependencies

| Dependency | Owner | Status |
|-----------|-------|--------|
| `widgets_values_named` (bridge from positional to named inputs) | Austin Mroz (PR #10392) | Open, changes requested by DrJKL |
| `widgetValueStore` infrastructure | DrJKL (PR #8594) | Merged |
| Backend `object_info` type resolution | TBD | Approach not yet confirmed |
| Frontend deprecation of `graphToPrompt` monkey-patching | Frontend team | Agreed in meeting, not started |

## Implications for v2 extension API design

### D5 / EVT2 — `beforeSerialize` event
The backend spec's "named inputs, not positional arrays" rule confirms that `WidgetBeforeSerializeEvent` payloads must identify widgets by **name**, not index. The current D5 design is correct — `event.value` is the named widget's current value; the framework writes the serialized result to the named slot.

### D7 / I-WS.3 — widget serialization model
The `{ "value": ..., "link": ... }` input shape means:
- A widget's serialized value maps to `input.value` (when `input.link === null`).
- Widgets that are connected to another node's output → `input.value` is `null` in the spec (the link carries the value).
- I-WS.3 (lazy-on-access serialization) must produce values compatible with this shape. `widgets_values_named` (PR #10392) is the in-progress bridge.

### I-UWF.4 — app-level serialization hook
The spec makes clear that `graphToPrompt` monkey-patching (S6.A1) is replaced by UWF Phase 3's save-time materialization — virtual node resolution (reroutes, Get/Set) happens at save time into `spec.edges`, not at queue time. The v2 extension API does **not** need to replicate the full `graphToPrompt` interception surface; it only needs:
- Per-widget `beforeSerialize` (already in D5) for value overrides.
- An app-level `beforePrompt` hook (I-UWF.4) for cross-node transforms that cannot be per-widget — but the spec limits these to *override* promoted inputs only (point 2 in "On execute" validation), not arbitrary node mutations.

### I-UWF.5 — virtual node registration
The spec explicitly states: "Get/Set nodes, reroutes, and grouping exist in layout only. Their real effects are captured as real edges in the WorkflowSpec." This means virtual node resolution is a **backend/save-time concern**, not a per-extension concern. I-UWF.5 (first-class virtual-node declaration) may be scoped down: extensions don't need to register resolution logic if the save path handles it.

### PKG2 / public types
`promoted_inputs: [{ node_id, input_name, display_name }]` is the canonical shape for app-mode input promotion. If `NodeHandle` ever exposes a `promoteInput(name, displayName)` method (out of scope for Phase A), this is the target shape.

### I-TF.3 — test harness
The harness must simulate both the old flat-API-format input (positional `widgets_values`) and the new `{ value, link }` named-input format when testing widget serialization. The RunSnapshot `overrides` pattern (`"3.seed": 456`) is a useful shape for the harness's "override promoted input" test case.
