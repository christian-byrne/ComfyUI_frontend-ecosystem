// @vitest-environment node
//
// msw + happy-dom's Response disagree about ReadableStream ownership, so this
// suite runs in plain Node where the global fetch is undici and msw can
// intercept cleanly.
import { http, HttpResponse, delay as mswDelay } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import type { RegistryNode } from '@/types/registry'

import {
  REGISTRY_BASE_URL,
  clearRegistryCache,
  getPackById,
  getPackByGithubUrl
} from './registryApi'

const fixturePack: RegistryNode = {
  id: 'comfyui-manager',
  name: 'ComfyUI Manager',
  description: 'Manage your custom nodes from inside ComfyUI.',
  author: 'Comfy-Org',
  publisher: { id: 'comfy-org', name: 'Comfy Org' },
  downloads: 1_240_000,
  github_stars: 14564,
  banner_url: 'https://example.com/banner.png',
  repository: 'https://github.com/Comfy-Org/ComfyUI-Manager'
}

const server = setupServer(
  http.get(`${REGISTRY_BASE_URL}/nodes/comfyui-manager`, () =>
    HttpResponse.json(fixturePack)
  ),
  http.get(`${REGISTRY_BASE_URL}/nodes/does-not-exist`, () =>
    HttpResponse.json({ message: 'Not found' }, { status: 404 })
  )
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  clearRegistryCache()
})
afterAll(() => server.close())

/** Wait for a useFetch result to settle (success or error). */
async function settle(
  result: { isFinished: { value: boolean } },
  timeoutMs = 2_000
) {
  // Give microtasks + the fetch promise chain a chance to resolve.
  const start = Date.now()
  while (!result.isFinished.value) {
    if (Date.now() - start > timeoutMs) break
    await new Promise((r) => setTimeout(r, 10))
  }
  expect(result.isFinished.value, 'request did not finish in time').toBe(true)
}

describe('getPackById', () => {
  it('resolves to the registry payload on success', async () => {
    const result = getPackById('comfyui-manager')
    await settle(result)
    expect(result.error.value).toBeNull()
    expect(result.data.value).toMatchObject({
      id: 'comfyui-manager',
      name: 'ComfyUI Manager',
      github_stars: 14564
    })
  })

  it('flags 404s via the error ref and leaves data null', async () => {
    const result = getPackById('does-not-exist')
    await settle(result)
    expect(result.data.value).toBeNull()
    expect(result.error.value).toBeTruthy()
  })

  it('short-circuits empty packIds without firing a request', async () => {
    const result = getPackById('')
    expect(result.isFinished.value).toBe(true)
    expect(result.error.value).toBeInstanceOf(Error)
  })

  it('caches identical requests', async () => {
    const a = getPackById('comfyui-manager')
    const b = getPackById('comfyui-manager')
    expect(a).toBe(b)
  })
})

describe('getPackByGithubUrl', () => {
  it('derives the packId from a github URL and fetches it', async () => {
    const result = getPackByGithubUrl(
      'https://github.com/Comfy-Org/ComfyUI-Manager'
    )
    await settle(result)
    expect(result.data.value?.id).toBe('comfyui-manager')
  })

  it('errors out when the URL cannot be parsed', () => {
    const result = getPackByGithubUrl('not-a-repo')
    expect(result.isFinished.value).toBe(true)
    expect(result.error.value).toBeInstanceOf(Error)
    expect(result.data.value).toBeNull()
  })
})

describe('fetch wrapper hardening', () => {
  it('aborts when the timeout fires', async () => {
    server.use(
      http.get(`${REGISTRY_BASE_URL}/nodes/slow-pack`, async () => {
        // Stall longer than every retry's timeout window combined.
        await mswDelay(2_000)
        return HttpResponse.json(fixturePack)
      })
    )
    const result = getPackById('slow-pack', { timeoutMs: 50 })
    await settle(result, 5_000)
    expect(result.data.value).toBeNull()
    const err = result.error.value as Error
    expect(err).toBeTruthy()
    // AbortError from the timeout signal — name is normalised by undici/dom.
    expect(['AbortError', 'TimeoutError']).toContain(err.name)
  })

  it('aborts when the caller-provided signal fires', async () => {
    server.use(
      http.get(`${REGISTRY_BASE_URL}/nodes/cancel-pack`, async () => {
        await mswDelay(500)
        return HttpResponse.json(fixturePack)
      })
    )
    const ctrl = new AbortController()
    const result = getPackById('cancel-pack', { signal: ctrl.signal })
    // Abort on the next tick so the fetch is in-flight.
    setTimeout(() => ctrl.abort(), 10)
    await settle(result, 5_000)
    expect(result.data.value).toBeNull()
    const err = result.error.value as Error
    expect(err).toBeTruthy()
    expect(err.name).toBe('AbortError')
  })

  it('retries on 5xx and ultimately succeeds', async () => {
    let calls = 0
    server.use(
      http.get(`${REGISTRY_BASE_URL}/nodes/flaky-pack`, () => {
        calls++
        if (calls < 2) {
          return HttpResponse.json({ message: 'Bad gateway' }, { status: 502 })
        }
        return HttpResponse.json({ ...fixturePack, id: 'flaky-pack' })
      })
    )
    const result = getPackById('flaky-pack', { timeoutMs: 5_000 })
    await settle(result, 5_000)
    expect(calls).toBeGreaterThanOrEqual(2)
    expect(result.error.value).toBeNull()
    expect(result.data.value?.id).toBe('flaky-pack')
  })

  it('gives up after MAX_RETRIES on persistent 5xx', async () => {
    let calls = 0
    server.use(
      http.get(`${REGISTRY_BASE_URL}/nodes/dead-pack`, () => {
        calls++
        return HttpResponse.json({ message: 'oops' }, { status: 503 })
      })
    )
    const result = getPackById('dead-pack', { timeoutMs: 5_000 })
    await settle(result, 5_000)
    // Initial attempt + 2 retries = 3 calls total.
    expect(calls).toBe(3)
    expect(result.data.value).toBeNull()
    expect(result.error.value).toBeTruthy()
  })

  it('rejects malformed responses via the schema validator', async () => {
    server.use(
      http.get(`${REGISTRY_BASE_URL}/nodes/bad-shape`, () =>
        // `downloads` is a string here — schema expects number.
        HttpResponse.json({
          id: 'bad-shape',
          name: 'Bad shape',
          downloads: 'not-a-number'
        })
      )
    )
    const result = getPackById('bad-shape')
    await settle(result, 5_000)
    expect(result.data.value).toBeNull()
    const err = result.error.value as Error
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toMatch(/schema validation/i)
  })
})
