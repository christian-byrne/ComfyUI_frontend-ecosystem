# Subagent Prompt — PKG5: TypeDoc → Mintlify MDX Docgen Pipeline

You are implementing PKG5 from `plans/P2-extension-api-package.md`.

## Prerequisites

- PKG2 must be complete (the source of truth for docgen is
  `src/extension-api/`).
- PKG3 helpful but not strictly required.

## Required reading

1. `plans/P2-extension-api-package.md` (section "PKG5")
2. https://typedoc.org/documents/Configuration.html
3. https://www.npmjs.com/package/typedoc-plugin-markdown
4. Mintlify docs structure — look at any existing pages in
   `Comfy-Org/docs` (workspace symlink at `docs/`) for frontmatter
   conventions
5. CONTEXT.md "auto-doc" goal — this delivers it

## Deliverables

### 1. TypeDoc configuration

Create `ComfyUI_frontend/packages/extension-api/typedoc.json`:

- `entryPoints`: `["../../src/extension-api/index.ts"]`
- `out`: `"./docs-build"` (gitignored)
- `plugin`: `["typedoc-plugin-markdown"]`
- `excludeInternal`: `true`
- `excludePrivate`: `true`
- `readme`: `"none"` (we author the index page separately)
- Custom theme/plugin options for Mintlify-compatible MDX output

### 2. MDX post-processing script

Create `ComfyUI_frontend/packages/extension-api/scripts/build-docs.ts`:

- Runs TypeDoc to produce raw markdown
- Post-processes each file to:
  - Add Mintlify frontmatter (`title`, `description`, `sidebarTitle`,
    `icon` if appropriate)
  - Convert TypeScript code fences to use `ts` lang tag (Mintlify
    syntax-highlights `ts`)
  - Resolve cross-references between types as Mintlify
    `<Card>` components or relative links
  - Generate a `mint.json`-compatible navigation snippet
- Writes final MDX files to `docs-build/mintlify/`

### 3. Sidebar nav generator

Output a snippet that can be merged into `docs.comfy.org`'s `mint.json`
under a new `Extensions API` section. Structure:

```json
{
  "group": "Extensions API",
  "pages": [
    "extensions/api/overview",
    {
      "group": "Core Concepts",
      "pages": [
        "extensions/api/extension",
        "extensions/api/setup",
        "extensions/api/lifecycle"
      ]
    },
    {
      "group": "Handles",
      "pages": [
        "extensions/api/node-handle",
        "extensions/api/widget-handle"
      ]
    },
    { "group": "Events", "pages": [...] },
    { "group": "Shell", "pages": [...] }
  ]
}
```

### 4. Build script wiring

Add to `packages/extension-api/package.json` scripts:

- `"docs:build": "tsx scripts/build-docs.ts"`
- `"docs:watch": "tsx scripts/build-docs.ts --watch"`

## Acceptance criteria

1. `pnpm --filter @comfyorg/extension-api docs:build` produces
   `docs-build/mintlify/` containing one MDX file per top-level public
   type plus an overview page.
2. Frontmatter passes Mintlify schema validation (use `mintlify dev`
   locally or check against `docs/` repo's existing pages).
3. Code examples from TSDoc `@example` blocks render as syntax-
   highlighted TypeScript code blocks.
4. Cross-references between types are clickable links, not raw
   `[NodeHandle]` text.
5. The generated nav snippet is valid JSON and can be merged into
   `mint.json` via a JSON-merge script (out of scope for PKG5; PKG6
   handles the integration).

## What to defer

- Actually opening a PR against `Comfy-Org/docs` — that's PKG6.
- Live preview / hot reload integration with Mintlify — nice to have,
  not blocking.

## Verification commands

```bash
cd ComfyUI_frontend/packages/extension-api
pnpm docs:build
ls docs-build/mintlify/
# Manually inspect 2-3 MDX files for frontmatter + content quality
```

## Report back

Write `plans/prompts/_results/PKG5-summary.md` with:

- Tree of `docs-build/mintlify/` after build
- Sample MDX file contents (the most representative one)
- Generated nav snippet
- Any TypeDoc → Mintlify friction (likely candidates: link resolution,
  custom component support, code-block lang tag)
