// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createHead } from '@unhead/vue/client'

import Decisions from './Decisions.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'overview', component: { template: '<div />' } },
    { path: '/decisions', name: 'decisions', component: Decisions },
    {
      path: '/decisions/:slug',
      name: 'decision-detail',
      component: { template: '<div />' }
    }
  ]
})

describe('Decisions page', () => {
  it('renders the synced ADR list with the result count chip', async () => {
    const head = createHead()
    const wrapper = mount(Decisions, {
      global: { plugins: [router, head] }
    })
    await router.isReady()

    const count = wrapper.find('[data-testid="decisions-result-count"]')
    expect(count.exists()).toBe(true)
    // "Showing N of M decisions" — both N and M should be the same when no
    // filter is applied AND > 10 (we know the workspace has 40+ ADRs).
    expect(count.text()).toMatch(/Showing (\d+) of \1 decisions/)
    const total = Number(count.text().match(/Showing (\d+)/)![1])
    expect(total).toBeGreaterThan(10)
  })

  it('renders at least one decision link with a slug starting with d', async () => {
    const head = createHead()
    const wrapper = mount(Decisions, {
      global: { plugins: [router, head] }
    })
    await router.isReady()
    const links = wrapper.findAll('[data-testid="decisions-list"] a')
    expect(links.length).toBeGreaterThan(0)
    expect(links[0].text().toLowerCase()).toMatch(/^d/)
  })
})
