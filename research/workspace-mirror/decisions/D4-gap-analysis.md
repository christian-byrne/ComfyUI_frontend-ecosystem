# D4 — Gap Analysis: Current ComfyExtension ↔ Real Demand ↔ v2 API

> Synthesis decision. Compares the `ComfyExtension` surface that ships today
> against (a) the patterns extensions actually use in the wild (R4) and (b)
> the proposed v2 API in `plans/P1-comfy-extension-v2-api.md` plus its
> reactive/event substrate (D3.3, D3.4, D3.5). Output: a coverage matrix,
> a numbered gap list with severity tags, and a queue of follow-up
> decisions (D5+) that must land before implementation.

---

## TL;DR

- The v2 surface in P1 covers the **two highest-volume real-world patterns**
  (widget-callback chaining and `nodeType.prototype.onNodeCreated`
  monkey-patching) cleanly, via `widget.on('change', …)` and per-instance
  `defineNodeExtension({ setup })` respectively.
- It silently **drops three current hooks** with no replacement:
  `addCustomNodeDefs`, `registerCustomNodes`, and the
  `getCanvasMenuItems` / `getNodeMenuItems` / `getSelectionToolboxCommands`
  family. These are not theoretical — at least the menu hooks have visible
  usage and the def-injection hooks underpin some custom-node packs.
- R4's mapping table promises an `inspectNodeDef('…')` query as the
  replacement for `beforeRegisterNodeDef`'s legitimate metadata-inspection
  use case. P1 does not define it. **This is a BLOCKER inconsistency.**
- `defineWidgetExtension` has a different shape in P1 than R4's
  recommendation. R4 calls for `{ setup, dispose }` with **mandatory**
  `dispose`; P1 returns `{ render, destroy? }` with optional cleanup. The
  whole point of the rewrite (preventing DOM-widget leaks, F5) is undermined
  by making teardown opt-in.
- Six of the eight CONTEXT.md "open issues from D2 review" map directly to
  unresolved P1 ambiguities (currentExtension global vs ctx, hook ordering,
  async setup, proxyRefs on setupState, ECS↔Vue notification engine, missing
  reactivity primitives in D1).
- The `init` / `setup` distinction, `loadedGraphNode`, and the
  `beforeRegisterVueAppNodeDefs` / auth-event family all warrant a
  **delete or merge** decision rather than a 1:1 port.
- Transport-layer concerns from `extension-development-guide.md`
  (`window.comfyAPI` shim, `/scripts/*` legacy import paths,
  `WEB_DIRECTORY`, dev-server inability to load custom-node JS) are
  **entirely unaddressed** by P1. Behaviour-surface and delivery-surface
  must be decoupled in the spec.

---

## Current `ComfyExtension` surface

Sourced from `research/architecture/comfy-extension-interface-analysis.md`
and cross-checked with `core-extensions-reference.md`. 18 hooks + 8
declarative arrays + 1 escape-hatch index signature.

### Lifecycle hooks

