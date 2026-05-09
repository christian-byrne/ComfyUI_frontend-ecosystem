---
source_url: https://www.notion.so/comfy-org/ComfyUI-Custom-Node-Frontend-API-Usage-Research-3356d73d365080dbaacafe8e52d52692
date_accessed: 2026-05-08
parent_page: Nodes 2.0 Default UI — DevRel, Docs & Migration
page_date: 2026-04-07
scope: ~58 custom node packages, ~290 frontend JS/TS files
purpose: Ingest quantified API-usage audit into touch-point DB, behavior categories, and API design
---

# ComfyUI Custom Node Frontend API Usage Research — Ingestion Summary

## Source overview

Team-authored Notion page (pre-dates R7 work). Uses local file-walk methodology across ~58 packages,
~290 frontend JS/TS files. Complements R7's MCP code-search and R8's clone-and-grep by providing
hard occurrence counts across a broader package set with a consistent methodology.

## Occurrence counts for existing patterns

These numbers update or confirm blast-radius signals for patterns already in database.yaml.
All should be tagged `source: notion-api-research` when added as evidence rows.

| Pattern | DB ID | Notion count | Notes |
|---|---|---|---|
| `nodeType.prototype.onNodeCreated` | S2.N1 | 135 occ | Larger than any single-pass MCP count |
| `nodeType.prototype.onExecuted` | S2.N3 | 88 occ | Confirms P3 pattern as universal "show output" |
| `nodeType.prototype.onConnectionsChange` | S2.N3/N4 | 64 occ | Six signature variants in wild (D5 smoking gun) |
| `nodeType.prototype.onConfigure` | S2.N7 | 16 occ | Previously evidence-light |
| `graph._nodes` / `graph._nodes_by_id` iteration | S11.G2 | 30 files | Confirms inter-node API gap |
| `graph.beforeChange/afterChange` | S11.G3 | 8 files | Confirms batching API need |
| `LiteGraph.*` constant access | S7.G1 | 313 occ | Largest single-source count; mutations are severity: critical |
| `window.*` access total | S7.G1 | 95 packages | Nearly universal |
| `addDOMWidget` | S4.W2 | widespread | 32 packages widget manipulation |
| `document.createElement("style")` | (new: S16.DOM1) | 354 occ | Style injection — new pattern |
| `document.body.appendChild` | (new: S16.DOM2) | 364 occ | Body injection — new pattern |
| `innerHTML` concatenation | (new: S16.DOM3) | 443 occ | XSS risk — new pattern |
| Direct `fetch()` bypassing `api.fetchApi` | (new: S16.DOM4) | 232 occ | Untracked backend call pattern |
| Custom Vue runtime bundled | (new: S16.VUE1) | 9 packages | Each bundles own copy |
| `LiteGraph.ContextMenu` global replacement | (new: S3.C2) | Easy-Use | Severe: affects all nodes |
| `api.apiURL` patching | (new: S6.A5) | rgthree | Replaces routing globally |
| `settingsLookup` direct mutation | (new: S12.UI2) | Easy-Use | Patches other extensions' settings |
| `app.registerExtension` | S1.* | 53/58 packs (88%) | Baseline adoption confirmed |
| `beforeRegisterNodeDef` | S1.H5/H6 | 110+ occ | Highest-frequency lifecycle hook |
| `nodeCreated` | S2.N1 | 43 occ | Less than beforeRegisterNodeDef |
| Legacy import `../../scripts/app.js` | S7.G1 | 142 occ | vs 26 modern window.comfyAPI |
| `chainCallback` reimplemented | S4.W1 | 5+ packages | Independently reimplemented — DEP2 evidence |
| `LGraphCanvas.prototype.*` patches | S3.C1 | 5 packages | Rare but maximally destructive |
| node.size[] direct write | S10.D3 | 57 files | Confirms computeSize/setSize blast |
| `onResize` patching | S2.N19 | 24 files | Previously evidence-light |
| `ResizeObserver` usage | (informational) | 5 files | Some use native observer instead |

## Most destructive packages (§3 ranked list)

Direct input for blast-radius weight calibration:

1. **ComfyUI-Easy-Use** — replaces `drawNodeShape` (300 lines), `drawNodeWidgets`, `pasteFromClipboard`,
   `ContextMenu`; mutates `LiteGraph` constants; patches other extensions' `settingsLookup` onChange
2. **rgthree-comfy** — patches `LGraph.prototype.serialize`, all mouse events, `api.apiURL`; 100+ frontend files
3. **comfyui-mixlab-nodes** — heavy DOM manipulation, window globals, 27 frontend files
4. **ComfyUI-Impact-Pack** — `graph._nodes_by_id`, link traversal, 7 frontend files
5. **ComfyUI-AnimateDiff-Evolved** — prototype patching, DOM-based preview embedding

## New patterns to add to database.yaml

### S16 — DOM injection (new surface family)

