<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

/**
 * NotFound — dashboard 404 catch-all (Wave-19 W19.P3).
 *
 * Reached by the `:pathMatch(.*)*` route in `src/router/index.ts`.
 * Before this page landed, the SPA silently 200'd on every unknown
 * URL (Vue Router rendered nothing inside `<RouterView>`), which made
 * typo'd deep-links look "blank" instead of "wrong".
 *
 * The page surfaces:
 *   • the bad path (so the user can spot a typo)
 *   • a curated list of likely targets (decisions, axioms, glossary,
 *     api-docs, root nav pages)
 *
 * Status code: this is a client-side fallback — Vercel still returns
 * 200 for the initial HTML (SPA hosting). For true 404 semantics
 * with crawlers, `vercel.json` would need a `headers` rule keyed off
 * the matched route. Out of scope for W19.P3.
 */

const route = useRoute()
const badPath = computed(() => route.fullPath)

useHead({
  title: 'Page not found',
})
</script>

<template>
  <div
    class="mx-auto max-w-3xl px-4 py-16 text-center"
    data-testid="not-found-page"
  >
    <p
      class="font-mono text-sm uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
    >
      404
    </p>
    <h1
      class="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
    >
      Page not found
    </h1>
    <p class="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
      No route matches
      <code
        class="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
        data-testid="not-found-path"
        >{{ badPath }}</code
      >
    </p>

    <div class="mt-10">
      <h2
        class="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
      >
        Looking for…
      </h2>
      <ul
        class="mx-auto inline-flex flex-col gap-2 text-left text-sm"
        data-testid="not-found-suggestions"
      >
        <li>
          <RouterLink
            to="/"
            class="text-blue-600 hover:underline dark:text-blue-400"
          >
            Overview
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/decisions"
            class="text-blue-600 hover:underline dark:text-blue-400"
          >
            Decisions (ADRs)
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/axioms"
            class="text-blue-600 hover:underline dark:text-blue-400"
          >
            Axioms
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/glossary"
            class="text-blue-600 hover:underline dark:text-blue-400"
          >
            Glossary
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/api-docs"
            class="text-blue-600 hover:underline dark:text-blue-400"
          >
            API Docs
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/handoff"
            class="text-blue-600 hover:underline dark:text-blue-400"
          >
            Handoff
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/knowledge-graph"
            class="text-blue-600 hover:underline dark:text-blue-400"
          >
            Knowledge graph
          </RouterLink>
        </li>
      </ul>
    </div>
  </div>
</template>