| # | Hook | Receives | Purpose | Monkey-patch risk |
|---|------|----------|---------|-------------------|
| H1 | `init(app)` | `ComfyApp` | Pre-node app setup. | Low — no entity in scope. |
| H2 | `setup(app)` | `ComfyApp` | Post-init "app is alive" callback. | Low. |
| H3 | `addCustomNodeDefs(defs, app)` | `Record<string, ComfyNodeDef>`, `ComfyApp` | Inject/edit node defs before registration. | Medium — direct mutation of the def dict. |
| H4 | `getCustomWidgets(app)` | `ComfyApp` | Return a `{ widgetType: factory }` map. | Low — pure factory. |
| H5 | `beforeRegisterNodeDef(nodeType, nodeData, app)` | `typeof LGraphNode`, `ComfyNodeDef`, `ComfyApp` | Mutate the node CLASS (prototype) and inspect/mutate the def. | **HIGH** — the structural seam that invites prototype patching (Pattern 2 / 3). |
| H6 | `beforeRegisterVueAppNodeDefs(defs, app)` | `ComfyNodeDef[]`, `ComfyApp` | Vue-app variant of H3. | Medium. |
| H7 | `registerCustomNodes(app)` | `ComfyApp` | Register additional `LGraphNode` subclasses. | Medium — class registration. |
| H8 | `loadedGraphNode(node, app)` | `LGraphNode`, `ComfyApp` | Fix-up nodes loaded from saved workflow. | **HIGH** — instance patching. |
| H9 | `nodeCreated(node, app)` | `LGraphNode`, `ComfyApp` | Per-instance "just constructed" callback. | **HIGH** — instance patching. |
| H10 | `beforeConfigureGraph(graphData, missing, app)` | `ComfyWorkflowJSON`, `MissingNodeType[]`, `ComfyApp` | Pre-load workflow hook. | Medium — graph data mutation. |
| H11 | `afterConfigureGraph(missing, app)` | `MissingNodeType[]`, `ComfyApp` | Post-load workflow hook. | Low. |
| H12 | `getSelectionToolboxCommands(item)` | `Positionable` | Contribute commands to the selection toolbox. | Low — returns IDs. |
| H13 | `getCanvasMenuItems(canvas)` | `LGraphCanvas` | Contribute canvas right-click items. | Low — returns data. |
| H14 | `getNodeMenuItems(node)` | `LGraphNode` | Contribute per-node right-click items. | Low — returns data. |
| H15 | `onAuthUserResolved(user, app)` | `AuthUserInfo`, `ComfyApp` | Auth identity callback. | Low. |
| H16 | `onAuthTokenRefreshed()` | — | Auth refresh callback. | Low. |
| H17 | `onAuthUserLogout()` | — | Auth logout callback. | Low. |

### Declarative registration arrays

| # | Property | Element type | Purpose |
|---|----------|--------------|---------|
| A1 | `commands` | `ComfyCommand[]` | Command palette entries. |
| A2 | `keybindings` | `Keybinding[]` | Keyboard shortcuts. |
| A3 | `menuCommands` | `MenuCommandGroup[]` | Top-level menu items. |
| A4 | `settings` | `SettingParams[]` | Settings panel entries. |
| A5 | `bottomPanelTabs` | `BottomPanelExtension[]` | Bottom panel tabs. |
| A6 | `aboutPageBadges` | `AboutPageBadge[]` | About-page badges. |
| A7 | `topbarBadges` | `TopbarBadge[]` | Topbar badges. |
| A8 | `actionBarButtons` | `ActionBarButton[]` | Action bar buttons. |

### Escape hatch

`[key: string]: unknown` on the `ComfyExtension` interface allows arbitrary
keys; in practice this becomes ad-hoc API by drift.

---

## Real demand (R4 → current hooks)

R4 confirmed two patterns from the custom-node corpus and inferred four
more from documentation. Cross-referenced to which current hook(s) enable
each pattern:

| R4 pattern | Realised through | Failure modes (R4 §F) |
|---|---|---|
| P1 — `widget.callback` chaining | H9 `nodeCreated` + direct widget mutation | F1 race on shared slot; F2 silent overwrite; F6 re-entrancy via `tempCallback` swap |
| P2 — `nodeType.prototype.onNodeCreated` monkey-patch | H5 `beforeRegisterNodeDef` (the only place that hands you the class) | F3 ordering bugs; F4 prototype leaks across HMR; F7 cannot patch *some* instances |
| P3 — `beforeRegisterNodeDef` as the structural seam | H5 directly | F8 cross-extension contention via shared `nodeData.input` mutation |
| P4 — `useChainCallback` helper | (internal helper, blessed wrapper for P1) | Same as P1 |
| P5 — `api.addEventListener('executed', …)` | Not on `ComfyExtension` — uses `app.api` (`ComfyApi extends EventTarget`) | None catastrophic; this pattern *works* but is not generalised |
| P6 — `addDOMWidget` custom widget rendering | H4 `getCustomWidgets` factory + manual element lifecycle | F5 DOM widget leaks (no dispose) |

Three observations worth pulling out before the matrix:

1. **Most extension authors interact with the system through H5 + H9.** The
   other 16 hooks are tail. Any v2 design that nails those two gets ~80%
   of community adoption coverage.
