# <a href="/decisions/D-widget-serialization-simplification" class="wiki-link">D-widget-serialization-simplification</a>

- **Status**: ACCEPTED — 2026-05-20 (wave-9, see §Decision). Header format normalized 2026-05-20 (wave-12) per <a href="/decisions/D-api-surface-finalization" class="wiki-link">D-api-surface-finalization</a>.
- **Decider:** Christian (user direction, 2026-05-20)
- **Wave:** 9
- **Related:**
  - AXIOMS.md §<a href="/axioms#a1-refs" class="wiki-link">A1</a> (widget-centric), §<a href="/axioms#a2-refs" class="wiki-link">A2</a> (minimal surface), §<a href="/axioms#a5-refs" class="wiki-link">A5</a> (3-tier widget state), §<a href="/axioms#a11-refs" class="wiki-link">A11</a> (ECS), §<a href="/axioms#a14-refs" class="wiki-link">A14</a> (Phase A exclusions)
  - AXIOMS.md §<a href="/axioms#a15-refs" class="wiki-link">A15</a> (widget declarativity — NEW, codified with this decision)
  - AXIOMS.md §<a href="/axioms#a16-refs" class="wiki-link">A16</a> (unified serialization target — NEW, codified with this decision)
  - `decisions/D14-serialization-convergence.md` (predecessor — promised the end-state this ADR ships)
  - `decisions/D-no-node-widget-access.md` (wave-8 bilateral <a href="/axioms#a1-refs" class="wiki-link">A1</a> closure — structural sibling)
  - `decisions/D-immutability-enforcement.md` (already blocks `widget.options.serialize = false` write at the type level)
  - `docs/adr/0010-deprecate-node-level-serialization-control.md` (foundation ADR — `node.on('beforeSerialize')` stays `@deprecated` + runtime-warned per user direction; not banned by this ADR)
  - Design review row #11 (`design-review-12142.md` line 924) — reframed from "ban node-level" to "simplify widget-level + codify single target"
  - Slack proposal "Single Serialization Target (WIP)" — `https://comfy-organization.slack.com/archives/C0AR9UCKR9V/p1778630822323199`

## Decision

The **sole** extension-author interface to serialization is
`widget.on('beforeSerialize', handler)`. The framework writes **one
serialized payload** that is simultaneously the workflow JSON `widgets_values`
entry and the API prompt payload. Authors cannot disable serialization, cannot
distinguish serialization contexts, and cannot add widgets at runtime.

Concretely, **comment out (<a href="/axioms#a2-refs" class="wiki-link">A2</a>/<a href="/axioms#a14-refs" class="wiki-link">A14</a> pattern)** in
`src/extension-api/widget.ts`:

- `WidgetHandle.setSerializeEnabled(enabled: boolean): void`
- `WidgetHandle.isSerializeEnabled(): boolean`
- `WidgetBeforeSerializeEvent.context: 'workflow' | 'prompt' | 'clone' | 'subgraph-promote'`
- `WidgetBeforeSerializeEvent.skip(): void`
- `WidgetPropertyChangeEvent` (only union member was `'serialize'`; vacuous after removal)
- `WidgetHandle.on('propertyChange', handler)` overload (subscriber for the vacated event)
- `WidgetOptions.serialize?: boolean` (key on the read-only options bag)

**Remove** the framework-side adapters in
`src/services/extension-api-service.ts` that backed the surfaces above
(`isSerializeEnabled` / `setSerializeEnabled` blocks and the
`propertyChange` branch of the event dispatcher).

**Keep** on the public surface:

- `WidgetHandle.on('beforeSerialize', handler)` — async-capable, sole interface
- `WidgetBeforeSerializeEvent.value: T` — the widget's current value
- `WidgetBeforeSerializeEvent.setSerializedValue(v): void` — in-place override
- All other `on(...)` events (`valueChange`, `optionChange`, `beforeQueue`)

## Context

The current widget-serialization surface conflates three orthogonal axes
and inherits a four-context discriminator from v1 internals:

1. **Three "disable serialization" knobs**, all collapsible:
   - `widget.options.serialize = false` (v1 mutation — already blocked at the
     type level by <a href="/decisions/D-immutability-enforcement" class="wiki-link">D-immutability-enforcement</a>, but the *key* still exists on
     `WidgetOptions` as a readable shim).
   - `widget.setSerializeEnabled(false)` (v2 mutator — single binary, can't
     distinguish "save workflow / skip prompt" from "skip both").
   - `event.skip()` on the serialize hook (per-call escape that mirrors
     `setSerializeEnabled(false)` but only for `context === 'prompt'`).
2. **A four-way context discriminator** on the serialize event
   (`'workflow' | 'prompt' | 'clone' | 'subgraph-promote'`) that pushes
   transport semantics into extension authors. Real ecosystem extensions
   branch on `if (e.context === 'prompt')` to opt out of prompt
   serialization — exactly the wrong-layer pattern <a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> §Context called out.
