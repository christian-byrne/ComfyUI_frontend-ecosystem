# ECS + Vue Hoisted Client State & Hook API — Context

Append-only project knowledge. Add findings, entities, decisions, and key people here.

## Problem

ComfyUI extensions currently interact with the system through lifecycle hooks (`nodeCreated`, `setup`, etc.) that pass raw class instances (`LGraphNode`, `ComfyApp`). Extensions must monkey-patch prototypes, use instance-bound callbacks (`widget.callback`), and access internal properties to achieve their goals. There is no formal public API for graph/node/widget state mutation or observation.

The ECS refactor (ADR 0008) introduces a World store with components and systems, but currently has no public API surface for extensions/custom nodes. This project designs the bridge: a Vue-inspired hook + setup function system that exposes ECS query/mutation APIs through the existing extension hook architecture, enabling:

- Declarative state observation (signals/reactivity instead of polling)
- Explicit mutation APIs (commands instead of monkey-patching)
- Hoisted client state (context survives DOM moves, subgraph transitions)
- Widget registration with SFC-like lifecycle semantics

## Key Architecture Decisions (Prior Art)

### ADR 0008 — Entity Component System
- Six entity kinds: Node, Link, Widget, Slot, Reroute, Group
- Branded IDs prevent cross-kind misuse
- World is instance-scoped single source of truth per workflow
- Systems are pure functions that query/mutate the World
- Subgraphs are nodes with `SubgraphStructure` component, not a separate entity
- Migration is incremental via bridge layer

### ADR 0003 — CRDT/Command Pattern
- All mutations via serializable, idempotent commands
- Commands describe intent; systems are handlers; World is the store
- Complementary to ECS (like Redux: actions vs reducers vs store)

### Current Public API Surface (`src/types/index.ts`)
- `ComfyExtension` interface with ~20 lifecycle hooks
- Shell UI types: `SidebarTabExtension`, `BottomPanelExtension`, `CommandManager`, etc.
- API types: `ComfyApi`, `ComfyApp`, `ComfyNodeDef`
- Node identification: `NodeLocatorId`, `NodeExecutionId`
- Widget types: `DOMWidget`, `DOMWidgetOptions`

### Meeting Consensus (2026-04-14)
- Jacob: "We do not have a public API today" — need explicit APIs like Chrome extensions
- Christian: Hook system like Vue/React is superior to pure event bus — hoisted client state, scheduled execution, composability
- Alex: "Component as trigger model" from ECS enables declarative system watching
- Jacob: Design from API-consumer perspective first ("write the extension you want to write")
- Goal: Auto-documentable public API, custom nodes should only need documented functions
- Jacob: "0 of our ICPs use ComfyUI without custom nodes" — if unstable with custom nodes, ComfyUI is unstable
- Christian: Wire ECS APIs into hook setup contexts, provide signal-like reactivity bound to Vue internals
- Migration: gradual, hooks still pass same params but add new params, deprecation period
- Security: Future sandboxing (like Chrome extensions) is worth considering but not designing for now

## Entities

- **World**: Central ECS registry per workflow instance. Maps entity IDs → component sets. Source of truth for runtime entity state.
- **ComfyExtension**: The interface extensions implement to register with the app. Has lifecycle hooks (`init`, `setup`, `nodeCreated`, `beforeRegisterNodeDef`, etc.).
- **ExtensionManager**: Shell UI registry for sidebar tabs, bottom panels, commands, toasts.
- **ComfyApp**: God object currently passed to all hooks. Holds graph, canvas, API, extension manager references.
- **LGraphNode**: Current monolithic node class (~2000+ lines). Will be decomposed into ECS components.
- **BaseWidget**: Current widget base class with 25+ subclasses. Will become WidgetEntityId + components.
- **ComponentInternalInstance** (Vue): Per-component long-lived state container; the model for our `NodeInstance`. Created once, never re-created across re-renders.
- **setupState** (Vue): The `proxyRefs`-wrapped setup() return value. Object-identity-stable across renders — the mechanism by which "hoisted state" actually works.
- **EffectScope** (Vue): Owns all reactive primitives created during setup; one-call teardown via `scope.stop()`.
- **currentInstance stack** (Vue): Threaded global enabling `useX()` ergonomics. `setCurrentInstance` returns a `reset` closure; setup runs inside `pauseTracking()` + scope activation.
- **KeepAliveContext.activate/deactivate** (Vue): Canonical "park-DOM-offscreen" primitive. Uses an off-document `storageContainer = createElement('div')` and `move()`s DOM in/out without unmount/mount. Maps directly to ComfyUI graph↔app mode and subgraph promotion.

## Decisions

- 2026-04-14: Project initiated. Focus on designing hook+ECS bridge API. Shell UI registries are lower priority and may not be touched.
- 2026-04-14: First research task: deep dive into Vue internals (reactivity, hooks, setup functions) as the primary model for our hook system design.
- 2026-04-14: D3.3 — Events over signals. Extension API is event/callback based (`node.on('executed', fn)`, `widget.getValue()/setValue()`), not signal/derived. Vue reactivity is the internal engine, invisible to extensions.
- 2026-04-14: D3.4 — Domain handles (NodeHandle.setPosition, WidgetHandle.setValue) ARE the ECS command/query API at a higher abstraction. Extensions don't see Components, Commands, or the World directly.
- 2026-04-14: D3.5 — Reactive dispatch for entity hooks. The extension system watches `world.queryAll(NodeType)` and auto-mounts/unmounts extension scopes — no imperative `dispatchNodeCreated()` needed. Non-entity hooks (init, setup) remain imperative. `pauseTracking()`/`resetTracking()` added around extension setup to match Vue's `setupStatefulComponent` pattern. `LoadedFromWorkflow` tag component distinguishes loaded vs newly created nodes. `currentExtension` global deferred until implicit hooks are needed.
- 2026-05-06: R3 → implied D6 (NodeInstance lifecycle): NodeInstance lifetime = node-id lifetime; only graph deletion destroys it. Mirror Vue's instance-per-mount. setup() runs once; `node.setupState` assigned once and never replaced by re-renders.
- 2026-05-06: R3 → implied D7 (DOM moves are move(), not unmount/mount): graph↔app mode and subgraph promotion must use `move()` semantics, preserving focus/scroll/third-party widget state. Mirror Vue's `<KeepAlive>` mechanism (off-document storageContainer + shape-flag interception).
- 2026-05-06: R3 → implied D8 (ctx-injection over hard imports): extensions write capability fns onto `node.ctx`; runtime reads via duck-typed interface. Tree-shaking + composability win, mirrors how Vue's renderer reads KeepAliveContext.activate/deactivate.
- 2026-05-06: D2 review → open issue: `currentExtension` global is deferred (per D3.5) but proposed lifecycle hooks (`onNodeMounted`, `onNodeRemoved`) assume implicit context. Latent contradiction — must resolve before D4 by either (a) routing all hooks through `ctx.onNodeMounted(...)` (no global), or (b) committing to `currentExtension` now.
- 2026-05-06: D2 review → open issue: hook ordering across multiple extensions on the same entity is unspecified. Mirror Vue's array-in-registration-order with extension-name tie-breaker for determinism.
- 2026-05-06: D2 review → open issue: async setup() unspecified. Vue uses `<Suspense>`; v1 should likely commit to sync-only.
- 2026-05-06: D2 review → open issue: should extension `setupState` be `proxyRefs`-wrapped so `entity.extensionState['foo'].count` works without `.value`?
- 2026-05-06: D1 review → research gap: Vue reactivity doc lacks coverage of `flush: 'pre' | 'post' | 'sync'`, `pauseTracking`/`resetTracking`, `shallowRef`/`shallowReactive`/`markRaw`. `markRaw` likely needed for LiteGraph node instances; `shallowRef` for serialized workflow JSON.
- 2026-05-06: D1 review → architecture gap: the engine layer translating ECS World mutations → Vue notifications (so `watch(() => world.getComponent(...))` works) is undocumented. Likely the next biggest gap before implementation.
- 2026-05-06: Doc audit (core.md, development.md) → finding: docs hedge "avoid directly modifying core objects where possible" was the loophole that produced the monkey-patching ecosystem. v2 must remove the hedge entirely. `beforeRegisterNodeDef(nodeType, ...)` is the structural seam that *invites* prototype patching — must be replaced.
- 2026-05-06: Doc audit → finding: `window.comfyAPI` and legacy import paths (`/scripts/app`, `/scripts/api`, …) are public API by accident — permanent compat wedge. Must be enumerated and stabilized or formally deprecated.
- 2026-05-06: Doc audit → finding: existing extension docs have NO teardown / `dispose` / unload story. v2 must specify lifecycle end explicitly.
- 2026-05-06: D4 → 5 BLOCKERS identified before v2 implementation: G1 missing `inspectNodeDef`, G2 missing `registerCustomNodes` replacement (rerouteNode/noteNode unmigratable), G7 widget `destroy` is optional in P1 but must be mandatory per R4-F5, G8 three-way inconsistency on `currentExtension`/`node.ctx`/no-global, G12 ECS World → Vue reactive adapter undocumented (blocks all `.on(...)` implementations).
- 2026-05-06: D4 → recommended next decisions: D5 (node-type registration & def inspection — resolves G1+G2), D6 (UI contribution registry — toolbox/badges/menus), D7 (mandatory widget dispose contract), D8 (ECS World ↔ Vue reactive adapter — `shallowRef`/`markRaw`/`flush` strategy).
- 2026-05-06: D4 → R4+P1+D3.x inconsistencies surfaced: (1) R4 promises `inspectNodeDef`, P1 ships zero queries; (2) R4-F5 says dispose mandatory, P1 marks `destroy?` optional; (3) `currentExtension` deferred per D3.5 but D2 review and R3-implied D8 both depend on a context mechanism — three different answers to one question; (4) `world.queryAll(NodeType)` used as both future-public (D3.4) and current-internal (D3.5) — naming/layer boundary unclear.
- 2026-05-06: R4 second pass → expanded confirmed patterns from 6 to 12, with 14 evidence-backed failure modes. Major new findings:
  - **P3 `nodeType.prototype.onExecuted` patching** is the universal "show backend output" pattern (5+ confirmed repos including show_text, show_json, previewAny, show_string). Every "show me what the backend computed" custom node uses this anti-pattern. v2 `node.on('executed', msg => …)` must include typed-message contract per node type.
  - **P4 `onConnectionsChange` patching has SIX distinct parameter signatures observed across the corpus** — community is collectively guessing at the API. Strongest single evidence for typed event payloads.
  - **P5 `nodeType.prototype.onRemoved` is the de-facto teardown API** (7+ repos including LTXVideo, KJNodes, comfyui-deploy). Even our own `docs/architecture/ecs-migration-plan.md:587` documents this pattern. Confirms D4-G7 (mandatory dispose) is BLOCKER. New sub-finding (F14): no event distinguishes "removed" from "moved to subgraph" — extensions cannot tell whether to dispose or preserve state during subgraph promotion.
  - **P6 `getExtraMenuOptions` patching** (Eclipse) confirms D4-G4 (UI contribution registry) — extensions mutate shared `options` array; needs declarative replacement.
  - **P7 `LGraphCanvas.prototype.*` patching** is a NEW gap (G13): canvas-level keyboard, context menu, visibility patching is unaddressed by P1. Real call sites in Folded-Prompts, Creepy_nodes, ljm_comfyui, KJNodes (computeVisibleNodes for set/get virtual nodes — correctness-critical).
  - **P8 `app.api.addEventListener('executed', …)`** is the existence-proof that events-everywhere works at scale. ComfyApi extends EventTarget; pattern is widely used; even third-party teaching skills recommend it. Strongest evidence for v2 events model.
  - **P10 `isVirtualNode = true` magic prototype property** — needs first-class `kind: 'virtual'` registration in v2.
  - **P11 `loadedGraphNode` is effectively dead** — only 1 real call site found in entire corpus (sofakid/dandy); 7/8 hits were type re-declarations. v2 can drop without replacement.
  - **P11 type re-declaration in vendor `comfy.d.ts` files** — the absence of a published `@comfyui/extension-api` package forces extensions to vendor type defs. Unowned compat surface. v2 must publish a real npm package.
  - **P12 `getCustomWidgets`** appears near-zero usage in real extensions; widgets are contributed via `addDOMWidget` (P9). v2 can likely remove the hook entirely.
