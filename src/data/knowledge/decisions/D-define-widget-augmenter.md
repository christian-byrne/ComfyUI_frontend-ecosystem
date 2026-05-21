# <a href="/decisions/D-define-widget-augmenter" class="wiki-link">D-define-widget-augmenter</a> — Collapse "extend existing widgets" into `defineWidgetExtension`

> **Naming/scoping resolution (2026-05-21)**: original draft proposed a new entry point `extendWidget` / `defineWidgetAugmenter`. **Rejected after second-pass review** — the existing `defineWidgetExtension` (`lifecycle.ts:253`) is the right home for this. It already mirrors `defineNodeExtension`'s shape; it just needs a `widgetTypes` *filter* (parallel to the existing `NodeExtensionOptions.nodeTypes`) to switch between "define a new widget type" (today) and "extend instances of an existing widget type" (the gap). One primitive, two modes — same pattern `defineNodeExtension` uses today for nodes.

**Status**: PROPOSED (not ACCEPTED — Phase B work, no source-code change lands in Phase A)
**Date**: 2026-05-21 (rewritten same day after user feedback collapsed the design)
**Wave**: W14-C
**Blocks**: dynamicPrompts.v2 unstub (wave-8 follow-up); <a href="/decisions/D-cross-node-observation" class="wiki-link">D-cross-node-observation</a> Pattern 3 (global seed sync); migration target for legacy `app.on('beforePrompt')` users (rejected by <a href="/decisions/D-no-app-beforeprompt" class="wiki-link">D-no-app-beforeprompt</a>)
**Depends on**: <a href="/axioms#a1-refs" class="wiki-link">A1</a> bilateral closure (`D-no-node-widget-access`), <a href="/axioms#a15-refs" class="wiki-link">A15</a> Widget Declarativity, <a href="/axioms#a16-refs" class="wiki-link">A16</a> Unified Serialization Target

---

## The gap, restated

The Phase A surface (frozen at foundation `ee0537fdb5` per <a href="/decisions/D-api-surface-finalization" class="wiki-link">D-api-surface-finalization</a>) has:

- `defineNodeExtension({ name, nodeTypes?, nodeCreated, loadedGraphNode })` — runs for nodes matching `nodeTypes` filter (or all nodes if omitted). Authors **extend** behavior on node types defined by the backend Python; they never **create** new node types (those come from `INPUT_TYPES`).
- `defineWidgetExtension({ name, type, widgetCreated })` — registers a **NEW** widget type. `widgetCreated` returns a `{render, destroy}` pair for the custom DOM. Used for COLOR_PICKER, custom KSampler controls, etc.

The asymmetry is the bug: widgets have **only the define-new path**. There is no way to subscribe to value changes of an *existing built-in widget* (e.g., the INT widget named `seed` on every KSampler) without violating <a href="/axioms#a1-refs" class="wiki-link">A1</a> (nodes cannot enumerate widgets).

## The fix in one diff

Extend the existing primitive with a filter that mirrors `nodeTypes`:

```ts
// lifecycle.ts — WidgetExtensionOptions (proposed Phase B change)
export interface WidgetExtensionOptions {
  name: string

  /**
   * EXTEND mode: filter to widget types this extension attaches to.
   * Mirrors NodeExtensionOptions.nodeTypes. When set, the framework
   * runs `widgetCreated` once per matching widget instance across all
   * nodes that have a widget of this type. Cannot be combined with
   * `type` (the DEFINE-NEW field).
   */
  widgetTypes?: string | string[]

  /**
   * Optional sub-selector within `widgetTypes`. Matches the widget's
   * declared `name` (e.g. `'seed'`, `'prompt'`). When omitted, matches
   * every widget of `widgetTypes`.
   */
  widgetNames?: string | string[]

  /**
   * DEFINE-NEW mode: register a brand-new widget type. Mutually
   * exclusive with `widgetTypes`. Existing field — unchanged behavior.
   */
  type?: string

  /**
   * Per-instance setup. Receives a scoped WidgetHandle + the parent
   * NodeHandle (A1: this is the only direction node↔widget knowledge
   * flows). In EXTEND mode, return `void` — there is no DOM to manage.
   * In DEFINE-NEW mode, return `{render, destroy}` to mount custom DOM.
   */
  widgetCreated?(
    widget: WidgetHandle,
    parentNode: NodeHandle | null
  ): { render(container: HTMLElement): void; destroy?(): void } | void
}
```

**Validation at register time**: exactly one of `type` (define-new) or `widgetTypes` (extend) must be set. `widgetNames` is invalid without `widgetTypes`. Bad shapes throw synchronously with a clear error.

## How the three motivating cases look

### Case 1 — global seed sync (<a href="/decisions/D-cross-node-observation" class="wiki-link">D-cross-node-observation</a> Pattern 3)

