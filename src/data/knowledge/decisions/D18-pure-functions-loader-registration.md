# D18 — Pure functions + loader-based registration

**Status**: ACCEPTED — 2026-05-14 (decision logged in [design-review-12142.md row #18](../design-review-12142.md#decisions) on 2026-05-12; ADR formalized 2026-05-14 to satisfy `scripts/check-decision-propagation.sh` and unblock implementation)

## Context

The initial v2 extension-api drafts kept v1's side-effect registration model
under a new function name:

```
v1: import → module executes → app.registerExtension(opts) → extensionStore
v2 (initial): import → module executes → defineNode(opts) → nodeExtensionRegistry
```

Design review #18 surfaced that this is mechanically identical to v1 — the
only changes are (1) decoupling from the `app` god-object, (2) typed/scoped
options shape, (3) package boundary. The actual *registration mechanism*
(side effect at module evaluation time) is unchanged, which means we
inherit every problem v1 has:

- impure: cannot be tested in isolation without module-cache hacks
- not tree-shakeable: every imported file registers, even if its extension
  is never used
- order-dependent: core extensions must load before third-party
- no static analysis: nothing in the source tells us what extensions exist
- imperative setup leaks: extensions can do `app.graph.doSomething()` at
  module-evaluation time, defeating the declarative model

The Vue/Vite reference shows the alternative: `defineComponent()` is a
*pure function* that returns the options object; registration is a
separate, explicit step performed by a loader (`app.component(...)`,
`import.meta.glob`, or a plugin). The same pattern applies to Vite plugins.

CB's verdict in the review (2026-05-12, recorded inline in the doc):

> 1. Are we okay with side-effect registration? **no.**
> 2. Is the package boundary worth it? **yes, ideally we can get rid of the shim.**
> 3. Acceptable to break imperative third-party patterns? **yes — we are
>    potentially doing a clean migration break.**
> 4. One file = one extension convention? **no, not strictly required.**

## Decision

`defineNode` / `defineWidget` / `defineExtension` (D11) are **pure
functions**. They return frozen, typed options objects with no side
effects. Registration is performed by an **explicit loader** in the
ComfyUI runtime that consumes module exports.

### 1. Pure-function contract

```ts
// @comfyorg/extension-api
export function defineNode<T extends NodeExtensionOptions>(opts: T): T {
  // Pure: validates shape, freezes object, returns it.
  // MUST NOT touch any registry, app instance, or global state.
  return Object.freeze(opts) as T
}
```

Same shape for `defineWidget` and the app-level `defineExtension`.
Implementations may add a `__brand` symbol for runtime type-guarding by
the loader, but no other side effects are permitted.

### 2. Loader contract

The loader (`extensionService.ts` v2 path) walks every dynamically
imported third-party module and every statically imported core extension
module, then registers any exports that pass the `defineX` brand check:

```ts
async function loadExtensionModule(mod: Record<string, unknown>) {
  // Default export — single extension or array
  if (mod.default) {
    const items = Array.isArray(mod.default) ? mod.default : [mod.default]
    for (const item of items) registerByBrand(item)
  }
  // Named exports — multiple extensions per file
  for (const [name, value] of Object.entries(mod)) {
    if (name === 'default') continue
    if (isBrandedExtension(value)) registerByBrand(value)
  }
}
```

`registerByBrand` dispatches to `nodeExtensionRegistry`,
`widgetExtensionRegistry`, or `appExtensionRegistry` based on the brand
symbol. Unbranded exports are ignored (not an error — extensions may
export utilities alongside their definitions).

### 3. Convention for third-party authors

```ts
// Single extension — default export
export default defineNode({ name: 'A', ... })

// Multiple extensions — named exports
export const nodeA = defineNode({ name: 'A', ... })
export const nodeB = defineNode({ name: 'B', ... })

// Multiple extensions — array default
export default [
  defineNode({ name: 'A', ... }),
  defineNode({ name: 'B', ... }),
]
```

No file-naming, one-per-file, or build-tool conventions are required.
The loader only needs *exports it can read*.

### 4. Banned patterns (clean break vs v1)

The following imperative patterns work in v1 but **MUST NOT** work in v2:

```ts
// ❌ Side-effect registration (v1 pattern)
defineNode({ ... })   // bare call, no export — silently dropped

// ❌ Imperative setup at module load
import { app } from '@/scripts/app'
app.graph.doSomething()
window.myGlobal = something

// ❌ Cross-extension communication via globals
window.__myExtensionHandle = handle
```

Detection: a dev-mode wrapper around `defineNode` records call sites; at
end-of-load the loader cross-checks recorded calls against registered
exports and `console.warn`s for any orphan call ("you called defineNode
but did not export the result — registration was skipped").

### 5. Package boundary

D18 implies the package boundary (`@comfyorg/extension-api`) is the only
supported import path for the new pure-function API. The legacy shim
system (`/scripts/app.js`, `window.comfyAPI.*`) MUST NOT re-export the
v2 functions — third-party code that wants the new contract MUST
declare the package dependency. This makes the side-effect-vs-pure
distinction visible at the import-statement level.

The shim system continues to expose v1 (`app.registerExtension`) for the
parallel-paths window per D6.

## Consequences

### What this enables

- **Tree-shaking**: any extension whose default/named export is never
  registered by the loader can be eliminated. (For third-party packages
  this matters mainly for monorepos that ship multiple extensions.)
- **Unit testing in isolation**: `import { default as ext } from './my-node'`
  returns the options object directly; tests can assert against shape
  without booting an app.
- **Static analysis**: linters and codegen tools can find every
  extension by walking exports, no runtime introspection required.
- **Auditability**: the loader is the single chokepoint for "what's
  installed" — telemetry, allow-listing, and conflict detection all hook
  there instead of monkey-patching `app.registerExtension`.
- **Cleaner mental model**: definition (pure) and registration (loader)
  are separated, mirroring Vue/React/Solid idioms.

### What this breaks

- Any v2 third-party extension authored against earlier drafts that
  called `defineNode({...})` as a bare expression: silently does nothing
  under the new loader. Fix: add `export default`. The dev-mode warning
  catches this case loudly.
- v1 extensions that mix registration with imperative setup (e.g.
  `app.registerExtension({...}); app.graph.add(node)`) cannot be
  mechanically translated by replacing the function name; the imperative
  setup must move into a `setup()` hook or be replaced with a
  declarative equivalent. **This is the "clean migration break" CB
  authorized in question 3.**
- Loader complexity grows: `extensionService.ts` v2 path is no longer a
  trivial "for each path: import" — it must walk exports, brand-check,
  and dispatch by extension kind. Estimated +80 LoC + tests.
- Convention compliance is enforced at runtime, not compile time. A
  TypeScript lint rule (under `eslint-plugin-comfy`) is desirable but
  not a hard dependency.

### Migration impact (per W2F-1 re-audit)

The W2F-1 re-audit (2026-05-13,
`research/meta/sourcegraph-mcp-coverage-investigation.md`) shows the
top-10 v1 surfaces by listener-variant consumer count:

| Rank | Surface | Consumers | Pattern | Loader-affected? |
|---|---|---|---|---|
| 1 | S2.N1 `onNodeCreated` | 77 | prototype patch | indirect (via setup hook) |
| 2 | S2.N7 `onConfigure` | 56 | prototype patch | indirect |
| 3 | S6.A1 `app.graphToPrompt` | 15 | prototype patch | NO (D-uwf) |
| 4 | S2.N18 `onPropertyChanged` | 13 | prototype patch | indirect |
| 5 | S11.G3 `beforeChange/afterChange` | 12 | direct call | no |
| ...| ...| ...| ...| ...|

None of these are *registration*-shaped — they are all hook/event-shaped.
D18 affects only the *outer shell* of an extension (how it's discovered
+ registered), not the inner shape (which is governed by D5 events, D7
widget shape, D11 naming, D14 widget state, D15 serialization ban). For
the migration guide (`docs/extensions/migration-v1-to-v2.md`) D18 adds
exactly one rewrite pattern:

```ts
// v1 → v2
- app.registerExtension({ name, nodeCreated })
+ export default defineNode({ name, nodeCreated })
```

Plus a "watch out for imperative setup" callout for the small minority
that do work at module-eval time.

## Alternatives considered

| Option | Verdict |
|---|---|
| **A. Side-effect registration, new API** (initial draft) | Rejected — mechanically identical to v1, inherits every v1 weakness, package boundary is the only thing that changes |
| **B. Pure functions + loader registration** (chosen) | **Accepted** — clean break, enables tree-shaking + isolation testing, matches Vue/React/Solid idioms |
| C. Hybrid: `defineNode` is pure, `registerNode` is the imperative variant | Rejected — gives authors a foot-gun back; we'd inevitably end up with mixed patterns in the wild |
| D. Manifest-driven (one JSON per extension declaring exports) | Rejected — extra build step, doesn't fit ComfyUI's dynamic third-party model, no win over named-exports convention |
| E. Decorator-based (`@Extension({...})`) | Rejected — requires TC39 decorators or build-time transform, ergonomically worse than `export default`, harder to test |

## Implementation plan

D18 is **the highest-impact unimplemented ADR** in the v2 stack — every
other accepted ADR (D11/D14/D15) describes the *shape* of extensions;
D18 describes how they get into the runtime at all.

### Phase 1 — Loader scaffolding (foundation PR #12142, can land independently)

1. Add brand symbol + `isBrandedExtension(x)` guard to
   `src/extension-api/index.ts`.
2. Stamp the brand inside `defineNode` / `defineWidget` /
   `defineExtension` in the package.
3. Add empty `nodeExtensionRegistry` / `widgetExtensionRegistry` /
   `appExtensionRegistry` modules under `src/services/registries/`.

### Phase 2 — Loader wiring (ext-api/i-ext PR #12144, depends on Phase 1)

4. Extend `extension-api-service.ts` (renamed from
   `extensionV2Service.ts`) with `loadExtensionModule(mod)` per the
   contract above.
5. Update `core/index.ts` v2 imports to `export default` form.
6. Wire dev-mode orphan-call warning.

### Phase 3 — Migration guide + lint rule (PKG6 + PKG2 docs, after Phase 2)

7. Add "Replacing `app.registerExtension`" section to
   `docs/extensions/migration-v1-to-v2.md` (the D6.2 Gate 3 stub).
8. Add `eslint-plugin-comfy/no-bare-defineNode` rule (lints the
   side-effect pattern).
9. Cross-link from D11 (which currently notes "v2 entry points still
   register via side effect (until D18 lands)" — that line becomes
   stale once Phase 2 is merged).

### Phase 4 — v1 deprecation alignment (post-merge, gated on D6.2)

10. Add dev-mode `console.warn` to `app.registerExtension` v1 path
    pointing at the `export default defineNode({...})` replacement.
11. Sunset gate on telemetry + 5% threshold (already specified in D6.2).

## References

- [design-review-12142.md row #18](../design-review-12142.md#decisions) (decision logged 2026-05-12) — full options analysis lives in §18 of the review doc
- [todo.md](../todo.md) entry `ADR-D18-PURE-FUNCTIONS` (formalized this ADR; flagged "highest impact ADR — no implementation yet")
- D6 — parallel-paths migration (D18 lives entirely on the v2 path; v1 path remains unchanged through the parallel window)
- D6.1 — entry-point shape (compatible: D18 narrows the entry-point contract from "function with side effects" to "function returning frozen options")
- D6.2 — types-package sunset criteria (D18 implementation Phase 4 is gated on D6.2 telemetry + threshold)
- D11 — naming `defineNode` / `defineWidget` (orthogonal: D18 changes the *mechanism*, D11 keeps the *names*; the "rejected `createNode`" row in D11 references D18 explicitly)
- D14 (widget-state-categories) + D15 (ban node-on-beforeSerialize) — orthogonal: govern the *inner* shape of extensions, D18 governs the outer shell
- D-uwf — UWF-resolved patterns (S6.A1 graphToPrompt is unaffected by D18; UWF Phase 3 is its migration path, not the loader)
- AGENTS.md "Decision propagation rules" — every Decisions-table row must reach a commit + ADR + dashboard JSON; this ADR closes the ADR leg for row #18 (commit + dashboard legs tracked under ADR-D18-PURE-FUNCTIONS Phase 1–3 above)
- W2F-1 re-audit: research/meta/sourcegraph-mcp-coverage-investigation.md (consumer-count table referenced in §Migration impact)
