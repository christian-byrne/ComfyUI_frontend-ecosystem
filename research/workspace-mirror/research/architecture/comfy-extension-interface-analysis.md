---
source_url: file://ComfyUI_frontend/src/types/comfy.ts
type: repo
date_accessed: 2026-04-14
relevance: 5
---

# ComfyExtension Interface Analysis

## Summary

The `ComfyExtension` interface defines ~18 lifecycle hooks and declarative registration arrays (commands, keybindings, settings, etc.). Most hooks receive `ComfyApp` (god object) and raw class instances (`LGraphNode`, `LGraphCanvas`). Extensions are expected to monkey-patch these instances to modify behavior. There is no formal query/mutation API — extensions directly manipulate the objects they receive.

## Evidence Table

| # | Finding | Source | Confidence | Key Quote |
|---|---------|--------|------------|-----------|
| 1 | 18 hooks/methods + 8 declarative arrays on ComfyExtension | comfy.ts:104-268 | high | inline |
| 2 | Most hooks pass `app: ComfyApp` — the god object with graph, canvas, API refs | comfy.ts:144-266 | high | `init?(app: ComfyApp)`, `setup?(app: ComfyApp)` |
| 3 | `nodeCreated` and `loadedGraphNode` pass raw `LGraphNode` instance | comfy.ts:219-225 | high | `nodeCreated?(node: LGraphNode, app: ComfyApp)` |
| 4 | `beforeRegisterNodeDef` passes the NODE CLASS (not instance) for prototype patching | comfy.ts:192-196 | high | `beforeRegisterNodeDef?(nodeType: typeof LGraphNode, nodeData: ComfyNodeDef, app: ComfyApp)` |
| 5 | Index signature `[key: string]: unknown` allows arbitrary properties | comfy.ts:268 | high | `[key: string]: unknown` |

## Hook Inventory

### Lifecycle Hooks (called with timing)

| Hook | Parameters | Purpose | Monkey-patch risk |
|------|-----------|---------|-------------------|
| `init(app)` | ComfyApp | Early init, before nodes added | Low — setup only |
| `setup(app)` | ComfyApp | After app fully set up | Low — setup only |
| `addCustomNodeDefs(defs, app)` | Record<string, ComfyNodeDef>, ComfyApp | Register/modify node definitions | Medium — mutates defs |
| `getCustomWidgets(app)` | ComfyApp | Return custom widget constructors | Low — factory |
| `beforeRegisterNodeDef(nodeType, nodeData, app)` | typeof LGraphNode, ComfyNodeDef, ComfyApp | Modify node CLASS before registration | **HIGH** — prototype patching |
| `beforeRegisterVueAppNodeDefs(defs, app)` | ComfyNodeDef[], ComfyApp | Modify defs for Vue app | Medium — in-place mutation |
| `registerCustomNodes(app)` | ComfyApp | Register custom LGraphNode subclasses | Medium |
| `loadedGraphNode(node, app)` | LGraphNode, ComfyApp | Patch loaded nodes (fix broken workflows) | **HIGH** — instance patching |
| `nodeCreated(node, app)` | LGraphNode, ComfyApp | Post-constructor modification | **HIGH** — instance patching |
| `beforeConfigureGraph(graphData, missing, app)` | ComfyWorkflowJSON, MissingNodeType[], ComfyApp | Modify graph before loading | Medium |
| `afterConfigureGraph(missing, app)` | MissingNodeType[], ComfyApp | Post-load cleanup | Low |
| `getSelectionToolboxCommands(item)` | Positionable | Add selection toolbox commands | Low — returns IDs |
| `getCanvasMenuItems(canvas)` | LGraphCanvas | Add canvas context menu items | Low — returns data |
| `getNodeMenuItems(node)` | LGraphNode | Add node context menu items | Low — returns data |
| `onAuthUserResolved(user, app)` | AuthUserInfo, ComfyApp | Auth callback | Low |
| `onAuthTokenRefreshed()` | — | Token refresh callback | Low |
| `onAuthUserLogout()` | — | Logout callback | Low |

### Declarative Registration Arrays

| Property | Type | Purpose |
|----------|------|---------|
| `commands` | ComfyCommand[] | Register commands |
| `keybindings` | Keybinding[] | Register keyboard shortcuts |
| `menuCommands` | MenuCommandGroup[] | Add menu items |
| `settings` | SettingParams[] | Add settings |
| `bottomPanelTabs` | BottomPanelExtension[] | Add bottom panel tabs |
| `aboutPageBadges` | AboutPageBadge[] | Add about page badges |
| `topbarBadges` | TopbarBadge[] | Add topbar badges |
| `actionBarButtons` | ActionBarButton[] | Add action bar buttons |

## Applicability

The three highest-risk hooks (`beforeRegisterNodeDef`, `nodeCreated`, `loadedGraphNode`) are where monkey-patching happens. These are the primary targets for the new ECS-based setup context:

- **`beforeRegisterNodeDef`**: Should receive ECS component schema APIs instead of raw class
- **`nodeCreated`**: Should receive an ECS entity handle with query/mutation APIs instead of `LGraphNode` instance
- **`loadedGraphNode`**: Should receive a migration/compat API for patching workflow data

The declarative arrays (commands, settings, keybindings, etc.) are already well-designed and don't need fundamental changes.
