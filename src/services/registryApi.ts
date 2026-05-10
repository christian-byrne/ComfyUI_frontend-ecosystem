/**
 * Comfy Registry API client.
 *
 * Mirrors the upstream `comfyRegistryService` (ComfyUI_frontend) but pared
 * down to the two endpoints the dashboard needs for the NodePacks page:
 *
 *   - {@link getPackById}        →  GET /nodes/:packId
 *   - {@link getPackByGithubUrl} →  GET /nodes/:packId  (via {@link repoToPackId})
 *
 * Each call returns reactive refs (`data`, `error`, `isFinished`) that mirror
 * the shape of VueUse `useFetch` results, so component code can `await`
 * `isFinished` or bind directly to `data`. We use plain `fetch()` under the
 * hood (instead of `useFetch`) to keep the test-time mocking story simple
 * and to avoid the `ReadableStream` lock issues the VueUse helper hits when
 * the body is consumed twice.
 *
 * An in-memory promise cache keyed on URL collapses repeat lookups during a
 * session; tests can call {@link clearRegistryCache} between cases.
 *
 * @see https://docs.comfy.org/registry/overview
 */
import { ref } from 'vue'
import type { Ref } from 'vue'

import type { RegistryNode } from '@/types/registry'
import { repoToPackId } from '@/utils/repoToPackId'

export const REGISTRY_BASE_URL = 'https://api.comfy.org'

export interface PackResult {
  data: Ref<RegistryNode | null>
  error: Ref<unknown>
  isFinished: Ref<boolean>
}

/** Process-wide cache of in-flight + resolved pack lookups, keyed on URL. */
const packCache = new Map<string, PackResult>()

/** Reset the in-memory cache. Used by tests; safe to call at any time. */
export function clearRegistryCache(): void {
  packCache.clear()
}

function fetchPack(packId: string): PackResult {
  const url = `${REGISTRY_BASE_URL}/nodes/${encodeURIComponent(packId)}`
  const cached = packCache.get(url)
  if (cached) return cached

  const data = ref<RegistryNode | null>(null)
  const error = ref<unknown>(null)
  const isFinished = ref(false)

  const result: PackResult = { data, error, isFinished }
  packCache.set(url, result)

  fetch(url, { headers: { Accept: 'application/json' } })
    .then(async (res) => {
      if (!res.ok) {
        // Drop the cache entry on failure so a retry can hit the wire again.
        packCache.delete(url)
        error.value = new Error(`Registry ${res.status}: ${res.statusText}`)
        return
      }
      try {
        data.value = (await res.json()) as RegistryNode
      } catch (err) {
        packCache.delete(url)
        error.value = err
      }
    })
    .catch((err: unknown) => {
      packCache.delete(url)
      error.value = err
    })
    .finally(() => {
      isFinished.value = true
    })

  return result
}

/**
 * Fetch a pack by its registry id (e.g. `comfyui-manager`).
 *
 * Returns reactive refs that update once the request completes. Failures
 * (network, 404, banned) surface via `error`; `data` stays `null`.
 */
export function getPackById(packId: string): PackResult {
  if (!packId) {
    return {
      data: ref<RegistryNode | null>(null) as Ref<RegistryNode | null>,
      error: ref(new Error('Empty packId')),
      isFinished: ref(true)
    }
  }
  return fetchPack(packId)
}

/**
 * Fetch a pack given its GitHub repo URL or `org/repo` shorthand.
 *
 * Resolves the pack id heuristically via {@link repoToPackId}; returns an
 * already-finished result with `error` set when the URL can't be parsed.
 */
export function getPackByGithubUrl(url: string): PackResult {
  const packId = repoToPackId(url)
  if (!packId) {
    return {
      data: ref<RegistryNode | null>(null) as Ref<RegistryNode | null>,
      error: ref(new Error(`Could not derive packId from URL: ${url}`)),
      isFinished: ref(true)
    }
  }
  return fetchPack(packId)
}
