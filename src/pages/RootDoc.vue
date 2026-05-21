<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import MarkdownView from '@/components/MarkdownView.vue'
import { getRootBody, manifest } from '@/data/knowledge-loader'

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? '').toLowerCase())
const body = computed(() => getRootBody(slug.value))
const meta = computed(() => manifest.root.find((r) => r.slug === slug.value))

useHead(() => ({
  title: meta.value ? `${meta.value.title} — Handoff` : 'Document not found'
}))
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <nav class="mb-4 text-sm">
      <RouterLink to="/handoff" class="text-blue-600 hover:underline dark:text-blue-400">
        ← Handoff
      </RouterLink>
    </nav>

    <div v-if="!body" class="rounded border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950/30">
      <h1 class="text-xl font-semibold">Document not found</h1>
      <p class="mt-2 text-sm">No root document with slug <code>{{ slug }}</code>.</p>
    </div>

    <template v-else>
      <header class="mb-6">
        <h1 class="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          {{ meta?.title ?? slug.toUpperCase() }}
        </h1>
        <p v-if="meta" class="mt-1 text-xs text-zinc-500">{{ meta.bytes }} bytes</p>
      </header>
      <MarkdownView :source="body" />
    </template>
  </div>
</template>
