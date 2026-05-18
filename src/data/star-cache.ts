import type { StarCacheEntry, StarCacheFile } from './schema'
/**
 * Star-cache loader.
 *
 * Reads pre-parsed JSON star cache and exposes a repo→entry map.
 * Callers should keep going through the `starCache` lookup so
 * data source changes are transparent.
 */
import starCacheData from './touch-points-star-cache.json'

export type { StarCacheEntry }

const file = starCacheData as StarCacheFile

export const starCache: Record<string, StarCacheEntry> = Object.fromEntries(
  (file.repos ?? []).map((r) => [r.repo, r])
)

export function isInStarCache(repo: string): boolean {
  return Object.hasOwn(starCache, repo)
}

/** Stars for a given repo, or 0 when not in the cache. */
export function starsFor(repo: string): number {
  return starCache[repo]?.stars ?? 0
}
