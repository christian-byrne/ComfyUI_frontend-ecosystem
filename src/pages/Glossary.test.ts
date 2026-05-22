// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createHead } from '@unhead/vue/client'

/**
 * Wave-19 W19.A3 — Glossary page tests.
 *
 * Three guarantees:
 *  1. All ≥14 glossary terms render as h2 headings (mounted from real
 *     synced content — drift catch if the workspace glossary loses
 *     entries).
 *  2. The markdown renderer is wired (each entry has a **Definition**
 *     bold label that surfaces as a `<strong>` in the DOM).
 *  3. The page does NOT crash when the manifest has no glossary entry
 *     and `getRootBody('glossary')` returns undefined — the empty-state
 *     fallback covers the pre-sync race.
 */

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'overview', component: { template: '<div />' } },
    { path: '/axioms', name: 'axioms', component: { template: '<div />' } },
    { path: '/decisions', name: 'decisions', component: { template: '<div />' } },
    {
      path: '/glossary',
      name: 'glossary',
      component: { template: '<div />' }
    }
  ]
})

describe('glossary page (W19.A3)', () => {
  it('renders all ≥14 glossary terms as h2 headings', async () => {
    const head = createHead()
    const Glossary = (await import('./Glossary.vue')).default
    const wrapper = mount(Glossary, {
      global: { plugins: [router, head] }
    })
    await router.isReady()
    // Allow MarkdownView's `marked.parse` to flush.
    await wrapper.vm.$nextTick()

    const h2s = wrapper.findAll('article[data-testid="glossary-content"] h2')
    expect(
      h2s.length,
      'glossary must publish at least 14 terms (current baseline)'
    ).toBeGreaterThanOrEqual(14)
  })

  it('renders markdown bold labels (per-entry **Definition** etc.)', async () => {
    const head = createHead()
    const Glossary = (await import('./Glossary.vue')).default
    const wrapper = mount(Glossary, {
      global: { plugins: [router, head] }
    })
    await router.isReady()
    await wrapper.vm.$nextTick()

    const content = wrapper.find('article[data-testid="glossary-content"]')
    expect(content.exists()).toBe(true)
    // Every glossary entry uses **Definition** / **Example** / **Non-example** /
    // **Cross-refs** — verify at least one bold label rendered as <strong>.
    const strongs = content.findAll('strong')
    expect(strongs.length).toBeGreaterThanOrEqual(14)
    const strongTexts = strongs.map((s) => s.text())
    expect(strongTexts).toContain('Definition')
  })

  it('renders empty-state when the manifest has no glossary entry', async () => {
    // Reset module registry so the dynamic mock fully replaces the loader
    // for this single test without bleeding into the others above.
    vi.resetModules()
    vi.doMock('@/data/knowledge-loader', () => ({
      getRootBody: (_slug: string) => undefined,
      manifest: {
        root: [],
        decisions: [],
        announcements: [],
        axiomIndex: {},
        axiomBacklinks: {}
      },
      allAxioms: []
    }))
    const head = createHead()
    const Glossary = (await import('./Glossary.vue')).default
    const wrapper = mount(Glossary, {
      global: { plugins: [router, head] }
    })
    await router.isReady()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="glossary-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="glossary-content"]').exists()).toBe(false)
    // Critical: the page mounted without throwing.
    expect(wrapper.find('h1').text()).toBe('Glossary')

    vi.doUnmock('@/data/knowledge-loader')
  })
})
