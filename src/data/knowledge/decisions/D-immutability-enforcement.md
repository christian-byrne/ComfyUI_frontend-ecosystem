# <a href="/decisions/D-immutability-enforcement" class="wiki-link">D-immutability-enforcement</a> — Consistent immutability rules across the API surface

**Status**: ACCEPTED — 2026-05-14 (W6.P8.B PICK 2026-05-14 handoff-6 by Christian)

## Context

Slack proposal (`#p-frontend-graph-improvements`, 2026-05-12 23:51):

> "We want to specify what is and is not immutable. For example, mutating
> `node.widgets` SHOULD NOT be allowed and the fact that it happens has
> potentially costed us months of engineering time and lots of guessing
> as to what is causing things to break. `node.widgets` is not the only
> case but it's a prominent one."

Design-review row #14 ("Immutability enforcement") accepted the
direction in the Decisions table — "Return fresh copies. Standardize
across codebase — needs ADR" (2026-05-12) — but no ADR was authored
and no implementation task block was scheduled. This skeleton closes
the loop on leg (b) of the propagation triple.

The current v2 surface is inconsistent:

- Some accessors return live references (`node.widgets`,
  `node.inputs`, `node.outputs` — direct array references that allow
  `node.widgets.push(…)`, `node.widgets[0].value = X`, etc.).
- Others return computed views (`getWidgets()` — <a href="/decisions/D11-naming-defineNode-defineWidget" class="wiki-link">D11</a>/restratify
  rename).
- Others return method-returned tuples (`getPosition()` returns a
  fresh object).

The R7 touch-points DB shows ecosystem evidence of the bug class:

- **S2.N16 `node.widgets` array access / mutation** — direct
  mutation pattern across Eclipse, Copilot, KJNodes, etc. (5+ packs in
  pass-1 sweep).
- **S4.W3 `widget.serializeValue` direct assignment** — extension
  authors write to `widget.serializeValue = fn` because the alternative
  paths (typed events) are missing.
- **S4.W5 direct `widget.value` writes** — 4 evidenced repos.

### Evidence base (R1 + R2 + R3, landed 2026-05-14 handoff-6)

Source: `research/architecture/D-immutability-enforcement-blast-radius.md`.
Bulk-clone grep against the W2F-1 138-repo corpus (4,081 source files;
26 patterns gated on per-pattern receiver allowlists).

- **6,504** total hits (3,512 WRITE / 2,992 READ). **3,070** WRITE hits
  in 116 EXT repos sit in the R3 effects matrix.
- **116 / 138** corpus repos (84%) have ≥1 WRITE — the surface is
  pervasive, not concentrated in a few outlier packs.
- **8 mutation families** evidenced: widget.value, widget.options,
  widget.serializeValue, node.widgets, node.inputs, node.outputs,
  node.size, node.pos. Slack proposal cited `node.widgets`; R1 shows
  it is the second-largest family by repo count (69 repos) but
  fourth by cum-stars after widget.value, node.pos, node.widgets,
  node.inputs.
- **Per-family EXT cum-stars** (top to bottom):
  widget.value 43,582 / node.pos 25,286 / node.widgets 24,809 /
  node.inputs 18,664 / widget.serializeValue 16,447 /
  node.outputs 16,372 / node.size 12,859 / widget.options 11,898.
- **Aggregate cost-bucket frequencies per option** (5,819 EXT hits in
  matrix):
  - (i) fresh-copies → 4,100 ZERO + 1,719 SILENT-NOOP
  - (ii) Readonly+freeze → 2,749 ZERO + 3,070 TS-ERR
  - (iii) mutator-only → 2,749 ZERO + 3,070 REWRITE-METHOD
    (of which ~225 hits in `UNMIGRATABLE` cells absent companion new
    surfaces — see R3 §UNMIGRATABLE call sites)

## Decision

**Hybrid C — `ReadonlyArray<T>` / `Readonly<T>` types in the public `.d.ts`,
applied to all 8 mutation families. NO runtime enforcement at decision time;
`Object.freeze` dev-mode is deferred to a follow-up task (W6.P8.FREEZE).**

Picked by Christian 2026-05-14 (handoff-6) after R1+R2+R3 data + W6.P8.A
brainstorm + hybrid-shapes interactive discussion (transcript: chat thread
T-019e3cad-e5bd-7508-a227-6f96ea99c2ed). The pick emerged from a 4th
shape ("Hybrid C") that combined option (i)'s zero runtime cost with
option (ii)'s compile-time signal — Readonly types only, no `Object.freeze`,
no `Proxy`. Mirrors how Redux strict-state, immer's autoFreeze, and Vue
`readonly()` shape read-only surfaces for library consumers, minus the
runtime enforcement leg.

