import { reactive } from 'vue'

/**
 * Fetches per-category test-stub files from the canonical upstream test-framework
 * branch and caches the raw text in localStorage with a 1-day TTL.
 *
 * ## Branch provenance
 *
 * This pointed at `ext-api/i-tf` until 2026-08. That branch is **dead** — its
 * head has been `bcc9b48f25` since 2026-05-11. The wave-4 reconciliation
 * (2026-05-13, see AGENTS.md "Reconciliation history") made the `-restratify`
 * line canonical across the whole `ext-api/*` stack, and
 * `ext-api/i-tf-restratify` has moved on since: head `877286adbb` (2026-05-21),
 * 129 stub entries against the dead branch's 123.
 *
 * `useApiSurface.ts` was corrected to `-restratify` at the time; this file was
 * missed, so the two composables disagreed about which branch was real and this
 * one served stale-or-404 stubs for three months.
 *
 * URL shape:
 *   https://raw.githubusercontent.com/Comfy-Org/ComfyUI_frontend/
 *     ext-api/i-tf-restratify/src/extension-api-v2/__tests__/bc-XX.{v1,v2,migration}.test.ts
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

/** The canonical upstream test-framework branch. See the module docblock. */
export const STUB_BRANCH = 'ext-api/i-tf-restratify'

/**
 * Bumped `v1` -> `v2` alongside the branch fix. Cached entries keyed under the
 * old prefix were fetched from the dead `ext-api/i-tf` branch, including
 * negative (404) results with a 1-day TTL. Reusing the prefix would have served
 * those stale absences from localStorage for a day after the fix shipped, on
 * every machine that had ever opened the page.
 */
const STORAGE_PREFIX = 'eco:stub:v2:'
const RAW_BASE =
  'https://raw.githubusercontent.com/Comfy-Org/ComfyUI_frontend/' +
  `${STUB_BRANCH}/src/extension-api-v2/__tests__`

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
 * grid view to render coverage indicators without firing one request per
 * category-variant (41 categories x 3 variants) on mount.
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
