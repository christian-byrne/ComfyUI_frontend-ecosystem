# ADR-D10: Lifecycle Context, Hook Ordering, Async Setup, and `setupState` Wrap

**Status**: proposed
**Date**: 2026-05-08
**Related**: D2 (Vue setup primer), D3.5 (reactive dispatch & scope alignment), D5 (events), D6 (parallel paths), D7 (widget shape), D8 (world-Vue adapter)
**Resolves**: I-SR.4 (lifecycle context choice), I-SR.5 (hook ordering across extensions); todo I-NEW.3
**Blocks**: PKG2 (`@comfyorg/extension-api` package author work — `defineExtension` / `defineNodeExtension` cannot be implemented until these four contracts are pinned)

## Context

I-SR.4 and I-SR.5 were both marked done in `todo.md`, but the implementing
ADR (D10) was never written. D2 explicitly leaves four lifecycle-shape
questions open in its §8 ("Open Questions / Follow-Ups"):

1. **Lifecycle context mechanism** — how do hooks like `onNodeMounted(fn)`
   know which extension/entity they belong to? D2 §6.2 says "`currentExtension`
   global (deferred — see D3.5)" but never lands the decision.
2. **Hook ordering across multiple extensions** on the same entity. D2 §8
   says "likely: registration order, with a tie-breaker on extension name
   for determinism" — preference, not decision. D5 Part 4's "Resolutions"
   block confirms: *"Q3 OPEN — Hook ordering across extensions still
   unspecified; tracked in D10b (lifecycle/ordering ADR, see todo I-NEW.3)."*
3. **Async setup** — D2 §8: "We almost certainly want sync-only for v1 to
   avoid a whole class of 'extension half-mounted' bugs." Preference,
   not decision. D5 Part 3 separately ships *one* async-aware event
   (`beforeSerialize`) but explicitly does not extend that to `setup`.
4. **`setupState` `proxyRefs` wrap** — D2 §1.2 shows Vue does
   `proxyRefs(setupResult)`; D2 §6.2 table says
   `entity.extensionState[ext.name]` is "Returned object, ref-unwrapped".
   That's a *description of Vue*, not a normative API decision for our
   public surface. D7 Context anchor explicitly flags this as unresolved:
   *"D2 review open question: should extension `setupState` be `proxyRefs`-wrapped
   (Vue analog) so `entity.extensionState['foo'].count` works without `.value`?"*

This ADR lands the four sub-decisions as **D10a / D10b / D10c / D10d**.

User's stated defaults if no other constraint applies:
**(i) for all four — mirror Vue, smallest possible deviation.**

## D10 sub-decisions already resolved in D5–D8

After re-reading D5–D8 in full, **none of D10a–d is fully resolved
elsewhere**. There are three partial touches that this ADR honors:

- **D10c (partial, narrow scope only)** — D5 Part 3 ships exactly one
  async-aware event (`beforeSerialize`) and explicitly says: *"D5 is
  otherwise sync-only … This matches Vue's `<Suspense>` boundary model —
  async happens at well-defined boundaries, not anywhere."* This pre-commits
  D10c to **option (i) sync-only `setup`** with a documented narrow
  exception per D5 (the exception is on the *event* contract, not on
  `setup`). D10c below confirms and consolidates.
- **D10d (hint only, not decision)** — D2 describes that Vue does
  `proxyRefs(setupResult)`; D7 Context lists it as still-open. D10d
  below decides.
