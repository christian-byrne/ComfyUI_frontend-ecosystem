import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MarkdownView from '../MarkdownView.vue'

describe('MarkdownView heading id dedupe (W18.N)', () => {
  it('assigns a unique id to each repeated heading within a single render', () => {
    const source = [
      '## Action Items',
      'first',
      '## Action Items',
      'second',
      '## Action Items',
      'third'
    ].join('\n\n')
    const wrapper = mount(MarkdownView, { props: { source } })
    const html = wrapper.html()
    expect(html).toContain('id="action-items"')
    expect(html).toContain('id="action-items-1"')
    expect(html).toContain('id="action-items-2"')
    // No `<h2 id="action-items">` appearing twice.
    const matches = html.match(/id="action-items"/g) ?? []
    expect(matches.length).toBe(1)
  })

  it('resets dedupe state across separate component instances', () => {
    const src1 = '## Hello\n\n## Hello'
    const src2 = '## Hello'
    const w1 = mount(MarkdownView, { props: { source: src1 } })
    const w2 = mount(MarkdownView, { props: { source: src2 } })
    // First mount sees Hello + Hello-1 within itself
    const h1 = w1.html()
    expect(h1).toContain('id="hello"')
    expect(h1).toContain('id="hello-1"')
    // Second mount must NOT continue counting from `hello-2`
    const h2 = w2.html()
    expect(h2).toContain('id="hello"')
    expect(h2).not.toContain('id="hello-1"')
  })

  it('preserves base slug for unique headings', () => {
    const wrapper = mount(MarkdownView, {
      props: { source: '## Background\n\n## Decision\n\n## Consequences' }
    })
    const html = wrapper.html()
    expect(html).toContain('id="background"')
    expect(html).toContain('id="decision"')
    expect(html).toContain('id="consequences"')
  })
})
