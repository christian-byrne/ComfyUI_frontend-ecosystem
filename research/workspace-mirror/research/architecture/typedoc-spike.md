# TypeDoc → Mintlify MDX Compatibility Spike

<!-- source: generated | task: PKG5.D5 | date: 2026-05-08 -->

**Task:** PKG5.D5  
**Date:** 2026-05-08  
**Versions tested:** typedoc@0.28.19, typedoc-plugin-markdown@4.11.0, typedoc-plugin-frontmatter@1.3.1

---

## Summary verdict

**Compatible with minor friction.** `typedoc-plugin-markdown` v4 produces `.mdx` files with Mintlify-valid frontmatter out of the box. Three issues require addressing before PKG5.D6 (implementation):

1. `@stability` is an unknown tag — must declare it in `customBlockTags`
2. `shell.ts` and `identifiers.ts` import internal `@/` aliases — the docgen entrypoint must be the package's own stub, not `src/extension-api/index.ts` directly
3. `typedoc-plugin-frontmatter` option `preserveFrontmatterCommentOrder` does not exist in v1.3.1 — remove it

All three are mechanical fixes, not blockers.

---

## Generated file tree (core types only)

```
docs-build/
├── README.mdx
├── interfaces/
│   ├── ExtensionOptions.mdx
│   ├── NodeBeforeSerializeEvent.mdx
│   ├── NodeConnectedEvent.mdx
│   ├── NodeDisconnectedEvent.mdx
│   ├── NodeExecutedEvent.mdx
│   ├── NodeExtensionOptions.mdx
│   ├── NodeHandle.mdx               ← sample below
│   ├── NodeModeChangedEvent.mdx
│   ├── NodePositionChangedEvent.mdx
│   ├── NodeSizeChangedEvent.mdx
│   ├── SlotInfo.mdx
│   ├── WidgetBeforeQueueEvent.mdx
│   ├── WidgetBeforeSerializeEvent.mdx
│   ├── WidgetExtensionOptions.mdx
│   ├── WidgetHandle.mdx
│   ├── WidgetOptions.mdx
│   └── WidgetValueChangeEvent.mdx
└── type-aliases/
    ├── AsyncHandler.mdx
    ├── Handler.mdx
    ├── NodeEntityId.mdx
    ├── NodeMode.mdx
    ├── Point.mdx
    ├── Size.mdx
    ├── SlotDirection.mdx
    ├── SlotEntityId.mdx
    ├── Unsubscribe.mdx
    ├── WidgetEntityId.mdx
    └── WidgetValue.mdx
```

**30 files** from 4 source files (events, node, widget, lifecycle). Shell and identifiers excluded due to `@/` alias friction (see Issues below).

---

## Sample MDX — `interfaces/NodeHandle.mdx`

```mdx
---
stability: stable
---

[**@comfyorg/extension-api**](../README.mdx)

***

# NodeHandle

Defined in: node.ts:243

Controlled surface for node access. Reads query the ECS World; writes
dispatch commands. Events are Vue-reactive watches on World components.

## Example

```ts
import { defineNodeExtension } from '@comfyorg/extension-api'

export default defineNodeExtension({
  name: 'my-size-enforcer',
  nodeTypes: ['MyCustomNode'],

  nodeCreated(node) {
    const [w, h] = node.getSize()
    node.setSize([Math.max(w, 300), Math.max(h, 200)])

    node.on('executed', (e) => {
      console.log('output:', e.output)
    })
  }
})
```

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| `comfyClass` | `readonly` | `string` | The ComfyUI backend class name. Read-only invariant. |
| `entityId` | `readonly` | `NodeEntityId` | Stable entity ID. Branded to prevent mixing with `WidgetEntityId`. |
| `type` | `readonly` | `string` | The LiteGraph node type string. Read-only invariant. |

## Methods

### widget()

> **widget**(`name`): `WidgetHandle` | `undefined`

Returns a `WidgetHandle` for the named widget.

#### Example

```ts
const steps = node.widget('steps')
if (steps) steps.setValue(20)
```

...
```

**Mintlify compatibility assessment:**
- Frontmatter (`stability: stable`) renders as a page badge in Mintlify ✅
- `@example` blocks become fenced ` ```ts ``` ` — Mintlify syntax-highlights these ✅
- Property tables render as Mintlify tables ✅
- Cross-references between types are relative `.mdx` links (e.g. `[WidgetHandle](WidgetHandle.mdx)`) — these work in Mintlify if placed under the correct nav prefix ✅
- `on()` overloads each produce a `#### Call Signature` section — readable, though verbose for 9 overloads

---

## Proposed Mintlify nav snippet

