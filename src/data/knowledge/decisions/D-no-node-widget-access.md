# <a href="/decisions/D-no-node-widget-access" class="wiki-link">D-no-node-widget-access</a> — Nodes Cannot Access Their Widgets (Bilateral <a href="/axioms#a1-refs" class="wiki-link">A1</a> Closure)

**Status**: ACCEPTED 2026-05-19
**Decider**: Christian Byrne (handoff-14, post wave-7)
**Wave**: 8 (foundation impl + full cascade)
**Related**: AXIOMS.md §<a href="/axioms#a1-refs" class="wiki-link">A1</a> (Widget-Centric Philosophy), §<a href="/axioms#a2-refs" class="wiki-link">A2</a> (Minimal Surface), §<a href="/axioms#a14-refs" class="wiki-link">A14</a> (Phase A Exclusions); <a href="/decisions/D-immutability-enforcement" class="wiki-link">D-immutability-enforcement</a> (W6.P8.C); <a href="/decisions/D3.5-reactive-dispatch-and-scope-alignment" class="wiki-link">D3</a>.1 (widget.parentNode preserved)

## Decision

`NodeHandle.getWidget(name)` and `NodeHandle.getWidgets()` are **commented out** (per <a href="/axioms#a2-refs" class="wiki-link">A2</a> pattern) on the v2 public surface. Nodes have **no read or write access** to their widgets. The widget→node direction (`widget.parentNode`) remains the **sole** node↔widget channel.

Result: <a href="/axioms#a1-refs" class="wiki-link">A1</a> is enforced as written ("nodes cannot enumerate widgets") — the previously-codified "read-only carve-out" in `scripts/check-axiom-compliance.sh:22` is removed.

## Context

Wave-7 design conversation (2026-05-19, handoff-14) surfaced a long-standing contradiction:

- **AXIOMS.md §A1** (NON-NEGOTIABLE): "Node hooks cannot reference/modify widgets" + "Widgets can know their parent node, but **nodes cannot enumerate widgets**."
- **design-review-12142.md #13** (2026-05-12, "getWidget seems good"): renamed `widget()` → `getWidget()` without re-checking A1.
- **scripts/check-axiom-compliance.sh:22**: codified a carve-out — "getWidgets is allowed on <a href="/api-docs/nodehandle" class="wiki-link">NodeHandle</a>, but node.ts shouldn't define widget mutation" — that the AXIOMS.md text does not grant.
- **Shipped code**: `NodeHandle.getWidget(name)` + `NodeHandle.getWidgets(): ReadonlyArray<Readonly<WidgetHandle>>` on `src/extension-api/node.ts:236,259`.

CB's recall during handoff-14: "i thought we wanted to try node↔widgets communications totally absent in both directions." No written record of a bilateral decision was found, so this ADR captures the (now explicit) intent.

## Rationale

Three reasons the asymmetric carve-out is wrong shape:

1. **A1's stated rationale already justifies removal.** "Widgets can move (promotion, app mode), nodes cannot safely hold widget refs" applies to *any* node→widget reference, not only mutation. A read of `node.getWidget('steps')` returns a handle the node could leak past the widget's promotion event.
2. **Single channel reduces invariant surface.** With `widget.parentNode` as the sole link, the runtime maintains one direction of integrity (widget knows where its node is, even across promotion). Bilateral would mean two indices to keep consistent during scope churn.
3. **Per <a href="/axioms#a2-refs" class="wiki-link">A2</a>** ("comment out anything we're not 100% sure about"): no validated use case requires `node.getWidget*`. The one existing v2-ext call site (`dynamicPrompts.v2.ts`) is migrated to the inverted pattern; the JSDoc examples in `widget.ts` are rewritten to use `defineWidget({mount}, ctx.widget)`.

## Consequences

### What this removes from the public surface

| Symbol | Direction | Status |
|---|---|---|
| `NodeHandle.getWidget(name)` | node→widget | Commented out (was line 236 in `src/extension-api/node.ts`) |
| `NodeHandle.getWidgets()` | node→widget | Commented out (was line 259) |
| `node.ts` "getWidgets is allowed" carve-out comment | — | Removed from `scripts/check-axiom-compliance.sh` |

### What remains legal

