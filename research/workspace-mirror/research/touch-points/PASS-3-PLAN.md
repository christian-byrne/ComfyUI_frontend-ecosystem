# Touch-point database — Pass 3 plan & alternative-methodology playbook

> Source: 2026-05-08 closing-out conversation. Captures the strategies we
> identified to push the touch-point database past its current shape (56
> patterns / 195 evidence rows / 105 starred repos) and bind it to the
> test-framework work (`I-TF.1`–`I-TF.5`).
>
> All passes so far (1, 2) used MCP `comfy_codesearch`. That tool is flaky
> (~50% query failure) and suffers vendored-typing noise. Pass 3 diversifies
> evidence sources, then closes the loop into the test framework.

## Status entering pass 3

- DB: **56 patterns / 195 evidence / 15 surface families**
- Top blast: `S6.A1 graphToPrompt` (★17,122)
- 4 patterns still empty: `S2.N18 onPropertyChanged`, `S9.G1 LGraphGroup`,
  `S9.L1 LLink direct`, `S15.OS1 dynamic outputs`
- 5 patterns evidence-light (1–2 rows): `S4.W5`, `S14.ID1`, `S1.H*` family,
  some S2 lifecycle hooks
- Test framework: **planned** in todo `I-TF.1`–`I-TF.5`, **not started**

## Strategies for pass 3

### A) Top-N clone-and-grep (alternative to MCP)

MCP gave us breadth across the long tail. To get **depth on the actual
high-leverage packs**, clone the top star-weighted repos locally and walk
them exhaustively. Avoids MCP flakiness and HTML-instead-of-JSON failures.

**Top-20 to clone** (from `star-cache.yaml` ≥200★, JS/TS frontends only):

  1. Comfy-Org/ComfyUI-Manager       ★14,531
  2. Lightricks/ComfyUI-LTXVideo     ★ 3,575
  3. kijai/ComfyUI-KJNodes           ★ 2,567
  4. yolain/ComfyUI-Easy-Use         ★ 2,504
  5. Comfy-Org/ComfyUI_frontend      ★ 1,788  (own — sanity check)
  6. BennyKok/comfyui-deploy         ★ 1,506
  7. diodiogod/TTS-Audio-Suite       ★   905
  8. melMass/comfy_mtb               ★   702
  9. rgthree/rgthree-comfy           ★   ~1k  (estimate; major pack)
 10. cubiq/ComfyUI_IPAdapter_plus    ★   ~3k
 11. ltdrdata/ComfyUI-Impact-Pack    ★   ~3k
 12. ssitu/ComfyUI_UltimateSDUpscale ★   ~2k
 13. Fannovel16/comfyui_controlnet_aux★  ~2k
 14. WASasquatch/was-node-suite-comfyui ★ ~1k
 15. crystian/ComfyUI-Crystools     ★    ~1k
 16. Comfy-Org/comfyui-frontend-types★    ~  (the type contract)
 17. Acly/comfyui-tooling-nodes     ★    ~  (Krita-bridge, very specific)
 18. chrisgoringe/cg-use-everywhere  ★   ~  (rerouter pack — touches S9)
 19. bash-j/mikey_nodes
 20. Azornes/Comfyui-LayerForge     ★   313

Approach:
- `mass-clone.sh` style script under `scripts/clone-top-20.sh` →
  `~/research-clones/comfy-extensions/{org}__{repo}/`
- Walk each repo's frontend code (`web/`, `js/`, `src/extensions/`,
  `*.ts`, `*.js`) with `rg -n` for our 56 fingerprints
- Write hits into `database.yaml` via `add-evidence-pass3.py`
- Expected: 200–500 new evidence rows; weight per-pattern occurrence count
  per repo to surface "this pack uses pattern X 40 times" signals

Why this matters for ranking: `occurrence` in the rollup currently caps at
the unique-evidence-row count. Cloning lets us count true call-site density
within each pack, which sharpens blast-radius scoring.

### B) Ingest existing on-disk research

Already-extant artifacts that we have NOT pulled into the DB:

| Source | Path | Likely yield |
|---|---|---|
| Security scan corpus | `~/projects/custom-nodes-security-scan/docs/*.{html,json}` | `eval()` / `Function()` / dynamic import patterns; serialize/inject patterns; ~60+ packs already audited |
| Trending top-N report | `~/projects/comfy-testing-environment/trending-top-custom-nodes-report/data/nodes_snapshot_2025-07-09.json` | authoritative star/popularity ranking → re-rank our top-20 list |
| Reddit report generator | `~/projects/.../reports/reddit_report_2025-07-10.md` | community-perceived-importance signal (orthogonal to stars) |
| Custom-node guides | `~/guides/custom-nodes-guides/` | what we *teach* people to do — these are the API surfaces we've inadvertently sanctioned. Each idiom in our own docs == a forced-public surface |
| Custom-node QA worktree | `~/worktrees/custom-node-qa/` | regression scenarios that already failed in QA — perfect test-case seed |
| Cookiecutter template | `~/.cookiecutters/cookiecutter-comfy-extension/.../custom-nodes-template` | the surfaces we scaffold by default → must remain stable in v2 |