```json
{
  "group": "Extensions API",
  "pages": [
    "extensions/api/overview",
    {
      "group": "Core Concepts",
      "pages": [
        "extensions/api/interfaces/ExtensionOptions",
        "extensions/api/interfaces/NodeExtensionOptions",
        "extensions/api/interfaces/WidgetExtensionOptions"
      ]
    },
    {
      "group": "Handles",
      "pages": [
        "extensions/api/interfaces/NodeHandle",
        "extensions/api/interfaces/WidgetHandle",
        "extensions/api/interfaces/SlotInfo",
        "extensions/api/interfaces/WidgetOptions"
      ]
    },
    {
      "group": "Events",
      "pages": [
        "extensions/api/interfaces/NodeExecutedEvent",
        "extensions/api/interfaces/NodeConnectedEvent",
        "extensions/api/interfaces/NodeDisconnectedEvent",
        "extensions/api/interfaces/NodeBeforeSerializeEvent",
        "extensions/api/interfaces/NodePositionChangedEvent",
        "extensions/api/interfaces/NodeSizeChangedEvent",
        "extensions/api/interfaces/NodeModeChangedEvent",
        "extensions/api/interfaces/WidgetValueChangeEvent",
        "extensions/api/interfaces/WidgetBeforeSerializeEvent",
        "extensions/api/interfaces/WidgetBeforeQueueEvent"
      ]
    },
    {
      "group": "Primitives",
      "pages": [
        "extensions/api/type-aliases/NodeEntityId",
        "extensions/api/type-aliases/WidgetEntityId",
        "extensions/api/type-aliases/NodeMode",
        "extensions/api/type-aliases/WidgetValue",
        "extensions/api/type-aliases/Point",
        "extensions/api/type-aliases/Size",
        "extensions/api/type-aliases/Handler",
        "extensions/api/type-aliases/AsyncHandler",
        "extensions/api/type-aliases/Unsubscribe"
      ]
    },
    {
      "group": "Shell",
      "pages": [
        "extensions/api/interfaces/ExtensionManager",
        "extensions/api/interfaces/CommandManager",
        "extensions/api/interfaces/ToastManager",
        "extensions/api/interfaces/SidebarTabExtension",
        "extensions/api/interfaces/BottomPanelExtension"
      ]
    }
  ]
}
```

---

## Issues and fixes for PKG5.D6

### Issue 1 — `@stability` is unknown to TypeDoc (82 warnings)

**Symptom:** Every `@stability stable` / `@stability experimental` tag emits a warning. The tag value IS captured as frontmatter by `typedoc-plugin-frontmatter`, but TypeDoc logs a warning per occurrence.

**Fix:** Add to `typedoc.json`:
```json
{
  "customBlockTags": ["@stability"]
}
```
This registers the tag so warnings disappear. The frontmatter plugin still captures its value.

### Issue 2 — `shell.ts` and `identifiers.ts` import internal `@/` aliases

**Symptom:** Running typedoc against `src/extension-api/index.ts` directly fails because `shell.ts` imports `@/types/extensionTypes` (which in turn imports from `vue`, `@/services/dialogService`, `@/stores/commandStore`, etc.) and `identifiers.ts` imports `@/types/nodeIdentification`.

**Fix (two options):**

**(a) Path aliases in tsconfig** — add `paths: { "@/*": ["../../src/*"] }` to the docgen tsconfig and ensure the full `src/` tree is available. Simpler but means typedoc resolves the whole app.

**(b) Standalone docgen entrypoint (recommended)** — maintain `packages/extension-api/docgen-entry.ts` that re-exports only the types that are self-contained (no `@/` deps). `shell.ts` can be replaced with a hand-authored `shell-public.ts` that declares only the exported interface shapes (not the implementation imports). This keeps docgen hermetic and fast.

The spike used option (b) and excluded shell/identifiers entirely. For PKG5.D6, option (b) with a hand-authored shell stub is the right call — `shell.ts` imports `vue`, dialog services, and command stores that we never want leaking into the public type surface anyway.

### Issue 3 — `preserveFrontmatterCommentOrder` option does not exist

**Symptom:** `typedoc-plugin-frontmatter@1.3.1` errors on unknown option `preserveFrontmatterCommentOrder`.

**Fix:** Remove from `typedoc.json`. The option does not exist in v1.3.1; it may have been from a different plugin or a future version.

### Issue 4 — `on()` overload verbosity

`NodeHandle.on()` has 9 overloads (one per event type). TypeDoc renders each as a separate `#### Call Signature` subsection. The result is readable but long (~200 lines for `on()` alone).

**Options for PKG5.D6:**
- Accept as-is — documentation is complete even if long
- Add a hand-authored `overview.mdx` that summarizes the event table in one place and links to the generated page for full signatures
- Use `typedoc-plugin-markdown`'s `mergeModulesMemberGroups` option to collapse overloads (needs investigation)

### Issue 5 — `Defined in: node.ts:243` points to spike temp path

**Fix for PKG5.D6:** Set `sourceLinkTemplate` in `typedoc.json` to point to the GitHub URL:
```json
{
  "sourceLinkTemplate": "https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/extension-api/{path}#L{line}"
}
```

---

## Recommended `typedoc.json` for PKG5.D6

```json
{
  "entryPoints": ["./docgen-entry.ts"],
  "tsconfig": "./tsconfig.docgen.json",
  "out": "./docs-build",
  "plugin": ["typedoc-plugin-markdown", "typedoc-plugin-frontmatter"],
  "customBlockTags": ["@stability"],
  "excludeInternal": true,
  "excludePrivate": true,
  "readme": "none",
  "fileExtension": ".mdx",
  "flattenOutputFiles": false,
  "indexFormat": "table",
  "parametersFormat": "table",
  "propertiesFormat": "table",
  "typeDeclarationFormat": "table",
  "frontmatterCommentTags": ["stability"],
  "sourceLinkTemplate": "https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/extension-api/{path}#L{line}"
}
```

---

## Conclusion

The pipeline works. `typedoc-plugin-markdown@4` + `typedoc-plugin-frontmatter@1.3` produces clean, Mintlify-compatible MDX with correct frontmatter, syntax-highlighted `@example` blocks, typed property tables, and relative cross-links. The three fixes above (custom tag registration, hermetic entrypoint, remove bad option) are all mechanical. PKG5.D6 can proceed.
