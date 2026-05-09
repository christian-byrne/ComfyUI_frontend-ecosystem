# v2 Extension API — Touch-Point Database

This directory is the **canonical compatibility-surface map** for the upcoming
v2 extension API redesign. Every API surface that real-world ComfyUI
extensions touch is enumerated here, weighted by usage frequency and ecosystem
star count, with citations to verifiable evidence (file paths and line
numbers in real custom-node repos).

It exists so the v2 redesign can answer two questions deterministically:

1. **What will silently break?** — every entry maps to a v2 replacement (or to
   an explicit "deprecated, no replacement" decision).
2. **What does the v2 test framework need to cover?** — every entry maps to
   ≥1 test target so the test floor reflects real extension shapes.

## Artifacts

| File | Role |
|---|---|
| [`touch-points-plan.md`](./touch-points-plan.md) | Methodology, schema, surface-family enumeration, severity rubric |
| [`touch-points-database.yaml`](./touch-points-database.yaml) | Source of truth — 52 patterns × 15 surface families with evidence rows |
| [`touch-points-star-cache.yaml`](./touch-points-star-cache.yaml) | GitHub star/fork/last-commit snapshot for every cited repo (drift detection) |
| [`touch-points-rollup.yaml`](./touch-points-rollup.yaml) | Computed blast-radius scores per pattern (sorted) — the prioritization output |
| [`scripts/fetch-stars.sh`](./scripts/fetch-stars.sh) | Refresh the star cache via `gh api` |
| [`scripts/rollup-blast-radius.py`](./scripts/rollup-blast-radius.py) | Recompute blast radius from database + star cache |
| [`scripts/add-evidence.py`](./scripts/add-evidence.py) | Idempotently merge new evidence rows / new patterns into the database |

## The 15 surface families

| Family | One-liner |
|---|---|
| **S1** | `ComfyExtension` lifecycle hooks (`init`, `setup`, `nodeCreated`, `beforeRegisterNodeDef`, …) |
| **S2** | `LGraphNode.prototype` methods extensions monkey-patch (`onConnectionsChange`, `onSerialize`, `onDrawForeground`, …) |
| **S3** | `LGraphCanvas.prototype` methods extensions monkey-patch (`processKey`, `processContextMenu`, `drawNode`, …) |
| **S4** | Widget-level patterns — `.callback` chaining, `.value` r/w, `.serializeValue`, `.options.*`, DOM widgets |
| **S5** | `ComfyApi` / `app.api` event surfaces — execution lifecycle WebSocket events |
| **S6** | `ComfyApp` god-object touch points — `app.graphToPrompt`, `app.queuePrompt`, `app.api.fetchApi`, … |
| **S7** | Window / global escape hatches — `window.app`, `window.LiteGraph`, `globalThis.LGraphCanvas` |
| **S8** | Special node properties (magic flags) — `isVirtualNode`, `serialize_widgets`, `category`, `color_on` |
| **S9** | Non-Node entity kinds (per [ADR 0008](../decisions/0008-entity-taxonomy.md)) — subgraphs, groups, reroutes, links |
| **S10** | Dynamic node API — `addInput` / `removeInput` / `addOutput` / `removeOutput` slot mutation at runtime |
| **S11** | Graph-level state and change-tracking — `graph.add`, `graph.remove`, `graph.serialize`, version bumps |
| **S12** | Shell UI registries — `extensionManager.registerSidebarTab`, bottom panel, commands, toasts |
| **S13** | Schema interpretation — `ComfyNodeDef` / `InputSpec` consumers (validation, default values, type coercion) |
| **S14** | Identity / Locator scheme — node IDs, slot keys, widget identity across reload |
| **S15** | Output system — preview-image / preview-any / display-text axis (per `widget-api-thoughts.md`) |

Full details, schema, and severity rubric are in [`touch-points-plan.md`](./touch-points-plan.md).

## Top 12 patterns by blast radius

Computed from [`touch-points-rollup.yaml`](./touch-points-rollup.yaml). Blast
radius is `log10(1+stars)·1.0 + log10(1+occurrences)·0.7 +
(signature_count-1)·0.5 + silent_breakage·0.5 + lifecycle_coupling·0.4`.

