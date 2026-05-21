# D-bootstrap-hooks — Disposition of `init` / `setup` extension hooks

**Status**: ACCEPTED 2026-05-14 (W6.P6 pick, human-in-the-loop). Decision recorded after R1+R2+R3 evidence (228 hits / 68 repos / 97,865 cum stars across the W2F-1 corpus); pick made by Christian in chat. Supersedes the original three-option matrix with a fourth shape derived from the brainstorm. Scope is **lifecycle hooks + event namespaces only**; the originally-proposed "workbench umbrella for UI-shell registration" was scoped back during reconcile (workbench is for the 3 UI events, not for `defineSidebarTab`/`defineCommand`/`defineHotkey`/`toast` which keep their current shape under W6.P5).

## Context

`ExtensionOptions` (the v2 `defineExtension` argument) carries two
top-level lifecycle hooks lifted directly from v1 `ComfyExtension`:

```ts
interface ExtensionOptions {
  init?(): void | Promise<void>     // pre-API mount
  setup?(): void | Promise<void>    // post-API mount
  // … node hooks, shell, etc.
}
```

The names came from v1 by inertia; the v2 API kept them to minimize
migration cost. CB's Slack proposal (2026-05-13) flagged them for
investigation:

> "TODO: investigate `setup` / `init` use cases. If we drop or rename,
> there's a risk of forcing authors (and their agents) to learn a new
> concept; weigh that against the clarity win."

### Evidence base (R1 + R2 + R3)

Source: `research/custom-node-patterns/init-setup-usage-audit.md`.
Bulk-clone grep against the W2F-1 138-repo corpus.

- **228** `init`/`setup` hook definitions inside
  `app.registerExtension({...})`; **68 / 138** repos (~49% adoption)
- Hook split: `setup` 167 (73%) / `init` 61 (27%)
- Cumulative stars affected: ~97,865 across 24 (init) / 61 (setup) repos
- Lifecycle bucketing: post-api-mount 36 (16%) / post-graph-loaded 41
  (18%) / post-extension-store-ready 37 (16%) / register-side-effect
  44 (19%) / no-op 7 (3%) / other 63 (28%)
- **36 / 36** `api.addEventListener` registration sites use `setup`,
  never `init` — the two hooks already have a de-facto semantic split
- Authors observe load-order: `bmad4ever_DirtyUndoRedo` comments
  "make it the last loaded extension"; AlekPet pairs CSS-in-`init`
  with behavior-in-`setup`
- Event-name surface (separate sweep of `api.addEventListener`):
  ~360 backend-dispatched listener registrations across ~50 distinct
  event names; ~290 of those are execution-lifecycle events
  (`execution_start`, `executed`, `progress`, `b_preview`, etc.)

### Adjacent decisions touched

- **D-shell-ui-entrypoints (W6.P5)** — this ADR introduces a
  `workbench` namespace; P5's `defineSidebarTab` / `defineBottomPanelTab`
  / `defineCommand` / `defineHotkey` re-export through that namespace.
- **D5 events-and-payload-typing** — this ADR proposes typed
  `graph.on()` / `execution.on()` / `server.on()` / `workbench.on()`
  channels; D5 covers the typed-payload schema.
- **D10 lifecycle-context-and-ordering** — this ADR reuses D10's
  `currentExtension` Vue-composable-style setup context to make the
  new context-scoped `onMounted` work the same way `onNodeMounted`
  already does.

## Decision

**Adopt context-scoped Vue-style lifecycle hooks inside `setup()` bodies, plus four typed event-channel namespaces (`graph` / `execution` / `server` / `workbench`).**

This is a *fourth* shape beyond the original three options — derived
during the brainstorm. The original options were:

- (i) keep `init`/`setup` names + doc them better
- (ii) rename to `onAppMounted`/`onAppStarted`
- (iii) drop both entirely, migrate everything to other hooks/loaders

The adopted shape is closer to **(ii) rename, but applied as a
context-scoped composable hook rather than a per-extension property**.
It eliminates `init` and `setup` as `ExtensionOptions` *properties*
while preserving every use case via `onMounted` *inside* the existing
`setup()` function body.

