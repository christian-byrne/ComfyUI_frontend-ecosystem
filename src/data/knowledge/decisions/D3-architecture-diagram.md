# D3 — Architecture Diagram: ECS World + Hook System + Public API Layer

> **Purpose**: Show how the three layers connect — from ECS World internals through the hook system to the extension-facing public API

## Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PUBLIC API LAYER                          │
│  src/types/index.ts — barrel export                         │
│                                                             │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ ComfyExt-   │ │ Branded IDs  │ │ HookSetupContext     │ │
│  │ ension      │ │ NodeEntityId │ │ { world, query,      │ │
│  │ (existing)  │ │ WidgetEntity │ │   mutate, watch,     │ │
│  │             │ │ SlotEntityId │ │   provide, expose }  │ │
│  └──────┬──────┘ └──────────────┘ └──────────┬───────────┘ │
│         │                                     │             │
│         │  backward compat: same hooks,       │  NEW:       │
│         │  same params + additive new params  │  ECS APIs   │
└─────────┼─────────────────────────────────────┼─────────────┘
          │                                     │
┌─────────┼─────────────────────────────────────┼─────────────┐
│         ▼           HOOK SYSTEM               ▼             │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │               Extension Manager                      │   │
│  │  Registers extensions, dispatches lifecycle hooks     │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                       │
│  For each hook invocation:                                  │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  1. Create/reuse EffectScope for this extension+entity│   │
│  │  2. Set currentExtension = this scope                 │   │
│  │  3. Build HookSetupContext with entity-bound APIs     │   │
│  │  4. Call extension.hook(legacyParams, ctx)            │   │
│  │  5. Restore previous currentExtension                 │   │
│  │  6. Capture returned state in scope                   │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                       │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │               Scope Registry                          │   │
│  │  Map<ExtensionName+EntityId, EffectScope>             │   │
│  │  Scope lifetime = entity lifetime                     │   │
│  │  Entity removed → scope.stop() → auto cleanup        │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                       │
└─────────────────────┼───────────────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────────────┐
│                     ▼        REACTIVE ADAPTER               │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  useComponent(entityId, ComponentKey) → Ref<C>        │   │
│  │  Creates a Vue ref bound to a World component         │   │
│  │  Reads → dep.track() (auto-subscribe)                 │   │
│  │  World mutation → dep.trigger() (auto-notify)         │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                       │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  useQuery(...ComponentKeys) → ComputedRef<Result[]>   │   │
│  │  Computed ref that re-evaluates when World changes    │   │
│  │  Lazy + cached via Vue's dirty flag system            │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                       │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  dispatch(command: Command) → CommandResult           │   │
│  │  Submits mutations as serializable commands           │   │
│  │  World.transaction() for atomicity                    │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                       │
└─────────────────────┼───────────────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────────────┐
│                     ▼           ECS WORLD                   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  World (per workflow instance)                        │   │
│  │                                                       │   │
│  │  Nodes:    Map<NodeEntityId, NodeComponents>          │   │
│  │  Links:    Map<LinkEntityId, LinkComponents>          │   │
│  │  Widgets:  Map<WidgetEntityId, WidgetComponents>      │   │
│  │  Slots:    Map<SlotEntityId, SlotComponents>          │   │
│  │  Reroutes: Map<RerouteEntityId, RerouteComponents>    │   │
│  │  Groups:   Map<GroupEntityId, GroupComponents>         │   │
│  │  Scopes:   Map<GraphId, ParentGraphId | null>         │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                       │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  Systems (pure functions)                             │   │
│  │  ConnectivitySystem, LayoutSystem, RenderSystem,      │   │
│  │  ExecutionSystem, SerializationSystem, VersionSystem   │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                       │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  Command Executor                                     │   │
│  │  run(command) → transaction → system → World mutation │   │
│  │  Undo log, replay, CRDT sync (future)                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow for an Extension Reading Node Position

```
Extension setup()
  │
  ├── const pos = ctx.useComponent(Position)
  │     │
  │     ├── Creates RefImpl with Dep
  │     ├── Reads world.getComponent(entityId, Position)
  │     └── Binds to World's change notification for this entity+component
  │
  ├── watch(pos, (newPos) => { ... })
  │     │
  │     ├── Creates ReactiveEffect
  │     ├── Effect registered in extension's EffectScope
  │     └── Effect's getter reads pos.value → auto-tracks pos's Dep
  │
  └── return { pos }

Later: User drags node
  │
  ├── LayoutSystem.moveNode(world, nodeId, [100, 200])
  │     └── world.setComponent(nodeId, Position, { pos: [100, 200] })
  │           └── triggers Dep for this entity+component
  │                 └── notifies all subscribers
  │                       └── extension's watch callback fires
  │                             └── (newPos) => { pos: [100, 200] }
```

## Data Flow for an Extension Mutating Widget Value

```
Extension setup()
  │
  ├── ctx.dispatch({
  │     type: 'SetWidgetValue',
  │     widgetId,
  │     value: 42
  │   })
  │     │
  │     ├── CommandExecutor.run(command)
  │     │     ├── world.transaction('SetWidgetValue', () => {
  │     │     │     command.execute(world)
  │     │     │       └── world.setComponent(widgetId, WidgetValue, { value: 42 })
  │     │     │             └── triggers Dep → notifies subscribers
  │     │     └── })
  │     └── returns CommandResult { status: 'applied' }
```

## Lifecycle: Extension Scope Creation and Teardown

```
Extension registers with name "my-ext"
  │
  ├── nodeCreated fires for Node #42
  │     ├── scopeKey = "my-ext:Node:42"
  │     ├── scope = new EffectScope()
  │     ├── scopeRegistry.set(scopeKey, scope)
  │     ├── scope.run(() => {
  │     │     setCurrentExtension(scope)
  │     │     extension.nodeCreated(legacyNode, hookContext)
  │     │     restoreCurrentExtension()
  │     │   })
  │     └── scope now contains all watchers/effects from setup
  │
  ├── ... node lives, watchers fire on World changes ...
  │
  └── Node #42 removed from World
        ├── scope = scopeRegistry.get("my-ext:Node:42")
        ├── scope.stop()
        │     ├── all watchers stopped
        │     ├── all computed refs invalidated
        │     └── all onScopeDispose callbacks invoked
        └── scopeRegistry.delete("my-ext:Node:42")
```

## Migration: Backward Compatible Hook Signatures

```ts
// BEFORE (current)
interface ComfyExtension {
  nodeCreated?(node: LGraphNode, app: ComfyApp): void
}

// AFTER (additive, non-breaking)
interface ComfyExtension {
  nodeCreated?(
    node: LGraphNode,          // Still passed (deprecated)
    app: ComfyApp,             // Still passed (deprecated)
    ctx?: NodeHookContext       // NEW: opt-in ECS APIs
  ): void
}

// Extensions that use ctx get:
interface NodeHookContext {
  entityId: NodeEntityId
  useComponent<C>(key: ComponentKey<C>): Readonly<Ref<C>>
  useQuery<K extends ComponentKey[]>(...keys: K): ComputedRef<QueryResult<K>[]>
  dispatch(command: Command): CommandResult
  watch: typeof watch
  provide: typeof provide
  onRemoved(fn: () => void): void
  expose(exposed: Record<string, any>): void
}
```
