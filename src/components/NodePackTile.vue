<script setup lang="ts">
/**
 * NodePackTile — clickable wrapper around {@link NodePackCard} for the
 * {@link NodePacks} page.
 *
 * Renders an immediate, fully-laid-out card built from local data
 * (star-cache + pattern coverage) and asynchronously enriches it with the
 * Comfy Registry response (banner, description, downloads, publisher).
 * The card never blanks while the request is in flight, and a missing
 * registry response just leaves the local view as the final state.
 *
 * Coverage metrics ride below the card body so the user can see *why* a
 * pack ranked into the top-20 under the current sort.
 */
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { getPackByGithubUrl } from '@/services/registryApi'
import type { RegistryNode } from '@/types/registry'
import { repoToPackId } from '@/utils/repoToPackId'

import NodePackCard from './NodePackCard.vue'

const props = defineProps<{
  repo: string
  stars: number
  patternHits: number
  weightedImpact: number
  totalHits: number
}>()

const emit = defineEmits<{
  /** Fires once the registry fetch settles (success *or* error). */
  (e: 'enrich-finished', repo: string): void
}>()

/** Local fallback so the card renders before the registry call settles. */
const seedPack = computed<RegistryNode>(() => ({
  id: repoToPackId(props.repo) ?? props.repo,
  name: props.repo.split('/').pop() ?? props.repo,
  author: props.repo.split('/')[0],
  github_stars: props.stars || undefined,
  repository: `https://github.com/${props.repo}`
}))

// `getPackByGithubUrl` is a side-effecting cache lookup (it primes a fetch
// the first time we ask for `props.repo`). `props.repo` is stable per tile,
// so we resolve it eagerly at setup instead of through a computed getter to
// keep reactivity tracking pure.
// TODO(registry-client): when the registry adds `/nodes?ids=…` batching,
//   plumb a single batched call through `useTopPacks` instead of N
//   per-tile fetches. See PR #5 review item 5.
const result = getPackByGithubUrl(props.repo)

const renderedPack = computed<RegistryNode>(() => {
  const remote = result.data.value
  return remote ? { ...seedPack.value, ...remote } : seedPack.value
})

const hasError = computed(() => result.error.value !== null)

/** Surface registry errors quietly to the console for debugging. */
watch(
  () => result.error.value,
  (err) => {
    if (err) {
      console.warn('[NodePackTile] registry lookup failed', props.repo, err)
    }
  },
  { immediate: true }
)

// Notify the parent grid once the request settles so it can drop
// `aria-busy`. `useFetch.isFinished` flips to true on both success and
// error.
watch(
  () => result.isFinished.value,
  (finished) => {
    if (finished) emit('enrich-finished', props.repo)
  },
  { immediate: true }
)

const targetPackId = computed(
  () => repoToPackId(props.repo) ?? encodeURIComponent(props.repo)
)
</script>

<template>
  <RouterLink
    :to="{ name: 'pack-detail', params: { packId: targetPackId } }"
    class="group block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
    data-testid="node-pack-tile"
    :data-repo="repo"
    :aria-label="`Open ${renderedPack.name ?? repo} pack details`"
  >
    <NodePackCard :node-pack="renderedPack" />
    <dl
      class="mt-1 flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-zinc-500"
      aria-label="Pattern coverage"
    >
      <div class="flex gap-1">
        <dt class="text-zinc-400">patterns</dt>
        <dd class="font-mono">{{ patternHits }}</dd>
      </div>
      <div class="flex gap-1">
        <dt class="text-zinc-400">hits</dt>
        <dd class="font-mono">{{ totalHits }}</dd>
      </div>
      <div class="flex gap-1">
        <dt class="text-zinc-400">impact</dt>
        <dd class="font-mono">{{ weightedImpact.toFixed(1) }}</dd>
      </div>
      <span
        v-if="hasError"
        class="sr-only"
        data-testid="tile-error"
        :data-repo="repo"
      >
        Registry lookup failed for {{ repo }}; showing local data.
      </span>
    </dl>
  </RouterLink>
</template>
