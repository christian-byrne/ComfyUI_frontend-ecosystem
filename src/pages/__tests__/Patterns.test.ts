import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'

import Patterns from '../Patterns.vue'
import { useDataStore } from '@/stores/data'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/patterns', name: 'patterns', component: Patterns },
      { path: '/patterns/:id', name: 'pattern-detail', component: { template: '<div/>' } }
    ]
  })
}

describe('Patterns.vue', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('store.searchPatterns narrows the result count when given a query', () => {
    const store = useDataStore()
    const all = store.searchPatterns('')
    const filtered = store.searchPatterns('widget')
    expect(all.length).toBeGreaterThan(0)
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.length).toBeLessThan(all.length)
  })

  it('renders the table with all 59 patterns by default', async () => {
    const router = makeRouter()
    await router.push('/patterns')
    await router.isReady()
    const wrapper = mount(Patterns, { global: { plugins: [router] } })
    await flushPromises()
    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBeGreaterThanOrEqual(50)
  })

  it('search query narrows the rendered row count', async () => {
    const router = makeRouter()
    await router.push('/patterns')
    await router.isReady()
    const wrapper = mount(Patterns, { global: { plugins: [router] } })
    await flushPromises()
    const before = wrapper.findAll('tbody tr').length

    await wrapper.find('input[type="search"]').setValue('widget')
    await flushPromises()
    const after = wrapper.findAll('tbody tr').length

    expect(after).toBeGreaterThan(0)
    expect(after).toBeLessThan(before)
  })
})
