---
source_url: file://ComfyUI_frontend/src/lib/litegraph/src/LGraphNode.ts
date_accessed: 2026-05-08
ingestion_task: I-WS.1
status: ingested
source_files:
  - ComfyUI_frontend/src/lib/litegraph/src/LGraphNode.ts
  - ComfyUI_frontend/src/utils/executionUtil.ts
  - ComfyUI_frontend/src/extensions/core/dynamicPrompts.ts
  - ComfyUI_frontend/src/extensions/core/dynamicPrompts.v2.ts
  - ComfyUI_frontend/src/extensions/core/groupNode.ts
  - ComfyUI_frontend/src/extensions/core/uploadAudio.ts
  - ComfyUI_frontend/src/extensions/core/saveImageExtraOutput.ts
  - ComfyUI_frontend/src/extensions/core/webcamCapture.ts
  - ComfyUI_frontend/src/extensions/core/load3d.ts
  - ComfyUI_frontend/src/composables/painter/usePainter.ts
  - ComfyUI_frontend/src/composables/node/useNodeAnimatedImage.ts
  - ComfyUI_frontend/src/scripts/domWidget.ts
  - ComfyUI_frontend/src/types/litegraph-augmentation.d.ts
  - ComfyUI_frontend/src/lib/litegraph/src/LGraph.ts
  - ComfyUI_frontend/src/extensions/core/widgetInputs.ts
  - ComfyUI_frontend/src/platform/nodeReplacement/useNodeReplacement.ts
  - ComfyUI_frontend/src/core/graph/subgraph/promotionUtils.ts
  - research/touch-points/database.yaml (rows S4.W3, S2.N6, S2.N15)
  - research/architecture/adr-0006-primitive-copy-paste-summary.md
  - research/architecture/widget-props-serialization-from-slack.md
  - widget-api-thoughts.md
---

# Widget Serialization Surfaces — Current State Audit

## TL;DR

There are **three** extension-facing widget/node serialization hooks plus one
direct-read path, all converging on workflow-save / prompt-execute time:

| Surface         | Touch-point ID | Granularity            | Where it runs                                            | What it returns / mutates |
| --------------- | -------------- | ---------------------- | -------------------------------------------------------- | ------------------------- |
| `widget.serializeValue(node, i)` | **S4.W3**  | per-widget         | `executionUtil.ts:102` (prompt only — NOT workflow JSON) | replacement value for that widget in the API prompt |
| `node.onSerialize(o)`            | **S2.N6**  | per-node           | `LGraphNode.ts:992` (workflow `serialize()`)             | mutates `o` in place; return value warned-against |
| `node.serialize()` (overridden)  | **S2.N15** | per-node-prototype | every workflow `serialize()` call                        | returns the entire `ISerialisedNode` object |
| direct `widget.value` read       | (none)     | per-widget         | `LGraphNode.ts:976` (workflow), `executionUtil.ts:104` (prompt fallback) | the raw runtime value |

These four surfaces have **divergent semantics**, **collide silently** when
multiple extensions touch the same widget, and only S4.W3 is even in our v2
proposal (`extensionV2Service`). I-WS.3's lazy-getter design has to subsume
all four.

---

## 1. Surface inventory (call-site evidence)

### 1a. `widget.serializeValue` (S4.W3) — assignment sites

This hook is **assigned by extensions** and **invoked by `graphToPrompt`
only**. It does NOT participate in workflow JSON serialization
(`LGraphNode.serialize()`); that path reads `widget.value` directly.

Internal assignment sites in `ComfyUI_frontend/src/`:

