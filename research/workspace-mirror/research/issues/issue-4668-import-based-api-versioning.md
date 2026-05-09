---
source_url: https://github.com/Comfy-Org/ComfyUI_frontend/issues/4668
branch_url: https://github.com/Comfy-Org/ComfyUI_frontend/tree/feat/import-based-api-versioning
branch_sha: 97547434b02e0a4503973398093d00c674fc7ccf
date_accessed: 2026-05-08
author: christian-byrne (issue author + commenter)
status: open
labels: developer experience, Public API, area:vue-migration
---

# Issue #4668 — Create sustainable extension API v2 with import-based versioning and compatibility layer

## Issue summary

Proposes a parallel approach to the v2 extension API. Two deliverables:

1. **Import-based versioning** — extensions choose their API version at import time:
   ```ts
   import { app } from '@/scripts/app/v1_2'  // versioned path
   import { app } from '@/scripts/app'        // latest / default
   ```
2. **Compatibility layer** — proxy-based bidirectional data transformation so v1
   extensions continue to receive v1-shaped args even as internal data migrates to
   canonical/v3 format.

Christian's own comment on the issue:
> "Decide now what is likely to stay public and stable and what is slated for
> change/removal — then remove those things from the docs and start communicating
> future deprecation now."

## Prototype branch: `feat/import-based-api-versioning`

### What is actually implemented (not just designed)

`src/services/extensionService.ts` extends the existing service with:

- `registerExtensionWithVersion(extension, apiVersion)` — tags each extension with
  its declared API version (defaults to `'latest'`).
- `invokeExtensionsForVersion(hook, apiVersion, ...args)` — dispatches a hook call
  only to extensions registered at a given version, with args transformed via proxy.
- `invokeExtensionsForAllVersions(hook, ...args)` — fans out across `['latest', 'v1',
  'v1_2', 'v3']`, running each version's extensions concurrently.
- `transformArgsForVersion(version, args)` — detects node-definition objects by duck
  type (`arg.name: string`) and wraps them in `VersionProxies.createV1Proxy(name)` /
  `createV1_2Proxy` / `createV3Proxy` before passing to extensions.
- `getExtensionVersionReport()` — groups registered extensions by `ext.apiVersion`;
  returns `{ total, versionGroups, details }`. The telemetry primitive D6 Phase D
  needs.

`VersionProxies` class (`src/utils/versionProxies.ts` — not read, referenced by
service) implements Proxy-based canonical↔v1/v1_2/v3 field mapping with bidirectional
`get`/`set` traps and a shared `EventTarget` for change notification.

`frontend-v3-compatibility-plan.md` (checked in on branch) is a full architecture doc
covering the four phases and including type definitions for `ComfyNodeDefV1`,
`ComfyNodeDefV1_2`, `ComfyNodeDefV3`, and the transform pipeline.

### What is NOT implemented on the branch

- No new `browser_tests` for v2 API surface — `extensionAPI.spec.ts` is the existing
  v1 test suite (topbar commands, keybindings, settings, dialogs). No test exercises
  the versioned dispatch path.
- No `@/scripts/app/v1.ts`, `@/scripts/app/v1_2.ts` entry-point files — the plan
  describes them but they don't appear in the tree.
- No type definitions under `src/types/versions/` — plan only.
- `extensionTypes.ts` unchanged from main — no v2 types added.

## Architecture comparison vs our D3.3 / D6 decisions

| Dimension | Branch approach | Our decisions |
|---|---|---|
| Entry point | `import { app } from '@/scripts/app/v1_2'` (internal path) | `import { defineExtension } from '@comfyorg/extension-api'` (published pkg, D6) |
| Window.app dependency | Still `app.registerExtension(...)` at call site | Module-level import, no window.app at reg time (D6 user constraint) |
| Subscription model | "Signals-driven" (issue body) | Events/callbacks (D3.3) |
| Node access | Proxy over `ComfyNodeDef` schema data | `NodeHandle` backed by ECS World (D3.4) |
| Scope of the compat layer | `beforeRegisterNodeDef` args only (schema proxy) | Full lifecycle scope: ECS components, reactive dispatch, EffectScope (D3.5, D9) |
| Telemetry | `getExtensionVersionReport()` — works today | D6 Phase D gated on telemetry; no impl yet |
| Published npm package | No | Yes — `@comfyorg/extension-api` (PKG2–PKG6) |

