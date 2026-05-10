<script setup lang="ts">
/**
 * PackDetail page (W3).
 *
 * Reached at `/packs/:packId`. The route param is a Comfy Registry pack id
 * (lowercased repo slug) — see {@link repoToPackId}. The page resolves the
 * pack via the registry and joins it back to the touch-points evidence by
 * walking every repo whose {@link repoToPackId} matches the route param,
 * which lets us reuse the per-pack coverage table even when the registry
 * 404s or the pack id collides across forks.
 *
 * Layout: banner (full registry image) → metadata grid → per-pattern table
 * with one row per pattern this pack uses, each row linking to
 * {@link PatternDetail} (`/patterns/:id`).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import NodePackBanner from '@/components/NodePackBanner.vue'
import { evidenceCountByPack } from '@/data'
import { starCache } from '@/data/star-cache'
import { getPackCoverage } from '@/composables/usePackCoverage'
import type { PackPatternRow } from '@/composables/usePackCoverage'
import { getPackById } from '@/services/registryApi'
import type { RegistryNode } from '@/types/registry'
import { repoToPackId } from '@/utils/repoToPackId'

const route = useRoute()
const packId = computed(() => String(route.params.packId ?? ''))

/** Every evidence repo whose registry id matches the route. Usually one. */
const matchingRepos = computed<string[]>(() =>
  Object.keys(evidenceCountByPack).filter(
    (repo) => repoToPackId(repo) === packId.value
  )
)

/** Pick a canonical repo for banner/metadata fallbacks: highest stars wins. */
const primaryRepo = computed<string | null>(() => {
  const repos = matchingRepos.value
  if (!repos.length) return null
  return [...repos].sort(
    (a, b) => (starCache[b]?.stars ?? 0) - (starCache[a]?.stars ?? 0)
  )[0]
})

const apiResult = computed(() => getPackById(packId.value))

/** Synthesised pack: registry response + local fallbacks merged. */
const pack = computed<RegistryNode>(() => {
  const remote = apiResult.value.data.value
  const repo = primaryRepo.value
  const fallback: RegistryNode = repo
    ? {
        id: packId.value,
        name: repo.split('/').pop() ?? repo,
        author: repo.split('/')[0],
        github_stars: starCache[repo]?.stars,
        repository: `https://github.com/${repo}`
      }
    : { id: packId.value }
  return remote ? { ...fallback, ...remote } : fallback
})

const isLoading = computed(() => !apiResult.value.isFinished.value)
const apiError = computed(() => apiResult.value.error.value)