2. **P5 is the existence proof** that the event-emitter shape extensions
   already know works — it's the thing P1's `node.on(…)` / `widget.on(…)`
   generalises.
3. **P6 is the only confirmed pattern with no working teardown today.**
   This is the single largest *new* contract v2 must add (not replace).

---

## v2 coverage matrix

Legend: ✅ covered by P1, ⚠️ partially covered, ❌ gap, 🗑️ intentionally
removed (with v2 alternative), 🪦 candidate for outright deletion (no
replacement; verify zero usage first).

### Per current hook / array

| Item | v2 status | Notes |
|---|---|---|
| H1 `init(app)` | ⚠️ partial | `ExtensionOptions.init?()` exists but no `app` arg. P1 doesn't say what *replaces* the `app` god-object access — extensions that called `app.api.addEventListener(…)` from `init` need a documented surface (`useApi()`? a global `api` import? unspecified). |
| H2 `setup(app)` | ⚠️ partial | Same shape as H1 in P1. The `init` vs `setup` distinction has no explicit semantics in v2 either. |
| H3 `addCustomNodeDefs(defs, app)` | ❌ gap | **No v2 surface.** P1 has no def-registration hook. Custom-node packs that synthesise defs at load time (e.g. dynamic LLM-prompt-driven nodes) lose their entry point. |
| H4 `getCustomWidgets(app)` | ⚠️ partial | `defineWidgetExtension` covers *one widget type per call*, but H4 returns a `Record<string, factory>` — i.e. one extension contributing many types. v2 forces N `defineWidgetExtension` calls per package. Acceptable, but breaking; needs to be called out. |
| H5 `beforeRegisterNodeDef(nodeType, nodeData, app)` | 🗑️ removed | Replaced by `nodeTypes: ['…']` filter on `defineNodeExtension`. **However**, the legitimate "inspect this def's input/output spec" use case has no replacement in P1. R4 promised `inspectNodeDef('…')`; P1 doesn't ship it. → Gap G1. |
| H6 `beforeRegisterVueAppNodeDefs(defs, app)` | 🪦 deletion candidate | Vue-app-specific transitional hook; no inferred usage; same as H3 modulo Vue context. Verify zero community usage and remove. |
| H7 `registerCustomNodes(app)` | ❌ gap | **No v2 surface.** Packs like `rerouteNode.ts`, `noteNode.ts` register entire `LGraphNode` subclasses. P1 has `defineNodeExtension({ nodeTypes })` which *augments* an existing type — it does not register a new one. → Gap G2. |
| H8 `loadedGraphNode(node, app)` | ✅ covered | `NodeExtensionOptions.loadedGraphNode?(node)` exists. D3.5 specifies the dispatch via `LoadedFromWorkflow` tag component. Internally consistent; usage in the wild remains unverified (R4 re-run checklist item 7). |
| H9 `nodeCreated(node, app)` | ✅ covered | The flagship migration target. `defineNodeExtension({ setup … nodeCreated })` is the primary v2 surface. |
| H10 `beforeConfigureGraph(…)` | ⚠️ partial | `ExtensionOptions.beforeConfigureGraph?(graphData)` — but the `missing: MissingNodeType[]` argument was dropped silently. Extensions that surfaced "missing node" UX lose it. → Gap G3. |
| H11 `afterConfigureGraph(missing, app)` | ⚠️ partial | Same `missing[]` argument loss. |
| H12 `getSelectionToolboxCommands(item)` | ❌ gap | Not present in P1. The R4 audit and `core-extensions-reference.md` flag this as an active contribution surface. → Gap G4. |
| H13 `getCanvasMenuItems(canvas)` | ❌ gap | Not present in P1. → Gap G4. |
| H14 `getNodeMenuItems(node)` | ❌ gap | Not present in P1. → Gap G4. |
| H15 `onAuthUserResolved` | ✅ covered | Direct port in `ExtensionOptions`. |
| H16 `onAuthTokenRefreshed` | ✅ covered | Direct port. |
| H17 `onAuthUserLogout` | ✅ covered | Direct port. |
| A1–A5 (`commands` … `bottomPanelTabs`) | ✅ covered | Direct ports in `ExtensionOptions`. |
| A6 `aboutPageBadges` | ❌ gap | Missing from P1. → Gap G5. |
| A7 `topbarBadges` | ❌ gap | Missing from P1. → Gap G5. |
| A8 `actionBarButtons` | ❌ gap | Missing from P1. → Gap G5. |
| `[key: string]: unknown` escape hatch | 🗑️ removed | The three `define*` functions take typed options; arbitrary keys are no longer carried. This is a wins/loses tradeoff: removes accidental APIs, breaks any extension using arbitrary keys for inter-extension messaging. |

