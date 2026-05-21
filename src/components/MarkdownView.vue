<script setup lang="ts">
import { marked, Renderer } from 'marked'
import { computed, onMounted, ref } from 'vue'

import Prose from '@/components/ui/Prose.vue'
import { ensureHighlighter, highlightCode } from '@/composables/useHighlighter'

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

const renderer = new Renderer()
renderer.code = ({ text, lang }) =>
  highlightCode(text, lang || 'text')

// Generate stable heading ids so `/path#heading-slug` deep-links scroll to
// the right place. Slug roughly matches GitHub's algorithm: lowercase,
// alphanumerics + hyphens, whitespace collapsed to single hyphens. Must be a
// regular function (not arrow) to retain `this.parser` for inline rendering.
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

renderer.heading = function ({ tokens, depth, text }) {
  const inner = this.parser.parseInline(tokens)
  const id = slugify(text)
  return `<h${depth} id="${id}">${inner}</h${depth}>\n`
}

marked.setOptions({ gfm: true, breaks: false })
marked.use({ renderer })

const html = computed(() => {
  // touch `ready` so the computed re-runs after the highlighter loads
  void ready.value
  return marked.parse(source) as string
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
