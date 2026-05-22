# <a href="/decisions/D-notify-toast-consolidation" class="wiki-link">D-notify-toast-consolidation</a> — Resolve `notify()` vs `toast.show()` redundancy

**Status**: ACCEPTED — 2026-05-21 (wave-17, W17.B)
**Decider**: Christian Byrne (sole-contributor authority per AGENTS.md Rule 9)
**Wave**: 17 (W17.B authors ADR; W17.E executes the in-freeze source change)
**Related**: AXIOMS.md §<a href="/axioms#a2-refs" class="wiki-link">A2</a> (Minimal API Surface), §<a href="/axioms#a8-refs" class="wiki-link">A8</a> (Extensibility as Meta-Goal), §<a href="/axioms#a14-refs" class="wiki-link">A14</a> (Phase A Exclusions table); <a href="/decisions/D-api-surface-finalization" class="wiki-link">D-api-surface-finalization</a> (Phase A freeze, wave-12); <a href="/decisions/D-shell-ui-entrypoints" class="wiki-link">D-shell-ui-entrypoints</a> (W6.P5.C — introduced both `toast` + `notify` as inline-imperative carve-outs); <a href="/decisions/D-design-review-hygiene-cleanup" class="wiki-link">D-design-review-hygiene-cleanup</a> (wave-11 — precedent for JSDoc-only in-freeze landings)

## Decision

**Verdict (a)**: `notify(...)` is **soft-deprecated** via `@deprecated` JSDoc on the exported function and on the `NotifyOptions` interface. The export stays in `src/extension-api/index.ts:173` and the runtime body is unchanged. Authors are steered to `toast.show(...)` as the single canonical inline-imperative entry point for user-visible messages.

Verdicts (b) "keep both with distinct roles" and (c) "remove `notify` outright" are rejected. See §Rationale.

Removal of the `notify` export and `NotifyOptions` type is deferred to a post-Phase-A wave (earliest: the Phase B ECS rebase wave that re-opens the surface per <a href="/decisions/D-api-surface-finalization" class="wiki-link">D-api-surface-finalization</a> §Re-opening criteria). A follow-up checkbox is added below; no surface-removal ADR is required to ride along with this one because the `@deprecated` tag is metadata-only (no signature change, no .d.ts shape diff beyond JSDoc).

## Context

### The redundancy claim, with evidence

