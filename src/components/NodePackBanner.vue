<script setup lang="ts">
import { computed } from 'vue'

import { starCache } from '@/data/star-cache'

/**
 * NodePackBanner — compact card describing a node-pack repo.
 *
 * STUB: this is the W3 placeholder until the W2.C `registry-client` branch
 * lands the full version with Comfy Registry photos, install counts, and
 * publisher avatars. PatternDetail (and future Heatmap / NodePacks pages)
 * consume this through the same `<repo>` prop so swapping the implementation
 * requires no callsite changes.
 *
 * For now we read whatever the local star-cache knows about the repo
 * (stars, archived, last commit) and render it in a single banner row.
 */
const props = defineProps<{
  /** owner/name as it appears in evidence rows. */
  repo: string
  /** Optional dense mode: hides secondary metadata. */
  dense?: boolean
}>()

const entry = computed(() => starCache[props.repo])
const githubUrl = computed(() => `https://github.com/${props.repo}`)
</script>

<template>
  <a
    :href="githubUrl"
    target="_blank"
    rel="noreferrer"
    class="block rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm transition hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
    data-testid="node-pack-banner"
  >
    <div class="flex items-center justify-between gap-3">
      <span class="truncate font-mono text-xs text-zinc-700 dark:text-zinc-300">{{ repo }}</span>
      <span
        v-if="entry"
        class="shrink-0 rounded bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
      >
        ★ {{ entry.stars.toLocaleString() }}
      </span>
      <span
        v-else
        class="shrink-0 rounded bg-zinc-50 dark:bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-400 dark:text-zinc-500"
        title="not in star-cache"
      >
        ☆ ?
      </span>
    </div>
    <div
      v-if="!dense && entry"
      class="mt-1 flex items-center gap-3 text-[11px] text-zinc-400 dark:text-zinc-500"
    >
      <span v-if="entry.forks !== undefined">⑂ {{ entry.forks }}</span>
      <span v-if="entry.last_commit">last commit {{ entry.last_commit }}</span>
      <span v-if="entry.archived" class="text-rose-500 dark:text-rose-400">archived</span>
    </div>
  </a>
</template>