### Per R4 pattern

| R4 pattern | v2 status | Replacement | Outstanding |
|---|---|---|---|
| P1 widget callback chaining | ✅ | `widget.on('change', listener)` | None. F1/F2/F6 prevented at framework level. |
| P2 prototype monkey-patch | ✅ | `defineNodeExtension({ nodeTypes, setup })` | F3/F4/F7 all prevented. |
| P3 `beforeRegisterNodeDef` seam | ⚠️ | `nodeTypes` filter — but def *inspection* (R4 promise of `inspectNodeDef`) missing. | → Gap G1. |
| P4 `useChainCallback` | 🗑️ | Removed; events provide the moral equivalent. | None. |
| P5 `api.addEventListener` | ⚠️ | `node.on('executed', …)` covers the per-node case. The *aggregate* "any node executed" / "queue progress" / "system status" events are missing — there is no `app.on(…)` or `useApi()` in P1. | → Gap G6. |
| P6 `addDOMWidget` | ⚠️ | `defineWidgetExtension({ widgetCreated → { render, destroy? } })`. R4 specifies *mandatory* dispose; P1 makes it optional. | → Gap G7. |

---

## Gaps (the heart of the doc)

Severity tags:
**BLOCKER** — implementation cannot ship without resolving;
**SHOULD-FIX** — implementation can ship but ecosystem will hurt;
**NICE-TO-HAVE** — improvement; can be deferred to a follow-up release.

---

### G1. Missing `inspectNodeDef('…')` query (or equivalent)

**Severity: BLOCKER.**

R4's mapping table explicitly proposes `inspectNodeDef('…')` as the
replacement for `beforeRegisterNodeDef`'s legitimate "I need to look at
this node type's input/output spec to decide what to do" use case. P1 ships
neither this query nor any other entry point to the registered
`ComfyNodeDef` data. Concretely, the `Comfy.DynamicPrompts` example in
P1 §3 walks all widgets and inspects `widget.getOptions().dynamicPrompts`,
which works for runtime widget options but cannot answer questions like
"what is this input slot's type/shape declared as?" before instantiation.

**Blocking which decision/PR**: any PR that reimplements `slotDefaults.ts`,
the `groupNode` family, or any custom-node manager that conditionally
shows UI based on declared inputs.

**Suggested resolution**: add a top-level `inspectNodeDef(comfyClass:
string): ReadonlyDeep<ComfyNodeDef> | undefined` to the `@comfyorg/comfyui`
public surface. Frozen view; mutation requires a separate command (per
R4 F8). Decide as part of D5.

---

### G2. No replacement for `registerCustomNodes`

**Severity: BLOCKER.**

`defineNodeExtension({ nodeTypes })` augments existing types. There is no
v2 surface that **registers a new node type from a JS module**. Two real
core extensions (`rerouteNode.ts`, `noteNode.ts`) do this today, plus an
unknown number of community packs that ship pure-frontend node types.

**Blocking which decision/PR**: any PR that migrates `rerouteNode.ts` or
`noteNode.ts` to v2.

**Suggested resolution**: add `defineCustomNodeType({ comfyClass, def,
setup(node) })` — equivalent to "synthesise a node def + setup nodes of
this type". Decide as part of D5 (alongside G1).

---

### G3. Workflow-load hooks lost the `MissingNodeType[]` argument

**Severity: SHOULD-FIX.**

P1's `beforeConfigureGraph?(graphData)` and `afterConfigureGraph?()`
silently drop the `missing` parameter. Extensions that surface
"missing node" UX (the "install with manager" prompt and similar) cannot
function. The change is also undocumented — a v1 → v2 migration would not
catch it.

