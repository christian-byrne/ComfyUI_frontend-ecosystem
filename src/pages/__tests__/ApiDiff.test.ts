import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'

import ApiDiff from '../ApiDiff.vue'
import { migrationEntries } from '@/data/migration-status'

/**
 * Mount-test for the ApiDiff page (N16b). Uses the real W2 data loader
 * + scaffolded MIGRATION_STATUS map (no mocking) so the test catches
 * drift between the touch-points YAML and the page contract.
 */
describe('ApiDiff.vue (N16b)', () => {
  function mountPage() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/api-diff', name: 'api-diff', component: ApiDiff }]
    })
    router.push('/api-diff')
    return router
      .isReady()
      .then(() => mount(RouterView, { global: { plugins: [router] } }))
  }

  it('renders one card per migration entry with v1/v2 columns and a status badge', async () => {
    const wrapper = await mountPage()

    expect(wrapper.find('[data-testid="api-diff-page"]').exists()).toBe(true)

    const cards = wrapper.findAll('[data-testid="api-diff-card"]')
    expect(cards.length).toBe(migrationEntries.length)
    expect(cards.length).toBeGreaterThan(0)

    // First card should expose v1 + v2 + status badge.
    const first = cards[0]
    expect(first.find('[data-testid="api-diff-v1"]').exists()).toBe(true)
    expect(first.find('[data-testid="api-diff-v2"]').exists()).toBe(true)
    expect(first.find('[data-testid="api-diff-status-badge"]').exists()).toBe(
      true
    )
  })

  it('renders the search, picker, and status-chip controls', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="api-diff-search"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="api-diff-picker"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="api-diff-status-chips"]').exists()
    ).toBe(true)
  })

  it('filters cards by the search query', async () => {
    const wrapper = await mountPage()

    const target = migrationEntries[0]
    await wrapper
      .find('[data-testid="api-diff-search"]')
      .setValue(target.id)

    const cards = wrapper.findAll('[data-testid="api-diff-card"]')
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      expect(card.text()).toContain(target.id)
    }
  })

  it('shows an empty state when no patterns match', async () => {
    const wrapper = await mountPage()
    await wrapper
      .find('[data-testid="api-diff-search"]')
      .setValue('definitely-no-such-pattern-zzz')
    expect(wrapper.find('[data-testid="api-diff-empty"]').exists()).toBe(true)
  })
})