3. **Run-time widget addition** (`node.addWidget` family) that the v2 surface
   never exposed but the v1 surface still permits. Frontend-only widgets and
   runtime-added widgets are the underlying *reason* extensions need a "skip
   prompt" knob: there is no schema slot for the value, so the value must be
   stripped from the prompt to avoid backend rejection.

Two architectural premises (now codified as axioms <a href="/axioms#a15-refs" class="wiki-link">A15</a> + <a href="/axioms#a16-refs" class="wiki-link">A16</a>) eliminate
the need for any of (1)–(3):

- **<a href="/axioms#a15-refs" class="wiki-link">A15</a> — <a href="/glossary#widget" class="wiki-link">Widget</a> declarativity.** Widgets are schema-declared in Python
  node classes. There is no runtime `addWidget`. UI-only concepts use
  *boxed/composed widgets* (BBOX-style — the widget is itself the schema
  input value), non-widget UI primitives (overlays, panels, custom DOM not
  registered as a widget), or schema inputs accepted as ordinary widget
  values. There are no "frontend-only widgets."
- **<a href="/axioms#a16-refs" class="wiki-link">A16</a> — Unified serialization target.** Workflow JSON and prompt payload
  converge to one serialization output. Authors cannot disable serialization
  at the widget level. The sole interface for participating in serialization
  is `widget.on('beforeSerialize')`.

<a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> §Phase 2 already promised a simpler shape for (1) (the
`ephemeral`/`promptExclude` named options); the user redirect on
2026-05-20 supersedes that with the stronger A16 form — there is no
matrix to expose because there is nothing to disable.

## Rationale

- **<a href="/axioms#a1-refs" class="wiki-link">A1</a> widget-centric, <a href="/axioms#a11-refs" class="wiki-link">A11</a> ECS.** Widgets are the unit of state. The
  framework decides transport (workflow disk / prompt websocket / clone /
  subgraph promote); extensions decide *value*. The 4-context
  discriminator inverted that: extensions had to know which transport
  fired in order to behave correctly, which is the wrong direction of
  knowledge flow.
- **<a href="/axioms#a2-refs" class="wiki-link">A2</a> minimal surface.** Three knobs that collapse to one removal is the
  highest-leverage A2 cleanup left on widget.ts. Zero v2 ext call sites
  for any of the removed surfaces (verified — see *Migration impact*
  table). Wave-8 proved this kind of bilateral removal is non-disruptive
  when the surface is exposed but unused.
- **<a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> §Phase 4 collapse.** D14 already accepted that the hook fires
  once with a single payload — A16 finishes the job by removing the
  discriminator that forced authors to branch.
- **<a href="/decisions/D-immutability-enforcement" class="wiki-link">D-immutability-enforcement</a> alignment.** That ADR already raises a
  TypeScript error on `widget.options.serialize = false`. Dropping the
  key from `WidgetOptions` removes a misleading shim that contradicts
  A16 at the read site as well.
- **Closes the "frontend-only widgets" trap.** The reason `skip()` and
  `serialize: false` exist is to support widgets that have no backend
  slot. A15 says those should not be widgets at all — they should be
  boxed values (whose backend representation is the box itself), UI
  primitives outside the widget system, or schema inputs. Removing the
  knob removes the trap.

## Consequences

### What is removed (commented out per <a href="/axioms#a14-refs" class="wiki-link">A14</a>)

| Symbol | File | Why |
|---|---|---|
| `setSerializeEnabled(enabled: boolean)` | `widget.ts` | A16 — authors cannot disable serialization |
| `isSerializeEnabled(): boolean` | `widget.ts` | Reader of the removed knob |
| `WidgetBeforeSerializeEvent.context` | `widget.ts` | A16 — single serialization target; framework owns transport |
| `WidgetBeforeSerializeEvent.skip()` | `widget.ts` | A16 — `skip()` IS a per-call disable |
| `WidgetPropertyChangeEvent` | `widget.ts` | Vacuous union after `'serialize'` removed |
| `on('propertyChange', handler)` overload | `widget.ts` | Subscriber for vacated event |
| `WidgetOptions.serialize?: boolean` | `widget.ts` | Removed from the read-only options bag — contradicted A16 even at the read site |
| `isSerializeEnabled` adapter block | `extension-api-service.ts` (lines 302–307) | Backed the removed surface |
| `setSerializeEnabled` adapter block | `extension-api-service.ts` (lines 308–315) | Backed the removed surface |
| `propertyChange` branch in event dispatcher | `extension-api-service.ts` (line 362) | Subscriber for vacated event |

### What remains legal

- `widget.on('beforeSerialize', handler)` — async-capable, sole interface
- `event.value: T` — current widget value
- `event.setSerializedValue(v)` — in-place serialized-value override
- All other widget events: `valueChange`, `optionChange`, `beforeQueue`
- `widget.getValue()` / `widget.setValue()` — schema-declared value access
- All node-level surfaces are unchanged by this ADR

### Replacement patterns

