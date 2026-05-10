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
import { computed, watchEffect } from 'vue'
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

/** Local fallback so the card renders before the registry call settles. */
const seedPack = computed<RegistryNode>(() => ({
  id: repoToPackId(props.repo) ?? props.repo,
  name: props.repo.split('/').pop() ?? props.repo,
  author: props.repo.split('/')[0],
  github_stars: props.stars || undefined,
  repository: `https://github.com/${props.repo}`
}))

const result = computed(() => getPackByGithubUrl(props.repo))

const renderedPack = computed<RegistryNode>(() => {
  const remote = result.value.data.value
  return remote ? { ...seedPack.value, ...remote } : seedPack.value
})

/** Surface registry errors quietly to the console for debugging. */
watchEffect(() => {
  const err = result.value.error.value
  if (err) {
    console.warn('[NodePackTile] registry lookup failed', props.repo, err)
  }
})

const targetPackId = computed(
  () => repoToPackId(props.repo) ?? encodeURIComponent(props.repo)
)
</script>

<template>
  <RouterLink
    :to="{ name: 'pack-detail', params: { packId: targetPackId } }"
    class="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
    data-testid="node-pack-tile"
    :data-repo="repo"
  >
    <NodePackCard :node-pack="renderedPack" />
    <dl
      class="mt-1 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-zinc-500"
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
    </dl>
  </RouterLink>
</template>