- **D10a (hint only, not decision)** — D2 §6.2 table maps Vue's
  `currentInstance` to "`currentExtension` global (deferred — see D3.5)".
  D3.5 then defers it again (*"the other being a `currentExtension` global,
  which we defer until implicit hooks are introduced"*). The moment we
  ship `onNodeMounted` / `onNodeRemoved` in the public API surface (which
  D6 Part 1's `defineExtension({ setup(ctx) { ... } })` example does
  literally call out: `ctx.onNodeMounted((node) => { ... })`), the
  decision can no longer be deferred. D10a below decides.

D10b is fully open across D5–D8.

## Decision

### D10a — Lifecycle context mechanism: (i) `currentExtension` global, Vue-style

The host runtime maintains a module-private `currentExtension` global
(actually a stack-aware slot, exactly like Vue's `currentInstance`). It is
**set immediately before** invoking `setup(ctx)` and **restored immediately
after** — same pattern as `setupStatefulComponent()` in
`core/packages/runtime-core/src/component.ts:829` (cited in D2 §1.1).

Hook factories (`onNodeMounted`, `onNodeRemoved`, `onBeforeUnmount`,
`onWidgetMount`, …) read `currentExtension` to know which registration to
attach to. They are imported from the package, not from `ctx`:

```ts
import {
  defineNodeExtension,
  onNodeMounted,
  onNodeRemoved,
  ref, computed, watch
} from '@comfyorg/extension-api'

export default defineNodeExtension({
  name: 'counter-node',
  setup(ctx) {
    const count = ref(0)
    onNodeMounted(() => console.log('mounted'))     // ← reads currentExtension
    onNodeRemoved(() => console.log('removed'))     // ← reads currentExtension
    return { count }
  }
})
```

`ctx` retains the **explicit** parameters that don't have a clean global
form: the `NodeHandle` itself, `ctx.emit`, `ctx.expose`, `ctx.world` (per
D8). Lifecycle hooks are the *only* surface that uses the implicit global.

The wrapper (`__weh` in Vue's `injectHook`, see D2 §3) re-establishes
`currentExtension` *at hook invocation time* so that hooks-calling-hooks
work — e.g. an `onNodeMounted` callback that calls `provide(...)` or
registers another nested extension scope.

**Rationale.**

- D2 §6.2 explicitly maps this as the Vue analog and the user's default
  ("i — mirror Vue") picks it directly.
- D6 Part 1 already shows `ctx.onNodeMounted(...)` in the v2 example.
  That call-site syntax stays valid as a *thin convenience binding* on
  `ctx` (it just calls the global-reading factory under the hood).
  Authors can use either; documentation recommends the import form to
  match Vue muscle memory.
- The implicit-global cost (hooks must be called synchronously inside
  `setup`) is the same constraint Vue ships with, the same constraint
  React ships with for hook-call rules, and is easy to lint
  (eslint-plugin-vue's `vue/no-lifecycle-after-await` is the template).

**Tradeoffs.**

- ✅ Source-compatible with Vue ergonomics; all six lifecycle hooks
  documented in D2 §6.1 port over with one-line bindings.
- ✅ Lets us add new lifecycle hooks (`onWidgetMount`, `onSubgraphPromote`,
  etc.) without changing every `ctx` shape — they're just new exports
  off the package.
- ✅ Plays correctly with `provide`/`inject` (D2 §4.2), which already
  needs `currentExtension` to be set for `Object.create(parent.provides)`
  to work.
- ⚠️ Hooks called outside `setup()` silently no-op (Vue's behavior).
  Mitigation: dev-mode `console.warn` + lint rule (PKG2 deliverable).
- ⚠️ Test mocking is fractionally harder — tests must enter a fake
  setup scope to exercise hooks. Vue ships a `flushPromises`-shaped
  test helper for this; we copy it (`createTestExtensionContext()` in
  PKG2).

**Alternatives considered.**

1. **(ii) Explicit `ctx.onNodeMounted(fn)`, no global.** Cleaner DI story,
   but: (a) diverges from Vue convention that the broader ECS ADR set
   has otherwise mirrored, (b) forces every future lifecycle hook to be
   added as a `ctx` method (versioning hazard — `ctx` becomes an
   ever-growing union), (c) breaks the `provide/inject` pattern from D2
   §4.2 unless we also pass `ctx` into those, which then forces every
   composable to take a `ctx` argument, killing composable reuse.
   This is the React-without-context-API failure mode.
2. **(iii) Hybrid — global only during setup, methods elsewhere.** All
   the cost of (i) plus all the cost of (ii). The "only during setup"
   constraint is identical between (i) and (iii) — Vue's lifecycle hooks
   are *also* "only during setup". (iii) buys nothing.

**Decision: (i).** Default. Mirrors Vue. D6 Part 1's `ctx.onNodeMounted`
example is preserved as a thin alias.

---

### D10b — Multi-extension hook firing order: (i) registration order, with extension-name tie-breaker

When two or more extensions register lifecycle hooks for the same entity
(e.g. two extensions both call `onNodeMounted` for `CounterNode`), hooks
fire in **registration order** of the extension itself — i.e. the order
in which the host loader processed `defineExtension(...)` modules. Within
the *same* extension, hooks fire in the order they were called inside
`setup()` (Vue's behavior — they're an array, pushed in call order).

Tie-breaker for *registration order itself* (when extensions register
within the same microtask, e.g. eager imports inside an `index.ts`
barrel): **lexicographic on `extension.name`**. This makes the order
deterministic and reproducible across reloads, regardless of import
graph traversal order.

```ts
// Both extensions register onNodeMounted on CounterNode.
defineExtension({ name: 'aaa-bg-color', setup(ctx) {
  onNodeMounted(() => console.log('aaa fires first'))
}})
defineExtension({ name: 'zzz-debug-overlay', setup(ctx) {
  onNodeMounted(() => console.log('zzz fires second'))
}})

// Output for every CounterNode instance:
//   aaa fires first
//   zzz fires second
```

If an extension genuinely needs to fire after another extension is set
up (cross-extension dependency), the **escape hatch** is `inject('foo')`
inside the setup body — which throws if the providing extension hasn't
run yet, surfacing the implicit dependency *as code*, not as ordering
config. We do **not** ship a `dependsOn:` field in v1.

**Rationale.**

- D2 §8 user preference: *"likely: registration order, with a tie-breaker
  on extension name for determinism."* This ADR lands that preference.
- Vue's `instance.m`, `instance.bum`, … are arrays pushed in call order
  (D2 §3, citing `apiLifecycle.ts:20`). We mirror exactly.
- Lexicographic tie-break makes shipped behavior reproducible across
  bundlers, dev/prod, page reload order — the property that matters
  most when an extension author is debugging "why doesn't my hook see
  the other extension's state?"
- `dependsOn:` looks helpful but introduces topological-sort edge cases
  (cycles, missing deps, dynamic registration) that are real cost for
  zero current evidence of need. R4 audit found no extension that
  required cross-extension ordering primitives.

**Tradeoffs.**

- ✅ Trivial implementation — the array-push pattern Vue already uses.
- ✅ Deterministic for end users — same workflow loads the same way
  every reload.
- ✅ Naming convention nudges authors toward predictable order
  (the `aaa-` prefix trick is a known idiom in the WordPress / NPM
  ecosystem and is non-magical).
- ⚠️ Lex tie-break is opinionated; some authors will be surprised
  the first time they hit it. Mitigation: documented prominently in
  the package README under "Hook ordering". In dev mode, log
  `[ext-api] hook order resolved by lex tie-break: aaa-foo, zzz-bar`
  the first time it happens per session.
- ⚠️ No first-class `dependsOn:` means cross-extension deps are
  encoded via `inject` failures. If a future audit shows ≥3 real
  extensions wanting `dependsOn:`, revisit per "Future Pivots" below.

**Alternatives considered.**

2. **(ii) Lexicographic on extension name as the *primary* order.**
   Rejected: removes author agency (you can't influence order at all,
   even by reordering imports). Vue does not do this. The tie-break-only
   form keeps determinism without sacrificing intent.
3. **(iii) Explicit `dependsOn:` edges.** Rejected for v1: zero R4
   evidence of need; introduces graph cycles, missing-dep errors, and a
   whole new diagnostic surface; the "throw on missing inject" pattern
   captures the same intent without new API. Reserved for v2 if real
   demand surfaces.

**Decision: (i) registration order with lex tie-break.** Default.

---

### D10c — Async setup: (i) sync-only `setup` in v1, with `beforeSerialize` as the documented narrow exception

`setup()` in v1 is **synchronous**. The function signature is
`setup(ctx) => SetupResult | undefined`, **not** `Promise<…>`. If an
author writes `async setup(ctx) {}`, the host detects the returned
Promise and either (a) throws in dev with a pointer to this ADR, or
(b) emits a `console.error` in prod and treats `setupState` as `{}`.

The single shipped async-aware surface stays `widget.on('beforeSerialize',
async (e) => {...})` per D5 Part 3. That is a *bounded* async point — it
fires at a known boundary (graphToPrompt), the result is awaited inside
that one call site, and there is no "extension is half-mounted" window
for other code to observe.

Async dependencies needed at `setup` time (e.g. "fetch model list before
showing the widget") are expressed by:

1. Returning sync state immediately with a `loading: ref(true)` flag.
2. Kicking off the async work in `onNodeMounted` (or in `setup`'s body
   if no DOM dependency), flipping `loading` to `false` on completion.
3. Authors render the loading state via the existing widget contract.

```ts
defineNodeExtension({
  name: 'model-picker',
  setup(ctx) {
    const models = ref<string[]>([])
    const loading = ref(true)

    // Async work kicked off, but setup itself returns synchronously.
    fetchModels().then(m => { models.value = m; loading.value = false })

    return { models, loading }
  }
})
```

**Rationale.**

- D2 §8 preference: *"We almost certainly want sync-only for v1 to avoid
  a whole class of 'extension half-mounted' bugs."*
- D5 Part 3 already establishes the philosophy: *"async happens at
  well-defined boundaries, not anywhere."* `setup()` is not a bounded
  call site — it's the *constructor* for the entity's reactive scope.
  Async-suspended setup means every other system that touches the entity
  has to know whether setup has completed yet, which is the same class
  of partial-init bug R4-P3 documented in v1.
- Vue itself ships `async setup` only behind `<Suspense>` for exactly
  this reason. We don't have `<Suspense>` for ECS entities (no parent
  boundary that "waits" for a node to finish setting up before the
  graph renders), so the Vue gate doesn't exist for us, and shipping
  `async setup` without it is shipping the failure mode without the
  guardrail.
- The `loading: ref(true)` pattern is well-understood, type-safe, and
  composable. It's strictly more powerful than `async setup` because
  the loading state is *observable* by consumers rather than hidden in
  the framework's await machinery.

**Tradeoffs.**

- ✅ Zero "extension half-mounted" race conditions. Setup either
  completed or did not.
- ✅ All hook-attachment runs in one synchronous tick — `currentExtension`
  global (D10a) never has to span `await` boundaries, which is where
  Vue's lifecycle-hook-rules-of-hooks lints get tripped.
- ✅ Explicit loading state composes — a parent extension can `inject`
  a child's `loading` ref and `watch` it.
- ⚠️ Authors expecting `async setup` (Vue, React Server Components muscle
  memory) get an upfront error. Mitigation: dev error message links to
  this ADR + the loading-flag recipe.
- ⚠️ Two different async stories in the same API surface (sync `setup`,
  async `beforeSerialize`) is a teaching cost. Mitigated by both being
  consistent with Vue's overall stance — bounded async only.

**Alternatives considered.**

2. **(ii) `async setup` with a documented await contract.** Rejected:
   without a `<Suspense>` boundary, every consumer of `entity.extensionState`
   would have to also track a "setup completed?" flag. R4 evidence
   (specifically v1's `nodeCreated` race conditions) shows that
   ecosystem extensions don't reliably handle these contracts even when
   documented. Strict sync `setup` makes the failure mode
   non-representable.
3. **(iii) Vue-Suspense-style boundary on the ECS entity.** Rejected for
   v1 on cost grounds: requires a parent-boundary concept, a "fallback"
   render, suspended-state semantics in the World, and integration with
   the workflow loader. None of these exist; building them is multi-ADR
   work. Reserved for a future `D10c.1` if/when subgraph-host extensions
   demand it.

**Decision: (i) sync-only.** Default. D5's `beforeSerialize` async
exception remains valid and is documented as a separate, bounded
async surface.

---

### D10d — `setupState` `proxyRefs` wrap: (i) wrapped, no `.value` for callers

The object returned from `setup()` is wrapped with `proxyRefs()` (Vue's
own utility, re-exported from `@vue/reactivity`) before being stored as
`entity.extensionState[ext.name]`.

```ts
const ext = defineNodeExtension({
  name: 'counter',
  setup(ctx) {
    const count = ref(0)
    return { count }
  }
})

// ✅ DECIDED: callers (other extensions, debug panels, ECS queries) write:
const c = entity.extensionState['counter'].count
//                                       ^ no .value, transparent unwrap

// ✅ Inside this same setup, the local `count` binding is still the ref
//    (no proxyRefs at the local scope), so `count.value++` works fine.
```

`proxyRefs` adds a `Proxy` over the returned object whose `get` trap
calls `unref()` on each property and whose `set` trap assigns into
`.value` if the underlying property is a ref (Vue's
`packages/reactivity/src/ref.ts:proxyRefs`). The cost is one Proxy per
extension per entity — already paid in Vue's own component runtime,
known to be cheap (V8 hidden-class-friendly for small object shapes).

**Rationale.**

- D2 §1.2 establishes that this is exactly what Vue does for the same
  reason: `{{ count }}` in a template, not `{{ count.value }}`.
  External callers of our extension state are in the same position as
  Vue templates — they consume, they don't author.
- D2 §6.2 already documented `entity.extensionState[ext.name]` as
  "Returned object, ref-unwrapped". This ADR lands that as the contract
  rather than a description of intent.
- Symmetry with Vue lowers the teaching burden — every Vue dev already
  knows the rule "refs in setup, unwrapped at the boundary."
- `proxyRefs` preserves *write-through* — `entity.extensionState['counter']
  .count = 5` still goes through the ref, which means downstream
  watchers fire correctly. Raw return would silently break write
  through.
- D8 (world-Vue adapter) is downstream of this decision: the adapter
  needs to know whether the value it's exposing in `getComponent(...)`
  is a ref or an unwrapped value. Wrapping at the `setupState` boundary
  means the adapter sees plain values everywhere, which is the
  simpler, faster contract.

**Tradeoffs.**

- ✅ Zero `.value` noise at any consumer call site. Matches Vue
  template-binding ergonomics.
- ✅ Write-through preserved — assignments still go through refs and
  trigger watchers (D8 reactivity).
- ✅ Identical to Vue, so existing Vue knowledge transfers verbatim.
- ✅ Returned plain (non-ref) values pass through unchanged — no
  cost when an extension returns a function or a number directly.
- ⚠️ Subtle bug surface: an author who passes `entity.extensionState['x']`
  to a function that *expected* a ref will be confused — they get the
  unwrapped value. Mitigation: TS types reflect the wrap (return type of
  `setupState[k]` is `UnwrapRef<T>`), and PKG2 documents the boundary.
- ⚠️ One additional Proxy per extension per entity. Negligible (Vue
  ships this for every component instance with no measurable impact).

**Alternatives considered.**

2. **(ii) Raw — store the returned object as-is, callers use `.value`.**
   Rejected: forces every consumer (debug panels, other extensions,
   serialization layer, ECS queries) to know which keys are refs and
   which aren't. That's a *type-level* answer, not a *runtime* one,
   and we lose the ergonomic win that Vue authors expect. Also forces
   D8 to handle "this slot is a ref vs this slot is a value" at every
   query site.

**Decision: (i) wrapped.** Default. Matches Vue exactly.

---

## Consequences

- ✅ All four lifecycle-shape questions left open in D2 §8 are now
  decided. PKG2 (`@comfyorg/extension-api` package authoring) is
  unblocked on this axis.
- ✅ I-SR.4 and I-SR.5 acquire their referent ADR; the "marked done with
  no implementing decision" inconsistency in `todo.md` resolves.
- ✅ The four chosen options are uniformly **(i) — mirror Vue**, which
  honors the user's stated default and minimizes the conceptual delta
  between Vue knowledge and our extension API. Doc burden is "this is
  Vue's `setup` model, applied to ECS entities."
- ✅ D5's `beforeSerialize` async exception remains the *only* async
  surface, consistent across D5 Part 3 and D10c.
- ✅ D8 (world-Vue adapter) gets a stable boundary contract — values
  exposed via `entity.extensionState` are unwrapped (D10d), set up
  in one synchronous tick (D10c), with deterministic order (D10b),
  via the implicit `currentExtension` (D10a).
- ⚠️ Authors writing `async setup` will hit a dev error. Pure cost
  paid for the partial-init bug class avoided.
- ⚠️ Lex tie-break for hook order is opinionated; first-time encounters
  warrant a dev-mode log line.
- ⚠️ Implicit `currentExtension` global means lifecycle hooks must be
  called synchronously inside `setup` — Vue's own constraint, lintable.

## Future Pivots

| Pivot | Rule | When to consider |
|---|---|---|
| D10b → `dependsOn:` edges | Add explicit cross-extension ordering field | If ≥3 real extensions surface a cross-extension order requirement that `inject`-throws-on-missing can't express. Track via a labeled GitHub issue once the `extension-api` package ships. |
| D10c → Vue-Suspense boundary | Allow `async setup` inside a parent suspense entity | When subgraph-host extensions arrive (D8 sub-question 5) and the World gains a "wait for child entity setup" primitive. Expect a sibling ADR `D10c.1`. |
| D10d → opt-out raw mode | Allow `setup` to return a raw bag via `markRaw(...)` | If a real extension needs to expose refs *as refs* to consumers (e.g. an extension exposing a ref for `watch()` chaining). Cheap addition; deferred until evidence. |

## Cross-References

- **D2** §1.1 (`setupStatefulComponent`), §1.2 (`proxyRefs(setupResult)`),
  §3 (`injectHook` / `__weh`), §4 (`provide`/`inject`), §6.2 (correspondence
  table), §8 (open questions — this ADR resolves all four)
- **D3.5** "Gap: `pauseTracking()` During Setup" (D10a's `currentExtension`
  set/restore is the natural place to also pause/reset tracking)
- **D5** Part 3 (`beforeSerialize` async — the lone D10c exception),
  Part 4 "Resolutions" Q3 (forwarded hook-ordering open Q to this ADR)
- **D6** Part 1 (`defineExtension({ setup(ctx) { ctx.onNodeMounted(...) } })`
  — the `ctx.onNodeMounted` syntax is preserved as a thin alias over D10a's
  global-reading factory)
- **D7** Context: D2-review note on `proxyRefs` wrap (resolved by D10d)
- **D8** sub-questions 5 (workflow swap semantics) and 6 (slot
  nullability) — D10's contracts feed into D8's adapter contract
- **I-SR.4** (D2-review lifecycle context choice) → resolved by D10a
- **I-SR.5** (hook ordering across extensions) → resolved by D10b
- **I-NEW.3** → this ADR
- Vue source refs: `core/packages/runtime-core/src/component.ts:829`
  (setupStatefulComponent), `apiLifecycle.ts:20` (createHook),
  `apiInject.ts` (provide/inject), `packages/reactivity/src/ref.ts`
  (proxyRefs)
