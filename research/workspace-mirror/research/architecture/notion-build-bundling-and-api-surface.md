---
source_url: https://www.notion.so/comfy-org/ComfyUI_frontend-Public-API-Surface-2576d73d365080fbb80edf6b03385758
source_url_2: https://www.notion.so/comfy-org/28e6d73d3650802e9374df5664e4dfe3
date_accessed: 2026-05-08
ingestion_task: manual (user-provided Notion link)
status: ingested
---

# Notion: ComfyUI Frontend Public API Surface + Build/Bundling Architecture

Two Notion pages under `Engineering → Frontend` in comfy-org's workspace.

---

## Page 1 — "ComfyUI_frontend Public API Surface"

Internal team doc defining the *intended* public API boundary.

### Key statements

- The entire public API surface is defined in `src/types/index.ts`, which also builds the npm types package.
- **"Anything outside of this or outside the interfaces we should feel comfortable to change."**
- Three enumerated entry points:
  1. **Extension Manager** (`extensionTypes.ts:102-115`) — shell UI (toasts, sidebar, bottom panel).
  2. **Comfy Extension Interface** (`comfy.ts:44-170`) — node editor hooks, registered once via `registerExtension`.
  3. **ComfyApi class** (`api.ts:242`) — client/server comms, websocket events.

### Relevance to this project

The stated intent ("anything outside `types/index.ts` is safe to change") directly contradicts the ecosystem reality documented in R7's 56 patterns — where extensions reach deep into LGraphNode prototypes, canvas, graph internals, and window globals that are nowhere near `types/index.ts`. **This gap is the primary justification for our project's existence.** The team's own written stance says the monkey-patching ecosystem is operating outside the official contract, which means v2 can deprecate any of those 56 surfaces with a migration shim and be technically within policy — but the practical blast radius (up to ★17k for S6.A1 graphToPrompt) means the migration still needs careful phasing per D6.

Cited commit: `84e7102f70f66881aa4a892a613c93a7f63335ea` (~Aug 2025, ~9 months before today).

---

## Page 2 — "Evolution of Frontend Build/Bundling" (TREE_SHAKING_ANALYSIS.md)

Detailed internal analysis of the build system, its constraints, and the migration path. This is directly relevant to how `@comfyorg/extension-api` (PKG3) must be shipped and how D6's migration phases work in practice.

### The shim architecture (current state = Scenario 2)

Extensions currently import frontend code via relative paths:
```js
import { api } from '../../scripts/api.js'
```

This works via a shim system built by `build/plugins/comfyAPIPlugin.ts`:

1. For every exported symbol in `src/scripts/api.ts` (and similar files), the plugin appends:
   ```ts
   window.comfyAPI = window.comfyAPI || {}
   window.comfyAPI.api = window.comfyAPI.api || {}
   window.comfyAPI.api.api = api
   window.comfyAPI.api.ComfyApi = ComfyApi
   ```
2. The plugin emits shim files at `dist/scripts/api.js`:
   ```js
   export const api = window.comfyAPI.api.api
   export const ComfyApi = window.comfyAPI.api.ComfyApi
   ```
3. Extensions load the shim via relative path; the shim reads from the window bindings already populated by the main bundle.

**This is the concrete mechanism behind S7.G1** ("window.LiteGraph / window.comfyAPI globals") in the R7 touch-point database. Extensions that do `import { api } from '../../scripts/api.js'` are silently going through this shim. Extensions that do `window.comfyAPI.api` directly skip even the shim. Both patterns are load-order-dependent on the main bundle executing first.

### Why tree-shaking and minification are disabled

Two `vite.config.mts` settings that cannot change without breaking the ecosystem:

```ts
// vite.config.mts:173-176
rollupOptions: {
  treeshake: false  // CRITICAL — cannot enable without breaking shims
}

// vite.config.mts:180-184
esbuild: {
  minifyIdentifiers: false,
  keepNames: true  // CRITICAL — window bindings use original identifier names
}
```

**If tree-shaking is enabled:** A symbol used only by extensions (not by core) gets removed from the bundle. The window binding for it is never created. The shim file still exports `window.comfyAPI.utils.formatUtil` — which is now `undefined`. Silent runtime failure.

**If minification is enabled:** The plugin runs at transform time (before minification), sees `api` and binds `window.comfyAPI.api.api = api`. Then the minifier renames `api` → `a`. The binding references the original name: `ReferenceError`. Build fails or bindings are undefined.

### Bundle size consequence

