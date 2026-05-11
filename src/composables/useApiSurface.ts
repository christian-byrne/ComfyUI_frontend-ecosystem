import { ref, type Ref } from 'vue'

/**
 * Source of an API surface document fetched from GitHub raw content.
 *
 * `label` — short human-readable label used in column headers / lists.
 * `url`   — full https://raw.githubusercontent.com URL.
 */
export interface ApiSource {
  label: string
  url: string
}

/**
 * v1 ComfyExtension interface lives in a single file on `main`.
 */
export const V1_SOURCE: ApiSource = {
  label: 'v1 ComfyExtension (main)',
  url: 'https://raw.githubusercontent.com/Comfy-Org/ComfyUI_frontend/main/src/types/comfy.ts'
}

/**
 * v2 surface is split across four declaration files on the
 * `ext-api/i-foundation` branch.
 */
export const V2_SOURCES: ApiSource[] = (
  ['lifecycle', 'node', 'widget', 'events'] as const
).map((name) => ({
  label: `v2 ${name}.ts`,
  url: `https://raw.githubusercontent.com/Comfy-Org/ComfyUI_frontend/ext-api/i-foundation/src/extension-api/${name}.ts`
}))

const CACHE_PREFIX = 'apidiff:v1:'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

interface CacheEntry {
  fetchedAt: number
  body: string
}

/**
 * Read a cached body if present and still fresh (1-day TTL).
 * Exposed for tests.
 */
export function readCache(
  url: string,
  now: number = Date.now(),
  storage: Storage | undefined = globalThis.localStorage
): string | null {
  if (!storage) return null
  const raw = storage.getItem(CACHE_PREFIX + url)
  if (!raw) return null
  try {
    const entry = JSON.parse(raw) as CacheEntry
    if (now - entry.fetchedAt > ONE_DAY_MS) return null
    return entry.body
  } catch {
    return null
  }
}

function writeCache(
  url: string,
  body: string,
  now: number = Date.now(),
  storage: Storage | undefined = globalThis.localStorage
): void {
  if (!storage) return
  try {
    storage.setItem(
      CACHE_PREFIX + url,
      JSON.stringify({ fetchedAt: now, body } satisfies CacheEntry)
    )
  } catch {
    // Quota exceeded or disabled — silently skip caching.
  }
}

/**
 * Fetch one source, preferring localStorage cache (1 day TTL).
 */
export async function fetchSource(source: ApiSource): Promise<string> {
  const cached = readCache(source.url)
  if (cached !== null) return cached
  const res = await fetch(source.url)
  if (!res.ok) {
    throw new Error(`Fetch failed for ${source.url}: ${res.status}`)
  }
  const body = await res.text()
  writeCache(source.url, body)
  return body
}

export interface ApiDiffPayload {
  v1: string
  v2: string
  /** Concatenated label for v2 (e.g. "lifecycle.ts + node.ts + ..."). */
  v2Label: string
}

/**
 * Reactive loader that fetches the v1 source and concatenates the four
 * v2 declaration files into a single virtual document.
 *
 * Concatenation uses banner comments so the v2 column is still readable
 * as a single scrollable text block.
 */
export function useApiSurface(): {
  loading: Ref<boolean>
  error: Ref<Error | null>
  data: Ref<ApiDiffPayload | null>
  load: () => Promise<void>
} {
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const data = ref<ApiDiffPayload | null>(null)

  const load = async () => {
    loading.value = true
    error.value = null
    try {
      const [v1, ...v2Parts] = await Promise.all([
        fetchSource(V1_SOURCE),
        ...V2_SOURCES.map(fetchSource)
      ])
      const v2 = V2_SOURCES.map(
        (src, i) => `// ─── ${src.label} ───\n${v2Parts[i]}`
      ).join('\n\n')
      data.value = {
        v1,
        v2,
        v2Label: V2_SOURCES.map((s) => s.label).join(' + ')
      }
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      loading.value = false
    }
  }

  return { loading, error, data, load }
}
