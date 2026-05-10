import { defineStore } from 'pinia'
import { computed } from 'vue'

import {
  behaviorCategories,
  categoriesByPatternId,
  evidenceByPatternId,
  patterns,
  patternsByPack,
  patternsBySurface,
  rollup,
  rollupByPatternId,
  starCache,
  type BehaviorCategory,
  type EvidenceRow,
  type Pattern,
  type RollupEntry
} from '@/data'

/**
 * useDataStore — single Pinia store fronting the bundled research data.
 * Other agents (pages, charts) consume from here so the data shape is
 * swappable in one place.
 */
export const useDataStore = defineStore('data', () => {
  const allPatterns = computed<Pattern[]>(() => patterns)
  const allRollup = computed<RollupEntry[]>(() => rollup)
  const allCategories = computed<BehaviorCategory[]>(() => behaviorCategories)

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

  function getCategoriesForPattern(id: string): BehaviorCategory[] {
    return categoriesByPatternId[id] ?? []
  }

  function getPatternsForSurface(family: string): Pattern[] {
    return patternsBySurface[family] ?? []
  }

  function getPatternsForPack(repo: string): Pattern[] {
    return patternsByPack[repo] ?? []
  }

  /**
   * Case-insensitive search across pattern_id / surface / semantic /
   * v2_replacement / fingerprint. Empty query returns no results so callers
   * can render a placeholder.
   */
  function searchPatterns(q: string): Pattern[] {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    return patterns.filter((p) => {
      const haystack = [
        p.pattern_id,
        p.surface_family,
        p.surface,
        p.semantic,
        p.v2_replacement,
        p.fingerprint,
        p.test_target
      ]
        .filter((s): s is string => typeof s === 'string')
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }

  return {
    // raw collections
    patterns: allPatterns,
    rollup: allRollup,
    behaviorCategories: allCategories,
    starCache,
    // queries
    topByBlastRadius,
    getPattern,
    getRollup,
    getEvidenceForPattern,
    getCategoriesForPattern,
    getPatternsForSurface,
    getPatternsForPack,
    searchPatterns
  }
})
