# ADR-D17: PKG2 build strategy — package builds from main app sources via extended root tsconfig

**Status**: Accepted
**Date**: 2026-05-12
**Related cluster**: PR #12143 CodeRabbit review (F-12143-1, F-12143-3, F-12143-7)
**Implements**: PKG2 / PKG3 acceptance from `plans/P2-package-extension-api.md`
**Related ADRs**: D6 (parallel paths migration), D6.1 (entry-point shape)

## Context

PKG2 ships `@comfyorg/extension-api` as the published TypeScript package
that extension authors install. Per D6 and AGENTS.md, the canonical
surface lives at `src/extension-api/index.ts` in the main app — that
file is "the one source of truth for what is part of the stable,
semver-versioned public contract." The package barrel at
`packages/extension-api/src/index.ts` is just a re-export pass-through
so the package name is stable and discoverable on npm.

CodeRabbit batch 2026-05-12 surfaced three findings against PR #12143
that all stem from the same architectural mismatch in how the package
is built:

- **F-12143-1** — `packages/extension-api/tsconfig.json` declared
  `"@/*": ["../../src/*"]` (resolves to monorepo root `src/`) **and**
  `"rootDir": "src"` (restricts emit to package-local `src/`). These
  two settings are mutually inconsistent: the alias points at sources
  that live outside `rootDir`, so any `@/...` import inside the package
  is either resolved to a file the compiler refuses to emit, or
  silently dropped.
- **F-12143-3** — Same root cause in `lifecycle.ts`. The barrel
  re-exports `defineExtension` etc. from `@/services/extension-api-service`,
  but the package-local `rootDir` made those imports
  un-emittable in the published artifact.
- **F-12143-7** — `package.json` advertised `exports: "./build/index.js"`
  while the build script ran `tsc --emitDeclarationOnly`. The
  declared entry never existed on disk — `npm pack` shipped a manifest
  pointing at a missing file.

The combined effect: `pnpm build` succeeded but produced a package
that could not be installed and used. PKG3 explicitly requires the
package to emit BOTH a working `.js` runtime entry and `.d.ts` types.

This ADR records the build strategy chosen to satisfy that contract
without splitting the source of truth or rewriting the package as a
multi-PR migration.

## Options considered

### Option A — Types-only package

Drop the `.js` emit ambition. Mark the package as a "type-only" surface
(`exports: { "types": "./build/index.d.ts" }` only, no `import` field).
Extension authors install `@comfyorg/extension-api` for the types and
import the runtime symbols from a separate `@comfyorg/extension-runtime`
or directly from the main app bundle.

- ✅ Trivial to ship — `tsc --emitDeclarationOnly` already does this.
- ✅ No build-config archaeology needed.
- ❌ **Breaks the published-package contract per PKG2.** PKG2 acceptance
  requires the package to be the consumer-facing entry point — `import
  { defineNodeExtension } from '@comfyorg/extension-api'` must give
  authors a real function, not a type they have to wire to a runtime
  themselves.
- ❌ Forks the developer mental model: types from one package, runtime
  from another. Splits documentation, versioning, and bug-report
  surfaces.
- ❌ Effectively defers the problem; we will face it again at PKG3.

**Rejected.**

### Option B — Vendor source into `packages/extension-api/src/`

Copy (or move) every file under `src/extension-api/` and its transitive
type chain (`src/services/extension-api-service.ts`, `src/world/*`,
`src/types/extensionTypes.ts`, …) into `packages/extension-api/src/`.
The package becomes self-contained: its own sources, its own
package-local `@/*` alias, plain `tsc` build. Main app re-imports from
the package.

- ✅ Conceptually cleanest end state — the package is a standalone
  TypeScript project with no cross-tree compile dependency.
- ✅ Build is the boring monorepo default — no plugin gymnastics.
- ❌ **Multi-PR migration.** Hundreds of import sites in the main app
  point at `@/extension-api/*`, `@/services/extension-api-service`, and
  the world modules; flipping all of them to `@comfyorg/extension-api`
  is its own coordinated change.
