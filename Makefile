# Makefile — deterministic rebuild for the dashboard data pipeline.
#
# Thin wrapper over scripts/rebuild.sh. See `bash scripts/rebuild.sh --help`
# for full pipeline docs. Targets are idempotent: same inputs ⇒ same outputs.
#
# Canonical data lives in src/data/*.json (that is what the app imports).
# The YAMLs under research/ are the hand-curated research sources, plus one
# derived mirror (touch-points-star-cache.yaml). See README §Rebuild.

.PHONY: rebuild stars stars-sync stars-backfill rollup weights slugs data check build clean test help

help:  ## show this help
	@awk 'BEGIN {FS=":.*##"; printf "Targets:\n"} /^[a-z_-]+:.*##/ {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

rebuild:  ## full pipeline: stars + rollup + weights + slugs + data + build
	@bash scripts/rebuild.sh all

stars:  ## refresh the star cache from GitHub, merged into the canonical JSON (needs `gh` auth)
	@bash scripts/rebuild.sh stars

stars-sync:  ## re-derive the YAML star-cache mirror from the canonical JSON (no network)
	@python3 scripts/sync-star-cache.py

stars-backfill:  ## `gh`-fetch star rows for repos the data cites but the cache lacks
	@python3 scripts/sync-star-cache.py --backfill-missing

rollup:  ## recompute research/touch-points-rollup.yaml from db + stars
	@bash scripts/rebuild.sh rollup

weights:  ## recompute behavior-category usage_weight from the rollup
	@bash scripts/rebuild.sh weights

slugs:  ## normalise repo slugs in the data to canonical owner/name
	@bash scripts/rebuild.sh slugs

data:  ## verify dashboard data inputs are present + parseable, then run all checks
	@bash scripts/rebuild.sh data

check:  ## read-only: every drift/consistency guard (this is what CI runs)
	@bash scripts/rebuild.sh check

build:  ## pnpm build (Vite + vue-tsc)
	@bash scripts/rebuild.sh build

clean:  ## remove dist/ and Vite cache
	@bash scripts/rebuild.sh clean

test:  ## pnpm test (vitest)
	@bash scripts/rebuild.sh test