### What ships under this decision (P8.C foundation + P8.D cascade)

1. **`.d.ts` typing**: every accessor that returns one of the 8 mutation
   targets returns a `ReadonlyArray<Readonly<T>>` / `Readonly<T>`:
   - `node.getWidgets(): ReadonlyArray<Readonly<Widget>>` (replaces `node.widgets`)
   - `node.getInputs(): ReadonlyArray<Readonly<NodeInput>>`
   - `node.getOutputs(): ReadonlyArray<Readonly<NodeOutput>>`
   - `node.size: readonly [number, number]` (tuple)
   - `node.pos: readonly [number, number]`
   - `widget.options: Readonly<WidgetOptions>` (per <a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> widget-state)
   - `widget.serializeValue` accessor (no setter on the public type — <a href="/decisions/D5-events-and-payload-typing" class="wiki-link">D5</a>
     `'beforeSerialize'` event is the v2 migration target)
   - `widget.value` keeps the existing setter pair per <a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> (READ+WRITE
     both allowed because the setter proxies through to the underlying
     widget; this is the ZERO row in R3)
2. **Codemod stub**: a small codemod (`scripts/codemod-immutability.ts`)
   that rewrites the 6 most common idioms to their handle-method
   equivalents — published alongside the migration guide.
3. **Migration guide**: `docs/extensions/migration-v1-to-v2.md`
   §Immutability section with the 8-family rewrite table + codemod
   invocation.
4. **`@deprecated` JSDoc** on each affected old surface pointing at the
   replacement handle method, so v2-consumers see the warning in their
   IDE even before they hit the TS error.

### What is explicitly NOT in scope under this decision

- **No `Object.freeze` at runtime** — neither in dev nor prod. Deferred to
  W6.P8.FREEZE follow-up.
- **No `Proxy`-based enforcement** — Hybrid A rejected (per-access
  overhead + identity-break risk + DevTools confusion not worth the
  prettier error message).
- **No new mutator-method surfaces** beyond what already exists today
  (<a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> widget setters, existing add/remove input/output/widget methods).
  The ~225 `UNMIGRATABLE` hits in option (iii)'s R3 cells need
  separate ADRs to cover (<a href="/decisions/D-widget-converge" class="wiki-link">D-widget-converge</a> W6.P3 likely covers
  options-bulk; inputs/outputs per-field setters need a fresh ADR —
  tracked as W6.P8.UNMIGRATABLE).
- **No major-version bump compulsion** in this PR — the typing change
  is a soft cliff (consumers see TS errors when they pin to the new
  version; they can stay on the old version indefinitely).

### Migration cost recap (from R3, EXT scope)

- **3,070 WRITE hits** across **116 EXT repos** surface as TS errors
  at compile time when the consumer adopts the new typing.
- **2,749 READ hits** are unaffected (`ReadonlyArray<T>` supports
  iteration / spread / map / filter).
- **~80% of the rewrite surface maps to handle methods that already
  exist** — codemod scope.
- **~225 hits** in `UNMIGRATABLE` cells need follow-up ADRs before
  consumer rewrites can finish; until then, those sites stay as TS
  errors with `// TODO(D-immutability)` comments.

### Why this shape over the others

- **Loud at compile time, not at runtime** — authors learn about the
  bug class while building, not while debugging "looks like it
  worked" in production. Highest-leverage signal location.
- **Zero runtime cost** — no `Object.freeze` traversal, no `Proxy`
  per-access overhead. Production performance identical to today.
- **No <a href="/decisions/D8-world-vue-reactive-adapter" class="wiki-link">D8</a> reactive-adapter interaction risk** — no frozen objects
  flowing through the Vue ↔ <a href="/glossary#world" class="wiki-link">World</a> adapter.
- **`as any` / `@ts-ignore` / JS-not-TS escape gap is the explicit
  trade** — accepted in exchange for shipping the typing surface
  fast. The follow-up W6.P8.FREEZE closes that gap when prioritized.
- **Established pattern** — matches how Redux strict-state, immer's
  autoFreeze, and Vue's `readonly()` (at the TypeScript layer) all
  shape the read-only surface for library consumers, minus the
  runtime leg.

### Follow-ups created

