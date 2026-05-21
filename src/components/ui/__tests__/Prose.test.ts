import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Prose from '../Prose.vue'

describe('Prose.vue', () => {
  it('renders html prop with heading id + paragraph', () => {
    const w = mount(Prose, {
      props: { html: '<h2 id="x">Foo</h2><p>Body</p>' }
    })
    const h2 = w.find('h2#x')
    expect(h2.exists()).toBe(true)
    expect(h2.text()).toBe('Foo')
    expect(w.find('p').text()).toBe('Body')
    expect(w.classes()).toContain('prose-comfy')
  })

  it('applies the drop-cap class when :dropCap is set', () => {
    const w = mount(Prose, {
      props: { html: '<p>Once upon a time…</p>', dropCap: true }
    })
    expect(w.classes()).toContain('prose-comfy--dropcap')
  })

  it('omits the drop-cap class by default', () => {
    const w = mount(Prose, { props: { html: '<p>Plain</p>' } })
    expect(w.classes()).not.toContain('prose-comfy--dropcap')
  })

  it('renders default slot content when no html prop is given', () => {
    const w = mount(Prose, {
      slots: { default: '<p data-testid="slotted">Hello</p>' }
    })
    expect(w.find('[data-testid="slotted"]').exists()).toBe(true)
    expect(w.text()).toContain('Hello')
  })

  it('applies the compact density class when :density="compact"', () => {
    const w = mount(Prose, {
      props: { html: '<p>x</p>', density: 'compact' }
    })
    expect(w.classes()).toContain('prose-comfy--compact')
  })

  it('uses comfortable density by default', () => {
    const w = mount(Prose, { props: { html: '<p>x</p>' } })
    expect(w.classes()).toContain('prose-comfy--comfortable')
  })

  it('supports maxWidth=full to drop max-w-prose', () => {
    const w = mount(Prose, {
      props: { html: '<p>x</p>', maxWidth: 'full' }
    })
    expect(w.classes()).toContain('max-w-none')
    expect(w.classes()).not.toContain('max-w-prose')
  })
})
