import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CodeChip from '../CodeChip.vue'

describe('CodeChip.vue', () => {
  it('renders a <code> element with the slot content', () => {
    const w = mount(CodeChip, { slots: { default: 'getNode()' } })
    expect(w.element.tagName).toBe('CODE')
    expect(w.text()).toBe('getNode()')
  })

  it('applies the canonical chip classes (font-mono + zinc surface)', () => {
    const w = mount(CodeChip, { slots: { default: 'x' } })
    const classes = w.classes().join(' ')
    expect(classes).toContain('font-mono')
    expect(classes).toContain('text-xs')
    expect(classes).toMatch(/bg-zinc-100/)
    expect(classes).toMatch(/dark:bg-zinc-800/)
    expect(classes).toContain('rounded')
  })

  it('merges caller class via cn() (tailwind-merge wins on conflicts)', () => {
    const w = mount(CodeChip, {
      attrs: { class: 'bg-amber-100' },
      slots: { default: 'x' }
    })
    const classes = w.classes().join(' ')
    expect(classes).toContain('bg-amber-100')
    expect(classes).not.toContain('bg-zinc-100')
  })
})
