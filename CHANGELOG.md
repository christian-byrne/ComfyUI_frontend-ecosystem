# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- API Docs page with Swagger-style reference for @comfyorg/extension-api
- Cross-reference mappings between patterns and behavior categories
- E2E test suite with Playwright (69 tests)
- Visual blast radius gauge on pattern detail pages
- Lazy-load Shiki for syntax highlighting performance
- `scripts/recompute-usage-weights.py` — regenerates behavior-category
  `usage_weight` from the rollup, replacing the never-vendored
  `build-behavior-categories.py`. Wired in as `make weights`.
- `scripts/sync-star-cache.py` — reconciles the JSON and YAML star caches
  (union, newest-`asof`-wins) behind a guard that refuses to shrink the data,
  plus `--backfill-missing` / `--refresh` for targeted `gh` fetches.
- `scripts/normalize-repo-slugs.py` + `scripts/check-repo-slugs.py` — canonical
  `owner/name` slugs and a CI gate that every cited slug resolves against the
  star cache (issue #30 parts B and C).
- `make check` / `pnpm data:check` — all data drift guards, now run in CI.
- `ProvenanceNotice` component on Overview, API Diff and Behavior Categories,
  recording that counts are a floor and that the v2 rewrite is deferred.
- First test file for `useStubFetcher`, which had shipped an injectable
  `fetchImpl` seam for testing and no tests.

### Fixed

- **`usage_weight` was stale across all 41 behavior categories** — 11 sat at a
  placeholder `0.00`, ranking them last in every weight-sorted view. BC.36 was
  the worst case: stored `0.00`, actually `230.83` (rank 2 of 41). `meta`
  claimed 62 source patterns / 37 categories against an actual 73 / 41.
- **Star-cache direction was inverted in the docs.** The README described
  YAML → JSON; in reality the YAML was 11 repos and 5 days _behind_ the JSON
  the app imports, so `make stars` regressed the data. JSON is now canonical
  and the merge cannot shrink it.
- **`PATTERN_TO_BC` was a hand-maintained map** covering 28 of 73 patterns with
  four wrong entries (`S2.N2`, `S2.N4`, `S2.N5`, `S2.N6`). Now derived from
  `behavior-categories.json` at build time.
- **`useStubFetcher` fetched from the dead `ext-api/i-tf` branch** (head frozen
  since 2026-05-11). Repointed at `ext-api/i-tf-restratify`, matching
  `useApiSurface`; the localStorage prefix was bumped so cached 404s from the
  dead branch are not replayed.
- **Repo slugs were not normalised** — bare slugs and three fork/re-upload
  slugs resolved to 0 stars, understating `cumulative_stars` and
  `blast_radius`.
- Stale counts throughout the docs (59 → 73 patterns, 634 → 699 evidence rows,
  15 → 17 surface families, 166 → 358 unit tests, 36 → 69 E2E tests).

### Changed

- `useTestRunner` renamed to **`useSimulatedTestRunner`** and now advertises
  itself as simulated in the UI. It executes no tests: results come from a
  nine-entry table and every unlisted pattern reports "passed".
- Compat-floor doctrine (`blast_radius >= 2.0` MUST pass before v2 ships) is
  labelled **retired (wave-10)** wherever it appeared, per `AXIOMS.md`.
- v2 extension API content is labelled **deferred**, not current direction.
