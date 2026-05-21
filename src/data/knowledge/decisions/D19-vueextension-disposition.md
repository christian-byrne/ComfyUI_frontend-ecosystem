# D19 — `VueExtension` / `CustomExtension` disposition

**Status**: ACCEPTED — 2026-05-14 (verdict: remove from public barrel; keep internal as discriminated-union ingredient)

## Context

`VueExtension` and `CustomExtension` are exported from
`src/extension-api/shell.ts` and re-exported from the package barrel
`src/extension-api/index.ts`. They were added during the
`extensionTypes.ts → extension-api/shell.ts` lift (PKG2) by mechanical
re-export, not as a deliberate public-API decision.

Audit (`research/architecture/public-api-surface-audit-2026-05-14.md` §F1)
shows:

- Both interfaces serve as **discriminated-union ingredients** for
  `SidebarTabExtension` and `BottomPanelExtension`. The unions are the
  intended public surface; the ingredient types are an implementation
  detail.
- The only in-repo consumer is `src/components/common/ExtensionSlot.vue`,
  which is internal runtime code — not extension-author-reachable.
- Zero v2 example extensions under `src/extensions/core/*.v2.ts` reference
  either type.
- No ADR mentions either name.
- No design-review row asks for them to be public.
- Sole-contributor ecosystem dashboard's `/api-docs` page renders them as
  top-level entries with no description, contributing to API noise.

CB confirmed in chat (2026-05-14): "remove the accidental public exports
unless an extension author would conceivably write `const x: VueExtension
= …` standalone — they wouldn't."

## Decision

1. Remove `VueExtension` and `CustomExtension` from the
   `@comfyorg/extension-api` package barrel
   (`src/extension-api/index.ts`) and from the per-module re-export in
   `src/extension-api/shell.ts`.
2. Keep both interfaces exported from `src/types/extensionTypes.ts` —
   `ExtensionSlot.vue` and the union aliases still need them.
3. The composite types `SidebarTabExtension` and `BottomPanelExtension`
   remain in the public barrel as before — they are the intended
   author-facing surface.

## Consequences

- **Public-API surface**: shrinks by 2 type exports. Pre-v1.0 — no external
  consumers exist outside the example extensions in `src/extensions/core/*.v2.ts`,
  and those don't reference the names. No deprecation alias needed.
- **Documentation**: `/api-docs` page on the ecosystem dashboard will lose
  two no-description entries on the next `scripts/refresh-api-docs.sh`
  run (DASH-REFRESH-1, this session).
- **Internal usage**: unchanged. `ExtensionSlot.vue` keeps its existing
  `import type { CustomExtension, VueExtension } from '@/types/extensionTypes'`
  — no churn.
- **Migration impact for extension authors**: none. Authors write
  `const tab: SidebarTabExtension = { type: 'vue', component, ... }` and
  the discriminated union infers the rest. Standalone `VueExtension`
  typing was never advertised.

## Alternatives considered

| Option | Pro | Con | Verdict |
|---|---|---|---|
| Keep public, document as type-ingredient | Maximum flexibility | Pollutes the surface; dashboard renders two stub pages; adds 2 names authors must mentally filter | Rejected |
| Remove from public barrel (chosen) | Cleaner surface; fewer names to scan; no real loss | Authors who *do* want to type a bare `VueExtension` lose the import path from `@comfyorg/extension-api` | **Accepted** |
| Delete the interfaces entirely and inline into the unions | Smallest type definitions | Inlined-union duplication makes `extensionTypes.ts` harder to read; no win | Rejected |
| Mark with `@internal` JSDoc tag and let TypeDoc filter | Keeps the import path alive while hiding from docs | Type still appears in IDE autocomplete from the package; D19 wants stronger guarantee | Rejected |

## Implementation plan

| Step | Action | Verification |
|---|---|---|
| 1 | Edit `src/extension-api/shell.ts` — drop `VueExtension`, `CustomExtension` from the `export type` list | `pnpm tsc -b packages/extension-api` clean |
| 2 | Edit `src/extension-api/index.ts` — drop the same two from the shell re-export | `pnpm tsc -b packages/extension-api` clean |
| 3 | Run `pnpm lint && pnpm format:check && pnpm knip` | All green |
| 4 | Verify `ExtensionSlot.vue` still resolves both names from `@/types/extensionTypes` | `pnpm vue-tsc --noEmit` clean |
| 5 | Force-push to `ext-api/i-foundation-restratify` PR #12142 with `--force-with-lease` | PR comment |
| 6 | Re-run `scripts/refresh-api-docs.sh` in `christian-byrne/ComfyUI_frontend-ecosystem` | Two `/api-docs` entries disappear |

## References

- Audit: `research/architecture/public-api-surface-audit-2026-05-14.md` §F1
- D11 — naming convention (sets the bar for "public means deliberate")
- D6.1 — entry-point shape (only `define*` should be the front door)
- design-review-12142.md (no row directly; this is a no-decision discovery)
- AGENTS.md "Decision propagation rules" — D19 must reach (a) commit on PR #12142, (b) this ADR, (c) dashboard JSON