- ❌ **Splits the source of truth during the transition.** Either the
  package and main app drift (two copies of the surface) or every PR
  has to land both halves atomically. Both options are painful given
  PR #11939 (real ECS substrate) is still in flight.
- ❌ Burns the option to iterate fast on the Phase A surface: every
  shape change becomes a cross-package diff with a re-export
  ceremony.

**Deferred.** Option B remains a viable end state once the surface
stabilizes (post-Phase A, post-#11939). D17 explicitly does not
preclude it — see "Consequences" below.

### Option C — Build from main app sources via extended root tsconfig (chosen)

Keep the canonical surface where it is (`src/extension-api/`). Build
the package by pointing the bundler at that surface, using the same
`@/*` alias resolution the main app uses. Drop `rootDir` so transitive
type-chain emission is not artificially restricted. Drop
`--emitDeclarationOnly` so the build emits BOTH a runtime `.js` and
declaration `.d.ts` files.

In implementation, we use **Vite library mode** + **vite-plugin-dts**
rather than raw `tsc` for two reasons that surfaced during
implementation:

1. `tsc` does not rewrite path aliases in emitted JS — `export { … }
   from '@/services/extension-api-service'` would survive verbatim into
   `build/index.js` and fail to resolve at runtime in any non-aliased
   consumer. Vite resolves the alias to a real path during bundling and
   externalizes only what we declare (`vue` and `@vue/*`).
2. The bundled output is one small `index.js` (~4 kB gzipped 1.3 kB)
   instead of the entire transitive tree spread across hundreds of
   files. Declaration emission is still per-file via `vite-plugin-dts`
   so the published `.d.ts` tree stays navigable.

The build still uses `tsconfig.build.json` as the single source of
type-checker settings; `vite-plugin-dts` reads it directly. Pre-existing
main app type warnings (inferred-type portability, augmentation timing)
are out-of-scope for this build and reduced to warnings via the dts
plugin's `logLevel: 'warn'` — the runtime contract is verified by a
direct `node -e "import('./build/index.js')"` smoke test.

- ✅ **Single PR.** No cross-tree import-site migration.
- ✅ **Preserves "the barrel is the source of truth"** (per AGENTS.md).
  The package never owns the surface — it bundles and publishes it.
- ✅ **Emits both `.d.ts` and `.js`** per PKG3 acceptance.
- ✅ Aligns with how the main app builds (Vite, same alias resolution).
- ⚠️ Pulls a transitive `.d.ts` closure (~990 files, ~11 MB unminified)
  into `build/`. Acceptable for Phase A; revisit when surface
  stabilizes (see Consequences §4).
- ⚠️ Adds two new dev-dependencies to the package: `vite` and
  `vite-plugin-dts` (already present in the workspace catalog).
- ⚠️ Uses a bundler instead of raw `tsc` — slight deviation from the
  original "run `tsc -p tsconfig.build.json`" plan in PR #12143's
  initial scoping.

**Chosen.**

## Decision

Adopt Option C. Concretely:

1. `packages/extension-api/tsconfig.build.json`
   - Drops `rootDir` (was `"src"`).
   - Drops `emitDeclarationOnly` (it is no longer the build script).
   - Includes the canonical surface (`../../src/extension-api/**/*.ts`)
     plus the transitive type chain (`world/**`, `services/extension-api-service.ts`,
     `types/extensionTypes.ts`, `types/nodeIdentification.ts`,
     `services/dialogService.ts`, `platform/workflow/**`,
     `schemas/apiSchema.ts`, `stores/commandStore.ts`).
   - Includes augmentation `.d.ts` files (`global.d.ts`,
     `litegraph-augmentation.d.ts`) so the type chain matches what the
     main app sees.
   - Keeps the existing `@/*` alias mapping
     (`["../../src/*"]`) — now consistent because there is no
     conflicting `rootDir`.

2. `packages/extension-api/vite.config.mts` (new)
   - Library build, single ES entry at the canonical
     `src/extension-api/index.ts`.
   - Vite `resolve.alias` mirrors the main app
     (`@` → `/src`, plus the two `@/utils/*` overrides into
     `packages/shared-frontend-utils`).
   - `external: ['vue', /^@vue\//]` — Vue is a peer dependency.
   - `vite-plugin-dts` with `entryRoot: src/` so per-file declarations
     land at `build/extension-api/*.d.ts`, `build/services/*.d.ts`, etc.,
     with all `@/*` imports rewritten to relative paths during emission.

3. `packages/extension-api/package.json`
   - `build` script: `vite build`.
   - `exports`: explicit `{ "types": "./build/extension-api/index.d.ts",
     "import": "./build/index.js", "default": "./build/index.js" }`.
   - `peerDependencies`: `vue` (catalog).
   - `devDependencies`: adds `vite` and `vite-plugin-dts` (catalog).
   - `files`: `["build", "README.md"]` so `npm pack` ships the build
     artifacts, not the source tree.

## Consequences

1. **PKG3 acceptance unblocked.** `pnpm --filter @comfyorg/extension-api
   build` now produces a working `build/index.js` (3.95 kB) and a
   navigable `.d.ts` tree under `build/`. Verified by:
   - `node -e "import('./build/index.js')"` returns real functions for
     `defineExtension`, `defineNodeExtension`, `onNodeMounted`,
     `onNodeRemoved`, and the identifier helpers.
   - A throwaway downstream consumer that imports the surface types
     (`NodeHandle`, `WidgetHandle`, `SidebarTabExtension`) and runtime
     functions type-checks under `tsc --noEmit`.

2. **Source of truth is preserved.** `src/extension-api/index.ts`
   remains the single place to add or remove from the public surface.
   The package barrel at `packages/extension-api/src/index.ts` is now
   documentation-only (typedoc still uses it via `tsconfig.docs.json`
   and `typedoc.json`). The build entry skips the package barrel and
   reads the canonical file directly so emitted paths align cleanly.

3. **Cross-package import path is preserved for consumers.** Inside
   the monorepo, code that imports from `@/extension-api/...` keeps
   working unchanged. From outside the monorepo,
   `@comfyorg/extension-api` resolves to `build/index.js` and its
   bundled symbols.

4. **The published `.d.ts` tree is bloated.** Because the surface
   transitively references Pinia stores, schema types, and litegraph
   augmentations, the dts plugin emits a closure of ~990 files
   (~11 MB) under `build/`. This is correctness-required for type
   resolution today but is a real publication-size cost. Two follow-ups
   are tracked:
   - Trim the surface's transitive type-chain (e.g., make
     `extensionTypes.ts` not import from stores) — easier post-#11939.
   - Eventually adopt Option B once the surface is stable; the build
     tree we ship from then would mirror the package's own `src/`.

