# ADR-D8: ECS World ↔ Vue Reactive Adapter

**Status**: scoping / blocker
**Date**: 2026-05-08
**Related cluster**: Reviewer Feedback Cluster D (F1, F7)
**Blocks**: full implementation of every `node.on(...)` and `widget.on(...)`
**Original gap**: D4 BLOCKER G12

## Context

The v2 API exposes events (`node.on('configured', fn)`, `widget.on('valueChange', fn)`)
that fire when underlying ECS World state changes. But the World is a plain
TypeScript Map keyed by entity IDs; it has no reactive notification
mechanism. Vue's `watch()` works on Vue refs/reactive objects, not on
arbitrary mutations to a Map.

Without an adapter, every event registration in v2 either:

- silently never fires (broken)
- requires manual `world.notifyChange(entityId, ComponentType)` calls in
  every system that mutates the World (boilerplate, easy to forget,
  error-prone)
- requires polling (unacceptable)

CONTEXT.md flagged this as the biggest implementation gap before any
`.on(...)` will work end-to-end. Reviewer feedback in this session
re-surfaced it as F1 (eager vs lazy `useWorld()` resolution) and F7
(can `WidgetValue.value` be undefined?). Both depend on the adapter
contract being pinned down first.

## Questions this ADR must answer

1. **Where does reactivity live?** Three options:
   - **In the World**: every component slot is internally a `shallowRef`,
     and `getComponent` returns the unwrapped value. Mutations through the
     World API trigger Vue notifications automatically.
   - **In the handles**: handles wrap World access in `computed()` /
     `customRef()`, and observe the World via a tracked version counter.
   - **In an adapter layer**: a separate `WorldReactivityAdapter` mirrors
     the World into a `shallowReactive` map and emits Vue notifications.

2. **What is `shallow` vs `deep`?** Most ECS components are plain data
   objects (per ADR 0008). Per-component reactivity is almost always shallow
   — extensions care about "the WidgetValue component changed" not "a deep
   field inside it changed."

3. **What is `markRaw`'d?** LiteGraph `LGraphNode` instances (during the
   strangler-fig transition) and any large object that should not be made
   reactive. CONTEXT.md D1 review flagged this as undocumented.

4. **`flush: 'pre' | 'post' | 'sync'` strategy?** When a system batch-
   updates 50 components, do extension event handlers fire 50 times (sync)?
   Once at the end of the batch (post)? At microtask boundary (pre)?
   Probably `post`, batched by command-batch boundary, but needs
   confirmation against use cases.

5. **Workflow swap semantics.** ADR 0008 says World is instance-scoped per
   workflow. When the user opens a different workflow, the old World is
   discarded and a new one is created. What happens to:
   - Extension handles cached by extensions across the swap?
   - Event subscriptions registered against the old World?
   - The `useWorld()` reference inside handle constructors (F1)?

6. **Can a component slot be undefined?** F7's question. The adapter
   contract must specify: is `world.getComponent(id, C)` always defined,
   or can it return undefined for "this entity exists but doesn't have
   this component"?

## What we know already (anchors)

- Vue reactivity primer (D1) — the primitives we have to work with.
- ADR 0008 — World is per-workflow, components are plain data.
- ADR 0003 — every mutation is a command; the command dispatcher is the
  natural notification chokepoint.
- D3.5 — extension setup runs inside `pauseTracking()` + scope activation
  (Vue's `setupStatefulComponent` pattern).
- CONTEXT.md D1 review: "engine layer translating ECS World mutations →
  Vue notifications (so `watch(() => world.getComponent(...))` works) is
  undocumented. Likely the next biggest gap before implementation."

## Process

This is a real ADR with non-trivial implementation impact. Likely sequence:

1. Spike: prototype each of the three reactivity-location options against
   one event (`widget.on('valueChange', …)`) and measure boilerplate cost +
   correctness under batched commands.
2. Decide based on spike evidence.
3. Pin component-slot nullability (Q6) at the same time — they're coupled.
4. Write up answers to Q1–Q6 and circulate.

## Cross-References

- D1 (Vue reactivity primer)
- D3.5 (reactive dispatch and scope alignment)
- D4 BLOCKER G12 (this ADR resolves it)
- ADR 0003, ADR 0008
- F1, F7 from this session's reviewer feedback
- CONTEXT.md D1-review: "engine layer ... undocumented"
