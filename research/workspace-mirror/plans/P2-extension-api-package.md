# P2 — Public Extension API Package, Declaration File, and Documentation Pipeline

**Status**: planning
**Date**: 2026-05-08
**Owner**: TBD (intended for parallel subagents — see `plans/prompts/`)
**Related decisions**: D5 (event spec), D6 (parallel paths), D7 (widget shape, blocking), P1 (extension API spec)
**Combines**: idea 1 (`.d.ts` "cover letter") + idea 2 (docgen + npm publish + CI) + reconciliation of existing scattered type files

## Goal

Produce a single, coherent public-API artifact that is simultaneously:

1. **A hand-authored TypeScript declaration file** — the "cover letter" that
   any extension author can read top-to-bottom to understand the surface.
2. **An npm package** (`@comfyorg/extension-api`) that extension repos can
   `pnpm add -D` instead of vendoring `comfy.d.ts` files. Resolves
   touch-points R4-P11 finding.
3. **A docgen pipeline** that produces MDX → drops into `Comfy-Org/docs`
   on `docs.comfy.org/extensions/api/...` Resolves CONTEXT.md "auto-doc"
   goal.

All three outputs share **one source of truth**: the hand-authored
declaration file under a single new folder `src/extension-api/`.

## Naming verdict

Drop the `v2` suffix from public-facing names. Reasoning:

- The package (`@comfyorg/extension-api`) carries versioning via semver.
- File paths with `v2` baked in become misleading once v1 is sunset (D6
  Phase D).
- We will never want to ship "v3" with a package called
  `@comfyorg/extension-api-v2` and a folder called `extension-api/v2/`.
- "v2" stays as a working tag in chat/PR titles during the transition,
  not in the file tree.

Transitional: `src/types/extensionV2.ts` and
`src/services/extensionV2Service.ts` are renamed during PKG2 below.

## Reconciliation of current scattered type artifacts

Audit (verified 2026-05-08):

| File                                          | Currently   | Disposition                            |
|-----------------------------------------------|-------------|----------------------------------------|
| `src/types/index.ts`                          | barrel of public types | Migrate exports to `src/extension-api/index.ts`; keep `src/types/index.ts` as deprecation stub for one release that re-exports from the new location. |
| `src/types/comfy.ts`                          | `ComfyExtension` v1 interface | **Leave in place.** Custom extensions in the wild use the runtime entry point (`window.app.registerExtension`), not this type file. ~30 internal files import from here; moving = pure churn with zero runtime benefit. v1↔v2 distinction lives at the entry point per D6 Part 1, not in folder location. |
| `src/types/extensionTypes.ts`                 | shell UI types (sidebar, bottom panel, etc.) | Move to `src/extension-api/shell.ts`. These are public-API regardless. |
| `src/types/extensionV2.ts`                    | new v2 types | Renamed → `src/extension-api/index.ts` + split into per-entity files. |
| `src/services/extensionV2Service.ts`          | v2 implementation | Renamed → `src/services/extension-api-service.ts`. Implementation stays in `services/`; types stay in `extension-api/`. |
| `src/types/litegraph-augmentation.d.ts`       | LiteGraph type patches | Stays in `src/types/` — internal typedef, not public API. |
| `src/types/nodeIdentification.ts`             | `NodeLocatorId`, etc. | Re-export from `src/extension-api/identifiers.ts`; underlying impl stays. |
| `src/types/nodeDefAugmentation.ts`            | internal | Stays in `src/types/`. |
| **No file currently named `comfy.d.ts`**      | (the user mentioned one but the worktree has none) | N/A — extension authors are vendoring their own. The published `@comfyorg/extension-api` package replaces those vendored copies. |

**Barrel-file rule conflict**: ComfyUI_frontend AGENTS.md rule #19 says
"Don't use barrel files (`/some/package/index.ts`) to re-export within `/src`."
The new `src/extension-api/index.ts` IS a barrel. **The exception is that this
barrel is *the published package entry point*, not an internal re-export.**
Document this exception in AGENTS.md when PKG2 lands.

