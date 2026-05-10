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
import { computed, ref } from 'vue'

import NodePackTile from '@/components/NodePackTile.vue'
import { useTopPacks } from '@/composables/useTopPacks'
import type { TopPackEntry, TopPackSort } from '@/composables/useTopPacks'

interface SortOption {
  value: TopPackSort
  label: string
  blurb: string
}

const SORT_OPTIONS: readonly SortOption[] = [
  { value: 'stars', label: 'Stars', blurb: 'GitHub stars (local cache)' },
  {
    value: 'patternHits',
    label: 'Pattern hits',
    blurb: 'Distinct v1 patterns the pack uses'
  },
  {
    value: 'weightedImpact',
    label: 'Weighted impact',
    blurb: 'Σ(hits × pattern blast_radius)'
  }
] as const

const sort = ref<TopPackSort>('stars')
const sortRef = computed(() => sort.value)
const packs = useTopPacks(sortRef, 20)

const activeBlurb = computed(
  () => SORT_OPTIONS.find((o) => o.value === sort.value)?.blurb ?? ''
)

function trackBy(entry: TopPackEntry): string {
  return entry.repo
}
</script>

<template>
  <section data-testid="node-packs-page">
    <header class="mb-6">
      <h1 class="text-2xl font-semibold text-zinc-900">Node Packs</h1>
      <p class="mt-1 text-sm text-zinc-500">
        Top 20 packs from the touch-points sweep, joined with the Comfy
        Registry. Click a pack for the per-pattern coverage table.
      </p>
    </header>

    <div
      class="mb-4 flex flex-wrap items-center gap-3 text-sm"
      role="group"
      aria-label="Sort packs by"
    >
      <span class="text-zinc-500">Sort:</span>
      <button
        v-for="opt in SORT_OPTIONS"
        :key="opt.value"
        type="button"
        :aria-pressed="sort === opt.value"
        :data-testid="`sort-${opt.value}`"
        class="rounded-md border px-3 py-1 transition"
        :class="
          sort === opt.value
            ? 'border-zinc-900 bg-zinc-900 text-white'
            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
        "
        @click="sort = opt.value"
      >
        {{ opt.label }}
      </button>
      <span class="ml-1 text-xs text-zinc-400">{{ activeBlurb }}</span>
    </div>

    <ul
      v-if="packs.length"
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      data-testid="node-packs-grid"
    >
      <li v-for="entry in packs" :key="trackBy(entry)">
        <NodePackTile
          :repo="entry.repo"
          :stars="entry.stars"
          :pattern-hits="entry.patternHits"
          :weighted-impact="entry.weightedImpact"
          :total-hits="entry.totalHits"
        />
      </li>
    </ul>
    <p v-else class="text-sm text-zinc-500">
      No packs in the touch-points evidence yet.
    </p>
  </section>
</template>
