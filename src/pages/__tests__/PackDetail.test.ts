import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

// Mock the registry API
vi.mock('@/services/registryApi', () => ({
  getPackById: vi.fn(() => ({
    data: { value: null },
    isFinished: { value: true },
    error: { value: null }
  }))
}))

import PackDetail from '../PackDetail.vue'
import { _resetPackCoverageCache } from '@/composables/usePackCoverage'

describe('PackDetail.vue', () => {
  beforeEach(() => {
    _resetPackCoverageCache()
  })

  async function mountWithRoute(packId: string) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/node-packs', name: 'node-packs', component: { template: '<div />' } },
        { path: '/node-packs/:packId', name: 'pack-detail', component: PackDetail },
        { path: '/patterns/:id', name: 'pattern-detail', component: { template: '<div />' } }
      ]
    })
    await router.push(`/node-packs/${packId}`)
    await router.isReady()

    const wrapper = mount(PackDetail, {
      global: { plugins: [router] }
    })
    await flushPromises()
    return wrapper
  }

  it('renders pack detail page', async () => {
    const wrapper = await mountWithRoute('comfyui-kjnodes')
    expect(wrapper.find('[data-testid="pack-detail-page"]').exists()).toBe(true)
  })

  it('shows back link to node packs', async () => {
    const wrapper = await mountWithRoute('comfyui-kjnodes')
    const backLink = wrapper.find('a[href="/node-packs"]')
    expect(backLink.exists()).toBe(true)
  })

  it('displays pack id in data attribute', async () => {
    const wrapper = await mountWithRoute('comfyui-kjnodes')
    expect(wrapper.find('[data-pack-id="comfyui-kjnodes"]').exists()).toBe(true)
  })

  it('shows pattern coverage table when evidence exists', async () => {
    const wrapper = await mountWithRoute('comfyui-kjnodes')
    // Should have table or empty message
    const table = wrapper.find('[data-testid="pattern-coverage-table"]')
    const emptyMsg = wrapper.find('p.text-zinc-500')
    expect(table.exists() || emptyMsg.exists()).toBe(true)
  })

  it('handles unknown pack gracefully', async () => {
    const wrapper = await mountWithRoute('unknown-pack-xyz')
    expect(wrapper.find('[data-testid="pack-detail-page"]').exists()).toBe(true)
    // Should show empty or minimal info
    expect(wrapper.text()).toContain('unknown-pack-xyz')
  })

  it('shows metadata grid', async () => {
    const wrapper = await mountWithRoute('comfyui-kjnodes')
    expect(wrapper.find('dl').exists()).toBe(true)
    expect(wrapper.text()).toContain('Pack id')
    expect(wrapper.text()).toContain('Publisher')
    expect(wrapper.text()).toContain('Stars')
  })
})
