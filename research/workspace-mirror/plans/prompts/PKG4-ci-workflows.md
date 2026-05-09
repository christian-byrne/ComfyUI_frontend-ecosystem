# Subagent Prompt — PKG4: CI Workflows for Extension API Package

You are implementing PKG4 from `plans/P2-extension-api-package.md`.

## Prerequisites

- PKG3 must be in place (`packages/extension-api/` exists).

## Required reading

1. `plans/P2-extension-api-package.md` (section "PKG4")
2. Existing `.github/workflows/` in ComfyUI_frontend — match style and
   action versions
3. ComfyUI_frontend AGENTS.md (CI conventions, never `--no-verify`, etc.)

## Deliverables

Two new workflows in `ComfyUI_frontend/.github/workflows/`:

### 1. `extension-api-typecheck.yml`

Runs on:

- Pull request opened/sync against `main`
- Push to `main`
- Path filter: `src/extension-api/**`,
  `src/extensions/core/*.v2.ts`,
  `src/services/extension-api-service.ts`,
  `packages/extension-api/**`,
  `.github/workflows/extension-api-*.yml`

Steps:

- Checkout
- Setup Node + pnpm (match other workflows in repo)
- `pnpm install --frozen-lockfile`
- `pnpm --filter @comfyorg/extension-api build`
- `pnpm --filter @comfyorg/extension-api typecheck`
- Smoke test: build a minimal example extension consuming the package
  output and run `tsc --noEmit` on it. (Either inline or via a
  `test/smoke/` directory inside the package.)

### 2. `extension-api-publish.yml`

Runs on:

- Push of a tag matching `extension-api-v*` (e.g.
  `extension-api-v0.1.0`)
- `workflow_dispatch` for manual dry-run

Permissions:

- `id-token: write` (for npm provenance via OIDC)
- `contents: read`

Steps:

- Checkout (full history for changelog if needed)
- Setup Node + pnpm
- Setup npm registry: `registry-url: https://registry.npmjs.org/`
- `pnpm install --frozen-lockfile`
- `pnpm --filter @comfyorg/extension-api build`
- `pnpm --filter @comfyorg/extension-api typecheck`
- Verify version in `packages/extension-api/package.json` matches the
  tag (script: parse tag, grep package.json, fail if mismatch)
- `cd packages/extension-api && npm publish --provenance --access public`
  - Env: `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`
- Post-publish: create a GitHub Release with auto-generated notes from
  commit messages since previous tag

## Acceptance criteria

1. Both workflows lint cleanly via `actionlint`.
2. `extension-api-typecheck.yml` passes on a no-op PR (no
   `src/extension-api/**` changes — should be skipped) and on a PR that
   touches the path (should run and pass).
3. `extension-api-publish.yml` dry-run via `workflow_dispatch` builds
   the package and reports what *would* be published, without actually
   publishing.
4. Both workflows use pinned action versions (SHA or major version,
   match the rest of the repo's convention).

## What to defer

- Setting up the `NPM_TOKEN` secret — needs a human with org admin.
  Document the requirement in the workflow file as a comment.
- Setting up the npm scope `@comfyorg` — already exists for
  `@comfyorg/comfyui-frontend`, so this is no-op.
- First actual publish — done by a human after PKG6 lands.

## Verification commands

```bash
# Lint workflows
actionlint .github/workflows/extension-api-*.yml

# Locally simulate the typecheck job
act -j typecheck -W .github/workflows/extension-api-typecheck.yml
```

## Report back

Write `plans/prompts/_results/PKG4-summary.md` with:

- The two workflow files (full contents)
- Output of `actionlint` (should be clean)
- Any TODOs requiring human action (e.g. `NPM_TOKEN` setup)