| Rank | BR | ★ sum | occ | sig | Pattern | Surface |
|---:|---:|---:|---:|---:|---|---|
| 1 | 6.67 | 17 101 | 7 | 1 | `S6.A1` | `app.graphToPrompt` monkey-patching ⚠️ CRITICAL |
| 2 | 5.42 | 2 567 | 1 | 1 | `S9.SG1` | Subgraph "set/get virtual node" pattern (KJNodes-style) |
| 3 | 5.27 | 4 314 | 4 | 1 | `S11.G2` | `graph.add` / `graph.remove` / `graph.findNodesByType` / `graph.findNodeById` / `graph.serialize` / `graph.configure` |
| 4 | 5.23 | 1 808 | 3 | 1 | `S10.D1` | `node.addInput` / `node.removeInput` / `node.addOutput` / `node.removeOutput` dynamic slot mutation |
| 5 | 5.18 | 3 049 | 5 | 1 | `S2.N13` | `nodeType.prototype.onConnectOutput` patching |
| 6 | 5.08 | 6 147 | 4 | 1 | `S4.W2` | `node.addDOMWidget(name, type, element, options)` |
| 7 | 5.01 | 412 | 6 | 1 | `S2.N15` | `nodeType.prototype.serialize` / `node.serialize` direct method patching |
| 8 | 4.89 | 1 789 | 4 | 1 | `S2.N14` | `nodeType.prototype.onWidgetChanged` patching |
| 9 | 4.89 | 7 932 | 6 | 1 | `S2.N4` | `nodeType.prototype.onRemoved` patching (de-facto teardown) |
| 10 | 4.66 | 1 837 | 6 | 1 | `S4.W3` | `widget.serializeValue` direct assignment |
| 11 | 4.61 | 1 788 | 1 | 1 | `S2.N12` | `nodeType.prototype.onConnectInput` patching |
| 12 | 4.55 | 1 793 | 5 | 1 | `S6.A3` | `api.fetchApi` — extensions hit backend HTTP endpoints |

The top three pattern categories — graph mutation (`S11.G2`, `S10.D1`),
prototype patching (`S2.*`), and the `app.graphToPrompt` god-object — together
account for the majority of the blast radius and define the v2 API's
non-negotiable compatibility surfaces.

## Refresh workflow

The database is curated by hand; the star cache and rollup are derived.

```bash
# from this directory
bash scripts/fetch-stars.sh         # refresh GitHub stars (needs `gh` auth)
python3 scripts/rollup-blast-radius.py   # recompute touch-points-rollup.yaml
```

To add new evidence or new patterns discovered during a future MCP
code-search sweep, edit `scripts/add-evidence.py` (the inline `APPEND` and
`NEW_PATTERNS` blocks are the source of truth for reproducibility) and run:

```bash
python3 scripts/add-evidence.py
python3 scripts/rollup-blast-radius.py
```

## Source documents

The 52 patterns were derived from three primary inputs, then expanded by an
MCP code-search sweep across 87 ecosystem repos:

1. **`AGENTS.md` §5** in this repo — 40+ repo callouts for contributor
   conventions and known extension surfaces.
2. **[ADR 0008 — Entity Taxonomy](../decisions/0008-entity-taxonomy.md)** —
   defines the non-Node entity kinds (subgraphs, groups, reroutes, links)
   that drive surface family **S9**.
3. **`widget-api-thoughts.md`** (in the cross-repo workspace) — the output
   system axis and widget lifecycle dependencies that drive surface family
   **S15** plus the lifecycle-coupling weight.

## Cross-references

This database is consumed by, and consumes, the rest of the ECS architecture
docs:

- [`../ecs-target-architecture.md`](../ecs-target-architecture.md) — the
  target ECS shape this v2 API redesign serves
- [`../ecs-world-command-api.md`](../ecs-world-command-api.md) — the World /
  Command API that v2 extensions will program against
- [`../ecs-migration-plan.md`](../ecs-migration-plan.md) — how we get from
  today's monkey-patched LiteGraph to v2 + ECS
- [`../ecs-lifecycle-scenarios.md`](../ecs-lifecycle-scenarios.md) — the
  lifecycle scenarios the test framework must cover (every touch-point row
  here ⇒ ≥1 scenario there)
- [`../entity-interactions.md`](../entity-interactions.md) /
  [`../entity-problems.md`](../entity-problems.md) — the entity-model
  problems v2 must not perpetuate
- [`../change-tracker.md`](../change-tracker.md) — the change-tracking
  contract that S11 (graph state) and S2 (`onSerialize`/`onDeserialize`
  patches) must remain compatible with