- **W6.P8.FREEZE** — `Object.freeze` dev-mode enforcement to catch
  `as any` / `@ts-ignore` / JS-not-TS escapes at runtime in dev.
  Tracked in todo.md as `[future / nice-to-have]` after W6.P8.D.
- **W6.P8.UNMIGRATABLE** — Address the ~225 hits that have no v2
  surface today: bulk `setOptions(opts)`, `setInputField(i, key, val)`,
  `setOutputField(i, key, val)`, `replaceInput(i, def)`,
  `replaceOutput(i, def)`. Likely rolls into <a href="/decisions/D-widget-converge" class="wiki-link">D-widget-converge</a> (W6.P3)
  for the options-bulk slice; inputs/outputs per-field setters need a
  fresh ADR.

### Skeleton-section options retained below for paper trail

(The three skeleton-time option sketches stay here unedited so the
"how the brainstorm arrived at Hybrid C" record is complete. The
full pros/cons matrix lives under §Alternatives.)

### Option (i) — Return fresh copies, runtime-only enforcement

Every accessor that today returns a live array/object returns a
shallow-cloned copy:

```ts
interface NodeHandle {
  getWidgets(): Widget[]    // returns new array each call
  getInputs(): InputSlot[]
  getOutputs(): OutputSlot[]
  getPosition(): { x: number; y: number }
}
```

Authors who try `node.getWidgets().push(w)` mutate a copy and the
real state is unaffected — silent no-op, which the audit may show is
itself a bug class. Cost: object allocation per call (mitigable via
memoization while no mutation happens internally); silent no-op
debugging story.

### Option (ii) — `ReadonlyArray` / `Readonly<T>` types + runtime freeze in dev

Compile-time `Readonly<...>`/`ReadonlyArray<...>` typing on every
accessor return value plus `Object.freeze` in dev mode (no-op in
production for performance):

```ts
interface NodeHandle {
  getWidgets(): ReadonlyArray<Readonly<Widget>>
  getInputs(): ReadonlyArray<Readonly<InputSlot>>
  // ...
}
```

TS enforces no `.push()` / no field-assignment at compile time;
`Object.freeze` catches casts/`as any` escape hatches in dev (throws on
mutation in strict mode). Cost: `Readonly<Widget>` makes
field-by-field mutation impossible AT THE TYPE LEVEL, but extension
authors today reach for those mutations — every legitimate v1 mutation
must be reshaped into a typed mutator method on the handle.

### Option (iii) — Mutator-method-only API; remove all collection accessors

Drop direct collection accessors entirely. Authors interact through
typed mutator methods on the handle that internally produce ECS
commands (per ADR 0003):

```ts
interface NodeHandle {
  // No getWidgets() / getInputs() — read via specific queries only
  findWidget(name: string): WidgetHandle | undefined
  forEachWidget(fn: (w: WidgetHandle) => void): void
  addWidget(opts: WidgetOptions): WidgetHandle
  removeWidget(name: string): void

  // Position via methods only
  getPosition(): { x: number; y: number }
  setPosition(p: { x: number; y: number }): void
}
```

Most ambitious. Aligns with ECS command-pattern (ADR 0003 + ADR 0008).
Costs: deepest API rework; iteration patterns get more verbose
(`forEachWidget` instead of `.widgets.map()`); collection-comprehension
ergonomics regress.

## Consequences

**Common (any option):**

- Migration cost is concentrated in the same blast-radius cluster
  flagged for D14 (S4.W*) and <a href="/decisions/D-widget-converge" class="wiki-link">D-widget-converge</a> (S2.N16). The same
  consumers will need touch — schedule the migrations together if
  possible.
- Whichever option ships must include a "list of fields/methods that
  ARE mutable and where to mutate them" appendix in the migration
  guide. Authors today need a where-do-I-put-this answer.
- The ECS World ↔ Vue reactive adapter (<a href="/decisions/D8-world-vue-reactive-adapter" class="wiki-link">D8</a>) interaction matters: any
  fresh-copy / `Object.freeze` strategy must coexist cleanly with the
  reactivity layer's tracking dependencies.

**Per-option deltas** are intentionally not enumerated yet — those
land during W6.P8.B.

## Alternatives considered

### Option (i) — fresh copies, runtime-only enforcement

**Pros (sourced from R1+R2+R3):**

- **4,100 / 5,819** EXT hits (70%) become `ZERO` cost — every READ
  pattern is unaffected, plus the `WIDGET_VALUE_WRITE` family (976
  hits) and `node.size`/`node.pos` wholesale-assign rows (346 hits)
  flow through accessor pairs without surface change.
