# Subagent Prompt — PKG2: Author the Public Extension API Declaration File

You are implementing PKG2 from `plans/P2-extension-api-package.md`. **Read
that plan first**, then this prompt for specifics.

## Required reading before starting

1. `plans/P2-extension-api-package.md` (the parent plan, especially "Target
   folder structure" and "Acceptance criteria")
2. `decisions/D5-events-and-payload-typing.md` (event shape rules — **accepted**
   with revisions; pay special attention to "Resolutions" section)
3. `decisions/D6-parallel-paths-migration.md` (Part 1 entry point, Part 3
   hybrid accessor/method rule — **accepted** with revisions; pay special
   attention to "Future Pivots" section for what's tentative)
4. `decisions/D7-widget-shape-and-persistence.md` (**check status** — if
   still scoping, write `WidgetHandle` minimally and leave `WidgetOptions`
   shape with TODO markers; specifically the non-value `WidgetEvents`
   channels are deferred to D7 — see D5 Part 2 revision)
5. `plans/P1-comfy-extension-v2-api.md` (current API proposal)
6. CONTEXT.md "Touch-Point Database" section for blast-radius signals
7. The three example extensions you must typecheck against:
   - `ComfyUI_frontend/src/extensions/core/dynamicPrompts.v2.ts`
   - `ComfyUI_frontend/src/extensions/core/imageCrop.v2.ts`
   - `ComfyUI_frontend/src/extensions/core/previewAny.v2.ts`
8. Existing scaffolding to consume:
   - `ComfyUI_frontend/src/types/extensionV2.ts` (the WIP types — use as
     starting point but rewrite to match D5/D6 rules)
   - `ComfyUI_frontend/src/services/extensionV2Service.ts` (the WIP impl —
     contains 14 reviewer feedback comments; respect their resolution per
     CONTEXT.md cluster summaries)

## Deliverables

1. New folder `ComfyUI_frontend/src/extension-api/` with files:
   - `index.ts` — barrel, the published package entry point
   - `node.ts` — `NodeHandle` interface + `NodeEvents` interface + payload
     types
   - `widget.ts` — `WidgetHandle` interface + `WidgetEvents` interface +
     payload types
   - `events.ts` — shared `Handler<E>` type + cross-cutting event types
   - `lifecycle.ts` — `Setup` context, `defineExtension`, lifecycle hooks
   - `shell.ts` — moved from `src/types/extensionTypes.ts`, no shape change
   - `identifiers.ts` — re-exports from `src/types/nodeIdentification.ts`
   - `README.md` — overview of the package, link to docs

2. Updates to existing files:
   - `ComfyUI_frontend/src/types/index.ts` — convert to a deprecation stub
     that re-exports from `extension-api/` with TSDoc `@deprecated` tag
   - `ComfyUI_frontend/src/services/extensionV2Service.ts` — rename to
     `extension-api-service.ts`; update imports to point at
     `src/extension-api/`
   - `ComfyUI_frontend/src/extensions/core/dynamicPrompts.v2.ts` (and
     siblings) — update imports

3. Do **NOT** delete the existing `src/types/extensionV2.ts` yet — leave
   it as a stub re-exporting from the new location, mark `@deprecated`,
   add a comment "remove in next release after PKG2 lands."

4. **Do NOT touch v1 files.** `src/types/comfy.ts`,
   `src/services/extensionService.ts`, and the v1 runtime entry point
   `src/scripts/app.ts:app.registerExtension(...)` stay exactly as they
   are. The v1↔v2 distinction is at the entry point (D6 Part 1), not the
   folder. Earlier scaffolding mistakenly created
   `src/extension-api-v1-compat/` — that folder has been deleted; do not
   re-create it.

## Acceptance criteria (from P2)

- All three example extensions typecheck (`pnpm typecheck` in
  ComfyUI_frontend) with zero new errors.
- No `any`, no `@ts-expect-error`, no `as any`.
- Every public type has TSDoc with `@stability` tag and `@example` block.
- `tsc --emitDeclarationOnly` against `src/extension-api/index.ts`
  produces a single-output declaration tree with no internal types
  leaking.
- AGENTS.md (ComfyUI_frontend) updated: add a one-line exception to
  rule #19 (no barrels in /src) for the published-package entry point.
- **Entry point**: module-level `import { defineExtension } from
  '@comfyorg/extension-api'` per D6 Part 1. NOT `app.extensions.define`.
  Authors should not depend on `window.app` being initialized at
  registration time.
- **Accessor/method rule (D6 Part 3 hybrid)**:
  - Read-only invariant (set at construction, never changes) → accessor
    (`get`)
  - Property-shaped state (no hidden side effect beyond the property
    itself) → accessor pair (`get`/`set`) — e.g. `node.position`,
    `node.title`, `node.size`
  - Action-shaped state (mutation fires events / dispatches commands /
    creates undo entries) → method (`setX`) — e.g. `widget.setValue(v)`,
    `widget.setOption(k, v)`
  - Boolean predicates → method (`isHidden()`, `isSelected()`)
- **Event types (D5)**:
  - Type every payload — no `Function`, no `(...args: unknown[]) => void`
  - `WidgetEvents` ships with **only `valueChange`** in v1; non-value
    channels deferred to D7
  - `widget.on('beforeSerialize', handler)` — handler may be async;
    event has `event.value`, `event.setSerializedValue(v)`, `event.skip()`
  - `widget.on('beforeQueue', handler)` / `node.on('beforeQueue', handler)` — sync;
    event has `event.reject(message: string)`; prevents queuePrompt. Required per
    COM-3668 S6.A5 (replaces S6.A4 queuePrompt monkey-patching).
  - All other events are sync only
  - Naming: `camelCase`, action-verb form, `before…` prefix only for
    pre-mutation hooks

## Required surface: cross-extension DOM widget creation hook (S4.W6)

`lifecycle.ts` must include `onDOMWidgetCreated(handler: (widget: WidgetHandle) => void)` in the
`Setup` context. This is the surface Custom Scripts Autocomplete needs to attach its input listener
to any DOM widget created by any extension. Distinct from `addDOMWidget` (the creator side):
this is an *observer* hook from a different extension. The v1 equivalent doesn't exist — this is
a net-new surface gap confirmed by Simon Tranter (COM-3668, S4.W6).

## What to defer

- Implementation classes (`NodeHandleImpl`, etc.) — types only in this
  task; impl stays in `extension-api-service.ts`.
- D7-blocked items: `WidgetOptions` shape, `WidgetProperties` shape,
  serialization persistence matrix, AND non-value `WidgetEvents` channels.
  Use `// TODO(D7):` markers and ship the smallest minimal shape that lets
  examples typecheck.
- Anything from the cluster D follow-up (lazy `useWorld`, nullish
  `WidgetValue.value`) — that's an impl concern, not a type concern.
- D5 Q4 verification: when authoring `BeforeSerializeEvent`, check
  whether `dynamicPrompts.ts` extras (`workflowNode`, `widgetIndex`)
  are needed in the payload. Grep the v1 source; if the handler doesn't
  actually use them, drop. If it does, add `event.workflowNode` and
  `event.widgetIndex` fields.

## Verification commands

From `ComfyUI_frontend/`:

```bash
pnpm typecheck
pnpm lint src/extension-api/
pnpm lint src/extensions/core/*.v2.ts
pnpm test:unit -- src/extension-api  # once tests exist
```

## Report back

When done, write a summary to `plans/prompts/_results/PKG2-summary.md` with:

- Files created / moved / modified
- Typecheck output (pass/fail)
- Any D5/D6/D7 questions surfaced during authoring (these are inputs back
  to the relevant ADR)
- Lines-of-code count for each new file
