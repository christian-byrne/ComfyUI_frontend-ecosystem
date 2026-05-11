<script setup lang="ts">
import { useRouteQuery } from '@vueuse/router'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { useDataStore } from '@/stores/data'
import type { Pattern } from '@/data/schema'

/**
 * Patterns — searchable, filterable list of all 59 touch-point patterns.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ Search [q]                                                    │
 *   │ Surface family chips · Behavior chips · Blast-radius bin      │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ id · surface · description · blast · evidence · top pack     │
 *   │ ...                                                          │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * State is mirrored into the URL via @vueuse/router so any filtered view is
 * shareable as a link. URL keys: `q`, `family`, `behavior`, `blast`.
 */

type BlastBin = '' | 'high' | 'mid' | 'low'

const store = useDataStore()
const { rollup } = storeToRefs(store)

// ── URL-synced filter state ─────────────────────────────────────────────
const q = useRouteQuery<string>('q', '')
const familyParam = useRouteQuery<string>('family', '')
const behaviorParam = useRouteQuery<string>('behavior', '')
const blastBin = useRouteQuery<BlastBin>('blast', '')

// Single split per param change — both `families`/`behaviors` reads and the
// `toggle*` mutators reuse this, removing per-keystroke string splits.
const familySet = computed<Set<string>>(
  () => new Set(familyParam.value ? familyParam.value.split(',').filter(Boolean) : [])
)
const behaviorSet = computed<Set<string>>(
  () => new Set(behaviorParam.value ? behaviorParam.value.split(',').filter(Boolean) : [])
)
const families = computed<string[]>(() => [...familySet.value])
const behaviors = computed<string[]>(() => [...behaviorSet.value])

function toggleFamily(val: string): void {
  const cur = new Set(familySet.value)
  if (cur.has(val)) cur.delete(val)
  else cur.add(val)
  familyParam.value = [...cur].join(',')
}

function toggleBehavior(val: string): void {
  const cur = new Set(behaviorSet.value)
  if (cur.has(val)) cur.delete(val)
  else cur.add(val)
  behaviorParam.value = [...cur].join(',')
}

function resetFilters(): void {
  q.value = ''
  familyParam.value = ''
  behaviorParam.value = ''
  blastBin.value = ''
}

// ── Facet vocabularies (derived from data) ──────────────────────────────
const allFamilies = computed<string[]>(() => {
  const set = new Set<string>()
  for (const p of store.patterns) set.add(p.surface_family)
  return [...set].sort((a, b) => {
    const na = Number(a.replace(/\D+/g, ''))
    const nb = Number(b.replace(/\D+/g, ''))
    return na - nb
  })
})

/**
 * Behavior category — derived from the dominant `breakage_class` across a
 * pattern's evidence rows. The data-loader bundle does not yet ship an
 * authored `behavior_category` field, so we infer it; this gives the page
 * a meaningful third filter dimension without touching the YAML schema.
 *
 * Memoized via WeakMap: each pattern's behavior is computed once and reused
 * across `allBehaviors`, `rows`, and re-renders, so per-keystroke filtering
 * does not re-walk every evidence array.
 */
const behaviorCache = new WeakMap<Pattern, string>()
function behaviorOf(p: Pattern): string {
  const cached = behaviorCache.get(p)
  if (cached !== undefined) return cached
  const counts: Record<string, number> = {}
  for (const e of p.evidence) {
    if (e.breakage_class) counts[e.breakage_class] = (counts[e.breakage_class] ?? 0) + 1
  }
  let best = ''
  let bestN = 0
  for (const [k, n] of Object.entries(counts)) {
    if (n > bestN) {
      best = k
      bestN = n
    }
  }
  const result = best || 'unspecified'
  behaviorCache.set(p, result)
  return result
}

const allBehaviors = computed<string[]>(() => {
  const set = new Set<string>()
  for (const p of store.patterns) set.add(behaviorOf(p))
  return [...set].sort()
})

// ── Row composition ─────────────────────────────────────────────────────
interface Row {
  pattern_id: string
  surface_family: string
  surface: string
  description: string
  blast_radius: number
  evidence_count: number
  top_pack: string
  behavior: string
}

const rows = computed<Row[]>(() => {
  const matches = store.searchPatterns(q.value)
  const fams = familySet.value
  const behs = behaviorSet.value
  const out: Row[] = []
  for (const p of matches) {
    if (fams.size > 0 && !fams.has(p.surface_family)) continue
    const behavior = behaviorOf(p)
    if (behs.size > 0 && !behs.has(behavior)) continue
    const r = store.getRollup(p.pattern_id)
    const blast = r?.blast_radius ?? 0
    if (blastBin.value === 'high' && !(blast > 5)) continue
    if (blastBin.value === 'mid' && !(blast >= 2 && blast <= 5)) continue
    if (blastBin.value === 'low' && !(blast < 2)) continue
    out.push({
      pattern_id: p.pattern_id,
      surface_family: p.surface_family,
      surface: p.surface,
      description: p.semantic ?? p.fingerprint ?? '',
      blast_radius: blast,
      evidence_count: p.evidence.length,
      top_pack: r?.top_repos?.[0]?.repo ?? '',
      behavior
    })
  }
  return out.sort((a, b) => b.blast_radius - a.blast_radius)
})

const totalCount = computed(() => store.patterns.length)
const rollupHasData = computed(() => rollup.value.length > 0)

const router = useRouter()

/**
 * Activate a pattern row from the keyboard (Enter or Space). Mirrors the
 * row's `@click` handler so the entire row is operable for keyboard users,
 * not just the inner `RouterLink` on the ID cell.
 */