- Smallest TS-type change — `.d.ts` only needs the accessor pair on
  `value` / `size` / `pos`; arrays remain `Widget[]` / `Input[]` /
  `Output[]`.
- Preserves array-comprehension ergonomics: `node.getWidgets().map(...)`,
  `node.getWidgets().filter(...)`, `for (const w of node.getWidgets())`
  all work as written.
- Per-call allocation cost is mitigable via memoization while
  internal state is unchanged (invalidate on next mutation).
- No new mutator-method surface required — option (iii)'s ~225
  `UNMIGRATABLE` hits don't apply.

**Cons (sourced from R1+R2+R3):**

- **1,719 / 5,819** EXT hits (30%) become `SILENT-NOOP` — the WRITE
  executes against a fresh copy and the source state is unchanged
  without any error or warning surfacing. This is the bug class
  Slack flagged ("looks like it worked"); option (i) removes the
  mechanism but replaces the symptom with a quieter one.
- 8 families × ~22 distinct call-site idioms across 116 EXT repos
  would need migration guidance ("if you used to do X, now do Y").
- <a href="/glossary#widget" class="wiki-link">Widget</a> shape mismatch under D14: `WIDGET_VALUE_WRITE` is ZERO
  only if the v2 `.value` setter writes through to the underlying
  widget; if the handle returns a copy of the widget that's
  internally re-resolved on next read, the setter pattern breaks
  silently.

### Option (ii) — `ReadonlyArray<T>` / `Readonly<T>` types + dev-mode `Object.freeze`

**Pros (sourced from R1+R2+R3):**

- **3,070** EXT WRITE hits surface as `TS-ERR` at compile time —
  authors learn at build time, not at runtime, that the mutation
  is disallowed. No silent no-ops anywhere in the matrix.
- **2,749** READ hits stay `ZERO` — no rewrite needed for the
  iteration / value-read surface.
- Dev-mode `Object.freeze` catches `as any` and `// @ts-ignore`
  escape-hatch mutations that would otherwise bypass option (i).
- No new mutator-method surface required at the foundation level —
  authors can still call into the existing v1-style mutators where
  they survive, or be guided to handle-level setters case by case.
- Preserves accessor ergonomics — `getWidgets()` still returns an
  iterable; only the **type** says you can't push.

**Cons (sourced from R1+R2+R3):**

- **3,070 compile-time errors** is the most concentrated
  fix-everything-at-once burden across the 3 options. Every EXT
  consumer that upgrades the `@comfyorg/extension-api` package
  major version sees this cliff in a single TS pass.
- `Readonly<Widget>` makes field-by-field mutation
  type-impossible — every legitimate v1 mutation (e.g.
  `widget.label = "new"`) must be reshaped into a typed mutator on
  the handle. The R3 matrix flags `WIDGETS_INDEX_FIELD_WRITE` (247
  hits) and the analogous inputs/outputs rows as needing per-field
  setters that don't all exist today.
- <a href="/decisions/D8-world-vue-reactive-adapter" class="wiki-link">D8</a> World ↔ Vue reactive adapter interaction risk: the adapter
  must tolerate frozen inputs (or skip them) without losing
  tracking. Spec adjustment in D8 likely.
- Performance: `Object.freeze` in dev mode adds traversal cost on
  every accessor return; production no-op cleans this up but the
  dev-mode hot path is non-trivial.

### Option (iii) — mutator-method-only API; remove all collection accessors

**Pros (sourced from R1+R2+R3):**

- Cleanest end-state — every state transition routes through a
  named, typed, command-shaped method. Aligns directly with ADR
  0003 (command pattern for all mutations) and ADR 0008 (ECS
  command dispatch).
- **3,070** WRITE hits become `REWRITE-METHOD` — 1-line rewrites
  per call site, mechanical codemod-friendly (`node.widgets.push(w)`
  → `node.addWidget(opts)`; `widget.value = X` → `widget.setValue(X)`).
- ~80% of the rewrite surface maps to **handle methods that
  already exist** (D14 widget setters, existing
  `addWidget/removeWidget/addInput/removeInput/addOutput/removeOutput`
  on the LiteGraph layer). The new-surface delta is concentrated
  in the UNMIGRATABLE list below.
- Iteration through `forEachWidget(fn)` / `findWidget(name)` /
  query helpers gives the foundation a place to enforce ECS
  ordering invariants (per-frame batching, mutation isolation).