These are untracked. Occurrence counts are large enough (354–782) to warrant their own family.

- **S16.DOM1** `document.createElement("style") + head.appendChild` — style injection, 354 occ, 81 packages.
  v2 replacement: `extensionManager.injectStyles(css)` (proposed, not yet designed).
  severity: moderate (styles conflict, no cleanup on extension disable)
- **S16.DOM2** `document.body.appendChild` — arbitrary DOM into body, 364 occ.
  severity: moderate (breaks on DOM restructures)
- **S16.DOM3** `innerHTML` concatenation — 443 occ.
  severity: high (XSS risk when user-controlled content involved)
- **S16.DOM4** direct `fetch()` bypassing `api.fetchApi` — 232 occ.
  v2 replacement: `api.fetchApi()` with typed wrapper (already S6.A3 adjacent but distinct: no auth headers, no error normalization)
  severity: moderate (auth + CORS edge cases)

### S16.VUE1 — Bundled Vue runtime

- **S16.VUE1** — 9 packages each bundle their own full Vue runtime inside DOM widgets.
  v2 replacement: `registerVueWidget(nodeType, name, Component)` sharing host Vue instance.
  severity: moderate (bundle bloat, lifecycle mismatch, no access to host stores/i18n)

### S3.C2 — Global ContextMenu replacement (upgrade to existing S3)

- **S3.C2** `LiteGraph.ContextMenu = function(...) {...}` — complete replacement of the global
  ContextMenu constructor. Evidenced: ComfyUI-Easy-Use.
  severity: critical (only last-writer wins; cannot be detected or managed)
  v2 replacement: declarative menu contribution API

### S6.A5 — api.apiURL patching

- **S6.A5** `api.apiURL = function(route) {...}` — patches the URL-building method to intercept
  specific route prefixes (rgthree uses for `/rgthree/*` routing).
  severity: high (global; only last-writer wins)
  v2 replacement: formal custom backend route registration API

### S12.UI2 — settingsLookup direct mutation

- **S12.UI2** `app.ui.settings.settingsLookup['Comfy.X'].onChange = ...` — replaces another
  extension's onChange handler by reaching into internal settings registry.
  Evidenced: ComfyUI-Easy-Use targeting `Comfy.UseNewMenu`.
  severity: high (cross-extension state corruption; silently breaks the other extension)
  v2 replacement: settings isolation / immutable handles

## Vue composables section (§6) — maps to I-SR / I-API

§6 identifies four composables derivable immediately from existing frontend observation code.
These map directly to our API design work:

| Composable | Notion evidence | Maps to |
|---|---|---|
| `useNodeSize()` | 57 files need it; frontend already observes | I-API, BC.04, BC.05 |
| `useNodeExecutionOutput()` | 88 `onExecuted` patches | BC.16, S2.N3 |
| `useNodeConnections()` | 64 `onConnectionsChange` patches | BC.07, S2.N3/N12/N13 |
| `useNodeLifecycle()` | replaces prototype patching | BC.01, BC.02, I-SR |

These composables are explicitly listed as "APIs We Can Provide Immediately" — strongest
existing-system evidence for the I-SR lifecycle scope design being on the right track.

## Governance findings (§2.15, §5.4)

Not a touch-point pattern but relevant for P2/PKG plan and security scan:

- Third-party `comfy-*` / `comfyui-*` PyPI namespace squatting (comfy-env, comfy-3d-viewers,
  comfy-sparse-attn) — supply chain trust risk
- PyPI packages injecting frontend JS assets outside `web/` directory
- Relates to R9 security scan findings; no action needed in this project but worth flagging to Jacob

## New behavior category candidates

The DOM injection family (S16) warrants a new BC:

- **BC.31 — DOM injection and style management**: style tags, body appends, innerHTML, external
  script loading. 354–782 occurrence range. Currently untracked in any BC.
  Intent: extensions add UI chrome and style overrides outside any provided API.
  v2 replacement direction: `extensionManager.injectStyles()`, scoped style API, UI injection points.

The Vue runtime bundling (S16.VUE1) fits into a new or extended BC:
- Could extend BC.05 (Custom DOM widgets) or add **BC.32 — Embedded framework runtimes**
  Intent: extensions ship their own copy of Vue/React to render widget UI, bypassing host instance.

## Cross-references

- `research/touch-points/database.yaml` — add evidence rows for S16.*, S3.C2, S6.A5, S12.UI2
- `research/touch-points/behavior-categories.yaml` — add BC.31 (DOM injection), update BC.06 (S3.C2)
- `todo.md` — new task I-N4.1: merge Notion evidence into database.yaml
- `decisions/D7-widget-shape-and-persistence.md` — Vue composables section informs WidgetHandle design
- `plans/P1-comfy-extension-v2-api.md` — `useNodeSize`, `useNodeExecutionOutput` should appear in v2 composables
- `research/touch-points/staging/` — Notion occurrence counts as evidence staging
