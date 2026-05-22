import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import NotFound from '../NotFound.vue'

/**
 * W19.P3 — Dashboard 404 catch-all. Pairs with the
 * `:pathMatch(.*)*` route in `src/router/index.ts` and the e2e
 * smoke check in `e2e/nav-smoke.spec.ts`.
 */

function makeRouter(initialPath: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'overview', component: NotFound },
      { path: '/decisions', name: 'decisions', component: NotFound },
      { path: '/axioms', name: 'axioms', component: NotFound },
      { path: '/glossary', name: 'glossary', component: NotFound },
      { path: '/api-docs', name: 'api-docs', component: NotFound },
      { path: '/handoff', name: 'handoff', component: NotFound },
      { path: '/knowledge-graph', name: 'knowledge-graph', component: NotFound },
      { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFound },
    ],
  })
  router.push(initialPath)
  return router
}

describe('NotFound page (W19.P3)', () => {
  it('renders 404 marker + h1 "Page not found"', async () => {
    const router = makeRouter('/does-not-exist')
    await router.isReady()
    const wrapper = mount(NotFound, {
      global: { plugins: [router] },
    })
    expect(wrapper.find('[data-testid="not-found-page"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('404')
    expect(wrapper.find('h1').text()).toBe('Page not found')
  })

  it('echoes the bad path inside the code element', async () => {
    const router = makeRouter('/this/path/is/wrong')
    await router.isReady()
    const wrapper = mount(NotFound, {
      global: { plugins: [router] },
    })
    const code = wrapper.find('[data-testid="not-found-path"]')
    expect(code.exists()).toBe(true)
    expect(code.text()).toContain('/this/path/is/wrong')
  })

  it('lists curated suggestion links', async () => {
    const router = makeRouter('/x')
    await router.isReady()
    const wrapper = mount(NotFound, {
      global: { plugins: [router] },
    })
    const suggestions = wrapper.find('[data-testid="not-found-suggestions"]')
    expect(suggestions.exists()).toBe(true)
    // At minimum: Overview, Decisions, Axioms, Glossary, API Docs links.
    const links = suggestions.findAll('a')
    expect(links.length).toBeGreaterThanOrEqual(5)
    const hrefs = links.map((a) => a.attributes('href') ?? '')
    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/decisions')
    expect(hrefs).toContain('/axioms')
    expect(hrefs).toContain('/glossary')
    expect(hrefs).toContain('/api-docs')
  })
})