**Blocking which decision/PR**: comfyui-manager integration, custom-node
discovery prompts.

**Suggested resolution**: either restore `missing` in the signature, or
introduce an event surface like `app.on('missingNodes', (list) => …)` so
the data is reachable without forcing it through every workflow-load hook.
Decide in P1 revision (no new decision doc needed).

---

### G4. Menu and toolbox contribution hooks dropped without replacement

**Severity: SHOULD-FIX.**

`getSelectionToolboxCommands`, `getCanvasMenuItems`, `getNodeMenuItems`
are absent from P1. The "extensions return arrays of contributions"
pattern they exemplify is recognised in `core-extensions-reference.md`
implication #6 as something v2 should *formalise into a registry*, not
delete.

**Blocking which decision/PR**: any extension contributing right-click
menu items or selection-toolbox actions; the existing `groupOptions.ts`
and similar.

**Suggested resolution**: a `contextMenuContributions: ContextMenuItem[]`
declarative array on `ExtensionOptions` (and matching events on
`NodeHandle` / a `CanvasHandle` for dynamic cases). Resolve in D6 (UI
contribution registry).

---

### G5. UI badges and action-bar buttons missing from `ExtensionOptions`

**Severity: SHOULD-FIX.**

`aboutPageBadges`, `topbarBadges`, `actionBarButtons` are public API
today, all with concrete consumers (manager integration, version
indicators, theme toggles). P1 lists `commands`/`keybindings`/
`menuCommands`/`settings`/`bottomPanelTabs` and stops.

**Blocking which decision/PR**: any community pack that adds a topbar
badge or action-bar button.

**Suggested resolution**: copy the three properties verbatim into
`ExtensionOptions`. Trivial edit; no new decision required, but list as
part of D6 (UI contribution registry) for consistency.

---

### G6. No app/global event surface (P5 generalisation incomplete)

**Severity: SHOULD-FIX.**

P1 generalises `api.addEventListener('executed', …)` *for one node* via
`node.on('executed', …)`. The aggregate cases — queue progress, status
updates, server reconnection, prompt completion across the whole queue —
have no v2 surface. Today extensions reach into `app.api`. P1 doesn't
expose `app` to extension authors at all.

**Suggested resolution**: ship `import { useApi } from '@comfyorg/
comfyui'` returning a stable, typed event-emitter wrapper around
`ComfyApi`. Or, equivalently, a top-level `onAppEvent(event, fn)` that
auto-cleans via the active `EffectScope`. Decide in D7 (global handles
beyond entity scope).

---

### G7. Widget extension teardown is opt-in (contradicts F5 prevention)

**Severity: BLOCKER.**

R4 §F5 says "Mandatory `dispose()` return from widget setup" is the
prevention mechanism for DOM widget leaks. P1's `widgetCreated` returns
`{ render, destroy? }` with `destroy` *optional*. The framework cannot
enforce cleanup if the contract permits its omission. The whole reason
P6 needs replacement is that today's `addDOMWidget` has no teardown
contract — preserving optionality reproduces the bug.

**Blocking which decision/PR**: any DOM-widget migration; HMR safety;
graph reload determinism.

**Suggested resolution**: make `destroy: () => void` required on the
returned object (or move teardown to `onScopeDispose(() => …)` *inside*
`widgetCreated` and require the framework to invoke `scope.stop()` on
widget removal — equivalent contract, more idiomatic with the rest of
the v2 substrate). Resolve in P1 revision.

---

### G8. `currentExtension` global vs explicit `ctx` is unresolved

**Severity: BLOCKER.**

D3.5 deferred the `currentExtension` global "until implicit hooks like
`onNodeMounted(() => …)` are needed". CONTEXT.md (2026-05-06) flags that
the proposed lifecycle hooks already assume this implicit context, while
R3-implied D8 says "extensions write capability fns onto `node.ctx`;
runtime reads via duck-typed interface". These three sources are
mutually inconsistent.

