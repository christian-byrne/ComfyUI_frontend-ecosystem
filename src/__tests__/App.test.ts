// @vitest-environment happy-dom
/**
 * App.vue smoke test — exercises the chrome (header, nav, dark-mode
 * toggle) so DASH-FB-1 can't silently regress.
 */
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import App from '../App.vue'
import { routes } from '../router'

function makeRouter() {
  // Replace component imports with stubs so the test doesn't need to
  // mount every page — we only care about the chrome.
  const stubbedRoutes: RouteRecordRaw[] = routes.map((r) => ({
    path: r.path,
    name: r.name,
    component: { template: '<div />' },
    meta: r.meta
  }))
  return createRouter({
    history: createMemoryHistory(),
    routes: stubbedRoutes
  })
}

describe('App.vue chrome', () => {
  beforeEach(() => {
    document.documentElement.className = ''
    localStorage.clear()
  })

  afterEach(() => {
    document.documentElement.className = ''
  })

  it('renders the dark-mode toggle and flips the html.dark class', async () => {
    const router = makeRouter()
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [router] } })

    const toggle = wrapper.find('[data-testid="dark-mode-toggle"]')
    expect(toggle.exists()).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    await toggle.trigger('click')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    await toggle.trigger('click')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
