import { defineStore } from 'pinia'
import { computed } from 'vue'

import {
  evidenceByPatternId,
  evidenceCountByPack,
  patterns,
  patternById,
  rollup,
  rollupByPatternId
} from '@/data'
import type { EvidenceRow, Pattern, RollupEntry } from '@/data/schema'

/**
 * useDataStore — single Pinia store fronting the bundled research data.
 *
 * Pages consume from here so the data shape is swappable in one place. The
 * underlying YAML is parsed once at module load (see `@/data`); store methods
 * are pure projections over those frozen arrays.
 */
export const useDataStore = defineStore('data', () => {
  const allPatterns = computed<Pattern[]>(() => patterns)
  const allRollup = computed<RollupEntry[]>(() => rollup)

  function getPattern(id: string): Pattern | undefined {
    return patternById[id]
  }

  function getRollup(id: string): RollupEntry | undefined {
    return rollupByPatternId[id]
  }

  function getEvidenceForPattern(id: string): EvidenceRow[] {
    return evidenceByPatternId[id] ?? []
  }

  /**
   * Case-insensitive search across pattern_id / surface_family / surface /
   * semantic / fingerprint / v2_replacement / test_target.
   *
   * An empty / whitespace-only query returns the full pattern list — the
   * Patterns page wants the table populated by default and trims via facet
   * filters, so an empty string means "no narrowing".
   */
  function searchPatterns(q: string): Pattern[] {
    const needle = q.trim().toLowerCase()
    if (!needle) return patterns
    return patterns.filter((p) => {
      const haystack = [
        p.pattern_id,
        p.surface_family,
        p.surface,
        p.semantic,
        p.fingerprint,
        p.v2_replacement,
        p.test_target
      ]
        .filter((s): s is string => typeof s === 'string')
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }

  return {
    patterns: allPatterns,
    rollup: allRollup,
    evidenceCountByPack,
    getPattern,
    getRollup,
    getEvidenceForPattern,
    searchPatterns
  }
})
