# <a href="/decisions/D-widget-converge" class="wiki-link">D-widget-converge</a> — DOMWidget ↔ BaseWidget convergence

**Status**: ACCEPTED — 2026-05-18 (W6.P3.B PICK: option (iii) single `Widget` + `mount(host, ctx)` lifecycle, "going hard / firm" — no compat shim, no separate registry ADR, B10/vendor-pack blockers resolved as migration-guide rows not blockers).

## Context

`@comfyorg/extension-api` currently exposes two widget shapes:

- `WidgetOptions` / `WidgetHandle` — "native" widgets with typed `value`,
  `min`/`max`/`step`, `options`, `serializeValue`, etc. The 25+ subclass
  hierarchy below `BaseWidget` (text/number/combo/slider/seed/…) lives
  here.
- `DOMWidgetOptions` / `DOMWidgetHandle` — host-DOM widgets registered via
  `node.addDOMWidget(name, type, element, options)` (R4 P9, S4.W2). Has
  `element: HTMLElement`, optional `height`, no enforced `value` binding,
  custom `serializeValue` per author.

This split leaks across the entire codebase — interfaces, positioning in
Vue nodes, type inference, serialization, command surfaces — and is the
single biggest "special case" maintenance burden in the Vue node system.

CB's Slack proposal (design-review-12142.md row #12 + Slack post 2026-05-13):

> "DOM widgets have special handling that is littered across the code …
> The union of types is extremely confusing and the special behavior is a
> major maintenance burden. Minimal win: standardize `value` bindings and
> enforce it. More ambitious: DOM widget shouldn't exist as a concept —
> deprecate/remove `inputEl` fully, either expose `element` to ALL widgets
> or NO widgets."

Touch-points DB evidence:

- **S4.W2 `node.addDOMWidget`** — blast-radius rank #6 (★6,147 across 4
  evidenced repos; W2F-1 re-audit pending).
- **S4.W3 `widget.serializeValue` direct assignment** — rank #10 (★1,837
  across 6 evidenced repos). Almost every DOM widget reaches for this
  because the DOM widget path doesn't ship a typed `value`.
- **S4.W5 direct `widget.value` writes** — 4 evidenced repos.
- **R4 P9** (custom-node-patterns): the de-facto extension widget UX is
  DOM-first; the `inputEl` escape hatch was the loophole that produced
  the entire DOM-widget ecosystem.

