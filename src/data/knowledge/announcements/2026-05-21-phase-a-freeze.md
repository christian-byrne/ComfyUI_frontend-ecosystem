# Phase A surface freeze — extension-api v2

**Date**: 2026-05-21
**Frozen at**: foundation `ee0537fdb5` (wave-11)
**Dashboard**: https://comfyui-frontend-ecosystem.vercel.app/api-diff
**ADR**: [D-api-surface-finalization](https://github.com/.../decisions/D-api-surface-finalization.md)

---

## Slack post (copy into #ext-api / #frontend)

> 🧊 **extension-api v2 — Phase A surface frozen**
>
> The Phase A public API surface is now locked at foundation commit `ee0537fdb5`.
> Live PRs `#12142` / `#12143` / `#12144` / `#12145` will be **rebased onto the ECS branch (PR #11939)** before merge — full CI green is only required at that rebase point, not now.
>
> What's frozen:
> • All 7 `defineX` shell-UI entry points (sidebar/bottom panel/command/hotkey/setting/about-badge/toolbar)
> • `defineNode` / `defineWidget` + `NodeHandle` / `WidgetHandle` reduced surfaces
> • Event API: `widget.on('valueChange')` / `widget.on('beforeSerialize')` / `node.on(...)` lifecycle
> • Bootstrap: `defineExtension` + `setup`/`mount` hooks
> • No `addWidget` at runtime (A15); no `setSerializeEnabled` (A16); no `getWidget(s)` on NodeHandle (A1 bilateral)
>
> Re-open the surface requires either:
> 1. A new ACCEPTED ADR with axiom-compliance verification, OR
> 2. Phase B trigger (ECS rebase merges `#11939`)
>
> **Phase B kickoff issue**: https://github.com/Comfy-Org/ComfyUI_frontend/issues/12394
> **First Phase B work**: `defineWidgetAugmenter` (PROPOSED — unblocks `dynamicPrompts.v2` + global-seed-sync) — see [D-define-widget-augmenter](https://github.com/.../decisions/D-define-widget-augmenter.md)
>
> **Dashboard** with the full frozen surface + per-export MDX + behavior categories: https://comfyui-frontend-ecosystem.vercel.app
>
> Questions / additions to Phase B scope → reply in thread.

---

## Re-open criteria (firm list)

| # | Trigger | Surface effect | Owner placeholder |
|---|---------|----------------|---|
| 1 | `defineWidgetAugmenter` ADR ACCEPTED | +1 entry point, +1 type | P0 — unblocks 2 things |
| 2 | Core widget migrations (preview/progress/audio) | A15 internal cleanup | P1 — separate scope |
| 3 | `dynamicPrompts.v2` unstub | Re-exports under existing barrel | blocked on (1) |
| 4 | Virtual-node internal cleanup (Reroute/Primitive) | No public surface | P2 — N12 internal exception |
| 5 | D8 World↔Vue reactive adapter | Adapter swap transparent to authors | blocked on PR #11939 |
| 6 | D6.2 types-package sunset criteria | Removal of one published package | blocked on telemetry |

## Cosmetic marker

Empty marker commit on `christian-byrne/ComfyUI_frontend-ecosystem` (`chore: mark Phase A surface freeze checkpoint`) — surfaces the freeze in the Vercel deploy log even though MDX is byte-identical to wave-11 (D-api-surface-finalization §dashboard verification).

## Posting checklist

- [x] Phase B kickoff issue opened: [Comfy-Org/ComfyUI_frontend#12394](https://github.com/Comfy-Org/ComfyUI_frontend/issues/12394)
- [x] Marker commit pushed: `cf0cf88` on `christian-byrne/ComfyUI_frontend-ecosystem` main
- [x] PR comments posted: #12142 (`4503933885`) / #12143 (`4503933969`) / #12144 (`4503934042`) / #12145 (`4503934140`)
- [ ] Replace ADR github.com placeholder links with real repo URLs (workspace ADRs live in `cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api`) — **HUMAN**
- [ ] Post in #ext-api primary, cross-post in #frontend with thread link — **HUMAN**
- [ ] Pin in #ext-api for 1 week — **HUMAN**