> **Scope note (reconciled 2026-05-14):** An early draft of this ADR
> proposed making `workbench` an umbrella for UI-shell registration
> too (`workbench.defineCommand`, `workbench.defineSidebarTab`, etc.).
> That part was scoped back. `workbench` is the namespace for the **3
> shell-related events** (`notification`, future panel/theme/command
> events) only. `defineSidebarTab` / `defineBottomPanelTab` /
> `defineCommand` / `defineHotkey` / `toast` keep their current
> top-level shape under W6.P5 — no umbrella change there. This
> decouples P6 from P5: P6 can ship independently.

### Shape

```ts
import {
  defineExtension,
  defineSidebarTab,
  defineBottomPanelTab,
  onMounted,
  onBeforeMount,
  onUnmounted,
  onActivated,
  onDeactivated,
  graph,
  execution,
  server,
  workbench
} from '@comfyorg/extension-api'

defineExtension({
  name: 'my-ext',
  setup() {
    // runs at registration; today's `init` body lives here.
    addStylesheet('css/my.css')

    onMounted(() => {
      // runs when app is fully mounted; today's `setup` body lives here.
      execution.on('start', (e) => { ... })
      server.on('status', (e) => { ... })
      graph.on('changed', (e) => { ... })
      workbench.on('notification', (e) => { ... })
    })
  }
})

defineSidebarTab({
  id: 'my-tab',
  setup() {
    onMounted(() => { /* tab DOM created */ })
    onActivated(() => { /* tab shown */ })
    onDeactivated(() => { /* tab hidden */ })
    onUnmounted(() => { /* tab destroyed */ })
  }
})

defineBottomPanelTab({ id: 'logs', setup() { /* same hook surface */ } })
```

### Lifecycle hooks (context-scoped, Vue-idiomatic)

| hook | inside `defineExtension.setup` | inside `defineSidebarTab.setup` | inside `defineBottomPanelTab.setup` |
|---|---|---|---|
| `onBeforeMount` | before app is fully mounted (rare) | before tab DOM created | before panel DOM created |
| `onMounted` | app is mounted (replaces v1 `setup`) | tab DOM created | panel DOM created |
| `onActivated` | n/a | tab shown | panel shown |
| `onDeactivated` | n/a | tab hidden | panel hidden |
| `onUnmounted` | app teardown (rare) | tab removed | panel removed |

