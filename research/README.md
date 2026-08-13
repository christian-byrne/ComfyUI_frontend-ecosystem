# v2 Extension API — Touch-Point Database

> ## ⚠️ Read this before quoting any number on this page
>
> **1. The v2 extension API rewrite is DEFERRED.** Near-term work is getting
> tests running against **Nodes 2.0**, not shipping v2. Everything below that
> reads as imminent ("the upcoming v2 redesign", "before v2 ships") describes a
> _future_ programme, not current direction. The v1↔v2 content is kept
> deliberately — it will be used when the rewrite is picked back up — but do not
> plan against it today.
>
> **2. The compat-floor gate is RETIRED.** "every `blast_radius ≥ 2.0` entry
> MUST pass all three tests before v2 ships" (see
> [`touch-points-plan.md`](./touch-points-plan.md) §Compat floor) was retired in
> wave-10. Per `src/data/knowledge/root/AXIOMS.md` §"Compat-floor doctrine
> retired (wave-10)": compat floors based on ecosystem-consumer counts conflated
> _evidence that a migration is needed_ with _evidence that a specific surface
> must exist_. Axioms and ADRs are now the source of truth for the v2 surface;
> BC tests verify admitted surfaces and use `axiomExcluded({…})` otherwise.
>
> **3. This repo is one workspace-amend BEHIND upstream.** The cross-repo
> research workspace has moved on and these files were never re-synced:
>
> |                     | here | upstream |
> | ------------------- | ---: | -------: |
> | patterns            |   73 |       79 |
> | behavior categories |   41 |       42 |
>
> Missing here: `S2.N9b`, `S2.N10b`, `S3.C3`, `S4.W9`, `S4.W10`, `S4.W11`,
> `S18.SER1`, `S18.SER2`, `S18.SER3`, and `BC.42`.
>
> **4. Evidence counts here are 5–13× LOW.** The W2F-1 re-audit found far more
> real usage than the original sweep recorded. Its corrections live in
> `src/data/litegraph-audit.json` under `reauditDelta` and were **never
> back-propagated** into `touch-points-database.yaml` or the rollup. Examples:
> `S2.N1` baseline 7 → re-audit 77 (11×); `S2.N18` 1 → 13 (13×); `S2.N11`
> 8 → 39 (4.9×); `S2.N10` 8 → 31 (3.9×). So every `occurrences` number below —
> and therefore every `blast_radius` and every `usage_weight` derived from it —
> is a **floor, not a measurement**. Relative ranking is still informative;
> absolute magnitudes are not.
>
> **5. `workspace-mirror/` is a frozen point-in-time snapshot**, not a live
> mirror. Its `behavior-categories.yaml` still carries the pre-recompute
> `usage_weight` values and the stale `source_pattern_count: 62` /
> `category_count: 37` meta. The shipped, recomputed copy is
> `src/data/behavior-categories.json`.

This directory is the **canonical compatibility-surface map** for the (deferred)
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

| File                                                                 | Role                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`touch-points-plan.md`](./touch-points-plan.md)                     | Methodology, schema, surface-family enumeration, severity rubric              |
| [`touch-points-database.yaml`](./touch-points-database.yaml)         | Source of truth — 73 patterns × 17 surface families, 699 evidence rows        |
| [`touch-points-star-cache.yaml`](./touch-points-star-cache.yaml)     | GitHub star/fork/last-commit snapshot for every cited repo (drift detection)  |
| [`touch-points-rollup.yaml`](./touch-points-rollup.yaml)             | Computed blast-radius scores per pattern (sorted) — the prioritization output |
| [`scripts/fetch-stars.sh`](./scripts/fetch-stars.sh)                 | Refresh the star cache via `gh api`                                           |
| [`scripts/rollup-blast-radius.py`](./scripts/rollup-blast-radius.py) | Recompute blast radius from database + star cache                             |
| [`scripts/add-evidence.py`](./scripts/add-evidence.py)               | Idempotently merge new evidence rows / new patterns into the database         |

## The 17 surface families

| Family  | One-liner                                                                                                                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1**  | `ComfyExtension` lifecycle hooks (`init`, `setup`, `nodeCreated`, `beforeRegisterNodeDef`, …)                                                                                                              |
| **S2**  | `LGraphNode.prototype` methods extensions monkey-patch (`onConnectionsChange`, `onSerialize`, `onDrawForeground`, …)                                                                                       |
| **S3**  | `LGraphCanvas.prototype` methods extensions monkey-patch (`processKey`, `processContextMenu`, `drawNode`, …)                                                                                               |
| **S4**  | Widget-level patterns — `.callback` chaining, `.value` r/w, `.serializeValue`, `.options.*`, DOM widgets                                                                                                   |
| **S5**  | `ComfyApi` / `app.api` event surfaces — execution lifecycle WebSocket events                                                                                                                               |
| **S6**  | `ComfyApp` god-object touch points — `app.graphToPrompt`, `app.queuePrompt`, `app.api.fetchApi`, …                                                                                                         |
| **S7**  | Window / global escape hatches — `window.app`, `window.LiteGraph`, `globalThis.LGraphCanvas`                                                                                                               |
| **S8**  | Special node properties (magic flags) — `isVirtualNode`, `serialize_widgets`, `category`, `color_on`                                                                                                       |
| **S9**  | Non-Node entity kinds (per [ADR 0008](../decisions/0008-entity-taxonomy.md)) — subgraphs, groups, reroutes, links                                                                                          |
| **S10** | Dynamic node API — `addInput` / `removeInput` / `addOutput` / `removeOutput` slot mutation at runtime                                                                                                      |
| **S11** | Graph-level state and change-tracking — `graph.add`, `graph.remove`, `graph.serialize`, version bumps                                                                                                      |
| **S12** | Shell UI registries — `extensionManager.registerSidebarTab`, bottom panel, commands, toasts                                                                                                                |
| **S13** | Schema interpretation — `ComfyNodeDef` / `InputSpec` consumers (validation, default values, type coercion)                                                                                                 |
| **S14** | Identity / Locator scheme — node IDs, slot keys, widget identity across reload                                                                                                                             |
| **S15** | Output system — preview-image / preview-any / display-text axis (per `widget-api-thoughts.md`)                                                                                                             |
| **S16** | Direct DOM injection + security-scan indicators — `createElement('style')`, `body.appendChild`, `innerHTML` concatenation, raw `fetch()` bypassing `api.fetchApi`, bundled Vue runtimes inside DOM widgets |
| **S17** | Pain-point surfaces with no API — canvas/app mode state, subgraph boundary event propagation, file-upload URL construction, positional `widgets_values` serialization                                      |

