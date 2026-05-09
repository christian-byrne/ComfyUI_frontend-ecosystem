---
source: file://ComfyUI_frontend/docs/extensions/core.md
date_accessed: 2026-05-06
ingested_by: subagent (doc-ingestion)
---

# Core Extensions Reference

## Summary

`docs/extensions/core.md` documents the **current** ComfyUI frontend extension
model: a registration-based, hook-driven system where extensions are JavaScript
modules registered via `app.registerExtension()`. The doc inventories ~23
shipped "core" extensions that live inside the frontend bundle at
`src/extensions/core/`, lists the canonical lifecycle hooks an extension may
implement, and prescribes the order those hooks fire in three scenarios (page
load, workflow load, single-node add). It explicitly tells extension authors to
prefer hooks over directly modifying core objects and points readers to the
`ComfyExtension` TypeScript interface in `src/types/comfy.ts` as the source of
truth. For our v2 API design effort this file is the authoritative public
listing of the current API surface and the implicit contract that 40+ custom
node repos depend on.

## Public API surface mentioned

### Registration entry point

| Symbol | Shape | Notes |
| ------ | ----- | ----- |
| `app.registerExtension(ext: ComfyExtension)` | Method on the global `app` singleton | The single documented entry point for any extension. Takes an object literal carrying a `name` and any subset of the lifecycle hooks below. |

### Lifecycle hooks (the "ComfyExtension interface")

The doc enumerates these hooks in two places: the **execution-sequence
diagrams** (which establish ordering guarantees) and the **Key Hooks** table
(which gives one-line descriptions). Combined surface:

| Hook | Fires | Purpose per docs |
| ---- | ----- | ---------------- |
| `init` | First on page load, after canvas creation | Pre-node setup |
| `addCustomNodeDefs` | After `init` | Inject node definitions before registration |
| `getCustomWidgets` | After `addCustomNodeDefs` | Contribute custom widget constructors |
| `beforeRegisterNodeDef(nodeType, nodeData, app)` | Repeated, once per node type | Mutate / wrap a node class before it is registered |
| `registerCustomNodes` | After all `beforeRegisterNodeDef` calls | Register additional node classes directly |
| `beforeConfigureGraph` | Before a graph is loaded/configured | Pre-load hook |
| `nodeCreated` | After a node's constructor runs | Mutate per-instance node state |
| `loadedGraphNode` | When a node is reloaded from a serialized graph | Per-node post-load |
| `afterConfigureGraph` | After graph configure finishes | Post-load hook |
| `setup` | Last on page load | Application is fully running |
| `getSelectionToolboxCommands` | On demand | Contribute commands to the selection toolbox |

The doc explicitly states this is **not exhaustive** — for the full surface it
defers to the `ComfyExtension` interface in `src/types/comfy.ts`.

### Hook execution sequences

Three explicit ordering contracts are documented. Extensions in the wild rely
on these orderings.

**Web page load:**

```
init
addCustomNodeDefs
getCustomWidgets
beforeRegisterNodeDef    [repeated multiple times]
registerCustomNodes
beforeConfigureGraph
nodeCreated
loadedGraphNode
afterConfigureGraph
setup
```

**Loading a workflow:**

```
beforeConfigureGraph
beforeRegisterNodeDef   [zero, one, or multiple times]
nodeCreated             [repeated multiple times]
loadedGraphNode         [repeated multiple times]
afterConfigureGraph
```

**Adding a new node interactively:**

```
nodeCreated
```

### Inventory of core extensions (the "shadow API")

These are not third-party-facing API but the file lists them as the de-facto
reference implementations of how the hook system is used. Each is one
"extension" implemented against the same surface third-party authors must use.

Categories present: Image, UI, Prompts, Text, Platform, Graph, 3D, Templates,
Preview, Input, Nodes, Audio, Media, Widgets, Core. Notable entries:

- `widgetInputs.ts` (Widgets) — implements custom widget input types; the
  reference for widget-related patterns we will likely need to replace.
- `groupNode.ts`, `groupNodeManage.ts`, `groupOptions.ts` (Graph) — three
  cooperating extensions that mutate node behavior; example of cross-extension
  state coupling.
- `rerouteNode.ts`, `noteNode.ts` (Graph) — `registerCustomNodes` consumers.
- `slotDefaults.ts` (Nodes) — reaches into node slot defaults.
- `clipspace.ts`, `maskeditor.ts`, `uploadImage.ts`, `uploadAudio.ts`,
  `webcamCapture.ts`, `saveImageExtraOutput.ts` — UX surface around node I/O.
- `electronAdapter.ts` — environment-specific shim, illustrates that "core
  extension" is also being used as a polyfill seam.
