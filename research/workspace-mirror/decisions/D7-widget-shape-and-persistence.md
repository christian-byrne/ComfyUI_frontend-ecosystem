# ADR-D7: Widget Shape — First-Class Fields vs Options Bag, and Persistence Model

**Status**: proposed
**Date**: 2026-05-08
**Related cluster**: Reviewer Feedback Cluster B (F4, F5, F11)
**Blocks**: PKG2 (`WidgetHandle` declaration), I-WS.3 (lazy serialization design)
**Informed by**:
- `research/architecture/widget-props-serialization-from-slack.md` (Slack thread: Primitive Int/Float metadata design, Glary-Bot analysis, Christian/Austin/Alex/Jedrzej discussion)
- `research/architecture/widget-serialization-state.md` (I-WS.1: 3-surface audit)
- `research/architecture/widget-serialization-edge-cases.md` (I-WS.2: 7 edge-case widgets)
- D5 (event payload typing), D6 (parallel paths), D10d (proxyRefs wrap)
- Touch-points S4.W3, S2.N6, S2.N15, S6.A1

---

## Context

Three reviewer comments on `extensionV2Service.ts` asked the same underlying question different ways:

- **F4** — Why is `hidden` a first-class field (`isHidden()/setHidden()`) instead of an entry in `WidgetOptions`?
- **F5** — Same question for `label`.
- **F11** — `getProperty/getProperties` needs to be the canonical persistent-state API. The v2 contract for what persists, when, and how must be explicit.

These are one question: **what is the data model of a widget, what persists, and what is the principled rule for first-class field vs options bag vs persistent properties?**

The Slack thread (`widget-props-serialization-from-slack.md`) adds a concrete pressure case: Primitive Int/Float nodes need per-instance min/max/step metadata that must survive serialization to workflow JSON, subgraph IO promotion, PrimitiveNode wrapping, and copy/paste — but NOT necessarily change the prompt API contract to the backend (which stays as a plain scalar). This is a _widget-instance config_ use case, distinct from widget _value_.

The serialization audit (I-WS.1) revealed that the current system has **four** overlapping serialization surfaces (direct `widget.value` read, `widget.serializeValue`, `node.onSerialize`, `nodeType.prototype.serialize`) that differ by scope (widget vs node) and timing (workflow-save vs prompt-execute), collide silently when two extensions target the same widget/node, and collectively produced the ADR 0006 bug. Any D7 decision must collapse these toward one principled model.

The critical constraint from the user (recorded in the scoping placeholder):
> **No inconsistent ad-hoc distinctions.** The rule for what is first-class vs what is in an options bag must be principled, not case-by-case.

---

## Decision

### Part 1 — The principled rule: Universal-vs-typed

The rule for distinguishing first-class fields from options bag entries is:

> **Every-widget concerns are first-class. Type-specific concerns are in the options bag.**

A "concern" is every-widget if and only if it applies identically to _all_ widget kinds — INT, FLOAT, STRING, COMBO, BOOL, BUTTON, DOM widget — regardless of type. A concern is type-specific if it only makes sense for a subset of widget kinds.

Applying this rule:

| Property | First-class or Options? | Reason |
|---|---|---|
| `label` | **First-class** | Every widget has a display name. It is index-addressable in the workflow. Applies to INT, FLOAT, STRING, COMBO, BUTTON, DOM widget. |
| `hidden` | **First-class** | Every widget can be hidden/shown. Lifecycle hooks depend on this state. It is a visibility predicate used by layout, canvas drawing, and DOM widget positioning uniformly. |
| `disabled` | **First-class** | Every widget can be disabled/enabled. Applies uniformly. |
| `value` | **First-class** | Every widget has a runtime value, serialized to `widgets_values`. |
| `min`, `max`, `step` | **Options bag** | Only meaningful for numeric widgets (INT, FLOAT). A STRING widget's options bag would never have `min`. |
| `multiline`, `dynamicPrompts` | **Options bag** | Only meaningful for STRING widgets. |
| `image_folder`, `upload_to` | **Options bag** | Only meaningful for upload/file widgets. |
| `serialize` (opt-out flag) | **First-class** | Every widget can opt out of serialization. Applies uniformly to BUTTON, animated-preview, DOM widgets. |

This rule **directly resolves F4 and F5**: `hidden` and `label` are first-class because they are every-widget, not type-specific. The reviewer's implicit preference for an options bag would be valid only if these properties appeared for some widget kinds and not others — they don't.

