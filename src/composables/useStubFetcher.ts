import { reactive } from 'vue'

/**
 * Fetches per-category test-stub files from the upstream PR branch
 * (`ext-api/i-tf` on Comfy-Org/ComfyUI_frontend) and caches the raw text in
 * localStorage with a 1-day TTL.
 *
 * URL shape:
 *   https://raw.githubusercontent.com/Comfy-Org/ComfyUI_frontend/
 *     ext-api/i-tf/src/extension-api-v2/__tests__/bc-XX.{v1,v2,migration}.test.ts
 *
 * The stub trio for BC.07 lives at numeric `07`. The category id `BC.07`
 * is normalised to the two-digit zero-padded form expected by the upstream PR.
 */
export type StubVariant = 'v1' | 'v2' | 'migration'

export interface StubCacheEntry {
  /** UTC ms when the entry was written. */
  ts: number
  /** HTTP status from the fetch (200 = present, 404 = absent). */
  status: number
  /** Raw file body when status === 200, otherwise null. */
  body: string | null
}

export type StubState = 'idle' | 'loading' | 'present' | 'absent' | 'error'

export const STUB_TTL_MS = 24 * 60 * 60 * 1000 // 1 day
const STORAGE_PREFIX = 'eco:stub:v1:'
const RAW_BASE =
  'https://raw.githubusercontent.com/Comfy-Org/ComfyUI_frontend/' +
  'ext-api/i-tf/src/extension-api-v2/__tests__'

/** `BC.07` -> `07`. Returns null for malformed ids. */
export function categoryIdToBcNumber(id: string): string | null {
  const m = /^BC\.(\d+)$/.exec(id)
  if (!m) return null
  return m[1].padStart(2, '0')
}

export function stubUrl(categoryId: string, variant: StubVariant): string | null {
  const bc = categoryIdToBcNumber(categoryId)
  if (!bc) return null
  return `${RAW_BASE}/bc-${bc}.${variant}.test.ts`
}

function storageKey(categoryId: string, variant: StubVariant): string {
  return `${STORAGE_PREFIX}${categoryId}:${variant}`
}

function readCache(
  categoryId: string,
  variant: StubVariant,
  now: number = Date.now()
): StubCacheEntry | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(storageKey(categoryId, variant))
  if (!raw) return null
  try {
    const entry = JSON.parse(raw) as StubCacheEntry
    if (now - entry.ts > STUB_TTL_MS) return null
    return entry
  } catch {
    return null
  }
}

function writeCache(categoryId: string, variant: StubVariant, entry: StubCacheEntry): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(storageKey(categoryId, variant), JSON.stringify(entry))
  } catch {
    // Quota / serialization errors silently ignored — cache is best-effort.
  }
}

function entryToState(entry: StubCacheEntry | null): StubState {
  if (!entry) return 'idle'
  if (entry.status === 200) return 'present'
  if (entry.status === 404) return 'absent'
  return 'error'
}

export interface StubTrio {
  state: Record<StubVariant, StubState>
  body: Record<StubVariant, string | null>
}

const VARIANTS: StubVariant[] = ['v1', 'v2', 'migration']

/**
 * Returns reactive trio state for a category, optionally pre-filling from
 * localStorage. Call `load()` to fetch any missing variants.
 */
export function useStubFetcher(categoryId: string, fetchImpl: typeof fetch = globalThis.fetch) {
  const trio = reactive<StubTrio>({
    state: { v1: 'idle', v2: 'idle', migration: 'idle' },
    body: { v1: null, v2: null, migration: null }
  })

  // Hydrate from cache.
  for (const v of VARIANTS) {
    const cached = readCache(categoryId, v)
    if (cached) {
      trio.state[v] = entryToState(cached)
      trio.body[v] = cached.body
    }
  }

  async function fetchOne(variant: StubVariant): Promise<void> {
    const url = stubUrl(categoryId, variant)
    if (!url) {
      trio.state[variant] = 'error'
      return
    }
    trio.state[variant] = 'loading'
    try {
      const res = await fetchImpl(url)
      const body = res.status === 200 ? await res.text() : null
      const entry: StubCacheEntry = {
        ts: Date.now(),
        status: res.status,
        body
      }
      writeCache(categoryId, variant, entry)
      trio.body[variant] = body
      trio.state[variant] = entryToState(entry)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useStubFetcher] fetch failed', categoryId, variant, err)
      }
      trio.state[variant] = 'error'
    }
  }

  async function load(force = false): Promise<void> {
    await Promise.all(
      VARIANTS.map((v) => {
        if (!force && (trio.state[v] === 'present' || trio.state[v] === 'absent')) {
          return Promise.resolve()
        }
        return fetchOne(v)
      })
    )
  }

  return { trio, load, fetchOne }
}

/**
 * Synchronously inspect localStorage for trio coverage state. Used by the
 * grid view to render coverage indicators without firing 123 HTTP requests
 * on mount.
 */
export function readTrioCoverage(
  categoryId: string,
  now: number = Date.now()
): Record<StubVariant, StubState> {
  return {
    v1: entryToState(readCache(categoryId, 'v1', now)),
    v2: entryToState(readCache(categoryId, 'v2', now)),
    migration: entryToState(readCache(categoryId, 'migration', now))
  }
}