**Cons (sourced from R1+R2+R3):**

- **3,070** REWRITE-METHOD rewrites is the same fix-everything
  ecosystem touch as option (ii), but with a code-gen rewrite per
  site instead of a TS-error fix per site. Codemod scope is the
  full 116 EXT repos.
- **~225 EXT hits** sit in `UNMIGRATABLE` cells under option (iii)
  absent new surfaces — they need foundation work beyond P8.C:
  - `INPUTS_INDEX_FIELD_WRITE` / `OUTPUTS_INDEX_FIELD_WRITE` writes
    to **arbitrary fields** on input/output slot objects (478 hits
    combined across 21+ repos) — v2 today exposes `setInputName(i,
    name)` / `setOutputName(i, name)` but no general per-field
    setter family.
  - `INPUTS_INDEX_ELEM_WRITE` / `OUTPUTS_INDEX_ELEM_WRITE`
    (whole-slot replace at index, 31 hits combined) — no
    `replaceInput(i, def)` / `replaceOutput(i, def)` exists.
  - `WIDGET_OPTIONS_ASSIGN_WRITE` (whole-bag replace, 71 hits) —
    no `setOptions(opts)` bulk setter; only per-key
    `setOption(k, v)` is contemplated under W6.P3.
- Verbose iteration patterns: `node.getWidgets().map(...)` becomes
  `node.forEachWidget(w => ...)` or `node.queryWidgets().map(...)` —
  comprehension ergonomics regress.
- Deepest .d.ts rework — the public surface for `NodeHandle` /
  `WidgetHandle` grows by ~20 methods covering the rewrite targets.

### Comparison (compact)

| Option | EXT hits affected | ZERO | non-ZERO bucket | UNMIGRATABLE today | New mutator surface | Risk class |
|---|---:|---:|---|---:|---|---|
| (i) fresh-copies | 5,819 | 4,100 | 1,719 SILENT-NOOP | 0 | none | silent debugging — "looks like it worked" |
| (ii) Readonly+freeze | 5,819 | 2,749 | 3,070 TS-ERR | 0 | per-field setters for slots (overlaps iii) | compile-time cliff at major-version bump; D8 adapter interaction |
| (iii) mutator-only | 5,819 | 2,749 | 3,070 REWRITE-METHOD | ~225 | bulk + per-field setters for inputs/outputs/options | deepest rework; iteration ergonomics regress |
| (iv) status quo | 0 | 0 | 0 | 0 | none | leaves Slack-flagged bug class; rejected upfront |

(iv) is included here only because the skeleton ADR enumerated it
for completeness; W6.P8 framing rejected status-quo.

| Option | Pro | Con | Verdict |
|---|---|---|---|
| (i) fresh copies, runtime-only | see §Option (i) Pros above | see §Option (i) Cons above | **TBD — pending W6.P8.B PICK** |
| (ii) Readonly types + dev freeze | see §Option (ii) Pros above | see §Option (ii) Cons above | **TBD — pending W6.P8.B PICK** |
| (iii) mutator-method-only | see §Option (iii) Pros above | see §Option (iii) Cons above | **TBD — pending W6.P8.B PICK** |
| (iv) status quo (live refs, no enforcement) | Zero work | Leaves the bug class CB's proposal flagged; rejected by W6.P8 framing | Rejected |

## Implementation plan

| Step | Action | Owner | Verification |
|---|---|---|---|
| 1 | TBD — gated on W6.P8.C pick | TBD | TBD |

(Plan will be filled out after the human-in-the-loop pick in W6.P8.C.)

## References

- design-review-12142.md row #14 (Decisions table — accepted direction; this ADR closes leg (b) of propagation)
- W6.P8 task block in `todo.md` (Wave-6 section)
- ADR 0003 — command pattern for all mutations (option iii alignment)
- ADR 0008 — entity component system (where the underlying state lives)
- D8 — ECS World ↔ Vue reactive adapter (interaction concern)
- <a href="/decisions/D14-widget-state-categories" class="wiki-link">D14-widget-state-categories</a> — separate but related (D14 says what's <a href="/glossary#schema" class="wiki-link">Schema</a> vs Props; D-immutability says what's mutable how)
- research/touch-points/database.yaml entries S2.N16, S4.W3, S4.W5
- AGENTS.md "Decision propagation rules" — once accepted, must reach (a) commit on PR #12142, (b) this ADR, (c) dashboard JSON