The same rule applies to the accessor/method distinction from D6 Part 3:
- Invariant-shaped every-widget properties → accessor pair (`isHidden() / setHidden()`)
- Action-shaped mutations that fire events → methods (`setValue(v)`)
- Type-specific options bag entries → accessible via `getOption<T>(key)` / `setOption<T>(key, value)` rather than first-class methods

---

### Part 2 — The persistence model: three-tier, explicit matrix

Widget state has **three distinct tiers**, each with different persistence semantics:

| Tier | What it contains | API shape | Persistence |
|---|---|---|---|
| **Value** | The user-edited runtime value (`widget.value`). Single scalar or composite object depending on type. | `getValue(): T` / `setValue(v: T)` | workflow JSON (`widgets_values`), API prompt, copy/paste, subgraph promotion |
| **Options** | Type-specific config set at node-def registration time. Defaults from `INPUT_TYPES`. May have per-instance overrides (see Part 3). | `getOption<T>(key)` / `setOption<T>(key, val)` | **workflow JSON** for per-instance overrides (as `widget_options` sidecar, see Part 3). NOT in API prompt. |
| **Extension state** | Per-extension reactive data living in `entity.extensionState[extName]` (D10d). | `proxyRefs`-wrapped object returned by `setup()`. | **NOT persisted** — reset on copy (D12), reset on reload. State that must survive goes in Value tier via `widget.on('beforeSerialize', ...)`. |

This directly resolves F11: `getProperty / getProperties` from v1's node-level `node.properties` map is **not** a first-class widget API. Extensions that want persistent per-node-instance state must either:
1. Route it through an owned widget's `value` (the cleanest path for data the backend also needs), or
2. Route it through `node.on('beforeSerialize', ...)` / `node.on('afterDeserialize', ...)` (for node-level sidecar state with no widget representation — the v2 replacement for S2.N6 `onSerialize`).

The v1 `node.properties` bag remains accessible via `NodeHandle.getProperty / setProperty` as a **migration shim** (extensions in v1 used it extensively for per-instance widget config like min/max, as ADR 0006 and the Slack thread document). But it is not the canonical persistence model for new extensions writing against v2.

**Persistence matrix (complete):**

|                          | workflow save | API prompt | copy/paste | subgraph promotion | dispose/reload |
|--------------------------|:---:|:---:|:---:|:---:|:---:|
| `widget.value`           | ✅ | ✅ | ✅ | ✅ (projected) | ✅ (restored from JSON) |
| `widget.options` (class defaults) | ❌ | ❌ | derived at connect time | derived at connect time | derived from `INPUT_TYPES` |
| `widget.options` (per-instance overrides) | ✅ (as `widget_options` sidecar in workflow) | ⚠️ optional envelope (see Part 3) | ✅ (via `widgets_values` or sidecar) | ✅ (via `ExposedWidget.overrides`) | ✅ (restored from sidecar) |
| `extensionState` (setup return) | ❌ | ❌ | ❌ (reset per D12) | ❌ (entityId-preserving move, scope survives) | ❌ (fresh setup) |
| `node.properties` (v1 compat) | ✅ | ❌ | ✅ | ⚠️ (lost today — not fixed by D7) | ✅ |

**Notable cells:**

- **Subgraph promotion / `extensionState`**: Subgraph promotion is an entityId-preserving DOM move (per D2 §2.3, D9 Phase A). The `NodeInstanceScope` survives promotion — `scope.stop()` does NOT fire, `onNodeRemoved` does NOT fire. So `extensionState` data persists across promotion. The ❌ means it is not serialized _to disk_.
- **`node.properties` across subgraph promotion**: Currently lost. Not a D7 BLOCKER — the v2 persistence story (route through Value or `beforeSerialize`) is the fix, and D7 does not promise to fix v1 `node.properties` promotion gaps.
- **Per-instance `widget.options` overrides in API prompt**: Optional envelope (see Part 3 below). The backend does not need min/max/step — they are UI metadata. The prompt API stays as a plain scalar unless the extension author explicitly ships an override that changes the backend contract.

---

### Part 3 — Per-instance widget config: the value-envelope model

The Slack thread's Primitive Int/Float case is the canonical use case for **per-instance widget options**: the user sets min/max/step on a specific Primitive node, and those values must survive the full transport matrix without changing the backend scalar contract.

