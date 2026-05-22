# <a href="/decisions/D20-id-type-convergence" class="wiki-link">D20</a> — Identity type convergence

**Status**: ACCEPTED — 2026-05-14 (verdict: keep five branded ID types; demote three to "advanced API"; expose `node.equals(other)` and `node.id` as the 90%-case affordance)

## Context

`@comfyorg/extension-api` currently exposes five branded identity types:

| Type | Domain | Scope |
|---|---|---|
| `NodeEntityId` | ECS world | per workflow instance |
| `WidgetEntityId` | ECS world | per workflow instance |
| `SlotEntityId` | ECS world | per workflow instance |
| `NodeLocatorId` | LiteGraph subgraph traversal | stable across re-render |
| `NodeExecutionId` | Backend <a href="/api-docs/execution" class="wiki-link">execution</a> correlation | per prompt submission |

Design-review rows #3 ("Identity Complexity — Encapsulation") and #8
("<a href="/glossary#entity" class="wiki-link">Entity</a> ID Exposure — Too Complicated") flagged this as leakage:

> "It seems wrong we would need world entity IDs and all the three-state
> internal/legacy node IDs also exposed. This is far too complicated to
> be leaking out of the interface boundaries." — design-review row #8

CB's design goal:

> "The extension author should get widget/node handles in the hook
> callbacks or at registration time. Therefore, they should never need to
> understand or use: Node ID (LiteGraph), Node Entity ID (ECS), Node
> Locator ID (<a href="/glossary#subgraph" class="wiki-link">Subgraph</a> naive UI position), Node Execution ID (Subgraph
> path-based ID). None of the methods they use should be interacting
> directly with mutations APIs that internally use IDs."

Austin's pushback:

> "Sounds real nice in theory, but I think it'd be unachievable in
> practice. Any custom node that:
>   - touches other nodes
>   - parses websocket events
>   - interacts with links
> Will need to interact with this external information."

DrJKL: "I think we can solve most cases without it."

W2F-1 re-audit (research/meta/sourcegraph-mcp-coverage-investigation.md)
shows the actual ecosystem touchpoints: of the 240+ evidence rows in the
touch-points DB, **only S14.ID1 (<a href="/api-docs/nodelocatorid" class="wiki-link">NodeLocatorId</a> real usage) had to be
re-classified from "rare" to "still rare"** in the bulk-clone sweep. Two
real call sites total across 138 repos — a vendor type re-declaration
(willie-comfy-frontend) and a cookiecutter template. Conversely, the
backend `execution_*` event vocabulary (S5.<a href="/axioms#a3-refs" class="wiki-link">A3</a>) flows
`NodeExecutionId`-shaped strings through `api.addEventListener('executed', …)`
to dozens of consumers (show_text, show_json, previewAny, KJNodes, …).

The asymmetry matters: extension authors **receive** ID-shaped strings
from event payloads constantly; they **construct or compare** them rarely.

## Decision

Adopt a **2-tier identity model** with the following shape:

### Tier 1 — implicit (the 90% case)

Authors work entirely through `NodeHandle` / `WidgetHandle` /
`SlotInfo`. Identity is opaque:

```ts
node.id          // -> string (opaque; do not parse)
node.equals(other) // -> boolean (handle-level identity comparison)
widget.id        // -> string (opaque)
widget.equals(other)
slot.id          // -> string (opaque)
```

The `id` accessor returns the underlying branded ID **as a plain string**
at the type level. The branded type is preserved at runtime (it IS the
underlying string) but the public surface narrows it to `string` so that
authors never have to import a brand to type a local variable.

### Tier 2 — explicit (the 10% case)

For the genuine cross-cutting use cases Austin called out — websocket
parsing, link manipulation, cross-node touch, workflow-state
restoration — the branded types remain available, but:

1. **`NodeLocatorId` and `NodeExecutionId` stay public** — they cross
   real boundaries (workflow JSON ↔ subgraph traversal; backend ↔
   frontend). Type-guards and parsers (`isNodeLocatorId`,
   `parseNodeExecutionId`, `createNodeLocatorId`, …) stay public.
2. **`NodeEntityId`, `WidgetEntityId`, `SlotEntityId` are demoted** to
   `@internal` JSDoc. They remain `export type` in `./node` and
   `./widget` so the package's own internal modules can still import
   them, but the package barrel `index.ts` STOPS re-exporting them.
   TypeDoc is configured to filter `@internal` from the rendered docs.

### Convergence rationale

- Five separate types remain inside the runtime — the ECS <a href="/glossary#world" class="wiki-link">World</a> requires
  cross-kind type safety, and that's invariant.
- Three of those five (`*EntityId`) are leakage of the runtime's
  storage scheme; they have no meaning to extension authors and were
  never received from event payloads. Drop from public.
- Two (`NodeLocatorId`, `NodeExecutionId`) are protocol-boundary
  identifiers — they are received from workflows on disk and from
  websocket frames respectively. They MUST stay public because no
  handle exists for an entity the author hasn't seen yet (a freshly
  parsed workflow, a websocket message about a node that's currently
  off-canvas).

## Consequences

### Public-API surface impact

- `index.ts` removes `NodeEntityId`, `WidgetEntityId`, `SlotEntityId`
  from the `./node` and `./widget` re-exports.
- `NodeHandle.entityId` and `WidgetHandle.entityId` are **renamed to
  `id`** with return type narrowed to `string`. The runtime value is
  unchanged (still the branded string).
- `SlotInfo.entityId` → `SlotInfo.id`, return type `string`.
- `node.equals(other: NodeHandle): boolean` and the corresponding
  `widget.equals` / `slot.equals` are added (one-line implementations:
  return `this.id === other.id`).