| Symbol | Direction | Status |
|---|---|---|
| `WidgetHandle.parentNode: NodeHandle \| undefined` | widget→node | Preserved (<a href="/decisions/D3.5-reactive-dispatch-and-scope-alignment" class="wiki-link">D3</a>.1, <a href="/decisions/D3.5-reactive-dispatch-and-scope-alignment" class="wiki-link">D3</a>.2) |
| `defineWidget({type, mount(host, ctx)})` with `ctx.widget` | runtime→extension | Preserved (<a href="/decisions/D11-naming-defineNode-defineWidget" class="wiki-link">D11</a>) |
| `useWidgetValueStore().getWidget(graphId, nodeId, widgetName)` | internal Pinia store | Out of scope — internal, not exported |

### Replacement patterns

Extensions that previously needed `node.getWidget(name)` migrate to one of:

1. **Register a widget type** — `defineWidget({type: 'INT', mount(host, ctx) { ctx.widget.on('valueChange', ...) })`. Each instance gets its own mount call with its own `WidgetHandle`.
2. **Share state across widgets** — `provide()` an API at extension setup; each `defineWidget.mount` calls `inject()` to read it.
3. **Coordinate sibling widgets** — promote both widgets' relevant state into the extension's shared scope (`defineExtension.setup` return value); widgets read via injected accessor, not by walking the node's widget collection.

### Migration impact (v2 surface only)

| Surface | Call sites | Action |
|---|---|---|
| `src/extension-api/node.ts` | 2 declarations | Commented out + JSDoc preserved |
| `src/extension-api/widget.ts` | 2 JSDoc cross-refs | Rewritten to use `defineWidget({mount}, ctx.widget)` |
| `extensions/core/dynamicPrompts.v2.ts:19` | 1 call (`for (const widget of node.getWidgets())`) | Refactored to per-widget handling via `defineWidget` |
| tf test suite | 0 | Clean |
| Community packs / v1 | unaffected | v1 `ComfyExtension` slot path is not in scope of this ADR |

### Compatibility

- **v1 (`ComfyExtension`)**: Untouched. `ComfyExtension.nodeCreated(node) { node.widgets.forEach(...) }` continues to work via the v1 path. The bilateral rule is a **v2-only** constraint.
- **`@comfyorg/extension-api` package**: This is a `.d.ts`-shape change. The dropped methods are TypeScript-only (no JS implementation to remove); existing consumers calling `node.getWidget('steps')` will get a TS-ERR at compile time, no runtime change.
- **Codemod**: not provided — the v2 ecosystem currently has 1 call site. If the count grows during the deprecation cycle, file a follow-up for `codemod-no-node-widget-access`.

## Restoration criteria

Per the <a href="/axioms#a14-refs" class="wiki-link">A14</a> pattern, this surface returns to the public API only when **all three** hold:

1. A documented, validated ecosystem use case exists that cannot be expressed via `widget.parentNode` + `defineWidget({mount})` + `provide`/`inject`.
2. The proposal is re-audited against A1 (does it preserve "widgets can move; nodes cannot safely hold widget refs"?).
3. Behavior-triplet test coverage exists (`bc-XX` test triple) for the restored read pattern across promotion + app-mode + linked-instance scenarios.

## Implementation checklist

- [x] `src/extension-api/node.ts` — `getWidget` / `getWidgets` commented out with rationale block
- [x] `src/extension-api/widget.ts` — 2 JSDoc examples rewritten to use `defineWidget`
- [x] `extensions/core/dynamicPrompts.v2.ts` — 1 call site refactored
- [x] `AXIOMS.md` §<a href="/axioms#a14-refs" class="wiki-link">A14</a> "COMMENTED OUT" table — `getWidget()` / `getWidgets()` rows added
- [x] `scripts/check-axiom-compliance.sh` — carve-out removed; node.ts is now strict-fail on any `getWidget*` reference
- [x] ADR landed (this file)
- [x] Wave-8 cascade: foundation → pkg (cleanly downstream) → ext (with dynamicPrompts refactor) → tf
- [x] Dashboard refresh (`christian-byrne/ComfyUI_frontend-ecosystem`)
- [x] PR comments on #12142–#12145
- [x] AGENTS.md wave-8 reconciliation row
- [x] `bash scripts/sync.sh` — 0 drift, 0 orphan decisions
