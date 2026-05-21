<script setup lang="ts">
import { marked, Renderer } from 'marked'
import { computed, onMounted, ref } from 'vue'

import { ensureHighlighter, highlightCode } from '@/composables/useHighlighter'

const { source } = defineProps<{ source: string }>()

const ready = ref(false)
onMounted(async () => {
  await ensureHighlighter()
  ready.value = true
})

const renderer = new Renderer()
renderer.code = ({ text, lang }) =>
  highlightCode(text, lang || 'text')

marked.setOptions({ gfm: true, breaks: false })
marked.use({ renderer })

const html = computed(() => {
  // touch `ready` so the computed re-runs after the highlighter loads
  void ready.value
  return marked.parse(source) as string
})
</script>

<template>
  <article
    class="prose prose-zinc max-w-none dark:prose-invert prose-pre:!bg-zinc-950 prose-pre:!text-zinc-100 dark:prose-pre:!bg-black prose-code:before:hidden prose-code:after:hidden prose-a:text-blue-600 hover:prose-a:underline dark:prose-a:text-blue-400"
    v-html="html"
  />
</template>
