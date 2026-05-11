import { defineStore } from 'pinia'
import { computed } from 'vue'

import {
  behaviorCategories,
  evidenceByPatternId,
  patterns,
  rollup,
  rollupByPatternId,
  starCache,
  starredPacks,
  totalEvidenceCount,
  type BehaviorCategory,
  type EvidenceRow,
  type Pattern,
  type RollupEntry,
  type StarCacheEntry
} from '@/data'

/**
 * useDataStore — single Pinia store fronting the bundled research data.
 *
 * Mirrors the API contract from `prompts/dashboard/W2.B-data-loader.md`.
 * Pages should consume from here rather than reaching into `@/data` directly,
 * so the underlying loader can be swapped (e.g. to lazy chunks) in one place.
 */
export const useDataStore = defineStore('data', () => {
  const allPatterns = computed<Pattern[]>(() => patterns)
  const allRollup = computed<RollupEntry[]>(() => rollup)
  const allCategories = computed<BehaviorCategory[]>(() => behaviorCategories)
  const allStarredPacks = computed<StarCacheEntry[]>(() => starredPacks)
  const evidenceCount = computed<number>(() => totalEvidenceCount)

  /** Top N patterns by blast_radius (descending). */
  function topByBlastRadius(n: number): RollupEntry[] {
    return [...rollup]
      .sort((a, b) => b.blast_radius - a.blast_radius)
      .slice(0, n)
  }

  function getPattern(id: string): Pattern | undefined {
    return patterns.find((p) => p.pattern_id === id)
  }

  function getRollup(id: string): RollupEntry | undefined {
    return rollupByPatternId[id]
  }

  function getEvidenceForPattern(id: string): EvidenceRow[] {
    return evidenceByPatternId[id] ?? []
  }

  return {
    patterns: allPatterns,
    rollup: allRollup,
    behaviorCategories: allCategories,
    starredPacks: allStarredPacks,
    starCache,
    totalEvidenceCount: evidenceCount,
    topByBlastRadius,
    getPattern,
    getRollup,
    getEvidenceForPattern
  }
})
