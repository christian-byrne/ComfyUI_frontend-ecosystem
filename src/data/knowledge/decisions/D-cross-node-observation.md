# <a href="/decisions/D-cross-node-observation" class="wiki-link">D-cross-node-observation</a> — N13 closure: store-mediated observation, with `defineWidgetAugmenter` gap

**Status**: ACCEPTED — 2026-05-20 (wave-13, user direction with gap callout)
**Closes**: `D-uwf-drafting-board.md` §N13
**Depends on**: `defineWidgetAugmenter` (wave-8 follow-up, tracked separately)

## Context

`D-uwf-drafting-board.md` §N13 asked how one node should observe or
react to another node's widget values — the classic example being
the "global seed" pattern (one button updates the `seed` widget on
every applicable node). Three options were sketched:

- **Option A** — `app.on('widgetChanged', ev => ...)` global event
- **Option B** — Reactive subscriptions via `app.observe(predicate, handler)`
- **Option C** — Reactive shared state via `app.shared(key)`

## Decision

**ACCEPTED — Store-mediated observation. Extensions use their own
state container (Pinia store, Vue `ref`, plain JS singleton — author's
choice) to share state across nodes. The v2 API surface provides the
*subscription primitives* (`widget.on('valueChange')`,
`node.on(...)`); the v2 API surface does NOT provide a global state
container, a global event bus for widget changes, or a built-in
"shared key" mechanism.**

User direction 2026-05-20 (verbatim):

> "observing is an unanswered question but the idea would, currently,
> be to just defineNodeExtension (or <a href="/api-docs/definenode" class="wiki-link">defineNode</a>) -> add the listner
> there -> write to some store (that the author defines and maintains
> themselvs however they want) -> <a href="/api-docs/definenode" class="wiki-link">defineNode</a> or <a href="/api-docs/definewidget" class="wiki-link">defineWidget</a> for the
> listener and then read from the store. would this work?"

**Answer: yes, with one identified gap.** The store-mediated pattern
works for any case where the producer extension can attach a listener
to the source of change. It works today for **node-level events**.
For **widget-value-change cross-node sync** (the "global seed"
classic case), it requires `defineWidgetAugmenter` to land — already
tracked as a wave-8 follow-up.

## Patterns enabled today (Phase A, post wave-12)

### Pattern 1 — Producer reacts to node-level events; consumer reads from store

Works today end-to-end. Author owns the store.

```ts
// Extension author defines their own store (any shape — pinia, ref, plain object)
import { ref } from 'vue'
const lastExecutedNodeId = ref<string | null>(null)

// Producer side
defineNode({
  nodeTypes: ['KSampler'],
  nodeCreated(node) {
    node.on('executed', () => {
      lastExecutedNodeId.value = node.id  // write to author's store
    })
  }
})

// Consumer side (different file, same import target)
defineNode({
  nodeTypes: ['SaveImage'],
  nodeCreated(node) {
    // read from store; react however the author wants
    watch(lastExecutedNodeId, (id) => {
      if (id) node.on('configured', () => console.log('previous KSampler was', id))
    })
  }
})
```

Works because the source-of-change is a node-level event
(`node.on('executed', ...)`), which is reachable inside
`defineNode({ nodeCreated })`.

### Pattern 2 — Producer registers a custom widget type; consumer reads from store

Works today end-to-end if the producer **owns the widget type**.

```ts
// Producer registers a custom widget type AND writes its values to a shared store
const sharedSeed = ref<number>(0)

defineWidget({
  type: 'GLOBAL_SEED_SYNC',  // custom widget type the extension defines
  mount(_host, { widget }) {
    widget.on('valueChange', (e) => { sharedSeed.value = e.newValue as number })
    return () => {}
  }
})

// Consumer (different defineWidget for a different custom type) reads from sharedSeed
```

Works because the producer extension owns the widget registration —
it can subscribe to value changes inside its own `mount()` body.

## Pattern that does NOT work today (gap)

### Pattern 3 — Subscribe to value changes of an EXISTING (built-in) widget type across nodes

The "global seed" canonical case:

> "When the user changes the seed widget on any KSampler node,
> propagate the new value to every other seed widget."

This requires the extension to subscribe to the built-in `INT`
widget named `'seed'` on every node that has one — without
violating <a href="/axioms#a1-refs" class="wiki-link">A1</a> (nodes cannot enumerate widgets) and without owning
the widget type itself.

**This pattern does not work in the v2 surface as of wave-12.** The
missing primitive is **`defineWidgetAugmenter`** — a per-instance
hook that fires once per matching widget across all nodes:

```ts
// HYPOTHETICAL — not yet shipped, tracked as wave-8 follow-up
defineWidgetAugmenter({
  match: { type: 'INT', name: 'seed' },
  setup({ widget }) {
    widget.on('valueChange', (e) => {
      sharedSeed.value = e.newValue as number
    })
  }
})
```

