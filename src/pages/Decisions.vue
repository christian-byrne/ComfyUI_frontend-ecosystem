<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { decisionsSorted, decisionsByStatus, manifest } from '@/data/knowledge-loader'
import Badge from '@/components/ui/Badge.vue'

useHead({ title: 'Decisions — ComfyUI Frontend Ecosystem' })

const filterStatus = ref<string>('all')
const filterAxiom = ref<string>('all')
const search = ref<string>('')

const statuses = computed(() => ['all', ...Object.keys(decisionsByStatus).sort()])

const allAxioms = computed(() =>
  Object.keys(manifest.axiomIndex).sort(
    (a, b) => Number(a.slice(1)) - Number(b.slice(1))
  )
)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return decisionsSorted.filter((d) => {
    if (filterStatus.value !== 'all' && (d.status ?? '') !== filterStatus.value)
      return false
    if (filterAxiom.value !== 'all' && !d.axioms.includes(filterAxiom.value))
      return false
    if (q && !d.slug.includes(q) && !d.title.toLowerCase().includes(q))
      return false
    return true
  })
})

// Map ADR status strings to the shared <Badge variant=…> palette.
// `proposed` keeps the blue/in-flight feel via a `neutral` badge plus an
// explicit `text-blue-*` override so callers reading the page still see the
// in-flight tone the dashboard has used since Wave-15.
type BadgeVariant = 'neutral' | 'success' | 'warning' | 'planned' | 'danger'

interface StatusStyle {
  variant: BadgeVariant
  /** Extra utility classes layered on the Badge for status-specific tone. */
  extra?: string
}

const statusStyle: Record<string, StatusStyle> = {
  accepted: { variant: 'success' },
  shipped: { variant: 'success' },
  proposed: {
    variant: 'neutral',
    extra: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200'
  },
  deferred: { variant: 'warning' },
  superseded: {
    variant: 'neutral',
    extra: 'line-through bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
  },
  unknown: { variant: 'neutral' }
}

function styleFor(status: string | null): StatusStyle {
  const key = (status ?? 'unknown').split(/\s|—|\(/)[0].toLowerCase()
  return statusStyle[key] ?? statusStyle.unknown
}
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <header class="mb-6">
      <h1 class="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
        Architecture Decisions
      </h1>
      <p class="text-zinc-600 dark:text-zinc-400">
        {{ manifest.decisions.length }} ADRs covering the v2 extension API surface, axiom system, lifecycle, serialization, and rebase strategy.
      </p>
    </header>

    <div class="mb-6 flex flex-wrap gap-3" data-testid="decisions-filters">
      <input
        v-model="search"
        type="search"
        placeholder="Search by slug or title…"
        aria-label="Search decisions"
        class="flex-1 min-w-[12rem] rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <select
        v-model="filterStatus"
        aria-label="Filter by status"
        class="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option v-for="s in statuses" :key="s" :value="s">{{ s === 'all' ? 'All statuses' : s }}</option>
      </select>
      <select
        v-model="filterAxiom"
        aria-label="Filter by axiom"
        class="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="all">All axioms</option>
        <option v-for="a in allAxioms" :key="a" :value="a">{{ a }}</option>
      </select>
    </div>

    <p class="mb-3 text-xs text-zinc-500" data-testid="decisions-result-count">
      Showing {{ filtered.length }} of {{ manifest.decisions.length }} decisions
    </p>

    <ul class="divide-y divide-zinc-200 dark:divide-zinc-800" data-testid="decisions-list">
      <li v-for="d in filtered" :key="d.slug" class="py-3">
        <div class="flex flex-wrap items-baseline gap-2">
          <RouterLink
            :to="`/decisions/${d.slug}`"
            class="text-sm font-mono font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            {{ d.slug }}
          </RouterLink>
          <Badge :variant="styleFor(d.status).variant" :class="styleFor(d.status).extra">
            {{ d.status ?? 'unknown' }}
          </Badge>
          <span class="text-sm text-zinc-700 dark:text-zinc-300">{{ d.title }}</span>
        </div>
        <div v-if="d.axioms.length || d.adrs.length" class="mt-1 flex flex-wrap gap-1 text-xs text-zinc-500">
          <span v-for="a in d.axioms" :key="a" class="rounded bg-violet-100 px-1.5 py-0.5 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">{{ a }}</span>
          <span v-if="d.adrs.length" class="ml-2">refs: {{ d.adrs.length }} other ADR(s)</span>
        </div>
      </li>
    </ul>
  </div>
</template>
