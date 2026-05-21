# <a href="/decisions/D11-naming-defineNode-defineWidget" class="wiki-link">D11</a> — Naming: `defineNode` / `defineWidget` (short form)

**Status**: ACCEPTED — 2026-05-12 (already implemented on `*-restratify` branches; reconciled into `*-v2` branches in wave-4 reconciliation 2026-05-13)

## Context

The initial v2 extension-api drafts named the registration entry points
`defineNodeExtension` and `defineWidgetExtension` to mirror the v1 `app.registerExtension` naming. Design review #5 surfaced that the `Extension`
suffix is implied by every callsite (`defineNode({...})` always defines an
extension — what else would it define?) and adds typing friction without
disambiguation value. Vue's `defineComponent`, React's `forwardRef`,
SolidJS's `createSignal` all use short forms; matching that idiom keeps
the surface familiar.

## Decision

Use the short form `defineNode` / `defineWidget` as the canonical
registration entry points exposed from `@comfyorg/extension-api`.

## Consequences

- **Public-API surface**: `defineNode` and `defineWidget` are exported from
  `src/extension-api/index.ts`. The longer `defineNodeExtension` /
  `defineWidgetExtension` names are NOT re-exported (no soft-deprecation
  alias) — pre-v1.0, no consumers exist outside the example extensions
  in `src/extensions/core/*.v2.ts`, which were updated atomically.
- **Documentation**: All examples in JSDoc comments + `docs/extensions/`
  use the short form. The TypeDoc-generated reference (rendered at
  `https://comfyui-frontend-ecosystem.vercel.app/api-docs/definenode`)
  shows the short form as canonical.
- **Migration impact for v1 consumers**: irrelevant — v1 `app.registerExtension`
  remains the v1 entry point. v2 is opt-in via the new `@comfyorg/extension-api`
  package; consumers choose their entry point at import time per <a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a>.

## Alternatives considered

| Option | Pro | Con | Verdict |
|---|---|---|---|
| `defineNodeExtension` / `defineWidgetExtension` (original) | Mirrors v1 verbosity | `Extension` suffix redundant; longer to type | Rejected |
| `defineNode` / `defineWidget` (chosen) | Matches Vue/React/Solid idiom; less typing | None significant | **Accepted** |
| `node()` / `widget()` (very short) | Shortest | Loses the "this defines a thing" verb-noun affordance | Rejected |
| `createNodeExtension` / `createWidgetExtension` | Aligns with `createApp`-style factories | `create` implies returning a value; v2 entry points still register via side effect (until <a href="/decisions/D18-pure-functions-loader-registration" class="wiki-link">D18</a> lands) | Rejected |

## References

- design-review-12142.md row #5 (decision logged 2026-05-12)
- restratify cleanup commit `8da221b5db refactor(ext-api): rename defineNodeExtension → defineNode, defineWidgetExtension → defineWidget`
- <a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a> — parallel-paths migration (<a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a>.2 sunset criteria pin Gate 2 to "absorb-or-disown" of every v1 export, including these short-form replacements)
- <a href="/decisions/D18-pure-functions-loader-registration" class="wiki-link">D18</a> — pure-functions + loader registration (orthogonal: <a href="/decisions/D18-pure-functions-loader-registration" class="wiki-link">D18</a> may change the *registration mechanism* but keeps these names)
- AGENTS.md "Decision propagation rules" section (added wave-4 to prevent the original drift where this rename landed on `*-restratify` but not `*-v2` for ~1 day)
