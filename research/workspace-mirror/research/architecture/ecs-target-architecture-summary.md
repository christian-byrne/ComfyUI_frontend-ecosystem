---
source_url: git://3e197b5c5:docs/architecture/ecs-target-architecture.md
type: repo
date_accessed: 2026-04-14
relevance: 5
---

# ECS Target Architecture: Summary

## Summary

The target architecture defines a layered system: World (central registry) → Systems (behavior) → Components (data). It shows how each monolithic class decomposes into components, how the system pipeline flows (Input → Update → Render → Persist), and how the migration bridge keeps legacy and ECS code in sync during the transition. The unidirectional data flow eliminates circular dependencies and scattered store access.

## Key Findings

| # | Finding | Confidence | Key Detail |
|---|---------|------------|------------|
| 1 | System pipeline is ordered: Connectivity → Version → Layout → Render → Serialization | high | Input Phase → Update Phase (ordered) → Render Phase (read-only) → Persist Phase |
| 2 | RenderSystem is READ-ONLY — no state mutations during render | high | "Pure read of components. No state mutation." |
| 3 | LayoutSystem runs BEFORE render in update phase, not during draw | high | "Runs BEFORE render, not during." |
| 4 | Dependency flow is unidirectional: Input → Systems → World → Render (no back-edges) | high | Eliminates circular deps between LGraph ↔ Subgraph, Node ↔ Canvas |
| 5 | Migration bridge: Phase 1 (types), Phase 2 (bridge adapters), Phase 3 (extract), Phase 4 (clean) | high | Sequence diagram shows class↔World sync during transition |
| 6 | Each problem maps to a specific solution: God Objects → small components, Circular Deps → ID-based entities, Demeter Violations → System queries | high | Problem Resolution Map |

## Applicability

The target architecture's system pipeline and unidirectional flow directly inform the hook API design. Extensions' reactive queries should read from the World AFTER systems have run their update phase, ensuring consistent state. The read-only render phase means extension render callbacks should NOT mutate World state.
