<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import MarkdownView from '@/components/MarkdownView.vue'
import { allAxioms, getRootBody, manifest } from '@/data/knowledge-loader'

useHead({ title: 'Axioms — ComfyUI Frontend Ecosystem' })

const body = computed(() => getRootBody('axioms') ?? '')
const axiomCounts = computed(() => {
  const out: Record<string, number> = {}
  for (const a of allAxioms) {
    out[a] = manifest.axiomIndex[a]?.length ?? 0
  }
  return out
})
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <header class="mb-6">
      <h1 class="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
        Axioms
      </h1>
      <p class="text-zinc-600 dark:text-zinc-400">
        Non-negotiable design constraints. Every ADR must respect these; any
        violation requires retroactive axiom change.
      </p>
    </header>

    <section class="mb-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800" data-testid="axiom-grid">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Quick index — click an axiom to see the ADRs that cite it
      </h2>
      <div class="flex flex-wrap gap-2">
        <RouterLink
          v-for="a in allAxioms"
          :key="a"
          :to="`/axioms#${a.toLowerCase()}-refs`"
          class="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-mono text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-900/40 dark:text-violet-200 dark:hover:bg-violet-900/70"
        >
          {{ a }}
          <span class="ml-1 rounded bg-violet-200 px-1 text-[10px] text-violet-800 dark:bg-violet-700 dark:text-violet-100">
            {{ axiomCounts[a] }}
          </span>
        </RouterLink>
      </div>
    </section>

    <MarkdownView v-if="body" :source="body" />
    <div v-else class="rounded border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/30">
      AXIOMS.md not found in synced knowledge. Run <code>pnpm sync:knowledge</code>.
    </div>

    <section class="mt-10 space-y-4" data-testid="axiom-refs">
      <h2 class="text-xl font-semibold">ADR citations per axiom</h2>
      <div
        v-for="a in allAxioms"
        :id="`${a.toLowerCase()}-refs`"
        :key="a"
        class="rounded border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h3 class="mb-2 font-mono text-sm font-semibold text-violet-700 dark:text-violet-300">
          {{ a }} — {{ axiomCounts[a] }} ADR(s)
        </h3>
        <ul class="flex flex-wrap gap-2 text-xs">
          <li v-for="slug in manifest.axiomIndex[a]" :key="slug">
            <RouterLink
              :to="`/decisions/${slug}`"
              class="rounded bg-zinc-100 px-2 py-1 font-mono text-blue-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-blue-400"
            >{{ slug }}</RouterLink>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
