/**
 * Data loader: parses the YAML touch-points bundle at build time (via Vite's
 * `?raw` import) and exports typed structures plus pre-built indexes used by
 * every dashboard page.
 *
 * The whole bundle is small enough (a few hundred kB of YAML) that we can
 * afford to inline it. If/when it grows past ~2 MB we should split into
 * lazy-loaded chunks per page.
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

const patternsFile = parse<PatternFile>(patternsRaw, 'touch-points-database.yaml')
const rollupFile = parse<RollupFile>(rollupRaw, 'touch-points-rollup.yaml')

export const patterns: Pattern[] = (patternsFile.patterns ?? []).map((p) => ({
  ...p,
  evidence: p.evidence ?? []
}))
export const rollup: RollupEntry[] = rollupFile.patterns ?? []

/** Rollup entries keyed by pattern_id for O(1) lookup. */
export const rollupByPatternId: Record<string, RollupEntry> = Object.fromEntries(
  rollup.map((r) => [r.pattern_id, r])
)

/** Patterns keyed by pattern_id for O(1) lookup. */
export const patternById: Record<string, Pattern> = Object.fromEntries(
  patterns.map((p) => [p.pattern_id, p])
)

/**
 * Evidence rows grouped by pattern_id with provenance backfilled. Lets
 * consumers flat-map without re-walking the patterns array.
 */
export const evidenceByPatternId: Record<string, EvidenceRow[]> = (() => {
  const out: Record<string, EvidenceRow[]> = {}
  for (const p of patterns) {
    out[p.pattern_id] = p.evidence.map((e) => ({
      ...e,
      pattern_id: e.pattern_id ?? p.pattern_id
    }))
  }
  return out
})()

/** Total evidence-row count per pack (repo). Used by the heatmap to pick top-N. */
export const evidenceCountByPack: Record<string, number> = (() => {
  const out: Record<string, number> = {}
  for (const p of patterns) {
    for (const e of p.evidence) {
      if (!e.repo) continue
      out[e.repo] = (out[e.repo] ?? 0) + 1
    }
  }
  return out
})()

export type { EvidenceRow, Pattern, RollupEntry } from './schema'