- `load3d.ts`, `saveMesh.ts` plus the `conditional-lines/`, `Lines2/`,
  `threejsOverride/` subtrees — shows extensions can ship file trees of
  helpers, not just a single module.

## Recommended patterns

The doc's "Extension Development" section codifies five soft rules:

1. **Use provided hooks rather than directly modifying core application
   objects.** This is the single most important normative claim in the file.
2. **Maintain compatibility with other extensions.**
3. **Follow naming conventions for both extension names and settings.**
4. **Properly document extension hooks and functionality.**
5. **Test with other extensions to ensure no conflicts.**

### Canonical registration shape

The only code example in the file is a registration skeleton:

```javascript
app.registerExtension({
  name: 'MyExtension',

  // Hook implementations
  async init() {
    // Implementation
  },

  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    // Implementation
  }

  // Other hooks as needed
})
```

This establishes:
- Extensions are **single object literals** with a string `name` and arbitrary
  hook properties.
- Hooks may be `async`. The hook execution sequences imply the host awaits
  them (otherwise ordering guarantees could not hold).
- `beforeRegisterNodeDef` receives the **node class** (`nodeType`), the **raw
  node definition payload** (`nodeData`), and the `app` singleton — i.e. the
  host hands the extension everything it needs to monkey-patch.

## Anti-patterns / warnings

The doc is light on explicit warnings, but the following are stated or
strongly implied:

- **"Extensions should avoid directly modifying core objects where possible"**
  — listed under "key principles" of the architecture (principle #3:
  *Non-intrusive*). This is the closest thing to a discouragement of
  monkey-patching, but it is hedged with "where possible," which the
  development guide and existing core extensions routinely treat as
  permission.
- **No hook list in this doc is authoritative.** The doc explicitly says the
  table is partial and points at `ComfyExtension` in `src/types/comfy.ts`. Any
  v2 contract that wants to be authoritative must replace that pointer.
- **Implicit warning about hook ordering.** The three sequence blocks are
  presented as facts, not as best-effort. Extensions in the wild will break if
  ordering changes — this is an undocumented backward-compat constraint we
  inherit.

The doc does **not** warn about:

- `useChainCallback` (not mentioned).
- Prototype access on `nodeType` / `LGraphNode` (not mentioned, though
  `beforeRegisterNodeDef` exposes the class to enable exactly that).
- Widget callback chaining (not mentioned).
- The `setup` vs `init` confusion (no guidance on which to use when).
- Ordering between competing extensions registering against the same hook.
- Extension teardown / unload (no `destroy` / `dispose` hook is listed).

## Implications for v2 API design

1. **The hook list is the de-facto contract, but it is not the public API.**
   The doc's reliance on "see the TypeScript interface for the real list"
   means the TS interface itself is the load-bearing artifact. v2 must own a
   single canonical surface — not "doc + interface + whatever core extensions
   do."

2. **Hook ordering is a public guarantee.** Three explicit ordering diagrams
   exist and are relied on. Any v2 lifecycle must either preserve these
   sequence points or provide a documented mapping. Specifically the page-load
   sequence has 10 ordered phases; collapsing or reordering will break
   extensions.

3. **`beforeRegisterNodeDef(nodeType, nodeData, app)` is the monkey-patching
   seam.** By passing the class and the raw def, the current API actively
   invites prototype mutation and chained method wrapping. v2 needs an
   explicit replacement for the legitimate use cases this enables (per-node
   behavior augmentation, per-def metadata injection) so authors don't reach
   for `nodeType.prototype.<method> = ...` again.

4. **`nodeCreated` and `loadedGraphNode` are the per-instance seams.** v2 must
   provide a per-instance hook that fires both on fresh construction and on
   deserialize, with clear ordering relative to widget/component
   initialization.

5. **`getCustomWidgets` deserves a first-class replacement.** It is the only
   widget-contribution surface mentioned and predates the Vue-based widget
   system. Our v2 client-state-hook design must cleanly subsume it.

6. **`getSelectionToolboxCommands` is a hint that contribution surfaces are
   expanding.** The pattern of "extensions return an array of contributions"
   is already in use. v2 should formalize this as a registry pattern rather
   than ad-hoc per-feature hooks.

7. **No teardown story.** Custom nodes that hot-swap or are replaced have no
   defined cleanup path. v2 must define this — it is a gap, not a pattern to
   preserve.

8. **The 23+ core extensions are our migration test suite.** Any v2 surface
   must be expressive enough to re-implement every entry in the inventory
   without monkey-patching `LGraphNode` / `LGraphCanvas` / `LGraph` (per ADR
   0003 + ADR 0008).

9. **"Non-intrusive where possible" must become "non-intrusive, period."**
   The current hedge in principle #3 is the loophole that produced the
   monkey-patching ecosystem. v2's stance should be that core entities are
   sealed and all extension affordance is explicit.