- 2026-05-06: R4 → MCP service issues identified: `gitserver-0.gitserver` DNS lookup intermittently fails. Workaround: retry with 3-token reformulations. Documented in artifact methodology section.
- 2026-05-06: R4 → NEW gap G13 (canvas-level extension surface): P1 covers nodes and widgets but not canvas. Need `defineCanvasExtension({ keyBindings, menuItems, visibilityPredicate })` or similar. Adds to D4 BLOCKER list.

## Touch-Point Database (R7 — in progress)

Canonical compatibility surface map at `research/touch-points/`:

- `PLAN.md` — schema + blast-radius formula + S1–S8 surface taxonomy + workflow
- `database.yaml` — **52 patterns** across **15 surface families** (S1 hooks, S2 node prototype, S3 canvas, S4 widgets, S5 api events, S6 app globals, S8 magic flags, **S9 non-Node entity kinds per ADR 0008** — Reroute/Group/Link/Slot/Subgraph virtual nodes, **S10 dynamic node API** — addInput/Output, connect, **S11 graph-level state** — graph._version + graph.add/remove/findNodesByType, **S12 shell UI registries** — sidebarTab/bottomPanel/command/toast, **S13 schema interpretation** — ComfyNodeDef/InputSpec, **S14 identity/locator** — NodeLocatorId/NodeExecutionId, **S15 output system** — dynamic vs declared per `widget-api-thoughts.md`)
- `star-cache.yaml` — **87 unique repos**, all with stars (sweep pass-1 added 29 new ecosystem repos); refresh via `bash scripts/fetch-stars.sh`
- `rollup.yaml` — generated by `python3 scripts/rollup-blast-radius.py`; computes per-pattern blast radius from cumulative stars + occurrences + signature count + silent-breakage + lifecycle-coupling weights

### Top 12 patterns by blast radius (2026-05-06, after sweep pass-1)

| rank | br | ★sum | occ | pattern | surface |
|---|---|---|---|---|---|
| 1 | 6.67 | 17,101 | 7 | S6.A1 | `app.graphToPrompt` monkey-patching ⚠️ CRITICAL |
| 2 | 5.42 | 2,567 | 1 | S9.SG1 | Subgraph "set/get virtual node" pattern (KJNodes) ⚠️ CRITICAL |
| 3 | **5.27** | **4,314** | **4** | **S11.G2** | `graph.add/remove/findNodesByType/serialize/configure` (newly evidenced) |
| 4 | **5.23** | 1,808 | 3 | **S10.D1** | `node.addInput/removeInput/addOutput/removeOutput` dynamic slot mutation |
| 5 | **5.18** | 3,049 | 5 | **S2.N13** | `nodeType.prototype.onConnectOutput` patching (rgthree pack drives this) |
| 6 | 5.08 | 6,147 | 4 | S4.W2 | `node.addDOMWidget(name, type, element, options)` |
| 7 | **5.01** | 412 | 6 | **S2.N15** | `nodeType.prototype.serialize` direct method patching (AGENTS.md §5) |
| 8 | **4.89** | 1,789 | 4 | **S2.N14** | `nodeType.prototype.onWidgetChanged` patching (AGENTS.md §5) |
| 9 | 4.89 | 7,932 | 6 | S2.N4 | `nodeType.prototype.onRemoved` (de-facto teardown) |
| 10 | 4.66 | 1,837 | 6 | S4.W3 | `widget.serializeValue` direct assignment |
| 11 | 4.61 | 1,788 | 1 | S2.N12 | `nodeType.prototype.onConnectInput` patching (AGENTS.md §5) |
| 12 | **4.55** | 1,793 | 5 | **S6.A3** | `api.fetchApi` — extensions hit backend HTTP (NEW pattern) |

**Bold** = newly evidenced or newly discovered this sweep. Six patterns first ranked in this pass, three of them (`S11.G2`, `S10.D1`, `S2.N13`) entered the top 5.

### Closing-out checkpoint (2026-05-08) — pass-3 plan & test-framework binding

PR #2 rebased onto upstream `Comfy-Org/main` (`68843967c`). Fork's `main` was 244 commits behind upstream, which inflated PR diff to 1,879 files; after `git push fork origin/main:main` the PR is back to its real footprint of **9 files / +5013**.

