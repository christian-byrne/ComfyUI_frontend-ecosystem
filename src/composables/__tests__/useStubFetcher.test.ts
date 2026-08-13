import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  categoryIdToBcNumber,
  readTrioCoverage,
  STUB_BRANCH,
  STUB_TTL_MS,
  stubUrl,
  useStubFetcher
} from '../useStubFetcher'

/**
 * `useStubFetcher` shipped an injectable `fetchImpl` parameter explicitly so it
 * could be tested — and then had no test file at all. That gap is why the dead
 * `ext-api/i-tf` branch went unnoticed for three months: nothing asserted which
 * URL the composable actually builds.
 */

/** Minimal `Response` stand-in — the composable only reads status and text(). */
function res(status: number, body = ''): Response {
  return { status, text: async () => body } as unknown as Response
}

function fakeFetch(routes: Record<string, Response>) {
  return vi.fn(async (url: string | URL | Request) => {
    const key = String(url)
    return routes[key] ?? res(404)
  }) as unknown as typeof fetch
}

beforeEach(() => {
  localStorage.clear()
})

describe('categoryIdToBcNumber', () => {
  it('zero-pads to the two-digit upstream form', () => {
    expect(categoryIdToBcNumber('BC.07')).toBe('07')
    expect(categoryIdToBcNumber('BC.7')).toBe('07')
    expect(categoryIdToBcNumber('BC.41')).toBe('41')
  })

  it('returns null for malformed ids', () => {
    expect(categoryIdToBcNumber('BC.')).toBeNull()
    expect(categoryIdToBcNumber('S2.N1')).toBeNull()
    expect(categoryIdToBcNumber('')).toBeNull()
  })
})

describe('stubUrl', () => {
  it('points at the canonical restratify branch, not the dead ext-api/i-tf', () => {
    const url = stubUrl('BC.07', 'v2')!
    expect(url).toContain(`/${STUB_BRANCH}/`)
    expect(url).toBe(
      'https://raw.githubusercontent.com/Comfy-Org/ComfyUI_frontend/' +
        'ext-api/i-tf-restratify/src/extension-api-v2/__tests__/bc-07.v2.test.ts'
    )
  })

  it('never resolves to the dead branch for any category or variant', () => {
    for (const id of ['BC.01', 'BC.16', 'BC.41']) {
      for (const variant of ['v1', 'v2', 'migration'] as const) {
        const url = stubUrl(id, variant)!
        // The dead branch is a strict prefix of the live one, so match on the
        // path segment boundary rather than a bare substring.
        expect(url).not.toContain('/ext-api/i-tf/')
      }
    }
  })

  it('returns null for a malformed category id', () => {
    expect(stubUrl('nope', 'v1')).toBeNull()
  })
})

describe('useStubFetcher', () => {
  it('records present/absent per variant from the injected fetch', async () => {
    const routes = {
      [stubUrl('BC.01', 'v1')!]: res(200, '// v1 stub'),
      [stubUrl('BC.01', 'v2')!]: res(200, '// v2 stub'),
      [stubUrl('BC.01', 'migration')!]: res(404)
    }
    const { trio, load } = useStubFetcher('BC.01', fakeFetch(routes))

    await load()

    expect(trio.state.v1).toBe('present')
    expect(trio.state.v2).toBe('present')
    expect(trio.state.migration).toBe('absent')
    expect(trio.body.v1).toBe('// v1 stub')
    expect(trio.body.migration).toBeNull()
  })

  it('requests exactly the three variant URLs', async () => {
    const impl = fakeFetch({})
    const { load } = useStubFetcher('BC.09', impl)

    await load()

    const called = (impl as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(called.sort()).toEqual(
      [stubUrl('BC.09', 'v1'), stubUrl('BC.09', 'v2'), stubUrl('BC.09', 'migration')].sort()
    )
  })

  it('marks a variant errored when fetch rejects', async () => {
    const impl = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    const { trio, load } = useStubFetcher('BC.02', impl)

    await load()

    expect(trio.state.v1).toBe('error')
    expect(trio.state.v2).toBe('error')
    expect(trio.state.migration).toBe('error')
  })

  it('treats a non-200/404 status as an error, not an absence', async () => {
    const routes = { [stubUrl('BC.03', 'v1')!]: res(500) }
    const { trio, load } = useStubFetcher('BC.03', fakeFetch(routes))

    await load()

    expect(trio.state.v1).toBe('error')
  })

  it('serves a second instance from the localStorage cache without refetching', async () => {
    const routes = { [stubUrl('BC.04', 'v1')!]: res(200, '// cached') }
    const first = fakeFetch(routes)
    await useStubFetcher('BC.04', first).load()
    expect((first as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3)

    const second = fakeFetch(routes)
    const { trio, load } = useStubFetcher('BC.04', second)
    // Hydrated at construction time from the cache.
    expect(trio.state.v1).toBe('present')
    expect(trio.body.v1).toBe('// cached')

    await load()
    // v1 and migration/v2 were all cached (present/absent) so nothing refetches.
    expect((second as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0)
  })

  it('refetches everything when load(force) is passed', async () => {
    const routes = { [stubUrl('BC.05', 'v1')!]: res(200, '// x') }
    await useStubFetcher('BC.05', fakeFetch(routes)).load()

    const again = fakeFetch(routes)
    await useStubFetcher('BC.05', again).load(true)

    expect((again as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3)
  })

  it('is keyed under the v2 storage prefix so dead-branch 404s are not reused', async () => {
    const routes = { [stubUrl('BC.06', 'v1')!]: res(200, '// fresh') }
    await useStubFetcher('BC.06', fakeFetch(routes)).load()

    expect(localStorage.getItem('eco:stub:v2:BC.06:v1')).not.toBeNull()
    expect(localStorage.getItem('eco:stub:v1:BC.06:v1')).toBeNull()
  })
})

describe('readTrioCoverage', () => {
  it('reports idle for an uncached category', () => {
    expect(readTrioCoverage('BC.40')).toEqual({
      v1: 'idle',
      v2: 'idle',
      migration: 'idle'
    })
  })

  it('reflects cached state without any network access', async () => {
    const routes = {
      [stubUrl('BC.11', 'v1')!]: res(200, '// a'),
      [stubUrl('BC.11', 'v2')!]: res(404)
    }
    await useStubFetcher('BC.11', fakeFetch(routes)).load()

    expect(readTrioCoverage('BC.11')).toEqual({
      v1: 'present',
      v2: 'absent',
      migration: 'absent'
    })
  })

  it('treats entries older than the TTL as idle', async () => {
    const routes = { [stubUrl('BC.12', 'v1')!]: res(200, '// old') }
    await useStubFetcher('BC.12', fakeFetch(routes)).load()

    const later = Date.now() + STUB_TTL_MS + 1
    expect(readTrioCoverage('BC.12', later).v1).toBe('idle')
  })
})