| Scenario | Bundle | Gzipped | Extensions |
|---|---|---|---|
| Current (shims, no optimization) | 13.3MB | 2.8MB | ✓ |
| With tree-shaking | 11MB | 2.3MB | ✗ broken |
| With minification | 9MB | 1.9MB | ✗ broken |
| Future migrated state | 7MB | 1.5MB | ✓ after migration |

~45% bundle size reduction is on the table but gated on the full migration.

### Scenario 5 — The future state (maps directly to D6 + PKG3)

The doc describes a future where extensions use package imports resolved via import maps:

```js
// Extension code (future)
import { api } from '@comfyui/api'
```

```html
<!-- index.html (future) -->
<script type="importmap">
{ "imports": { "@comfyui/api": "/assets/api.mjs" } }
</script>
```

This is structurally identical to what `@comfyorg/extension-api` (PKG3) is building. The import map mechanism is how extensions get a stable, versioned API surface without relative-path hacks.

The doc's migration phasing maps to D6:

| Doc phase | D6 equivalent |
|---|---|
| Dual mode (`apiVersion: 2.0` in manifest → server serves modern or legacy bundle) | D6 Phase B/C — parallel paths |
| Deprecation warnings in legacy shims (`console.warn('Deprecated import path')`) | D6 Phase C |
| Hard cutoff (18–24 months, remove shims) | D6 Phase D (gated on telemetry + <5% v1 usage) |

The doc explicitly says "18–24 month migration, extension author effort" — this should inform D6's Phase D timeline estimate.

### `@public` annotation strategy (near-term action)

The doc's "incremental approach" recommends annotating exports that must be preserved:

```ts
/** @public Used by extensions - preserve */
export const api = new ComfyApi()
```

Then a custom Rollup plugin preserves `@public` exports from tree-shaking while allowing the rest to be optimized (~5-10% savings with zero breakage).

**This is directly relevant to PKG2/R10**: when we audit `src/types/index.ts` for orphan exports (R10), any export that the ecosystem uses but that isn't in the official three-entry-point surface needs a `@public` annotation or it will silently break once the team re-enables tree-shaking. The R10 orphan audit effectively produces the `@public` annotation list.

### Critical implication for S7.G1 ("window globals" touch point)

The shim architecture means **the window.comfyAPI global IS the officially-supported backward-compat mechanism**, not an accidental leak. The team deliberately chose to expose symbols via `window.comfyAPI.*` to support legacy extensions. This upgrades S7.G1 from "accidental surface" to "intentional compat surface with a known migration path." The v2 deprecation of S7.G1 therefore requires shipping the import-map alternative first (PKG3/PKG6), then adding the deprecation warnings (D6 Phase C), with the hard cutoff at Phase D — exactly as D6 specifies. The 18–24 month timeline from the doc is the lower bound.

### Implication for `@comfyorg/extension-api` packaging (PKG3)

PKG3 must ship as both:
1. A proper npm package (`@comfyorg/extension-api`) for extension authors who use bundlers.
2. A pre-built ESM file served via import map for the legacy browser-extension loading path.

The shim plugin in `build/plugins/comfyAPIPlugin.ts` would need to emit shims for `@comfyorg/extension-api`'s exports as well (during the parallel-paths phase), so extensions that import the package via relative path also work. Or alternatively, the import map is the canonical path and relative-path imports are not supported for the new API. The doc suggests the import-map approach is the right call.

---

## Summary of what's new vs what we already had

| Finding | New? | Where it improves existing work |
|---|---|---|
| `types/index.ts` = official boundary, rest is "safe to change" | Confirms + sharpens R7's thesis | Strengthens D6's case that 56-pattern deprecations are within policy; add to CONTEXT.md |
| Three official entry points (Extension Manager, ComfyExtension, ComfyApi) | Confirms S1/S5/S12 in R7 | No new patterns; confirms existing categorization |
| Shim architecture: `comfyAPIPlugin.ts` + `window.comfyAPI.*` | **NEW detail** | Concrete mechanism behind S7.G1; upgrades it from "accidental" to "intentional compat surface" |
| `treeshake: false` + `keepNames: true` as ecosystem compat constraints | **NEW** | Informs PKG3 packaging; explains why no `@public` annotation system exists yet |
| Scenario 5 / import-map migration = D6 analog | **NEW alignment** | Confirms D6 phasing; 18–24 month timeline is the lower bound for Phase D |
| `@public` annotation → custom tree-shaking plugin | **NEW action item** | R10 orphan audit = `@public` annotation list; note in R10 deliverable |
| PKG3 must emit shims or use import maps for legacy path | **NEW constraint** | Adds a sub-requirement to PKG3 prompt (`plans/prompts/PKG3-npm-package.md`) |