| File | Line | What it does |
| --- | --- | --- |
| `extensions/core/dynamicPrompts.ts` | 17 | Resolve `{a\|b}` template at prompt time; also mutates `workflowNode.widgets_values[widgetIndex]` so the saved workflow records the resolved value. |
| `extensions/core/uploadAudio.ts` | 311 | Async — uploads the audio blob, returns the resulting filename string. |
| `extensions/core/saveImageExtraOutput.ts` | 42 | Returns a static placeholder for the `extra_pnginfo` payload. |
| `extensions/core/webcamCapture.ts` | 117, 120 | `btn.serializeValue = () => undefined` (suppresses the button widget); `camera.serializeValue` async-captures a frame and returns the upload filename. |
| `extensions/core/load3d.ts` | 364 | Async — serializes the 3D scene to a string. |
| `extensions/core/groupNode.ts` | 956 | **Restoration**: when a converted-widget is re-projected into a group's inner node, the original `origSerializeValue` is reattached. Implies *somewhere else* an `origSerializeValue` was stashed and `serializeValue` was overwritten. |
| `composables/painter/usePainter.ts` | 696 | Async — serializes mask canvas to a base64 PNG. |
| `composables/node/useNodeAnimatedImage.ts` | 58 | `() => undefined` to suppress the widget from prompts. |
| `scripts/domWidget.ts` | 352 | `BaseDOMWidget.override serializeValue(): V` — overridden as a class method on the DOM widget abstract base; the only place this is a method instead of an assignment. |

Type augmentation:
- `types/litegraph-augmentation.d.ts:56` defines the optional method on
  `IBaseWidget`: `serializeValue?(node, index): Promise<unknown> \| unknown`.
- `types/simplifiedWidget.ts:77` mirrors it for the v2 `SimplifiedWidget`.

**Invocation sites — only one in production code:**

```ts
// ComfyUI_frontend/src/utils/executionUtil.ts:96-104
// Note: widget.options.serialize controls prompt inclusion (checked here).
// widget.serialize controls workflow persistence (checked by LGraphNode).
if (widgets) {
  for (const [i, widget] of widgets.entries()) {
    if (!widget.name || widget.options?.serialize === false) continue
    const widgetValue = widget.serializeValue
      ? await widget.serializeValue(node, i)
      : widget.value
    ...
```

That comment in `executionUtil.ts` is the **canonical mental model**: there
are TWO orthogonal opt-out flags (`widget.serialize` for workflow,
`widget.options.serialize` for prompt) and the `serializeValue` hook only
fires for the prompt path. This is restated in
`src/lib/litegraph/docs/WIDGET_SERIALIZATION.md` per the litegraph AGENTS.md
note.

External evidence (R7 database, S4.W3 row): canonical assignment in
`834t/ComfyUI_834t_scene_composer/js/b34t_scene_composer.js:135`,
`Raykosan/ComfyUI_RaykoStudio/web/rayko_lora_widget.js:31`, plus `40+`
custom node packs use this surface.

### 1b. `onSerialize` (S2.N6) — assignment + invocation

Defined as an optional instance method on `LGraphNode`:

```ts
// ComfyUI_frontend/src/lib/litegraph/src/LGraphNode.ts:628
onSerialize?(this: LGraphNode, serialised: ISerialisedNode): void
```

**Invocation sites — exactly two in core:**

| File | Line | Context |
| --- | --- | --- |
| `lib/litegraph/src/LGraphNode.ts` | 992 | Tail of `LGraphNode.serialize()`: `if (this.onSerialize?.(o)) console.warn(...)` — extensions are expected to mutate `o` in place; returning a value triggers a console warning. |
| `lib/litegraph/src/LGraph.ts` | 2492 | Different surface: `LGraph.onSerialize?(data)` fires at the end of `LGraph.serialize()`. Only one invocation; data layer, not node layer. |

**No internal first-party assignments.** The frontend repo does not assign
`onSerialize` anywhere in `src/`; the surface exists purely for extensions.

External evidence (R7 database, S2.N6 row): real-world patches in
`LaoMaoBoss/ComfyUI-WBLESS/web/nodes/jimeng_image.js:480-481`,
`tetsuoo-online/Comfyui-TOO-Pack/web/file_naming_node_DOM.js`,
plus more — used to inject custom keys into the saved workflow JSON
(state that has no widget representation: hidden config, computed
sidecar data, lazy upload metadata).

### 1c. `prototype.serialize` / `node.serialize` (S2.N15) — assignment + invocation

