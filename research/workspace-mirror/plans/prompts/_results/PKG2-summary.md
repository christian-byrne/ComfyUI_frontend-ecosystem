# PKG2 Result Summary — Author Public Extension API Declaration File

## Files created

| File | Lines | Notes |
|------|-------|-------|
| `src/extension-api/events.ts` | 42 | `Handler<E>`, `AsyncHandler<E>`, `Unsubscribe` |
| `src/extension-api/widget.ts` | 391 | `WidgetHandle<T>`, `WidgetValueChangeEvent`, `WidgetBeforeSerializeEvent`, `WidgetOptions`, `WidgetEntityId`, `WidgetValue` |
| `src/extension-api/node.ts` | 524 | `NodeHandle`, `NodeEntityId`, `SlotEntityId`, `SlotInfo`, `Point`, `Size`, `NodeMode`, `SlotDirection`, all event payloads |
| `src/extension-api/lifecycle.ts` | 306 | `NodeExtensionOptions`, `WidgetExtensionOptions`, `ExtensionOptions`; `declare function` stubs for all registration fns + lifecycle hooks |
| `src/extension-api/shell.ts` | 21 | Re-exports shell UI types from `@/types/extensionTypes` |
| `src/extension-api/identifiers.ts` | 25 | Re-exports `NodeLocatorId`, `NodeExecutionId` and helpers from `@/types/nodeIdentification` |
| `src/extension-api/index.ts` | 111 | Barrel: published package entry point; type exports from sub-files, runtime exports from service |

## Files modified

| File | Change |
|------|--------|
| `src/services/extensionV2Service.ts` | **Renamed** → `src/services/extension-api-service.ts`; updated imports to use granular `@/extension-api/node`, `@/extension-api/widget`, `@/extension-api/lifecycle` (avoids barrel circular dep); added `defineExtension` / `ExtensionOptions` registry; rewrote `createWidgetHandle` to match new `WidgetHandle` interface (`getOption` replacing `getOptions`, `isDisabled`/`setDisabled`, `isSerializeEnabled`/`setSerializeEnabled`, `on('valueChange')` replacing `on('change')`, `on('beforeSerialize')` replacing `setSerializeValue`) |
| `src/types/extensionV2.ts` | Converted to `@deprecated` re-export stub pointing to `@/extension-api` |
| `src/extensions/core/imageCrop.v2.ts` | Import: `@/services/extensionV2Service` → `@/extension-api` |
| `src/extensions/core/previewAny.v2.ts` | Import updated; `on('change')` → `on('valueChange', (e) => ...)` with `e.newValue`; `setLabel()` calls replaced with `label:` in `addWidget` options; `output.text` → `e.output['text']` |
| `src/extensions/core/dynamicPrompts.v2.ts` | Import updated; `getOptions().dynamicPrompts` → `getOption('dynamicPrompts')`; `setSerializeValue(fn)` → `on('beforeSerialize', (e) => { if (e.context === 'prompt') e.setSerializedValue(...) })` |
| `ComfyUI_frontend/AGENTS.md` | Rule #19 updated with exception for `src/extension-api/index.ts` as published package entry point |

## Typecheck output

Run via borrowed `vue-tsc` from `ComfyUI_frontend-fix-usePainter/node_modules/.bin/vue-tsc` (no local `node_modules`):

```
vue-tsc --noEmit: 3 errors total
  — all 3 are pre-existing: missing @testing-library/jest-dom/vitest,
    @webgpu/types, vitest/globals type definitions (node_modules not installed)
  — 0 errors in src/extension-api/*.ts
  — 0 errors in src/extensions/core/*.v2.ts
  — 0 errors in src/services/extension-api-service.ts
```

Manual review also confirms:
- No `any`, no `@ts-expect-error`, no `as any` in `src/extension-api/`
- Circular dependency avoided: service imports from sub-files, not the barrel
- `on()` overloads in `WidgetHandle` and `NodeHandle` are typed against event payload interfaces

## D5/D6/D7 questions surfaced

### D6 Part 3 — `label` invariant
`setLabel()` was on the service's `createWidgetHandle`. Per D6 Part 3 hybrid rule, `label` is a read-only invariant (set at construction). Removed `setLabel()` from `WidgetHandle`; `label: string` is now `readonly`. Construction-time label is passed via `addWidget(type, name, defaultValue, { label: '...' })`.

### D7 — `disabled` first-class field
Added `isDisabled()` / `setDisabled()` as first-class fields on `WidgetHandle`. The v1 touch-point database shows `widget.options.disabled` appears in several extensions. Promoted to first-class per D7 "every-widget" rule.

### Service `on()` implementation uses `Function` type
The service (`extension-api-service.ts`) implementation of `on()` uses `fn: Function` internally. This is an implementation detail — the interface contract in `WidgetHandle` and `NodeHandle` uses fully typed overloads. When the ECS modules exist and typecheck runs, the service implementation will need typed overload implementations. Not blocking PKG2 (types-only).