The decision: **store per-instance config overrides on the widget, serialize them as a `widget_options` sidecar field in the workflow JSON, and use an optional value-envelope in the API prompt when the extension explicitly opts in.**

**Workflow JSON shape** (additive, backward-compatible):

```json
{
  "nodes": [{
    "widgets_values": [20, "fixed"],
    "widget_options": [{"min": 0, "max": 100, "step": 1}, null]
  }]
}
```

`widget_options` is an array parallel to `widgets_values`. `null` means "use class defaults." Missing key = old workflow = backward-compatible.

`LGraphNode.serialize()` emits `widget_options[i]` when `widget._options_overrides` is non-null. `LGraphNode.configure()` reads it back and applies overrides. This is the "one source of truth" that survives copy/paste, subgraph promotion, and reload.

**Subgraph IO promotion**: `ExposedWidget` gains an optional `overrides` field:

```ts
interface ExposedWidget {
  id: NodeId
  name: string
  overrides?: { min?: number; max?: number; step?: number }  // per-instance
}
```

Promotion reads the source widget's `_options_overrides` and writes them here. `promotedWidgetTypes.ts` merges on read.

**API prompt**: The backend receives a plain scalar by default. The `widget.serializeValue` → v2 `beforeSerialize` event (per D5 Part 3) _may_ emit an envelope `{value, min?, max?, step?}` if the extension author opts in, but this is not default behavior. A 7-line unwrap in the backend (`execution.py:957-973`) makes the envelope transparent to all FUNCTION handlers. This is not mandatory; it is an opt-in for extensions that want the backend to see the config.

**v2 API surface**:

```ts
// Per-instance options override (replaces node.properties.{min,max,...} anti-pattern)
widget.setOption('min', 0)
widget.setOption('max', 100)
widget.getOption<number>('min')  // returns instance override ?? class default

// These are serialized to widget_options sidecar.
// Internal storage: widget._options_overrides = { min, max, step }
```

