import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Button from '../Button.vue'

describe('Button.vue', () => {
  it('renders the default (primary) variant with the slot label', () => {
    const w = mount(Button, { slots: { default: 'Click' } })
    expect(w.text()).toBe('Click')
    expect(w.element.tagName).toBe('BUTTON')
    expect(w.classes().some(c => /bg-blue-600/.test(c))).toBe(true)
  })

  it('respects variant=ghost (transparent base)', () => {
    const w = mount(Button, {
      props: { variant: 'ghost' },
      slots: { default: 'X' }
    })
    expect(w.classes().some(c => /bg-transparent/.test(c))).toBe(true)
  })

  it('respects variant=secondary (zinc-100 / zinc-800 surface)', () => {
    const w = mount(Button, {
      props: { variant: 'secondary' },
      slots: { default: 'X' }
    })
    expect(w.classes().some(c => /bg-zinc-100/.test(c))).toBe(true)
  })

  it('respects variant=danger (red surface)', () => {
    const w = mount(Button, {
      props: { variant: 'danger' },
      slots: { default: 'X' }
    })
    expect(w.classes().some(c => /bg-red-600/.test(c))).toBe(true)
  })

  it.each(['sm', 'md', 'lg'] as const)('renders size=%s', (size) => {
    const w = mount(Button, { props: { size }, slots: { default: 'x' } })
    // Each size sets a different padding scale; verify a px-* utility lands.
    expect(w.classes().some(c => /^px-/.test(c))).toBe(true)
  })

  it('forwards disabled to the underlying element', () => {
    const w = mount(Button, { props: { disabled: true } })
    expect(w.attributes('disabled')).toBeDefined()
  })

  it('marks itself disabled and shows a spinner when loading', () => {
    const w = mount(Button, {
      props: { loading: true },
      slots: { default: 'Save' }
    })
    expect(w.attributes('disabled')).toBeDefined()
    expect(w.attributes('data-loading')).toBe('true')
    expect(w.find('[data-testid="button-spinner"]').exists()).toBe(true)
  })

  it('defaults type=button so it does not submit a parent form', () => {
    const w = mount(Button)
    expect(w.attributes('type')).toBe('button')
  })

  it('merges caller class via cn() (tailwind-merge wins on conflicts)', () => {
    const w = mount(Button, {
      props: { variant: 'primary' },
      attrs: { class: 'bg-emerald-500' },
      slots: { default: 'x' }
    })
    // tailwind-merge should drop bg-blue-600 in favor of caller's bg-emerald-500.
    const classes = w.classes().join(' ')
    expect(classes).toContain('bg-emerald-500')
    expect(classes).not.toContain('bg-blue-600')
  })
})
