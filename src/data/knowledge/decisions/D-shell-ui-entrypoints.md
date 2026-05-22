# D-shell-ui-entrypoints — Granular shell UI registration entry points

**Status**: **ACCEPTED** — 2026-05-18 (handoff-11; PICK by Christian, human-in-the-loop). Skeleton authored 2026-05-14; R1+R2+R3 evidence + W6.P5.B type-reconciliation landed 2026-05-18; option **(ii) separate entries** picked with **inline imperative carve-out for toast + notification** and **PR topology = rebased on top of foundation stack**.

## Context

`@comfyorg/extension-api` currently registers shell UI surfaces
(sidebar tabs, bottom panels, commands, hotkeys, menu items, toolbar
buttons, toasts) through a single `defineExtension({ shell: { … } })`
slot pattern, mirroring v1's `app.registerExtension({ commands: […],
sidebarTabs: […], … })`. Existing types (`SidebarTabExtension`,
`BottomPanelExtension`, `CommandManager`, etc.) live in
`src/extension-api/shell.ts`.

CB's Slack proposal (2026-05-13) argues for granular per-surface entry
points so each contribution is independently load/disable/test-able:

> "Separate `defineBottomPanelTab` / `defineSidebarTab` / `defineCommand`
> / `defineHotkey` entry points; toast/command-invocation stay as
> in-hook usage. Benefits: granular load/disable, testability,
> lifecycle."

The shell-UI cluster also has its own touch-points evidence:

- **S12.UI1 sidebar tabs** — registered via `extensionManager.registerSidebarTab`.
- **S12.UI2 bottom panels** — same pattern, separate registry.
- **S12.UI3 commands + hotkeys** — `commandManager.register`,
  `keybindManager.register`. Hotkeys are commonly bound to
  pre-registered commands.
- **S12.UI4 toasts** — fire-and-forget invocation API, no registration
  needed.
- Plus toolbar buttons, context-menu contributions, and queue badges
  (lower-volume but distinct surfaces).

This decision sits at the intersection of two concerns:

- **Surface granularity**: how many `defineX` entry points to ship.
- **Lifecycle / disposability**: whether each contribution is independently
  unmount-able (matters for hot-reload, plugin enable/disable, test
  isolation).

## Decision

**Picked: Option (ii) — separate entries per registerable surface, with
inline imperative carve-out for toast + notification.**

Each registerable shell-UI surface gets its own `defineX` entry point
(per-import testable, independently disposable, individually typed).
Toast and notification — the fire-and-forget surfaces with no
registration semantics — stay as inline imperative calls invokable from
inside any `defineExtension.setup` / `defineSidebarTab.setup` /
`defineBottomPanelTab.setup` body (or any hook scope).

### Shape

```ts
import {
  defineExtension,
  defineSidebarTab,
  defineBottomPanelTab,
  defineCommand,
  defineHotkey,
  defineSetting,
  defineAboutBadge,
  defineToolbarButton,        // net-new; 0-hit migration surface
  toast,                      // inline imperative (not a defineX)
  notify,                     // inline imperative (not a defineX)
  onMounted                   // D-bootstrap-hooks
} from '@comfyorg/extension-api'

// Registered surfaces — each defineX returns a disposable handle
const sidebarTab = defineSidebarTab({
  id: 'my-tab',
  setup() { onMounted(() => { /* tab DOM created */ }) }
})

defineCommand({ id: 'my.cmd', run: () => { /* ... */ } })
defineHotkey({ keys: 'mod+k', commandId: 'my.cmd' })
defineSetting({ id: 'my.option', default: false, label: '...' })

