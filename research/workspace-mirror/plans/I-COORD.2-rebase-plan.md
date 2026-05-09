---
task: I-COORD.2
date_written: 2026-05-08
source_url: https://github.com/Comfy-Org/ComfyUI_frontend/pull/11939
status: planning — NOT yet executed
---

# I-COORD.2 — Rebase Plan: `extension-v2-api-proposal` onto Alex's ECS PRs

## Goal

Rebase `extension-v2-api-proposal` onto Alex's ECS substrate PRs so that Phase B can begin: handle internals stop being thin shims and start dispatching to real ECS World commands.

---

## Current state

### Our branch (`extension-v2-api-proposal`)

Three commits ahead of main that are ours:

```
3a6fe052c  feat(test-framework): extension-API test suite + compat-floor gate (I-TF)
83263fd2e  docs(arch): pass-3 evidence merge (240→634 evidence, 56→59 patterns)
581c5bb38  feat(ext-api-v2): surface-only API shim — base for Phase A stack
```

**Dirty working tree** (uncommitted Phase A work in progress):

| File | Status | Notes |
|------|--------|-------|
| `src/services/extension-api-service.ts` | untracked | New — scope registry, handle factories, `@/world/*` imports all as stubs |
| `src/services/__tests__/` | untracked | D12 regression tests from I-SR.2.B2 |
| `src/types/extensionV2.ts` | modified | Now a re-export shim pointing to `@/extension-api` |
| `src/extensions/core/dynamicPrompts.v2.ts` | modified | v2-converted extension |
| `src/extensions/core/imageCrop.v2.ts` | modified | v2-converted extension |
| `src/extensions/core/previewAny.v2.ts` | modified | v2-converted extension |
| `src/extensions/core/index.ts` | modified | Registers the .v2.ts conversions |
| `src/scripts/app.ts` | modified | Wired `defineExtension` into app startup |
| `src/extensions/core/noteNode.v2.ts` | untracked | New v2 conversion |
| `src/extensions/core/rerouteNode.v2.ts` | untracked | New v2 conversion |
| `src/extensions/core/slotDefaults.v2.ts` | untracked | New v2 conversion |
| `src/services/extensionV2Service.ts` | deleted | Superseded by `extension-api-service.ts` |
| `AGENTS.md` / `pnpm-lock.yaml` | modified | Minor updates |

**Key:** `extension-api-service.ts` already imports from `@/world/worldInstance`, `@/world/entityIds`, `@/world/componentKey`, and `@/world/widgets/widgetComponents` — all of which are stubs that don't exist yet. They're annotated with `// TODO(#11939)`. The branch compiles but would fail at runtime for any World-reading code path.

### Alex's PRs (rebase target)

**PR #11811** — `fix(subgraph): restore promoted widget instance state` (May 1, open)
- Restores subgraph promoted-widget instance state that was lost during ECS migration
- Known bug: Austin found an issue with it
- Alex's own comment: "might be worth just keeping the tests from #11811 and solving the issue differently in the ECS"
- **Risk:** base may be replaced by a different approach before it merges

**PR #11939** — `feat(world): ECS substrate slice 1` (May 4, draft, stacked on #11811)
- Introduces the actual `@/world/` module tree that `extension-api-service.ts` is already anticipating
- Expected exports: `getWorld`, `NodeEntityId`, `WidgetEntityId`, `defineComponentKey`, `WidgetComponentValue`, `WidgetComponentDisplay`, `WidgetComponentSchema`, `WidgetComponentSerialize`, `WidgetComponentContainer`
- **PR #11706** (`feat(world): add ECS substrate, rewrite widgetValueStore as facade`, Apr 27) is an unstacked alternative — may be the merge path if #11811 gets dropped

Alex's Slack (2026-05-08 17:33): "we'll probably need both" — but with the hedge that #11811's approach may change.

---

## Conflict surface analysis

Files most likely to conflict on rebase:

### High risk

| File | Why |
|------|-----|
| `src/world/` (new directory) | We have stub imports; PR #11939 introduces real module. No file conflict but our stubs will be replaced by real exports — need to verify our expected interface matches what Alex actually ships. |
| `src/services/extension-api-service.ts` | We added this as untracked; #11939 may also touch `src/services/` (extensionV2Service.ts or a new service). If Alex adds a service file with overlapping functionality, manual reconciliation needed. |
| `src/stores/widgetStore.ts` / widgetValueStore | PR #11939 rewrites `widgetValueStore` as an ECS facade (per commit message on #11706). Our Phase A code reads widget values through `WidgetComponentValue` — should align, but the facade shape must match. |
| `src/scripts/app.ts` | We modified it (wired `defineExtension`); #11939 may modify it too for ECS initialization. Classic app.ts conflict. |
| `src/types/extensionV2.ts` | We changed it to a re-export shim. #11939 may also touch extension types. |

