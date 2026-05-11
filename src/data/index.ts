/**
 * Data loader: parses the YAML touch-points bundle at build time (via Vite's
 * `?raw` import) and exports typed structures plus pre-built indexes used by
 * every dashboard page.
 *
 * # Design choice — static bundle, no runtime validation, no Pinia store
 *
 * This slice intentionally ships **hand-authored TypeScript interfaces** (see
 * `./schema`) and **module-level `const` exports** rather than `zod` schemas
 * + a `useDataStore` Pinia store. The data is:
 *
 *   - shipped as a static bundle (Vite `?raw` + parse on first import),
 *   - never user-mutated at runtime,
 *   - small enough (a few hundred kB of YAML) to inline.
 *
 * Under those constraints `zod` would only validate data that's already
 * frozen at build time, and a Pinia store would add a reactive shell around
 * values that never change. Both are deferred deliberately.
 *
 * **Re-introduce them when any of these is true:**
 *   - Bundle grows past ~2 MB → split into lazy-loaded chunks per page.
 *   - Dataset becomes user-mutable (uploads, edits, sweeps from the UI) →
 *     wrap in `useDataStore` for a reactive single-source-of-truth + DI seam.
 *   - Source of truth moves off-build (fetched at runtime, plugin-supplied,
 *     etc.) → add `zod` schemas at the trust boundary.
 *
 * For now the loader stays a thin, eagerly-evaluated index over a known-good
 * static input.
 */
import { parse as parseYaml } from 'yaml'

import patternsRaw from '../../research/touch-points-database.yaml?raw'
import rollupRaw from '../../research/touch-points-rollup.yaml?raw'

import type {
  EvidenceRow,
  Pattern,
  PatternFile,
  RollupEntry,
  RollupFile
} from './schema'

function parse<T>(raw: string, label: string): T {
  try {
    return parseYaml(raw) as T
  } catch (err) {
    throw new Error(`[data] failed to parse YAML ${label}: ${(err as Error).message}`)
  }
}

export interface DatasetIndexes {
  patterns: Pattern[]
  rollup: RollupEntry[]
  rollupByPatternId: Record<string, RollupEntry>
  patternById: Record<string, Pattern>
  evidenceByPatternId: Record<string, EvidenceRow[]>
  evidenceCountByPack: Record<string, number>
}

/**
 * Pure builder — takes raw YAML strings, returns the full index bundle.
 * Exported (and unit-tested) so we can cover edge cases (empty `patterns:`,
 * malformed YAML, duplicate `pattern_id`, evidence row without `repo`)
 * without depending on the bundled research files.
 */
export function buildDataset(
  patternsYaml: string,
  rollupYaml: string
): DatasetIndexes {
  const patternsFile = parse<PatternFile>(patternsYaml, 'touch-points-database.yaml')
  const rollupFile = parse<RollupFile>(rollupYaml, 'touch-points-rollup.yaml')

  const patterns: Pattern[] = (patternsFile.patterns ?? []).map((p) => ({
    ...p,
    evidence: p.evidence ?? []
  }))
  const rollup: RollupEntry[] = rollupFile.patterns ?? []

  const rollupByPatternId: Record<string, RollupEntry> = Object.fromEntries(
    rollup.map((r) => [r.pattern_id, r])
  )
  const patternById: Record<string, Pattern> = Object.fromEntries(
    patterns.map((p) => [p.pattern_id, p])
  )

  // Single pass over patterns × evidence → both indexes share the same
  // backfilled rows so `evidenceCountByPack` and `evidenceByPatternId`
  // can never disagree about which rows count.
  const evidenceByPatternId: Record<string, EvidenceRow[]> = {}
  const evidenceCountByPack: Record<string, number> = {}
  for (const p of patterns) {
    const rows: EvidenceRow[] = []
    for (const e of p.evidence) {
      const row: EvidenceRow = { ...e, pattern_id: e.pattern_id ?? p.pattern_id }
      rows.push(row)
      if (row.repo) {
        evidenceCountByPack[row.repo] = (evidenceCountByPack[row.repo] ?? 0) + 1
      }
    }
    evidenceByPatternId[p.pattern_id] = rows
  }

  return {
    patterns,
    rollup,
    rollupByPatternId,
    patternById,
    evidenceByPatternId,
    evidenceCountByPack
  }
}

const dataset = buildDataset(patternsRaw, rollupRaw)

export const patterns = dataset.patterns
export const rollup = dataset.rollup
/** Rollup entries keyed by pattern_id for O(1) lookup. */
export const rollupByPatternId = dataset.rollupByPatternId
/** Patterns keyed by pattern_id for O(1) lookup. */
export const patternById = dataset.patternById
/**
 * Evidence rows grouped by pattern_id with provenance (`pattern_id`)
 * backfilled from the parent pattern when missing.
 */
export const evidenceByPatternId = dataset.evidenceByPatternId
/** Total evidence-row count per pack (repo). Used by the heatmap to pick top-N. */
export const evidenceCountByPack = dataset.evidenceCountByPack

export type { EvidenceRow, Pattern, RollupEntry } from './schema'
