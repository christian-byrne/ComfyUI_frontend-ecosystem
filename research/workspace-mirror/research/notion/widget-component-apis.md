---
source_url: https://www.notion.so/comfy-org/Widget-Component-APIs-2126d73d365080b0bf30f241c09dd756
date_accessed: 2026-05-08
parent_task: https://www.notion.so/comfy-org/Define-component-widget-API-2116d73d365080d08c0fd890356187b0
notion_task_id: (see ancestor-path: Tasks DB → "Define component widget API")
author: Christian Byrne + Pablo (design exclusion criteria)
status: WIP — ToggleSwitch complete; 14 of 15 component type blocks empty
---

# Widget Component APIs — Notion Page Summary

## Purpose

Defines the public prop API surface exposed to custom node developers for each PrimeVue widget component. Determines which PrimeVue props are part of the v2 extension API and which are stripped (styling/escape-hatch props excluded by design).

## Mental Model

```
PrimeVue Component Library
  → Design (authority on widget components)
  → Frontend Implementation Adjust
  → UX/Product (choose public API)
  → Types (generate Python schema + TypeScript interface)
```

## Process

1. Use the [PrimeVue Component Playground](https://christian-byrne.github.io/primevue-component-props-visualize/) to browse props per component
2. Per prop: toggle "SDK API Decision" to include/exclude
3. Copy resulting TypeScript (`Pick<Props, ...>`) and Python (`Component.Input(...)`) types into the page

## Exclusion Rule (Pablo — design perspective)

**Exclude**: any prop allowing arbitrary styling, colors, or CSS injection.  
**Include**: everything else (functional props).

Always-excluded prop names across all components:
- `style` — direct CSS injection
- `class` — external CSS overrides
- `dt` — design token runtime modifications
- `pt` — PassThrough API (direct DOM access)
- `*Class` / `*Style` variants — component-scoped CSS escape hatches
- `iconClass`, `badgeClass`, `inputClass`, `inputStyle`, `panelClass`, `panelStyle`, `overlayClass`, `labelStyle`, `imageClass`, `imageStyle`, `containerStyle`, `containerClass`, `galleriaClass`, `maskClass`

## 15 Widget Components in Scope

| # | Component | Types Complete? |
|---|-----------|:--------------:|
| 1 | Button | ❌ |
| 2 | InputText | ❌ |
| 3 | Select | ❌ |
| 4 | ColorPicker | ❌ |
| 5 | MultiSelect | ❌ |
| 6 | SelectButton | ❌ |
| 7 | Slider | ❌ |
| 8 | Textarea | ❌ |
| 9 | ToggleSwitch | ✅ |
| 10 | Chart | ❌ |
| 11 | Image | ❌ |
| 12 | ImageCompare | ❌ |
| 13 | Galleria | ❌ |
| 14 | FileUpload | ❌ |
| 15 | TreeSelect | ❌ |

## Completed Type: ToggleSwitch

```ts
interface ToggleSwitchProps {
  modelValue: string | boolean
  defaultValue?: string | boolean
  name?: string
  trueValue?: any
  falseValue?: any
  invalid?: boolean
  disabled?: boolean
  readonly?: boolean
  tabindex?: number
  inputId?: string
  ariaLabelledby?: string
  ariaLabel?: string
}

// Public SDK subset:
Pick<ToggleSwitchProps,
  | 'modelValue'
  | 'defaultValue'
  | 'name'
  | 'trueValue'
  | 'falseValue'
  | 'invalid'
  | 'disabled'
  | 'readonly'
  | 'tabindex'
  | 'inputId'
  | 'ariaLabelledby'
  | 'ariaLabel'
>
```

```python
ToggleSwitch.Input(
    "toggleswitch_widget",
    model_value=None,       # string | boolean
    default_value=None,     # string | boolean
    name=None,              # string
    true_value=None,        # any
    false_value=None,       # any
    invalid=None,           # boolean
    disabled=None,          # boolean
    readonly=None,          # boolean
    tabindex=None,          # number
    input_id=None,          # string
    aria_labelledby=None,   # string
    aria_label=None,        # string
)
```

## Key Observations for Project Integration

### D7 / WidgetHandle.getOption
The set of non-excluded props for each component IS the options bag for that widget kind. For example:
- `ToggleSwitch` options: `trueValue`, `falseValue`, `invalid`, `tabindex`, `inputId`, `ariaLabelledby`, `ariaLabel`
- `disabled` / `readonly` appear here — note `disabled` is already a D7 first-class field on `WidgetHandle`; the ToggleSwitch `disabled` prop maps directly to `isDisabled()/setDisabled()`, not to `getOption('disabled')`

### Python Schema → backend INPUT_TYPES
The `Component.Input(...)` pattern is the Python-side public API for declaring widget schemas. This is the **backend consumer** of the widget type system — the other end of the D7/I-WS serialization story. The `widget_options` sidecar (D7 Part 3) will need to be schema-compatible with these typed Python inputs.

### Typed options bags (D7 Future Pivot)
This page is the authoritative source for the per-component typed option bag described in D7's "Future Pivots" section (`WidgetHandle<T, Opts extends WidgetOptions>` where `Opts` is e.g. `NumberWidgetOptions`). Once PKG2 ships, the completed `Pick<...>` types here become the generic parameter for each widget kind.

### Test framework (I-TF)
The 15 component types give the concrete enumeration of widget kinds needed for BC.33 (see behavior-categories.yaml). Test triples should cover: per-kind option validation, `disabled`/`readonly` prop mapping to first-class WidgetHandle methods, and `modelValue` ↔ `getValue()/setValue()` round-trip.

## Status / Action Items

- Page is WIP: 14/15 component type blocks are empty. Check back for completion.
- When complete, completed `Pick<...>` types should be cross-walked against `WidgetHandle.getOption` key set in PKG2.
- Python `Component.Input(...)` patterns should be reconciled with backend `INPUT_TYPES` schema in `ComfyUI/` Python source.
- `Galleria` exclusion of `thumbnailsPosition` / `indicatorsPosition` (layout layout options, not styling) is notable — Pablo excluded these even though they are not CSS props. Worth a design discussion: is layout control in-scope for extension authors?
