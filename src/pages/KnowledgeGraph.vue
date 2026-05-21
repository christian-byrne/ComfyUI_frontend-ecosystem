<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { allAxioms, decisionsSorted, manifest } from '@/data/knowledge-loader'

useHead({ title: 'Knowledge Graph — ComfyUI Frontend Ecosystem' })

// Layout: axiom-vs-ADR adjacency matrix. Rows = ADRs (in canonical
// order), columns = axioms (numeric order). Each filled cell links to
// the ADR detail page, anchored to the row that explains the citation.
const adrsWithAxioms = computed(() =>
  decisionsSorted.filter((d) => d.axioms.length > 0)
)

const cells = computed(() => {
  // Pre-compute O(1) lookup for "does ADR x cite axiom y".
  const map = new Map<string, Set<string>>()
  for (const d of adrsWithAxioms.value) {
    map.set(d.slug, new Set(d.axioms))
  }
  return map
})

function hasCitation(slug: string, axiom: string): boolean {
  return cells.value.get(slug)?.has(axiom) ?? false
}

// Aggregate degree per ADR and per axiom for chip metadata.
const adrDegree = computed(() =>
  Object.fromEntries(adrsWithAxioms.value.map((d) => [d.slug, d.axioms.length]))
)
const axiomDegree = computed(() =>
  Object.fromEntries(allAxioms.map((a) => [a, manifest.axiomIndex[a]?.length ?? 0]))
)
</script>

<template>
  <div class="mx-auto max-w-7xl">
    <header class="mb-6">
      <h1 class="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
        Knowledge Graph
      </h1>
      <p class="text-zinc-600 dark:text-zinc-400">
        Axiom ↔ ADR adjacency matrix. Rows: {{ adrsWithAxioms.length }} ADRs that cite at
        least one axiom. Columns: {{ allAxioms.length }} active axioms.
      </p>
    </header>

    <section class="mb-6 flex flex-wrap gap-2 text-xs">
      <span class="rounded bg-violet-100 px-2 py-1 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200">
        ● cited
      </span>
      <span class="rounded bg-zinc-100 px-2 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        · not cited
      </span>
      <span class="text-zinc-500">Hover a row/column header for the degree count.</span>
    </section>

    <div class="overflow-x-auto" data-testid="kg-matrix">
      <table class="border-collapse text-xs">
        <thead>
          <tr>
            <th class="sticky left-0 z-10 bg-white px-2 py-1 text-left font-mono dark:bg-zinc-950">
              ADR / Axiom
            </th>
            <th
              v-for="a in allAxioms"
              :key="a"
              class="px-1 py-1 font-mono text-violet-700 dark:text-violet-300"
              :title="`${a}: cited by ${axiomDegree[a]} ADR(s)`"
            >
              <RouterLink :to="`/axioms#${a.toLowerCase()}-refs`" class="hover:underline">
                {{ a }}
              </RouterLink>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="d in adrsWithAxioms"
            :key="d.slug"
            class="border-t border-zinc-200 dark:border-zinc-800"
          >
            <th
              scope="row"
              class="sticky left-0 z-10 max-w-[18rem] truncate bg-white px-2 py-1 text-left font-mono text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
              :title="`${d.slug}: cites ${adrDegree[d.slug]} axiom(s) — ${d.title}`"
            >
              <RouterLink :to="`/decisions/${d.slug}`" class="text-blue-600 hover:underline dark:text-blue-400">
                {{ d.slug }}
              </RouterLink>
            </th>
            <td
              v-for="a in allAxioms"
              :key="a"
              class="px-1 py-1 text-center"
              :class="
                hasCitation(d.slug, a)
                  ? 'bg-violet-200 text-violet-900 dark:bg-violet-700 dark:text-violet-100'
                  : 'text-zinc-300 dark:text-zinc-700'
              "
            >
              <span v-if="hasCitation(d.slug, a)">●</span>
              <span v-else>·</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <section class="mt-10 grid gap-4 md:grid-cols-2">
      <div class="rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Top-cited axioms
        </h2>
        <ol class="space-y-1 text-sm">
          <li
            v-for="a in [...allAxioms].sort((x, y) => axiomDegree[y] - axiomDegree[x]).slice(0, 5)"
            :key="a"
          >
            <RouterLink :to="`/axioms#${a.toLowerCase()}-refs`" class="font-mono text-violet-700 hover:underline dark:text-violet-300">
              {{ a }}
            </RouterLink>
            <span class="ml-2 text-zinc-500">{{ axiomDegree[a] }} ADR(s)</span>
          </li>
        </ol>
      </div>
      <div class="rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Most axiom-anchored ADRs
        </h2>
        <ol class="space-y-1 text-sm">
          <li
            v-for="d in [...adrsWithAxioms].sort((x, y) => y.axioms.length - x.axioms.length).slice(0, 5)"
            :key="d.slug"
          >
            <RouterLink :to="`/decisions/${d.slug}`" class="font-mono text-blue-600 hover:underline dark:text-blue-400">
              {{ d.slug }}
            </RouterLink>
            <span class="ml-2 text-zinc-500">{{ d.axioms.length }} axiom(s)</span>
          </li>
        </ol>
      </div>
    </section>
  </div>
</template>
