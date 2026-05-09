---
source: file://ComfyUI_frontend/docs/extensions/development.md
date_accessed: 2026-05-06
ingested_by: subagent (doc-ingestion)
---

# Extension Development Guide

## Summary

`docs/extensions/development.md` is the conceptual orientation doc for anyone
writing or testing a ComfyUI extension. It does three things: (1) it defines
the **terminology** — distinguishing Python custom nodes (backend) from
JavaScript extensions (frontend) and clarifying that the umbrella term
"ComfyUI Extension" covers both; (2) it explains **how extensions are loaded**
in production (the `/extensions` API → `app.registerExtension()` pipeline,
backed by a Vite-built shim layer that re-exports core modules through
`window.comfyAPI`); and (3) it explains **why the dev server cannot serve
custom-node JavaScript** and what workarounds exist (develop as a core
extension, run a production build, or point at staging). The doc is implicitly
a living artifact of legacy decisions: the entire `window.comfyAPI` shim
exists because the TypeScript/Vite migration could not break the unbundled
import patterns thousands of extensions depend on. For our v2 design effort,
this file is the clearest statement of the *transport-layer* contract we
inherit, separate from the hook-surface contract documented in `core.md`.

## Public API surface mentioned

### Loader / runtime contracts

| Symbol / Endpoint | Shape | Notes |
| ----------------- | ----- | ----- |
| `app.registerExtension(...)` | Method on global `app` | Same entry point as `core.md`; here described as *the* hook-attachment call invoked at extension import time. |
| `GET /extensions` | HTTP API on the ComfyUI server | Returns the list of JavaScript files the frontend should fetch. |
| `/extensions/<package-name>/<file>.js` | Served JS asset | Each entry from `/extensions` is fetched and `<script>`-evaluated by the frontend. |
| `/web/extensions/*.js` | Legacy on-disk path | Older extension location, still scanned by the server. |
| `/custom_nodes/*/web/*.js` | Per-node-package on-disk path | The recommended modern path for node-package-shipped JS. |
| `WEB_DIRECTORY` export in `__init__.py` | Python-side export | Lets a custom-node package nominate an arbitrary directory as its JS root; documented in the linked backend lifecycle docs. |
| `window.comfyAPI` | Global object on `window` | Production-build shim namespace. Every internal module's exports are bound here so legacy extensions can `import` from `/scripts/<name>.js` and get the bundled implementation back. |
| `window.comfyAPI.modules['/scripts/<name>.js']` | Indexed module record | The exact lookup form the generated shims use. |
| `/scripts/api.js`, `/scripts/app.js`, etc. | Generated shim files | Re-export everything from `window.comfyAPI.modules['<self-path>']`. |
| `import { app } from '/scripts/app'` | Legacy import idiom | Documented as the import pattern extensions use; works in production via shim. |
| `import { api } from '/scripts/api'` | Legacy import idiom | Same as above. |
| `import { app } from '../../scripts/app'` | Relative-path import | The form recommended when developing inside `src/extensions/core/`. |
| `import { api } from '../../scripts/api'` | Relative-path import | Same. |
| `src/extensions/core/index.ts` | Aggregator module | Where new core extensions must be added to be picked up. |
| `DEV_SERVER_COMFYUI_URL` | `.env` variable | Lets dev mode point at staging or another backend so cloud extensions resolve. |
| `ComfyExtension` interface | TypeScript symbol in `src/types/comfy.ts` | Cited as "defines all available hooks for extending the frontend." |

### Build / dev-flow commands

| Command | Purpose |
| ------- | ------- |
| `pnpm build` | Full production build; generates the shim layer; only mode in which custom-node JS will load. |
| `pnpm exec vite build --watch` | Faster rebuild loop, still no HMR; used when iterating on custom-node JS. |

## Recommended patterns

### Where to put extension code

The doc treats location as a first-class architectural decision:

- **Core extensions** live in `/src/extensions/core/` and are bundled. Always
  available, no network round-trip.
- **Custom node JavaScript** lives next to the Python package, under `/web/`
  or `/js/`, or wherever `WEB_DIRECTORY` points. Loaded dynamically at runtime
  via `/extensions`.

### "Develop as a Core Extension" (Option 1, Recommended)

The doc names this as the **preferred** workflow for active development on a
custom-node JS module. Cited code:

```javascript
import { app } from '../../scripts/app'
import { api } from '../../scripts/api'
```

Steps the doc prescribes:

1. Copy your extension to `src/extensions/core/`.
2. Rewrite imports to relative paths (the snippet above).
3. Add an entry to `src/extensions/core/index.ts`.
4. Iterate with hot reload working.
5. Move it back to its real package location when complete.