- `NodeLocatorId`, `NodeExecutionId`, and their helpers
  (`isNodeLocatorId`, `parseNodeLocatorId`, `createNodeLocatorId`,
  `isNodeExecutionId`, `parseNodeExecutionId`, `createNodeExecutionId`)
  remain public unchanged.

### Author ergonomics

Tier 1 (the 90% case):

```ts
defineNode({
  nodeType: 'MyNode',
  setup({ node }) {
    onNodeMounted(() => console.log('mounted:', node.id))
    node.on('connected', e => {
      if (node.equals(e.fromNode)) { /* self-loop */ }
    })
  }
})
```

Tier 2 (explicit ID work — websocket parsing example):

```ts
import { parseNodeExecutionId } from '@comfyorg/extension-api'

api.addEventListener('executed', e => {
  const execId = parseNodeExecutionId(e.detail.node)  // typed
  // ...
})
```

### Migration impact for v1 / pre-<a href="/decisions/D20-id-type-convergence" class="wiki-link">D20</a> v2 consumers

- Pre-v1.0; only `src/extensions/core/*.v2.ts` consume the renamed
  fields. Will be updated atomically with this ADR's implementation
  (PR #12142 force-push).
- v1 path uses raw LiteGraph node IDs and is unaffected by <a href="/decisions/D20-id-type-convergence" class="wiki-link">D20</a>.

### Test framework impact

- `I-TF.8.*` behavior triplets that assert on `entityId` need updating
  to `id`. Mechanical sed.

### Documentation

- Migration guide stub (`ComfyUI_frontend/docs/extensions/migration-v1-to-v2.md`)
  must include a "Working with identity" section covering the Tier 1 /
  Tier 2 split.

## Alternatives considered

| Option | Pro | Con | Verdict |
|---|---|---|---|
| **Status quo — expose all 5 brands** | No work | Design-review rejected; pollutes the surface; W2F-1 confirms 3 of 5 have ~zero real usage | Rejected |
| **Single `NodeId` opaque string everywhere** | Maximally simple | Loses type-safety at protocol boundaries (workflow JSON, websocket); breaks Austin's three call sites | Rejected |
| **Tier 1 + Tier 2 split (chosen)** | Solves the 90% case ergonomically; preserves the 10% advanced surface; matches the ecosystem evidence (W2F-1) | Two layers to learn; some authors may grep for `NodeEntityId` and not find it | **Accepted** |
| **Defer the decision to v2.1** | Lowest immediate risk | Ships a known-bad surface in v0.1.0; harder to remove later than to add later | Rejected |

## Implementation plan

| Step | Action | Owner | Verification |
|---|---|---|---|
| 1 | Edit `src/extension-api/index.ts` — remove `NodeEntityId`, `WidgetEntityId`, `SlotEntityId` from the re-export blocks | this session (P1) | barrel diff |
| 2 | Edit `src/extension-api/node.ts` — change `interface NodeHandle { readonly entityId: NodeEntityId }` to `readonly id: string` + add `equals(other: NodeHandle): boolean` | this session (P1) | type compiles |
| 3 | Edit `src/extension-api/widget.ts` — same rename + `equals` addition for `WidgetHandle` | this session (P1) | type compiles |
| 4 | Edit `src/extension-api/node.ts` — same rename for `SlotInfo` | this session (P1) | type compiles |
| 5 | Edit `src/services/extension-api-service.ts` — rename internal `entityId` accessors to `id`, implement `equals` | this session (P1) | runtime tests pass |
| 6 | Update `src/extensions/core/*.v2.ts` and `src/extension-api/__tests__/*` and `src/extension-api/__contracts__/*` to use `.id` | this session (P1) | all tests pass |
| 7 | Append `@internal` JSDoc to the three demoted brand types in `./node` and `./widget` | this session (P1) | TypeDoc rebuilds without them |
| 8 | Migration guide stub: add "Working with identity" section | follow-up | manual |
| 9 | Force-push PR #12142 with `--force-with-lease` and PR comment summarizing <a href="/decisions/D19-vueextension-disposition" class="wiki-link">D19</a> + D20 | this session (P1) | PR diff visible |
| 10 | Refresh dashboard JSON (DASH-REFRESH-1) | this session (P2) | `/api-docs` no longer lists the three demoted brands |

## References

- design-review-12142.md rows #3 and #8 (the open-research items this ADR closes)
- Audit: `research/architecture/public-api-surface-audit-2026-05-14.md` §F2
- W2F-1 re-audit: `research/meta/sourcegraph-mcp-coverage-investigation.md` (S14.ID1 evidence supports demoting `*EntityId`; S5.<a href="/axioms#a3-refs" class="wiki-link">A3</a> evidence supports keeping `NodeExecutionId`)
- <a href="/decisions/D3.5-reactive-dispatch-and-scope-alignment" class="wiki-link">D3</a>.4 — events and commands reconciled (handles ARE the command/query API; this ADR strengthens that by removing the branded-ID escape hatch from the public surface)
- <a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> — widget state categories (handles own the state; identity is opaque)
- <a href="/decisions/D18-pure-functions-loader-registration" class="wiki-link">D18</a> — pure functions + loader registration (orthogonal: <a href="/decisions/D18-pure-functions-loader-registration" class="wiki-link">D18</a> changes the *registration mechanism*; D20 changes the *identity surface*)
- AGENTS.md "Decision propagation rules" — D20 must reach (a) commit on PR #12142, (b) this ADR, (c) dashboard JSON
