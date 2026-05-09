---
source_url: file://ComfyUI_frontend/docs/adr/0007-node-execution-output-passthrough-schema.md
date_accessed: 2026-05-08
ingestion_task: I-NEW.2
status: ingested
---

# ADR 0007 — NodeExecutionOutput Passthrough Schema (summary)

## Provenance

- **Source path:** `ComfyUI_frontend/docs/adr/0007-node-execution-output-passthrough-schema.md`
- **Date accessed:** 2026-05-08
- **ADR status (in source):** Accepted (date 2026-03-11). Unlike ADR 0006 (Pending), this one is a finalized decision.

## What ADR 0007 actually says

`NodeExecutionOutput` is the wire-format envelope returned by the backend when a node finishes executing. The Zod schema (`zOutputs`) declares well-known keys (`audio`, `images`, `video`, `animated`, `text`) and uses `.passthrough()` so unknown keys (`gifs`, `3d`, `meshes`, `point_clouds`, …) flow through without validation. This passthrough is **deliberate**: ComfyUI's plugin architecture lets custom nodes invent arbitrary output keys at the backend, and the frontend must accept anything. The ADR documents why a stricter `.catchall(z.array(zResultItem))` was rejected: TypeScript's index-signature inference for `.catchall()` collides with the explicit `animated: boolean[]` and `text: string | string[]` fields (those types do not extend `ResultItem[]`), and TypeScript has no syntax for "rest index signature."

The decision is fourfold: (1) keep `.passthrough()`, (2) use the exported `resultItemType` Zod enum inside a shared `isResultItem` guard (the guard is *stricter* than the Zod schema — it requires `filename` and `subfolder` as strings, because a `ResultItemImpl` cannot construct a preview URL without them), (3) accept the `unknown[]` cast at the iteration boundary as honest, and (4) centralize `NodeExecutionOutput → ResultItemImpl[]` conversion into one shared utility (`parseNodeOutput` / `parseTaskOutput` in `src/stores/resultItemParsing.ts`) to kill duplication across `flattenNodeOutput.ts`, `jobOutputCache.ts`, and `queueStore.ts`.

## Key correction / nuance

The title sounds like it is about output **schema design**, but the ADR is really about a **TypeScript type-system constraint forcing a runtime-validation pattern**. The "schema is open" decision was already implicit in the backend; ADR 0007 is the frontend's admission that `.passthrough()` plus a manually-maintained `isResultItem` guard is the least-bad way to live with TypeScript's lack of exclusive index signatures. Two non-obvious wrinkles that surprise an outside reader: (a) the manual guard is **stricter** than the Zod schema it borrows from, so the two can drift silently if Zod is updated without touching the guard; (b) `animated` and `text` cannot be removed from `zOutputs` even though they break `.catchall()` — `animated` is consumed by `isAnimatedOutput()` in `litegraphUtil.ts`, and `text` would otherwise fail `zExecutedWsMessage` validation entirely. Output-schema "cleanup" is **blocked by the wire format**, not by frontend code style.

## Intersection with our work

- **S15.OS1 (dynamic output mutation vs schema-declared outputs)** — partial collision, different layer. S15.OS1 tracks extensions calling `node.addOutput()` / mutating `node.outputs[i].type` at runtime on the *graph editor* side (e.g. `yorkane/ComfyUI-KYNode` python-editor). ADR 0007 is about the *execution result* side (what comes back over websocket). They share a philosophy ("outputs are open-ended") but operate on different objects: S15.OS1 mutates `LGraphNode.outputs` (slot definitions), ADR 0007 governs `NodeExecutionOutput` (per-execution payload). Reading ADR 0007 makes the case for `widget-api-thoughts.md`'s "force schema declaration" stance **harder**, because it confirms the backend is committed to extensible per-execution payloads — the execution-side openness is load-bearing for the plugin ecosystem.
- **widget-api-thoughts.md §"Output System Change"** — direct tension. The note proposes "force declaration: declare outputs in the node schema, explicitly add the output types to the schema." ADR 0007 says explicitly: "Any future attempt to make the schema stricter must account for this extensibility requirement." The widget-api-thoughts proposal must therefore be scoped to **slot declarations** (graph-editor side, S15.OS1) and cannot reach into execution outputs. If our v2 API enforces schema-declared *output slots*, it must still pipe arbitrary keys from the *execution payload* into whatever consumer reads them — schema-declared slots ≠ schema-validated payloads.
- **I-WS (lazy widget serialization)** — only adjacent. Both ADRs (0006, 0007) live near "what is the canonical wire shape vs runtime shape" but ADR 0007 does not concern widget serialization. The cross-reference is methodological: ADR 0007 picked "centralize parsing into one utility, accept honest `unknown` at the boundary" — a pattern I-WS.3 may want to mirror for widget serialization (single `getSerializedValue()` boundary, honest typing for extension-defined widgets we do not own).
- **R7 touch-points** — does not add a new pattern. S15.OS1 stays as-is; this ADR sharpens the v2_replacement reasoning by foreclosing the "validate the payload too" option.

## Open questions raised

1. **Where does `parseNodeOutput` live in the v2 API surface?** ADR 0007 places it in `src/stores/resultItemParsing.ts`. If the public extension API needs to expose "give me the typed outputs of this node execution," is that re-exported as a typed read API (e.g. `world.queryNodeOutput(execId)`), or do extensions still get raw `NodeExecutionOutput` and run their own `isResultItem` guard? The latter forces every custom-node author to know about the `unknown[]` boundary.
2. **Custom output-key registration.** Custom nodes invent keys (`gifs`, `3d`, `meshes`). Today the frontend has no registry of which keys mean what. Should the v2 extension API offer a `registerOutputType(key, validator, renderer)` so passthrough keys become first-class without re-opening the Zod-schema discussion? This is a candidate I-NEW item, not addressed here.
3. **Drift between Zod schema and manual `isResultItem` guard.** ADR 0007 calls this out as a "negative consequence." Our v2 API should not inherit this drift risk — if extensions declare output-item shapes, the validator and the schema should be derived from one declaration, not maintained in parallel.
4. **Conflict with widget-api-thoughts §Output System Change.** The "force schema declaration" axis is partially blocked by ADR 0007 (execution payloads stay open). A D-decision is needed to scope the proposal to slot declarations only, or to design a parallel "declared output keys" mechanism that coexists with passthrough payloads. Track as candidate **D-OS1** (output schema split: declaration vs payload).
5. **Does the `unknown[]` cast survive the ECS migration?** Per ADR 0008, components are plain data. If `NodeExecutionResult` becomes a component, the `unknown[]` lives inside the component shape — systems reading it still need the shared guard. The boundary moves but does not disappear.
6. **Hook-API surface for "output arrived" events.** Today extensions hook execution results indirectly (e.g. patching prototypes or watching stores). A v2 hook like `onNodeExecutionResult(node, output)` would land squarely in this passthrough territory — the hook signature must decide whether `output` is typed-known-keys (`images?`, `audio?`, …) plus a typed `extras: Record<string, unknown>`, or a single `NodeExecutionOutput` blob. ADR 0007's centralized parser is the natural place to fork into both shapes.