This is the **wholesale** override: extensions replace `LGraphNode.serialize`
entirely, then optionally call the original via a captured `orig` reference.

**No internal first-party assignments** in `ComfyUI_frontend/src/`. The grep
returns zero matches for `nodeType.prototype.serialize = ...` or
`node.prototype.serialize = ...` in the frontend codebase. This surface
exists solely as an extension extension point — and a heavily-used one.

**Invocation sites (callers of `node.serialize()`):**

| File | Line | Caller / purpose |
| --- | --- | --- |
| `lib/litegraph/src/LGraph.ts` | 1344 | `LGraph.cloneNode` → `newnode.configure(node.serialize())` |
| `lib/litegraph/src/LGraph.ts` | 2450 | `LGraph._serializeNodes` (helper for partial graph slices) |
| `lib/litegraph/src/LGraph.ts` | 3188 | `LGraph.serialize()` — the workflow-save path: `nodes: this.nodes.map((node) => node.serialize())` |
| `lib/litegraph/src/subgraph/subgraphUtils.ts` | 224, 230 | Subgraph promotion: `structuredClone(node.serialize())` to snapshot before the node is re-parented |
| `platform/nodeReplacement/useNodeReplacement.ts` | 174, 284 | `node.last_serialization ?? node.serialize()` — pre-replacement snapshot for rollback |

External evidence (R7 database, S2.N15 row, severity **CRITICAL**):
`Azornes/Comfyui-LayerForge/js/CanvasView.js:1438` and `src/CanvasView.ts:1657`
(313★) replace `serialize` wholesale to inject canvas state. Listed as
"40+ repo impact" in `ComfyUI_frontend/AGENTS.md §5`.

### 1d. Direct `widget.value` reads at save/queue time (no hook)

These are the **bypass paths** that don't pass through any extension hook
and are the ground truth of "what the workflow saves":

| File | Line | What it does |
| --- | --- | --- |
| `lib/litegraph/src/LGraphNode.ts` | 976 | **Workflow save** — `o.widgets_values[i] = val` (where `val = widget?.value`). This is the *only* widget value persisted to workflow JSON. `widget.serializeValue` is **never called** here. The only opt-out is `widget.serialize === false`. |
| `utils/executionUtil.ts` | 104 | **Prompt fallback** — `widget.serializeValue ? await widget.serializeValue(node, i) : widget.value` |
| `extensions/core/widgetInputs.ts` | 83 | **PrimitiveNode rehydration** — reads `this.widgets_values[i]` (not `widget.value`!) inside `onAfterGraphConfigured` because PrimitiveNode's widgets don't exist until connection time. |

Symmetric load path: `LGraphNode.ts:922` writes back via
`widget.value = info.widgets_values[i++]`.

---

## 2. Why three surfaces exist (history + divergent intents)

The three surfaces accumulated because each was added to solve a *different*
class of problem, and none of them were ever consolidated:

### 2.1 `widget.value` direct read (the original)

The base case: a widget has a value, the workflow saves the value, the
prompt sends the value. No hook needed for ~90% of widgets (number, string,
toggle, combo). The save path has lived at `LGraphNode.serialize()` since
the original LiteGraph.js fork.

### 2.2 `widget.serializeValue` (S4.W3) — added for transformed-at-send

Need: "the value the user sees in the widget is not the value the backend
should receive." Examples:

- **Dynamic prompts** (`{a|b}` → `a` randomly per queue) — value mutates
  on each prompt; the workflow JSON keeps the template but the prompt gets
  the resolved string.
- **Async upload before send** — webcam, audio, painter, 3D scene: the
  widget value is a local blob ref or canvas; the prompt needs a server
  filename, and that filename is only known after the upload `await`s.
- **Suppression** — return `undefined` so a button or animated-preview
  widget is omitted from the prompt entirely.

This is why `serializeValue` is `async` (returns `Promise<unknown> | unknown`)
and lives only on the *prompt* path: it's the "transform at queue time"
hook. Adding it to the workflow-save path would have meant making
`LGraph.serialize()` async, which was not done.

### 2.3 `onSerialize` (S2.N6) — added for "extra fields on the node JSON"

