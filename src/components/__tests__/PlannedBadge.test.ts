import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PlannedBadge from '../PlannedBadge.vue'

describe('plannedBadge.vue', () => {
  it('renders the phase-b variant with the expected label and amber classes', () => {
    const wrapper = mount(PlannedBadge, { props: { variant: 'phase-b' } })

    const badge = wrapper.find('[data-testid="planned-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('Phase B')
    expect(badge.classes().join(' ')).toMatch(/amber/)
  })

  it('renders the ecs-pr-11939 variant with the expected label and violet classes', () => {
    const wrapper = mount(PlannedBadge, { props: { variant: 'ecs-pr-11939' } })

    const badge = wrapper.find('[data-testid="planned-badge"]')
    expect(badge.text()).toContain('ECS (PR #11939)')
    expect(badge.classes().join(' ')).toMatch(/violet/)
  })

  it('renders the hypothetical variant with the expected label and zinc classes', () => {
    const wrapper = mount(PlannedBadge, { props: { variant: 'hypothetical' } })

    const badge = wrapper.find('[data-testid="planned-badge"]')
    expect(badge.text()).toContain('Hypothetical')
    expect(badge.classes().join(' ')).toMatch(/zinc/)
  })

  it('renders as a <span> by default (no href)', () => {
    const wrapper = mount(PlannedBadge, { props: { variant: 'phase-b' } })

    const badge = wrapper.find('[data-testid="planned-badge"]')
    expect(badge.element.tagName).toBe('SPAN')
  })

  it('renders as an <a> with the given href when href is provided', () => {
    const wrapper = mount(PlannedBadge, {
      props: {
        variant: 'ecs-pr-11939',
        href: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/11939'
      }
    })

    const badge = wrapper.find('[data-testid="planned-badge"]')
    expect(badge.element.tagName).toBe('A')
    expect(badge.attributes('href')).toBe(
      'https://github.com/Comfy-Org/ComfyUI_frontend/pull/11939'
    )
  })

  it('applies the tooltip via the title attribute when provided', () => {
    const wrapper = mount(PlannedBadge, {
      props: { variant: 'hypothetical', tooltip: 'Illustrative — not yet implemented.' }
    })

    expect(wrapper.find('[data-testid="planned-badge"]').attributes('title')).toBe(
      'Illustrative — not yet implemented.'
    )
  })

  it('applies the tooltip on the link variant too', () => {
    const wrapper = mount(PlannedBadge, {
      props: {
        variant: 'phase-b',
        href: 'https://example.com/adr',
        tooltip: 'See ADR for context.'
      }
    })

    const badge = wrapper.find('[data-testid="planned-badge"]')
    expect(badge.element.tagName).toBe('A')
    expect(badge.attributes('title')).toBe('See ADR for context.')
  })
})