| Old pattern | New pattern |
|---|---|
| `widget.options.serialize = false` (v1) | Not supported. Either use a boxed widget, a non-widget UI primitive, or accept that the widget value participates in serialization. |
| `widget.setSerializeEnabled(false)` (v2) | Same as above. |
| `if (e.context === 'prompt') e.skip()` (v2) | Not supported. If the widget should not appear in the prompt, it should not be a widget. |
| `if (e.context === 'prompt') e.setSerializedValue(processed(v))` (v2) | `e.setSerializedValue(processed(v))` — the override applies to the single serialization target. |
| `if (e.context === 'workflow') ...` (v2) | Not supported — there is no per-transport branch. The handler fires once and the framework writes the resulting payload to all consumers. |
| `widget.on('propertyChange', fn)` (v2) | Not supported — the only property the event ever surfaced was `'serialize'`, which is gone. |

### Migration impact

| Branch | Surface | v2 call sites (production) | Action |
|---|---|---:|---|
| `restack-foundation-v2` | `setSerializeEnabled` / `isSerializeEnabled` / `context` discriminator / `skip()` / `propertyChange` | 0 | Comment out surface; remove adapters |
| `restack-pkg-v2` | Re-export + `.d.ts` | n/a (regenerated) | Rebuild via cascade |
| `restack-ext-v2` | v2 example extensions | 0 | Cascade clean |
| `restack-tf-v2` | Behavior-triplet tests | TBD (tf worktree not local; verify via PR CI) | Cascade clean OR small triplet-update commit if assertions reference the removed fields |

### Compatibility

- **v1 path (`Comfy.*` extensions, `widget.options.serialize`, `widget.serializeValue = fn`) is untouched** per the parallel-paths migration (<a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a>). This ADR is a v2-only constraint.
- **No user-visible regression.** The v2 path was not yet in any shipped user workflow; the runtime warning on `node.on('beforeSerialize')` (separate surface, retained per user direction) continues to fire unchanged.
- **CI on `ext-api/*-v2` PRs stays under AGENTS.md Rule 8 carve-out** — failures on this stack do not block wave-9 forward motion until the Phase B rebase onto Alex's ECS branch.

### Codemod note

No codemod required. Migration is "if you call any of the removed surfaces,
restructure your extension to not need them." For the rare v1 extension
that needs `widget.options.serialize = false` semantics, the v1 surface
remains available under `Comfy.*` per <a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a>.

## Restoration criteria

A surface in this ADR moves from "commented out" back to "shipped" only if
**all** of the following hold:

1. A validated ecosystem use case is documented that cannot be served by
   boxed widgets, non-widget UI primitives, or schema inputs.
2. The use case has been audited against A15 + A16 and an axiom amendment
   has been proposed and accepted to relax the relevant invariant.
3. The replacement surface is typed, async-capable where needed, and does
   not re-introduce the 4-context discriminator.

(Bar set deliberately high — `skip()` and `setSerializeEnabled` existed to
work around A15 + A16 violations; restoring them without first fixing the
violation would re-create the trap.)

## Implementation checklist

- [x] Draft ADR (this file)
- [x] Add A15 + A16 to `AXIOMS.md`; append the seven new rows to the A14
  "COMMENTED OUT" table
- [x] Update `scripts/check-axiom-compliance.sh` — strict-fail on any
  uncommented `setSerializeEnabled` / `isSerializeEnabled` /
  `WidgetBeforeSerializeEvent.context` / `\.skip\(\)` re-introduction in
  `widget.ts`; warn on `WidgetOptions.*serialize`
- [x] Foundation commit: comment out the listed widget.ts surfaces with
  `// PHASE_A_EXCLUDED per AXIOMS.md A15+A16 (D-widget-serialization-simplification)`
  preamble; remove the listed adapter blocks in
  `extension-api-service.ts`; update widget.ts JSDoc examples to drop
  `e.context === 'prompt'` and `e.skip()` references; update
  `src/extension-api/README.md` ADR table to add this ADR row
- [x] Cascade pkg → ext via plain `git rebase origin/<parent>`; stash/restore
  any pre-existing uncommitted work in each worktree
- [x] Push tf cascade prep (tf worktree absent locally — direct branch push
  pattern or defer to wave-10 if tf needs hand-edited triplet updates)
- [x] Restratify mirror via `git push --no-verify --force-with-lease
  origin refs/remotes/origin/ext-api/i-<pair>-v2:refs/heads/ext-api/i-<pair>-restratify`
  for all 4 pairs
- [x] Dashboard refresh from `christian-byrne/ComfyUI_frontend-ecosystem`
  via `EXT_API_WORKTREE=…/restack-pkg-v2 bash scripts/refresh-api-docs.sh`;
  commit + push `--no-verify` (sole-contributor per AGENTS.md Rule 9)
- [x] PR comments on #12142 (summary + decision-propagation matrix) +
  per-branch comments on #12143/#12144/#12145
- [x] AGENTS.md `§Reconciliation history` — prepend wave-9 row above wave-8
- [x] `bash scripts/sync.sh` clean — drift = 0, no orphan decisions, axiom
  checks pass
