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

describe('MarkdownView heading id dedupe — W19.A11 regression coverage', () => {
  // Wave-19 W19.A11 — deeper regression around the W18.M production bug
  // (DrJKL noticed `### Action Items` collided 6× on D13-ecs-alignment-audit).
  it('generates unique ids for 6 identical "### Action Items" headings', () => {
    const source = Array.from({ length: 6 })
      .map((_, i) => `### Action Items\n\nbody-${i}`)
      .join('\n\n')
    const wrapper = mount(MarkdownView, { props: { source } })
    const html = wrapper.html()
    const expected = [
      'id="action-items"',
      'id="action-items-1"',
      'id="action-items-2"',
      'id="action-items-3"',
      'id="action-items-4"',
      'id="action-items-5"'
    ]
    for (const id of expected) {
      expect(html, `should contain ${id}`).toContain(id)
    }
    // Each id appears exactly once.
    for (const id of expected) {
      const matches = html.match(new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []
      expect(matches.length, `${id} should be unique`).toBe(1)
    }
    // No 7th index (no `action-items-6`) — only 6 headings, last should be -5.
    expect(html).not.toContain('id="action-items-6"')
  })

  it('generates valid kebab-case id for heading with unicode + special chars', () => {
    // Current slugify (MarkdownView.vue): `.replace(/[^\w\s-]/g, '')` strips
    // unicode + punctuation (JS \w without /u flag = [A-Za-z0-9_]); spaces
    // collapse to `-`. So `### Hé éé! Foo & Bar` → `h-foo-bar`.
    const wrapper = mount(MarkdownView, {
      props: { source: '### Hé éé! Foo & Bar' }
    })
    const html = wrapper.html()
    const idMatch = html.match(/<h3 id="([^"]+)"/)
    expect(idMatch, 'h3 should have an id attribute').not.toBeNull()
    const id = idMatch![1]
    expect(id.length, 'slug must be non-empty').toBeGreaterThan(0)
    // W19.P2 — switched to `marked-gfm-heading-id` (github-slugger).
    // Unicode letters are PRESERVED (matches GitHub's actual behavior:
    // `### Hé éé! Foo & Bar` → `id="hé-éé-foo--bar"`). Previously the
    // hand-rolled slugify stripped non-ASCII via `/[^\w\s-]/g` (no /u
    // flag) — that lost information. The new slug is URL-safe but no
    // longer kebab-restricted-ASCII; doubled hyphens around the dropped
    // `&` are expected github-slugger behavior.
    expect(id, 'slug must be URL-safe').not.toMatch(/[\s<>"'&]/)
    expect(id, 'unicode letters preserved').toContain('hé')
    expect(id, 'unicode letters preserved').toContain('éé')
  })

  it('dedupe state resets across mount/unmount/remount cycle', () => {
    // W19.P2 — dedupe is now delegated to `marked-gfm-heading-id`,
    // whose `preprocess` hook resets the internal `github-slugger`
    // before every `marked.parse()` call (see
    // useMarkdownWithSlugDedupe). A fresh mount triggers a fresh
    // computed which calls render() which calls parse() which resets
    // — so unmount/remount with the same source must produce
    // `action-items` (NOT `action-items-1`). Regression guard: if
    // anyone replaces the plugin with a non-resetting implementation
    // OR forgets to call `parse()` per render, this catches it.
    const source = '### Action Items\n\nbody'

    const w1 = mount(MarkdownView, { props: { source } })
    expect(w1.html(), 'first mount: base slug').toContain('id="action-items"')
    expect(w1.html(), 'first mount: no suffix').not.toContain('id="action-items-1"')
    w1.unmount()

    const w2 = mount(MarkdownView, { props: { source } })
    expect(w2.html(), 'second mount: base slug (Map was reset)').toContain('id="action-items"')
    expect(w2.html(), 'second mount: no leaked suffix').not.toContain('id="action-items-1"')
    w2.unmount()
  })
})