```ts
import { defineWidgetExtension } from '@comfyorg/extension-api'
import { sharedSeed } from './my-shared-state'

export default defineWidgetExtension({
  name: 'my-org.global-seed-sync',
  widgetTypes: 'INT',
  widgetNames: 'seed',
  widgetCreated(widget) {
    // Mirror local → shared
    const off1 = widget.on('valueChange', (e) => {
      sharedSeed.value = e.newValue as number
    })
    // Mirror shared → local
    const stop = watch(sharedSeed, (v) => widget.setValue(v))
    // Effect-scope auto-disposes both on widget unmount
  }
})
```

### Case 2 — dynamic prompts (unblocks `dynamicPrompts.v2.ts` wave-8 stub)

```ts
export default defineWidgetExtension({
  name: 'Comfy.DynamicPrompts',
  widgetTypes: 'STRING',
  widgetCreated(widget) {
    widget.on('beforeSerialize', (e) => {
      e.replace(({ value, ...rest }) => ({
        ...rest,
        value: evaluateBraceSyntax(value as string)
      }))
    })
  }
})
```

### Case 3 — define a new custom widget type (unchanged from today)

```ts
export default defineWidgetExtension({
  name: 'my-org.color-picker',
  type: 'COLOR_PICKER',         // new type — registers it
  widgetCreated(widget, node) {
    return {
      render(container) { mountColorPickerDOM(container, widget) },
      destroy()          { unmountColorPickerDOM() }
    }
  }
})
```

## Axiom Compliance

| Axiom | Status | Evidence |
|---|---|---|
| **<a href="/axioms#a1-refs" class="wiki-link">A1</a>** (Widget-Centric / no node→widget) | ✅ Compliant | EXTEND mode delivers `WidgetHandle` directly via the framework's per-instance dispatch — no `NodeHandle.getWidget(s)`. `parentNode` is delivered as the widget→node direction, the only allowed channel. |
| **<a href="/axioms#a2-refs" class="wiki-link">A2</a>** (Minimal Surface) | ✅ Compliant | Net change is **2 optional fields on an existing interface**. No new entry point, no new types. Single most-minimal-possible surface delta to close the gap. |
| **<a href="/axioms#a3-refs" class="wiki-link">A3</a>** (Linked Subgraph) | ⚠️ Verify | EXTEND mode MUST fire for each clone of a linked subgraph independently. Test: register extension, instantiate same subgraph twice, mutate one widget → only matching widget's listener fires. |
| **<a href="/axioms#a4-refs" class="wiki-link">A4</a>** (Abstract IDs) | ✅ Compliant | `WidgetHandle` already opaque; no raw IDs added. |
| **<a href="/axioms#a5-refs" class="wiki-link">A5</a>** (3-tier widget state) | ✅ Compliant | EXTEND mode observes values via `on('valueChange')`; does not touch schema/props tiers. |
| **<a href="/axioms#a6-refs" class="wiki-link">A6</a>** (Command Pattern) | ✅ Compliant | `widget.setValue(…)` already routes through the command pipeline. EXTEND callbacks are observers. |
| **<a href="/axioms#a14-refs" class="wiki-link">A14</a>** (Commented-out / Phase-A-excluded) | n/a | No new commented-out surfaces. |
| **<a href="/axioms#a15-refs" class="wiki-link">A15</a>** (Widget Declarativity) | ✅ Compliant | EXTEND mode does **not** add widgets, does not change widget types, does not bypass schema. DEFINE-NEW mode unchanged from today (already <a href="/axioms#a15-refs" class="wiki-link">A15</a>-compliant). |
| **<a href="/axioms#a16-refs" class="wiki-link">A16</a>** (Unified Serialization Target) | ✅ Compliant | EXTEND mode subscribes to `widget.on('beforeSerialize')` — the sole interface per <a href="/axioms#a16-refs" class="wiki-link">A16</a>. |

## Migration paths it unblocks

| Legacy v1 surface | v2 expression via extended `defineWidgetExtension` |
|---|---|
| `Comfy.DynamicPrompts` (wave-8 stub) | `widgetTypes: 'STRING'` + `widgetCreated(w) { w.on('beforeSerialize', evalBraces) }` |
| Global seed sync (Pattern 3) | `widgetTypes: 'INT', widgetNames: 'seed'` + author-owned `Ref<number>` |
| Webcam capture observer (legacy `app.beforePrompt` user) | `widgetTypes: 'IMAGE'` + `w.on('beforeSerialize', captureFrame)` |
| Audio recorder observer (legacy `app.beforePrompt` user) | Same pattern as webcam |

## Rejected alternatives (now including the first draft of THIS ADR)

### ❌ Separate `extendWidget` / `defineWidgetAugmenter` entry point (this ADR's first draft, 2026-05-21 AM)
Two entry points where one suffices. Asymmetric with `defineNodeExtension` (which uses a single filterable entry point). Larger surface delta. User pushback during second review: *"it would both just use <a href="/api-docs/definewidget" class="wiki-link">defineWidget</a> — and just like <a href="/api-docs/definenode" class="wiki-link">defineNode</a>, you would be extending OR defining."* → Collapsed into the single-primitive approach above.

