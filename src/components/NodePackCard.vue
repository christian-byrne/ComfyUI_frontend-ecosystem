<script setup lang="ts">
/**
 * Compact node-pack card.
 *
 * PrimeVue-free port of upstream
 * {@link https://github.com/Comfy-Org/ComfyUI_frontend Manager `PackCard.vue`}.
 * Renders banner + name + author + description + (stars, downloads).
 * Install/enable controls are upstream-only and intentionally omitted —
 * this dashboard is read-only.
 *
 * Click bubbles via the parent's `@click` if present; the card itself stays
 * a plain div (no router-link inside) so consumers control destination.
 */
import { computed } from 'vue'

import NodePackBanner from '@/components/NodePackBanner.vue'
import type { RegistryNode } from '@/types/registry'

const { nodePack } = defineProps<{ nodePack: RegistryNode }>()

const publisherName = computed(() => {
  const { publisher, author } = nodePack
  return publisher?.name ?? publisher?.id ?? author ?? null
})

const numberFmt = new Intl.NumberFormat()
const formattedDownloads = computed(() =>
  nodePack.downloads ? numberFmt.format(nodePack.downloads) : null
)
const formattedStars = computed(() =>
  nodePack.github_stars ? numberFmt.format(nodePack.github_stars) : null
)

/**
 * Derive an `owner/repo` slug for the legacy {@link NodePackBanner} props
 * shape. The banner component looks the repo up in the local star cache;
 * if the registry lacks a `repository` URL we fall back to the pack id.
 */
const bannerRepo = computed(() => {
  const repoUrl = nodePack.repository
  if (repoUrl) {
    const m = repoUrl.match(/github\.com\/([^/]+\/[^/?#]+)/i)
    if (m) return m[1].replace(/\.git$/, '')
  }
  return nodePack.id ?? ''
})
</script>

<template>
  <article
    class="flex size-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white transition-colors duration-200 hover:bg-zinc-50 select-none"
  >
    <NodePackBanner v-if="bannerRepo" :repo="bannerRepo" />

    <div class="flex min-h-0 flex-1 flex-col px-3 py-2">
      <h3
        class="truncate overflow-hidden text-xs font-bold text-ellipsis text-zinc-900"
      >
        {{ nodePack.name ?? nodePack.id }}
      </h3>
      <p
        v-if="nodePack.description"
        class="my-0 mb-1 line-clamp-3 min-h-12 flex-1 overflow-hidden text-xs/4 font-medium wrap-break-word text-zinc-500"
      >
        {{ nodePack.description }}
      </p>
      <div
        v-if="publisherName"
        class="mt-1 flex max-w-40 truncate text-xs/3 font-medium text-zinc-500"
      >
        {{ publisherName }}
      </div>
    </div>

    <div
      class="flex min-h-10 items-center justify-between border-t border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500"
    >
      <span
        v-if="formattedStars"
        class="flex items-center gap-1"
        :title="`${formattedStars} GitHub stars`"
        aria-label="GitHub stars"
      >
        <span aria-hidden="true">★</span>
        <span>{{ formattedStars }}</span>
      </span>
      <span v-else />
      <span
        v-if="formattedDownloads"
        class="flex items-center gap-1"
        :title="`${formattedDownloads} installs`"
        aria-label="Install count"
      >
        <span aria-hidden="true">↓</span>
        <span>{{ formattedDownloads }}</span>
      </span>
    </div>
  </article>
</template>