### Medium risk

| File | Why |
|------|-----|
| `src/extensions/core/index.ts` | Both us (registering .v2.ts) and #11939 may touch extension registration |
| `pnpm-lock.yaml` | Any new dependency on either side causes lockfile conflict |
| `src/extensions/core/*.ts` | Alex may have already converted some core extensions on his branch |

### Low risk

| File | Why |
|------|-----|
| `src/extension-api/` | Entirely new directory we added; unlikely to conflict unless Alex added a competing `src/extension-api/` |
| `src/extension-api-v2/__tests__/` | All new files we added; unlikely conflict |
| `packages/extension-api/` | New package we added; no conflict expected |

---

## World module interface expectations

Our `extension-api-service.ts` is already coded against a specific `@/world` interface. Before rebasing, verify Alex's PR exports are compatible:

### What we import (stubs) vs. what we need Alex to export

| Import path | Our assumed export | Used for |
|-------------|-------------------|---------|
| `@/world/worldInstance` | `getWorld(): World` | Get the singleton ECS world |
| `@/world/entityIds` | `NodeEntityId`, `WidgetEntityId` (branded string types) | Type-safe entity IDs |
| `@/world/componentKey` | `defineComponentKey<T, EntityId>(name): ComponentKey<T>` | Create typed component keys |
| `@/world/widgets/widgetComponents` | `WidgetComponentValue`, `WidgetComponentDisplay`, `WidgetComponentSchema`, `WidgetComponentSerialize`, `WidgetComponentContainer` | Read widget ECS state |

**Critical check:** Our `NodeEntityId` stub is `string & { __brand: 'NodeEntityId' }` and our `SlotEntityId` stub is `string & { __brand: 'SlotEntityId' }`. Alex's real brands may use a different discriminant field or format. The format string we assume for scope registry keys is `node:${graphUuid}:${nodeId}` — confirm this matches Alex's actual ID format.

**`dispatch()` stub:** We have a no-op dispatch stub annotated `TODO(#11939)`. Alex's PR likely introduces the real dispatch function. Once rebased, every `dispatch(SetWidgetValue, ...)` call site becomes real. Verify the command shape — our assumed `{ type: string, payload: ... }` may not match Alex's actual command protocol.

---

## Rebase strategy

### Option A: Rebase onto current #11939 state (chase if it pivots)

**Recommended.** Rebase immediately onto whatever #11939's head is today, even though it's a draft. Accept that we may need a follow-on rebase if Alex pivots #11811's approach.

