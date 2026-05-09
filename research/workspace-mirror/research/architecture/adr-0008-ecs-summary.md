---
source_url: git://3e197b5c5:docs/adr/0008-entity-component-system.md
type: repo
date_accessed: 2026-04-14
relevance: 5
---

# ADR 0008 — Entity Component System: Summary

## Summary

ADR 0008 adopts an Entity Component System architecture for ComfyUI's graph domain model. Six entity kinds (Node, Link, Widget, Slot, Reroute, Group) are each assigned branded ID types. Components are plain data objects decomposed from current monolithic classes (~2000+ line `LGraphNode`). A central World registry maps entity IDs to component sets per workflow instance. Systems are pure functions that query/mutate the World. Migration is incremental via a bridge layer.

## Evidence Table

| # | Finding | Source | Confidence | Key Quote |
|---|---------|--------|------------|-----------|
| 1 | Six entity kinds: Node, Link, Widget, Slot, Reroute, Group — each with branded ID types | ADR 0008 Entity Taxonomy table | high | `type NodeEntityId = number & { readonly __brand: 'NodeEntityId' }` |
| 2 | Subgraphs are NOT a separate entity — they're nodes with `SubgraphStructure` component | ADR 0008 | high | "Subgraphs are not a separate entity kind. A subgraph is a node with a SubgraphStructure component." |
| 3 | World is instance-scoped: one World per workflow instance, single source of truth | ADR 0008 World section | high | "One World exists per workflow instance, containing all entities across all nesting levels." |
| 4 | Components are plain data objects — no methods, no back-references | ADR 0008 Component Decomposition | high | "Components are plain data objects — no methods, no back-references to parent entities." |
| 5 | Node decomposed into 7 components: Position, Dimensions, NodeVisual, NodeType, Connectivity, Execution, Properties, WidgetContainer | ADR 0008 Node table | high | inline |
| 6 | Widget decomposed into: WidgetIdentity, WidgetValue, WidgetLayout | ADR 0008 Widget table | high | inline |
| 7 | Migration strategy: Types → Bridge → New features → Incremental extraction → Deprecation | ADR 0008 Migration Strategy | high | "Define types, Bridge layer, New features first, Incremental extraction, Deprecate class properties" |
| 8 | Relationship to ADR 0003: Commands describe intent, Systems are handlers, World is the store (like Redux) | ADR 0008 Relationship section | high | "Commands describe mutation intent; Systems are command handlers; The World is the store." |
| 9 | Render-loop performance is a first-class risk; mitigations include frame-stable caches and archetype buckets | ADR 0008 Render-Loop section | high | "treats render-loop cost as a first-class risk rather than assuming it is free" |
| 10 | Widget/Slot entities need synthetic auto-incrementing IDs (they currently lack independent IDs) | ADR 0008 Branded ID Design | high | "Widgets and Slots currently lack independent IDs. The ECS will assign synthetic IDs." |

## Key Architecture Details

### Entity → Component Decomposition

- **LGraphNode** (~2000 lines) → 7 components totaling ~50 fields
- **BaseWidget** (25+ subclasses) → 3 components; widget-type behavior moves to systems
- **LLink** → 3 components (LinkEndpoints, LinkVisual, LinkState)
- **SlotBase** → 3 components (SlotIdentity, SlotConnection, SlotVisual)

### World API (Internal)

```ts
interface World {
  getComponent<C>(id: EntityId, key: ComponentKey<C>): C | undefined
  hasComponent(id: EntityId, key: ComponentKey<C>): boolean
  queryAll<C extends ComponentKey[]>(...keys: C): QueryResult<C>[]
  createEntity<K extends EntityKind>(kind: K): EntityIdFor<K>
  deleteEntity<K extends EntityKind>(kind: K, id: EntityIdFor<K>): void
  setComponent<C>(id: EntityId, key: ComponentKey<C>, data: C): void
  removeComponent(id: EntityId, key: ComponentKey<C>): void
  transaction<T>(label: string, fn: () => T): T
}
```

### Command Layer (ADR 0003 integration)

Commands are the public mutation API. Systems are command handlers. World mutations are internal.

```
Caller → Command → System (handler) → World (store) → Y.js (sync)
              ↓
         Command Log (undo, replay, sync)
```

## Applicability to Hook + Public API Design

1. **World read APIs** (`getComponent`, `queryAll`) are what extensions need exposed through the hook setup context
2. **World write APIs** (`setComponent`, `deleteEntity`) should NOT be directly exposed — extensions should submit commands
3. The **branded ID system** should be part of the public API — extensions work with `NodeEntityId`, `WidgetEntityId`, etc.
4. **Component keys** become the query language — extensions observe specific components on specific entities
5. The **bridge layer** is the migration path — existing hooks still pass `LGraphNode` instances, but new params add ECS query handles
6. **EffectScope per extension** maps naturally to component instance lifecycle — scope lives as long as the extension's registration for that entity
