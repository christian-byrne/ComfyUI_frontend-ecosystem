import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { parse as parseYaml } from 'yaml'
import type { Pattern, RollupPattern, HeatmapMatrix, HeatmapCell, EvidenceRow } from '@/types'

// Vite raw imports: bundle the YAML files as strings at build time.
// Falls back gracefully when running in Vitest (loader returns undefined).
import databaseYamlRaw from '@research/touch-points-database.yaml?raw'
import rollupYamlRaw from '@research/touch-points-rollup.yaml?raw'

interface LoadedData {
  patterns: Pattern[]
  rollup: RollupPattern[]
}

let cached: LoadedData | null = null

export function loadDataset(
  databaseRaw: string = databaseYamlRaw,
  rollupRaw: string = rollupYamlRaw
): LoadedData {
  if (cached) return cached
  const db = parseYaml(databaseRaw) as { patterns?: Pattern[] }
  const ro = parseYaml(rollupRaw) as { patterns?: RollupPattern[] }
  cached = {
    patterns: db?.patterns ?? [],
    rollup: ro?.patterns ?? []
  }
  return cached
}

export function clearDatasetCache(): void {
  cached = null
}

/**
 * Build the pattern × pack heatmap matrix.
 * - rows: patterns sorted by blast_radius desc
 * - cols: top-N packs by total evidence count across all patterns
 * - cell: count of evidence rows for (pattern, pack)
 */
export function buildHeatmap(
  patterns: Pattern[],
  rollup: RollupPattern[],
  topPacks = 20
): HeatmapMatrix {
  // Group evidence by (pattern, pack)
  const cells = new Map<string, HeatmapCell>()
  const packTotals = new Map<string, number>()

  for (const p of patterns) {
    for (const ev of p.evidence ?? []) {
      const pack = ev.repo
      if (!pack) continue
      const key = `${p.pattern_id}::${pack}`
      let cell = cells.get(key)
      if (!cell) {
        cell = { patternId: p.pattern_id, pack, count: 0, evidence: [] }
        cells.set(key, cell)
      }
      cell.count++
      cell.evidence.push(ev)
      packTotals.set(pack, (packTotals.get(pack) ?? 0) + 1)
    }
  }

  const packs = Array.from(packTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topPacks)
    .map(([pack]) => pack)

  // Build a quick lookup of blast radius for ordering
  const blastById = new Map<string, number>()
  for (const r of rollup) {
    blastById.set(r.pattern_id, r.blast_radius ?? 0)
  }
  const rollupById = new Map(rollup.map((r) => [r.pattern_id, r]))

  const orderedPatterns: RollupPattern[] = patterns
    .map(
      (p): RollupPattern =>
        rollupById.get(p.pattern_id) ?? {
          pattern_id: p.pattern_id,
          surface_family: p.surface_family,
          name: p.surface,
          blast_radius: 0
        }
    )
    .sort((a, b) => (b.blast_radius ?? 0) - (a.blast_radius ?? 0))

  let max = 0
  const packSet = new Set(packs)
  for (const cell of cells.values()) {
    if (packSet.has(cell.pack) && cell.count > max) max = cell.count
  }

  return { patterns: orderedPatterns, packs, cells, max }
}

export interface UseDataLoader {
  patterns: Ref<Pattern[]>
  rollup: Ref<RollupPattern[]>
  heatmap: ComputedRef<HeatmapMatrix>
  evidenceFor(patternId: string, pack: string): EvidenceRow[]
}

export function useDataLoader(
  databaseRaw?: string,
  rollupRaw?: string,
  topPacks = 20
): UseDataLoader {
  const data = loadDataset(databaseRaw, rollupRaw)
  const patterns = ref(data.patterns) as Ref<Pattern[]>
  const rollup = ref(data.rollup) as Ref<RollupPattern[]>
  const heatmap = computed(() => buildHeatmap(patterns.value, rollup.value, topPacks))

  function evidenceFor(patternId: string, pack: string): EvidenceRow[] {
    return heatmap.value.cells.get(`${patternId}::${pack}`)?.evidence ?? []
  }

  return { patterns, rollup, heatmap, evidenceFor }
}
