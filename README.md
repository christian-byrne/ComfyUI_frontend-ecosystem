# ComfyUI Frontend Ecosystem Explorer

Visualize and explore the ComfyUI extension API ecosystem — patterns, blast radius, behavior categories, v1↔v2 diff, node-pack heatmap, test runner.

**Status:** scaffolding (Wave 1: research bundle + repo init)

## What's here today

- `research/` — touch-points database (59 patterns, 634 evidence rows), behavior categories (41 cats × 3 stub types), R8 clone-and-grep evidence (887 rows from top-20 ComfyUI custom-node packs), full ECS+Vue API redesign research bundle from the cross-repo workspace.
- `research/workspace-mirror/` — full mirror of the cross-repo research workspace (decisions, plans, todo, sources).

## What's coming

- `src/` — Vue 3 + Vite + Tailwind 4 + Pinia dashboard
- Pages: Overview, Patterns, PatternDetail, BehaviorCategories, NodePacks (with banner+photos via Comfy Registry API), Heatmap, ApiDiff, TestRunner
- Deploy: Vercel (preview per PR, prod on `main`)

## Backing repos

- Upstream PR stack: [Comfy-Org/ComfyUI_frontend #12102, #12103, #12104, #12105](https://github.com/Comfy-Org/ComfyUI_frontend/pulls?q=is%3Apr+author%3Achristian-byrne+ext-api)
- Personal review channel (fork): [christian-byrne/ComfyUI_frontend #5–#8](https://github.com/christian-byrne/ComfyUI_frontend/pulls)
- Cross-repo workspace: `/home/c_byrne/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api`

## License
MIT