// Inline imperative — call from any setup/hook body
defineExtension({
  name: 'my-ext',
  setup() {
    onMounted(() => {
      toast.show({ severity: 'info', summary: 'Ready' })
      notify({ kind: 'info', message: 'Loaded' })
    })
  }
})
```

### Carve-out rationale (Christian, PICK transcript)

*"some things are unique like toast and notifications where you just
want to call them inline in different entrypoint hooks"*. The R1+R2+R3
evidence corroborates: toast is **100% imperative across 166 hits / 16
repos** today, with zero ecosystem use as a registration target.
Forcing a `defineToast` entry point would invent a registration concept
that doesn't exist in user mental models. Same shape applies to
notification.

The carve-out is consistent with §Cross-option observations #1
(toast and bottom_panel are decision-invariant) but goes further: it
makes the inline-imperative shape canonical for toast + notification
rather than treating them as a per-API ergonomics choice.

### PR topology

**Rebased on top of the foundation stack** (option (b) per skeleton
ADR's "Topology note"). Shell-UI lands as another foundation change in
the same 4-PR stack (#12142 foundation / #12143 pkg / #12144 ext /
#12145 tf), not as a parallel PR series. Rationale: treats shell-UI
entry points as a peer with `defineNode` / `defineWidget` / lifecycle
hooks — the consistent rebase-on-foundation pattern keeps the
4-PR-pair reconciliation discipline (AGENTS.md §Decision propagation
rules) operating on a single stack.

Implication for KJNodes-shaped extensions (5+ surfaces): the
migration coordinates as a single rebase wave, not staged-per-surface.
The codemod (Step 6 below) carries the per-pack atomic translation.

### What this displaces

- `defineExtension({ shell: { sidebarTabs, bottomPanels, commands,
  hotkeys, … } })` is removed as a public surface.
- The `ExtensionManager` umbrella export is removed; per-surface
  disposable handles take its place.
- `SidebarTabExtension` / `BottomPanelExtension` / `CommandManager`
  reshape per the W6.P5.B reconciliation table below.
- v1 `app.registerExtension({ commands: […], sidebarTabs: […], … })`
  continues to work during the deprecation window via a runtime
  mapper that re-routes slot bodies to the `defineX` equivalents
  (mirrors the D-bootstrap-hooks mapper precedent).

Three candidate shapes were considered (see §Alternatives for pros/cons
+ R1/R2/R3 evidence). Re-labeled per the evidence axis:

- **(i) keep slots** — preserve the v1 `defineExtension({ shell: {…} })`
  slot pattern; granularity at the disposable-handle level only.
- **(ii) separate entries** — one `defineX` per registerable surface
  (PICKED); each is independently typed, disposable, and per-import
  testable. Toast + notification stay as inline imperative calls.
- **(iii) drop slots** — entry-points-only; v1 slot path removed
  outright.

The original skeleton option "defineUI + defineBackground" (2-entry
compromise) is folded into (ii) as a deferred mid-granularity variant
(§Alternatives, Cross-option observation #6).

(Other shapes — pure-functions+loader registration applied to shell UI
the same way D18 applies it to nodes — are deferred until D18 Phase 2
ships and we have data on whether the loader pattern feels right.)

## Consequences

- `SidebarTabExtension` / `BottomPanelExtension` / `CommandManager`
  reshape per W6.P5.B type-reconciliation table below — most become
  arg types of their `defineX` entry point; `ExtensionManager` umbrella
  is dropped from the public surface.
- New types land in shell.ts: `HotkeyExtension`, `AboutBadgeExtension`,
  `SettingDefinition`, `ToolbarButtonExtension`.
- Each `defineX` returns a `{ dispose(): void }` handle. Dispose
  contract requires documenting ordering on multi-surface extensions,
  idempotency, and async cleanup (see Step 9 below).
- Toast and notification stay as inline imperative calls (`toast.show(...)`
  / `notify(...)`) invokable from any setup/hook body. Not registered.
- KJNodes-shaped extensions (5+ surfaces) migrate as a single coordinated
  cut-over via the codemod (Step 6); no per-surface staging.
- v1 `app.registerExtension({ commands, sidebarTabs, … })` continues to
  work via runtime mapper during the deprecation window.

**PR topology decision (W6.P5.C bullet 2)**: shell-UI lands as a
**foundation-stack rebase** (option b), not a parallel PR series.
Reasoning in §Decision → PR topology above.

## Alternatives considered

> **DATA-ONLY framing** per Wave-6 process discipline (AGENTS.md §Wave-6).
> R1+R2+R3 evidence (688 EXT hits / 64 repos / cum★36,279 union across
> 9 surfaces; non-menu scope 439 hits / ★22,887) is summarised below per
> option. **Verdicts stay TBD** — the PICK is the W6.P5.C
> human-in-the-loop step. Menu surface (249 hits / `getExtraMenuOptions`
> patching) is out of scope for this ADR; it needs its own treatment.

> **Skeleton-to-evidence reframing**: the original skeleton labeled the
> three options (i) "one entry per surface" / (ii) "defineUI +
> defineBackground" / (iii) "keep slot, disposables only". The R1+R2+R3
> sweep classified the ecosystem along a different axis (which path
> the existing 439 non-menu hits land on after migration), which is
> what makes the migration-cost matrix legible. We therefore re-label
> for the §Alternatives table to match the evidence axis:
>
> - **(i) keep slots** — the "smallest migration cost" baseline; this is
>   the original skeleton (iii) "keep slot pattern, disposables only" but
>   stripped of the disposable-tree return shape because that's a
>   per-API ergonomic choice independent of the slot/entry-point split.
> - **(ii) separate entries** — exact match of original skeleton (i).
> - **(iii) drop slots** — entry-points-only; eliminates the v1 slot path.
>
> The original skeleton option (ii) "defineUI + defineBackground" is
> deferred as a "mid-granularity" variant: it lives between (ii)
> separate entries and (iii) drop slots on the surface-count axis and
> doesn't change the migration-cost cells materially. Reported in the
> Cross-option observations §6.

### Per-option migration-cost (from R3 effects matrix — non-menu scope, 439 hits)

| Option | ZERO | TS-ERR | SILENT-NOOP | REWRITE-METHOD | UNMIGRATABLE |
|---|---:|---:|---:|---:|---:|
| (i)   keep slots          | **439** | 0 | 0 |   0 | 0 |
| (ii)  separate entries    |   0 | 0 | 0 | **439** | 0 |
| (iii) drop slots          | 235 | 0 | 0 | **204** | 0 |

(Bold cells = the "headline cost" each option pays. Including menu surface
adds 249 UNMIGRATABLE to every row uniformly — it's the prototype-patch
tax this ADR doesn't address.)

### Per-surface headline (DATA, non-menu)

| Surface | Hits | Repos | Cum ★ | Slot/Imperative skew |
|---|---:|---:|---:|---|
| toast         | 166 | 16 | 24,729 | **100% imperative** (no v1 slot exists today) |
| settings      |  94 | 17 |  4,722 | **93% slot** (87/94 via `slot.settings`) |
| command       |  85 | 15 | 20,365 | **100% slot** (70 commands + 15 menuCommands) |
| bottom_panel  |  36 |  4 |    100 | **100% imperative**; 4 consumers are all frontend forks (low-confidence) |
| sidebar_tab   |  22 | 12 |  5,379 | **91% imperative** (20/22); 2 slot hits in 1 repo |
| hotkey        |  22 |  6 |  2,590 | **73% slot** (16/22) |
| about         |  14 | 11 | 20,218 | **100% slot** (`slot.aboutPageBadges`) |
| toolbar       |   0 |  0 |      0 | **no surface exists**; any option creates net-new |

KJNodes (★2,588) touches **5 of 9 surfaces** — broadest single-pack
coverage. Top-3 starred consumers (Manager ★14,636, Impact-Pack ★3,109,
KJNodes ★2,588) collectively own **★20,333 of ★22,887** non-menu
cum-stars (89%). Any option's real-world success rides on those three.

### Per-option pros + cons (grounded in R1/R2/R3)

| Option | Pro (evidence) | Con (evidence) | Verdict |
|---|---|---|---|
| (i) keep slots | **439 ZERO cells** — every existing slot-pattern call site continues to compile and behave identically; zero migration risk for the 64 affected repos; preserves v1 muscle memory (low agent-retraining cost: v1 patterns dominate community examples + LLM training corpora); KJNodes-shaped broad-coverage extensions (5+ surfaces) don't have to coordinate a multi-PR migration | **Defeats the W6.P5 framing**: slot bodies can't be loaded in isolation (testability cost), can't be enabled/disabled per-surface (lifecycle cost), and one `ExtensionOptions` mega-type covers all 9 surfaces (type-narrowing cost); doesn't address the Slack-flagged "is this still the right shape for the next 5 years?" question; the 166 toast + 36 bottom_panel hits are **already** imperative — opt (i) doesn't bring them under the slot umbrella, so the option preserves a 2-track world (slot AND imperative) rather than converging | Rejected |
| (ii) separate entries | Maximum granularity — each `defineX` is independently load/disable/test-able; mirrors the `defineNode` / `defineWidget` precedent (D11) so the ecosystem learns one consistent shape; per-import testability (a sidebar-tab test file imports only `defineSidebarTab`); preserves the v1 slot path during deprecation window (additive, not destructive); the 0-hit toolbar surface gets a `defineToolbarButton` entry point with no migration cost (net-new surface, not migration) | **All 439 non-menu sites move to REWRITE-METHOD** if the goal is convergence on the new shape — and the 87 settings + 70 commands + 16 hotkey + 14 about hits (187 sites) live inside `app.registerExtension({ ... })` slot bodies that need structural extraction, not a sed; biggest single rewrite victim is KJNodes (5 surfaces, ★2,588) — any cut-over has to coordinate across all 5 surfaces in that pack atomically or stage per-surface (W6.P5.C PR-topology question); ≥7 new entry-point functions to design, document, and type; **largest surface addition** in the W6 cluster | **ACCEPTED 2026-05-18 (Christian, handoff-11)** with inline-imperative carve-out for toast + notification. REWRITE cost paid via codemod (Step 6); KJNodes-shape coordination via foundation-stack rebase (PR topology = b). |
| (iii) drop slots | **235 ZERO cells** for toast + bottom_panel + sidebar_tab (already-imperative surfaces stay imperative; toast 166 + bottom_panel 36 + sidebar_tab 20 + 13 already-imperative settings/hotkey hits); converges on a single registration shape (no slot/imperative dual-track); eliminates the `ExtensionOptions` mega-type; matches the W6.P3 D-widget-converge "hard cut, no compat shim" precedent if shipped without a slot fallback | **204 REWRITE-METHOD cells** concentrated in 4 surfaces (command 85 + settings 87 + hotkey 16 + about 14 = 202 of 204); REWRITE concentrated in the top-3 consumers (Manager + Impact-Pack + KJNodes own 89% of non-menu stars and most of the REWRITE cells); harshest blast radius on KJNodes (5 surfaces; settings 8 + hotkey 4 + command 9 = 21 sites in one pack); no v1 slot escape-hatch — extensions either migrate or break; agent-retraining cost: v1 slot pattern is the LLM training majority shape | Rejected — additive deprecation window from (ii) preserves the v1 slot path during cut-over; (iii) hard-cut would punish KJNodes-shape packs unnecessarily when the codemod can land the same end state with a safer ramp. |
| (iv) keep status quo (no granularity, no disposable, no investigation) | Zero work | Leaves the Slack-flagged TODO open; defeats the W6.P5 framing | Rejected upfront |

### Cross-option observations (DATA, no preference encoded)

1. **Toast and bottom_panel are decision-invariant.** Toast 166/166 +
   bottom_panel 36/36 are already 100% imperative across the ecosystem.
   ANY option (i)/(ii)/(iii) passes these surfaces through unchanged.
   The real decision for toast is a parallel sub-question: top-level
   export (`import { toast } from '@comfyorg/extension-api'`) vs.
   context-method (`ctx.toast(...)` inside `defineExtension.setup`).
   Belongs in W6.P5.B reconciliation, not the (i)/(ii)/(iii) PICK.

2. **Bottom_panel evidence is low-confidence.** 36 hits but the 4
   consumers (`Majoor`, `ljm_comfyui`, `willie`, `shrimbly`) are all
   ComfyUI_frontend *forks*, not extension repos. Real bottom-panel
   extension adoption may be effectively zero. Don't weight the 36-hit
   row as decisive.

3. **Toolbar surface is a forcing function.** 0 hits across the corpus
   confirms authors cannot register toolbar buttons today via the
   documented API. Any option that includes a `defineToolbarButton`
   creates a brand-new surface, not a migration. Cost: 0 migration,
   ≥1 net-new entry-point to design.

4. **KJNodes is the canonical "broad-coverage" canary.** Only top-10
   starred pack touching 5 of 9 surfaces (menu + toast + command +
   settings + hotkey). PR-topology decision (W6.P5.C bullet 2) needs an
   explicit answer for KJNodes-shaped extensions: single-PR atomic
   migration vs. staged-per-surface. Same answer applies to
   future broad-coverage packs.

5. **Top-3 concentration is structural.** Manager + Impact-Pack +
   KJNodes own ★20,333 of ★22,887 (89%) non-menu cum-stars. Any
   option's real-world success or failure is decided by whether those
   three migrate successfully. R3 cells aggregate equally per-repo, but
   the practical blast radius weights these three heavily.

6. **Original skeleton option (ii) "defineUI + defineBackground"
   deferred.** The mid-granularity shape (two entries) doesn't change
   the per-surface migration-cost cells materially because each surface
   still falls on the same ZERO/REWRITE axis — it just groups
   destinations differently. Considered if the PICK at C wants a
   2-entry compromise; folded into (ii) "separate entries" for the
   decision-cost analysis.

7. **No SILENT-NOOP or TS-ERR cells across any of the 3 options.**
   Unlike D-coord-space (where opt (ii) had 1,559 SILENT-NOOP and opt
   (i) had 5,524 TS-ERR), shell-UI registration migrations are
   structurally visible — slot bodies are object properties; entry-point
   calls are function calls; there's no "looks the same but stops
   working" failure mode. Lower bug-class risk than D-coord-space.

8. **Per-import testability is a (ii)-only win.** Opt (i) keeps the
   `app.registerExtension({ ... })` mega-call — test files can't import
   `defineSidebarTab` in isolation. Opt (iii) gets this for the 4
   already-imperative surfaces but loses it on the 4 slot-dominated
   surfaces (command, settings, hotkey, about) that move to REWRITE.
   Only opt (ii) gets per-import testability across all 9 surfaces.

9. **D-widget-converge precedent (W6.P3.C `2f102353fa`).** That ADR
   accepted hard-cut hiding the DOM seam ("no compat shim", absorbing
   UNMIGRATABLE cells via migration-guide rows). Opt (iii) extends
   that pattern (no slot fallback); opt (ii) is the "additive,
   deprecation-window" alternative; opt (i) doesn't follow the
   precedent. Observation only — precedent ≠ verdict.

10. **D-bootstrap-hooks (W6.P6) scope-back is the relevant precedent.**
    The accepted shape there (2026-05-14) keeps shell-UI registration
    OUTSIDE the `workbench` namespace — `defineSidebarTab` /
    `defineBottomPanelTab` / `defineCommand` / `defineHotkey` / `toast`
    explicitly remain whatever shape W6.P5 picks. That ADR designed
    around (ii)/(iii) but does not foreclose any of them. Whichever
    option the C PICK selects, the bootstrap-hooks ADR is forward-compat.

Evidence artifact: `research/architecture/D-shell-ui-blast-radius.md`

## W6.P5.B type-reconciliation (existing `shell.ts` surface)

The foundation worktree (`ext-api/i-foundation-v2`, HEAD `fa3229b402`)
ships `src/extension-api/shell.ts` as a thin re-export barrel:

```ts
// src/extension-api/shell.ts — current state
export type {
  SidebarTabExtension,
  BottomPanelExtension,
  ToastMessageOptions,
  ToastManager,
  ExtensionManager,
  CommandManager
} from '@/types/extensionTypes'
```

`VueExtension` and `CustomExtension` are deliberately NOT re-exported per
D19 — they are discriminated-union ingredients of
`SidebarTabExtension`/`BottomPanelExtension`, internal-only.

**Per-type disposition under each option:**

| Existing type | (i) keep slots | (ii) separate entries | (iii) drop slots |
|---|---|---|---|
| `SidebarTabExtension`   | unchanged (slot value type) | becomes arg type of `defineSidebarTab(...)` | becomes arg type of `defineSidebarTab(...)`; slot removed |
| `BottomPanelExtension`  | unchanged (slot value type) | becomes arg type of `defineBottomPanelTab(...)` | becomes arg type of `defineBottomPanelTab(...)`; slot removed |
| `ToastMessageOptions`   | unchanged (argument to imperative `toast.show(opts)`) | unchanged | unchanged |
| `ToastManager`          | unchanged (returned from `ctx.toast`) | unchanged | unchanged |
| `ExtensionManager`      | unchanged (legacy registry handle) | likely dropped from public API; replaced by per-surface entry-point return handles | dropped |
| `CommandManager`        | unchanged (slot value type / accessor) | becomes arg type of `defineCommand(...)`; manager dropped from public API | becomes arg type of `defineCommand(...)`; manager dropped |

**Not yet typed in shell.ts (would need new types under (ii)/(iii)):**

- `HotkeyExtension` / `KeybindExtension` — currently lives in v1 keybind
  registry types; not surfaced through `extensionTypes.ts`.
- `AboutBadgeExtension` — currently a `slot.aboutPageBadges` array of
  POJOs; no exported type.
- `SettingDefinition` (or similar) — currently typed in the settings
  store; not re-exported via shell.ts.
- `ToolbarButtonExtension` — does not exist (0-hit surface).
- `MenuItemExtension` — out of scope (menu ADR pending).

**Reconciliation observations:**

1. Opt (i) is the only option that touches **zero** types in shell.ts —
   it's a pure additive (or no-op) change at the type layer.
2. Opt (ii) and (iii) both require adding 3–5 new types
   (`HotkeyExtension`, `AboutBadgeExtension`, `SettingDefinition`,
   optionally `ToolbarButtonExtension`) to the shell.ts barrel + their
   source-of-truth definitions in `extensionTypes.ts` or equivalent.
3. `ToastManager` and `ToastMessageOptions` are decision-invariant per
   §Cross-option observations #1.
4. `ExtensionManager` is the legacy umbrella handle that returns all
   sub-managers; opts (ii) and (iii) likely remove it from the v2
   public API in favor of per-surface return handles.

## Implementation plan

PR topology: **rebased on top of the foundation stack** (#12142 →
#12143 → #12144 → #12145). Lands after the W6.P6.C bootstrap-hooks
commit so the new entry points compose with the new lifecycle hooks.

| Step | Action | Owner | Verification |
|---|---|---|---|
| 1 | Author new types in `src/types/extensionTypes.ts`: `HotkeyExtension`, `AboutBadgeExtension`, `SettingDefinition`, `ToolbarButtonExtension`. Reshape existing `SidebarTabExtension` / `BottomPanelExtension` / `CommandManager` per W6.P5.B table | foundation PR #12142 | tsc passes; new types appear in `src/types/extensionTypes.ts`; existing v1 type users still compile via the runtime mapper bridge |
| 2 | Implement `defineSidebarTab` / `defineBottomPanelTab` / `defineCommand` / `defineHotkey` / `defineSetting` / `defineAboutBadge` / `defineToolbarButton` in `src/extension-api/registrations.ts` (new file). Each returns `{ dispose(): void }`. Wire to existing imperative `extensionManager.registerSidebarTab` / `registerBottomPanel` / `commandManager.register` / `keybindManager.register` / `settingStore.addSetting` / equivalents | foundation PR #12142 | unit test: each `defineX` creates the surface; `handle.dispose()` removes it; double-dispose is idempotent |
| 3 | Implement `toast` and `notify` as top-level inline imperatives in `src/extension-api/imperatives.ts` (new file). Wire to existing `extensionManager.toast.add` / notification store | foundation PR #12142 | unit test: `toast.show(...)` from inside a `defineExtension.setup` body fires the same as legacy `app.extensionManager.toast.add(...)` |
| 4 | Reshape `src/extension-api/shell.ts` barrel — re-export the new arg types (`SidebarTabExtension`, `BottomPanelExtension`, `HotkeyExtension`, `AboutBadgeExtension`, `SettingDefinition`, `ToolbarButtonExtension`, `CommandDefinition`, `ToastMessageOptions`, `ToastManager`). Remove `ExtensionManager` and `CommandManager` from the public re-export per W6.P5.B (internal callers continue importing from `@/types/extensionTypes`) | foundation PR #12142 | grep `src/extension-api/shell.ts` shows the new export list; knip clean |
| 5 | Mark `ExtensionOptions.shell` (and `app.registerExtension({ shell: … })`) as `@deprecated` in the v1 surface; add runtime mapper that re-routes slot bodies to the corresponding `defineX` calls | foundation PR #12142 | E2E: a v1 extension using `app.registerExtension({ sidebarTabs: [...], commands: [...] })` continues to load and behave identically; deprecation warning fires once per extension |
| 6 | Codemod `scripts/codemod-v1-to-v2-shell.ts` that mechanically transforms v1 `shell: {…}` slot bodies + `app.registerExtension({ commands, sidebarTabs, … })` properties into the corresponding `defineX(...)` calls. Atomic per-pack transformation handles KJNodes-shape (5+ surfaces) cleanly. Ships in `@comfyorg/extension-api` so authors can run `npx @comfyorg/extension-api codemod-shell ./src` | pkg PR #12143 | golden-input test: convert each of the top-3 ecosystem pack signatures (Manager, Impact-Pack, KJNodes) and diff against hand-authored target |
| 7 | Bundle `.d.ts` regeneration so `@comfyorg/extension-api` exports the new `defineX` entry points + arg types + inline imperatives | pkg PR #12143 | typecheck on a fresh consumer pulling the package; new exports visible; deprecated v1 surface still exported with `@deprecated` JSDoc |
| 8 | Update example extensions (`*.v2.ts`) under `src/extensions/core/` to use new `defineX` shape. Pick 2–3 representative examples covering sidebar + command + setting + hotkey + about + toast | ext PR #12144 | each example loads + behaves identically to v1 counterpart; ext tests pass |
| 9 | Document dispose contract in package README + migration guide: ordering on multi-surface extensions, idempotency requirement, async cleanup pattern. Document carve-out: toast + notification are inline imperatives, NOT registered | embedded-docs | dispose contract section present; carve-out explicitly called out; agent-friendly examples show inline `toast.show(...)` inside `setup()` body |
| 10 | Update behavior triplets in test framework — add coverage for each new `defineX` + dispose lifecycle + inline imperatives | tf PR #12145 | triplet rerun on Manager, Impact-Pack, KJNodes, Easy-Use, Custom-Scripts; baseline+migration scenarios both pass |
| 11 | Migration-guide section in `docs/extensions/migration-v1-to-v2.md` with v1 slot → v2 `defineX` map table; include codemod invocation + KJNodes worked example (5-surface atomic migration) | docs | published page renders the map cleanly; KJNodes example end-to-end |
| 12 | Dashboard refresh: surface `S12.UI*` family on `/patterns` and `/api-diff` views with per-surface migration cost from R3; flip D-shell-ui-entrypoints status badge to ACCEPTED | dashboard | `christian-byrne/ComfyUI_frontend-ecosystem` regenerated; deltas visible; `pnpm test` passes |
| 13 | Comment on PRs #12142, #12143, #12144, #12145 with PICK summary + per-PR commit SHAs + link to migration-guide section | PR | comments posted on all 4 PRs |

Implementation cost is **weighted toward the codemod (Step 6)** — once
the entry points exist (Steps 1–4) and the runtime mapper provides a
v1 escape valve (Step 5), the per-pack migration is mechanical for the
top-3 consumers (Manager, Impact-Pack, KJNodes) that own 89% of the
ecosystem star-weight. The codemod is the load-bearing artifact for
PR-topology-(b) success.

## References

- design-review-12142.md row #18 (D18 — registration pattern; D-shell-ui-entrypoints inherits the pure-functions+loader principle)
- W6.P5 task block in `todo.md` (Wave-6 section)
- D11 — naming `defineNode`/`defineWidget` (the precedent for per-surface short-form entry points)
- D18 — pure functions + loader registration (the principle these entry points should follow)
- ComfyUI_frontend `src/extension-api/shell.ts` — current `SidebarTabExtension`/`BottomPanelExtension`/`CommandManager` types
- research/touch-points/database.yaml entries S12.UI1, S12.UI2, S12.UI3, S12.UI4
- AGENTS.md "Decision propagation rules" — once accepted, must reach (a) commit on PR #12142 (or its parallel PR per W6.P5.C topology), (b) this ADR, (c) dashboard JSON
