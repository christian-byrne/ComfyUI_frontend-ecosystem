// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'

import { clearRegistryCache } from '@/services/registryApi'
import type { RegistryNode } from '@/types/registry'
import { repoToPackId } from '@/utils/repoToPackId'

import NodePacks from './NodePacks.vue'
import PackDetail from './PackDetail.vue'

// Pin the in-memory router for both pages.
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'overview', component: { template: '<div />' } },
    { path: '/node-packs', name: 'node-packs', component: NodePacks },
    { path: '/packs/:packId', name: 'pack-detail', component: PackDetail },
    {
      path: '/patterns/:id',
      name: 'pattern-detail',
      component: { template: '<div />' }
    }
  ]
})

/** Build an `ok` Response wrapping the given JSON. */
function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  }) as unknown as Response
}

beforeEach(() => {
  clearRegistryCache()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NodePacks page', () => {
  it('renders a grid of pack tiles enriched with mocked registry responses', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const idMatch = url.match(/\/nodes\/([^/?]+)/)
      const id = idMatch ? decodeURIComponent(idMatch[1]) : 'unknown'
      const fake: RegistryNode = {
        id,
        name: `Mock ${id}`,
        description: `Mock description for ${id}`,
        author: 'mock-publisher',
        publisher: { id: 'mock-publisher', name: 'Mock Publisher' },
        downloads: 12345,
        github_stars: 999,
        banner_url: `https://example.com/banner-${id}.png`
      }
      return jsonResponse(fake)
    }) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock as unknown)

    await router.push('/node-packs')
    await router.isReady()

    const wrapper = mount(NodePacks, {
      global: { plugins: [router] }
    })

    expect(wrapper.find('[data-testid="node-packs-page"]').exists()).toBe(true)
    const tiles = wrapper.findAll('[data-testid="node-pack-tile"]')
    // Top-N capped at 20; touch-points data has well over 20 packs.
    expect(tiles.length).toBe(20)

    // Default sort is stars: the highest-starred pack should land first.
    const firstRepo = tiles[0].attributes('data-repo')
    expect(firstRepo).toBeTruthy()

    // Allow the per-tile fetch promises to settle so the registry name lands.
    await flushPromises()
    await flushPromises()
    expect(wrapper.text()).toContain('Mock ')
    expect(
      (fetchMock as unknown as MockedFunction<typeof fetch>).mock.calls.length
    ).toBeGreaterThan(0)
  })

  it('changes order when the sort control changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ id: 'x' })) as unknown as typeof fetch
    )

    await router.push('/node-packs')
    await router.isReady()
    const wrapper = mount(NodePacks, { global: { plugins: [router] } })

    const reposByStars = wrapper
      .findAll('[data-testid="node-pack-tile"]')
      .map((w) => w.attributes('data-repo'))

    await wrapper.find('[data-testid="sort-patternHits"]').trigger('click')
    const reposByHits = wrapper
      .findAll('[data-testid="node-pack-tile"]')
      .map((w) => w.attributes('data-repo'))

    expect(reposByHits).not.toEqual(reposByStars)
  })
})

describe('PackDetail page', () => {
  it('renders banner + metadata + pattern table for a known pack', async () => {
    // ComfyUI-Manager is the highest-blast-radius pack in the dataset.
    const repo = 'Comfy-Org/ComfyUI-Manager'
    const packId = repoToPackId(repo)!

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      expect(url).toContain(`/nodes/${packId}`)
      return jsonResponse({
        id: packId,
        name: 'ComfyUI Manager',
        description: 'Manage your custom nodes',
        author: 'Comfy-Org',
        publisher: { id: 'comfy-org', name: 'Comfy Org' },
        downloads: 1_240_000,
        github_stars: 14564,
        banner_url: 'https://example.com/manager.png',
        repository: 'https://github.com/Comfy-Org/ComfyUI-Manager',
        latest_version: { version: '3.0.1', createdAt: '2026-04-01' }
      } satisfies RegistryNode)
    }) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock as unknown)

    await router.push(`/packs/${packId}`)
    await router.isReady()
    const wrapper = mount(PackDetail, { global: { plugins: [router] } })

    expect(
      wrapper
        .find('[data-testid="pack-detail-page"]')
        .attributes('data-pack-id')
    ).toBe(packId)

    // Local fallbacks render synchronously.
    expect(wrapper.text()).toContain('Comfy-Org')

    // Wait for registry promise to land.
    await flushPromises()
    await flushPromises()
    expect(wrapper.text()).toContain('ComfyUI Manager')
    expect(wrapper.text()).toContain('Manage your custom nodes')
    expect(wrapper.text()).toMatch(/14[.,\s]?564/)
    expect(wrapper.text()).toContain('3.0.1')

    // Pattern table is populated and at least one row links to PatternDetail.
    const table = wrapper.find('[data-testid="pattern-coverage-table"]')
    expect(table.exists()).toBe(true)
    const patternLinks = table.findAll('a[data-pattern-id]')
    expect(patternLinks.length).toBeGreaterThan(0)
    const firstHref = patternLinks[0].attributes('href')
    expect(firstHref).toContain('/patterns/')
  })

  it('falls back gracefully when the registry call errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'Not found' }), {
            status: 404,
            statusText: 'Not Found'
          }) as unknown as Response
      ) as unknown as typeof fetch
    )

    await router.push('/packs/comfyui-manager')
    await router.isReady()
    const wrapper = mount(PackDetail, { global: { plugins: [router] } })

    await flushPromises()
    await flushPromises()
    expect(wrapper.find('[data-testid="registry-error"]').exists()).toBe(true)
    // Local pack name still renders (derived from the canonical evidence repo).
    expect(wrapper.text()).toContain('ComfyUI-Manager')
  })
})