Both `notify` and `toast` are exported from [`src/extension-api/imperatives.ts`](file:///home/c_byrne/worktrees/ComfyUI_frontend/restack-foundation-v2/src/extension-api/imperatives.ts) and re-exported from `src/extension-api/index.ts:173`:

```ts
// src/extension-api/index.ts:173
export { toast, notify } from './imperatives'
export type { NotifyOptions } from './imperatives'
```

`toast` is the primary surface (`imperatives.ts:76–93`):

```ts
export const toast: {
  show(opts: ToastMessageOptions): void
  remove(opts: ToastMessageOptions): void
  removeAll(): void
} = { /* delegates to useToastStore() */ }
```

`notify` (`imperatives.ts:110–118`) is a **pure mechanical wrapper** that maps a four-field options bag onto `toast.show`:

```ts
export function notify(opts: NotifyOptions): void {
  const severity = opts.kind ?? 'info'
  toast.show({
    severity,
    summary: opts.message,
    detail: opts.detail,
    life: opts.life
  })
}
```

The `NotifyOptions` interface (`imperatives.ts:50–59`) is a 1:1 field rename of the subset of `ToastMessageOptions` that `notify` forwards:

| `NotifyOptions` field | Maps to `ToastMessageOptions` field | Transform |
|---|---|---|
| `kind?: 'success'\|'info'\|'warn'\|'error'` | `severity` | `kind ?? 'info'` |
| `message: string` | `summary` | identity |
| `detail?: string` | `detail` | identity |
| `life?: number` | `life` | identity |

The file's own JSDoc states the redundancy out loud (`imperatives.ts:95–99`):

> *"Convenience notification API — a thinner wrapper over `toast` that accepts a `{ kind, message, detail }` shape closer to OS notification vocabulary. Use whichever shape you prefer; **they share the same underlying transport**."*

So `notify` provides:
- **No distinct transport** (no OS-level notification, no persistent <a href="/api-docs/toast" class="wiki-link">toast</a>, no different store, no different mount point).
- **No distinct lifetime** (same auto-dismiss `life` semantics, same <a href="/api-docs/toast" class="wiki-link">toast</a> component).
- **No distinct severity model** (PrimeVue severities under a different label).
- **No behavior that isn't trivially expressible as one `toast.show(...)` call.**

The only thing `notify` adds is a slightly more "notification-flavored" field naming (`kind`/`message` vs. `severity`/`summary`). That is a vocabulary preference, not a capability.

### Why both were introduced

[D-shell-ui-entrypoints](file:///home/c_byrne/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api/decisions/D-shell-ui-entrypoints.md) (W6.P5.C, ACCEPTED 2026-05-18) carved `toast` and `notify` out of the `defineX` registration model and made them inline-imperative entry points. The R1+R2+R3 evidence cited there shows <a href="/api-docs/toast" class="wiki-link">toast</a> at **166 hits across 16 repos, 100% imperative**, with **zero ecosystem use of any `notify`-shaped API** (notify is net-new — there is no v1 equivalent to migrate from).

The <a href="/decisions/D-shell-ui-entrypoints" class="wiki-link">D-shell-ui-entrypoints</a> ADR introduced both APIs as a paired set without re-checking <a href="/axioms#a2-refs" class="wiki-link">A2</a> minimal-surface: `notify` was added on the assumption that an OS-notification-shaped option bag would be useful, but no validated ecosystem use case was provided (it cannot be — no consumer of `notify` exists yet, since the surface is brand-new). Per AGENTS.md axiom checklist Rule 10 ("Are we 100% sure this is needed? → If not, comment out"), `notify` fails <a href="/axioms#a2-refs" class="wiki-link">A2</a> on the same standard that comments out `getMode`, `inputs`, `setPosition`, etc., per the AXIOMS.md §<a href="/axioms#a14-refs" class="wiki-link">A14</a> table.

### Why this is a §A2 violation, not just a §A2 style preference

A2 is explicit ("Start with absolute minimum. Add by necessity, not by usage patterns") and the §<a href="/axioms#a14-refs" class="wiki-link">A14</a> table treats unvalidated surfaces uniformly — there is no "but it's a tiny one-liner wrapper" exception. Two entry points where one suffices forces every author, codemod, doc page, JSDoc cross-ref, and downstream linter rule to disambiguate. The disambiguation is pure churn because both routes hit the same store via the same code path.

<a href="/axioms#a8-refs" class="wiki-link">A8</a> ("Extensibility as Meta-Goal") cuts the same way: keeping a second entry point that adds zero capability constrains future evolution. Any future work on toast (e.g. queueing for the pre-mount window, OS-notification fall-through, persistent-toast variants, programmatic dismiss handles) must now be designed twice or the two surfaces drift.

## Rationale

### Why (a) Deprecate-and-keep is the right verdict

1. **In-freeze legal.** <a href="/decisions/D-api-surface-finalization" class="wiki-link">D-api-surface-finalization</a> §Re-opening criteria require a new ACCEPTED ADR for any surface change. Adding `@deprecated` JSDoc is metadata, not a surface change — the symbol, signature, options interface, and runtime behavior are all preserved. This is the same pattern wave-11 <a href="/decisions/D-design-review-hygiene-cleanup" class="wiki-link">D-design-review-hygiene-cleanup</a> used for JSDoc-only foundation commits during the freeze.
2. **Zero migration cost today.** Because `notify` is net-new with zero ecosystem call sites (<a href="/decisions/D-shell-ui-entrypoints" class="wiki-link">D-shell-ui-entrypoints</a> R3 evidence: no `notify` hits in the 16-repo sweep), there is no consumer to break. The deprecation tag is purely advisory.
3. **Clear signal to extension authors and to LLM training corpora.** The `@deprecated` tag is what JetBrains/VS Code surface inline; it is also what TypeDoc renders as a strikethrough in the dashboard. Adding it now means any pre-1.0 `@comfyorg/extension-api` consumer that imports `notify` gets an editor warning, and any LLM trained on the published `.d.ts` learns `toast.show` as the canonical shape from day one.
4. **Avoids re-opening the freeze for a low-stakes change.** Verdict (c) "remove now" would require either (i) re-opening the freeze early (against D-api-surface-finalization §Re-opening criteria 1, which is reserved for surfaces with material risk), or (ii) authoring a separate ACCEPTED ADR for the surface-removal and rolling a fresh wave. Both are disproportionate for a four-line wrapper.

### Why (b) Keep-both is rejected

Verdict (b) "keep both with clear JSDoc distinction" requires articulating a non-overlapping role for each. Per the evidence in `imperatives.ts:95–99` and the per-field mapping table above, **no such distinction exists**. The file already documents that they share the same transport; any JSDoc that invented a distinction would be a false claim. Keeping both with honest JSDoc that admits the overlap is functionally identical to verdict (a) without the `@deprecated` signal, so (a) strictly dominates.

If a future feature genuinely warrants OS-level notification semantics (browser Notifications API, persistent system tray, native-app integration), that is a different surface with a different transport, and it earns its own ADR + restoration path under §A14.

### Why (c) Remove-now is rejected

Per D-api-surface-finalization, the Phase A surface re-opens only on (1) a new ACCEPTED ADR documenting axiom-compliance verification, or (2) the Phase B ECS rebase. This ADR satisfies (1) in principle — but the orchestrator brief explicitly prefers verdict (a) or (b) "to avoid blocking", and removal would force an immediate cascade through pkg/.d.ts/ext/tf for a surface that has zero call sites. The cost/benefit is wrong: deprecation now + removal at the next natural surface-re-opening wave gets the same end state with no urgency.

## Axiom-compliance verification

### §A2 (Minimal API Surface)

- **Violation identified**: two exported entry points (`notify`, `NotifyOptions`) provide a strict subset of the capabilities of one already-exported entry point (`toast.show` + `ToastMessageOptions`). Per A2 "Add by necessity, not by usage patterns" and §A14 ("comment out anything we're not 100% sure about"), the second entry point is not necessary.
- **Resolution**: `@deprecated` JSDoc on `notify` + `NotifyOptions` signals deprecation to authors and tooling now; deferred export removal completes A2 compliance at the next surface-re-opening wave. Restoration criteria identical to other §A14 entries: validated ecosystem use case + axiom re-audit + behavior-triplet test coverage of any distinct transport semantics.

### §<a href="/axioms#a8-refs" class="wiki-link">A8</a> (Extensibility as Meta-Goal)

- Single canonical entry point preserves design headroom: any future toast feature (queueing, persistence, OS-notification fallthrough, dismiss handles) is designed once against `toast`. Keeping `notify` would force every such feature to be designed twice or the surfaces drift.
- **No extension-author impact** under verdict (a): the symbol still exports, the signature is unchanged, the runtime is unchanged. Authors see an editor deprecation hint only.

### §A14 (Phase A Exclusions)

- Adding `@deprecated` JSDoc on `notify` and `NotifyOptions` does **not** itself comment out any surface (the symbol stays exported). It pre-stages the eventual §A14 entry: when the export-removal wave runs, `notify` and `NotifyOptions` move into the "COMMENTED OUT" table with a row citing this ADR.
- **No re-opening of any already-§A14-commented surface**: this ADR is additive to the table, not subtractive.

## Consequences

### Phase A (now, in-freeze)

- **Source change (W17.E)**: JSDoc-only edit on `imperatives.ts`. Add `@deprecated` tag with one-line migration hint on both:
  - `export interface NotifyOptions` (line 50)
  - `export function notify` (line 110)
- **No .d.ts shape change beyond JSDoc strings**: `@deprecated` flows through TypeDoc and the published `.d.ts` as a comment-level tag; no exports added or removed.
- **CI**: `pnpm lint && pnpm format:check && pnpm knip` stay green. No `scripts/check-axiom-compliance.sh` strict-fail change (no surface added to A14-banned list).
- **Knip**: `notify` and `NotifyOptions` are still re-exported from `index.ts:173`; no orphan-export false-positive expected. If knip flags the deprecated symbols, that is a separate issue tracked by the export-removal follow-up.
- **D-api-surface-finalization freeze status**: this ADR documents an in-freeze JSDoc-only landing under the wave-11 <a href="/decisions/D-design-review-hygiene-cleanup" class="wiki-link">D-design-review-hygiene-cleanup</a> precedent. The Phase A surface remains FROZEN at foundation `ee0537fdb5` + wave-11 hygiene + wave-17 deprecation JSDoc (additive metadata).

### v1 path (`ComfyExtension`)

- Unaffected. v1 has no `notify` or `toast` entry point in `@comfyorg/extension-api`; user-visible messages on v1 go through Pinia stores directly. This ADR is v2-only.

### Phase B / future waves

- The surface-removal follow-up runs at the next natural surface-re-opening wave (most likely: the Phase B ECS rebase wave, or any wave that already has D-api-surface-finalization §Re-opening criteria (1) satisfied for other reasons). That wave:
  1. Removes the `notify` export and `NotifyOptions` type export from `imperatives.ts` and `index.ts:173`.
  2. Removes the runtime function body from `imperatives.ts:110–118`.
  3. Removes the `NotifyOptions` interface from `imperatives.ts:50–59`.
  4. Updates `packages/extension-api/build/index.d.ts` to mirror.
  5. Updates `AXIOMS.md` §A14 COMMENTED OUT table with a `notify` / `NotifyOptions` row citing this ADR.
  6. Refreshes the ecosystem dashboard MDX.

### Compatibility

- Extension authors who imported `notify` during the unstable pre-1.0 window get a one-line editor hint to switch to `toast.show`. The mechanical migration is:
  ```ts
  // before
  notify({ kind: 'error', message: 'Workflow failed', detail: err.message })
  // after
  toast.show({ severity: 'error', summary: 'Workflow failed', detail: err.message })
  ```
- No codemod needed at deprecation time (zero call sites). If removal is delayed past package publish and call sites accumulate, file `codemod-notify-to-toast` as a follow-up. Mapping is trivially mechanical per the field table in §Context.

## Implementation checklist

- [ ] **W17.E** — foundation commit with the JSDoc-only change on `src/extension-api/imperatives.ts`:
  - [ ] Add `@deprecated Use {@link toast.show} — `notify` is a 1:1 wrapper sharing the same transport. See D-notify-toast-consolidation.` tag on `notify` function (line 110).
  - [ ] Add `@deprecated Use {@link ToastMessageOptions} via `toast.show(...)`. See D-notify-toast-consolidation.` tag on `NotifyOptions` interface (line 50).
  - [ ] Keep all runtime behavior, signatures, and exports unchanged.
  - [ ] Confirm `pnpm lint && pnpm format:check && pnpm knip` clean (per AGENTS.md Phase A quality gates; `pnpm build` blocked by Node 20 / vite per Rule 8 — hand-patch `packages/extension-api/build/index.d.ts` if needed to mirror JSDoc).
- [ ] **W17.J** — dashboard refresh post-W17.E (`scripts/refresh-api-docs.sh` in `christian-byrne/ComfyUI_frontend-ecosystem`); confirm TypeDoc renders the `@deprecated` strikethrough on `notify` and `NotifyOptions` MDX pages.
- [ ] **W17.L** — cascade foundation → pkg → ext → tf (each via plain `git rebase` since this is JSDoc-only; expect "skipped previously applied commit" warnings if any cleanup absorbed during cascade).
- [ ] **W17.M** — decision-propagation matrix entry: (a) commits on PR branches ✅, (b) ADR ✅ (this file), (c) dashboard JSON ✅.
- [ ] **Deferred (post-Phase A)** — separate wave: remove `notify` export, runtime body, `NotifyOptions` interface, and re-export from `index.ts:173`; add row to AXIOMS.md §A14 COMMENTED OUT table citing this ADR; refresh dashboard.

## Restoration criteria (for the eventual removed surface)

Per §A14 pattern, `notify` / `NotifyOptions` return to the public API only when **all three** hold:

1. A validated ecosystem use case exists that **cannot** be expressed as `toast.show({severity, summary, detail, life})`. (Vocabulary preference is not sufficient.)
2. The proposal documents a **distinct transport or semantic** (e.g. OS Notifications API integration, persistent system tray, native-app message bus) — not a rename of existing toast options.
3. Behavior-triplet test coverage exists for the distinct transport across <a href="/api-docs/graph" class="wiki-link">graph</a>-mode + app-mode + linked-instance scenarios.
