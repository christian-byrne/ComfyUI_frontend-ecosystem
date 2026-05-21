import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Badge from '../Badge.vue'

describe('Badge.vue', () => {
  it('renders the slot label as a <span> by default', () => {
    const w = mount(Badge, { slots: { default: 'NEW' } })
    expect(w.text()).toBe('NEW')
    expect(w.element.tagName).toBe('SPAN')
  })

  it('renders as <a> when an href is given', () => {
    const w = mount(Badge, {
      props: { href: 'https://example.com' },
      slots: { default: 'link' }
    })
    expect(w.element.tagName).toBe('A')
    expect(w.attributes('href')).toBe('https://example.com')
  })

  it.each([
    ['neutral', /zinc/],
    ['success', /emerald/],
    ['warning', /amber/],
    ['danger', /red/],
    ['planned', /violet/]
  ] as const)('variant=%s paints %s classes', (variant, re) => {
    const w = mount(Badge, {
      props: { variant },
      slots: { default: variant }
    })
    expect(w.classes().join(' ')).toMatch(re)
  })

  it('exposes variant via data-variant for selector use', () => {
    const w = mount(Badge, {
      props: { variant: 'success' },
      slots: { default: 'ok' }
    })
    expect(w.attributes('data-variant')).toBe('success')
  })

  it('renders size=sm without the xs uppercase tracking', () => {
    const w = mount(Badge, {
      props: { size: 'sm' },
      slots: { default: 'x' }
    })
    expect(w.classes().some(c => /text-xs/.test(c))).toBe(true)
    expect(w.classes().some(c => /uppercase/.test(c))).toBe(false)
  })
})
