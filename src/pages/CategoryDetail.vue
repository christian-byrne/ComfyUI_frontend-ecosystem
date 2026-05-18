<script setup lang="ts">
import type { StubVariant } from '@/composables/useStubFetcher'
import { computed, onMounted, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { stubUrl, useStubFetcher } from '@/composables/useStubFetcher'
import { useBehaviorCategoriesStore } from '@/stores/behaviorCategories'

const route = useRoute()
const store = useBehaviorCategoriesStore()

const categoryId = computed(() => String(route.params.id ?? ''))
const category = computed(() => store.get(categoryId.value))

const variants: StubVariant[] = ['v1', 'v2', 'migration']

let fetcher = useStubFetcher(categoryId.value)

function rebuildFetcher(): void {
  fetcher = useStubFetcher(categoryId.value)
  void fetcher.load()
}

onMounted(rebuildFetcher)
watch(categoryId, rebuildFetcher)

function stateLabel(variant: StubVariant): string {
  return fetcher.trio.state[variant]
}

function variantBody(variant: StubVariant): string {
  const state = fetcher.trio.state[variant]
  if (state === 'loading') return '// fetching…'
  if (state === 'absent') return `// no stub published yet (404 from upstream PR)`
  if (state === 'error') return `// fetch error — check console`
  if (state === 'idle') return `// not yet fetched`
  return fetcher.trio.body[variant] ?? ''
}
</script>

<template>
  <section class="p-6 max-w-5xl mx-auto" data-test="category-detail">
    <RouterLink
      :to="{ name: 'behavior-categories' }"
      class="text-xs text-zinc-400 hover:text-zinc-200"
    >
      ← all behavior categories
    </RouterLink>

    <template v-if="category">
      <header class="mt-3 mb-6">
        <div class="text-xs font-mono text-zinc-500">
          {{ category.category_id }}
        </div>
        <h1 class="text-2xl font-semibold mt-1">
          {{ category.name }}
        </h1>
        <p class="text-sm text-zinc-400 mt-2">
          {{ category.intent }}
        </p>
        <p
          v-if="category.notes"
          class="text-xs text-zinc-500 mt-3 whitespace-pre-line border-l-2 border-zinc-800 pl-3"
        >
          {{ category.notes }}
        </p>
      </header>

      <section class="mb-8" data-test="member-patterns">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-2">
          Member patterns ({{ category.member_pattern_ids.length }})
        </h2>
        <ul class="flex flex-wrap gap-2">
          <li v-for="pid in category.member_pattern_ids" :key="pid">
            <RouterLink
              :to="{ name: 'pattern-detail', params: { id: pid } }"
              class="inline-block px-2 py-1 rounded border border-zinc-800 bg-zinc-900/60 text-xs font-mono hover:border-zinc-600 hover:bg-zinc-900"
              data-test="pattern-link"
            >
              {{ pid }}
            </RouterLink>
          </li>
        </ul>
      </section>

      <section data-test="stub-trio">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-2">
          Test stubs (upstream PR <code>ext-api/i-tf</code>)
        </h2>
        <div class="space-y-4">
          <div
            v-for="variant in variants"
            :key="variant"
            class="border border-zinc-800 rounded"
            :data-test="`stub-block-${variant}`"
          >
            <header
              class="flex items-center justify-between px-3 py-2 border-b border-zinc-800 text-xs"
            >
              <div class="flex items-center gap-3">
                <span class="font-mono text-zinc-300"
                  >bc-{{ category.category_id.replace('BC.', '') }}.{{ variant }}.test.ts</span
                >
                <span
                  class="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide"
                  :class="{
                    'bg-emerald-900/40 text-emerald-300': stateLabel(variant) === 'present',
                    'bg-zinc-800 text-zinc-400':
                      stateLabel(variant) === 'absent' || stateLabel(variant) === 'idle',
                    'bg-amber-900/40 text-amber-300': stateLabel(variant) === 'loading',
                    'bg-rose-900/40 text-rose-300': stateLabel(variant) === 'error'
                  }"
                  >{{ stateLabel(variant) }}</span
                >
              </div>
              <a
                :href="stubUrl(category.category_id, variant) ?? '#'"
                target="_blank"
                rel="noopener"
                class="text-zinc-500 hover:text-zinc-300"
                >raw ↗</a
              >
            </header>
            <pre
              class="p-3 text-xs overflow-x-auto whitespace-pre text-zinc-300 bg-zinc-950/60 max-h-96"
            ><code>{{ variantBody(variant) }}</code></pre>
          </div>
        </div>
      </section>
    </template>

    <template v-else>
      <p class="mt-8 text-sm text-zinc-400">
        Unknown behavior category: <code>{{ categoryId }}</code
        >.
      </p>
    </template>
  </section>
</template>
