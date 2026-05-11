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
 * The wrapper layers in:
 *   - per-call `AbortSignal` (composed with a default 10s timeout),
 *   - automatic retry on 5xx / network errors (max 2 retries, exponential
 *     backoff starting at 200 ms), and
 *   - runtime zod validation of the response body so upstream schema drift
 *     surfaces via `error` instead of silently producing a blank card.
 *
 * An in-memory promise cache keyed on URL collapses repeat lookups during a
 * session; tests can call {@link clearRegistryCache} between cases.
 *
 * @see https://docs.comfy.org/registry/overview
 */
import { ref } from 'vue'
import type { Ref } from 'vue'

import type { RegistryNode } from '@/types/registry'
import { registryNodeSchema } from '@/types/registrySchemas'
import { repoToPackId } from '@/utils/repoToPackId'

export const REGISTRY_BASE_URL = 'https://api.comfy.org'

/** Default per-request timeout, applied when callers don't override. */
export const DEFAULT_TIMEOUT_MS = 10_000

/** Max number of retries on 5xx / network errors (i.e. up to 3 total attempts). */
export const MAX_RETRIES = 2

/** Base delay for the exponential backoff between retries. */
const RETRY_BASE_DELAY_MS = 200

export interface PackResult {
  data: Ref<RegistryNode | null>
  error: Ref<unknown>
  isFinished: Ref<boolean>
}

export interface FetchPackOptions {
  /** Caller-controlled cancellation. Composed with the default timeout. */
  signal?: AbortSignal
  /** Override the default {@link DEFAULT_TIMEOUT_MS}. Set `0` to disable. */
  timeoutMs?: number
}

/** Process-wide cache of in-flight + resolved pack lookups, keyed on URL. */
const packCache = new Map<string, PackResult>()

/** Reset the in-memory cache. Used by tests; safe to call at any time. */
export function clearRegistryCache(): void {
  packCache.clear()
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof DOMException && err.name === 'AbortError'
  ) ||
    (err instanceof Error && err.name === 'AbortError')
}

/** Compose the caller's signal (if any) with a timeout signal. */
function buildRequestSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number
): AbortSignal | undefined {
  const signals: AbortSignal[] = []
  if (callerSignal) signals.push(callerSignal)
  if (timeoutMs > 0) signals.push(AbortSignal.timeout(timeoutMs))
  if (signals.length === 0) return undefined
  if (signals.length === 1) return signals[0]
  return AbortSignal.any(signals)
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Fetch with retry-on-5xx and retry-on-network-error.
 *
 * 4xx responses are returned as-is so callers can distinguish "not found"
 * from "transient outage". Aborts are never retried.
 */
async function fetchWithRetry(
  url: string,
  options: FetchPackOptions
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Caller signal short-circuits the loop before we burn another attempt.
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    const signal = buildRequestSignal(options.signal, timeoutMs)
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal
      })
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        lastError = new Error(`Registry ${res.status}: ${res.statusText}`)
      } else {
        return res
      }
    } catch (err) {
      if (isAbortError(err) && options.signal?.aborted) throw err
      if (attempt >= MAX_RETRIES) throw err
      lastError = err
    }
    // Exponential backoff: 200ms, 400ms, 800ms…
    await delay(RETRY_BASE_DELAY_MS * 2 ** attempt, options.signal)
  }
  // Unreachable in practice — the loop either returns or throws.
  throw lastError ?? new Error('fetchWithRetry: exhausted retries')
}

function fetchPack(packId: string, options: FetchPackOptions = {}): PackResult {
  const url = `${REGISTRY_BASE_URL}/nodes/${encodeURIComponent(packId)}`
  const cached = packCache.get(url)
  if (cached) return cached

  const data = ref<RegistryNode | null>(null)
  const error = ref<unknown>(null)
  const isFinished = ref(false)

  const result: PackResult = { data, error, isFinished }
  packCache.set(url, result)

  fetchWithRetry(url, options)
    .then(async (res) => {
      if (!res.ok) {
        // Drop the cache entry on failure so a retry can hit the wire again.
        packCache.delete(url)
        error.value = new Error(`Registry ${res.status}: ${res.statusText}`)
        return
      }
      try {
        const json: unknown = await res.json()
        const parsed = registryNodeSchema.safeParse(json)
        if (!parsed.success) {
          packCache.delete(url)
          error.value = new Error(
            `Registry response failed schema validation: ${parsed.error.message}`
          )
          return
        }
        data.value = parsed.data
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
 * (network, 404, banned, schema mismatch, abort, timeout) surface via
 * `error`; `data` stays `null`.
 */
export function getPackById(
  packId: string,
  options: FetchPackOptions = {}
): PackResult {
  if (!packId) {
    return {
      data: ref<RegistryNode | null>(null) as Ref<RegistryNode | null>,
      error: ref(new Error('Empty packId')),
      isFinished: ref(true)
    }
  }
  return fetchPack(packId, options)
}

/**
 * Fetch a pack given its GitHub repo URL or `org/repo` shorthand.
 *
 * Resolves the pack id heuristically via {@link repoToPackId}; returns an
 * already-finished result with `error` set when the URL can't be parsed.
 */
export function getPackByGithubUrl(
  url: string,
  options: FetchPackOptions = {}
): PackResult {
  const packId = repoToPackId(url)
  if (!packId) {
    return {
      data: ref<RegistryNode | null>(null) as Ref<RegistryNode | null>,
      error: ref(new Error(`Could not derive packId from URL: ${url}`)),
      isFinished: ref(true)
    }
  }
  return fetchPack(packId, options)
}
