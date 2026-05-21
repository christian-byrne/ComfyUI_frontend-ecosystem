import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Toc, { type TocItem } from '../Toc.vue'

const FIXTURE: TocItem[] = [
  { id: 'intro', title: 'Intro', depth: 2 },
  { id: 'details', title: 'Details', depth: 3 },
  { id: 'wrap-up', title: 'Wrap up', depth: 2 }
]

describe('Toc.vue', () => {
  it('renders one anchor per item with #id href', () => {
    const w = mount(Toc, { props: { items: FIXTURE } })
    // Both desktop + mobile <nav>/<details> each render the link list,
    // so each item produces 2 anchors.
    const anchors = w.findAll('a[href^="#"]')
    expect(anchors.length).toBe(FIXTURE.length * 2)
    const hrefs = new Set(anchors.map((a) => a.attributes('href')))
    expect(hrefs).toEqual(new Set(['#intro', '#details', '#wrap-up']))
  })

  it('renders the title prop in the DOM', () => {
    const w = mount(Toc, {
      props: { items: FIXTURE, title: 'Custom title' }
    })
    expect(w.text()).toContain('Custom title')
  })

  it('defaults the title to "On this page"', () => {
    const w = mount(Toc, { props: { items: FIXTURE } })
    expect(w.text()).toContain('On this page')
  })

  it('renders both desktop and mobile variants', () => {
    const w = mount(Toc, { props: { items: FIXTURE } })
    expect(w.find('[data-testid="toc-desktop"]').exists()).toBe(true)
    expect(w.find('[data-testid="toc-mobile"]').exists()).toBe(true)
    // Mobile variant uses <details> for collapsibility.
    expect(w.find('details').exists()).toBe(true)
  })

  it('marks depth-3 items with extra indentation', () => {
    const w = mount(Toc, { props: { items: FIXTURE } })
    const desktop = w.find('[data-testid="toc-desktop"]')
    const depth3 = desktop.findAll('li[data-depth="3"]')
    expect(depth3).toHaveLength(1)
    // The deeper link should carry a larger left padding utility.
    expect(depth3[0].find('a').classes().join(' ')).toMatch(/pl-6/)
  })

  it('highlights the active item when currentId matches', () => {
    const w = mount(Toc, {
      props: { items: FIXTURE, currentId: 'details' }
    })
    const desktop = w.find('[data-testid="toc-desktop"]')
    const activeAnchor = desktop.find('a[href="#details"]')
    expect(activeAnchor.classes().join(' ')).toMatch(/border-blue-500/)
    expect(activeAnchor.classes().join(' ')).toMatch(/font-medium/)
  })
})
