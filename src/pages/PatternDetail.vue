<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'

import NodePackBanner from '@/components/NodePackBanner.vue'
import {
  evidenceByPatternId,
  patternById,
  rollupByPatternId
} from '@/data'
import type { EvidenceRow } from '@/data'
import { categoriesByPatternId } from '@/data/categories'
import { isInStarCache } from '@/data/star-cache'

/**
 * PatternDetail — the deepest view in the explorer: one pattern's full story.
 *
 * Reads :id from the route, then pulls everything for that pattern from the
 * W2 data-loader bundles:
 *
 *   - header        : pattern_id · surface_family · current blast_radius
 *   - v1 surface    : `fingerprint` from touch-points-database.yaml
 *   - v2 surface    : `v2_replacement` from the same row
 *   - migration     : `semantic` (intent) + `decision_ref` (ADR / blocker)
 *   - categories    : behavior categories this pattern is a member of
 *   - evidence rows : per-repo · file · lines · excerpt (collapsible <pre>)
 *                     each row also renders an inline <NodePackBanner> when
 *                     the repo is present in the star-cache (W2.C swap-in).
 *   - test runner   : disabled "Run v1↔v2 contract test" button — the real
 *                     wire-up lands in W5.1 TestRunner.
 */
const route = useRoute()

const patternId = computed(() => String(route.params.id ?? ''))

const pattern = computed(() => patternById[patternId.value])
const rollup = computed(() => rollupByPatternId[patternId.value])
const evidence = computed<EvidenceRow[]>(
  () => evidenceByPatternId[patternId.value] ?? []
)
const categories = computed(() => categoriesByPatternId[patternId.value] ?? [])

const surfaceFamily = computed(
  () => pattern.value?.surface_family ?? rollup.value?.surface_family ?? '—'
)

/** Tracks which evidence rows have their excerpt expanded. Default = collapsed. */
const expanded = ref<Record<number, boolean>>({})
function toggle(idx: number) {
  expanded.value[idx] = !expanded.value[idx]
}

function lineRange(lines?: number[]): string {
  if (!lines || lines.length === 0) return ''
  if (lines.length === 1) return `L${lines[0]}`
  return `L${lines[0]}–L${lines[lines.length - 1]}`
}

/**
 * Only render the W5.1 "Run v1↔v2 contract test" placeholder in dev/test
 * builds. The real TestRunner lands in W5.1 — until then production users
 * shouldn't see a disabled mystery button.
 */
const showContractTestPlaceholder = import.meta.env.DEV
</script>

