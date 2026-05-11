import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, RouterLinkStub, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CategoryDetail from '../CategoryDetail.vue'

const STUB_BODY = '// fake stub body for BC.01\n'

const useRouteMock = vi.fn(() => ({ params: { id: 'BC.01' } }))
vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return { ...actual, useRoute: () => useRouteMock() }
})

describe('CategoryDetail', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    if (typeof localStorage !== 'undefined') localStorage.clear()
    useRouteMock.mockReturnValue({ params: { id: 'BC.01' } })

    // Mock the upstream raw fetcher.
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const u = String(url)
      if (u.endsWith('bc-01.v2.test.ts')) {
        return new Response(STUB_BODY, { status: 200 })
      }
      return new Response('', { status: 404 })
    }) as typeof fetch
  })

  it('mounts and renders the BC.01 category, member patterns, and stub-trio panes', async () => {
    const wrapper = mount(CategoryDetail, {
      global: {
        stubs: { RouterLink: RouterLinkStub }
      }
    })

    await flushPromises()

    const root = wrapper.find('[data-test="category-detail"]')
    expect(root.exists()).toBe(true)
    expect(root.text()).toContain('BC.01')

    const stubBlocks = wrapper.findAll('[data-test^="stub-block-"]')
    expect(stubBlocks.length).toBe(3)

    const patternLinks = wrapper.findAll('[data-test="pattern-link"]')
    expect(patternLinks.length).toBeGreaterThan(0)
  })

  it('renders an unknown-category fallback when the id is not in the store', async () => {
    useRouteMock.mockReturnValue({ params: { id: 'BC.999' } })

    const wrapper = mount(CategoryDetail, {
      global: { stubs: { RouterLink: RouterLinkStub } }
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Unknown behavior category')
  })
})