Body of `setup()` itself runs at registration time — equivalent of
v1 `init`. No `onAppMounted` / `onAppStarted` standalone names are
needed; context (which `define*` you're inside) disambiguates.

### Event namespaces (four channels)

| namespace | what flows on it | example events | hits in corpus |
|---|---|---|---|
| `graph.on(...)` | graph-mutation events (frontend-dispatched) | `'changed'`, `'cleared'` | 33 |
| `execution.on(...)` | prompt-run lifecycle (backend-dispatched) | `'start'`, `'end'`, `'error'`, `'interrupted'`, `'cached'`, `'executing'`, `'progress'`, `'preview'` | ~290 |
| `server.on(...)` | non-execution backend events + custom-node events | `'status'`, `'logs'`, `'reconnected'`, `'feature_flags'`, `'assets'`, plus arbitrary strings like `'rayko.inspline.show'` | ~70 |
| `workbench.on(...)` | UI shell events | `'notification'`, future `'themeChanged'`, `'panelToggled'`, `'commandInvoked'` | ~7 today, designed to grow |

**Custom-node events** ride `server.on(...)` with arbitrary string
accepted. Authors get typed completion via TS module augmentation per
node-pack (precedent: VSCode `commands.executeCommand` accepts any
string + per-extension `.d.ts` augmentation). No separate `server.onCustom(...)`
method — avoids "two ways to do the same thing".

`workbench` here is a thin event-namespace handle only. It is **not** a
DI container, not the W6.P5 UI-registration umbrella, and adding new
`workbench.*` methods is out of scope for this ADR. (The name was
picked because the existing `src/workbench/` DDD folder is already
the IDE-shell concept; the event names match that folder's domain.)

## Consequences

### What collapses

- `init` and `setup` as `ExtensionOptions` *properties* are removed
  from v2 (deprecated in v1 with a migration mapper).
- The 36 `setup` bodies that are pure `api.addEventListener` calls
  become 1-line declarations under `execution.on()` / `server.on()`.
- The "is `init` a no-op?" question becomes moot — `setup()` body and
  `onMounted()` body cover everything `init`/`setup` covered.
- **Out of scope:** W6.P5's `defineSidebarTab` / `defineBottomPanelTab` /
  `defineCommand` / `defineHotkey` / `toast` shape. This ADR does not
  decide whether they stay top-level or move under any umbrella; P5
  owns that pick independently.

### Migration impact (228 R1 hits + ~360 event-listener call sites)

| v1 pattern | v2 replacement | cost |
|---|---|---|
| `init() { addStylesheet(...) }` (44 register-side-effect hits) | move body into `setup() { addStylesheet(...) }` | mechanical sed |
| `setup() { api.addEventListener('execution_start', fn) }` (36 post-api-mount hits) | inside setup body: `onMounted(() => execution.on('start', fn))` (or `server.on('execution_start', fn)`) | mechanical codemod |
| `setup() { app.graphToPrompt = ...wrap... }` (post-graph-loaded hits) | inside setup body: `onMounted(() => { /* app.graphToPrompt wrap */ })` | mechanical sed |
| `init() { app.ui.settings.addSetting(...) }` (post-extension-store-ready hits) | inside setup body: `onMounted(() => app.ui.settings.addSetting(...))` (W6.P5 may later offer a `defineSetting(...)` entry point — out of scope here) | mechanical sed |
| `app.registerExtension({ name, init, setup, sidebarTabs: [...], commands: [...] })` | `defineExtension({ name, setup() { onMounted(...) } })`; sidebar/commands entry points unchanged from current W6.P5 shape | structural for the lifecycle portion only |

Codemod ships alongside v2; v1 `ComfyExtension`-style registration
still works during deprecation window, with a runtime mapper that
re-routes v1 hooks to the v2 equivalents.

### Agent / training-data impact

The Slack-flagged "agent training set" concern is mitigated by:

1. **Vue-idiomatic naming** — `onMounted`, `onUnmounted`, `onActivated`
   are already-trained vocabulary for any LLM that has seen Vue 3
   docs. Zero net-new concepts.
2. **Domain-noun namespacing** — `graph.on` / `execution.on` /
   `server.on` / `workbench.on` use existing domain nouns (matching
   `src/workbench/`, `src/platform/workspace/`, the `executionStore`,
   etc.). Agents reading the codebase get free corroboration.
3. **Migration mapper** — published v1→v2 mapping table in the
   migration guide gives a deterministic translation that agents can
   apply.

### Cross-decision dependencies

- **D5 events-and-payload-typing** must define payload schemas for
  the four namespaces' canonical event names.
- **D18 loader pattern** is no longer needed as a `init`/`setup`
  fallback — both options collapse into `setup()` body or `onMounted`.
- **D-shell-ui-entrypoints (W6.P5)** — NOT a dependency. This ADR
  was originally drafted with a P5 coupling; reconciled 2026-05-14 to
  decouple. P6 ships independently.

## Alternatives considered

| Option | Pro | Con | Verdict |
|---|---|---|---|
| (i) keep `init`/`setup` names, doc better | Zero migration cost; preserves agent training carryover | Doesn't solve Vue `setup()` namespace collision; leaves Slack TODO open | Rejected — clarity win outweighs zero-cost option |
| (ii) rename to `onAppMounted`/`onAppStarted` as properties | Clearer semantics; resolves Vue collision | Still two properties; doesn't generalize to sidebar/panel contexts; not Vue-idiomatic | Subsumed by adopted shape |
| (iii) drop both entirely, migrate to other surfaces | Cleanest end state | Blockers: 36 post-api-mount need `api.on()` channel; 37 post-extension-store-ready need W6.P5 surfaces; 44 register-side-effect partly unmigratable | Subsumed by adopted shape (the "drop both" wins, but the destination is `setup()` body + `onMounted` inside it, not external surfaces) |
| (iv) status quo, no investigation | Zero work | Leaves question open; rejected upfront | Rejected |
| **Adopted: context-scoped `onMounted` + 4 typed event-channel namespaces** | Vue-idiomatic; collapses 228-hit surface to mechanical codemod; zero new vocabulary for trained agents; decoupled from P5 | Full ecosystem touch via codemod | **ACCEPTED 2026-05-14** |

## Implementation plan

Foundation impl (W6.P6.C) is conditional on:

- **D5 event-payload schemas** — `graph.on`/`execution.on`/`server.on`/
  `workbench.on` need typed payload definitions. (If D5 is not yet
  ready, ship with inferred-`unknown` payload + augment-to-tighten
  in a follow-on PR.)

(No longer gated on D-shell-ui-entrypoints / W6.P5 — the workbench
umbrella scope-back removes that dependency.)

| Step | Action | Owner | Verification |
|---|---|---|---|
| 1 | Implement `onMounted` / `onBeforeMount` / `onUnmounted` / `onActivated` / `onDeactivated` context-scoped hooks in `src/extension-api/lifecycle.ts`. Reuse D10 `currentExtension` slot. | foundation PR #12142 | unit test: hook inside `defineExtension.setup` fires after app-mount; same hook inside `defineSidebarTab.setup` fires after tab-create |
| 2 | Implement `graph` / `execution` / `server` / `workbench` event-namespace facades (event-only) in `src/extension-api/events.ts`. Wire to existing `api.addEventListener` underneath. | foundation PR #12142 | unit test: `execution.on('start', fn)` receives the same payload as legacy `api.addEventListener('execution_start', fn)` |
| 3 | Mark `ExtensionOptions.init` and `.setup` as `@deprecated`; add runtime mapper that re-routes v1 `init` body to `defineExtension.setup` body and v1 `setup` body to `onMounted(...)` inside it. | foundation PR #12142 | E2E: v1 extension using `{ init, setup }` still loads + executes hooks in correct order |
| 4 | Bundle `.d.ts` regeneration so `@comfyorg/extension-api` exports the new names + namespaces. | pkg PR #12143 | typecheck on a fresh consumer pulling the package; new exports visible |
| 5 | Update example extensions (`*.v2.ts`) under `src/extensions/core/` to use new shape. Pick 2–3 representative examples. | ext PR #12144 | each example loads + behaves identically to v1 counterpart |
| 6 | Update behavior triplets in test framework — add new hook + namespace coverage. | tf PR #12145 | triplet rerun on representative ecosystem packs (rgthree, KJNodes, Easy-Use, Manager) |
| 7 | Codemod script `scripts/codemod-v1-to-v2-extension.ts` that mechanically transforms v1 `init`/`setup` properties to v2 shape (`setup()` body + `onMounted` inside). Ships in `@comfyorg/extension-api` so authors can run `npx @comfyorg/extension-api codemod ./src` | pkg PR #12143 | golden-input test: convert each of the 228 R1 catalog hits, diff vs hand-authored target |
| 8 | Migration-guide section in `docs/extensions/migration-v1-to-v2.md` with v1→v2 hook+namespace map table. | docs | published page renders the map cleanly |
| 9 | Dashboard refresh: surface `S1.H*` family (init/setup) + new event-namespace patterns on `/patterns` and `/api-diff` views. | dashboard | `christian-byrne/ComfyUI_frontend-ecosystem` regenerated; deltas visible |

## References

- `research/custom-node-patterns/init-setup-usage-audit.md` — R1+R2+R3 evidence base
- `design-review-12142.md` row #7 (Setup-Only Hooks — Vue Cargo-Culting)
- W6.P6 task block in `todo.md` (Wave-6 section)
- D5 — events and payload typing (cross-couples on typed event payloads)
- D10 — lifecycle context and ordering (reuses `currentExtension` slot)
- D11 — naming `defineNode`/`defineWidget` (precedent: short, expressive, mirrors framework idiom)
- D-shell-ui-entrypoints (W6.P5) — `workbench` umbrella co-designed here
- D18 — pure functions + loader registration (no longer needed as `init`/`setup` fallback)
- ComfyUI_frontend `src/extension-api/lifecycle.ts` — current D10 hook implementation
- ComfyUI_frontend `src/extension-api/shell.ts` — current sidebar/bottom-panel/command/keybind types
- ComfyUI_frontend `src/workbench/` — existing DDD folder providing the namespace name
- Vue 3 Composition API — `onMounted` / `onActivated` / `onUnmounted` semantics
- VSCode Extension API — `vscode.window.*` / `vscode.commands.*` / `vscode.workspace.onDidChange*` precedent for namespaced `workbench.*`
- AGENTS.md "Decision propagation rules" — once accepted, must reach (a) commit on PR #12142 with "D-bootstrap-hooks" in subject, (b) this ADR, (c) dashboard JSON