### ❌ Global `graph.on('widgetChanged')` event bus
Already rejected in <a href="/decisions/D-cross-node-observation" class="wiki-link">D-cross-node-observation</a> §Why not Option A. Encourages cross-node imperative filtering (the pattern A1 was added to prevent), broadcasts O(everything) when subscribers care about one widget. User confirmed lean-away during second review.

### ❌ Auto-dispatch via `type` field alone (no separate `widgetTypes`)
Variant: framework inspects whether `type` is in the built-in registry; if yes → extend mode, if no → define-new mode. Cute but has silent typo footgun: `type: 'STIRNG'` silently registers a new STIRNG widget type. The explicit `widgetTypes` vs `type` split (mirroring `nodeTypes` vs the absent equivalent for nodes) makes the author's intent explicit at the type level.

### ❌ Predicate `match: (widget) => boolean`
Maximum flexibility, but evaluator runs on every widget creation. Type-level + name-level filters cover all known use cases at zero runtime cost. Predicate can be added in a follow-up ADR if a real case demands it.

## Open Questions

1. **Multiple extensions matching the same widget** — order is registration order with lexicographic tie-break on `name` (same as `defineNodeExtension`). Verify in test.
2. **Subgraph promotion semantics** — when a widget moves from subgraph to root via promotion, does `widgetCreated` re-fire? Proposed: **no** — promotion is a DOM-move, not a fresh entity (<a href="/decisions/D12-scope-clone-on-copy" class="wiki-link">D12</a> reset-to-fresh applies only to copy/paste). Confirm in lifecycle scenarios doc.
3. **Type-tag evolution** — if a built-in widget's `type` changes between releases (`INT` → `INT_RANGE`), `widgetTypes: 'INT'` extensions stop firing silently. Proposed: emit one-time runtime warning when a `widgetTypes` value does not exist in the current schema registry.
4. **Performance** — broad-match extensions (`widgetTypes: 'STRING'` on a 1000-node workflow) create thousands of listener registrations. Document complexity contract; recommend narrow `widgetNames` predicates.
5. **DEFINE-NEW + EXTEND in the same extension** — should an author be able to define `COLOR_PICKER` AND extend `STRING` in one `defineWidgetExtension` call? Proposed: **no** — one extension does one verb. Two extensions if both are needed. Keeps the mental model clean and the validator simple.

## Phase A → Phase B handoff

This ADR is **PROPOSED** intentionally. Phase A surface is frozen; ACCEPTED requires:

1. Phase B trigger (PR #11939 ECS rebase merges).
2. Implementation commit landing the 2 new optional fields on `WidgetExtensionOptions` + dispatch wiring in `extension-api-service.ts`.
3. Test coverage: an `it.todo` body filled in for `bc-22.migration.test.ts` (or sibling) asserting EXTEND mode fires once per matching widget instance, including across linked-subgraph clones (<a href="/axioms#a3-refs" class="wiki-link">A3</a> verification).
4. Dashboard refresh — only the `widgetextensionoptions.mdx` page changes (2 new fields documented); zero new MDX pages, zero deletions.
5. `dynamicPrompts.v2.ts` unstubs in the same PR or immediate follow-up using the new fields. Example extension demonstrating Pattern 3 cross-node seed sync ships in `ext-api/i-ext-v2`.

When ACCEPTED, this ADR's status header flips and the foundation commit SHA is recorded here.

## References

- [AXIOMS.md §A1 — Widget-centric (NON-NEGOTIABLE)](file:///home/c_byrne/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api/AXIOMS.md)
- [AXIOMS.md §A15 — Widget Declarativity](file:///home/c_byrne/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api/AXIOMS.md)
- [D-cross-node-observation](file:///home/c_byrne/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api/decisions/D-cross-node-observation.md) — N13 Pattern 3 gap motivating this ADR
- [D-no-app-beforeprompt](file:///home/c_byrne/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api/decisions/D-no-app-beforeprompt.md) — N11 rejection of global mutation hook
- [D-no-node-widget-access](file:///home/c_byrne/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api/decisions/D-no-node-widget-access.md) — A1 bilateral closure
- [D-api-surface-finalization](file:///home/c_byrne/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api/decisions/D-api-surface-finalization.md) — Phase A freeze
- Existing primitive: `ComfyUI_frontend/src/extension-api/lifecycle.ts` lines 145–185 (`WidgetExtensionOptions`) + 247–255 (`defineWidgetExtension`)
- Mirror primitive: same file lines 46–99 (`NodeExtensionOptions.nodeTypes` — the filter pattern this ADR copies)
- Wave-8 stub commit: `bbb3c6ce02` on `ext-api/i-ext-v2` — `dynamicPrompts.v2.ts` pending these fields
