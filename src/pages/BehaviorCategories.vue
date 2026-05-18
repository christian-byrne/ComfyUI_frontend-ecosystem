<script setup lang="ts">
import type { StubState, StubVariant } from '@/composables/useStubFetcher'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { readTrioCoverage } from '@/composables/useStubFetcher'
import { useBehaviorCategoriesStore } from '@/stores/behaviorCategories'

const store = useBehaviorCategoriesStore()

interface CardModel {
  id: string
  name: string
  intent: string
  patternCount: number
  coverage: Record<StubVariant, StubState>
}

const cards = computed<CardModel[]>(() =>
  store.categories.map((c) => ({
    id: c.category_id,
    name: c.name,
    intent: c.intent,
    patternCount: c.member_pattern_ids.length,
    coverage: readTrioCoverage(c.category_id)
  }))
)

const variants: StubVariant[] = ['v1', 'v2', 'migration']

function dotClass(state: StubState): string {
  switch (state) {
    case 'present':
      return 'bg-emerald-500'
    case 'absent':
      return 'bg-zinc-700'
    case 'loading':
      return 'bg-amber-400 animate-pulse'
    case 'error':
      return 'bg-rose-500'
    default:
      return 'bg-zinc-600'
  }
}

function dotTitle(variant: StubVariant, state: StubState): string {
  return `${variant} stub: ${state}`
}
</script>

<template>
  <section class="p-6">
    <header class="mb-6">
      <h1 class="text-2xl font-semibold">Behavior Categories</h1>
      <p class="text-zinc-400 text-sm mt-1">
        {{ cards.length }} categories · click a card for patterns + test stubs. Stub coverage
        indicators (v1 · v2 · migration) reflect cached fetches from the upstream PR (1-day TTL).
      </p>
    </header>

    <div
      data-test="bc-grid"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
    >
      <RouterLink
        v-for="card in cards"
        :key="card.id"
        :to="{ name: 'category-detail', params: { id: card.id } }"
        class="block border border-zinc-800 rounded-md p-4 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700 transition"
        data-test="bc-card"
        :data-test-id="card.id"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-xs font-mono text-zinc-500">
              {{ card.id }}
            </div>
            <div class="text-sm font-medium mt-0.5 truncate">
              {{ card.name }}
            </div>
          </div>
          <div class="text-xs text-zinc-400 shrink-0">
            {{ card.patternCount }}
            {{ card.patternCount === 1 ? 'pattern' : 'patterns' }}
          </div>
        </div>
        <p class="text-xs text-zinc-500 mt-2 line-clamp-2">
          {{ card.intent }}
        </p>
        <div class="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
          <span>stubs</span>
          <span v-for="v in variants" :key="v" class="flex items-center gap-1">
            <span
              class="inline-block w-2 h-2 rounded-full"
              :class="dotClass(card.coverage[v])"
              :title="dotTitle(v, card.coverage[v])"
              :data-test="`stub-dot-${v}`"
              :data-state="card.coverage[v]"
            />
            <span>{{ v }}</span>
          </span>
        </div>
      </RouterLink>
    </div>
  </section>
</template>