P1 sidesteps the question by passing `node` explicitly to every callback
and not using any `useX()` composables. But P1 also says nothing about
`onScopeDispose` — which Vue's `onScopeDispose(fn)` *requires* an active
scope global to work, so the moment a v2 extension wants to clean up
manually, the question forces itself.

**Blocking which decision/PR**: any extension using `onScopeDispose`,
any extension factoring its setup into reusable composables.

**Suggested resolution**: pick one of:
- (a) Route lifecycle through `node.onRemoved(fn)` / `widget.onRemoved(fn)`
  — never expose `onScopeDispose` to extension authors. Keeps the global
  unnecessary.
- (b) Commit to `currentExtension` now and document it as part of D2's
  setup-context primer.

Resolve in D5.

---

### G9. Hook ordering across multiple extensions is unspecified

**Severity: SHOULD-FIX.**

CONTEXT.md flags this open issue. Today the order is "registration order"
(implementation-defined). For v2 with `defineNodeExtension` per
`nodeTypes`, multiple extensions can target the same `comfyClass`, and
their `setup`/`nodeCreated` callbacks fire in some order. With shared
state (e.g. two extensions adding widgets to the same node), order
matters.

**Blocking which decision/PR**: any test reproducing the v1
`groupNode/groupNodeManage/groupOptions` cooperating-extensions pattern.

**Suggested resolution**: per CONTEXT.md, mirror Vue's "array-in-
registration-order with extension-name tie-breaker for determinism".
Codify in D5 along with G8.

---

### G10. Async `setup()` semantics undefined

**Severity: SHOULD-FIX.**

`ExtensionOptions.init?(): void | Promise<void>` is typed as async-capable.
`NodeExtensionOptions.nodeCreated?(node): void` is typed sync-only. The
asymmetry isn't justified anywhere. Vue's solution (`<Suspense>`) is
explicitly out of scope for v1 per CONTEXT.md.

**Suggested resolution**: commit to **sync-only** for
`nodeCreated`/`loadedGraphNode`/`widgetCreated`. Keep `init`/`setup`
async-capable for global initialisation. Document in P1.

---

### G11. `setupState` proxyRefs wrapping for extensions

**Severity: NICE-TO-HAVE.**

Open D2 question: should `entity.extensionState['foo'].count` work
without `.value` (Vue's `proxyRefs` model)? P1 has no
`extensionState` concept at all — the closest analogue is
"closures captured in `nodeCreated`" plus widget options. If extensions
need to expose state to other extensions, the entire mechanism is
undefined.

**Suggested resolution**: defer until R3-implied D8 (ctx-injection) is
fully spec'd. The two are the same problem under different framings.

---

### G12. ECS World → Vue notification engine is undocumented

**Severity: BLOCKER (for implementation, not for spec).**

D1 review gap, restated in CONTEXT.md: the layer that translates ECS
World mutations into Vue reactive notifications (so
`watch(() => world.getComponent(…))` works) is undefined. D3.3's
"framework internal" sketch shows `watch(() => world.getComponent(…))`
but never explains how the World's internal state-change generates a
Vue dependency.

Without this layer, *every event in P1 is unimplementable*. `widget.on
('change')` requires that `WidgetValue` component changes notify Vue;
`node.on('positionChanged')` requires the same for `Position`.

**Blocking which decision/PR**: every implementation PR.

**Suggested resolution**: explicit decision doc on the World's reactive
adapter — likely `shallowRef` per component slot, with `markRaw` on
LiteGraph instances embedded in components. D1's reactivity primer also
needs to be extended (CONTEXT.md notes missing coverage of `flush:
'pre'|'post'|'sync'`, `pauseTracking/resetTracking`, `shallowRef/
shallowReactive/markRaw`). Resolve in D8.

---

### G13. Transport surface (`window.comfyAPI`, `/scripts/*`) untouched by v2

**Severity: SHOULD-FIX.**

P1 designs the *behaviour* surface (`defineExtension`,
`defineNodeExtension`, `defineWidgetExtension`). The *delivery* surface
(production-build shim, `/extensions` endpoint, legacy import paths,
`WEB_DIRECTORY` mapping) is unspecified for v2. Per
`extension-development-guide.md` implication #1, behaviour and delivery
are independent — but the v2 spec must say so explicitly, and the
delivery contract must enumerate which legacy import paths are stable
public API.

**Suggested resolution**: a separate decision doc on the v2 packaging
and transport story (manifest format, `/extensions` v2 response shape,
which legacy `comfyAPI.modules['/scripts/…']` keys are permanent). D9.

---

### G14. No dev-loop story for third-party extensions

**Severity: NICE-TO-HAVE (but with high pain).**

The "develop as a core extension" workaround documented in
`extension-development-guide.md` is the entire third-party DX today. P1
inherits this without comment. If v2 ships without addressing it,
adoption suffers because every author has to learn the workaround.

**Suggested resolution**: declare out-of-scope for v2 *language* design,
in-scope for the v2 *release plan*. Track separately.

---

### G15. Cross-entity / global queries deferred indefinitely

**Severity: NICE-TO-HAVE.**

D3.4 says "if the need arises for extensions that work across entities…
we can add query-level APIs without changing the per-entity handle
pattern". This is correct architecturally but leaves real cases (a
"count nodes by type" badge; a "select all nodes matching predicate"
command) unsupported. R4's audit didn't surface a concrete confirmed
case yet, but historical extension behaviour suggests they exist.