Need: "I want to persist *node-level* state that has no widget." Examples
in the wild: WBLESS image cache filenames, TOO-Pack DOM-node state,
LayerForge canvas thumbnails. The hook is post-hoc: extension mutates `o`
after the base implementation has already filled in
`widgets_values`/`inputs`/`outputs`. The console warning on a non-void
return is a signal that the contract was historically muddled — early
extensions tried to *replace* the serialised object, which broke the base
fields.

### 2.4 `prototype.serialize` (S2.N15) — added for "I need to replace the whole thing"

Need: "I need control before AND after the base implementation, including
the ability to fail-soft when widgets are absent." This is exactly
PrimitiveNode's problem (ADR 0006 §A): widgets don't exist on a freshly-
copied clone, so the base `serialize()` writes `widgets_values: []`. The
fix is a wholesale override that falls back to `this.widgets_values`. The
same shape — "I need to wrap, not just append" — is what LayerForge does
with canvas state.

There is no clean public API for "wrap the base implementation"; the only
option is `const orig = ...; nodeType.prototype.serialize = function(){...}`,
which is the breakage class flagged as **CRITICAL** in the R7 database
because two extensions doing this against the same prototype will
silently overwrite each other.

### 2.5 Why we have all three rather than one

Three orthogonal axes were never collapsed:

```diagram
                     ╭─────────────────────────────────────╮
                     │  When does the transform run?       │
                     ├─────────────────────────────────────┤
                     │  workflow-save │ prompt-execute     │
   ┌─────────────────┼────────────────┼────────────────────┤
   │ scope: widget   │  widget.value  │  serializeValue    │
   │                 │  (direct read) │  (S4.W3)           │
   ├─────────────────┼────────────────┼────────────────────┤
   │ scope: node     │  onSerialize   │  (none — must use  │
   │ (append)        │  (S2.N6)       │   widget hooks)    │
   ├─────────────────┼────────────────┼────────────────────┤
   │ scope: node     │  prototype.    │  (none)            │
   │ (wrap/replace)  │  serialize     │                    │
   │                 │  (S2.N15)      │                    │
   └─────────────────┴────────────────┴────────────────────┘
```

The bottom-right cells are empty because nobody designed for "I need
node-level prompt-time transformation" — extensions that need it (e.g.
LayerForge merging canvas state into the queued prompt) reach for
`prototype.serialize` and accept that it only runs on workflow-save, then
set the equivalent prompt-side state via separate mechanisms (a hidden
widget, a backend-side override, or an `app.queuePrompt` patch — see S6
in the touch-point database).

---

## 3. Who calls what, when (lifecycle table)

```diagram
╭──────────────────────╮     ╭────────────────────────────╮
│  User saves workflow │────▶│  app.serialize / save flow │
╰──────────────────────╯     ╰─────────────┬──────────────╯
                                           ▼
                              ╭───────────────────────────╮
                              │  LGraph.serialize()       │
                              │  (LGraph.ts:3188)         │
                              ╰─────────────┬─────────────╯
                                            ▼ for each node
                              ╭───────────────────────────╮
                              │  node.serialize()         │  ← S2.N15 wraps here
                              │  (LGraphNode.ts:944)      │
                              ╰─────────────┬─────────────╯
                                            │
                                            ├─ reads widget.value directly
                                            │  (LGraphNode.ts:976)
                                            │  → o.widgets_values[i]
                                            │
                                            └─ calls onSerialize?(o)        ← S2.N6 mutates here
                                               (LGraphNode.ts:992)

╭──────────────────────╮     ╭────────────────────────────╮
│  User clicks Queue   │────▶│  app.graphToPrompt()       │
╰──────────────────────╯     ╰─────────────┬──────────────╯
                                           ▼
                              ╭───────────────────────────╮
                              │  graph.serialize() FIRST  │  ← S2.N6 + S2.N15 + direct widget.value
                              │  (executionUtil.ts:44)    │     ALSO fire here (workflow snapshot)
                              ╰─────────────┬─────────────╯
                                            ▼
                              ╭───────────────────────────╮
                              │  build ComfyApiWorkflow   │
                              │  for each node, widget:   │
                              │    serializeValue ??       │  ← S4.W3 fires here
                              │      widget.value         │     (executionUtil.ts:102-104)
                              ╰───────────────────────────╯

╭──────────────────────╮     ╭────────────────────────────╮
│  Copy / Paste node   │────▶│  LGraph.cloneNode          │
╰──────────────────────╯     │  → node.serialize()        │  ← S2.N15 + S2.N6 + direct widget.value
                             │  (LGraph.ts:1344)          │     (S4.W3 NOT called)
                             ╰────────────────────────────╯

╭──────────────────────╮     ╭────────────────────────────╮
│  Subgraph promotion  │────▶│  subgraphUtils.ts:224, 230 │  ← S2.N15 + S2.N6 + direct widget.value
╰──────────────────────╯     │  structuredClone(...)      │
                             ╰────────────────────────────╯

╭──────────────────────╮     ╭────────────────────────────╮
│  Node replacement    │────▶│  useNodeReplacement.ts:174 │  ← S2.N15 + S2.N6 + direct widget.value
╰──────────────────────╯     │  node.last_serialization ?? │
                             │   node.serialize()         │
                             ╰────────────────────────────╯
```

