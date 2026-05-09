---
source_url: file://ComfyUI_frontend/src/types/index.ts
type: repo
date_accessed: 2026-04-14
relevance: 4
---

# Public API Surface Analysis (src/types/index.ts)

## Summary

The barrel export file re-exports ~25 types organized into API types, extension types, shell UI types, node identification, and widget types. It also declares global `Window` augmentations for `app` and `graph`. The file serves as the single location defining what is and isn't public API — anything not exported here is considered internal.

## Exported Types by Category

### Extension System
- `ComfyExtension` — the main extension interface (from comfy.ts)

### App & API
- `ComfyApp` — the application god object
- `ComfyApi` — API client for backend communication

### Node Types
- `ComfyNodeDef` — node definition schema
- `InputSpec` — input specification for node parameters
- `NodeLocatorId`, `NodeExecutionId` — node identification types
- `isNodeLocatorId`, `isNodeExecutionId`, `parseNodeLocatorId`, `createNodeLocatorId`, `parseNodeExecutionId`, `createNodeExecutionId` — identification utilities

### Widget Types
- `DOMWidget` — DOM-based widget
- `DOMWidgetOptions` — widget creation options

### Shell UI Types
- `SidebarTabExtension` — sidebar tab registration
- `BottomPanelExtension` — bottom panel registration
- `ToastManager` — toast notification API
- `ExtensionManager` — extension registry
- `CommandManager` — command palette API
- `ToastMessageOptions` — toast configuration

### Backend Response Types
- `EmbeddingsResponse`, `ExtensionsResponse`, `PromptResponse`, `NodeError`, `Settings`, `DeviceStats`, `SystemStats`, `User`, `UserData`, `UserDataFullInfo`, `TerminalSize`, `LogEntry`, `LogsRawResponse`

## Applicability

This barrel export is where the new ECS public API types will be added. Future additions:
- Branded entity IDs (`NodeEntityId`, `WidgetEntityId`, etc.)
- Component key types
- `HookSetupContext` or similar for the new hook setup API
- `useComponent()`, `useQuery()` composable types
- Command types for extension mutations
