# <a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> — <a href="/glossary#widget" class="wiki-link">Widget</a> State Categories

**Status**: ACCEPTED — implemented in `src/extension-api/widget.ts` (<a href="/decisions/D7-widget-shape-and-persistence" class="wiki-link">D7</a> Parts 1 + 3 successor). Header format normalized 2026-05-20 (wave-12) per <a href="/decisions/D-api-surface-finalization" class="wiki-link">D-api-surface-finalization</a>.
> Created: 2026-05-12
> Context: Follow-up to <a href="/decisions/D13-ecs-alignment-audit" class="wiki-link">D13</a> §3.1 widget options investigation
> ADR: `docs/adr/0010-widget-state-categories.md`
> Code: `src/extension-api/widget.ts`, `src/services/extension-api-service.ts`

---

## Problem Statement

The current widget system is a pile of historical accidents:

- `options` is a constructor bag that gets reference-assigned
- Instance properties (`widget.hidden`) vs options bag (`widget.options.hidden`) used interchangeably
- No separation between: schema (type/name), runtime state (value/disabled), display hints (hidden), per-instance config (min/max), serialization config (serialize flag)
- `Object.assign(this, safeValues)` means anything can land on the instance

---

## Decision: <a href="/glossary#schema" class="wiki-link">Schema</a> + Props + Model <a href="/glossary#value" class="wiki-link">Value</a>

Two categories, with `value` as a special prop (like Vue's `modelValue`):

### Schema (Immutable)

- `type` — widget type string
- `name` — widget name
- Presence of constraints (the *fact* that min/max/step exist)
- Default values

Schema comes from node definition. Immutable after construction.

### Props (Mutable, Per-Instance)

Everything else:

- `value` — the modelValue, primary data binding
- `disabled`, `hidden`, `label`, `advanced`
- Actual values of `min`, `max`, `step` (presence is schema, values are props)
- `serialize` flag
- `callback`, `draw`, `mouse`, `computeSize` (functions are values in JS)

Props are set by systems, not directly mutated by views (like Vue's one-way data flow).

### Model Value Convention

`value` is special only by convention:
- It's what serializes to workflow
- It's what goes to backend
- Same as `modelValue` being special only because `v-model` binds to it

---

## API Surface

`WidgetHandle` enforces Schema + Props:

```ts
// Schema (readonly)
widget.name
widget.type

// Props — value gets ergonomic accessor like Vue's defineModel()
widget.value
widget.getValue() / setValue()

// Props — everything else through getProp/setProp
widget.getProp('disabled')
widget.setProp('min', 0)
widget.setProp('callback', fn)    // functions are values
```

---

## ECS Mapping

ECS internals use 5 components (component-per-concern):

- *WidgetComponentSchema* — type, options (maps to Schema)
- *WidgetComponentValue* — value (maps to Props.value)
- *WidgetComponentDisplay* — label, hidden, disabled (maps to Props)
- *WidgetComponentSerialize* — serialize flag (maps to Props)
- *WidgetComponentContainer* — on NodeEntityId, holds widget IDs

`widgetValueStore` already provides a unified facade. `WidgetHandle` is another facade on top, presenting Schema + Props to extensions.

API surface ≠ ECS internals. The facade pattern hides the component split.

---

## Key Insights from Discussion

1. *Primitives and right-side panel should be views of data, not new instances* — single source of truth

2. *Presence vs value*: The presence of min/max is schema (immutable). The actual values are props (mutable by systems).

3. *Views don't mutate props directly* — like Vue's one-way data flow. Systems mutate, views observe.

4. *"Changing <a href="/api-docs/graph" class="wiki-link">graph</a> topology mutates values" causes bugs* — props should be stable across topology changes where possible.

---

## Migration Path

For extensions that currently do `widget.options.hidden = true`:

1. Phase A: Shim translates to `setProp('hidden', true)` internally
2. Phase B: `setProp` dispatches ECS command, enables undo/redo
3. Deprecation warning guides to `widget.setProp('hidden', true)`

---

## Open Questions

1. How does this interact with Node Definition V3's `V3.CustomWidget`?
2. Schema merging for subgraph widgets with mixed constraints — "hard but computed from input schemas" (Austin)
3. Should connecting a second widget to a subgraph widget reset to default? (topology → value mutation concern)

---

## Slack Discussion Log (2026-05-12)

See `#frontend-eng` thread starting at 12:58 PM. Participants: Christian, Austin, Alex.

Key quotes:
- Austin: "Using min as an example. Under what circumstances would it change, or need to be externally observable?"
- Alex: "A lot of bugs come from 'changing the <a href="/api-docs/graph" class="wiki-link">graph</a> topology mutates values'"
- Christian: "The presence of Min and max are immutable in the schema. Along with defaults. Their values would be props, which are only set by the systems"
- Christian: "Views of the data shouldn't directly mutate the props just like with Vue"

