/**
 * Star-cache loader.
 *
 * Reads `research/touch-points-star-cache.yaml` and exposes a repo→entry
 * map. The Comfy Registry API (W2.C `registryApi`) is the authoritative
 * source for runtime metadata (banner, downloads, publisher), but the local
 * star cache covers the *full* set of repos found in evidence — including
 * ones the registry doesn't index — and lets the NodePacks page sort by
 * stars without firing 20+ network requests up front.
 */
import { load as parseYaml } from 'js-yaml'

import starCacheRaw from '../../research/touch-points-star-cache.yaml?raw'

export interface StarCacheEntry {
  repo: string
  stars: number
  archived?: boolean
  forks?: number
  last_commit?: string
  asof?: string
}

interface StarCacheFile {
  asof?: string
  populated_via?: string
  repos: StarCacheEntry[]
}

const file = parseYaml(starCacheRaw) as StarCacheFile

export const starCache: Record<string, StarCacheEntry> = Object.fromEntries(
  (file.repos ?? []).map((r) => [r.repo, r])
)

/** Stars for a given repo, or 0 when not in the cache. */
export function starsFor(repo: string): number {
  return starCache[repo]?.stars ?? 0
}