**Suggested resolution**: scope an explicit `queryNodes(predicate)` /
`queryAll(NodeType)` public surface for v2.1 or later. Out of scope for
v2.0 unless an R4 re-run finds confirmed usage.

---

## Patterns to remove (not replace)

These are hooks/patterns where the audit shows zero confirmed usage or
where the design intent is actively harmful and no migration target is
warranted. Verify zero usage before deleting; if confirmed, delete in
v2 instead of porting.

| Pattern | Why remove |
|---|---|
| H6 `beforeRegisterVueAppNodeDefs` | Vue-app variant of H3 added during a transitional period. No documented usage. If H3 is replaced by `addCustomNodeDefs`-style v2 surface (G1-adjacent), there is no reason to fork the Vue-app variant. |
| The `[key: string]: unknown` index signature on `ComfyExtension` | Encourages unstable, undocumented inter-extension messaging. v2's three typed `define*` factories already replace it. |
| H1/H2 distinction (`init` vs `setup`) | `extension-development-guide.md` notes "no guidance on which to use when" — the distinction has confused authors for years. v2 should provide *one* startup hook and ship a deprecation note pointing both v1 names at it. |
| `useChainCallback` (P4) | Already deprecated (DEP2). No replacement; events subsume it. |
| Direct prototype/instance access through hook arguments | Per D3.3: `node.pos`, `node.widgets[0].value`, `widget.callback` assignments are *intentionally* unreachable from v2 handles. No replacement; this is the point. |
| `loadedGraphNode` *as a separate hook* (open question) | R4 re-run checklist item 7 specifically calls out "used by anyone? if not, candidate for early deprecation". D3.5 chose to keep it. Worth re-deciding once R4 re-run confirms or denies usage. |
| `getSelectionToolboxCommands` *as a hook* (vs declarative) | Even if the *capability* is preserved (G4), the *imperative-callback* form has no advantage over a declarative array. Replace with declarative + per-handle on-demand events. |

---

## Open questions consolidated

Pulled from CONTEXT.md "Decisions" entries dated 2026-05-06. Each is tied
to a gap above.

| CONTEXT.md issue | Tied to |
|---|---|
| D2 review → `currentExtension` global vs explicit ctx contradiction | G8 |
| D2 review → hook ordering across multiple extensions on same entity unspecified | G9 |
| D2 review → async `setup()` unspecified | G10 |
| D2 review → `proxyRefs`-wrapped `setupState` undecided | G11 |
| D1 review → reactivity primer missing `flush`/`pauseTracking`/`shallowRef`/`markRaw` | G12 |
| D1 review → ECS World ↔ Vue notification engine undocumented | G12 |
| Doc audit → "avoid modifying core objects where possible" hedge must become absolute | G7 (the F5 contract surfaces this in microcosm) |
| Doc audit → `window.comfyAPI` and `/scripts/*` are public API by accident | G13 |
| Doc audit → no teardown / `dispose` story | G7, G8 |

