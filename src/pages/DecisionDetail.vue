<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import MarkdownView from '@/components/MarkdownView.vue'
import {
  getDecisionBody,
  manifest,
  decisionsSorted
} from '@/data/knowledge-loader'

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? '').toLowerCase())

const meta = computed(() =>
  manifest.decisions.find((d) => d.slug === slug.value)
)
const body = computed(() => getDecisionBody(slug.value))
const backlinks = computed(() => manifest.adrBacklinks[slug.value] ?? [])

useHead(() => ({
  title: meta.value
    ? `${meta.value.slug} — ${meta.value.title}`
    : 'Decision not found'
}))

const navIndex = computed(() => decisionsSorted.findIndex((d) => d.slug === slug.value))
const prev = computed(() =>
  navIndex.value > 0 ? decisionsSorted[navIndex.value - 1] : null
)
const next = computed(() =>
  navIndex.value >= 0 && navIndex.value < decisionsSorted.length - 1
    ? decisionsSorted[navIndex.value + 1]
    : null
)
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <nav class="mb-4 text-sm">
      <RouterLink to="/decisions" class="text-blue-600 hover:underline dark:text-blue-400">
        ← All decisions
      </RouterLink>
    </nav>

    <div v-if="!meta || !body" class="rounded border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950/30">
      <h1 class="text-xl font-semibold">Decision not found</h1>
      <p class="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
        No ADR with slug <code>{{ slug }}</code> in the synced knowledge base.
      </p>
    </div>

    <template v-else>
      <header class="mb-6">
        <div class="mb-2 font-mono text-xs uppercase tracking-wide text-zinc-500">
          {{ meta.slug }} · status: <span class="font-semibold">{{ meta.status }}</span>
        </div>
        <h1 class="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          {{ meta.title }}
        </h1>
        <div class="mt-3 flex flex-wrap gap-2 text-xs">
          <RouterLink
            v-for="a in meta.axioms"
            :key="a"
            :to="`/axioms#${a.toLowerCase()}`"
            class="rounded bg-violet-100 px-1.5 py-0.5 text-violet-800 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-200"
          >{{ a }}</RouterLink>
        </div>
      </header>

      <MarkdownView :source="body" />

      <section v-if="backlinks.length" class="mt-10 rounded border border-zinc-200 p-4 dark:border-zinc-800" data-testid="adr-backlinks">
        <h2 class="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Referenced by ({{ backlinks.length }})
        </h2>
        <ul class="flex flex-wrap gap-2 text-xs">
          <li v-for="b in backlinks" :key="b">
            <RouterLink
              :to="`/decisions/${b}`"
              class="rounded bg-zinc-100 px-2 py-1 font-mono text-blue-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-blue-400"
            >{{ b }}</RouterLink>
          </li>
        </ul>
      </section>

      <nav class="mt-10 flex justify-between border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
        <RouterLink v-if="prev" :to="`/decisions/${prev.slug}`" class="text-blue-600 hover:underline dark:text-blue-400">
          ← {{ prev.slug }}
        </RouterLink>
        <span v-else />
        <RouterLink v-if="next" :to="`/decisions/${next.slug}`" class="text-blue-600 hover:underline dark:text-blue-400">
          {{ next.slug }} →
        </RouterLink>
      </nav>
    </template>
  </div>
</template>