`defineWidgetAugmenter` was identified as a gap during wave-8
when `dynamicPrompts.v2.ts` was stubbed (`bbb3c6ce02`) — the same
primitive that solves the "augment existing widgets" need solves
the "cross-node value sync" need.

## Decision: scope of N13

**N13 is closed.** The v2 API surface does NOT add a global event
bus, a global state container, or an `app.on('widgetChanged')` /
`app.observe()` / `app.shared()` surface. Extension authors share
state through their own modules.

The `defineWidgetAugmenter` gap is **acknowledged and tracked
separately** — it is not blocked by this ADR, it is enabled by
this ADR. When that primitive lands, the "global seed" pattern
becomes:

1. Author registers a `defineWidgetAugmenter` matching
   `{ type: 'INT', name: 'seed' }`.
2. Author's `setup({widget})` subscribes to `widget.on('valueChange')`
   and writes to an author-owned `Ref<number>`.
3. A second `defineWidgetAugmenter` (or the same one) reads from
   the same `Ref<number>` and calls `widget.setValue(...)` when
   it changes.

No new framework primitive is needed past `defineWidgetAugmenter`.

## Rationale for store-mediated (over the three Options on the board)

### Why not Option A (`app.on('widgetChanged')` global event)
- Inverts <a href="/axioms#a1-refs" class="wiki-link">A1</a> (nodes look down) at the framework layer: the global
  event is essentially the runtime saying "here's every widget
  change, anywhere", which encourages extensions to filter
  imperatively across nodes — exactly the pattern <a href="/axioms#a1-refs" class="wiki-link">A1</a> was added
  to prevent.
- High-frequency event (every keystroke in every text widget on
  every node) with most subscribers caring about one widget.
  Wasteful broadcast.
- Inverts the direction of knowledge — extensions have to know
  about EVERY node type to filter usefully, even if they only
  care about one.

### Why not Option B (`app.observe(predicate, handler)`)
- Predicates are stringly typed / impossible to type at API
  boundary; debugging is worse than a typed subscription.
- Lifecycle / cleanup story is unclear (when does an observation
  unsubscribe? Tied to what scope?).
- Same broadcast-then-filter waste as Option A.

### Why not Option C (`app.shared(key)`)
- Adds a new framework-owned global store. Most extensions
  already have their own state container (Pinia, Vue refs) and
  the v2 API should not duplicate.
- "What's the lifecycle of a `shared(key)` value? Per-workflow?
  Per-session? Across saves?" — every answer is wrong for some
  use case.
- Reinvents what the JS module system already provides via
  module-level `let` / `ref`.

### Why store-mediated wins
- Zero new framework surface. Authors use the state container
  they already use.
- Per-subscription instead of per-broadcast — only the producer
  pays the cost of value reads.
- Standard JS / Vue idiom; works with existing tooling.
- Lifecycle is the *author's choice* (module-level singleton
  lives until page reload; Pinia store lives per-app instance;
  per-extension `ref` cleans up with the extension).
- Composes with `defineWidgetAugmenter` (when it lands) for the
  built-in-widget cross-node case.

## Consequences

### Phase A
- Zero new public-API surface from this ADR (the surface that
  enables Patterns 1 + 2 already exists).
- `defineWidgetAugmenter` gap acknowledged in this ADR; the
  gap is filled by separate work (not wave-13 scope).
- Migration guide gets a §Cross-node observation section
  documenting Patterns 1 + 2 with the gap callout for Pattern 3.

### v1 consumers
- v1 monkey-patching of widget callbacks (e.g.
  `widget.callback = (v) => sharedSeed.value = v`) remains
  functional through <a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a> parallel-paths.

### Future (`defineWidgetAugmenter` landing)
- When that primitive lands, this ADR's Pattern 3 becomes
  workable. The migration-guide gap callout flips to a
  concrete example.

### CI
- No new axiom checks. No surface to enforce.

## Validation

- No `app.on(...)` / `app.observe(...)` / `app.shared(...)`
  exports in `src/extension-api/index.ts`.
- No `widgetChanged` key in any `EventNamespacePayloads`
  declaration in `src/extension-api/events.ts`.
- Migration guide §Cross-node observation exists with the
  three-pattern breakdown above.

## References

- AXIOMS.md §A1 (widget-centric, no node-enumerates-widget) —
  this ADR honors it bilaterally (per `D-no-node-widget-access`).
- AXIOMS.md §<a href="/axioms#a10-refs" class="wiki-link">A10</a> (Vue reactivity idioms) — the store-mediated
  pattern is a direct application.
- `D-bootstrap-hooks` — extension setup() bodies are where
  authors hook the producer side; namespace event facades
  (`graph` / `execution` / `server` / `workbench`) are NOT
  extended to carry widget-change events per this ADR.
- Wave-8 stub: `src/extensions/core/dynamicPrompts.v2.ts` —
  same `defineWidgetAugmenter` gap blocks both.