Full details, schema, and severity rubric are in [`touch-points-plan.md`](./touch-points-plan.md).

## Top 12 patterns by blast radius

Computed from [`touch-points-rollup.yaml`](./touch-points-rollup.yaml). Blast
radius is `log10(1+stars)·1.0 + log10(1+occurrences)·0.7 +
(signature_count-1)·0.5 + silent_breakage·0.5 + lifecycle_coupling·0.4`.

Note the caveat in the banner at the top of this file: `occ` is a floor, not a
measurement — the W2F-1 re-audit found 5–13× more usage than these rows record.

| Rank |   BR |  ★ sum | occ | sig | Pattern  | Surface                                                                                        |
| ---: | ---: | -----: | --: | --: | -------- | ---------------------------------------------------------------------------------------------- |
|    1 | 7.06 | 25 225 |  16 |   1 | `S6.A1`  | `app.graphToPrompt` monkey-patching ⚠️ CRITICAL                                                |
|    2 | 6.36 |  5 996 |  12 |   1 | `S2.N15` | `nodeType.prototype.serialize` / `node.serialize` direct method patching                       |
|    3 | 6.31 | 20 594 |  15 |   1 | `S11.G3` | `graph.beforeChange` / `graph.afterChange` — explicit batching seam                            |
|    4 | 6.28 | 21 086 |  13 |   1 | `S11.G2` | `graph.add` / `graph.remove` / `graph.findNodesByType` / `graph.serialize` / `graph.configure` |
|    5 | 6.19 |  6 908 |  13 |   1 | `S10.D1` | `node.addInput` / `removeInput` / `addOutput` / `removeOutput` dynamic slot mutation           |
|    6 | 6.12 | 18 853 |  15 |   1 | `S7.G1`  | `window.LiteGraph` / `window.comfyAPI.*` — globals as public surface                           |
|    7 | 6.10 | 20 264 |  18 |   1 | `S10.D2` | `node.connect` / `disconnectInput` / `disconnectOutput` programmatic linking                   |
|    8 | 6.09 |  3 464 |  11 |   1 | `S6.A4`  | `app.queuePrompt` / `app.api.queuePrompt` patching or direct call                              |
|    9 | 5.99 |  8 707 |  18 |   1 | `S2.N16` | `node.widgets` array direct access / iteration / mutation                                      |
|   10 | 5.96 |  9 606 |  14 |   1 | `S4.W4`  | `widget.options.values` mutation (COMBO update at runtime)                                     |
|   11 | 5.77 | 16 668 |  13 |   1 | `S6.A3`  | `api.fetchApi` — extensions hit backend HTTP endpoints                                         |
|   12 | 5.75 |  2 569 |   5 |   1 | `S9.SG1` | Subgraph "set/get virtual node" pattern (KJNodes-style)                                        |

The top three pattern categories — graph mutation (`S11.G2`, `S10.D1`),
prototype patching (`S2.*`), and the `app.graphToPrompt` god-object — together
account for the majority of the blast radius and define the v2 API's
non-negotiable compatibility surfaces.

## Refresh workflow

The database is curated by hand; the star cache, rollup and behavior-category
weights are derived. Prefer the repo-root `make` targets — they run the
regression guards that the bare scripts do not:

```bash
# from the repo root
make stars      # gh api -> merge into the canonical JSON star cache (never shrinks)
make rollup     # recompute touch-points-rollup.yaml from database + stars
make weights    # recompute behavior-category usage_weight from the rollup
make slugs      # normalise repo slugs to canonical owner/name
make check      # read-only: every drift/consistency guard (this is what CI runs)
```

The canonical star cache is `src/data/touch-points-star-cache.json`;
`touch-points-star-cache.yaml` in this directory is a derived mirror. See the
root README §"Which star cache is canonical?" — running the old bare
`scripts/fetch-stars.sh` on its own writes only the YAML and does **not** update
what the dashboard reads.

`usage_weight` is **not** produced by the `scripts/build-behavior-categories.py`
named in the file's own `meta.generated_by` — that generator lives in the
research workspace and was never vendored here, which is exactly why the weights
went stale (11 categories were left at a literal `0.00`). It is now recomputed
in-repo by `scripts/recompute-usage-weights.py` (`make weights`).

To add new evidence or new patterns discovered during a future MCP
code-search sweep, edit `scripts/add-evidence.py` (the inline `APPEND` and
`NEW_PATTERNS` blocks are the source of truth for reproducibility) and run:

```bash
python3 scripts/add-evidence.py
python3 scripts/rollup-blast-radius.py
```

## Source documents

The original 52 patterns were derived from three primary inputs, then expanded
by an MCP code-search sweep across 87 ecosystem repos, later Notion API-usage
research (S16), a pain-point assessment (S17) and the R8 clone-and-grep sweep —
73 patterns today:

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