5. **Pre-existing main app type warnings are tolerated, not fixed.**
   `vite-plugin-dts` runs at `logLevel: 'warn'` so issues like inferred
   type portability (`TS2742`), augmentation gaps on `LGraphNode`
   (`imgs`, `previewMediaType`, etc.), and `import.meta.env` typing in
   files unrelated to the surface (`devFeatureFlagOverride.ts`) don't
   fail the package build. None of these affect the surface itself —
   the surface compiles cleanly. Dedicated cleanup is owned by the
   main-app type-health workstream, not this PR.

6. **Option B remains the eventual end state.** When the Phase A
   surface stabilizes (target: after #11939 lands and the World becomes
   reactive per D8), revisit vendoring sources into the package. By
   that point: import sites are stable, the surface is small, and the
   payoff (clean separation, smaller publish artifact, no transitive
   type chain) outweighs the migration cost.

## References

- PR #12143 (`ext-api/i-pkg-v2`) — the build strategy implementation.
- `research/reviews/coderabbit-batch-2026-05-12.md` — F-12143-1, F-12143-3, F-12143-7.
- `plans/P2-package-extension-api.md` — PKG2/PKG3 acceptance criteria.
- `decisions/D6-parallel-paths-migration.md` — naming and version
  story for `@comfyorg/extension-api`.
- `decisions/D6.1-entry-point-shape.md` — the surface this package publishes.
- `packages/extension-api/AGENTS.md` — barrel-as-source-of-truth rule.
