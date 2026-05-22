<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import MarkdownView from '@/components/MarkdownView.vue'
import { getRootBody, manifest } from '@/data/knowledge-loader'

useHead({ title: 'Glossary — ComfyUI Frontend Ecosystem' })

/**
 * Wave-19 W19.A3 — Glossary page.
 *
 * Renders the workspace `docs/glossary.md` (mirrored into
 * `src/data/knowledge/root/glossary.md` by `scripts/sync-knowledge.sh`)
 * using the same `MarkdownView` component that powers `/handoff/root/*`.
 *
 * Heading-id slugify in `MarkdownView` (W18.M/N) means every `## Term`
 * gets `id="term"` automatically, so `/glossary#widget`, `/glossary#value`,
 * etc. are anchorable without any per-term wiring.
 *
 * Empty-state fallback covers the case where the knowledge sync hasn't
 * run yet (manifest has no `glossary` entry) — the page still mounts
 * without throwing.
 */
const body = computed(() => getRootBody('glossary'))
const meta = computed(() => manifest.root.find((r) => r.slug === 'glossary'))
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8" data-testid="glossary-page">
    <header class="mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
      <p class="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
        Reference
      </p>
      <h1
        class="text-4xl font-semibold tracking-tight text-balance text-zinc-900 dark:text-zinc-100"
      >
        Glossary
      </h1>
      <p class="mt-4 text-zinc-600 dark:text-zinc-400 text-pretty max-w-2xl">
        Capitalized Terms of Art used throughout
        <RouterLink to="/axioms" class="text-blue-600 hover:underline dark:text-blue-400"
          >AXIOMS.md</RouterLink
        >
        and the
        <RouterLink to="/decisions" class="text-blue-600 hover:underline dark:text-blue-400"
          >ADRs</RouterLink
        >. Each entry: a one-sentence definition, a concrete example, a non-example, and
        cross-references to the axioms and ADRs that introduce or constrain the term.
      </p>
    </header>

    <!--
      Empty-state fallback: if `pnpm sync:knowledge` hasn't run, the
      manifest will not list `glossary` and `getRootBody('glossary')`
      returns undefined. We render a hint rather than letting the page
      crash on a missing import.
    -->
    <div
      v-if="!body"
      class="rounded border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/30"
      data-testid="glossary-empty"
    >
      <p class="font-medium">Glossary not synced.</p>
      <p class="mt-1">
        Run
        <code class="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">pnpm sync:knowledge</code>
        from the dashboard repo (after the workspace authors
        <code class="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">docs/glossary.md</code>) to
        populate this page.
      </p>
    </div>

    <template v-else>
      <p
        v-if="meta"
        class="mb-4 text-xs text-zinc-500 dark:text-zinc-400"
        data-testid="glossary-meta"
      >
        {{ meta.bytes }} bytes synced from workspace
        <code>docs/glossary.md</code>
      </p>
      <article data-testid="glossary-content">
        <MarkdownView :source="body" />
      </article>
    </template>
  </div>
</template>