Approach:
- One ingestion script per source under
  `scripts/ingest-{source-name}.py` — each emits a YAML chunk that
  `add-evidence-pass3.py` merges
- Tag each evidence row with `source: clone | mcp | security-scan | guides
  | qa | cookiecutter` so we can audit later

Strongest expected wins:
1. **Cookiecutter** flips ≥3 patterns to "officially-sanctioned-surface"
   status (cannot break in v2)
2. **Custom-node-QA** gives us **real failing-test seeds** for `I-TF.3`
   (the test harness needs runnable extension snippets — QA has them)
3. **Security scan** finds `eval`/`Function`/`dangerousHTML` patterns we
   never thought to fingerprint — likely 1–2 new patterns

### C) Reverse-direction sweep: walk the public type barrel

We've been finding what extensions use. The complement: walk **every export
in `src/types/index.ts` plus `comfyui-frontend-types`** and assert that each
either has a touch-point pattern in the DB or is documented as
"intentionally not public". Catches surfaces we've never seen extensions
use *yet* but that the export shape promises.

Approach: `scripts/audit-public-exports.py` reads the barrel, intersects
against `database.yaml`, lists orphans. Closes the "did we miss any" gap
that pass-1 / pass-2 keep hitting.

### D) Reverse-direction sweep: walk LiteGraph prototype methods

For every `prototype.*` method on `LGraphNode`, `LGraph`, `LGraphCanvas`,
`LGraphGroup`, `LLink`, `Reroute` — check if it appears in the DB as either
a patched fingerprint or a callable surface. Each unmapped prototype member
is a latent touch point. Likely surfaces 5–10 new patterns.

## Mapping evidence → tests (closing the loop with I-TF)

This is the existing plan in `todo.md → ## Must Do — Implementation Phase →
I-TF.1`–`I-TF.5`. Pass 3 makes it executable:

```diagram
╭───────────────╮     ╭──────────────────╮     ╭────────────────────╮
│ database.yaml │ ──▶ │ behavior-cats    │ ──▶ │ test triple/cat    │
│ 56 patterns   │     │ ~26 categories   │     │ v1 / v2 / migration│
│ 195 evidence  │     │ (rolled-up)      │     │ (~78 test files)   │
╰───────────────╯     ╰──────────────────╯     ╰────────────────────╯
        │                       │                        │
        ▼                       ▼                        ▼
   evidence[].excerpt      exemplar_repos[3]      it.todo() seeds
   (real snippet)          (real-world packs)     (testable pasta)
```

Concrete bridge work (extending `I-TF`):

- **I-TF.0 (NEW prerequisite)** — extend `database.yaml` schema with
  `excerpt: |` field on each evidence row holding 5–20 lines of actual
  code, fetched via the `url`. Required for `I-TF.3` test harness to load
  real snippets. Run as part of pass-3 clone-and-grep.

- **I-TF.1.5 (NEW)** — for every behavior category, pick the **top-3
  highest-blast-radius patterns** as the canonical members. The other
  members become parametric variants of the same test. Reduces 78 test
  files → ~26 + parametric matrix.

- **I-TF.6 (NEW)** — wire up `harness/loadEvidenceSnippet(patternId,
  evidenceIndex)` that returns the excerpt as a parsable extension stub.
  Test bodies become `expect(harness.runV1(snippet)).toEqual(harness.runV2(snippet))`.

- **I-TF.7 (NEW)** — Compatibility floor enforcement: the current PLAN.md
  says `blast_radius ≥ 2.0` patterns MUST pass v1+v2+migration before v2
  ships. Add a CI check that re-reads `rollup.yaml` and fails if any such
  pattern lacks all three test files.

## Pass-3 task sequence

1. R8 — Top-20 clone-and-grep (strategy A) → `add-evidence-pass3.py`
2. R9 — Ingest 6 on-disk sources (strategy B) → `ingest-*.py` per source
3. R10 — Public-export audit (strategy C) + LiteGraph prototype audit
   (strategy D) → may add new patterns, may add deprecation candidates
4. Re-run `fetch-stars.sh` + `rollup-blast-radius.py`
5. Land I-TF.0 schema extension; populate `excerpt:` from clones
6. Land I-TF.1.5/I-TF.6/I-TF.7 alongside existing I-TF.1–5 work
7. PR onto fork branch incrementally; user reviews via inline comments

## Out-of-scope for pass 3 (defer)

- Multi-month longitudinal star-history → defer to dedicated tooling
- Backend Python custom-node patterns (only frontend matters for v2 API)
- Issues/PRs on Comfy-Org repos referencing extension breakage —
  high-signal but separate research thread (R11 candidate)