function activateRow(patternId: string, e: KeyboardEvent): void {
  // Don't hijack activation when focus is on a nested link/button.
  const target = e.target as HTMLElement | null
  if (target && target !== e.currentTarget && target.closest('a,button,input')) return
  e.preventDefault()
  void router.push(`/patterns/${patternId}`)
}
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold text-zinc-900">Patterns</h1>
      <p class="text-sm text-zinc-600">
        {{ rows.length }} of {{ totalCount }} patterns
        <span v-if="!rollupHasData" class="text-amber-700">· rollup data missing</span>
      </p>
    </header>

    <div class="space-y-4">
      <!-- Search -->
      <div>
        <label class="block text-xs uppercase tracking-wide text-zinc-500 mb-1" for="patterns-search">
          Search
        </label>
        <input
          id="patterns-search"
          v-model="q"
          type="search"
          placeholder="id, surface, semantic, fingerprint…"
          class="w-full max-w-lg rounded border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <!-- Family filter -->
      <div>
        <div id="patterns-family-label" class="text-xs uppercase tracking-wide text-zinc-500 mb-1">
          Surface family
        </div>
        <div
          role="group"
          aria-labelledby="patterns-family-label"
          class="flex flex-wrap gap-1.5"
        >
          <button
            v-for="fam in allFamilies"
            :key="fam"
            type="button"
            :aria-pressed="familySet.has(fam)"
            class="px-2 py-0.5 rounded border text-xs"
            :class="
              familySet.has(fam)
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-300 text-zinc-700 hover:border-zinc-500'
            "
            @click="toggleFamily(fam)"
          >
            {{ fam }}
          </button>
        </div>
      </div>

      <!-- Behavior filter -->
      <div>
        <div id="patterns-behavior-label" class="text-xs uppercase tracking-wide text-zinc-500 mb-1">
          Behavior category
        </div>
        <div
          role="group"
          aria-labelledby="patterns-behavior-label"
          class="flex flex-wrap gap-1.5"
        >
          <button
            v-for="b in allBehaviors"
            :key="b"
            type="button"
            :aria-pressed="behaviorSet.has(b)"
            class="px-2 py-0.5 rounded border text-xs"
            :class="
              behaviorSet.has(b)
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-300 text-zinc-700 hover:border-zinc-500'
            "
            @click="toggleBehavior(b)"
          >
            {{ b }}
          </button>
        </div>
      </div>

      <!-- Blast-radius bin (single-select → radiogroup) -->
      <div>
        <div id="patterns-blast-label" class="text-xs uppercase tracking-wide text-zinc-500 mb-1">
          Blast radius
        </div>
        <div
          role="radiogroup"
          aria-labelledby="patterns-blast-label"
          class="flex flex-wrap gap-1.5"
        >
          <button
            v-for="opt in [
              { v: '', label: 'any' },
              { v: 'high', label: '> 5' },
              { v: 'mid', label: '2–5' },
              { v: 'low', label: '< 2' }
            ]"
            :key="opt.v"
            type="button"
            role="radio"
            :aria-checked="blastBin === opt.v"
            class="px-2 py-0.5 rounded border text-xs"
            :class="
              blastBin === opt.v
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-300 text-zinc-700 hover:border-zinc-500'
            "
            @click="blastBin = opt.v as BlastBin"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <button
        v-if="q || families.length || behaviors.length || blastBin"
        type="button"
        class="text-xs text-zinc-500 underline hover:text-zinc-700"
        @click="resetFilters"
      >
        Reset filters
      </button>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto border border-zinc-200 rounded">
      <table class="w-full text-sm">
        <thead class="bg-zinc-50 text-zinc-600">
          <tr class="text-left">
            <th class="px-3 py-2 font-medium">ID</th>
            <th class="px-3 py-2 font-medium">Surface</th>
            <th class="px-3 py-2 font-medium">Description</th>
            <th class="px-3 py-2 font-medium text-right">Blast</th>
            <th class="px-3 py-2 font-medium text-right">Evidence</th>
            <th class="px-3 py-2 font-medium">Top pack</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rows.length === 0">
            <td colspan="6" class="px-3 py-12 text-center text-zinc-500">
              No patterns match the current filters.
            </td>
          </tr>
          <tr
            v-for="row in rows"
            :key="row.pattern_id"
            tabindex="0"
            class="border-t border-zinc-100 hover:bg-zinc-50 focus:bg-zinc-50 focus:outline focus:outline-2 focus:outline-zinc-500 cursor-pointer"
            @click="$router.push(`/patterns/${row.pattern_id}`)"
            @keydown.enter="activateRow(row.pattern_id, $event)"
            @keydown.space="activateRow(row.pattern_id, $event)"
          >
            <td class="px-3 py-2 font-mono text-xs text-zinc-900">
              <RouterLink
                :to="`/patterns/${row.pattern_id}`"
                class="text-zinc-900 hover:underline"
                @click.stop
              >
                {{ row.pattern_id }}
              </RouterLink>
            </td>
            <td class="px-3 py-2 text-zinc-700">{{ row.surface }}</td>
            <td class="px-3 py-2 text-zinc-600 max-w-md truncate" :title="row.description">
              {{ row.description }}
            </td>
            <td class="px-3 py-2 text-right tabular-nums">{{ row.blast_radius.toFixed(2) }}</td>
            <td class="px-3 py-2 text-right tabular-nums">{{ row.evidence_count }}</td>
            <td class="px-3 py-2 text-zinc-600 font-mono text-xs">{{ row.top_pack || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
