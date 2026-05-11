import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ApiDiff from './ApiDiff.vue'
import { V1_SOURCE, V2_SOURCES } from '../composables/useApiSurface'

// ─── Fixture mirroring the real v1 ComfyExtension shape ──────────────────
// Includes >5 of the methods present in MIGRATION_STATUS so the badge
// row renders the required minimum.
const V1_FIXTURE = `
export interface ComfyExtension {
  init?(app: ComfyApp): Promise<void> | void
  setup?(app: ComfyApp): Promise<void> | void
  beforeConfigureGraph?(): void
  afterConfigureGraph?(): void
  beforeRegisterNodeDef?(nodeType: any, nodeData: any, app: ComfyApp): void
  beforeRegisterVueAppNodeDefs?(defs: any, app: ComfyApp): void
  registerCustomNodes?(app: ComfyApp): void
  loadedGraphNode?(node: any, app: ComfyApp): void
  nodeCreated?(node: any, app: ComfyApp): void
  getCustomWidgets?(app: ComfyApp): Record<string, unknown>
  getCanvasMenuItems?(app: ComfyApp): unknown[]
  getNodeMenuItems?(app: ComfyApp): unknown[]
  getSelectionToolboxCommands?(): unknown[]
}
`.trim()

const V2_FIXTURE_LIFECYCLE = `
export function defineExtension(opts: { setup?(): void }): void {}
`.trim()

const V2_FIXTURE_NODE = `
export function defineNodeExtension(opts: {
  beforeRegister?(nodeType: any): void
  created?(node: any): void
}): void {}
`.trim()

const V2_FIXTURE_WIDGET = `
export interface WidgetHandle { on(ev: 'change', fn: () => void): void }
`.trim()

const V2_FIXTURE_EVENTS = `
export interface BeforeQueueEvent { reject(msg: string): void }
`.trim()

function fakeFetch(input: RequestInfo | URL): Promise<Response> {
  const url = String(input)
  let body: string | null = null
  if (url === V1_SOURCE.url) body = V1_FIXTURE
  else {
    const v2idx = V2_SOURCES.findIndex((s) => s.url === url)
    if (v2idx === 0) body = V2_FIXTURE_LIFECYCLE
    else if (v2idx === 1) body = V2_FIXTURE_NODE
    else if (v2idx === 2) body = V2_FIXTURE_WIDGET
    else if (v2idx === 3) body = V2_FIXTURE_EVENTS
  }
  if (body === null) {
    return Promise.resolve(
      new Response('not found', { status: 404, statusText: 'Not Found' })
    )
  }
  return Promise.resolve(new Response(body, { status: 200 }))
}

describe('ApiDiff page', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn(fakeFetch))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mounts, fetches both surfaces, and renders the diff grid', async () => {
    const wrapper = mount(ApiDiff)
    await flushPromises()

    expect(wrapper.find('[data-testid="error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="diff-grid"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('v1 — comfy.ts')
    expect(wrapper.text()).toContain('v2 — lifecycle.ts')
  })

  it('renders status badges for at least 5 detected v1 methods', async () => {
    const wrapper = mount(ApiDiff)
    await flushPromises()

    const badges = wrapper.find('[data-testid="method-badges"]')
    expect(badges.exists()).toBe(true)

    const text = badges.text()
    // Spot-check several method names with their statuses.
    const expected = [
      'init',
      'setup',
      'beforeRegisterNodeDef',
      'nodeCreated',
      'getCustomWidgets',
      'registerCustomNodes'
    ]
    for (const m of expected) {
      expect(text).toContain(m)
    }
    // Spot-check that all four status vocab words appear at least once.
    expect(text).toContain('replaced')
    expect(text).toContain('re-implemented')
    expect(text).toContain('strangler-fig')
    expect(text).toContain('dropped')
  })

  it('caches fetched bodies in localStorage and reuses them', async () => {
    mount(ApiDiff)
    await flushPromises()

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalledTimes(1 + V2_SOURCES.length)

    // Mount again — cache should serve all responses, no new fetches.
    fetchMock.mockClear()
    mount(ApiDiff)
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows an error banner when a fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response('boom', { status: 500 }))
      )
    )

    const wrapper = mount(ApiDiff)
    await flushPromises()

    expect(wrapper.find('[data-testid="error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="diff-grid"]').exists()).toBe(false)
  })
})
