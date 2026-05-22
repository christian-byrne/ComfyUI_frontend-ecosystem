<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import Prose from '@/components/ui/Prose.vue'
import { ensureHighlighter } from '@/composables/useHighlighter'
import { useMarkdownWithSlugDedupe } from '@/composables/useMarkdownWithSlugDedupe'

const { source, prose = false } = defineProps<{
  source: string
  /**
   * Opt-in: wrap rendered HTML in `<Prose>` for max-w-prose vertical
   * rhythm + heading styling (Wave-18 W18.F). Default `false` keeps
   * the legacy `prose-zinc` Tailwind-typography output so existing
   * call sites are byte-identical until pages opt in (W18.G/H).
   */
  prose?: boolean
}>()

const ready = ref(false)
onMounted(async () => {
  await ensureHighlighter()
  ready.value = true
})

// Wave-19 W19.P2+P5 — heading ids + per-render dedupe are now
// delegated to `useMarkdownWithSlugDedupe`, which wraps
// `marked-gfm-heading-id`. Replaces the hand-rolled module-level
// Map<string,number> previously living in this file (W18.N).
const { render } = useMarkdownWithSlugDedupe()

const html = computed(() => {
  // touch `ready` so the computed re-runs after the highlighter loads
  void ready.value
  return render(source)
})
</script>

<template>
  <Prose v-if="prose" :html="html" />
  <article
    v-else
    class="prose prose-zinc max-w-none dark:prose-invert prose-pre:!bg-zinc-950 prose-pre:!text-zinc-100 dark:prose-pre:!bg-black prose-code:before:hidden prose-code:after:hidden prose-a:text-blue-600 hover:prose-a:underline dark:prose-a:text-blue-400"
    v-html="html"
  />
</template>