Vue node system note (per CB's proposal): in the new Vue node renderer,
**every widget is technically a DOM widget** — the question is whether the
extension-api surface should reflect that internal reality or hide it.

## Decision

**Option (iii) — single `Widget` interface with optional `mount(host, ctx)` lifecycle.** The DOM/native distinction is structurally removed from the v2 extension-api surface; `addDOMWidget`, `widget.element`, `widget.inputEl`, and the `DOMWidgetOptions` type are deleted from the v2 surface. The mount hook is the only DOM seam.

**Clarifications baked into the picked shape:**

1. **`mount()` cleanup contract is destruction-only.** The returned `WidgetCleanup` function fires exactly once, when the widget entity is destroyed. Host-remount (<a href="/api-docs/graph" class="wiki-link">graph</a>↔app mode, subgraph promotion, `<KeepAlive>` shuffle) does NOT fire cleanup — it fires `ctx.onBeforeRemount(fn)` then `ctx.onAfterRemount(newHost => …)`. This matches Vue `<KeepAlive>` semantics and the CONTEXT.md R3/<a href="/decisions/D7-widget-shape-and-persistence" class="wiki-link">D7</a> subgraph-promotion model.
2. **Host ownership is per-widget, runtime-managed.** `host` is an empty `<div>` the runtime owns and provides to the widget; the widget's mount body appends/mutates inside that div but does NOT manage the div itself. This makes remount-via-DOM-move trivial (the runtime moves the host div; the widget tree inside follows) and gives the runtime a clean attachment point for measurement, scroll preservation, and event delegation.
3. **B10 (custom widget type registry) is resolved by `defineWidget()` itself, no separate ADR.** Custom widget types like `'asset'` / `'chart'` / `'imagecompare'` register via `defineWidget({ type, mount, … })`. If no `defineWidget` is registered for a `type`, the widget does not render — the loose v1 fallback ("hope the runtime renders something") is removed by design. The 4 EXT repos / 22 hits / ★116 in B10 stay on v1 during the <a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a> parallel-paths window and port to `defineWidget` for v2.
4. **D-dom-widget-compat-shim is NOT pursued.** Vendor packs that depend on `widget.element` / `widget.inputEl` continue to work through the v1 path during the <a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a> parallel-paths window. When v1 sunsets (<a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a> Phase D), unmaintained packs that wrote against v1-only patterns break — the migration guide documents this as an explicit, deliberate cliff, not a runtime promise.

**Three candidate shapes that were on the table (kept for historical context):**

### Option (i) — Discriminated union: `kind: 'dom' | 'native'`

```ts
type WidgetOptions =
  | (NativeWidgetOptions & { kind: 'native' })
  | (DOMWidgetOptions & { kind: 'dom' })
```

Authors choose explicitly at registration; runtime narrows on the
discriminant. Existing DOMWidget callsites add `kind: 'dom'`; existing
native ones add `kind: 'native'` (or default).

### Option (ii) — `DOMWidgetOptions extends WidgetOptions` with optional element

```ts
interface DOMWidgetOptions extends WidgetOptions {
  element: HTMLElement
  // inherits min/max/step/options/serializeValue/value
}
```

DOM widgets become a subtype: every DOM widget IS a widget, with the
extra `element` property. Inapplicable inherited fields (min/max/step on
a button-style DOM widget) become explicitly `undefined`.

### Option (iii) — Single `Widget` interface with optional `mount(element)` lifecycle

```ts
interface WidgetOptions {
  type: WidgetType
  name: string
  value?: WidgetValue
  // ... existing fields
  mount?(host: HTMLElement, ctx: WidgetMountContext): void | (() => void)
  // optional cleanup return
}
```

Collapses the two surfaces entirely. DOM widgets are widgets that
provide a `mount` lifecycle hook; native widgets omit it. Mirrors Vue
SFC `<script setup>` + `onMounted` ergonomics. Most ambitious — touches
the largest surface.

(Other shapes — full SFC-style registration, Vue-runtime hosted widgets
— are deferred to a separate later ADR; they require the Vue node
renderer to be the only renderer, which is post-D6 sunset.)

## Consequences

**Common (any option):**

- Migration path for v1 DOMWidget consumers must survive the D6.2 Gate 3
  migration-guide window. The S4.W2 + S4.W3 + S4.W5 cluster is much larger
  than the current `rollup.yaml` baseline reflects — R2 escalations
  (`research/architecture/D-widget-converge-blast-radius.md §R2`):
  S4.W2 7.8× repos / 16× hits, S4.W3 3.2× / 4.5×, S4.W5 13× / 66×.
- `serializeValue` direct assignment (S4.W3) **is already TS-ERR** through
  v2 `WidgetHandle` after W6.P8.C (commit `df921f3512`) — accessor-only,
  no setter. All three options inherit this cliff.
- `widget.inputEl` and `widget.element` reads surface as **net-new
  high-volume patterns** the DB does not yet first-class: 41-repo / 251-hit /
  ★14,875 and 31-repo / 160-hit / ★10,307 respectively. R4 will need new
  S4.W9/W11 entries regardless of which option lands.
- `widget.type === 'X'` discrimination is structurally universal
  (37 EXT repos, 140 hits, ★17,015) — any option must preserve or
  replace this branching surface.
- The orthogonal **B10** bucket — `addWidget('non-standard-type', …)` for
  custom widget types like `'asset'` / `'chart'` / `'imagecompare'` — is
  UNMIGRATABLE under all three options and requires a separate
  `D-custom-widget-type-registry` ADR.

**Per-option deltas** — see §Brainstorm below (W6.P3.A).

## Brainstorm (W6.P3.A) — DATA ONLY

> Process discipline: this section enumerates pros/cons per option grounded
> in R1/R2/R3 evidence. **No verdict, no recommended option, no preference
> language.** The PICK is W6.P3.B (human-in-the-loop). Per the brief, the
> human may surface a hybrid option not enumerated here — be ready to
> draft it on request.

### Option (i) — Discriminated union `kind: 'dom' | 'native'`

```ts
type WidgetOptions =
  | (NativeWidgetOptions & { kind: 'native' })
  | (DOMWidgetOptions   & { kind: 'dom' })
```

**Pros (evidence-grounded):**
- Smallest type-system change. R3 B1/B1a/B1b/B1c all evaluate to ZERO at
  the call site (signature unchanged; runtime narrows on which method
  was invoked). 192 EXT addDOMWidget call sites remain valid as-written.
- B4/B5 (inputEl/element reads) compile under `kind: 'dom'`; the TS-ERR
  cliff is confined to code paths that mix native + dom widgets — a small
  subset of the 41+31 repo footprint.
- Preserves author mental model — extensions still think "I want a DOM
  widget" vs "I want a native widget" and choose at registration.
- 67% of EXT addDOMWidget call sites are value-bound (R2): the `kind` tag
  is a documentation win even if its only function is type narrowing.
- Plays cleanly with the existing W2F-1 `widget.type === 'X'` discriminator
  cluster (37 repos / 140 hits) — `kind` and `type` answer different
  questions (rendering family vs widget-type label).

**Cons (evidence-grounded):**
- Maintenance burden CB's Slack proposal flagged remains: two surfaces still
  exist under a `.kind` label. Internal renderer code still branches on
  `widget.kind === 'dom'` for positioning / serialization / focus.
- The 33% of EXT call sites that are no-value / ref-bound (R2: 47 + 16
  hits across 38 repos) carry the same DOM-special-handling code paths
  the proposal flagged — the discriminant doesn't eliminate them.
- Vue node renderer reality (per CB's proposal: "every widget is technically
  a DOM widget" in the new renderer) is not reflected in the type system.
- If `kind` is a runtime field (not just type-level), every existing
  `addDOMWidget` call inside the corpus is TS-ERR until authors add
  `kind: 'dom'` — mechanical sed but still a migration step on 192 hits.
- B7 (`widget.type === 'dom'` checks) becomes ambiguous if `'dom'` is
  also a `kind` value — naming collision risk.

### Option (ii) — `DOMWidgetOptions extends WidgetOptions` with optional `element`

```ts
interface DOMWidgetOptions extends WidgetOptions {
  element: HTMLElement
  // inherits min/max/step/options/serializeValue/value
}
```

**Pros (evidence-grounded):**
- Single interface root; narrows via `'element' in widget` — R3 B5 is ZERO
  for the 31-repo / 160-hit / ★10,307 `widget.element` cluster.
- B1 (192 addDOMWidget call sites) stays ZERO — signature unchanged,
  subtype carries `element`.
- Aligns with the W6.P8.C <a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> universalisation already in flight: every
  widget has typed `value`, so the 92-repo / 790-hit / ★27,042 `widget.value`
  cluster (B3) is ZERO regardless.
- Keeps the v1 mental model ("a DOM widget is a widget with an element")
  literal — easiest migration narrative for the 47 EXT addDOMWidget repos.
- TS-ERR landing zone is small: only B4 (`widget.inputEl` read) hits the
  cliff, and only on the 5 highest-impact consumers
  (Easy-Use × 2, m3rr h4_Live, comfy_mtb, AnimateDiff — ★≈5,657 cum).

**Cons (evidence-grounded):**
- Inapplicable inherited fields are noise: 47 + 16 = 63 no-value/ref-bound
  call sites across 38 repos surface `value`/`min`/`max`/`step` as optional
  type-fields they will never use. The IDE will autocomplete them.
- Internal renderer code still branches on `widget.element != null` — the
  maintenance burden CB flagged is reduced (one type tree) but not removed.
- B7 (DOM-as-`.type` discriminator) remains the canonical discriminant —
  changing it to `'element' in w` requires touching 37 EXT repos' branching
  code (ZERO at compile time, but stylistic mismatch with idiomatic v1).
- Does not reflect the Vue node renderer reality (every widget is DOM
  internally); the API exposes a distinction the runtime does not enforce.

### Option (iii) — Single `Widget` + optional `mount(host, ctx)` lifecycle

```ts
interface WidgetOptions {
  type: WidgetType
  name: string
  value?: WidgetValue
  // ... existing fields
  mount?(host: HTMLElement, ctx: WidgetMountContext): void | (() => void)
}
```

**Pros (evidence-grounded):**
- Genuinely converges the two surfaces. The maintenance burden CB flagged
  ("special handling littered across the code") is structurally removed
  — internal renderer code stops branching on widget type and instead
  calls `widget.mount?.(host, ctx)` uniformly.
- Matches the Vue node renderer reality the proposal cited ("every widget
  is technically a DOM widget in the new Vue node renderer").
- Mirrors Vue SFC `<script setup>` + `onMounted` ergonomics; consistent
  with the <a href="/decisions/D-bootstrap-hooks" class="wiki-link">D-bootstrap-hooks</a> ACCEPTED ADR (W6.P6) that introduced
  context-scoped `onMounted` / `onBeforeMount` / `onUnmounted` hooks
  inside `defineExtension.setup`. Authors learn one lifecycle pattern.
- 24% of EXT addDOMWidget call sites (47 hits / 26 repos / ★9,473) are
  no-value display-only widgets that fit the mount-lifecycle naturally
  with zero additional plumbing.
- B3 (`widget.value=` 92 repos / 790 hits / ★27,042) stays ZERO — value
  binding is universal and orthogonal to mount lifecycle.
- Most ambitious option = most thorough cleanup. The B1d worst-case
  bucket (DOM widget + serializeValue override + value-bound) becomes
  the *standard* shape under mount + <a href="/decisions/D5-events-and-payload-typing" class="wiki-link">D5</a> `on('beforeSerialize')`, not a
  special case.

**Cons (evidence-grounded):**
- Largest cascade — REWRITE-METHOD across all 192 EXT addDOMWidget call
  sites (47 repos / ★13,546). Mechanical sed is insufficient; element
  construction must move into the `mount` body.
- B4 + B5 (inputEl/element reads — 41+31 = 72 EXT repos / 411 hits /
  ★25,182 combined) become TS-ERR / RUNTIME-THROW. Authors must capture
  the element via mount() closure or returned ref — not a one-line edit.
- B7 (`widget.type === 'dom'` discriminator) becomes SILENT-NOOP — DOM
  as a `type` value disappears. Plain-JS consumers get no compile-time
  signal; checks silently become permanently false.
- Vendor packs that cannot be edited (archived repos, paid distributions)
  are RUNTIME-THROW without a `D-dom-widget-compat-shim` ADR providing
  synthesized `widget.element` / `widget.inputEl` aliases.
- Author mental model shift: "I'm declaring a DOM widget" → "I'm declaring
  a widget that mounts an element". The change is well-precedented (Vue
  SFC, React function components) but unfamiliar to the v1 author base.
- Highest-impact REWRITE-METHOD consumers (R3 §Highest-impact): PGCRT
  CRT-Nodes (18), pixaroma (13), IAMCCS (10), r-vage Eclipse (10),
  Easy-Use × 2 (8+8), comfy_mtb (7), AlekPet (7) — these 8 repos account
  for 81/192 (42%) of all EXT addDOMWidget call sites.

### Cross-option observations

- The B10 UNMIGRATABLE bucket (custom-widget-type registry — 4 repos,
  22 hits) is invariant across options i/ii/iii. A separate
  `D-custom-widget-type-registry` ADR is required regardless of which
  option is picked.
- The <a href="/decisions/D-bootstrap-hooks" class="wiki-link">D-bootstrap-hooks</a> precedent (W6.P6 ACCEPTED) introduced a
  context-scoped lifecycle pattern (`onMounted` inside `setup`); option
  (iii) extends that pattern to widgets, option (ii) does not, option
  (i) is neutral. Consistency with existing accepted ADRs is an
  observation, not a verdict.
- W6.P8.C has already paid the W6.P8.C cliff for `serializeValue=`
  (B2: 32 repos / 63 hits / ★16,447) — none of the three options can
  un-pay it. The marginal cost of option (iii) is the REWRITE-METHOD
  cascade on top, not the cliff itself.

## Alternatives considered

| Option | Migration cost (R3 dominant cell) | Pro | Con | Verdict |
|---|---|---|---|---|
| (i) discriminated union | ZERO at call site; **TS-ERR** at B4/B5 under `kind: 'native'` (small overlap) | Smallest type-system change; preserves current author mental model; 192 EXT call sites stay valid | Two surfaces remain under a `.kind` label — maintenance burden reduced but not removed; doesn't reflect Vue-node-renderer reality | **Rejected** — half-measure; would require this ADR conversation again in 18 months |
| (ii) DOMWidget extends <a href="/glossary#widget" class="wiki-link">Widget</a> | ZERO at call site; **TS-ERR** at B4 only (5 high-impact consumers) | Single interface root; type narrowing via `'element' in widget`; aligns with W6.P8.C <a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> universalisation | Inapplicable inherited fields become noise on 63 no-value/ref-bound call sites; doesn't match Vue-renderer reality | **Rejected** — reduces but doesn't remove the maintenance burden; type-noise across 63 no-value/ref-bound sites |
| (iii) single Widget + `mount` | **REWRITE-METHOD** on all 192 EXT call sites; **TS-ERR/RUNTIME-THROW** on B4+B5 (72 repos / 411 hits / ★25,182) | Genuinely converges the two surfaces; matches Vue node renderer reality; consistent with <a href="/decisions/D-bootstrap-hooks" class="wiki-link">D-bootstrap-hooks</a> accepted lifecycle pattern | Largest cascade; vendor packs un-editable without compat-shim ADR; 8 high-impact repos absorb 42% of REWRITE work | **PICKED** — v2 is greenfield; the REWRITE cost is opt-in by author at v1→v2 port time, not forced. v1 keeps working through D6 parallel-paths window. |
| (iv) keep status quo | ZERO | Zero work | Leaves the maintenance burden CB's proposal flagged; rejected by W6.P3 framing | Rejected |

## Implementation plan

**Foundation (W6.P3.C) — `ext-api/i-foundation-v2` worktree:**

| Step | Action | File | Verification |
|---|---|---|---|
| 1 | Add `WidgetMountContext`, `WidgetCleanup`, `WidgetMountFn` exports | `src/extension-api/widget.ts` | `pnpm lint` |
| 2 | Replace `WidgetExtensionOptions.created({render,destroy})` with `mount(host, ctx)` returning optional `WidgetCleanup` | `src/extension-api/types.ts` | `pnpm lint` |
| 3 | Delete `DOMWidgetOptions` interface from node.ts (the type is gone, not deprecated) | `src/extension-api/node.ts` | `pnpm lint` |
| 4 | Delete `NodeHandle.addDOMWidget()` method (the method is gone, not deprecated) | `src/extension-api/node.ts` | `pnpm lint` |
| 5 | Update `WidgetHandle.setHeight()` JSDoc — drop "DOM widgets only"; now applies via mount-lifecycle reserved-height contract | `src/extension-api/widget.ts` | doc-only |
| 6 | Cross-reference doc updates: `WidgetHandle.options` and `WidgetHandle.serializeValue` JSDocs reference <a href="/decisions/D-widget-converge" class="wiki-link">D-widget-converge</a> instead of the placeholder "W6.P3" stub | `src/extension-api/widget.ts` | doc-only |
| 7 | Update barrel — keep `defineWidget` export, drop `DOMWidgetOptions` re-export | `src/extension-api/index.ts` | `pnpm knip` |
| 8 | Phase A gates: `lint && format:check && knip` | — | passes per Rule #8 |
| 9 | Commit + mirror to `ext-api/i-foundation-restratify`; force-with-lease push both | — | divergence check = 0 |
| 10 | Sync workspace; verify drift = 0 + propagation OK | — | `bash scripts/sync.sh` |

**Cascade (W6.P3.D) — pkg / ext / tf worktrees + dashboard + DB:**

| Step | Action | Branch | Verification |
|---|---|---|---|
| 11 | Regenerate `.d.ts` for `@comfyorg/extension-api` package | `ext-api/i-pkg-v2` | `pnpm build:dts` |
| 12 | Update example extensions that demonstrated `addDOMWidget` to use `defineWidget({mount})` | `ext-api/i-ext-v2` | example builds clean |
| 13 | TF stack: fix follow-on TS errors created by the surface change (expected per Rule #8) | `ext-api/i-tf-v2` | reduced TS-err count vs baseline |
| 14 | DB amend (R4): add S4.W11 (inputEl-read), S4.W9 (element-read), S4.W10 (widget.type discriminator); amend S4.W2/W3/W5 with R2 escalation evidence | workspace | rollup regenerated |
| 15 | Dashboard refresh (R5): `bash scripts/refresh-api-docs.sh` in `christian-byrne/ComfyUI_frontend-ecosystem` | dashboard | preview shows new surface |
| 16 | PR comment on `#12142` summarizing P3 PICK + <a href="/decisions/D-widget-converge" class="wiki-link">D-widget-converge</a> ACCEPTED + foundation impl SHAs | PR #12142 | gh pr comment URL |

**Follow-on ADRs unblocked by this decision:**

- None. B10 and vendor-pack concerns are migration-guide rows, not separate ADRs.

**Migration-guide rows owed to `docs/extensions/migration-v1-to-v2.md` (D6.2 Gate 3):**

| Row | v1 pattern | v2 equivalent |
|---|---|---|
| MG.W1 | `node.addDOMWidget(name, type, el, opts)` | `defineWidget({type, mount(host, ctx) { host.appendChild(el); return () => el.remove(); }})` registered + node uses `addWidget(type, name)` |
| MG.W2 | `widget.element` / `widget.inputEl` | Capture element in `mount()` closure; refer to via closure binding |
| MG.W3 | `widget.serializeValue = fn` (already cliffed by W6.P8.C) | `widget.on('beforeSerialize', e => e.setSerializedValue(...))` per <a href="/decisions/D5-events-and-payload-typing" class="wiki-link">D5</a> |
| MG.W4 | `widget.value = newVal` (already cliffed by <a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a>) | `widget.setValue(newVal)` per D14 |
| MG.W5 | `widget.type === 'dom'` / `=== 'DOMWidget'` discriminators | Check by widget.type (the type label you defined); DOM-as-discriminant disappears |
| MG.W6 | `node.addWidget('custom-type', …)` for unregistered types | Register via `defineWidget({type: 'custom-type', mount})` first; v2 has no loose fallback |
| MG.W7 | Vendor packs depending on `widget.element` / `widget.inputEl` that cannot be edited | No v2 path. Remain on v1 surface during D6 parallel-paths window; break at D6 Phase D sunset. |

## References

- design-review-12142.md row #12 (the open-research item this ADR closes)
- W6.P3 task block in `todo.md` (Wave-6 section)
- D14 — widget state categories (the convergence target for `value`/`state`)
- D14 — serialization convergence (the convergence target for `serializeValue`)
- <a href="/decisions/D7-widget-shape-and-persistence" class="wiki-link">D7</a> — widget shape and persistence (preceding shape decision; D-widget-converge supersedes its DOM/native split if option iii lands)
- R4 P9 — custom-node-patterns audit (DOM widget ecosystem)
- research/touch-points/database.yaml entries S4.W2, S4.W3, S4.W5
- AGENTS.md "Decision propagation rules" — once accepted, must reach (a) commit on PR #12142, (b) this ADR, (c) dashboard JSON