<template>
  <article class="mx-auto max-w-4xl space-y-8 px-4 py-6">
    <!-- Not found -->
    <div
      v-if="!pattern"
      class="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
      data-testid="pattern-not-found"
    >
      No pattern with id <code class="font-mono">{{ patternId }}</code> in
      <code class="font-mono">touch-points-database.yaml</code>.
    </div>

    <template v-else>
      <!-- Header -->
      <header class="space-y-2" data-testid="pattern-header">
        <div class="flex items-center gap-3 text-xs text-zinc-500">
          <RouterLink
            to="/patterns"
            class="font-mono uppercase tracking-wide hover:text-zinc-700"
          >
            ← patterns
          </RouterLink>
          <span class="rounded bg-zinc-100 px-2 py-0.5 font-mono text-zinc-700">
            {{ surfaceFamily }}
          </span>
          <span
            v-if="rollup"
            class="rounded bg-rose-50 px-2 py-0.5 font-medium text-rose-700"
            title="current blast radius (rollup)"
          >
            blast {{ rollup.blast_radius.toFixed(2) }}
          </span>
          <span v-if="pattern.severity" class="font-medium text-rose-600">
            {{ pattern.severity }}
          </span>
        </div>
        <h1 class="font-mono text-3xl font-semibold text-zinc-900">
          {{ pattern.pattern_id }}
        </h1>
        <p class="text-base text-zinc-700">{{ pattern.surface }}</p>
        <dl
          v-if="rollup"
          class="grid grid-cols-2 gap-x-6 gap-y-1 pt-2 text-xs text-zinc-500 sm:grid-cols-4"
        >
          <div>
            <dt class="uppercase">occurrences</dt>
            <dd class="font-mono text-zinc-800">{{ rollup.occurrences }}</dd>
          </div>
          <div>
            <dt class="uppercase">unique repos</dt>
            <dd class="font-mono text-zinc-800">{{ rollup.unique_repos }}</dd>
          </div>
          <div>
            <dt class="uppercase">cumul. ★</dt>
            <dd class="font-mono text-zinc-800">
              {{ rollup.cumulative_stars.toLocaleString() }}
            </dd>
          </div>
          <div>
            <dt class="uppercase">silent / lifecycle</dt>
            <dd class="font-mono text-zinc-800">
              {{ rollup.silent_breakage }} / {{ rollup.lifecycle_coupling }}
            </dd>
          </div>
        </dl>
      </header>

      <!-- v1 / v2 surface side-by-side -->
      <section class="grid gap-4 md:grid-cols-2" data-testid="surface-pair">
        <div>
          <h2 class="mb-2 text-sm font-semibold uppercase text-zinc-500">
            v1 surface
          </h2>
          <pre
            class="overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-[12px] leading-relaxed text-zinc-800"
          ><code data-testid="surface-v1">{{ pattern.fingerprint ?? '— no fingerprint recorded —' }}</code></pre>
        </div>
        <div>
          <h2 class="mb-2 text-sm font-semibold uppercase text-emerald-700">
            v2 surface
          </h2>
          <pre
            class="overflow-x-auto rounded-md border border-emerald-200 bg-emerald-50 p-3 text-[12px] leading-relaxed text-emerald-900"
          ><code data-testid="surface-v2">{{ pattern.v2_replacement ?? '— no v2 replacement defined —' }}</code></pre>
        </div>
      </section>

      <!-- Migration guidance -->
      <section data-testid="migration-path" class="space-y-2">
        <h2 class="text-sm font-semibold uppercase text-zinc-500">
          Migration guidance
        </h2>
        <p v-if="pattern.semantic" class="text-sm text-zinc-700">
          <span class="font-medium text-zinc-900">Intent:</span>
          {{ pattern.semantic }}
        </p>
        <p v-if="pattern.decision_ref" class="text-sm text-zinc-700">
          <span class="font-medium text-zinc-900">Decision ref:</span>
          <code class="ml-1 font-mono text-xs">{{ pattern.decision_ref }}</code>
        </p>
        <p v-if="pattern.test_target" class="text-sm text-zinc-700">
          <span class="font-medium text-zinc-900">Test target:</span>
          <code class="ml-1 font-mono text-xs">{{ pattern.test_target }}</code>
        </p>
        <p
          v-if="!pattern.semantic && !pattern.decision_ref"
          class="text-sm italic text-zinc-400"
        >
          No migration guidance recorded.
        </p>
      </section>

      <!-- Behavior categories -->
      <section
        v-if="categories.length > 0"
        data-testid="categories"
        class="space-y-2"
      >
        <h2 class="text-sm font-semibold uppercase text-zinc-500">
          Behavior categories ({{ categories.length }})
        </h2>
        <div class="flex flex-wrap gap-2">
          <RouterLink
            v-for="c in categories"
            :key="c.category_id"
            :to="`/categories/${c.category_id}`"
            class="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs text-indigo-800 transition hover:bg-indigo-100"
          >
            <span class="font-mono">{{ c.category_id }}</span>
            · {{ c.name }}
          </RouterLink>
        </div>
      </section>

      <!-- Evidence rows -->
      <section data-testid="evidence" class="space-y-3">
        <h2 class="text-sm font-semibold uppercase text-zinc-500">
          Evidence ({{ evidence.length }})
        </h2>
        <div v-if="evidence.length === 0" class="text-sm italic text-zinc-400">
          No evidence rows.
        </div>
        <ul v-else class="space-y-3">
          <li
            v-for="(ev, idx) in evidence"
            :key="`${ev.repo}::${ev.file}::${idx}`"
            class="rounded-md border border-zinc-200 bg-white p-3"
            data-testid="evidence-row"
          >
            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
              <a
                v-if="ev.url"
                :href="ev.url"
                target="_blank"
                rel="noreferrer"
                class="font-mono text-zinc-900 underline-offset-2 hover:underline"
              >
                {{ ev.repo }}
              </a>
              <span v-else class="font-mono text-zinc-900">{{ ev.repo }}</span>
              <span class="font-mono text-zinc-500">{{ ev.file }}</span>
              <span class="font-mono text-zinc-400">{{ lineRange(ev.lines) }}</span>
              <span
                v-if="ev.breakage_class"
                class="ml-auto rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-600"
              >
                {{ ev.breakage_class }}
              </span>
              <span
                v-if="ev.variant"
                class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-600"
              >
                {{ ev.variant }}
              </span>
            </div>

            <NodePackBanner
              v-if="isInStarCache(ev.repo)"
              :repo="ev.repo"
              dense
              class="mt-2"
            />

            <p v-if="ev.notes" class="mt-2 text-xs text-zinc-600">{{ ev.notes }}</p>

            <div v-if="ev.excerpt" class="mt-2">
              <button
                type="button"
                class="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800"
                data-testid="excerpt-toggle"
                :aria-expanded="!!expanded[idx]"
                :aria-controls="`excerpt-${idx}`"
                @click="toggle(idx)"
              >
                {{ expanded[idx] ? 'hide excerpt' : 'show excerpt' }}
              </button>
              <pre
                v-if="expanded[idx]"
                :id="`excerpt-${idx}`"
                role="region"
                class="mt-2 overflow-x-auto rounded bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-100"
              ><code>{{ ev.excerpt }}</code></pre>
            </div>
          </li>
        </ul>
      </section>

      <!--
        Contract test runner placeholder (W5.1).
        Gated to dev/test builds so the disabled "W5.1" affordance doesn't leak
        into production routes before the real TestRunner ships in W5.1.
      -->
      <section
        v-if="showContractTestPlaceholder"
        data-testid="contract-test"
        class="border-t border-zinc-200 pt-4"
      >
        <button
          type="button"
          disabled
          aria-disabled="true"
          class="cursor-not-allowed rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-500"
          title="Not yet wired — TestRunner ships in W5.1"
        >
          ▶ Run v1↔v2 contract test
          <span
            class="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] uppercase text-zinc-600"
          >
            W5.1
          </span>
        </button>
      </section>
    </template>
  </article>
</template>
