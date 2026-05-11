/**
 * Builds the list of packs the {@link NodePacks} page browses.
 *
 * Starting set: every repo that appears in the evidence database (i.e. has
 * at least one v1-API touchpoint). Sort key controls the order; top-N caps
 * the visible slice (defaults to 20 per W3 spec).
 */
import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { evidenceCountByPack } from '@/data'
import { starsFor } from '@/data/star-cache'
import { getPackCoverage } from './usePackCoverage'

export type TopPackSort = 'stars' | 'patternHits' | 'weightedImpact'

export interface TopPackEntry {
  repo: string
  stars: number
  patternHits: number
  weightedImpact: number
  totalHits: number
}

export function buildTopPacks(sort: TopPackSort, limit = 20): TopPackEntry[] {
  const entries: TopPackEntry[] = Object.keys(evidenceCountByPack).map(
    (repo) => {
      const cov = getPackCoverage(repo)
      return {
        repo,
        stars: starsFor(repo),
        patternHits: cov?.patternHits ?? 0,
        weightedImpact: cov?.weightedImpact ?? 0,
        totalHits: cov?.totalHits ?? 0
      }
    }
  )

  // Stable secondary sort on stars then repo name keeps the order
  // deterministic when the primary key ties (notably for `patternHits`
  // where many small packs land on 1).
  entries.sort((a, b) => {
    const primary = b[sort] - a[sort]
    if (primary !== 0) return primary
    if (b.stars !== a.stars) return b.stars - a.stars
    return a.repo.localeCompare(b.repo)
  })

  return entries.slice(0, limit)
}

export function useTopPacks(
  sort: Ref<TopPackSort> | ComputedRef<TopPackSort>,
  limit = 20
): ComputedRef<TopPackEntry[]> {
  return computed(() => buildTopPacks(sort.value, limit))
}
