// @vitest-environment node
//
// msw + happy-dom's Response disagree about ReadableStream ownership, so this
// suite runs in plain Node where the global fetch is undici and msw can
// intercept cleanly.
import { http, HttpResponse } from 'msw'
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
async function settle(result: { isFinished: { value: boolean } }) {
  // Give microtasks + the fetch promise chain a chance to resolve.
  for (let i = 0; i < 50 && !result.isFinished.value; i++) {
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
