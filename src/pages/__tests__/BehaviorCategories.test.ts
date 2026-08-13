import { mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import behaviorCategoriesData from '@/data/behavior-categories.json'
import BehaviorCategories from '../BehaviorCategories.vue'

describe('behaviorCategories grid', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    if (typeof localStorage !== 'undefined') localStorage.clear()
  })

  it('renders one card per behavior category from the data store', () => {
    const wrapper = mount(BehaviorCategories, {
      global: {
        stubs: { RouterLink: RouterLinkStub }
      }
    })

    const cards = wrapper.findAll('[data-test="bc-card"]')
    expect(cards.length).toBe(behaviorCategoriesData.categories.length)
    expect(cards.length).toBe(41)
  })

  it('shows category id, name, pattern count and a stub-coverage trio per card', () => {
    const wrapper = mount(BehaviorCategories, {
      global: { stubs: { RouterLink: RouterLinkStub } }
    })

    const firstCard = wrapper.find('[data-test="bc-card"]')
    expect(firstCard.text()).toContain('BC.01')
    expect(firstCard.findAll('[data-test^="stub-dot-"]').length).toBe(3)
  })

  it('routes each card to the matching category-detail page', () => {
    const wrapper = mount(BehaviorCategories, {
      global: { stubs: { RouterLink: RouterLinkStub } }
    })

    // Scope to the grid. The page also renders a <ProvenanceNotice>, which
    // contains its own RouterLink to the axioms — an unscoped
    // findAllComponents() would return that one first and assert against the
    // wrong link.
    const cards = wrapper.findAll('[data-test="bc-card"]')
    expect(cards.length).toBe(behaviorCategoriesData.categories.length)

    const cardLinks = cards.map((card) => card.findComponent(RouterLinkStub))
    expect(cardLinks[0].props('to')).toMatchObject({
      name: 'category-detail',
      params: { id: 'BC.01' }
    })
    // Every card links to its own category, not just the first.
    for (const [i, link] of cardLinks.entries()) {
      expect(link.props('to')).toMatchObject({
        name: 'category-detail',
        params: { id: behaviorCategoriesData.categories[i].category_id }
      })
    }
  })
})
