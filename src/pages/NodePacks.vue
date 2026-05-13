<script setup lang="ts">
/**
 * NodePacks browse page (W3).
 *
 * Renders the top 20 node-packs surfaced by the touch-points evidence
 * sweep, sortable by:
 *
 *   - **Stars** — github star count from the local star cache.
 *   - **Pattern hits** — distinct v1-API patterns the pack uses.
 *   - **Weighted impact** — Σ(hits × pattern blast_radius); proxy for how
 *     loud a v2-migration breakage in this pack would be.
 *
 * Each tile links to {@link PackDetail} via the `pack-detail` route.
 *
 * Registry banner/description/downloads are fetched per-tile from the
 * Comfy Registry — tiles render immediately from local data, then enrich
 * once the request settles. See {@link NodePackTile}.
 */
import { computed, ref } from "vue";

import NodePackTile from "@/components/NodePackTile.vue";
import { useTopPacks } from "@/composables/useTopPacks";
import type { TopPackEntry, TopPackSort } from "@/composables/useTopPacks";

interface SortOption {
  value: TopPackSort;
  label: string;
  blurb: string;
}

const SORT_OPTIONS: readonly SortOption[] = [
  { value: "stars", label: "Stars", blurb: "GitHub stars (local cache)" },
  {
    value: "patternHits",
    label: "Pattern hits",
    blurb: "Distinct v1 patterns the pack uses",
  },
  {
    value: "weightedImpact",
    label: "Weighted impact",
    blurb: "Σ(hits × pattern blast_radius)",
  },
] as const;

const sort = ref<TopPackSort>("stars");
// Sort changes are local-only — the top-N list is recomputed in-memory; no
// registry refetch happens here. Per-tile fetches were primed on first mount.
const packs = useTopPacks(sort, 20);

const activeBlurb = computed(
  () => SORT_OPTIONS.find((o) => o.value === sort.value)?.blurb ?? "",
);

function trackBy(entry: TopPackEntry): string {
  return entry.repo;
}

/**
 * Aggregate per-tile enrichment state so the grid can advertise
 * `aria-busy="true"` to assistive tech while any tile's registry fetch is
 * still in flight. Tiles emit `enrich-finished` once their request settles
 * (success *or* error).
 */
const finishedRepos = ref<Set<string>>(new Set());
const isEnriching = computed(
  () => finishedRepos.value.size < packs.value.length,
);
function onTileFinished(repo: string): void {
  if (!finishedRepos.value.has(repo)) {
    finishedRepos.value = new Set(finishedRepos.value).add(repo);
  }
}
</script>

<template>
  <section data-testid="node-packs-page">
    <header class="mb-6">
      <h1 class="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Node Packs
      </h1>
      <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Top 20 packs from the touch-points sweep, joined with the Comfy
        Registry. Click a pack for the per-pattern coverage table.
      </p>
    </header>

    <div
      class="mb-4 flex flex-wrap items-center gap-3 text-sm"
      role="radiogroup"
      aria-label="Sort packs by"
    >
      <span class="text-zinc-500 dark:text-zinc-400">Sort:</span>
      <button
        v-for="opt in SORT_OPTIONS"
        :key="opt.value"
        type="button"
        role="radio"
        :aria-checked="sort === opt.value"
        :aria-label="`Sort by ${opt.label}`"
        :data-testid="`sort-${opt.value}`"
        class="rounded-md border px-3 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        :class="
          sort === opt.value
            ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'
        "
        @click="sort = opt.value"
      >
        {{ opt.label }}
      </button>
      <span class="ml-1 text-xs text-zinc-400 dark:text-zinc-500">{{
        activeBlurb
      }}</span>
    </div>

    <ul
      v-if="packs.length"
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      data-testid="node-packs-grid"
      :aria-busy="isEnriching"
      aria-label="Top node packs"
    >
      <li v-for="entry in packs" :key="trackBy(entry)">
        <NodePackTile
          :repo="entry.repo"
          :stars="entry.stars"
          :pattern-hits="entry.patternHits"
          :weighted-impact="entry.weightedImpact"
          :total-hits="entry.totalHits"
          @enrich-finished="onTileFinished(entry.repo)"
        />
      </li>
    </ul>
    <p
      v-else
      class="text-sm text-zinc-500 dark:text-zinc-400"
      data-testid="node-packs-empty"
    >
      No packs in the touch-points evidence yet.
    </p>
  </section>
</template>