**Migration shim**: `LGraphNode.configure()` detects old-format `node.properties.{min,max,step,precision,round,gradient_stops}` (from PR #7768 and other v1 extensions) and migrates them to `_options_overrides` in-place. One-way; after one save/load cycle, the old `node.properties` key is no longer needed.

**Rationale for the value-envelope model vs alternatives:**

The Slack thread analyzed three paths — polymorphism (new BoxedInt type), structural typing (duck-type `{value,…}` as INT), and simple compat-layer (unwrap at execution time). Christian's conclusion was that a format-level change is needed (not frontend-only), but that structural typing and polymorphism are out of scope for the near term: too much engine churn, too many compat risks for custom nodes that do string-equality type matching. The value-envelope is the "format-level but minimal" path: additive to the schema, unwrapped by the backend before any FUNCTION or VALIDATE_INPUTS handler sees it, and not a new type system change.

---

### Part 4 — Serialization model: collapsing the four surfaces

This is the widget-shape consequence of I-WS.1's audit. The four current serialization surfaces (direct `widget.value` read, `widget.serializeValue`, `node.onSerialize`, `nodeType.prototype.serialize`) collapse in v2 to **two surfaces**:

| v1 surface | v2 replacement | What it replaces |
|---|---|---|
| `widget.serializeValue` / direct `widget.value` read | **`widget.on('beforeSerialize', event => ...)` event** (D5 Part 3) | Per-widget serialization transform, async-capable, fires for both workflow and prompt paths via a unified lazy getter |
| `node.onSerialize` + `nodeType.prototype.serialize` | **`node.on('beforeSerialize', event => ...)` event** | Node-level serialization hook; replaces both append (`onSerialize`) and wrap (`prototype.serialize`) patterns with a single event that mutates or replaces the serialized object |

The `event` object for the widget `beforeSerialize`:
- `event.setSerializedValue(v)` — override what gets written to `widgets_values[i]` and API prompt
- `event.skip()` — exclude this widget from the API prompt entirely (replaces `() => undefined` and `options.serialize = false`)
- `event.context: 'workflow' | 'prompt'` — tells the handler whether it's being called for workflow-save or prompt-build (resolves the current asymmetry where `serializeValue` only fires for prompt)
- Async-aware: if the handler is async, the caller `await`s it (the only async-allowed hook per D10c)

The `event` object for the node `beforeSerialize`:
- `event.data` — the `ISerialisedNode` object to mutate in place (replacing `onSerialize(o)`)
- `event.replace(fn)` — supply a wrapper function that receives `orig` and returns the modified serialized node (replacing `prototype.serialize = function(){ const r = orig.call(this); ... }`)
- `event.context: 'workflow' | 'prompt' | 'clone' | 'subgraph-promote'` — tells the handler the triggering path

**Why this resolves ADR 0006**: if `event.context === 'clone'`, the handler can safely skip re-computing the value (it will be populated from the source's `widgets_values` snapshot). No extension needs `prototype.serialize` just to fix "widgets don't exist on clone" — the framework handles the clone-context case and calls the handler with the source state already populated.

**Migration shims** (for the parallel-paths transition per D6):
- `widget.serializeValue = fn` assignment → intercepted, registers as `widget.on('beforeSerialize', event => { event.setSerializedValue(await fn(node, i)) })` under the hood.
- `node.onSerialize = fn` assignment → intercepted, registers as `node.on('beforeSerialize', event => fn(event.data))`.
- `nodeType.prototype.serialize = fn` assignment → Phase C strangler concern (D9); in Phase A/B, the override still fires as before (no interception yet).

---

### Part 5 — `WidgetHandle` shape (PKG2 contract)

With Parts 1–4 decided, `WidgetHandle` has the following principled shape:

```ts
interface WidgetHandle<T = WidgetValue> {
  // ── FIRST-CLASS (every-widget) ──────────────────────────────────────

  /** Widget display name. Read-only invariant (D6 Part 3). */
  readonly label: string

  /** Current user-edited value. State accessor pair (D6 Part 3). */
  getValue(): T
  setValue(v: T): void

  /** Visibility. State accessor pair. */
  isHidden(): boolean
  setHidden(v: boolean): void

  /** Disabled. State accessor pair. */
  isDisabled(): boolean
  setDisabled(v: boolean): void

  /** Opt out of workflow serialization entirely. */
  setSerializeEnabled(v: boolean): void
  isSerializeEnabled(): boolean

  // ── OPTIONS BAG (type-specific) ──────────────────────────────────────

  /** Get type-specific option, merged from class default and per-instance override. */
  getOption<T>(key: string): T | undefined

  /** Set per-instance option override (persisted as widget_options sidecar). */
  setOption<T>(key: string, value: T): void

  // ── EVENTS ──────────────────────────────────────────────────────────

  /** Serialization hook — replaces widget.serializeValue + widget.options.serialize. */
  on(event: 'beforeSerialize', handler: (e: WidgetBeforeSerializeEvent<T>) => void | Promise<void>): void

  /** Value changed. Replaces widget.callback. */
  on(event: 'valueChange', handler: (e: WidgetValueChangeEvent<T>) => void): void
}

interface WidgetBeforeSerializeEvent<T> {
  /** Which serialization path triggered this. */
  context: 'workflow' | 'prompt' | 'clone' | 'subgraph-promote'
  /** Override the serialized value. */
  setSerializedValue(v: unknown): void
  /** Exclude this widget from the output entirely (prompt-only skip). */
  skip(): void
}

interface WidgetValueChangeEvent<T> {
  oldValue: T
  newValue: T
}
```

**Not in `WidgetHandle` (by design)**:
- `node.properties` accessors — available on `NodeHandle`, not `WidgetHandle`; explicitly migration-shim territory
- Type-specific option names as first-class methods (no `setMin/setMax`) — use `setOption('min', v)` for all
- Direct `extensionState` accessors — accessed via `entity.extensionState[extName]` (D10d)
- `world`/ECS internals — not surfaced on handles (D3.4)

---

## Consequences

### Resolved

- **F4** (why is `hidden` first-class): because `hidden` is every-widget per Part 1's principled rule. The rule is stated; it applies uniformly.
- **F5** (same for `label`): same rule.
- **F11** (persistent state model): three-tier model (Value / Options / extensionState) with explicit persistence matrix. `node.properties` is a migration shim, not the v2 pattern.
- **Slack Primitive Int/Float design**: per-instance options overrides via `widget_options` sidecar + value-envelope opt-in. Resolves the "linked widgets / hidden widgets / node properties for widget instance props are all unmaintainable" conclusion from Christian's 3:13 AM message.
- **ADR 0006 intersection**: the `beforeSerialize` event with `event.context = 'clone'` makes `prototype.serialize` overrides unnecessary for the PrimitiveNode copy-paste bug.
- **PKG2 unblocked**: `WidgetHandle` shape is now specified (Part 5).

### Open (deferred)

- **I-WS.3 detailed design** — lazy-getter implementation, memoized-single-flight-per-epoch for async widgets (webcam, load3d, uploadAudio), migration shims for `serializeValue` assignment. D7 sets the target shape; I-WS.3 designs the implementation.
- **D8 (world-Vue adapter)** — the `getValue()` / `setValue()` reactivity story still needs the adapter to make `watch(() => widget.getValue())` work. D7 specifies the shape; D8 wires the reactivity.
- **`node.properties` across subgraph promotion** — currently lost; not a D7 blocker. Fix is for extensions to migrate to the Value tier or `beforeSerialize` event.
- **API prompt value-envelope** — the backend 7-line unwrap is specified but not scheduled. Backend team coordination needed. This does NOT block PKG2 or I-WS.3 — it is an opt-in enhancement.
- **`dependsOn` for serialize ordering across multiple extensions** — two extensions registering `beforeSerialize` on the same widget fire in D10b registration order. If ordering matters (e.g. one transform depends on another's output), there is no `dependsOn` in v1 per D10b. Document as a known limitation.

### Risks

- **`widget_options` sidecar is a new schema field** — any workflow parser or third-party tool that validates `ISerialisedNode` strictly will reject it until it adds the optional field. The field is additive and optional, so strict validators rejecting unknown keys are broken in a standards-sense, but pragmatically some tooling will need updates.
- **Two distinct async stories** (sync `setup`, async `beforeSerialize`) — teaching cost flagged in D10c; D7 inherits it for the widget API. Mitigated by D5 Part 3 documentation.

---

## Future Pivots

| Pivot | Rule | When |
|---|---|---|
| Typed option bags per widget kind | `WidgetHandle<T, Opts extends WidgetOptions>` where `Opts` is e.g. `NumberWidgetOptions` | Once PKG2 ships and author feedback shows the untyped `getOption<T>('min')` is a common pain point. Requires per-widget-kind type specializations in the package. |
| API prompt envelope as default | Change `beforeSerialize` to emit the value-envelope by default for option-bearing widgets | After backend unwrap is in production and tooling has updated. Track as a separate backend ADR. |
| `dependsOn` for serialize ordering | Add explicit cross-extension ordering to `beforeSerialize` handlers | If ≥3 real extensions hit a serialize-ordering dependency. Same gate as D10b `dependsOn`. |

---

## Cross-References

- **D5** — `beforeSerialize` is the async-aware event from D5 Part 3; D7 specifies the full `WidgetBeforeSerializeEvent` shape
- **D6 Part 3** — accessor/method hybrid rule applied to `WidgetHandle` shape in Part 5
- **D8** — `getValue()` / `setValue()` reactivity depends on the world-Vue adapter; D7 defers the reactive wiring to D8
- **D10c** — sync setup / async `beforeSerialize` is the narrow async exception; D7 inherits it
- **D10d** — `extensionState` is `proxyRefs`-wrapped and NOT in `WidgetHandle`; D7 is consistent
- **D12** — `extensionState` does not survive copy/paste; widget `value` and `widget_options` do
- **I-WS.1** — serialization surface audit (four surfaces → two in v2)
- **I-WS.2** — edge-case widgets (webcam/load3d/uploadAudio need memoized async getter)
- **I-WS.3** — lazy getter implementation (deferred; D7 sets the shape it targets)
- **ADR 0006** — PrimitiveNode copy/paste bug is resolved by `beforeSerialize` with `context='clone'`
- `research/architecture/widget-props-serialization-from-slack.md` — Primitive Int/Float Slack thread; D7 Part 3 implements the value-envelope recommendation
- `research/notion/widget-component-apis.md` — PrimeVue component prop API decisions (2026-05-08, WIP). The `Pick<ComponentProps, ...>` types are the concrete per-component typed options bags for D7's future pivot (`WidgetHandle<T, Opts>`). `disabled`/`readonly` on PrimeVue components map to D7 first-class fields. Re-fetch when complete.
- Touch-points S4.W3, S2.N6, S2.N15 (Part 4 v2 replacements), S6.A1 (graphToPrompt — still the #1 blast-radius surface; `beforeSerialize` is its v2 seam)
