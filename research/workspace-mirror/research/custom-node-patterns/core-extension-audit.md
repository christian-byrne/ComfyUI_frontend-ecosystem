---
source_url: file://ComfyUI_frontend/src/extensions/core/
type: repo
date_accessed: 2026-04-14
relevance: 5
---

# Core Extension Pattern Audit (R4)

## Summary

Every core extension follows one of 5 patterns, all of which are covered
by the v2 API (defineNodeExtension + NodeHandle + WidgetHandle). No
pattern requires raw ECS access, signals, or framework concepts beyond
events + getters/setters.

## Pattern Taxonomy

### Pattern 1: beforeRegisterNodeDef + prototype patch (6 files)

The most common pattern. Extension filters by `nodeData.name`, then
patches the prototype to modify behavior for all instances of that type.

| File | Node types | What it patches |
|------|-----------|-----------------|
| `widgetInputs.ts` | ALL | `convertWidgetToInput`, `onGraphConfigured` |
| `load3dLazy.ts` | Load3D, Load3DAnimation | `onNodeCreated` on prototype |
| `uploadAudio.ts` | LoadAudio, SaveAudio, PreviewAudio | `onNodeCreated` on prototype |
| `uploadImage.ts` | LoadImage, LoadImageMask | `onNodeCreated` on prototype |
| `slotDefaults.ts` | ALL | adds default slot labels |
| `saveMesh.ts` | SaveMesh, SaveTriMesh | `onNodeCreated` + `onExecuted` on prototype |

**v2 replacement**: `defineNodeExtension({ nodeTypes: [...], nodeCreated(node) { ... } })`

### Pattern 2: widget.callback assignment (widespread)

Extensions assign `widget.callback = (value) => { ... }` to react to
widget value changes. This is a single-slot pattern — only one callback
can be assigned (later assignments overwrite earlier ones).

| File | Purpose |
|------|---------|
| `uploadAudio.ts` | Refresh audio preview on file selection |
| `customWidgets.ts` | Color picker and combo updates |
| `imageCompare.ts` | Sync comparison images |
| `groupNode.ts` | Propagate value to inner widgets |

**v2 replacement**: `widget.on('change', (value, oldValue) => { ... })`
— supports multiple listeners, no overwrite risk.

### Pattern 3: node.onExecuted assignment (3 files)

Extensions assign `node.onExecuted = (message) => { ... }` to handle
execution results (preview images, output values).

| File | Purpose |
|------|---------|
| `uploadAudio.ts` | Show audio preview after execution |
| `imageCompare.ts` | Update comparison view with new images |
| `saveMesh.ts` | Download mesh file after execution |

**v2 replacement**: `node.on('executed', (output) => { ... })`

### Pattern 4: widget.serializeValue override (2 files)

Extensions override how a widget's value is serialized into the workflow
JSON. Used for dynamic prompts and group node value mapping.

| File | Purpose |
|------|---------|
| `dynamicPrompts.ts` | Process `{wildcards}` in prompt text |
| `groupNode.ts` | Map inner widget values for serialization |

**v2 replacement**: `widget.setSerializeValue((workflowNode, index) => { ... })`

### Pattern 5: useChainCallback for safe callback chaining (2 files)

When an extension needs to add behavior to an existing callback without
overwriting it, `useChainCallback` wraps the original.

| File | Purpose |
|------|---------|
| `widgetInputs.ts` | Chain onto existing `onGraphConfigured` |
| `customWidgets.ts` | Chain onto widget `callback` |

**v2 replacement**: `node.on(event, fn)` — multiple listeners are additive
by design. No chaining needed.

## Coverage Gap Analysis

### Fully covered by v2 API ✅
- Node creation hooks (Pattern 1)
- Widget value change reactions (Pattern 2)
- Execution result handling (Pattern 3)
- Serialization overrides (Pattern 4)
- Multi-listener events (Pattern 5)
- Widget visibility toggling
- Widget label/option changes
- Node position/size reads and writes

### Edge cases needing attention ⚠️

1. **`widgetInputs.ts` — converting widgets to/from inputs**: This is a
   structural mutation (removing a widget, adding an input slot). The v2
   API doesn't currently expose `convertWidgetToInput()`. This could be:
   - A NodeHandle method: `node.convertWidgetToInput(widgetName)`
   - A command: `dispatch({ type: 'ConvertWidgetToInput', ... })`
   
2. **`contextMenuFilter.ts` — patching LiteGraph.ContextMenu.prototype**:
   This patches a global UI class, not a node. It's outside the scope of
   per-node extension hooks. Would need a separate extension point
   (context menu provider API).

3. **`simpleTouchSupport.ts` — patching LGraphCanvas.prototype**:
   Canvas-level input handling. Also outside per-node scope. Needs canvas
   event API or stays as internal framework code.

4. **`groupNode.ts` — complex inner/outer widget mapping**: Group nodes
   (subgraphs) need to map outer widgets to inner node widgets. The v2
   API's `widget.on('change')` + `widget.setValue()` handles this, but
   the widget discovery (`node.widgets()`) needs to work across subgraph
   boundaries.

## Migration Complexity Assessment

| Extension | Lines (v1) | Est. lines (v2) | Complexity | Notes |
|-----------|-----------|-----------------|------------|-------|
| previewAny | 90 | 35 | Low | ✅ Already converted |
| dynamicPrompts | 25 | 20 | Low | ✅ Already converted |
| imageCrop | 13 | 12 | Low | ✅ Already converted |
| uploadImage | 40 | 30 | Low | Direct translation |
| uploadAudio | 140 | 80 | Medium | Multiple hooks + preview |
| saveMesh | 90 | 50 | Medium | Execution handler + download |
| imageCompare | 50 | 35 | Medium | Execution + sync |
| slotDefaults | 55 | 40 | Low | Iterate inputs/outputs |
| load3dLazy | 85 | 60 | Medium | Lazy loading + DOM widget |
| widgetInputs | 600+ | 300+ | High | Core infrastructure |
| customWidgets | 120 | 80 | Medium | Widget factory |
| groupNode | 800+ | 500+ | High | Subgraph widget mapping |
| contextMenuFilter | 180 | N/A | N/A | Not per-node, separate API |
| simpleTouchSupport | 190 | N/A | N/A | Not per-node, canvas API |
