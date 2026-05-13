import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import EvidenceDrawer from '../EvidenceDrawer.vue'
import type { EvidenceRow } from '@/data/schema'

const mockEvidence: EvidenceRow[] = [
  {
    repo: 'test/repo',
    file: 'src/test.js',
    lines: [10, 15],
    url: 'https://github.com/test/repo/blob/main/src/test.js#L10',
    variant: 'canonical',
    breakage_class: 'silent'
  },
  {
    repo: 'test/repo',
    file: 'src/other.js',
    lines: [42]
  }
]

describe('EvidenceDrawer.vue', () => {
  it('does not render when closed', () => {
    const wrapper = mount(EvidenceDrawer, {
      props: {
        open: false,
        patternId: 'S1.A1',
        pack: 'test/repo',
        evidence: mockEvidence
      }
    })

    expect(wrapper.find('[data-testid="evidence-drawer-root"]').exists()).toBe(
      false
    )
  })

  it('renders when open', () => {
    const wrapper = mount(EvidenceDrawer, {
      props: {
        open: true,
        patternId: 'S1.A1',
        pack: 'test/repo',
        evidence: mockEvidence
      }
    })

    expect(wrapper.find('[data-testid="evidence-drawer-root"]').exists()).toBe(
      true
    )
  })

  it('shows pattern and pack in header', () => {
    const wrapper = mount(EvidenceDrawer, {
      props: {
        open: true,
        patternId: 'S1.A1',
        pack: 'test/repo',
        evidence: mockEvidence
      }
    })

    expect(wrapper.text()).toContain('S1.A1')
    expect(wrapper.text()).toContain('test/repo')
  })

  it('shows evidence count', () => {
    const wrapper = mount(EvidenceDrawer, {
      props: {
        open: true,
        patternId: 'S1.A1',
        pack: 'test/repo',
        evidence: mockEvidence
      }
    })

    expect(wrapper.text()).toContain('2 rows')
  })

  it('shows singular row text for single evidence', () => {
    const wrapper = mount(EvidenceDrawer, {
      props: {
        open: true,
        patternId: 'S1.A1',
        pack: 'test/repo',
        evidence: [mockEvidence[0]]
      }
    })

    expect(wrapper.text()).toContain('1 row')
  })

  it('renders evidence rows', () => {
    const wrapper = mount(EvidenceDrawer, {
      props: {
        open: true,
        patternId: 'S1.A1',
        pack: 'test/repo',
        evidence: mockEvidence
      }
    })

    expect(wrapper.text()).toContain('src/test.js')
    expect(wrapper.text()).toContain('src/other.js')
  })

  it('shows variant and breakage_class badges', () => {
    const wrapper = mount(EvidenceDrawer, {
      props: {
        open: true,
        patternId: 'S1.A1',
        pack: 'test/repo',
        evidence: mockEvidence
      }
    })

    expect(wrapper.text()).toContain('canonical')
    expect(wrapper.text()).toContain('silent')
  })

  it('emits close on close button click', async () => {
    const wrapper = mount(EvidenceDrawer, {
      props: {
        open: true,
        patternId: 'S1.A1',
        pack: 'test/repo',
        evidence: mockEvidence
      }
    })

    await wrapper.find('[data-testid="drawer-close"]').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close on backdrop click', async () => {
    const wrapper = mount(EvidenceDrawer, {
      props: {
        open: true,
        patternId: 'S1.A1',
        pack: 'test/repo',
        evidence: mockEvidence
      }
    })

    await wrapper.find('[data-testid="drawer-backdrop"]').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close on Escape key', async () => {
    const wrapper = mount(EvidenceDrawer, {
      props: {
        open: true,
        patternId: 'S1.A1',
        pack: 'test/repo',
        evidence: mockEvidence
      }
    })

    await wrapper
      .find('[data-testid="evidence-drawer-root"]')
      .trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('shows empty message when no evidence', () => {
    const wrapper = mount(EvidenceDrawer, {
      props: {
        open: true,
        patternId: 'S1.A1',
        pack: 'test/repo',
        evidence: []
      }
    })

    expect(wrapper.text()).toContain('No evidence rows')
  })

  it('links to GitHub when url provided', () => {
    const wrapper = mount(EvidenceDrawer, {
      props: {
        open: true,
        patternId: 'S1.A1',
        pack: 'test/repo',
        evidence: mockEvidence
      }
    })

    const link = wrapper.find('a[href*="github.com"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('target')).toBe('_blank')
  })
})
