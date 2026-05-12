// @vitest-environment happy-dom
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { _resetPackCoverageCache } from '@/composables/usePackCoverage'
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
    { path: '/node-packs/:packId', name: 'pack-detail', component: PackDetail },
    {
      path: '/patterns/:id',
      name: 'pattern-detail',
      component: { template: '<div />' }
    }
  ]
})

/** Build an `ok` Response wrapping the given JSON. */
function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  }) as unknown as Response
}

/**
 * Stub `globalThis.fetch` with a typed handler. Centralises the cast so
 * individual tests don't need to repeat `as unknown as typeof fetch`.
 * Returns the underlying `vi.fn` for assertions.
 */
function mockFetch(
  handler: (input: RequestInfo | URL) => Promise<Response>
): ReturnType<typeof vi.fn> {
  const fn = vi.fn(handler)
  vi.stubGlobal('fetch', fn as unknown as typeof fetch)
  return fn
}

beforeEach(() => {
  clearRegistryCache()
  // Forward-safety: tests later may monkey-patch `evidenceCountByPack`. The
  // pack-coverage cache is module-scoped, so reset between tests.
  _resetPackCoverageCache()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('NodePacks page', () => {
  it('renders a grid of pack tiles enriched with mocked registry responses', async () => {
    const fetchMock = mockFetch(async (input) => {
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
    })

    await router.push('/node-packs')
    await router.isReady()

    const wrapper = mount(NodePacks, {
      global: { plugins: [router] }
    })

    expect(wrapper.find('[data-testid="node-packs-page"]').exists()).toBe(true)
    const tiles = wrapper.findAll('[data-testid="node-pack-tile"]')
    // Top-N capped at 20; touch-points data has well over 20 packs.
    expect(tiles.length).toBe(20)

    // Grid advertises busy state until at least one tile finishes enriching.
    const grid = wrapper.find('[data-testid="node-packs-grid"]')
    expect(grid.attributes('aria-busy')).toBe('true')

    // Default sort is stars: the highest-starred pack should land first.
    const firstRepo = tiles[0].attributes('data-repo')
    expect(firstRepo).toBeTruthy()

    // Allow the per-tile fetch promises to settle so the registry name lands.
    // Two flushes are required because the registry pipeline is
    // `useFetch().then(json()).then(set)`; the second flush picks up the
    // chained microtask.
    await flushPromises()
    await flushPromises()
    expect(wrapper.text()).toContain('Mock ')
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0)

    // After all tiles finish enriching the busy flag drops.
    expect(
      wrapper.find('[data-testid="node-packs-grid"]').attributes('aria-busy')
    ).toBe('false')
  })

  it('changes order when the sort control changes', async () => {
    mockFetch(async () => jsonResponse({ id: 'x' }))

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

  it('also reorders for the weightedImpact sort', async () => {
    mockFetch(async () => jsonResponse({ id: 'x' }))

    await router.push('/node-packs')
    await router.isReady()
    const wrapper = mount(NodePacks, { global: { plugins: [router] } })

    const reposByStars = wrapper
      .findAll('[data-testid="node-pack-tile"]')
      .map((w) => w.attributes('data-repo'))

    await wrapper.find('[data-testid="sort-weightedImpact"]').trigger('click')

    const sortBtn = wrapper.find('[data-testid="sort-weightedImpact"]')
    expect(sortBtn.attributes('aria-checked')).toBe('true')
    expect(sortBtn.attributes('role')).toBe('radio')

    const reposByImpact = wrapper
      .findAll('[data-testid="node-pack-tile"]')
      .map((w) => w.attributes('data-repo'))

    expect(reposByImpact).not.toEqual(reposByStars)
    expect(reposByImpact.length).toBe(20)
  })

  it('surfaces a per-tile error marker when the registry call fails', async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ message: 'boom' }), {
          status: 500,
          statusText: 'Server Error'
        }) as unknown as Response
    )

    await router.push('/node-packs')
    await router.isReady()
    const wrapper = mount(NodePacks, { global: { plugins: [router] } })

    await flushPromises()
    await flushPromises()

    const errorMarkers = wrapper.findAll('[data-testid="tile-error"]')
    expect(errorMarkers.length).toBeGreaterThan(0)
    // Local fallback name still rendered.
    expect(wrapper.findAll('[data-testid="node-pack-tile"]').length).toBe(20)
  })

  it('shows the sort group with proper radiogroup semantics', async () => {
    mockFetch(async () => jsonResponse({ id: 'x' }))

    await router.push('/node-packs')
    await router.isReady()
    const wrapper = mount(NodePacks, { global: { plugins: [router] } })

    const group = wrapper.find('[role="radiogroup"]')
    expect(group.exists()).toBe(true)
    expect(group.attributes('aria-label')).toBe('Sort packs by')
    const radios = group.findAll('[role="radio"]')
    expect(radios.length).toBe(3)
    // Exactly one is checked.
    const checked = radios.filter((r) => r.attributes('aria-checked') === 'true')
    expect(checked.length).toBe(1)
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

    await router.push(`/node-packs/${packId}`)
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

    await router.push('/node-packs/comfyui-manager')
    await router.isReady()
    const wrapper = mount(PackDetail, { global: { plugins: [router] } })

    await flushPromises()
    await flushPromises()
    expect(wrapper.find('[data-testid="registry-error"]').exists()).toBe(true)
    // Local pack name still renders (derived from the canonical evidence repo).
    expect(wrapper.text()).toContain('ComfyUI-Manager')
  })
})