**Rationale:**
- Phase B work (I-PG.B1–B3, I-SR.3.B4) is blocked until we have real `@/world/*` modules. Delaying the rebase delays all of Phase B.
- "Chase if it pivots" is bounded: if #11811 changes shape, the delta between #11811-current and #11811-new is smaller than rebasing fresh from main.
- The pivot risk (Alex dropping #11811) is specifically about the subgraph widget-promotion logic — this doesn't touch our `@/world/widgets/widgetComponents` import surface.

### Option B: Wait for #11939 to exit draft

**Not recommended.** We don't know the timeline, and Phase B is already blocked.

### Option C: Rebase onto #11706 directly (skip #11811)

**Fallback.** If #11811 turns out to be replaced before merging, rebase onto #11706 (`feat(world): add ECS substrate, rewrite widgetValueStore as facade`) which is the unstacked version. Same `@/world/*` module surface, different base.

---

## Step-by-step rebase procedure

### Pre-rebase prep (do before touching git)

1. **Commit all Phase A WIP** as a single "wip: Phase A scope registry + core ext conversions" commit on `extension-v2-api-proposal`. This lets git rebase work cleanly — no mixed-staged state.

2. **Record the exact TODO(#11939) sites** so we know what to un-stub after rebase:
   - `extension-api-service.ts:59` — stub node-component keys (replace with real imports)
   - `extension-api-service.ts:86` — SlotEntityId brand (replace with real brand)
   - `extension-api-service.ts:89` — `dispatch()` stub (replace with real dispatch)
   - `extension-api-service.ts:167` — `WidgetName` component (replace with real key)
   - `extension-api-service.ts:222` — `world.onSystemEvent` (wire when available)
   - `extension-api-service.ts:296` — `WidgetName` component key for scope key parsing
   - `extension-api-service.ts:366` — `world.onSystemEvent` second site

3. **Check if Alex added any parallel `src/services/` file** — if his branch has a competing `extensionV2Service.ts`-replacement, negotiate merge before rebase, not during.

### Rebase steps

```bash
# From ComfyUI_frontend worktree
git fetch origin

# Check Alex's PR branch name (confirm in PR description or git ls-remote)
# Expected: origin/feat/world-ecs-substrate-slice-1 or similar
git fetch origin feat/world-ecs-substrate-slice-1

# Point-in-time snapshot before rebase
git tag extension-v2-pre-rebase-$(date +%Y%m%d)

# Rebase
git rebase origin/<alex-pr-branch>
```

### Expected conflicts and resolution

| Conflict site | Resolution |
|--------------|------------|
| `src/scripts/app.ts` | Keep both: Alex's ECS init + our `defineExtension` wire. Ordering: ECS init first, then extension registration. |
| `src/stores/widgetStore.ts` | Accept Alex's version (ECS facade). Our WidgetHandle reads from `@/world/widgets/widgetComponents` which is what the facade wraps. No logic to merge. |
| `src/services/extensionV2Service.ts` (deleted by us) | If Alex also deleted or renamed it, accept the deletion. If Alex modified it, our deletion wins — it's replaced by `extension-api-service.ts`. |

### Post-rebase: un-stub the TODO(#11939) sites

After the rebase, work through each `TODO(#11939)` comment:

1. **Node-component keys** — replace stub `defineComponentKey()` calls with real imports from `@/world/nodeComponents` (or whatever module Alex uses)
2. **SlotEntityId brand** — replace `string & { __brand: 'SlotEntityId' }` with real brand from `@/world/entityIds`
3. **`dispatch()`** — replace with real import from `@/world/commands`
4. **`world.onSystemEvent`** — wire if Alex's World interface has it; leave `TODO(D8)` if not yet exposed

This post-rebase work is the content of **I-PG.B1** and **I-SR.3.B4** — do not combine with the rebase commit.

---

## Risks and mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Alex's `@/world` module shape differs from our stubs | Medium | Pre-rebase: read #11939's actual source files. Post-rebase: TypeScript will surface every mismatch. |
| #11811 pivots before merging | Medium | Use Option C (rebase onto #11706 instead). The widget-component module surface is the same. |
| `app.ts` conflict is non-trivial | Medium | Manual review required. The ECS init sequence and extension registration order both matter for reactivity. D3.5 specifies: `world.queryAll(NodeType)` watch must activate before extension manager starts calling `defineExtension` setups. |
| Phase A WIP is larger than expected (untracked files) | Low | We see exactly 7 untracked + 8 modified files. Size is bounded. Commit first, resolve conflicts file-by-file. |
| `widgetValueStore` facade changes `WidgetComponentValue` shape | Low | Our reads are `world.getComponent(id, WidgetComponentValue)?.value` — very simple accessor. Shape change would be immediately visible. |

---

## Sequencing relative to other work

```
Today (Phase A):
  ├─ Commit Phase A WIP (app.ts wire, scope registry, core ext conversions)
  ├─ Open PR for I-TF (test framework only — no service code, clean baseline)
  └─ Wait for #11939 to be ready for review (or rebase onto current draft)

After rebase:
  ├─ I-PG.B1 — un-stub TODO(#11939) sites, dispatch to real ECS
  ├─ I-PG.B2 — classify each top-blast-radius surface: ECS-native | strangler-bridge | uwf-resolved
  ├─ I-SR.3.B4 — wire `watch(queryAll)` loop with real world.queryAll
  └─ I-PG.B3 — update D9 Phase B section with per-pattern classification

I-TF.5 (open PR for test framework) should happen BEFORE rebase — keep the test framework
PR clean from the service code changes. Two PRs, not one.
```

---

## Open questions (need answers before executing rebase)

1. **What is the exact git branch name for #11939?** (Check the PR "Branches" tab or `git ls-remote origin | grep world`)

2. **Does #11939 introduce `src/world/` or `src/ecs/`?** The CONTEXT.md references both `@/ecs/world` and `@/world/`; our stub imports use `@/world`. Confirm the actual module path before rebase.

3. **Does Alex's branch delete or rename `extensionV2Service.ts`?** We deleted it; if he modified it, we need to negotiate before rebasing.

4. **Is the `World.onSystemEvent` API in #11939 or later?** Our `TODO(#11939)` markers assume it's coming; if it's not in slice 1, those sites stay as `TODO(D8)` stubs.

5. **What's the `NodeEntityId` format string?** We use it as a scope registry key. If Alex's IDs look different (e.g. UUIDs vs `node:graphId:litegraph-node-id`), our scope registry key scheme needs updating.
