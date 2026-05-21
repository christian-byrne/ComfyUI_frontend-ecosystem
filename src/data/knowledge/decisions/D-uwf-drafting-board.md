# UWF Decisions — Drafting Board (CLOSED 2026-05-20 — wave-13)

> **STATUS: CLOSED 2026-05-20 (wave-13).** User direction firm on
> all three open questions. Final ADRs landed:
>
> - **N11** → REJECTED. See `decisions/D-no-app-beforeprompt.md`
>   ("we need to identify why people needed that and solve it per-need
>   as the issues arrive by adding dedicated features. i am firm on
>   this").
> - **N12** → REJECTED. See `decisions/D-no-virtual-nodes-in-api.md`
>   ("virtual nodes should not be allowed at all. exception being our
>   reroute and primitive nodes internally but we want to migrate that
>   eventually anyway. we shouldnt supporting or encouraging that in
>   the API").
> - **N13** → ACCEPTED — store-mediated observation. See
>   `decisions/D-cross-node-observation.md`. The pattern works today
>   for node-level events and for custom widget types the extension
>   owns; the gap for built-in-widget cross-node sync is
>   `defineWidgetAugmenter` (wave-8 follow-up, separate work).
>
> Sections below are kept as a paper trail of the options that were
> considered. The decisions are in the linked ADRs above.

This board collects three open UWF-adjacent questions whose answers shape the
v2 extension API surface but don't have ADRs yet. Each section follows the same
shape: **the question → why it matters → options → prior art → open questions
→ tentative recommendation**. The recommendations are starting points for
discussion, not commitments.

The three questions interlock:
- **N11** decides *where extensions hook into the workflow → API conversion*.
- **N12** decides *how virtual nodes declare their wiring*.
- **N13** decides *how nodes share/observe each other's widget values*.

UWF Phase 3 (save-time materialization) resolves a lot of pressure on N11 and
N12 by moving virtual-node resolution and metadata injection into the workflow
serializer itself, but leaves authors needing replacements for the legitimate
"observe / mutate the prompt before it ships" use cases. N13 is largely
independent.

---

## N11 — App-level `beforePrompt` event

### The question

Patches to `app.graphToPrompt` are the #1 source of monkey-patching across
custom nodes (S6.<a href="/axioms#a1-refs" class="wiki-link">A1</a>, blast-radius 6.67 — top of the touch-point database).
ComfyUI-Manager (our own extension, most-installed in the ecosystem),
KJNodes/setgetnodes, cg-use-everywhere, easyuse, and dozens of others wrap
`graphToPrompt` to (a) resolve virtual node connections, (b) inject metadata
into `extra.*`, (c) read the about-to-be-queued payload for telemetry, or
(d) mutate widget values one last time before queueing.

UWF Phase 3 absorbs (a) by materializing virtual-node connections at save time
inside the serializer. But (b) (c) (d) still need a public surface. We need to
decide: **is there an app-level `beforePrompt` event** that fires after
serialization but before HTTP submit, with a payload extensions can read and
mutate? If yes, what's its shape? If no, what's the alternative?

### Why it matters

- Blocks PR #12144 (ext): no v2 conversion path for ComfyUI-Manager or KJNodes
  graphToPrompt patches without a target API.
- Blocks I-PG.B2 / N9 classification: 5 patterns are tagged
  `strangler-bridge` and 2 are `uwf-resolved` partially because we haven't
  decided what `beforePrompt` looks like.
- Blocks <a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> ADR.

### Options

#### Option A — `app.on('beforePrompt', payload => mutate(payload))`

Single event on the `app` handle, async-aware. Payload exposes the assembled
API JSON (output <a href="/api-docs/graph" class="wiki-link">graph</a>, workflow, extra, client_id) and a `cancel()` method.

```ts
app.on('beforePrompt', async (payload) => {
  payload.workflow.extra.componentMap = collectComponents()
  if (notReady()) payload.cancel('still loading')
})
```

- **Pros**: 1:1 replacement for `graphToPrompt` patches; async; cancel
  semantics; trivial to author against; we own the call site so we control
  fan-out order
- **Cons**: payload mutation is footgun-prone; ordering across multiple
  subscribers is undefined unless we spec it (see D10b lex tie-break);
  encourages "any extension can change anything" instead of structured
  contributions
- **Complexity**: LOW (single event, single emit site)
- **Cost-bearer**: extension author writes one handler; runtime fans out

#### Option B — `graph.on('beforeSerialize', mut)` + `app.on('beforePrompt', read)`

Split read vs mutate by phase. Mutation happens before serialization (when the
<a href="/api-docs/graph" class="wiki-link">graph</a> is still authoritative); reading happens after serialization (when the
API JSON is final and ready to ship). Two events, two contracts.

- **Pros**: structurally cleaner; mutating the <a href="/api-docs/graph" class="wiki-link">graph</a> (not the API JSON) is
  more idiomatic; serialization stays a pure function; observers can never
  corrupt the wire format
- **Cons**: extensions that need to mutate `extra.*` (most graphToPrompt
  patches) must do it pre-serialization, which is awkward when the data they
  want to inject only exists after the graph is materialized; two events to
  document and teach
- **Complexity**: MEDIUM (two events, two emit sites, ordering across both)
- **Cost-bearer**: more complexity for authors; runtime simpler

#### Option C — Typed contribution slots ("registerPromptContributor")

Authors don't mutate the payload; they register typed contributions that the
runtime merges into known buckets.

```ts
app.registerPromptContributor({
  name: 'comfyui-manager.components',
  contribute: () => ({ extra: { componentMap: collectComponents() } })
})
```

- **Pros**: structured; merge order is defined; no mutation footguns;
  contributions are discoverable for debugging
- **Cons**: doesn't cover the "read the assembled payload for telemetry" case;
  doesn't cover cancel/veto; new concept to teach; can't do
  "look-then-decide" patterns without breaking the model
- **Complexity**: HIGH (new contribution registry, merge semantics, conflict
  resolution)
- **Cost-bearer**: heavy authoring constraint; runtime moderately complex

### Prior art

- **Vue**: `beforeMount` / `beforeUpdate` are read-only-ish hooks; mutation is
  done through reactive sources, not by mutating event payloads. Vue's model
  argues for Option C, but Vue components don't have a "ship to backend" step.
- **React Server Components**: action handlers can rewrite the payload before
  it reaches the <a href="/api-docs/server" class="wiki-link">server</a>, but only via well-defined input shapes (not free
  mutation).
- **Express/Koa middleware**: chained mutation of `req`/`res` — closest analog
  to Option A. The pattern works because middleware ordering is explicit.
- **Existing ComfyUI extensions**: 100% use the mutation pattern (Option A
  shape). Switching to Option B or C is a bigger migration ask.

### Open questions

- Does `beforePrompt` need to be cancellable (`payload.cancel(reason)`) or
  just observable? (<a href="/decisions/D5-events-and-payload-typing" class="wiki-link">D5</a>/<a href="/decisions/D10-lifecycle-context-and-ordering" class="wiki-link">D10</a> events have `Unsubscribe` but no `cancel`.)
- Does it need to be async? (Most current patches are sync; some — like
  cg-use-everywhere's link expansion — could become async in v2.)
- How does it interact with **Universal Workflow Format Phase 3**'s save-time
  materialization? If UWF runs first and produces a canonical workflow, does
  `beforePrompt` see the canonical or pre-canonical form?
- Should the event surface the full `LiteGraph` graph or just the API payload?
  (Two-graph-form ambiguity is a real footgun.)
- Strangler-bridge implementation in Phase B: where does the v1
  `app.graphToPrompt = async function() { ... }` patch get translated to a
  v2 subscription internally?

### Recommendation (DRAFT)

**Option A** with a typed payload, async, cancellable. Pragmatic 1:1 port for
the existing patches; lowest migration friction. Pair it with a lint rule
warning "graphToPrompt patches are deprecated — use `app.on('beforePrompt')`"
once the strangler bridge is in place.

Long-term refactor toward Option C is possible after the migration completes
and we have data on which contributions are pure-additive vs. genuinely
read-then-mutate.

---

## N12 — Virtual wiring declaration API

### The question

Virtual nodes (KJNodes set/get, easyuse setNode/getNode, cg-use-everywhere
broadcast nodes) sit in the graph but don't generate API output themselves —
they redirect connections. They declare themselves via
`this.isVirtualNode = true` and override `getInputLink()` to redirect to a
"real" upstream node.

UWF Phase 3 materializes these at save time, which means **the workflow
serializer must know which nodes are virtual and how to follow the redirect
chain**. Today this knowledge lives in extension code (each pack defines its
own `isVirtualNode` + `getInputLink()` pair). UWF needs a declarative API so
the serializer can resolve virtual wiring without invoking extension code.

We need to decide: **what is the v2 API for declaring "this node type is a
layout-only redirector with these wiring rules"?**

### Why it matters

- Blocks UWF Phase 3 (workflow serializer needs the declaration).
- Blocks v2 migration of KJNodes-class extensions (large blast radius).
- Affects API surface in PKG2 (`@comfyorg/extension-api` needs the
  registration shape).

### Options

#### Option A — Declarative `virtualWiring` in node-type registration

```ts
defineNodeExtension({
  nodeTypes: ['easy getNode'],
  virtualWiring: {
    kind: 'redirect-to-named-source',
    sourceProperty: 'name',
    sourceNodeType: 'easy setNode',
    sourceMatchProperty: 'name'
  }
})
```

- **Pros**: pure data; serializer can resolve without running JS; static
  analysis possible; supports common patterns out of the box
- **Cons**: only covers patterns we predict; bespoke virtual nodes
  (cg-use-everywhere's broadcast-by-pattern) need an escape hatch; new schema
  to design and validate
- **Complexity**: HIGH (schema design + serializer implementation)

#### Option B — Synchronous resolver function

```ts
defineNodeExtension({
  nodeTypes: ['easy getNode'],
  virtualWiring: {
    kind: 'function',
    resolveInput(node, slotIndex, graph) {
      const source = graph.findByPredicate(n =>
        n.type === 'easy setNode' && n.properties.name === node.properties.name
      )
      return source ? { nodeId: source.id, slotIndex } : null
    }
  }
})
```

- **Pros**: covers all known virtual-node patterns; familiar shape; matches
  current `getInputLink` mental model
- **Cons**: serializer must execute extension code at save time (loses the
  "pure data" benefit of UWF); harder to cache; can throw / loop
- **Complexity**: MEDIUM

#### Option C — Hybrid (declarative with function fallback)

Provide built-in declarative kinds (`redirect-to-named-source`,
`broadcast-to-pattern`, `passthrough`) AND allow `kind: 'function'` for
bespoke cases. UWF serializer resolves declarative cases without JS; falls
back to function for the rest.

- **Pros**: best of both; common case stays pure; escape hatch exists
- **Cons**: two code paths to maintain in serializer; authors may default to
  `kind: 'function'` and never adopt the declarative kinds
- **Complexity**: HIGH

### Prior art

- **GraphQL fragments**: declarative redirection of fields to a parent type;
  pure data. Argues for Option A.
- **Apollo `@client` directives**: similar declarative redirection.
- **WebFlow / Figma component instances**: declarative override patterns.
- **Existing virtual-node implementations** in custom nodes: 100% function-
  based today, all sync.
- **LiteGraph itself**: `getInputLink` is the function-based contract.

### Open questions

- Does the UWF serializer need to support **dynamic** virtual wiring (resolved
  at queue time) or only **static** (resolved at save time)? cg-use-everywhere
  is dynamic (broadcast-by-name); KJNodes set/get is static.
- Do virtual nodes need to participate in the type system? (Currently they
  don't — the redirect is pure structural.)
- How does this interact with subgraphs and the entity-promotion lifecycle?
- Migration path for the ~40 extensions that already define
  `isVirtualNode = true` via prototype patching?

### Recommendation (DRAFT)

**Option C (hybrid)**, but ship Option B (function-only) first as a
strangler-bridge. Add declarative kinds opportunistically based on usage
patterns we observe in the wild. UWF Phase 3 ships with function-based
resolution; declarative kinds get added in Phase 4.

This avoids designing the declarative schema in a vacuum and lets us
prioritize the kinds that actually matter (likely just `redirect-to-named-source`
covers KJNodes + easyuse, which together are >80% of the install base for
virtual nodes).

---

## N13 — Cross-node value sync (global seed)

### The question

Some extensions broadcast a value change from one node to many other nodes.
Canonical example: easyuse's "global seed" node listens for a custom event
and overwrites every other node's `seed_num` widget when fired:

```js
ge.addEventListener("easyuse-global-seed", (e) => {
  for (const node of Object.values(app.graph._nodes_by_id)) {
    if (node.type === "easy globalSeed") { ... }
    else {
      const seedW = node.widgets?.find(w =>
        ['seed_num', 'seed', 'noise_seed'].includes(w.name)
      )
      if (seedW && e.detail.seed_map[node.id] != null) {
        seedW.value = e.detail.seed_map[node.id]
      }
    }
  }
})
```

This is a **cross-node mutation** pattern: one entity changes, many entities
update. Today it goes through `app.graph._nodes_by_id` direct access + custom
DOM events on `api`/`ge`. We need to decide: **what is the v2 API for "I
want to observe widget changes anywhere in the graph and respond by mutating
other widgets"?**

### Why it matters

- Common pattern beyond seed sync: theme-aware widgets, shared LoRA picker,
  preset libraries, "lock all to this value" tools.
- Blocks v2 conversion of any pack with cross-node sync (easyuse, anything
  built on the global-seed pattern).
- Affects <a href="/decisions/D8-world-vue-reactive-adapter" class="wiki-link">D8</a> (world ↔ Vue reactive adapter): cross-entity observation needs
  reactive primitives that scale beyond per-node scopes.

### Options

#### Option A — `app.on('widgetChanged', ev => ...)` global event

Single firehose event scoped to the entire graph. Subscribers filter by
predicate.

```ts
app.on('widgetChanged', (ev) => {
  if (ev.widget.name === 'global_seed') {
    for (const node of app.nodes) {
      const seedW = node.findWidget(['seed_num', 'seed', 'noise_seed'])
      seedW?.setValue(ev.value)
    }
  }
})
```

- **Pros**: trivial port from custom event listeners; familiar shape; one API
  to learn
- **Cons**: O(N) subscribers × O(M) widget changes = perf risk at scale;
  encourages global mutation; no structured way to express "I depend on widget
  X" → can't optimize
- **Complexity**: LOW

#### Option B — Reactive subscriptions via `app.observe(predicate, handler)`

```ts
app.observe(
  { widgetName: 'global_seed' },
  (sourceNode, value) => {
    for (const node of app.nodes) {
      node.findWidget(['seed_num', 'seed'])?.setValue(value)
    }
  }
)
```

- **Pros**: predicate is data, runtime can index; better perf at scale; better
  DX for the common case
- **Cons**: predicate language to design; harder to express complex matches;
  still allows global mutation in handler
- **Complexity**: MEDIUM

#### Option C — Reactive shared state via `app.shared(key)`

Declarative shared state: extensions read/write a named slot, the runtime
syncs subscribers automatically.

```ts
const seed = app.shared('comfyui.global-seed', { default: 42 })
// In global-seed node:
node.on('widgetChanged', (w) => { if (w.name === 'value') seed.set(w.value) })
// In any consumer:
defineNodeExtension({
  nodeTypes: ['KSampler', ...],
  nodeCreated(node) {
    const seedW = node.findWidget('seed')
    watch(seed, v => seedW.setValue(v))
  }
})
```

- **Pros**: structured; cacheable; decoupled (consumer doesn't know about
  global-seed node); maps cleanly onto Vue reactivity (<a href="/decisions/D8-world-vue-reactive-adapter" class="wiki-link">D8</a>); enables tooling
- **Cons**: new concept; doesn't cover read-then-decide patterns; namespace
  collisions; extensions disagree on the canonical key
- **Complexity**: HIGH (new shared-state registry, persistence story,
  conflict resolution)

### Prior art

- **Pinia**: global stores with reactive subscriptions — direct model for
  Option C.
- **Redux**: same shape; selectors as predicates (Option B variant).
- **Vue provide/inject**: Option C for component trees; doesn't scale to
  cross-tree communication, which is exactly our case.
- **CRDTs / Yjs**: shared state with merge semantics — way over-engineered
  for our needs but informs Option C's API.
- **easyuse global-seed** (existing): Option A pattern via custom DOM events.

### Open questions

- How many extensions actually need cross-node sync? (We have evidence for
  easyuse and a handful of theme-aware widget packs. Is this a top-10 pattern
  or a top-100 one?)
- Should shared state persist with the workflow? (Global seed yes; theme
  preference probably no.)
- How does this interact with subgraphs (<a href="/decisions/D12-scope-clone-on-copy" class="wiki-link">D12</a>)? Does shared state cross
  subgraph boundaries by default?
- Per Pinia/<a href="/decisions/D8-world-vue-reactive-adapter" class="wiki-link">D8</a>: should shared state be a Pinia store under the hood?

### Recommendation (DRAFT)

**Option B** as the v2 API + a **strangler-bridge for the existing custom
event pattern**. Defer Option C until we have evidence of demand beyond the
single global-seed use case. Option A is a footgun and should not be the
public API even if it's the easiest port.

If we decide we want Option C eventually, Option B is the right stepping
stone — `app.observe()` subscribers are the primitive that a future
`app.shared()` would build on.

---

## Cross-cutting concerns

### Strangler-bridge ordering

All three decisions interact with the strangler-bridge phase (<a href="/decisions/D9-strangler-fig-phases" class="wiki-link">D9</a> Phase B/C):

- N11 strangler: translate `app.graphToPrompt` patches → `app.on('beforePrompt')`
  subscriptions. Tricky because the patch wraps the original; the subscription
  is read-only or mutate-payload.
- N12 strangler: translate `LGraphNode.prototype.isVirtualNode = true` +
  `getInputLink` overrides → registered `virtualWiring` declarations.
- N13 strangler: translate `api.addEventListener('custom-event', fn)` →
  `app.observe(predicate, handler)`. Likely the trickiest because the v1
  pattern uses ad-hoc event names.

### Decision fan-out

| Decision | Blocks | Unblocks |
|---|---|---|
| N11 | <a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> ADR, PR #12144 graphToPrompt conversions, I-PG.B2 final classification | UWF Phase 3 finalization, ~12 extensions in touch-point DB |
| N12 | <a href="/decisions/D15-ban-node-on-beforeSerialize" class="wiki-link">D15</a> ADR, UWF Phase 3 serializer | KJNodes-class virtual node packs, S9.SG1 final classification |
| N13 | D16 ADR | easyuse-class shared-state packs (smaller blast radius than N11/N12) |

### Recommended sequencing

1. **N12 first** — UWF Phase 3 is on the critical path and needs the virtual
   wiring declaration to ship.
2. **N11 second** — needed for ~12 extensions in `strangler-bridge`
   classification, blocks PR #12144 finalization.
3. **N13 last** — smaller blast radius, can defer to a later wave.

---

## Next steps

- [ ] Review this drafting board with @christian-byrne; resolve recommendations
- [ ] Schedule N12 discussion with Alex (UWF Phase 3 owner)
- [ ] Schedule N11 discussion (likely needs Comfy team input on cancel/async)
- [ ] Promote each resolved question to its own ADR (<a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a>/<a href="/decisions/D15-ban-node-on-beforeSerialize" class="wiki-link">D15</a>/D16)
- [ ] Update `decisions/D9-strangler-fig-phases.md` Phase B section once
      N11/N12/N13 land
- [ ] Update `research/architecture/n9-blast-radius-classification.md`
      classifications once recommendations are confirmed

---

## References

- `research/meta/sourcegraph-mcp-coverage-investigation.md` §Re-audit results
  (2026-05-13) — W2F-1 listener-variant re-audit. **Consumer counts updated.**
  S6.<a href="/axioms#a1-refs" class="wiki-link">A1</a> cited above as `blast-radius 6.67 — top of the touch-point database`
  is reinforced (9→15 consumers); new high-traffic users include
  `ltdrdata/ComfyUI-Manager`, `viswamohankomati/ComfyUI-Copilot`,
  `BennyKok/comfyui-deploy`, `crystian/ComfyUI-Crystools`,
  `mcmonkeyprojects/SwarmUI`. The "~12 extensions in touch-point DB" figure
  for N11 is a lower bound — the true consumer pool of `graphToPrompt`
  patchers is larger and the v2 `beforeSerialize`/`beforePrompt` hook is
  even more clearly a release-blocker. N11/N12/N13 sequencing recommendation
  unchanged; magnitude under-counted.
- `CONTEXT.md` §Latest research (2026-05-13)
- `research/meta/back-propagation-matrix.yaml` — canonical reference for which artifacts must update when any finding (consumer count, severity, verdict, methodology) changes. Used by `scripts/check-back-propagation.sh` to verify drift = 0 across UWF re-audit propagation targets.
