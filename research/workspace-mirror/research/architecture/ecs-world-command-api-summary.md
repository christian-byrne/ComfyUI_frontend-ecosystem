---
source_url: git://3e197b5c5:docs/architecture/ecs-world-command-api.md
type: repo
date_accessed: 2026-04-14
relevance: 5
---

# World API and Command Layer: Summary

## Summary

The World's imperative API (`setComponent`, `deleteEntity`) is internal — external callers submit serializable, idempotent Commands. Systems are command handlers. The CommandExecutor wraps each command in a World transaction for atomicity and undo. This mirrors Redux: the store's dispatch is imperative, but the public API is action-based. The command layer is introduced in Phase 4 of migration, not initially.

## Key Findings

| # | Finding | Confidence | Key Detail |
|---|---------|------------|------------|
| 1 | Command interface: `{ type: string, execute(world: World): T }` | high | Plain objects with type discriminator |
| 2 | CommandExecutor wraps each command in `world.transaction()` for atomicity | high | "Every command execution opens a World transaction" |
| 3 | Concrete command examples: ConnectSlots, MoveNode, RemoveNode, SetWidgetValue, Paste (batch) | high | Each shows system call inside execute() |
| 4 | Idempotency is a command property, not a store property — via content-addressed IDs or command deduplication | high | "Idempotency is a property of the command, not the store" |
| 5 | Command layer is Phase 4 of migration — not built initially | high | "Position write commands replace direct `node.pos =` in Phase 4a" |
| 6 | CommandResult type: `applied | rejected | no-op` | high | Rejection via RejectionError inside system, transaction rolls back |

## Applicability to Public API

The Command interface is the **right abstraction for extension mutations**. Instead of exposing `world.setComponent()` to extensions, the hook context should expose a `dispatch(command)` function. This enables:
- Undo/redo for extension mutations
- Validation/rejection at the system level
- Serializable extension actions for CRDT sync
- Security sandboxing in the future (commands can be audited)