Three further research vectors scoped (full plan: [PASS-3-PLAN.md](file:///home/c_byrne/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api/research/touch-points/PASS-3-PLAN.md)):

- **R8 — Top-20 clone-and-grep.** MCP gave breadth across the long tail; cloning the top-20 starred packs locally gives depth on the actual high-leverage ecosystem. Sidesteps MCP flakiness (~50% query failure). Also populates `evidence[].excerpt:` field which the test harness needs.
- **R9 — Ingest existing on-disk research.** Six pre-existing personal sources never integrated into the DB: security-scan corpus (60+ packs already audited), trending top-N report (authoritative popularity), Reddit community signal, our own custom-node guides (idioms we *teach* = sanctioned-public surfaces), custom-node-QA worktree (regression scenarios = ready-made test seeds), cookiecutter template (default scaffold = forced-public surface).
- **R10 — Reverse-direction sweeps.** Walk `src/types/index.ts` exports + `comfyui-frontend-types` package + LiteGraph prototype methods; flag every unmapped surface. Catches latent touch points the use-driven sweeps would never see.

Test framework already planned (todo: `I-TF.1`–`I-TF.5`); pass-3 adds three closing-the-loop tasks: `I-TF.0` (excerpt schema field, prerequisite for harness), `I-TF.6` (`loadEvidenceSnippet()` tests against real ecosystem code not synthetic mocks), `I-TF.7` (CI gate fails if any `blast_radius ≥ 2.0` pattern lacks all three test files). The bridge from R7's 56 patterns → ~26 behavior categories → ~78 stub tests → harness-loaded real snippets is now end-to-end planned.

Open patterns for pass-3 evidence: `S2.N18 onPropertyChanged`, `S9.G1 LGraphGroup`, `S9.L1 LLink direct`, `S15.OS1 dynamic outputs`, `S4.W5 direct widget.value writes`, `S14.ID1 NodeLocator real usage`. None ranked top-12 in either pass — but R10 export-walk may surface new ones above this floor.

### Sweep pass-3 stragglers (2026-05-08) — closed all 6 empty patterns

Reproducible merge via `scripts/add-evidence-pass3-stragglers.py`. MCP `comfy_codesearch` still ~50% query failure rate; successful ones gave broad coverage. No new patterns added — pure gap-filling.

- **45 new evidence rows** appended; **all 6 previously-empty patterns now populated**:
  - `S2.N18 onPropertyChanged` — 0→3 ev (rgthree across seed.ts/seed.js/power_primitive.js, ★4,355). **Entered top-12 at rank #11** (br 4.81).
  - `S9.G1 LGraphGroup creation/mutation` — 0→4 ev (ljm_comfyui composables + groupOptions, gfv_pro_upgrade bundled).
  - `S9.L1 graph.links direct manipulation` — 0→5 ev (Custom-Scripts graphArrange + reroutePrimitive, ollama-model-manager).
  - `S14.ID1 NodeLocatorId/NodeExecutionId` — 0→2 ev (willie-comfy-frontend type re-declaration; surface really is rarely used today, this is the finding).
  - `S15.OS1 dynamic output mutation` — 0→2 ev (KYNode python-editor adds outputs at runtime as user types code).
  - `S4.W5 direct widget.value writes` — 0→4 ev (Trajectory canvas, ollama-mm, Immortal).
- **8 evidence-light patterns better-evidenced** (highlights):
  - `S2.N12 onConnectInput` 1→3 ev — KJNodes (★2,567) added; **climbed to rank #5** in top-12 (br 5.21, ★4,355).
  - `S10.D3 setSize+computeSize` 2→9 ev — Easy-Use canonicalizes the idiom as `updateNodeHeight(node)` helper. Strongest single argument that v2 reactivity must auto-relayout.
  - `S11.G3 beforeChange/afterChange` 2→5 ev — nodetool docs treat as part of subgraph contract.
  - `S8.P1 isVirtualNode = true` 2→5 ev — typed `override get isVirtualNode(): true` in willie-comfy fork crystallises the contract.
- **star-cache.yaml**: 105 → 119 starred repos.
- DB now: **56 patterns / 240 evidence rows / 15 surface families**.

**Remaining light patterns are intentional**: S1.H* family (5 patterns) are negative-evidence — the absence of usage IS the finding (e.g. `loadedGraphNode` near-zero usage justifies dropping). S14.ID1 and S15.OS1 stay light because the underlying surfaces really are sparsely used today; their evidence count reflects reality, not sweep gaps.

**Top-12 churn**: S6.A1 graphToPrompt unchanged at #1 (★17,124). S2.N12 entered top-12 (rank #5). S2.N18 entered top-12 (rank #11). Both jumps are from gap-filling, not weighting changes.

### Sweep pass-2 (2026-05-08) — second MCP burst, four NEW patterns

Reproducible merge via `scripts/add-evidence-pass2.py`. Outcome:

- **21 new evidence rows** appended; previously-empty patterns S2.N17/N19, S9.R1, S9.SG1, S13.SC1, S10.D2, S8.P1 now have real ecosystem hits. S3.C1 expanded with `drawNodeShape`/`onDrawForeground` variants.
- **4 brand-new patterns** discovered:
  - **S11.G3 `graph.beforeChange/afterChange`** — explicit batching seam wrapping multi-step graph mutations (nodetool-ai docs, ljm_comfyui clipboard). v2 needs `world.batch(() => …)` as first-class API.
  - **S7.G1 `window.LiteGraph` / `window.comfyAPI.*`** — globals-as-public-surface; ~6 evidenced packs reach for `window.LiteGraph.createNode`. Cannot break immediately; v2 must ship typed import path first then deprecate. **Severity: CRITICAL** for migration sequencing.
  - **S11.G4 `graph.setDirtyCanvas(true, true)`** — imperative redraw flush, the ecosystem's de-facto "reactivity flush" primitive (AlexZ1967 across 3 files, akawana). v2 reactivity should make this implicit; surface `world.markDirty()` only as escape hatch. Strongest single argument for v2's value-prop demo extension.
  - **S10.D3 `node.setSize(node.computeSize())`** — manual relayout idiom paired with S11.G4. Both should become unnecessary under reactive layout.
- **18 new ecosystem repos** added; `star-cache.yaml` now 105 starred repos (was 87). Notables: yolain/ComfyUI-Easy-Use-Frontend (27★), BennyKok/comfyui-deploy already cached, melMass/comfy_mtb already cached.
- DB now: **56 patterns / 195 evidence rows / 15 surface families**.

**Top blast radius unchanged at #1**: `S6.A1 graphToPrompt` (★17,122). The pass-2 additions ranked S11.G4/S10.D3/S11.G3/S7.G1 mid-table because their starred-repo footprint is smaller than the giants — but S7.G1's true blast radius is understated since `window.LiteGraph` use is universal in extensions and we only sampled ~6 hits.

**Strategic implication consolidating both passes**: The v2 API needs three orthogonal capabilities the current ecosystem fakes manually — (1) **batched mutations** (S11.G3), (2) **automatic redraw on reactive mutation** (replaces S11.G4 + S10.D3), (3) **typed import surface as the deprecation path for window globals** (S7.G1). These are concrete, testable design requirements, not aspirational principles.

Still pending: `S2.N18 onPropertyChanged`, `S9.G1 LGraphGroup`, `S9.L1 LLink direct`, `S14.ID1 NodeLocator real usage`, `S15.OS1 dynamic outputs`, `S4.W5 direct widget.value writes`. These are lower-priority — none ranked top-12 in either pass.

### Sweep pass-1 (2026-05-06) — MCP code-search results

Targeted ~15 MCP queries with 3-token reformulations to dodge `gitserver-0.gitserver` DNS errors. ~50% query-failure rate; one or two retries usually succeeded. Outcome:

- **37 new evidence rows** appended to 11 patterns; all moved from `evidence_status: pending-mcp-sweep` → `swept`.
- **3 brand-new patterns** discovered and added with full evidence:
  - **S6.A3 `api.fetchApi`** — extensions' canonical backend HTTP client; widely used (AlexZ1967, akawana/Folded-Prompts, our own `BackgroundImageUpload.vue`). Pattern is correct as designed; just needs a typed wrapper in v2.
  - **S6.A4 `app.queuePrompt` patching** — pairs with S6.A1 graphToPrompt as the OTHER half of the execute-pipeline interception story (gigici/BlendPack patches, Majoor docs 4 distinct invocation paths, rohapa fallback).
  - **S5.A3 `execution_*` event vocabulary** — `execution_start/success/error/cached/executing/status/reconnecting`; explicitly enumerated as "Sidecar-like tracing" public contract by `choovin/comfyui-api`. ⭐ Strong existence-proof for typed event API.
- **29 new ecosystem repos** added to `star-cache.yaml`; total 87 / 87 starred. Notable additions: yolain/ComfyUI-Easy-Use (2,505★), Azornes/Comfyui-LayerForge (313★), rgthree/rgthree-comfy.

**Tier 1 patterns now substantially evidenced**: `S2.N13 onConnectOutput` (rgthree across 5 files), `S2.N14 onWidgetChanged` (3 packs + own tests), `S2.N15 prototype.serialize` (5 distinct packs), `S2.N16 node.widgets array access` (5 packs incl. Eclipse + Copilot), `S11.G1 graph._version++` (4 packs). All previously had only theoretical AGENTS.md §5 evidence.

Still pending sweep: `S2.N17 onSelected/Deselected`, `S2.N18 onPropertyChanged`, `S2.N19 onResize`, `S3.C2 drawNode/drawNodeShape`, `S9.R1 Reroute manipulation`, `S9.G1 LGraphGroup`, `S9.L1 LLink direct`, `S13.SC1 nodeData inspection`, `S14.ID1 NodeLocator`, `S15.OS1 dynamic outputs`, `S7 window.LiteGraph globals`. MCP queries for these failed with HTML/DNS errors and need retry.

Top star-weighted ecosystem repos (compat blast surface): `Comfy-Org/ComfyUI-Manager` (14,531★), `Lightricks/ComfyUI-LTXVideo` (3,575★), `kijai/ComfyUI-KJNodes` (2,567★), `Comfy-Org/ComfyUI_frontend` (1,788★ — our own surface), `BennyKok/comfyui-deploy` (1,506★), `diodiogod/TTS-Audio-Suite` (905★), `melMass/comfy_mtb` (702★).

### Nodes 2.0 milestone + pain point assessment (2026-05-08 ingest)

Source: `research/architecture/notion-pain-point-assessment.md` (I-N5.1)

**Milestone framing (parent Notion page):** "Nodes 2.0 Default UI — DevRel, Docs & Migration" is a P1 milestone with 8 ordered checkpoints: (1) API + feedback loop, (2) API docs, (3) migration + tooling, (4) standards + propagation, (5) ecosystem assets, (6) announce Nodes 2.0 as main target, (7) rollout + adoption, (8) default UI flip. **Terry Jia** leads. Christian Byrne co-owns API design. 4/14 update: ecosystem audit done, synced with Terry+Jacob+Christian, "work on public API design from first principles." This project (ECS + Vue hook API) is the technical foundation for checkpoints 1–3.

**Terry's first-principles pain point assessment (2026-04-14):**

- **DX gap is 100% documentation + API surface, not a technical problem.** Vue node system is technically superior on every dimension; zero public docs or community examples.
- **P0-1**: No docs for `getCustomWidgets` / widget constructor contract — 78+ packages monkey-patch as direct result.
- **P0-2**: `ComponentWidgetImpl` fully functional internally but zero public docs — 9+ packages bundle own Vue runtime (~50KB+) unnecessarily.
- **P0-3**: V1 vs V3 schema — no getting-started path for V3; all docs are V1-only.
- **P1-1** (most impactful): 135 `onNodeCreated`, 88 `onExecuted`, 64 `onConnectionsChange` prototype patches — `chainCallback` reimplemented by 5+ packages independently.
- **P1-5**: Widget serialization contract undocumented; `widgets_values` positional array is #1 source of "workflow broke after node update" reports.

**Four new surface gaps (proposed S17 family) — not previously in DB:**

1. **S17.AM1 — App mode surface**: `appModeStore` (Pinia) inaccessible to external JS extensions. No `app.getMode()` / `node.on('canvasModeChanged')`. Affects all nodes that render differently in editor vs App mode. **NOTE:** `NodeModeChangedEvent` already in `node.ts` covers *execution mode* (muted/bypass) — canvas mode is a separate concept; needs separate `canvasModeChanged` event.
2. **S17.SB1 — Subgraph boundary propagation**: `onExecuted` doesn't cross subgraph boundary; autogrow and MatchType break inside subgraphs; promoted widget callbacks fire on internal node only. **Blocked on I-PG.B1 (post-Alex rebase).**
3. **S17.FA1 — File/asset API**: No `comfyAPI.uploadFile()` / `comfyAPI.getFileUrl()` helpers; each of 32+ packages builds its own. Upload timeout hardcoded 120s. **Out of scope for v2 node extension API; future `@comfyorg/comfy-api` package.**
4. **S17.WV1 — `widgets_values` positional fragility**: Positional array format means any input definition change (add/reorder/rename) corrupts existing workflow load. Named dict serialization is the long-term fix (breaking workflow schema change). `beforeSerialize` event in D7 Part 4 is the partial mitigation available now.

### New compat surfaces discovered this session (extending R4)

- **S6.A1 `app.graphToPrompt`** — top-ranked blast radius. Patched by ComfyUI-Manager and KJNodes (set/get virtual node resolution). Critical workflow→API serialization interception surface. v2 needs explicit `graph.on('beforeSerialize', …)` / `app.on('beforePrompt', …)`.
- **S2.N6 `onSerialize` and S4.W3 `widget.serializeValue`** — two distinct serialization surfaces, both real, both timing-sensitive. Confirms `widget-api-thoughts.md` premise that serialization is a first-class design problem.
- **S2.N7 `onConfigure`** — actively used. Replaces the dead `loadedGraphNode` hook. Workflow hydration semantics still matter; just accessed at lower level than the documented hook.
- **S2.N8 `onAdded`** — distinct from `onNodeCreated`; "now actually attached to graph" semantic. v2 needs either separate event or clearer guarantee.
- **S2.N9 `onDrawForeground`, S2.N10 `onMouseDown`, S2.N11 `computeSize`** — node-level canvas drawing, pointer interaction, and sizing/layout are real touch points. v2 cannot be limited to "data + lifecycle + widget values".
- **S6.A2 `window.app.loadGraphData`** — direct API call surface used widely (KJNodes, comfyui-deploy, Layerforge, others).
- **Supported hooks exist but the ecosystem distrusts them** — e.g. `r-vage/ComfyUI_Eclipse` uses `getCanvasMenuItems` AND prototype-patches canvas as a fallback. Migration cannot just point at existing hooks; it needs explicit compatibility tests proving parity.

### Why the expansion (2026-05-06 second pass)

After review, three additional source documents were cross-referenced to find missed touch-point classes:

1. **[ComfyUI_frontend/AGENTS.md §5](file:///home/c_byrne/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api/ComfyUI_frontend/AGENTS.md)** — the project's own constraints doc explicitly enumerates: *"`onConnectionsChange`, `onRemoved`, `onAdded`, `onConnectInput/Output`, `onConfigure`, `onWidgetChanged`, `node.widgets` access, `node.serialize`, `graph._version++` affect 40+ custom node repos."* Five of these were missing entirely — added as Tier 1 (S2.N12/N13/N14/N15/N16, S11.G1).
2. **ADR 0008** (entity taxonomy) — enumerates **six entity kinds**: Node, Link, Widget, Slot, Reroute, Group. The DB only covered Node and Widget. Added family **S9** for Reroute/Group/Link/Slot/Subgraph touch points, with the KJNodes set/get virtual node pattern (S9.SG1) cross-referenced to S6.A1.
3. **[widget-api-thoughts.md](file:///home/c_byrne/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api/widget-api-thoughts.md)** — flags the **output system** as a separate change axis (declared vs runtime-mutated). Added family **S15** to track this distinct from generic slot mutation (S10).

Plus four fully-new families derived from `src/types/index.ts` exports:

- **S10** — dynamic node API (`addInput/Output`, `connect`, `disconnect`, `setDirtyCanvas`)
- **S11** — graph-level state (`_version`, `graph.add/remove/findNodesByType`, `serialize/configure`, `beforeChange/afterChange`)
- **S12** — shell UI registries (`SidebarTabExtension`, `BottomPanelExtension`, `CommandManager`, `ToastManager` — already exported but never tracked as touch points)
- **S13/S14** — `ComfyNodeDef`/`InputSpec` schema interpretation and `NodeLocatorId/NodeExecutionId` identity helpers

DB grew **26 → 49 patterns** across **8 → 15 surface families**. Most new patterns have `evidence_status: pending-mcp-sweep` — they're tracked but not yet populated with ecosystem code-search evidence. Their blast radius will climb once swept.

### Tooling state

- ✅ `scripts/fetch-stars.sh` works (`gh api`, with `set -euo pipefail` made tolerant of empty `repos`)
- ✅ `scripts/rollup-blast-radius.py` works; produces `rollup.yaml`; reads from `database.yaml` schema (`surface`/`semantic`/`severity`/`lifecycle_coupling` per-pattern fields)
- 🟨 sweeps remaining tracked in `database.yaml` meta (`sweeps_remaining`); now broken into Tier 1 (AGENTS.md callouts), Tier 2 (entity-kind families S9), Tier 3 (original S2/S3/S4/S5/S6/S7/S8 follow-ons), Tier 4 (new families S10/S11/S12/S13/S14/S15)

## Session 2026-05-08 — Reviewer Feedback Triage + Public API Package Plan

### Reviewer feedback extraction

Subagent extracted **14 substantive review comments** from `extensionV2Service.ts` (zero in `extensionV2.ts`, the example extensions, or anywhere else — all uncertainty concentrated at the boundary between public handles and ECS internals). Grouped into **6 thematic clusters**:

| Cluster | Items | Theme | Verdict |
|---|---|---|---|
| A | F10, F12, F13 | `getX()` vs `get x()` accessor sugar | Re-affirm D3.3 (method form for state, accessor for invariants). Codified in D6 Part 3. |
| B | F4, F5, F11 | First-class fields vs options bag; persistent state model | New ADR D7 (scoping — awaiting user research on props/serialization). |
| C | F6, F8, F9 | Event vocabulary + payload typing + serialization shape | New ADR D5 (proposed). Smoking gun: R4-P4 finding (six `onConnectionsChange` signatures in wild). |
| D | F1, F7 | World access lifecycle + component nullability | Park behind D8 (ECS World ↔ Vue reactive adapter, the existing D4-G12 BLOCKER). |
| E | F2, F3 | Cross-system naming consistency | Ship "names appendix" (DOC1); skip F3 (`widgetType` stays). |
| F | F14 | Migration coverage matrix | Rescope existing P3 todo as the per-pattern coverage cross-walk against `touch-points/database.yaml`. |

### Decisions made / drafted this session

- **2026-05-08: D5 (accepted, revised)** — Event vocabulary, payload typing, serialization shape. Type every payload (no `Function` typing). `WidgetEvents` ships with **only `valueChange`** in v1 (non-value channels — options, properties — deferred to D7 per user pushback that the distinction is confusing without a settled widget data model). Replace `setSerializeValue(fn)` callback with `on('beforeSerialize', fn)` event. After verifying webcam/load3d/uploadAudio/dynamicPrompts code, the event must support **three** patterns (override via `event.setSerializedValue(v)`, skip via `event.skip()`, async I/O via Promise-returning handlers) — not just one. `beforeSerialize` is the **one async-aware event** in v1; all others sync. Resolves cluster C. Smoking guns: R4-P4 + `webcamCapture.ts:117,120`.
- **2026-05-08: D6 (accepted, revised, tentative)** — Parallel paths migration. Two distinct entry points: v1 stays as `app.registerExtension({...})`; v2 is **module-level `import { defineExtension } from '@comfyorg/extension-api'`** (NOT `app.extensions.define` — user preferred no `window.app` dependency at registration time, mirroring Vue's `defineComponent` and modern TS package convention). 4-phase sunset; Phase D **strictly gated on telemetry existing AND <5% v1 usage** — no telemetry, no removal, ever. Accessor/method rule = **hybrid (Option C)**: invariant = accessor; property-shaped state with no hidden side effect = accessor pair; action-shaped state (mutation fires events/commands) = method. Future-pivot alternatives (single-entry-point shape detection; methods-everywhere; accessors-everywhere) documented in the ADR's "Future Pivots" section so we can revisit if author feedback warrants. Resolves cluster A.
- **2026-05-08: D7 (scoping)** — Widget shape & persistence. Placeholder structure with all questions enumerated. AWAITING USER INPUT on props/serialization research before substantive write-up. CRITICAL CONSTRAINT (user): no inconsistent ad-hoc distinctions between options vs first-class — must be principled.
- **2026-05-08: D8 (scoping)** — ECS World ↔ Vue reactive adapter. Resolves D4-G12 BLOCKER. Three implementation options (reactivity in World vs handles vs adapter layer); needs spike. Cluster D parked here.

### Naming verdict

- **Drop the `v2` suffix from public-facing names.** Package versioning lives in semver (`@comfyorg/extension-api` 0.x → 1.x).
- `v2` becomes a working tag during the parallel-paths transition (D6 Phases A–D), not part of permanent file paths.
- `extensionV2.ts` and `extensionV2Service.ts` are renamed during PKG2 implementation. Folder structure becomes `src/extension-api/` (new). v1 stays in its current locations (`src/types/comfy.ts`, `src/services/extensionService.ts`, `src/scripts/app.ts:registerExtension`) — distinction is at the entry point per D6 Part 1, not the folder.

### Public API Package plan (P2)

`plans/P2-extension-api-package.md` combines idea 1 (hand-authored `.d.ts` cover letter) + idea 2 (npm package + CI + docgen). Six tasks PKG1–PKG6, one subagent prompt each in `plans/prompts/`. Single source of truth: `src/extension-api/index.ts`. Three outputs: typecheck artifact, npm package (`@comfyorg/extension-api`), MDX → docs.comfy.org.

Resolves R4-P11 (extensions vendoring `comfy.d.ts` because no published types package exists) and CONTEXT meeting-consensus "auto-doc" goal.

### Reconciliation of existing scattered type artifacts

Audited (verified 2026-05-08, no `comfy.d.ts` exists in worktree — extension authors are vendoring their own copies). See P2's "Reconciliation" table for full disposition. Highlights:

- `src/types/index.ts` (currently the only barrel in `/src`) → migrate exports to `src/extension-api/index.ts`; leave deprecation stub for one release.
- `src/types/comfy.ts` (v1 `ComfyExtension`) → **leave in place.** Custom extensions in the wild use `window.app.registerExtension` (a runtime API in `src/scripts/app.ts`), not this type file. ~30 internal imports point at `@/types/comfy`; moving them is pure churn. v1↔v2 distinction lives at the *entry point* (D6 Part 1), not in folder location. **Earlier this session I scaffolded `src/extension-api-v1-compat/` — deleted on user pushback.**
- `src/types/extensionTypes.ts` (shell UI) → move to `src/extension-api/shell.ts`.
- `src/types/extensionV2.ts` → split into per-entity files under `src/extension-api/`.
- `src/services/extensionV2Service.ts` → rename to `src/services/extension-api-service.ts`.

### Barrel-file rule conflict (note for later)

ComfyUI_frontend AGENTS.md rule #19 ("don't use barrel files in `/src`") would forbid `src/extension-api/index.ts`. Exception: this barrel IS the published-package entry point, not an internal re-export. Document the exception when PKG2 lands.

### Open questions deferred from this session

- D7 substantive write-up — user has shared props/serialization research at `research/architecture/widget-props-serialization-from-slack.md` (D7-INPUT done). Next: incorporate into D7's questions.
- D8 implementation spike — needs prototyping work before decision.
- D6 Q1 (D6.1 sub-ADR) — internal bridge architecture (how v2 ECS-backed impl exposes v1-shaped surface for v1 extensions). Hardest implementation question. Deferred.
- D5 Q3 — multi-extension hook ordering on the same event. Tracked in D10b.
- D5 Q4 — verify during PKG2 whether `BeforeSerializeEvent` needs `workflowNode`/`widgetIndex` in payload (current v1 `dynamicPrompts.ts` handler signature includes them).
- D6 telemetry implementation design (Q3) — needed before Phase D can ever happen.

## People

- **Jacob Segal**: Product/engineering lead. Championing explicit public API. Wants API-consumer-first design.
- **Christian Byrne**: Frontend architect. Owns ECS ADR. Designing the hook+ECS bridge. Vue-inspired model advocate.
- **Alex Brown**: Frontend lead. Owns ECS implementation. "Component as trigger" model for systems.
- **Terry Jia**: Custom node expert. Knows the ecosystem deeply. Concerned about community adoption.
- **Kaili Yang**: Frontend. Agrees ECS structure stabilization is the priority.
- **Simon Tranter**: Frontend. Testing/refactoring focus.
- **Austin**: Frontend. Owns widget v2 work (`austin/widgets-v2`, `austin/fix-linked-widget-promotion`, `austin/undefined-widgets-fix`). Coordination point for I-WS lazy serialization and I-API widget surface.

## Implementation Phase Kickoff (2026-05-08)

Standup-derived goals translated to tasks I-TF / I-PG / I-WS / I-SR / I-API / I-COORD in `todo.md`. Branch topology under `extension-v2-api-proposal`:

- I-TF (test framework) merges first; everything else rebases on top
- I-PG (prototype access guarding / strangler fig) — gates D9 (interception mechanism ADR)
- I-WS (lazy widget serialization) — overlaps `austin/widgets-v2`, `docs/widget-serialization`; coordinate
- I-SR (scope registry & lifecycles) — implements D2/D3.5/D6; gates D10 (currentExtension vs ctx-injection + hook ordering)
- I-API — finish widget API stub wiring (yesterday's paused WIP)
- I-COORD — convert 3–5 core extensions to give Simon/Austin a concrete artifact; plan Alex rebase next week

### Cross-references validated against actual code

- 26 behavior categories ≈ 29 semantic clusters when 52-pattern R7 DB is rolled up by intent (lifecycle / widget IO / canvas drawing / execution events / serialization / shell UI / schema / etc.). Final count expected 25–30.
- Widget-api-thoughts edge cases all confirmed in `src/extensions/core/`: `webcamCapture.ts` (hot-path perf), `load3d.ts` + `load3dLazy.ts` (file upload), `uploadAudio.ts`, `uploadImage.ts`, `painter.ts`, `maskeditor.ts` — all touch widget-value materialization in non-trivial ways.
- Three serialization surfaces today (S4.W3, S2.N6, S2.N15) — collapsing to one lazy-on-access getter is the I-WS thesis.
- Test-framework spec already lives in `research/touch-points/PLAN.md` §Integration: every pattern_id → test triple (v1 contract / v2 contract / migration); `blast_radius ≥ 2.0` is the compat-floor gate.
- Alex's ECS work lives on a separate branch (ADR 0008 authored at commit 3e197b5c5, not in working tree). I-COORD.2 needs to confirm exact branch name before rebase planning.
- Existing related branches in `ComfyUI_frontend`: `extension-v2-api-proposal` (head), `austin/widgets-v2`, `bl-vue-widget`, `docs/widget-serialization`, `dom-widget-positioning-with-async`, `async-frontend-extensions`, `cursor/make-widget-registry-components-async-*` — substantial concurrent activity in this surface area; merge ordering matters.
- Latest `dfe6408bc docs(arch): add v2 extension API touch-point database` confirms our R7 work has just landed on `extension-v2-api-proposal` — green baseline for I-TF.

### Standup ingest follow-ups (2026-05-08, second pass)

- **Strangler fig has THREE distinct shapes**, not one. Reflected in `I-PG.A` (surface-only shim, current branch) → `I-PG.B` (closer-to-real, post-Alex rebase) → `I-PG.C` (legacy-API strangler over v1 hooks we never rewrote, "parallel path" migration). My first I-PG block collapsed all three; corrected.
- **Mechanism axis was missed** in I-TF.1 first pass. `widget-api-thoughts.md` §Test Framework explicitly enumerates `prototypes (patching / constructor patching / shadowing)` and `monkey patching (setters / getters / methods)` as orthogonal to behavior categories. Test framework asserts BOTH axes per category.
- **ADR 0006 (primitive node copy/paste lifecycle)** and **ADR 0007 (node execution output passthrough schema)** exist in `ComfyUI_frontend/docs/adr/` but are NOT in our knowledge pool. Queued via I-NEW.1/2. ADR 0006 directly affects I-SR (does scope clone on copy?). ADR 0007 may reframe I-WS scope (widget output declaration).
- **`austin/widgets-v2` is stale** — last commit `9e8a426c0` 2025-09-28 (~7 months old). Subgraph widget promotion + recommended-widget conversion. Likely superseded. Don't assume foundation; ping fresh per I-WS.5.
- **`ecs-vue-hoisted-client-state-hook-api` worktree git diff is clean.** User mentioned "check git diff" for Phase B strangler shape — must mean a different worktree. Need clarification.
- **D10 placeholder concretized** as four sub-decisions D10a–D10d in `I-NEW.3`: (a) lifecycle context mechanism, (b) multi-extension hook ordering, (c) async setup, (d) setupState proxyRefs wrap. I-SR.4/5 marked done in todo but no `decisions/D10-*.md` exists yet — confirm whether resolved inside D5–D8 or mismarked.
- **Concurrent agent activity in this workspace.** D5–D8 decisions and additional I-TF/OPT/R8/R9/R10 tasks were added since my first pass. Be careful not to overwrite — diff before edit, append rather than replace.

### Standup ingest follow-ups (2026-05-08, third pass — Slack + worktree state)

- **Alex's rebase target identified:** PR [#11939](https://github.com/Comfy-Org/ComfyUI_frontend/pull/11939) `feat(world): ECS substrate slice 1` (May 4, draft), stacked on PR [#11811](https://github.com/Comfy-Org/ComfyUI_frontend/pull/11811) `fix(subgraph): restore promoted widget instance state` (May 1, has a bug Austin found). Both needed per Alex Slack 2026-05-08 17:33 ("we'll probably need both"). Risk: Alex said "might be worth just keeping the tests from #11811 and solving the issue differently in the ECS" — base may pivot. PR #11706 (`feat(world): add ECS substrate, rewrite widgetValueStore as facade`, Apr 27) is the unstacked alternative. I-COORD.2 updated.
- **ComfyUI_frontend worktree IS dirty** (my prior "clean" check missed untracked files). Active untracked work: `src/extension-api/` + `packages/extension-api/` (PKG2/PKG3 scaffolds, READMEs only so far), `src/services/extensionV2Service.ts` (Phase A surface — already imports from `@/ecs/world` and `@/ecs/commands` which DON'T exist yet, anticipating #11939), `src/types/extensionV2.ts`, plus four `.v2.ts` core extension conversions (`dynamicPrompts.v2.ts`, `imageCrop.v2.ts`, `previewAny.v2.ts`, plus `imageCrop.v2.ts`). This is what user meant by "check git diff" — Phase A is already substantially scaffolded.
- **R7 database expanded again:** latest commit `4d37194be docs(arch): pass-2 evidence sweep (52→56 patterns, 174→195 evidence)`. Now 56 patterns / 195 evidence rows. Shipped to repo at `docs/architecture/extension-api-v2/touch-points-database.yaml`.
- **ADR 0006 ingested (I-NEW.1 done).** Key correction: scope is PrimitiveNode-specific widget value loss, not general node copy lifecycle. Intersects I-WS (lazy serialization) not I-SR. Source ADR status: Pending. Spawned I-NEW.1b — separately specify `NodeInstanceScope` copy/paste semantics (clone vs share vs reset → D12 candidate).
- **D9 written (I-PG.A2 done).** `decisions/D9-strangler-fig-phases.md` — full 3-phase ADR. Phase A (surface-only, current) → Phase B (post-Alex rebase, ECS dispatch) → Phase C (legacy-API strangler, deferred). Interception mechanism choice deferred to D11 (Phase C-time).
- **D10 sub-decisions parked as TODOs** (per user "just put as todo items for now"): D10a context mechanism, D10b hook order, D10c async setup, D10d setupState wrap. No defaults committed; revisit when implementation forces a pick.

## Notion API Usage Research Ingestion (2026-05-08)

Source: team-authored Notion page (2026-04-07), ~58 packages, ~290 JS/TS files, local file-walk methodology.
Artifact: `research/architecture/notion-api-usage-research-summary.md`
Staging: `research/touch-points/staging/notion-api-research-evidence.yaml`

### New patterns added to staging (not yet merged into database.yaml)

New surface family **S16 — DOM injection** (4 patterns):
- **S16.DOM1** `createElement('style')` + head.appendChild — 354 occ, 81 packages
- **S16.DOM2** `document.body.appendChild` — 364 occ, arbitrary DOM into body
- **S16.DOM3** `innerHTML` concatenation — 443 occ, XSS risk
- **S16.DOM4** direct `fetch()` bypassing `api.fetchApi` — 232 occ

New patterns in existing families:
- **S16.VUE1** bundled Vue runtime inside DOM widget — 9 packages, each ships own copy
- **S3.C2** `LiteGraph.ContextMenu = function(...)` global replacement — Easy-Use, severity critical
- **S6.A5** `api.apiURL` patching — rgthree, redirects /rgthree/* routes globally
- **S12.UI2** `settingsLookup` direct mutation — Easy-Use replaces another extension's onChange

### New behavior categories (behavior-categories.yaml updated)

- **BC.31** DOM injection and style management (S16.DOM1–4) — 32 categories total now
- **BC.32** Embedded framework runtimes / Vue widget bundling (S16.VUE1)
- **BC.06** updated: S3.C2 added as member

### Key quantitative signals confirmed or upgraded

- `onNodeCreated` — 135 occ (largest count yet for S2.N1)
- `onExecuted` — 88 occ (confirms S2.N3 as universal "show output" pattern)
- `onConnectionsChange` — 64 occ (six signature variants = D5 smoking gun)
- `LiteGraph.*` — 313 occ across 95 packages (S7.G1 blast radius likely understated)
- `onResize` patching — 24 files (S2.N19 upgraded from evidence-light)
- `chainCallback` independently reimplemented by 5+ packages (strongest DEP2 evidence yet)
- DOM injection counts (354–443) are among the highest raw occurrence counts in the entire dataset

### Vue composables (§6) — direct evidence for I-SR / I-API design

Notion §6 identifies four composables available from existing frontend observation code:
`useNodeSize()` (57 files), `useNodeExecutionOutput()` (88 patches), `useNodeConnections()` (64 patches),
`useNodeLifecycle()` — all map to I-SR lifecycle scope and I-API widget accessor design.
This is the strongest existing-system evidence that the composable direction in P1 §7 is correct.

### Pending: merge task I-N4.1

Staging data not yet merged into database.yaml. Pending `scripts/merge-staging-notion.py` (task I-N4.1).
After merge, re-run `scripts/rollup-blast-radius.py` to update BC.31/BC.32 usage_weight.

## D7 — Widget Shape & Persistence (2026-05-08, substantive write-up)

**Status: proposed.** Full ADR at `decisions/D7-widget-shape-and-persistence.md`. Resolves reviewer feedback cluster B (F4, F5, F11) and the Primitive Int/Float Slack design thread.

Key decisions:

- **Principled rule (F4/F5):** Universal-vs-typed. Every-widget concerns are first-class (`label`, `hidden`, `disabled`, `value`, `serialize` opt-out). Type-specific concerns are in the options bag (`min`/`max`/`step`, `multiline`, `upload_to`, etc.). This directly justifies `isHidden()/setHidden()` and `label` as first-class — they apply to INT, FLOAT, STRING, COMBO, BUTTON, and DOM widgets equally.

- **Three-tier persistence model (F11):** (1) Value — serialized everywhere (workflow, prompt, copy, subgraph). (2) Options — class defaults from `INPUT_TYPES`; per-instance overrides serialized as `widget_options` sidecar in workflow JSON only. (3) extensionState — NOT persisted (fresh setup on copy per D12; not on disk). `node.properties` v1 bag remains as migration shim on `NodeHandle`, not as the v2 canonical pattern.

- **Per-instance widget config (Slack Primitive Int/Float):** Per-instance `min`/`max`/`step` overrides stored on `widget._options_overrides`, serialized as `widget_options[i]` sidecar array in workflow JSON parallel to `widgets_values`. Survives copy/paste, subgraph promotion (via `ExposedWidget.overrides`), reload. Optional value-envelope `{value, min?, max?, step?}` in API prompt for opt-in backend metadata; unwrapped by a 7-line addition to `execution.py`. Migration shim folds legacy `node.properties.{min,max,step}` from PR #7768 into the new slot on `configure()`.

- **Four serialization surfaces → two:** `widget.serializeValue` + direct `widget.value` + `node.onSerialize` + `nodeType.prototype.serialize` collapse to: (a) `widget.on('beforeSerialize', event => ...)` (per-widget, async, fires for workflow AND prompt, with `event.context` flag), (b) `node.on('beforeSerialize', event => ...)` (per-node, replace `onSerialize` append + `prototype.serialize` wrap). `event.context = 'clone'` means the ADR 0006 `prototype.serialize` workaround is unnecessary in v2.

- **`WidgetHandle` shape (Part 5):** Specified for PKG2. First-class methods: `getValue/setValue`, `isHidden/setHidden`, `isDisabled/setDisabled`, `setSerializeEnabled/isSerializeEnabled`. Options bag: `getOption<T>(key)/setOption<T>(key, v)`. Events: `on('beforeSerialize', handler)`, `on('valueChange', handler)`.

**Unblocked by D7:** PKG2 (`WidgetHandle` declaration file), I-WS.3 (lazy getter design has the target shape).

**Still open:** D8 (reactivity wiring for `getValue/setValue`), I-WS.3 implementation (memoized async getter for webcam/load3d/uploadAudio), backend `execution.py` 7-line unwrap (separate coordination), API prompt envelope as default (future pivot gated on backend tooling updates).

## Task Decomposition (2026-05-08)

Five large implementation workstreams decomposed into independently-assignable sub-tasks. Full sub-task graph recorded in `todo.md` under the "Parallel Dispatch Guide" section at the bottom. Summary:

- **I-TF.2** (78 test stub files) → 6 sub-tasks (A1 gate → A2/A3/A4/A5/A6 parallel). No blockers.
- **I-SR.2/3** (scope registry + reactive dispatch) → 5 sub-tasks (B1 spike → B2 deep impl → B3+B5 parallel → B4 dispatch watcher). Stub `world.queryAll` with `// TODO(D8)` if D8 not yet done.
- **I-TF.3–5,7** (harness + CI gate) → 6 sub-tasks (C1 contract doc → C2 impl → C3/C4/C5/C6 sequential). C3 needs I-TF.2 done; C6 needs C5 + I-TF.2.
- **PKG3–6** (npm package, CI, docgen, docs) → 7 sub-tasks (D1/D3/D5 parallel → D2/D4/D6 sequential). D2/D6/D7 blocked on **PKG2**.
- **EVT1–3, MIG1, DOC1** (event typing, entry-point spike, names appendix) → 6 sub-tasks (E1/E4/E6 parallel → E2 → E3; E5 blocked on **PKG2**).

**Wave 1 (start immediately, all independent):** I-TF.2.A1, I-SR.2.B1, I-TF.3.C1, PKG3.D1, PKG4.D3, PKG5.D5, EVT1.E1, MIG1.E4, DOC1.E6.

**Hard blockers remaining:**
- D8 (ECS World ↔ Vue adapter) — stub around with `// TODO(D8)`; does not block Wave 1/2
- PKG2 (`src/extension-api/index.ts`) — blocks PKG3.D2, PKG5.D6, PKG6.D7, MIG1.E5
- Alex's PR #11939 rebase — blocks I-PG.B and full I-SR.3 reactive dispatch (world.queryAll must be real)
- R9 staging merge — 3 of 6 sources staged, not yet in `database.yaml`; `scripts/merge-staging-pass3.py` exists

**R10 inconsistency:** Marked `[x]` in prior session but no lockfile and `research/touch-points/orphan-exports.md` is missing. Reset to `[ ]` in todo.md.

## Issue #4668 + `feat/import-based-api-versioning` Branch (2026-05-08)

Source: GH issue #4668 + branch `feat/import-based-api-versioning` (SHA 97547434b). Artifact: `research/issues/issue-4668-import-based-api-versioning.md`.

### What the branch actually ships

`src/services/extensionService.ts` extended with:
- `registerExtensionWithVersion(extension, apiVersion)` — tags `ext.apiVersion`
- `invokeExtensionsForVersion(hook, version, ...args)` — version-filtered dispatch + Proxy arg transform
- `invokeExtensionsForAllVersions(hook, ...args)` — fan-out across `['latest','v1','v1_2','v3']`
- `transformArgsForVersion(version, args)` — duck-types node defs by `arg.name: string` and wraps in `VersionProxies`
- `getExtensionVersionReport()` — groups `ext.apiVersion`; returns `{total, versionGroups, details}`

`VersionProxies` class does bidirectional canonical↔v1/v1_2/v3 Proxy field mapping. `frontend-v3-compatibility-plan.md` is a full architecture doc with type defs and transform pipeline.

No new browser test exercises the versioned path. No `@/scripts/app/v1.ts` entry-point files exist. The import-path versioning is a plan doc only; the actual wired code is the versioned dispatch in `extensionService.ts`.

### What this approach does NOT solve (keep our decisions)

- Still `app.registerExtension(...)` at the call site — user explicitly rejected window.app dependency at reg time (D6).
- No lifecycle scope / EffectScope — no teardown story.
- Proxy covers only `beforeRegisterNodeDef` schema args — runtime node state still on LGraphNode.
- Import-path versioning (`@/scripts/app/v1_2`) is an internal Vite alias; external authors can't consume it without vendoring frontend source. Our `@comfyorg/extension-api` npm package (PKG2–PKG6) solves the external author case.
- "Signals-driven" in issue body — superseded by D3.3 (events over signals, grounded in R4).

### Extractable lessons (cross-referenced to tasks)

1. **`VersionProxies` = I-PG.C1 reference impl.** When Phase C legacy-API strangler lands, the canonical↔v1 Proxy transform in `VersionProxies.createV1Proxy` is the mechanism shape. Study it at I-PG.C1 time; don't reinvent.

2. **`getExtensionVersionReport()` = D6 telemetry primitive.** D6 Phase D gates on "<5% v1 usage". `versionGroups['v1' | 'latest']` is the signal. We should include `apiVersion` on `ExtensionOptions` in our D6 implementation for feature parity.

3. **Duck-type detection is fragile; use branded IDs.** `arg.name: string` matches any named object. Our ECS-backed equivalent should key on `NodeEntityId` branded number, not shape heuristics.

4. **`v2_combo_input` test fixture.** `browser_tests/assets/node_with_v2_combo_input.json` contains `DevToolsNodeWithV2ComboInput` with `widgets_values: ["A"]` — useful seed for I-TF.3 harness (widget value access via `NodeHandle.widget("...")`).

5. **Cross-version fan-out is concurrent.** `invokeExtensionsForAllVersions` uses `Promise.all` across version groups. In our system D10b requires serial ordering *within* a version group, but cross-group dispatch could still fan out in I-SR.3.

### D6 alternative: import-based versioning (NOT adopted, tracked for reference)

The branch approach is a concrete, working alternative to our D6 module-level import design. It is **not being adopted** because it fails the external-author case and the window.app constraint. Tracked as a future-pivot option in `decisions/D6-parallel-paths-migration.md` "Future Pivots" section (task: add note there). The proxy-based compat layer component of this approach *is* planned — it's our D9 Phase C strangler mechanism.

## Widget Serialization Historical Analysis (2026-05-08, Notion source)

Source: `research/architecture/widget-serialization-historical-analysis.md`
Notion URL: https://www.notion.so/comfy-org/Widget-Serialization-in-Frontend-A-Historical-Analysis-of-a-Structural-Flaw-3596d73d36508084b016ebeefd372572

### Root cause confirmed

`widgets_values` is a positional array with no widget identity. The implicit "widget at index i = value at index i" contract breaks silently whenever the widget list changes. No checksum, version field, or schema hash exists.

### Three sources of index drift

1. **`control_after_generate`**: has `widget.options.serialize = false` (excluded from backend prompt) but NOT `widget.serialize = false` (still occupies a slot). Pre-dated workflows have one fewer entry → every subsequent widget shifts left by 1.
2. **Extension-injected serializable widgets**: version changes or removal shift all subsequent slots. Workflow file cannot detect the mismatch.
3. **V3 `IO.MultiType` dynamic widgets**: widget count is topology-dependent (changes with connection state). Index contract collapses entirely.

### Two serialize properties — the maintenance trap

| Property | Effect |
|---|---|
| `widget.serialize === false` | Excluded from `widgets_values` — no slot at all |
| `widget.options.serialize === false` | Has a slot; saved/restored; excluded from backend prompt |

`control_after_generate` is the canonical type-2 widget. Getting this wrong shifts indices for everyone.

### The NaN→null pipeline (concrete failure chain)

Index shift → string in numeric slot → `Number("fixed") === NaN` → `JSON.stringify` produces `null` → next load assigns `null` → `int(None)` throws in Python `execution.py` ~line 960. Backend crash is the first visible symptom.

### Current fixes

- **PR #11884**: intercepts `null`/non-finite at `configure()` for built-in numeric widget types (`widgetMap.ts` `NUMERIC_WIDGET_TYPES`); substitutes node-definition default. Reviewer concern (AustinMroz): silent wrong-value substitution; `seed = 42` silently becomes `seed = 0`. Must log, not silently swallow.
- **PR #10392**: adds `widgets_values_named: {}` — always writes named map alongside positional array. When `LiteGraph.namedValuesRestore` flag is on, `configure()` uses names → index shifts become harmless. Also adds `fallbackWidgetsValuesNames` field to `/object_info` (`src/schemas/nodeDefSchema.ts`) so node authors can declare old positional order for pre-migration workflows. Bug in original: wrote `if (val !== null)` to named map, dropping intentional nulls — correct behavior is always write.

### Correct maintenance rules

- **Append only**: inserting a widget mid-list is a breaking change for all saved workflows.
- **Migration path for breaking changes**: provide `fallbackWidgetsValuesNames` in `/object_info`.
- **Legacy positional path cannot be removed** until confident no pre-`widgets_values_named` workflows remain.
- **Null at configure() = corruption evidence**: log it, don't silently substitute.

### Implications for open tasks

- **I-WS.3** (lazy getter): must preserve `widget.serialize` vs `widget.options.serialize` distinction; V3 dynamic widgets mean `WidgetHandle` identity must be by name not position.
- **D7 3-tier persistence matrix**: maps to (a) `widget.serialize=false` = ephemeral, (b) `widget.options.serialize=false` = frontend-persistent, (c) neither = backend-persistent.
- **EVT2** (`on('beforeSerialize', fn)`): `BeforeSerializeEvent` payload targets widget by name, not index; must align with `widgets_values_named` structure.
- **BC.12 / BC.13 test triples**: must cover `options.serialize=false` case; null-in-numeric-widget regression; positional vs named path round-trip parity.

## Notion COM-3668 — APIs Required by Custom Scripts (2026-05-08 ingest)

Source: Notion task COM-3668, Simon Tranter, 2025-05-10/11/12. Status: Done.
Artifact: `research/architecture/notion-custom-scripts-api-requirements.md`.
Source entry: `sources.yaml`.

**Three new gaps identified and added to database.yaml + behavior-categories.yaml:**

- **S4.W6 / BC.33** — DOM widget creation hook (cross-extension observer). Autocomplete needs to attach to any DOM widget created by any other extension. No v1 hook exists. v2: `onDOMWidgetCreated(handler)` in setup context.
- **S12.UI3 / BC.34** — Settings-integrated custom dialog. Currently worked around via S16.DOM3 (innerHTML injection). v2: `app.ui.openDialog(Component)` or settings entry `type: 'dialog-trigger'`.
- **S6.A5 / BC.35** — Pre-queue widget validation. Currently worked around via S6.A4 queuePrompt monkey-patching (silent breakage when multiple extensions patch). Distinct from D5 `beforeSerialize` (transforms values). v2: `widget.on('beforeQueue', event => event.reject('msg'))`.

**Simon's canvas drawing veto (2025-05-12):**
> "Various features are too hacky/specific to implement APIs for (e.g. overriding litegraph drawing functions) so shouldn't be considered imo"

This is authoritative — Simon is the designated core-extension converter (I-COORD.1). Logged in BC.06 `v1_scope_note`. Confirms S3.C* out of v2 v1 scope. Supports D9 Phase C deferral. S3.C* stays in DB for blast-radius tracking but v2 need not provide 1:1 replacement.

**Existing patterns confirmed by COM-3668 (no DB changes needed):**
- Arrange graph → S11.G* ✓
- Modify node definitions → S1.H2 ✓
- Context menu items → S3.C*/S1.H3/H4 ✓
- Event on node executed → S5.A1/S2.N2 ✓
- Dynamic inputs/outputs → S10.D1 ✓
- Base vs actual widget value (dynamic prompts) → S4.W3/S15.OS1/D7 ✓

**DB state after ingest:** 62 patterns / 35 behavior categories.
- **S4.W3, S2.N15, S2.N6, S2.N16** DB patterns: all informed by positional-array root cause; named-map is the v2 migration path for each.

## Session 2026-05-08 — Widget Component APIs (Notion ingest)

Source: [Widget Component APIs](https://www.notion.so/comfy-org/Widget-Component-APIs-2126d73d365080b0bf30f241c09dd756) — child of "Define component widget API" Notion task. Artifact: `research/notion/widget-component-apis.md`.

**What it is:** Defines the public prop API surface exposed to custom node developers for each PrimeVue widget component. Two authors: Christian Byrne (implementation), Pablo (design exclusion criteria).

**15 widget components in scope:** Button, InputText, Select, ColorPicker, MultiSelect, SelectButton, Slider, Textarea, ToggleSwitch, Chart, Image, ImageCompare, Galleria, FileUpload, TreeSelect.

**Exclusion rule (Pablo):** Strip `style`, `class`, `dt`, `pt`, and all `*Class`/`*Style` variants. No CSS escape hatches. Include everything else (functional props).

**Status:** WIP — ToggleSwitch is the only completed entry. All others are empty blocks pending playground review.

**Key connections to this project:**

1. **D7 future pivot** — The `Pick<ComponentProps, ...>` types are the concrete per-component typed options bags described in D7's future pivot (`WidgetHandle<T, Opts extends WidgetOptions>`). This page will be the source of truth for those types once complete.

2. **D7 Part 1 confirmation** — `disabled` and `readonly` appear as ToggleSwitch props AND as D7 first-class WidgetHandle fields. The mapping is: these props on PrimeVue components → `isDisabled()/setDisabled()` / `isReadonly()/setReadonly()` on WidgetHandle (every-widget, not in options bag). `getOption` covers the remainder.

3. **D7 Part 3 (widget_options sidecar)** — The Python `Component.Input(...)` pattern is the backend `INPUT_TYPES` counterpart. The per-instance overrides stored in `widget_options` sidecar must be schema-compatible with these typed Python inputs. Backend coordination needed.

4. **I-TF.2 (test stubs)** — The 15-component list gives the concrete widget-kind enumeration for BC.33 test triples. Each component needs: options-prop round-trip test, `disabled`/`readonly` → first-class field mapping test, `modelValue` ↔ `getValue()/setValue()` round-trip.

5. **PKG2** — When this page is complete, the `Pick<>` types map directly to the `getOption` key set documented in `WidgetHandle`. Cross-walk needed before PKG2 is finalized.

6. **Galleria layout props** — Pablo excluded `thumbnailsPosition` and `indicatorsPosition` (predefined layout options, not CSS). These are functional, not styling. Worth a design flag: should extension authors control widget layout positions? Not resolved.

**Action item:** Re-fetch this page when complete (14/15 type blocks still empty) and update D7 typed-options-bag mapping.

## Unified Workflow Format (UWF) — Frontend Implementation Plan (2026-05-08)

Source: https://www.notion.so/comfy-org/Unified-Workflow-Format-Frontend-Implementation-Plan-3316d73d3650810abd07dcfb48daffff
Research artifact: `research/architecture/notion-uwf-frontend-impl-plan.md`
Tasks: I-UWF.1–I-UWF.9

### Core finding

The UWF plan is the **official deprecation path for S6.A1** (graphToPrompt monkey-patching, blast radius #1). The three-phase plan:

- **Phase 1** — Ship `widgets_values_named` (Austin PR #10392): named key-value pairs alongside positional `widgets_values`. `widgetValueStore` infrastructure (PR #8594) already merged. Fixes root cause of S17.WV1.
- **Phase 2** — Save workflows directly in unified format (spec + layout + metadata). Single payload, not two.
- **Phase 3** — `graphToPrompt` becomes deterministic (no runtime transforms); custom nodes need migration path.

Phase 3 resolves S6.A1 via **save-time materialization** (virtual wiring resolved into real `spec.edges` at save, not at queue time). This is a fourth classification for I-PG.B2: `uwf-resolved`, alongside `ecs-native | strangler-bridge | unchanged-legacy`.

### Four gaps vs current v2 plan

- **GAP-UWF-1** — No app-level `beforePrompt` / `onBeforeWorkflowSave` hook. Per-node `beforeSerialize` cannot handle cross-node transforms (virtual node resolution, cg-useeverywhere auto-wiring). See I-UWF.4.
- **GAP-UWF-2** — No first-class virtual-node declaration. `isVirtualNode=true` (S8.P1) is a magic flag; UWF Phase 3 needs extensions to declare resolution logic, not patch `graphToPrompt`. See I-UWF.5.
- **GAP-UWF-3** — No cross-node value sync API. Global seed sync rewrites values across multiple nodes at graphToPrompt time; UWF Phase 3 requires explicit named values in spec. See I-UWF.6.
- **GAP-UWF-4** — D5 `context` enum may need a UWF Phase 2 value (`'workflow'` currently means LiteGraph JSON save; UWF Phase 2 changes what "save" produces). See I-UWF.7. Low urgency.

### Coordination notes

- I-WS.3 (lazy value getter) must be checked for compatibility with `widgets_values_named` before implementation (I-UWF.8).
- DEP3/DEP4 (remove monkey-patching docs, migrate core extensions) depend on UWF Phase 3 landing — cannot honestly tell authors to stop patching `graphToPrompt` until Phase 3 exists.
- Austin's PR #10392 status: open, changes requested by DrJKL. Track progress.
- Parent backend spec page (https://www.notion.so/3316d73d3650811587abd9c611e456dc) not yet ingested — see I-UWF.9.

## Notion Frontend Architecture Page (2026-05-08, 3536d73d)

**Source:** https://www.notion.so/comfy-org/ComfyUI-Frontend-Architecture-3536d73d365080589f10f0a19594fc83
**Artifact:** `research/architecture/frontend-architecture-overview.md`

### Four-layer stack (authoritative)

```
Layer 4 (Future)        ECS + CRDT Layout System           <- ADR-0003, ADR-0008 (planned)
Layer 3 (Present)       Pinia Stores + Vue 3 + Composables <- 93 composables, 46 stores
Layer 2 (Transitional)  scripts/ global singletons         <- app.ts 71K, api.ts 42K
Layer 1 (Foundation)    LiteGraph canvas engine            <- src/lib/litegraph/
```

Mixing layers 2 and 3 is intentional. Layer 2 is compat-only — new logic must go through Layer 3.

### Extension lifecycle timing (authoritative)

| Callback | When | Key hazard |
|----------|------|-----------|
| `init()` | ComfyUI initializing | DOM may not exist |
| `setup()` | After all extensions ran `init()` | Safe for cross-extension coordination |
| `nodeCreated()` | After LiteGraph node created | **VueNode NOT yet mounted** |
| `afterConfigureGraph()` | After workflow finishes loading | Graph fully hydrated |

**Critical:** `nodeCreated` fires BEFORE the VueNode Vue component mounts. `waitForLoad3d` in
`src/extensions/core/load3d.ts` is the canonical v1 fixture. v2 maps this to `onNodeMounted()`.

### D8 confirmation

`app.rootGraph` is not Vue reactive — reading it inside `computed`/`watch` does NOT trigger updates.
This is the exact gap D8 (ECS World ↔ Vue reactive adapter) must solve. Stores update at the
right moments; direct graph reads must happen inside `onMounted` / event callbacks.

### New behavior category: BC.37 (VueNode bridge timing — deferred mount access)

- **Intent:** Extensions registering in `nodeCreated` that need VueNode-backed state must defer to `onNodeMounted` (v2) or `waitForLoad3d` style (v1).
- **Member patterns:** S4.W5
- **Informs:** I-SR.2.B2 (scope setup cannot sync-access VueNode), I-TF.3.C1 (harness must simulate two-phase mount), I-TF.2 test triple for BC.37.

### BC category fixes (2026-05-08)

- BC.01 updated with VueNode timing note (nodeCreated→deferred mount).
- BC.33 (duplicate, was "PrimeVue widget API") renumbered to BC.36.
- behavior-categories.yaml `category_count` updated: 35 → 37.

### Key stores (9 confirmed)

`executionStore`, `nodeDefStore`, `nodeOutputStore`, `workflowStore`, `commandStore`, `toastStore`, `domWidgetStore`, `canvasStore`, `appModeStore`

Relevant to I-COORD.1: converted core extensions can use these instead of `app.*` direct access.

### Testing standards (official, informs I-TF)

- Vitest for unit/component — **no mocking what you don't own**
- Playwright for E2E — **no `waitForTimeout`**; use `waitForResponse` or retrying assertions
- `@testing-library/vue` for components — behavior-driven, no asserting on CSS classes

## Workflow Serialization Historical Analysis (2026-05-08, Notion source)

Source: `research/architecture/workflow-serialization-historical-analysis.md`
Notion URL: https://www.notion.so/comfy-org/Workflow-Serialization-in-ComfyUI-Frontend-A-Historical-Analysis-3596d73d365080c9ba69e945df831c1b
Date published: 2026-05-07. Status: To Do (team has not yet actioned).

### Three-format system (confirmed with file locations)

ComfyUI serialization is three overlapping formats that have never been fully unified:
1. **Workflow JSON** — `LGraph.serialize()` → `LGraph.ts:2378` → version 0.4 `ISerialisedGraph`
2. **API prompt** — `graphToPrompt()` pass 2 → `executionUtil.ts:27` → `ComfyApiWorkflow`
3. **extra_pnginfo embed** — travels inside `extra_data.extra_pnginfo.workflow` in POST `/prompt`

`graphToPrompt()` at `src/utils/executionUtil.ts:27` is the load-bearing bridge. Extensions patch S6.A1 because no `beforePrompt`/`onBeforeWorkflowSave` app-level hook exists — UWF Phase 3 is the planned resolution.

### Two serialize flags — confirmed authoritative

| Property | Effect | Mechanism |
|---|---|---|
| `widget.serialize === false` | Excluded from `widgets_values` — no slot | `LGraphNode.serialize()` line 944 |
| `widget.options.serialize === false` | Has slot, saved/restored; excluded from API prompt | `executionUtil.ts:99` |

`control_after_generate` is type-2: slot exists in workflow JSON, never sent to backend. Getting flags wrong = silent index drift for every saved workflow of that node type.

### `graphToPrompt()` internal steps (exact sequence)

1. `node.applyToGraph()` on all virtual nodes (PrimitiveNode, Reroute) — materializes connections
2. `graph.serialize({ sortNodes })` → 0.4-format `ISerialisedGraph`
3. Strip `localized_name` from all slots (lines 47–53)
4. `compressWidgetInputSlots(workflow)` (`litegraphUtil.ts:259`) — removes unconnected widget-backed input slots
5. Stamp `workflow.extra.frontendVersion`

### Special value transformations (canonical reference)

- **Array widgets** → `{ __value__: array }` — backend unwraps at `execution.py:956`
- **Curve widgets** → `{ __type__: 'CURVE', __value__: array }` — `__type__` has NO current backend consumer (forward decoration)
- **Node links** → `[String(origin_id), parseInt(origin_slot)]` — `is_link()` at `graph_utils.py:7` requires `[0]` string, `[1]` integer

### Historical bugs (concrete, test-relevant)

- **Index drift** — `control_after_generate` absent in old workflows → every subsequent widget shifts one left → `Number("hello world") === NaN` → `null` on re-save → `int(None)` throws in Python. This is the PR #11884 root cause.
- **Dual schema** — 0.4 (`ISerialisedGraph`, array links) vs v1 (`SerialisableGraph`, object links). `@ts-expect-error` at `app.ts:1317` is the sentinel.
- **GroupNode string ID hack** — `zNodeId = z.union([z.number().int(), z.string()])` with comment "Remove it after GroupNode is redesigned." Marked for removal since GroupNode was introduced; not yet removed.
- **`configure()` blind assign** — `LGraph.ConfigureProperties` gates explicit handling; unknown keys fall through to `this[i] = data[i]`. Any new graph field must be added to the set.
- **Reactive proxy stripping** — `JSON.parse(JSON.stringify(val))` in `LGraphNode.ts:978–981` breaks for circular refs; silently corrupts.
- **`execution_error` Zod mismatch** — `node_id` required in schema but cloud backends send `null` for service-level errors. `apiSchema.ts:104–113` is wrong.
- **`executing` drops `prompt_id`** — discarded at `api.ts:731`; stale events highlight wrong node on reconnect.

### New DB patterns staged

`research/touch-points/staging/R-SER-new-patterns.yaml` — 3 new patterns:
- **S18.SER1** — `widget.serialize` vs `widget.options.serialize` confusion (index drift root cause)
- **S18.SER2** — `onConfigure` override for `widgets_values` index patching (established community workaround)
- **S18.SER3** — `graph.extra` / LGraph blind property persistence for extension cross-session state

### Implications for open tasks

- **I-WS.3** — lazy getter must preserve both flags; widget identity must be by name not position (PR #10392)
- **D7** — `docs/WIDGET_SERIALIZATION.md` is the authoritative permutation table; D7 Part 5 WidgetHandle shape must align with both flags
- **D5 / EVT2** — `BeforeSerializeEvent` payload targets widget by name, not index; must align with `widgets_values_named`
- **PKG2** — avoid inheriting the dual-schema type collision; `zNodeId` union must not propagate into public types
- **I-TF.3 harness** — must simulate both `widget.serialize` and `widget.options.serialize` cases; null-in-numeric-widget regression test needed
- **S6.A1** — anatomy of what extensions actually patch is now fully documented; reinforces that no `beforePrompt` hook is the root cause

## MIG1.E4 — Parallel Entry Point Spike (2026-05-08)

Artifact: `research/architecture/parallel-entry-point-spike.md`

### Key findings

**`defineExtension` does NOT need `window.app` at module eval time.** It pushes into
a module-level array (`nodeExtensions[]`) — pure registration, no store reads, no DOM.
D6 Part 1's "no window.app at registration time" constraint is already satisfied by
the current implementation in `extension-api-service.ts`.

**`src/extension-api/` is substantially more complete than memory indicated.** PKG2
artifacts already exist: `index.ts`, `lifecycle.ts`, `node.ts`, `widget.ts`,
`events.ts`, `shell.ts`, `identifiers.ts`. The barrel exports `defineExtension`,
`defineNodeExtension`, `defineWidgetExtension`, `startExtensionSystem`, and all
public types. The `@/extension-api` alias resolves via the `@/*` → `./src/*` tsconfig
path.

**Two wiring gaps block end-to-end Phase A testing:**
1. `.v2.ts` files not imported in `extensions/core/index.ts` — 3 import lines needed.
2. `startExtensionSystem()` never called in `app.setup()` — one call needed after
   `loadExtensions()` resolves. Can stub `world.queryAll` as `shallowRef([])` with
   `// TODO(D8)` to unblock Phase A without D8 or Alex's ECS rebase.

**App-level `defineExtension` hooks (`init`, `setup`) are a separate gap** (not
handled by `startExtensionSystem`). Need `invokeV2AppExtensions('init'/'setup')` calls
at same positions v1 uses `invokeExtensionsAsync`. Scope: I-SR.3 / MIG1.E5.

## I-SR.2.B1 — Scope Registry Spike (2026-05-08)

**Artifact:** `research/architecture/scope-registry-spike.md`

### Key findings

**EffectScope import path:** `from 'vue'`, NOT `from '@vue/reactivity'`. No separate dep needed.
All codebase usage is `from 'vue'`. `@vue/reactivity` is not a listed direct dependency.

**Scope registry already exists** in `src/services/extension-api-service.ts`:
- `scopeRegistry: Map<string, EffectScope>` — keyed `"${extensionName}:${entityId}"`
- `getOrCreateScope()`, `stopScope()`, `mountExtensionsForNode()`, `unmountExtensionsForNode()`, `startExtensionSystem()` all scaffolded.

**B2 is wiring to real World, not starting from scratch.**

**`src/world/` exists on ECS branch commits** (reachable via `git log --all`):
- Latest state: commit `e364d69c4` (`refactor(world): move widget types to src/world/widgets/`)
- Real import path: `@/world/worldInstance` exports `getWorld()` (not `useWorld()`)
- Service stub uses `@/ecs/world` (doesn't exist) — must be corrected in B2

**EntityIds are STRING brands, not numbers:**
```ts
type NodeEntityId = Brand<string, 'NodeEntityId'>  // format: "node:${graphId}:${nodeId}"
```
Service stub has `entityId: number` in `getOrCreateScope` — must fix in B2.

**World IS already Vue-reactive.** Buckets are `reactive(Map)` → `watch(() => world.entitiesWith(key))` fires on add/remove. D8's core question is answered: reactivity works. Open question is per-entity event efficiency (scale: 100 nodes × 10 event types = 1000 watchers).

**`world.queryAll` doesn't exist** — real API is `world.entitiesWith(key)`.

**`world.onSystemEvent` doesn't exist** — needs a solution in B2 (per-entity component watch or new World method).

**Slice 1 covers widget components only.** Node-level components (Position, Dimensions, NodeType, LoadedFromWorkflow) not yet in world → B2 must define stub `ComponentKey`s with `// TODO(#11939)`.

### B2 import corrections

| Service stub | Real path |
|---|---|
| `@/ecs/world` → `useWorld()` | `@/world/worldInstance` → `getWorld()` |
| `@/ecs/commands` → `dispatch` | stub locally with `// TODO(#11939)` |
| `@/ecs/components` → component names | `@/world/widgets/widgetComponents` (widget keys) + local stubs (node keys) |
| `@/ecs/entityIds` | `@/world/entityIds` ✓ same interface |

## DOC1.E6 — Names Appendix (2026-05-08)

**Artifact:** `docs/architecture/extension-api-v2/names-appendix.md`
File existed from prior session with 8 terms (S2.N16, S13.SC1, S15.OS1 cross-walk). Added §9 during this session.

### New finding added (§9): NodeEntityId / WidgetEntityId type mismatch — BLOCKING B2

`src/extension-api/node.ts` defines `NodeEntityId = number & {__brand: 'NodeEntityId'}`.
`src/world/entityIds.ts` defines `NodeEntityId = Brand<string, 'NodeEntityId'>` (format: `"node:${graphUuid}:${nodeId}"`).

Same name, incompatible underlying types. At runtime the World emits string IDs; the public API declares numeric IDs.

**Fix for B2:** `node.ts` must re-export from `@/world/entityIds` rather than redefine.
Same applies to `WidgetEntityId`. `SlotEntityId` not yet in world — define locally with string brand until a later ECS slice adds it.

### Existing terms summary (8 terms, previously documented)

Real inconsistencies: widget.type (LiteGraph internal) ≠ widgetType (ComfyUI schema); no v2 inspectNodeDef() (D4 G1 blocker); S15.OS1 slot mutation restricted in v2; v1 exec output param name varies (standardised to event.output in v2); widget label vs name conflation.

Agreed terms: name, title, type (slot), comfyClass, output.

## UWF Backend Data Model Spec (2026-05-08, Notion — I-UWF.9)

Source: https://www.notion.so/3316d73d3650811587abd9c611e456dc
Research artifact: `research/architecture/uwf-backend-data-model.md`
Authors: Matt Miller, Kishore Shimikeri | Date: 2026-03-28 | Status: Draft

### Four objects that must never collapse

| Object | Purpose | Stored? |
|--------|---------|---------|
| WorkflowSpec | Canonical semantic source: nodes, edges, promoted inputs | Yes, versioned |
| WorkflowLayout | Editor-only: positions, groups, reroutes, colors | Yes, backend-opaque |
| ExecutionPrompt | Compiled ComfyUI API payload | No — derived at execution time |
| RunSnapshot | Immutable per-execution record | Yes, per job |

WorkflowLayout is **fully opaque to the backend** — visual constructs (reroutes, Get/Set nodes) live there only; their resolved effects (real edges) live in WorkflowSpec. This is the official statement that UWF Phase 3 resolve happens at save time, confirming the `uwf-resolved` classification for S6.A1.

### Key structural changes from current API format

1. **Values and links separated** — every input is `{ "value": ..., "link": ... }` instead of mixed scalars/arrays. Backend can distinguish without type lookup.
2. **Explicit `spec.edges` array** — `{ "from": [nodeId, outputIdx], "to": [nodeId, inputName] }`. No more implicit link arrays embedded in inputs.
3. **Named inputs, not positional arrays** — eliminates widget shift bugs (S18.SER1 root cause). Language-portable.
4. **Promoted inputs** — `{ node_id, input_name, display_name }` shape. Types resolved from `object_info` at execution time; frontend is NOT the source of truth for types.
5. **`node_versions` in metadata** — per-class version tracking at save time.

### Implications for v2 API design

- **D5 / I-WS.3**: `WidgetBeforeSerializeEvent` payload must identify widget by **name** (not index) — confirmed correct by named-inputs rule. `widgets_values_named` PR #10392 is the concrete bridge.
- **I-UWF.4 (app-level hook)**: ExecutionPrompt is derived at execution time with `overrides` limited to **promoted inputs only** — cross-node transforms that patch arbitrary nodes (S6.A1 pattern) have no equivalent surface in UWF. The v2 `defineExtension({ onBeforeWorkflowSave })` hook must target WorkflowSpec edits at save time, not runtime prompt injection.
- **I-UWF.5 (virtual node)**: Layout is backend-opaque; virtual node resolution into real `spec.edges` happens at save time. Extensions do NOT need to register resolution logic if the save path handles it — I-UWF.5 scope may be narrower than originally thought.
- **I-TF.3 harness**: Must simulate both old flat-API (positional `widgets_values`) and new `{ value, link }` named-input shape. RunSnapshot `overrides` (`"3.seed": 456`) is a useful test fixture shape.
- **Versioning boundaries**: Changing a widget value (binding-only) creates a RunSnapshot, NOT a new workflow version. Structural changes (add/remove nodes, edit connections) create a new version. Layout changes create neither. This three-tier versioning is a key constraint for how the extension API should classify mutations.

---

## 2026-05-09 — Phase A branch topology realized on fork

Split prior PR #2 cwd's 260 uncommitted changes into 4 stacked draft PRs on
`christian-byrne/ComfyUI_frontend` to match the planned Phase A topology
(coworker fork point + sibling children + sidecar):

| PR | Branch | Stacks on | Bucket | Commits |
|---|---|---|---|---|
| #5 | `ext-api/i-foundation` | PR #2 | B3 + B1 + B5 | 3 (decl polish, service rename, scope registry) |
| #6 | `ext-api/i-pkg` | PR #2 | B2 | 1 (npm package + docgen + CI) |
| #7 | `ext-api/i-tf` | PR #5 | B4 | 1 (test framework reorg + harness + content fill) |
| #8 | `ext-api/i-ext` | PR #5 | B6 | 1 (3 core extension conversions) |

Original PR #3 + PR #4 (earlier subagent attempts at I-SR / I-TF on stale
layout) closed as superseded.

Mechanical recipe used: stash uncommitted into a scratch worktree, then `cp`
files per bucket file-list into freshly-created child-branch worktrees. No
history rewrite. Safety tag `phase-a-snapshot` = `3a6fe052c` on base.

Quirk noted on PR #5/#7: the deletion of the obsolete
`src/services/extensionV2Service.ts` ended up in PR #7 (i-tf) rather than
PR #5 (i-foundation, alongside the rename). Final merged state correct;
flagged in both PR descriptions.

## 2026-05-09 — Phase A stack mirrored to Comfy-Org/ComfyUI_frontend

Same 4-child topology pushed to upstream and opened as draft PRs:

| Branch | Comfy-Org | fork |
|---|---|---|
| `ecs-vue-hoisted-client-state-hook-api` (base) | #12101 | #2 |
| `ext-api/i-foundation` | #12102 | #5 |
| `ext-api/i-pkg` | #12103 | #6 |
| `ext-api/i-tf` | #12104 | #7 |
| `ext-api/i-ext` | #12105 | #8 |

Branches share commit SHAs across remotes (no duplication). Fork stack
remains as personal review channel; canonical review/CI happens on
Comfy-Org. Coworkers branching off `ext-api/i-foundation` should target
the Comfy-Org remote.