**Key asymmetry**: prompt-execute calls `graph.serialize()` first
(workflow snapshot embedded in the prompt for PNG metadata), so S2.N6 +
S2.N15 + direct `widget.value` *all fire twice* on every queue: once for
the embedded workflow JSON, then again logically when the prompt-side
loop reads `widget.serializeValue`. S4.W3 fires *only* on the prompt-build
loop. Workflow-save / autosave / copy / subgraph-promote / node-replace
fire only the workflow-side surfaces.

---

## 4. Collision risks

### 4.1 Same-surface stomping

- **Two extensions assigning `serializeValue` on the same widget**: last
  writer wins silently. `nodeCreated` runs in extension registration
  order, so whichever extension's `nodeCreated` runs last clobbers the
  earlier one's transform. `dynamicPrompts.ts:17` and
  `saveImageExtraOutput.ts:42` *would* collide if applied to the same
  widget — only the registration ordering saves them.
- **Two extensions assigning `prototype.serialize`** on the same node
  type: classic prototype-chain stomping. The last `prototype.serialize =
  function(...)` wins; if extension A captured `orig = prototype.serialize`
  before extension B did the same, A's wrapper now points at B's
  replacement, calling order is lost, the base is double-wrapped or never
  called. R7 marks this **CRITICAL** with silent breakage class.
- **Two extensions assigning `onSerialize`**: same as above; instance-level
  assignment, last writer wins, no chaining. Less common because it's
  typically assigned per-instance in `nodeCreated`, but still racy when
  multiple extensions filter the same `node.type`.

### 4.2 Cross-surface interaction

- **`onSerialize` mutates `o.widgets_values[i]`** after the base loop
  filled it from `widget.value`. An extension that *also* set
  `widget.serializeValue` for that index is shocked to find that the
  workflow JSON has the `onSerialize`-mutated value — but the prompt has
  the `serializeValue`-mutated value. They diverge.