## Extractable lessons

### Lesson 1 — `VersionProxies` is a reference impl for I-PG.C1

The Proxy-based canonical↔version transformation is the concrete shape of what D9's
Phase C "legacy-API strangler" needs: v1 extensions receive v1-shaped hook args even
after internals migrate. When I-PG.C1 lands, `VersionProxies` (or its ECS-adapted
equivalent) is the mechanism. Study `createV1Proxy` / `transformCanonicalToV1Property`
at that time.

### Lesson 2 — `getExtensionVersionReport()` is free telemetry

Grouping extensions by `ext.apiVersion` is a one-liner once each extension declares
its version at import time. D6 Phase D (v1 sunset) is gated on "<5% v1 usage".
`getExtensionVersionReport().versionGroups['latest' | 'v1']` is exactly the signal
needed. We should include a compatible field (`apiVersion`) on `ExtensionOptions` in
our D6 implementation.

### Lesson 3 — `transformArgsForVersion` duck-type detection is fragile

The branch detects "this arg is a node def" by `arg.name: string` — which matches any
object with a string `name` property. In our ECS-backed system the equivalent transform
should key on `NodeEntityId` (branded number) rather than a shape-based heuristic.
Avoids false-positive proxy wrapping.

### Lesson 4 — Import-path versioning is not a published API

`@/scripts/app/v1_2` is a Vite internal alias, not an npm-consumable import. External
custom node authors can't write `import { app } from '@/scripts/app/v1_2'` — they'd
need to bundle against the frontend source. The branch approach only solves
*internal* extension versioning (extensions bundled with the frontend). Our D6
`@comfyorg/extension-api` npm package solves the external author case.

### Lesson 5 — The v2 combo input fixture is a useful test seed

`browser_tests/assets/node_with_v2_combo_input.json` contains a workflow with a
`DevToolsNodeWithV2ComboInput` node (type: `COMBO`, single widget value `"A"`). Useful
as a test fixture for I-TF.3 (test harness) to exercise widget value access / schema
inspection through `NodeHandle.widget("...")`. SHA of the fixture JSON:
```json
{ "type": "DevToolsNodeWithV2ComboInput", "widgets_values": ["A"] }
```

### Lesson 6 — `invokeExtensionsForAllVersions` fan-out pattern

Running all four version groups concurrently (`Promise.all`) is a correct fan-out
pattern for hook dispatch if the hooks are independent. In our system D10b (hook
ordering = registration order) means serial dispatch within a version group — but
*cross-version-group* dispatch could still fan out. Worth noting for I-SR.3
(reactive dispatch wiring).

## What this approach does NOT solve (and we shouldn't adopt)

- **No lifecycle scope / EffectScope** — extensions still have no teardown story;
  `app.registerExtension(...)` has no `scope.stop()` equivalent. Our D2/D3.5/I-SR
  design is strictly superior for extension cleanup.
- **Still `window.app` dependent** — the user explicitly rejected this in D6.
- **Signals-driven** — contradicts D3.3 (events over signals), which was grounded
  in R4 evidence that `api.addEventListener` already works at scale in the ecosystem.
- **No ECS integration** — the proxy wraps schema data only; runtime node state
  (position, mode, widgets, connections) is still accessed via LGraphNode. Our
  `NodeHandle` design covers all of these.

## Notion audit report (referenced from issue body)

URL: `https://file.notion.so/f/f/54cc0cde-b5c6-44cc-9e1c-6d0a4b1f40bc/...`
Status: **HTTP 400 / authentication required** — could not fetch. If accessible,
likely contains the ~58-package prototype usage audit. Would be a useful R7/R8 cross-
check if the user can share a local copy or grant Notion access.