## Target folder structure

```
ComfyUI_frontend/
  src/
    extension-api/                     ← NEW: published package source
      index.ts                         ← barrel — package entry point
      README.md                        ← package-level overview
      node.ts                          ← NodeHandle, NodeEvents
      widget.ts                        ← WidgetHandle, WidgetEvents
      events.ts                        ← shared event-payload types
      lifecycle.ts                     ← setup ctx, onNodeMounted, etc.
      shell.ts                         ← sidebar, bottom panel, command, toast
      identifiers.ts                   ← NodeLocatorId etc. (re-exports)
      world.ts                         ← (NodeKind, ComponentType — TBD per D8)
    services/
      extension-api-service.ts         ← renamed from extensionV2Service.ts
    types/
      index.ts                         ← STUB after migration: re-exports from
                                         extension-api/ with @deprecated tag for
                                         one release, then deleted
      (remaining files stay)
  packages/                            ← NEW (or use existing if it exists)
    extension-api/                     ← published package wrapper
      package.json                     ← @comfyorg/extension-api
      README.md
      tsconfig.json
      build.config.ts                  ← if needed; or just `tsc --emitDeclarationOnly`
      .npmignore
docs/
  architecture/
    extension-api-v2/                  ← existing — touch-points DB + plan
    extension-api/                     ← NEW: package architecture doc
      package-structure.md
      publish-workflow.md
      docgen-pipeline.md
.github/
  workflows/
    extension-api-publish.yml          ← NEW: publish on tag push
    extension-api-typecheck.yml        ← NEW: typecheck examples on every PR
```

## Work breakdown

### PKG1 — Audit & reconcile current types files

**Status**: this plan IS the audit. Output: the table above.
**Acceptance**: every file in `src/types/` has a "stays / moves / deletes"
disposition recorded.

### PKG2 — Author hand-written declaration file

Create `src/extension-api/index.ts` (NOT `.d.ts` — TypeScript source files
emit declaration files via `tsc --emitDeclarationOnly`; we author in `.ts`
so the example extensions can import-and-typecheck directly).

Acceptance criteria:

- All three example extensions
  (`dynamicPrompts.v2.ts`, `imageCrop.v2.ts`, `previewAny.v2.ts`)
  typecheck against the declaration file with zero `any`, zero
  `@ts-expect-error`.
- Every type has a TSDoc comment with at least: 1-line summary, `@example`
  block, `@stability` tag (`stable` | `experimental` | `deprecated`).
- No internal types leak (no `World`, no `WidgetEntityId`, no
  `Component<…>` exposed unless deliberately public).
- File is ≤ 800 lines or split per the target folder structure above.
- Naming follows D6 Part 3 (read-only invariants = accessors;
  state/mutations = methods).
- Event types follow D5 (typed payloads, split `change` into three).

Subagent prompt: `plans/prompts/PKG2-author-declaration.md`

### PKG3 — Set up `@comfyorg/extension-api` npm package

Create `packages/extension-api/` with:

- `package.json` — `name: '@comfyorg/extension-api'`, `version: '0.1.0'`,
  `main`, `types`, `exports` field, peer deps on Vue (if needed for types
  only).
- `tsconfig.json` — extends root, narrow `include` to `src/extension-api/`.
- Build script: `pnpm build` runs `tsc --emitDeclarationOnly --declaration
  --outDir dist`.
- `.npmignore` — exclude tests, source maps, scripts.
- `README.md` — install snippet, "what is this package", link to
  docs.comfy.org.

Acceptance:

- `pnpm --filter @comfyorg/extension-api build` produces `dist/index.d.ts`
  + `dist/index.js`.
- `npm pack` produces a tarball that, when consumed in a fresh project,
  type-checks an example extension.
- Initial version is `0.1.0` (signals experimental per D6 Phase A).

Subagent prompt: `plans/prompts/PKG3-npm-package.md`

### PKG4 — CI workflows

Two workflows:

1. **`.github/workflows/extension-api-typecheck.yml`** — runs on every PR
   that touches `src/extension-api/**` or `src/extensions/core/**.v2.ts`
   or `packages/extension-api/**`. Runs `tsc --noEmit` on examples
   against the published-shape build.

2. **`.github/workflows/extension-api-publish.yml`** — runs on tag push
   matching `extension-api-v*`. Builds the package, runs typecheck on
   examples, publishes to npm via `NODE_AUTH_TOKEN` secret.

Acceptance:

- Both workflows pass on a no-op PR (smoke test).
- Publish workflow uses npm provenance
  (`--provenance` flag, requires OIDC).

Subagent prompt: `plans/prompts/PKG4-ci-workflows.md`

### PKG5 — TypeDoc → MDX docgen pipeline

Set up TypeDoc to read `src/extension-api/index.ts` and emit MDX. Two
implementation paths to evaluate during the spike:

1. `typedoc-plugin-markdown` + manual frontmatter post-process for Mintlify.
2. `typedoc-plugin-mintlify` (if it exists; otherwise option 1).

Output goes to a build directory. `Comfy-Org/docs` consumes it via
either:

- Submodule / path import.
- `pnpm` workspace if both repos colocate.
- Generated PR to Comfy-Org/docs on each release.

Acceptance:

- One MDX page per top-level public type (`NodeHandle`,
  `WidgetHandle`, `Setup`, etc.).
- Frontmatter compatible with Mintlify (`title`, `description`,
  `sidebarTitle` if needed).
- Code examples from TSDoc `@example` blocks render as syntax-highlighted
  TypeScript code blocks.
- Cross-references between types render as Mintlify `<Card>` or links.

Subagent prompt: `plans/prompts/PKG5-docgen-mdx.md`

### PKG6 — Wire docs.comfy.org integration

Open a PR against `Comfy-Org/docs` adding the generated MDX under
`extensions/api/`. Sidebar nav update. Set up the publish workflow from
PKG4 to optionally trigger a docs-update PR on each `@comfyorg/extension-api`
release.

Acceptance:

- `docs.comfy.org/extensions/api/NodeHandle` (or equivalent path) renders
  the type docs.
- Search indexes the API surface.
- A new release of the package can update the docs in one PR (no manual
  copy-paste).

Subagent prompt: `plans/prompts/PKG6-docs-comfy-org.md`

## Sequencing

```diagram
PKG1 (this doc) ──▶ PKG2 (.d.ts) ──┬─▶ PKG3 (npm pkg)
                                   │
                                   ├─▶ PKG4 (CI) ──▶ PKG6 (docs.comfy.org)
                                   │
                                   └─▶ PKG5 (docgen) ─┘
```

PKG2 is the critical path. PKG3, PKG4, PKG5 can run in parallel once
PKG2 has stabilized.

## Dependencies on other decisions

- **D5 (event typing)** — PKG2 cannot finalize event interfaces until D5
  lands. Workable if D5 lands first or in parallel.
- **D6 (parallel paths)** — PKG2 needs the entry-point shape decided.
  D6's Part 1 answers this.
- **D7 (widget shape)** — PKG2 cannot finalize `WidgetHandle` shape until
  D7 lands. **This is the gating blocker.** Authoring can proceed for
  `NodeHandle`, `Setup`, shell types in parallel.
- **D8 (reactivity adapter)** — affects implementation of events (PKG3+),
  not the type shape. PKG2 can ship without D8.

## Out of scope

- Migrating the v1 codebase to use the new package internally. (Separate
  task, post-PKG6.)
- Sunsetting the v1 entry point. (D6 Phase B+, separate plan.)
- Migration guide content. (Tracked as P3 in todo.md, reframed as the
  coverage matrix per F14.)

## Cross-references

- D5, D6, D7, D8 — decisions this plan depends on.
- P1 — current API spec.
- P3 (todo) — migration guide / coverage matrix.
- CONTEXT.md R4-P11 — the "extensions vendor their own comfy.d.ts" finding
  this plan resolves.
- CONTEXT.md "auto-doc" goal from meeting consensus — this plan delivers.
