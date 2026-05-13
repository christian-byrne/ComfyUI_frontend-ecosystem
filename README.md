# ComfyUI Frontend Ecosystem Explorer

Visualize and explore the ComfyUI extension API ecosystem — patterns, blast radius, behavior categories, v1↔v2 diff, node-pack heatmap, test runner.

## Features

- **Overview** — Hero stats + top patterns by blast radius
- **Patterns** — Full pattern table with search, sort, pack filter
- **Pattern Detail** — Per-pattern evidence, category membership, API signatures
- **Behavior Categories** — 41 categories with stub coverage indicators
- **Node Packs** — Top 20 packs with Comfy Registry integration (banners, stars)
- **Heatmap** — Pattern × Pack evidence matrix with click-through drawer
- **API Diff** — v1→v2 migration status cards with search/filter
- **Test Runner** — Vitest harness status page

## Tech Stack

- Vue 3 (Composition API) + TypeScript
- Vite 5 + Tailwind CSS 4
- Pinia (state management)
- Vitest (166 unit tests) + Playwright (36 E2E tests)
- Vercel (preview per PR, prod on `main`)

## Data

- `research/` — touch-points database (59 patterns, 634 evidence rows), behavior categories (41 cats × 3 stub types), R8 clone-and-grep evidence (887 rows from top-20 ComfyUI custom-node packs)
- `research/workspace-mirror/` — full mirror of the cross-repo research workspace

## Rebuild

The dashboard data pipeline is a deterministic, idempotent chain. Same inputs ⇒ same outputs. Re-runnable end-to-end via a single command:

```bash
make rebuild              # full pipeline (stars + rollup + data + build)
# or
bash scripts/rebuild.sh   # equivalent
# or
pnpm rebuild              # equivalent
```

Pipeline (in order):

| Step | Target | Inputs | Output |
|---|---|---|---|
| 1 | `make stars`  | `research/touch-points-database.yaml` + `gh api`     | `research/touch-points-star-cache.yaml` |
| 2 | `make rollup` | database + star-cache                                | `research/touch-points-rollup.yaml` |
| 3 | `make data`   | all four YAMLs (db, rollup, stars, behavior-cats)    | (verifies parseability — no transform) |
| 4 | `make build`  | YAMLs (read by Vite via `?raw` import) + `src/`      | `dist/` |

Granular targets — run any single step:

```bash
make stars      # just refresh the GitHub star cache (needs `gh` auth)
make rollup     # just recompute blast-radius rollup
make data       # just verify YAML inputs parse
make build      # just run vue-tsc + vite build
make clean      # remove dist/ and .vite cache
make test       # vitest
```

Offline / no `gh` auth available?

```bash
bash scripts/rebuild.sh --skip-stars   # skips step 1, runs the rest
# or
pnpm rebuild:offline
```

Force a fresh build (clears `dist/` and Vite cache first):

```bash
bash scripts/rebuild.sh --clean
```

**Why this exists:** the dashboard's data layer reads YAML directly via Vite's `?raw` import (see `src/data/index.ts`), so the `build` step is the only code-side regeneration. Steps 1 and 2 regenerate the YAMLs themselves from raw GitHub state. Closes the loop on [#26](https://github.com/christian-byrne/ComfyUI_frontend-ecosystem/issues/26) — "deterministic rebuild script".

Required tools: `bash`, `python3` (with `pyyaml`), `gh` (authenticated), `jq`, `pnpm`, `node`.

## Backing repos

- Upstream PR stack: [Comfy-Org/ComfyUI_frontend #12102, #12103, #12104, #12105](https://github.com/Comfy-Org/ComfyUI_frontend/pulls?q=is%3Apr+author%3Achristian-byrne+ext-api)
- Personal review channel (fork): [christian-byrne/ComfyUI_frontend #5–#8](https://github.com/christian-byrne/ComfyUI_frontend/pulls)
- Cross-repo workspace: `/home/c_byrne/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api`

## License
MIT