- **`prototype.serialize` calls `orig.call(this)` then mutates** —
  which means `onSerialize` already ran (it's inside `orig`), so any
  changes the wrapper now makes happen *after* per-node hooks. Order is
  fixed and surprising.
- **Group nodes** (`groupNode.ts:956`) actively *swap* `serializeValue`
  back to `origSerializeValue` for converted widgets when projecting
  inner-node state. This means an extension's `serializeValue` set in
  `nodeCreated` on the inner node type can be silently *removed* once
  the node is grouped, then re-attached when ungrouped. Not a collision
  per se but a hidden state machine on the hook itself.

### 4.3 Diverged copies of the same value

`widget.value` can be read three different ways depending on path:

1. **workflow JSON** — direct `widget.value` (no hook).
2. **prompt** — `widget.serializeValue?.(...)  ?? widget.value`.
3. **PrimitiveNode rehydration** — `this.widgets_values[i]` (the
   already-serialized snapshot, *not* the live widget value), per
   `widgetInputs.ts:83`.

So the workflow saved on disk, the prompt sent to the backend, and the
post-load runtime widget value can all be different from each other.
ADR 0006 §A's "PrimitiveNode loses widgets_values on copy" is exactly
this divergence: the base loop reads `widget.value` from a clone whose
`this.widgets` is empty, so the workflow saves `[]`, while the prompt
path would have happily run `serializeValue` and returned the right
thing — except prompt-build doesn't run on copy.

---

## 5. Cross-references

### 5.1 ADR 0006 (PrimitiveNode copy/paste) — direct intersection

`adr-0006-primitive-copy-paste-summary.md` Option A is *literally* a
narrowly-scoped `prototype.serialize` override on `PrimitiveNode` that
falls back to `this.widgets_values` when `this.widgets` is missing. The
ADR's three options map onto the surfaces above:

- **Option A** — wholesale `prototype.serialize` override (S2.N15
  pattern, applied internally rather than by an extension).
- **Option B** — clone-configured-instance lifecycle; widgets exist at
  copy time so the base loop reads `widget.value` correctly. Eliminates
  the need to override S2.N15.
- **Option C** — projection model (no own state, just a view of the
  target). Eliminates `widget.value` *entirely* for primitives and
  matches the "lazy on access" shape proposed in
  `widget-api-thoughts.md`.

ADR 0006 is *the* concrete example of why three surfaces is too many:
fixing one path (copy) requires reaching for the heaviest surface
(`prototype.serialize`) because the lighter surfaces (`serializeValue`,
`onSerialize`) don't apply on the copy code path.

### 5.2 `widget-api-thoughts.md` — lazy-on-access proposal

The driver doc proposes:

> "Change to serialize on access" — and immediately enumerates edge cases:
> widgets that upload files (3d), widgets with heavy perf cost (webcam),
> widgets that rely on specific non-hot-path serialization steps (webcam),
> widgets whose post-serialize value depends on lifecycle steps that they
> expect have happened.

These edge cases map 1:1 onto the *current users of `widget.serializeValue`*
catalogued in §1a above: `load3d.ts`, `webcamCapture.ts`, `uploadAudio.ts`,
`usePainter.ts`. The proposal is therefore: **collapse all of `widget.value`
direct reads + `widget.serializeValue` + per-node `onSerialize` /
`prototype.serialize` mutations into a single lazy-on-access getter**, and
deal with the perf / async / lifecycle edge cases as first-class concerns
rather than the current "extensions hack around the problem with `await`
inside `serializeValue`."

### 5.3 Slack thread — `widget-props-serialization-from-slack.md`

The Slack design discussion adds a fourth pressure: per-instance widget
*config* (min/max/step on Primitive Int/Float) needs to be serialized
*alongside* the value, and survive promotion through subgraph IO and
PrimitiveNode wrapping. Glary-Bot's recommendation lands on a value-envelope
shape `{value, min?, max?, step?}` — which means `widget.serializeValue`
would return an object instead of a scalar, and `LGraphNode.serialize`'s
direct `widget.value` read would *also* need to return an envelope. Today
those two paths can't agree because they don't go through the same code.

A unified lazy getter would fix this by definition.

### 5.4 R7 touch-point database

- **S4.W3** (`widget.serializeValue` direct assignment) — listed `v2_replacement:
  widget.setSerializeValue(fn)`, already present in `extensionV2.ts WidgetHandle`.
- **S2.N6** (`onSerialize` patching) — listed `v2_replacement:
  node.on('beforeSerialize', (workflow) => {...})`, **proposed**, not yet in v2.
- **S2.N15** (`prototype.serialize` wholesale) — listed `v2_replacement:
  node.on('beforeSerialize', node => mutate(node)) AND/OR schema-declared
  serialize fields`, **proposed**, not yet in v2. **Marked CRITICAL**.

Verified internally: the v2 service files (grepped: `setSerializeValue`,
`WidgetHandle`, `setBeforeSerialize` returned no hits in
`ComfyUI_frontend/src/services/`) — i.e. as of this audit, only the
`extensionV2.ts` interface comments mention these v2 hooks; no
implementation has landed yet. This confirms I-WS is greenfield design
work, not a rename of an existing API.

---

## 6. Migration implication → I-WS.3 lazy-getter design

The lazy-on-access getter proposal in `widget-api-thoughts.md` has to
replace **all four** surfaces above with a single channel and answer five
concrete questions raised by this audit:

1. **Async**: `serializeValue` is `async` because uploads are async. The
   lazy getter must also be async (or define a sync-ok fast path for
   pure widgets and an async slow path for upload widgets). Current code
   `await`s inside `executionUtil.ts:103` — that contract has to survive.
2. **Suppression**: `() => undefined` is a valid current-day suppression
   pattern. Lazy getter needs an explicit "skip me" sentinel distinct
   from "my value is undefined."
3. **Workflow-vs-prompt divergence**: Today S4.W3 fires only on prompt;
   `dynamicPrompts.ts:17` actively *mutates* `workflowNode.widgets_values`
   from inside a `serializeValue` hook to keep them in sync — a subtle
   contract that must be preserved (or explicitly broken with a migration
   note).
4. **Node-level state with no widget**: the legitimate use case for
   `onSerialize` (LayerForge canvas thumbnails, WBLESS cache filenames).
   The lazy getter is widget-scoped; node-scoped sidecar state needs its
   own answer — likely a node-level `getSerializedState()` companion
   (matches R7's proposed `node.on('beforeSerialize', ...)` v2
   replacement for S2.N6).
5. **Wrap-the-base-impl** (`prototype.serialize`): the heaviest pattern
   exists because there's no "hook before / hook after" pair. The v2
   API needs to expose at least a `setSerializeWrapper(fn)` per node, or
   provide enough pre/post hooks that no extension ever needs to reach
   for prototype patching. R7 marks 40+ packs depending on this; a
   migration shim is non-negotiable.

I-WS.3 should produce the **single lazy-getter contract** plus the
**three-or-four migration shims** that intercept the legacy assignment
sites (`widget.serializeValue =`, `node.onSerialize =`,
`prototype.serialize =`, and the bare `widget.value` read) and route
them through the new getter, so v1 and v2 extensions coexist during the
parallel-paths transition (D6).

The clearest test of the design is whether ADR 0006 Option A becomes
**unnecessary**: if the lazy getter handles "widgets don't exist on this
clone" by returning the cached envelope from `widgets_values`, then
PrimitiveNode copy/paste fixes itself and the four serialization
surfaces collapse to one.

---

## 7. I-WS.3 compatibility with `widgets_values_named` (I-UWF.8)

**Question:** Is I-WS.3's lazy-on-access value getter compatible with
Austin's `widgets_values_named` (PR #10392) and `widgetValueStore`
(PR #8594, merged)?

**Short answer: Yes — they are complementary, not conflicting. I-WS.3
must be designed to write through `widgetValueStore`, not around it.**

### What `widgetValueStore` / `widgets_values_named` does

`widgetValueStore` (PR #8594, merged) is a Pinia store that holds widget
values as a `Map<widgetId, value>` keyed by stable widget identity (name,
not positional index). At workflow-save time, `widgets_values_named` is
emitted alongside `widgets_values` as a named key→value record:

```json
{
  "widgets_values": [42, 0.7, "euler"],
  "widgets_values_named": { "seed": 42, "cfg": 0.7, "sampler_name": "euler" }
}
```

On `configure()`, when `LiteGraph.namedValuesRestore` is on, the named
map is used instead of the positional array — making index drift
harmless. `fallbackWidgetsValuesNames` in `/object_info` bridges
pre-named workflows.

### What I-WS.3 proposes

A lazy-on-access getter replacing the four current serialization surfaces
(§1a–1d above) with a single `getSerializedValue()` channel. The getter
would be called at save/queue time instead of reading `widget.value`
directly, and would cache the result.

### Compatibility analysis

**1. Resolution path must go through `widgetValueStore`.**

`widgetValueStore` holds the authoritative runtime value for each widget
by name. I-WS.3's getter must read from — and write back to —
`widgetValueStore`, not a parallel cache. If I-WS.3 maintains its own
value store, `widgets_values_named` writes stale data (whatever was in
`widget.value` last) rather than the getter's transformed value. Concretely:

```
BAD:  widget.value (live) → getter transforms → lazy cache → prompt
      widget.value (live) → widgetValueStore → widgets_values_named  ← diverges

GOOD: widget.value (live) → widgetValueStore → getter transforms → prompt
                                           ↑
                               also written to widgets_values_named
```

I-WS.3 must hook *after* `widgetValueStore` receives the value, or
`widgetValueStore` must be the thing that triggers the lazy getter.

**2. Name-keyed identity is already what I-WS.3 needs.**

`widgets_values_named` keys by widget name, not positional index. The
lazy getter must also identify widgets by name to survive index drift
(per §5.2 / widget-api-thoughts.md). Both systems want the same
identity scheme — this is alignment, not conflict.

**3. The async case is the only friction point.**

`widgets_values_named` is written synchronously at save time (PR #10392
reads from `widgetValueStore`, which holds the last-known value). I-WS.3's
upload widgets (`webcamCapture`, `uploadAudio`, `load3d`, `usePainter`)
are async — they must upload before a filename is known. The current
`serializeValue` async path runs at *prompt time* only, meaning:

- **Workflow JSON** (save, copy, subgraph promote): uses `widget.value`
  directly (no async) → `widgets_values_named` records the pre-upload
  local ref, not the filename.
- **Prompt** (queue): runs `await serializeValue(...)` → backend receives
  the filename.

This is the **existing divergence** (§2.2). I-WS.3's lazy getter does not
need to fix this for `widgets_values_named` compatibility — the same
split was always intentional: workflow JSON saves intent (template, local
blob ref), prompt sends transformed result (resolved string, upload
filename). `widgetValueStore` correctly holds the intent value; the
getter transforms it at queue time.

**Implication for I-WS.3 design:** the lazy getter has two modes:

| Context | Source | Async? | Written to `widgets_values_named`? |
|---|---|---|---|
| `workflow-save` | `widgetValueStore` (intent value) | No | Yes |
| `prompt-build` | getter transform (e.g. upload then return filename) | Yes | No — prompt value is ephemeral |
| `clone` / `subgraph-promote` | `widgetValueStore` (intent value) | No | Yes (in new node's store) |

This is exactly the `event.context` field from D5's `BeforeSerializeEvent`
(`'workflow' | 'prompt' | 'clone' | 'subgraph-promote'`). The getter
should receive `context` so upload widgets can short-circuit on
non-prompt contexts without doing unnecessary work.

**4. `fallbackWidgetsValuesNames` and I-WS.3 migration shims.**

PR #10392 adds `fallbackWidgetsValuesNames` to `/object_info` so nodes
can declare the old positional order, letting `configure()` bridge
pre-named workflows. I-WS.3's migration shims for `serializeValue =`,
`onSerialize =`, `prototype.serialize =` must preserve this bridge — the
shim should write the intercepted value into `widgetValueStore` under the
widget's name so `widgets_values_named` is populated correctly even when
the extension is still using the v1 hook.

### Summary for I-WS.3 implementation

- **Must do:** write through `widgetValueStore`; don't maintain a parallel
  value cache.
- **Must do:** accept `context: 'workflow' | 'prompt' | 'clone' | 'subgraph-promote'`
  so async upload widgets can no-op on non-prompt contexts.
- **Must do:** migration shims write intercepted v1 values into
  `widgetValueStore` by widget name, not positional index.
- **Compatible as-is:** async prompt-time transforms diverging from
  workflow-save values — this is intentional and correct.
- **Track:** PR #10392 status (changes requested by DrJKL). I-WS.3
  implementation should not start until #10392 is either merged or the
  `widgetValueStore` API is confirmed stable.
