import yaml from 'js-yaml'

import patternsRaw from '../../research/touch-points-database.yaml?raw'
import rollupRaw from '../../research/touch-points-rollup.yaml?raw'
import starCacheRaw from '../../research/touch-points-star-cache.yaml?raw'
import behaviorCategoriesRaw from '../../research/workspace-mirror/research/touch-points/behavior-categories.yaml?raw'

import {
  BehaviorCategoriesFileSchema,
  PatternFileSchema,
  RollupFileSchema,
  StarCacheFileSchema,
  type BehaviorCategory,
  type EvidenceRow,
  type Pattern,
  type RollupEntry,
  type StarCacheEntry
} from './schema'

// ───────────────────────────────────────────────────────────────────────
// Build-time parse + validate. Throws on schema drift -> fails the build.
// ───────────────────────────────────────────────────────────────────────
function parseYaml<T>(raw: string, label: string): T {
  try {
    return yaml.load(raw) as T
  } catch (err) {
    throw new Error(`[data] failed to parse YAML ${label}: ${(err as Error).message}`)
  }
}

const patternsFile = PatternFileSchema.parse(
  parseYaml(patternsRaw, 'touch-points-database.yaml')
)
const rollupFile = RollupFileSchema.parse(
  parseYaml(rollupRaw, 'touch-points-rollup.yaml')
)
const starCacheFile = StarCacheFileSchema.parse(
  parseYaml(starCacheRaw, 'touch-points-star-cache.yaml')
)
const behaviorCategoriesFile = BehaviorCategoriesFileSchema.parse(
  parseYaml(behaviorCategoriesRaw, 'behavior-categories.yaml')
)

export const patterns: Pattern[] = patternsFile.patterns
export const rollup: RollupEntry[] = rollupFile.patterns
export const behaviorCategories: BehaviorCategory[] = behaviorCategoriesFile.categories

export const starCache: Record<string, StarCacheEntry> = Object.fromEntries(
  starCacheFile.repos.map((r) => [r.repo, r])
)

// ───────────────────────────────────────────────────────────────────────
// Computed indexes
// ───────────────────────────────────────────────────────────────────────

/** Patterns grouped by surface_family (e.g. "S2", "S4"). */
export const patternsBySurface: Record<string, Pattern[]> = (() => {
  const out: Record<string, Pattern[]> = {}
  for (const p of patterns) {
    ;(out[p.surface_family] ??= []).push(p)
  }
  return out
})()

/** Patterns grouped by node-pack repo (any pattern with at least one evidence row in that repo). */
export const patternsByPack: Record<string, Pattern[]> = (() => {
  const out: Record<string, Set<Pattern>> = {}
  for (const p of patterns) {
    for (const e of p.evidence) {
      ;(out[e.repo] ??= new Set()).add(p)
    }
  }
  return Object.fromEntries(
    Object.entries(out).map(([repo, set]) => [repo, [...set]])
  )
})()

/**
 * Evidence rows grouped by pattern_id. Each row is annotated with its parent
 * pattern_id when missing, so consumers can flat-map without losing provenance.
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

/** Behavior categories that include the given pattern_id as a member. */
export const categoriesByPatternId: Record<string, BehaviorCategory[]> = (() => {
  const out: Record<string, BehaviorCategory[]> = {}
  for (const c of behaviorCategories) {
    for (const pid of c.member_pattern_ids) {
      ;(out[pid] ??= []).push(c)
    }
  }
  return out
})()

/** Rollup entries keyed by pattern_id for O(1) lookup. */
export const rollupByPatternId: Record<string, RollupEntry> = Object.fromEntries(
  rollup.map((r) => [r.pattern_id, r])
)

export type {
  BehaviorCategory,
  EvidenceRow,
  Pattern,
  RollupEntry,
  StarCacheEntry
}
