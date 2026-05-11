/**
 * Star-cache loader (W3 stub).
 *
 * Reads `research/touch-points-star-cache.yaml` and exposes a repo→entry
 * map. The W2.C `registry-client` branch will replace this with a richer
 * Comfy Registry API client (publisher avatars, install counts, photos);
 * callers should keep going through the `starCache` lookup so the swap is
 * transparent.
 */
import { parse as parseYaml } from 'yaml'

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

export function isInStarCache(repo: string): boolean {
  return Object.prototype.hasOwnProperty.call(starCache, repo)
}