const aggregateRows = computed<PackPatternRow[]>(() => {
  const rows = new Map<string, PackPatternRow>()
  for (const repo of matchingRepos.value) {
    const cov = getPackCoverage(repo)
    if (!cov) continue
    for (const r of cov.rows) {
      const existing = rows.get(r.pattern_id)
      if (existing) {
        existing.hits += r.hits
        existing.evidence = existing.evidence.concat(r.evidence)
      } else {
        rows.set(r.pattern_id, { ...r, evidence: [...r.evidence] })
      }
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.blast_radius - a.blast_radius ||
      b.hits - a.hits ||
      a.pattern_id.localeCompare(b.pattern_id)
  )
})

const totals = computed(() => {
  let hits = 0
  let weighted = 0
  for (const r of aggregateRows.value) {
    hits += r.hits
    weighted += r.hits * r.blast_radius
  }
  return { patternCount: aggregateRows.value.length, hits, weighted }
})

const numberFmt = new Intl.NumberFormat()
function fmt(n: number | undefined): string {
  return typeof n === 'number' ? numberFmt.format(n) : '—'
}
</script>

<template>
  <section data-testid="pack-detail-page" :data-pack-id="packId">
    <RouterLink
      to="/node-packs"
      class="mb-4 inline-block text-xs text-zinc-500 hover:text-zinc-900"
    >
      ← All node packs
    </RouterLink>

    <div class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <NodePackBanner :node-pack="pack" />
      <div class="p-4">
        <h1 class="text-xl font-semibold text-zinc-900">
          {{ pack.name ?? pack.id ?? packId }}
        </h1>
        <p
          v-if="pack.description"
          class="mt-2 max-w-prose text-sm text-zinc-600"
        >
          {{ pack.description }}
        </p>

        <dl
          class="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4"
        >
          <div>
            <dt class="text-zinc-400">Pack id</dt>
            <dd class="font-mono text-zinc-700">{{ pack.id ?? packId }}</dd>
          </div>
          <div>
            <dt class="text-zinc-400">Publisher</dt>
            <dd class="text-zinc-700">
              {{
                pack.publisher?.name ?? pack.publisher?.id ?? pack.author ?? '—'
              }}
            </dd>
          </div>
          <div>
            <dt class="text-zinc-400">Stars</dt>
            <dd class="text-zinc-700">{{ fmt(pack.github_stars) }}</dd>
          </div>
          <div>
            <dt class="text-zinc-400">Downloads</dt>
            <dd class="text-zinc-700">{{ fmt(pack.downloads) }}</dd>
          </div>
          <div>
            <dt class="text-zinc-400">Latest version</dt>
            <dd class="font-mono text-zinc-700">
              {{ pack.latest_version?.version ?? '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-zinc-400">Repository</dt>
            <dd class="truncate text-zinc-700">
              <a
                v-if="pack.repository"
                :href="pack.repository"
                target="_blank"
                rel="noreferrer"
                class="underline-offset-2 hover:underline"
                >{{ pack.repository }}</a
              >
              <span v-else>—</span>
            </dd>
          </div>
          <div>
            <dt class="text-zinc-400">Patterns used</dt>
            <dd class="font-mono text-zinc-700">{{ totals.patternCount }}</dd>
          </div>
          <div>
            <dt class="text-zinc-400">Total evidence rows</dt>
            <dd class="font-mono text-zinc-700">{{ totals.hits }}</dd>
          </div>
        </dl>

        <p
          v-if="isLoading"
          class="mt-3 text-xs text-zinc-400"
          data-testid="registry-loading"
        >
          Loading registry data…
        </p>
        <p
          v-else-if="apiError"
          class="mt-3 text-xs text-amber-600"
          data-testid="registry-error"
        >
          Registry lookup failed; showing local data only.
        </p>
      </div>
    </div>

    <h2 class="mt-8 mb-3 text-sm font-medium text-zinc-700">
      Pattern coverage
      <span class="ml-1 text-xs font-normal text-zinc-400">
        ({{ totals.patternCount }} patterns, weighted impact
        {{ totals.weighted.toFixed(1) }})
      </span>
    </h2>

    <table
      v-if="aggregateRows.length"
      class="w-full border-separate border-spacing-0 text-sm"
      data-testid="pattern-coverage-table"
    >
      <thead class="text-left text-xs uppercase tracking-wide text-zinc-400">
        <tr>
          <th class="border-b border-zinc-200 py-2 pr-3 font-medium">
            Pattern
          </th>
          <th class="border-b border-zinc-200 py-2 pr-3 font-medium">
            Surface
          </th>
          <th class="border-b border-zinc-200 py-2 pr-3 text-right font-medium">
            Hits
          </th>
          <th class="border-b border-zinc-200 py-2 pr-3 text-right font-medium">
            Blast radius
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in aggregateRows"
          :key="row.pattern_id"
          class="hover:bg-zinc-50"
        >
          <td class="border-b border-zinc-100 py-2 pr-3 align-top">
            <RouterLink
              :to="{ name: 'pattern-detail', params: { id: row.pattern_id } }"
              class="font-mono text-xs text-zinc-900 hover:underline"
              :data-pattern-id="row.pattern_id"
            >
              {{ row.pattern_id }}
            </RouterLink>
            <div class="mt-0.5 text-xs text-zinc-500">{{ row.name }}</div>
          </td>
          <td class="border-b border-zinc-100 py-2 pr-3 align-top">
            <span
              class="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600"
            >
              {{ row.surface_family }}
            </span>
          </td>
          <td
            class="border-b border-zinc-100 py-2 pr-3 text-right align-top font-mono text-xs"
          >
            {{ row.hits }}
          </td>
          <td
            class="border-b border-zinc-100 py-2 pr-3 text-right align-top font-mono text-xs"
          >
            {{ row.blast_radius.toFixed(2) }}
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="text-sm text-zinc-500">
      No touch-points evidence ties this pack to any v1 pattern.
    </p>
  </section>
</template>
