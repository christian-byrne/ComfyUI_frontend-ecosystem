# PKG5 — TypeDoc → Mintlify MDX Docgen Pipeline — Summary

**Completed**: 2026-05-08  
**Status**: ✅ Working — pipeline runs, 51 MDX pages generated

---

## What was built

### Files created

```
packages/extension-api/
├── package.json              — docs:build + docs:watch scripts; typedoc + typedoc-plugin-markdown devDeps
├── typedoc.json              — TypeDoc config (plugin-markdown, skipErrorChecking, @stability block tag, docs tsconfig)
├── tsconfig.docs.json        — isolated tsconfig covering only src/extension-api/**; avoids .vue transitive errors
├── .gitignore                — ignores docs-build/, build/, node_modules/
└── scripts/
    └── build-docs.ts         — full pipeline: TypeDoc → post-process → Mintlify MDX + nav-snippet.json
```

### Build output (51 pages + nav)

```
docs-build/mintlify/
├── index.mdx
├── nav-snippet.json
│
├── Registration (functions / options / hooks)
│   defineextension.mdx, definenodeextension.mdx, definewidgetextension.mdx
│   extensionoptions.mdx, nodeextensionoptions.mdx, widgetextensionoptions.mdx
│   onnodemounted.mdx, onnoderemoved.mdx, startextensionsystem.mdx
│   createnodeexecutionid.mdx, createnodelocatorid.mdx, isnodeexecutionid.mdx
│   isnodelocatorid.mdx, parsenodeexecutionid.mdx, parsenodelocatorid.mdx
│   asynchandler.mdx, handler.mdx, unsubscribe.mdx
│   customextension.mdx, vueextension.mdx, widgetoptions.mdx, toastmessageoptions.mdx
│   nodeentityid.mdx, widgetentityid.mdx, slotentityid.mdx
│   nodemode.mdx, point.mdx, size.mdx, slotdirection.mdx, widgetvalue.mdx
│
├── Handles
│   nodehandle.mdx, widgethandle.mdx, slotinfo.mdx
│
├── Events
│   nodeexecutedevent.mdx, nodeconnectedevent.mdx, nodedisconnectedevent.mdx
│   nodepositionchangedevent.mdx, nodesizechangedevent.mdx, nodemodechangedevent.mdx
│   nodebeforeserializeevent.mdx, widgetvaluechangeevent.mdx
│   widgetbeforeserializeevent.mdx, widgetbeforequeueevent.mdx
│
├── Shell UI
│   sidebartabextension.mdx, bottompanelextension.mdx, toastmanager.mdx
│   commandmanager.mdx, extensionmanager.mdx
│
└── Identity
    nodelocatorid.mdx, nodeexecutionid.mdx
```

---

## Sample MDX — `definenodeextension.mdx`

```mdx
---
title: "defineNodeExtension"
description: "Register a node-scoped extension reacting to node lifecycle events."
icon: "code"
---

```ts
function defineNodeExtension(options): void;
```

Defined in: src/services/extension-api-service.ts:350

## Parameters

| Parameter | Type |
| ------ | ------ |
| `options` | [`NodeExtensionOptions`](./nodeextensionoptions) |

## Returns

`void`
```

---

## Sample MDX — `widgetbeforeserializeevent.mdx` (representative rich page)

```mdx
---
title: "WidgetBeforeSerializeEvent"
description: "Pre-serialization hook payload — override or skip widget value."
---

Payload for `widget.on('beforeSerialize', handler)`. The **only async-allowed event** in v1 (per D10c / D5 Part 3).

## Stability
stable

```ts
widget.on('beforeSerialize', (e) => {
  if (e.context === 'prompt') e.setSerializedValue(processDynamicPrompt(...))
})
```

## Type Parameters
| T | WidgetValue | The widget's value type |
```

---

## Generated nav snippet (merge into `docs.json` navigation)

```json
{
  "group": "Extensions API",
  "pages": [
    "extensions/api/index",
    { "group": "Registration", "pages": ["extensions/api/defineextension", "extensions/api/definenodeextension", ...] },
    { "group": "Handles",      "pages": ["extensions/api/nodehandle", "extensions/api/widgethandle", "extensions/api/slotinfo"] },
    { "group": "Events",       "pages": ["extensions/api/nodeexecutedevent", ..., "extensions/api/widgetbeforequeueevent"] },
    { "group": "Shell UI",     "pages": ["extensions/api/sidebartabextension", ..., "extensions/api/extensionmanager"] },
    { "group": "Identity",     "pages": ["extensions/api/nodelocatorid", "extensions/api/nodeexecutionid"] }
  ]
}
```

Full snippet: `packages/extension-api/docs-build/mintlify/nav-snippet.json`

---

## Verification commands

```bash
cd ComfyUI_frontend/packages/extension-api
pnpm docs:build
ls docs-build/mintlify/
# → 52 files (51 .mdx + nav-snippet.json)
```

---

## TypeDoc → Mintlify friction encountered

| Issue | Resolution |
|-------|-----------|
| `tsconfig.json` at root drags in `.vue` files → thousands of TS errors | Added `tsconfig.docs.json` scoped to `src/extension-api/**` only; set `skipErrorChecking: true` for import-chain errors from un-built ECS modules |
| `@stability` is an unknown block tag → TypeDoc warns | Added to `blockTags` array in `typedoc.json`; `@param`, `@defaultValue` from other source files still warn (benign — they're not part of the extension-api source) |
| Closing ` ``` ` fences were getting `ts` appended (same regex as openers) | Replaced single-pass regex with stateful line-by-line scan that tracks `inBlock` state |
| TypeDoc emits breadcrumb header lines (`[@comfyorg/...](../index.md)`) before every page | Stripped with regex in post-processor |
| `typedoc-plugin-markdown@4.11` requires `typedoc@0.28.x` but `0.27.9` was installed | Pinned to `0.28.19` in `package.json` |
| `outputFileStrategy: 'members'` scatters tiny type-alias pages (e.g. `Point`, `Size`) | Acceptable — Mintlify nav groups them under Registration; no user-visible issue |

---

## What PKG6 receives

- 51 clean MDX files at `packages/extension-api/docs-build/mintlify/`
- `nav-snippet.json` — valid JSON, merge into `docs.json` navigation under the Custom Nodes tab
- `pnpm --filter @comfyorg/extension-api docs:build` is the one-shot rebuild command
