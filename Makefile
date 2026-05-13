# Makefile — deterministic rebuild for the dashboard data pipeline.
#
# Thin wrapper over scripts/rebuild.sh. See `bash scripts/rebuild.sh --help`
# for full pipeline docs. Targets are idempotent: same inputs ⇒ same outputs.

.PHONY: rebuild stars rollup data build clean test help

help:  ## show this help
	@awk 'BEGIN {FS=":.*##"; printf "Targets:\n"} /^[a-z_-]+:.*##/ {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

rebuild:  ## full pipeline: stars + rollup + data + build
	@bash scripts/rebuild.sh all

stars:  ## refresh research/touch-points-star-cache.yaml from GitHub (needs `gh` auth)
	@bash scripts/rebuild.sh stars

rollup:  ## recompute research/touch-points-rollup.yaml from db + stars
	@bash scripts/rebuild.sh rollup

data:  ## verify dashboard data inputs are present + parseable
	@bash scripts/rebuild.sh data

build:  ## pnpm build (Vite + vue-tsc)
	@bash scripts/rebuild.sh build

clean:  ## remove dist/ and Vite cache
	@bash scripts/rebuild.sh clean

test:  ## pnpm test (vitest)
	@bash scripts/rebuild.sh test
