import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Card from '../Card.vue'

describe('Card.vue', () => {
  it('renders the default variant as a <div> with rounded-lg border + elevated bg', () => {
    const w = mount(Card, { slots: { default: 'body' } })
    expect(w.element.tagName).toBe('DIV')
    expect(w.text()).toBe('body')
    const classes = w.classes().join(' ')
    expect(classes).toContain('rounded-lg')
    expect(classes).toMatch(/border-zinc-200/)
    expect(classes).toMatch(/bg-zinc-100/)
  })

  it('variant=sunken drops the border', () => {
    const w = mount(Card, {
      props: { variant: 'sunken' },
      slots: { default: 'x' }
    })
    expect(w.classes().some(c => /border-zinc-200/.test(c))).toBe(false)
    expect(w.classes().some(c => /bg-zinc-50/.test(c))).toBe(true)
  })

  it('variant=outlined keeps the border but drops the bg', () => {
    const w = mount(Card, {
      props: { variant: 'outlined' },
      slots: { default: 'x' }
    })
    const classes = w.classes().join(' ')
    expect(classes).toMatch(/border-zinc-200/)
    expect(classes).not.toMatch(/bg-zinc-100/)
  })

  it.each([
    ['none', ''],
    ['sm', 'p-3'],
    ['md', 'p-4'],
    ['lg', 'p-6']
  ] as const)('padding=%s applies %s', (padding, expected) => {
    const w = mount(Card, { props: { padding }, slots: { default: 'x' } })
    if (expected) {
      expect(w.classes()).toContain(expected)
    } else {
      expect(w.classes().some(c => /^p-\d/.test(c))).toBe(false)
    }
  })

  it.each([
    ['warning', /amber/],
    ['success', /emerald/],
    ['danger', /red/],
    ['planned', /violet/]
  ] as const)('tone=%s paints a left-border accent', (tone, re) => {
    const w = mount(Card, { props: { tone }, slots: { default: 'x' } })
    expect(w.classes().join(' ')).toMatch(re)
    expect(w.classes()).toContain('border-l-4')
  })

  it('respects the `as` prop and renders an <article>', () => {
    const w = mount(Card, { props: { as: 'article' }, slots: { default: 'x' } })
    expect(w.element.tagName).toBe('ARTICLE')
  })

  it('renders header + footer slots when provided', () => {
    const w = mount(Card, {
      slots: {
        header: '<h2>Title</h2>',
        default: 'body',
        footer: '<button>OK</button>'
      }
    })
    expect(w.html()).toContain('<h2>Title</h2>')
    expect(w.text()).toContain('body')
    expect(w.html()).toContain('<button>OK</button>')
  })
})