---

## Recommended next decisions (D5+)

1. **D5 — Node-type registration & def inspection**
   Resolves G1 (`inspectNodeDef`) and G2 (`defineCustomNodeType`). Also
   the place to settle G8 (`currentExtension` vs `ctx`), G9 (multi-
   extension ordering), and G10 (async setup) since they all reduce to
   "what is the extension setup context?".

2. **D6 — UI contribution registry**
   Resolves G4 (menu/toolbox hooks) and G5 (badges, action-bar buttons).
   Likely a single declarative registry with typed contribution kinds,
   replacing the current per-feature hooks.

3. **D7 — App-level / global events surface**
   Resolves G6 (no app event surface). Decides whether extensions get
   `useApi()`, top-level `onAppEvent(…)`, or both. Pulls in G15
   (cross-entity queries) if that scope is also accepted for v2.0.

4. **D8 — ECS World ↔ Vue reactive adapter** *(implementation-blocking)*
   Resolves G12. Specifies how component changes generate Vue
   notifications, which `Ref` flavour is used (`shallowRef` likely),
   `markRaw` strategy for embedded LiteGraph instances, and `flush`
   timing. Without this doc no implementation PR can land.

5. **D9 — Transport, packaging, and legacy import compatibility**
   Resolves G13 and tracks G14. Decides which `comfyAPI.modules['/scripts
   /…']` keys are permanent vs deprecated, what the v2 manifest looks
   like, and how the `/extensions` API evolves.

---

## R4 + P1 + D3.x mutual inconsistencies

Three concrete inconsistencies between the just-landed audit, the
proposed plan, and the supporting decisions. These need explicit
reconciliation before any of the three documents is treated as
load-bearing.

1. **R4 mapping table promises `inspectNodeDef('…')`. P1 does not ship
   it.** R4 §"Mapping to v2 API" row for `beforeRegisterNodeDef` says
   "Eliminated; replaced by `nodeTypes` filter + `inspectNodeDef`". P1's
   public surface lists three `define*` functions and zero query
   functions. → G1 BLOCKER.

2. **R4 says widget-extension `dispose` is mandatory; P1 makes it
   optional.** R4 §F5 "Mandatory `dispose()` return from widget setup"
   vs P1 §`WidgetExtensionOptions` returning `{ render(container):
   void; destroy?(): void }`. Same shape, weaker contract. The whole
   reason F5 needs prevention is that today's contract is opt-in. → G7
   BLOCKER.

3. **D3.5 defers `currentExtension`; D2 review (CONTEXT.md) says
   proposed implicit hooks already need it; R3-implied D8 says
   capability injection happens through `node.ctx`.** Three different
   answers to "where does extension lifecycle context live?". P1
   sidesteps the question entirely by passing `node` to every callback,
   but the moment an extension wants `onScopeDispose(fn)` (which is the
   only documented teardown primitive in the v2 substrate) the question
   re-asserts itself. → G8 BLOCKER.

A fourth, lower-confidence inconsistency: D3.4 "where raw ECS access
might appear later" sketch uses `queryAll(NodeType, Position)` /
`onQueryChanged(...)` as the future surface. D3.5 already uses
`world.queryAll(NodeType)` as a *current* surface for the reactive
mount system. The naming and the layer-boundary aren't aligned: is
`queryAll` an internal World method or a public extension API? Worth
disambiguating in D7/D8.

---

## Closing

P1 is structurally correct for the two highest-volume real-world
patterns and for the events/commands reconciliation in D3.3/D3.4. It is
also incomplete in ways that are routine for an early plan — five
declarative-array gaps (G3–G6) and two def-registration gaps (G1, G2)
are easy to close in revision. The two structural BLOCKERs (G7, G8) and
the implementation-blocking adapter doc (G12) are the work that must
land before a coding subagent can usefully run.

Recommended sequence: D5 (G1, G2, G8, G9, G10) → P1 revision (G3, G5,
G7, G10) → D6 (G4, G5) → D8 (G12) → D7 (G6, G15) → D9 (G13, G14).