### Production-build iteration (Option 2)

```bash
pnpm build
```

For tighter loops:

```bash
pnpm exec vite build --watch
```

The doc is explicit that watch mode "provides faster rebuilds than full
builds, but still no hot reload."

### Cloud / staging backend (Option 3)

```
DEV_SERVER_COMFYUI_URL=http://stagingcloud.comfy.org/
```

For extensions whose backend lives in a cloud environment.

### The shim contract (illustrative, not normative)

The doc walks through the production shim by example to show why legacy
imports keep working:

```javascript
// Original source: /scripts/api.ts
export const api = { }

// Generated shim: /scripts/api.js
export * from window.comfyAPI.modules['/scripts/api.js']

// Extension imports work unchanged:
import { api } from '/scripts/api.js'
```

This is presented as the **mechanism** that preserves the public import
surface across the TS/Vite migration.

## Anti-patterns / warnings

- **Do not assume the dev server can load your custom-node JavaScript.** The
  doc is explicit: "JavaScript extensions require workarounds or production
  builds." Trying to develop directly against `pnpm dev` for a third-party
  custom node will silently produce a frontend with no extension loaded.
- **Do not rely on real-time shim generation.** The doc explains why this is
  not implemented: "Creating real-time shims would require intercepting every
  module request — this would defeat the purpose of a fast dev server." This
  is a load-bearing architectural decision; v2 should not assume it can be
  reversed cheaply.
- **Do not transform `node_modules` in unbundled mode.** The doc cites
  Vite's refusal to do this as one constraint that forced the shim approach.
- **The `window.comfyAPI` global is the entire backwards-compatibility
  surface.** Removing or renaming any `comfyAPI.modules['/scripts/...']` key
  silently breaks any extension that imports from the corresponding legacy
  path. This is a hidden compatibility envelope.
- **Custom-node JS may exist without Python.** "A custom node package can
  have both, just Python, or (rarely) just JavaScript." v2 must not assume
  every JS extension has a backend correlate.
- **Legacy `/web/extensions/` path still works.** The server still scans
  this; deprecating it is a breaking change for any extension that ships
  there.

The doc does **not** explicitly warn about (but the v2 design must address):

- `useChainCallback` — not mentioned by name.
- Monkey-patching `LGraphNode.prototype` or `app.graph` — not warned against.
- Widget callback chaining — not warned against.
- Multiple extensions racing on the same hook — no guidance.
- Extension teardown / unload — no guidance, no API mentioned.

## Implications for v2 API design

1. **The transport contract is independent of the hook contract.** The
   `/extensions` endpoint, dynamic JS evaluation, and the `window.comfyAPI`
   shim layer are a *delivery* surface; `app.registerExtension()` and the
   hook list are a *behavior* surface. v2 can replace one without the other.
   The cleanest staged migration likely keeps the transport intact while
   evolving the behavior surface.

2. **`window.comfyAPI` is a permanent compatibility wedge.** Any v2 module
   layout that wants to be safely consumable from legacy extensions must
   continue to register its public symbols under `window.comfyAPI.modules`
   for the legacy import paths.

3. **The "develop as a core extension" workaround is a tell.** That the
   recommended dev loop requires moving code into the host repo means there
   is *no real third-party developer experience*. v2 should fix this — at
   minimum a documented mechanism to load an unbundled, file-watched
   third-party JS bundle into the dev server.

4. **The `/extensions` API is the registry.** A v2 extension manifest format
   (capabilities, hook subscriptions, declared widget types, peer
   dependencies, semver) should be served through this same endpoint to
   preserve drop-in compatibility while enabling richer metadata.

5. **`WEB_DIRECTORY` is the Python-side coupling point.** Any v2 packaging
   story (manifest, multi-file modules, ESM-native distribution) must map
   cleanly to what backend authors already export.

6. **Cloud-backed extensions are a real first-class case** (Option 3). v2
   should not assume frontend and backend are co-located.

7. **No teardown surface today.** Combined with `core.md`, this is the
   second doc to omit a `dispose` / `unload` story. v2 should make extension
   lifecycle (register, suspend, dispose) explicit, especially for hot
   reload of third-party code.

8. **The doc is silent on monkey-patching even while implicitly endorsing it
   via the "develop as core extension" workflow** — core extensions in
   `src/extensions/core/` *do* prototype-patch. v2 must replace each
   legitimate prototype-patching use case in the existing core inventory or
   the workaround keeps regenerating the anti-pattern.

9. **Treat the import-path surface as public API.** Every legacy import path
   used by an extension (`/scripts/app`, `/scripts/api`, etc.) is a public
   contract enforced by the shim layer. v2 module reorganization must
   maintain or alias these paths.
