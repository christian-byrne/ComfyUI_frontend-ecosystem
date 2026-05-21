import { describe, expect, it } from 'vitest'

// @ts-expect-error — script is plain ESM .mjs, not a typed TS module
import { autoLink } from '../../../scripts/wiki-link-mdx.mjs'

const MAP = new Map([
  ['WidgetHandle', '/api-docs/widgethandle'],
  ['defineExtension', '/api-docs/defineextension'],
  ['A1', '/axioms#a1-refs'],
  ['D14', '/decisions/D14-serialization-convergence'],
])

describe('wiki-link-mdx autoLink', () => {
  it('wraps a bare symbol in plain text', () => {
    const { content, replacements } = autoLink(
      'See WidgetHandle for details.',
      MAP
    )
    expect(replacements).toBe(1)
    expect(content).toContain(
      '<a href="/api-docs/widgethandle" class="wiki-link">WidgetHandle</a>'
    )
  })

  it('skips matches inside fenced code blocks', () => {
    const input = '```ts\nWidgetHandle\n```'
    const { content, replacements } = autoLink(input, MAP)
    expect(replacements).toBe(0)
    expect(content).toBe(input)
  })

  it('skips matches inside inline code', () => {
    const input = 'Use `WidgetHandle` carefully.'
    const { content, replacements } = autoLink(input, MAP)
    expect(replacements).toBe(0)
    expect(content).toBe(input)
  })

  it('skips matches inside existing markdown link', () => {
    const input = '[WidgetHandle](/x) is here.'
    const { content, replacements } = autoLink(input, MAP)
    expect(replacements).toBe(0)
    expect(content).toBe(input)
  })

  it('is idempotent (no double-link on second run)', () => {
    const first = autoLink('See WidgetHandle and WidgetHandle again.', MAP)
    const second = autoLink(first.content, MAP)
    expect(second.replacements).toBe(0)
    expect(second.content).toBe(first.content)
  })

  it('caps replacements per symbol per file', () => {
    const input = Array(10).fill('WidgetHandle is good.').join(' ')
    const { replacements } = autoLink(input, MAP)
    expect(replacements).toBe(3) // PER_SYMBOL_CAP
  })

  it('does NOT replace inside frontmatter', () => {
    const input = '---\ntitle: "WidgetHandle"\n---\n\nBody mentions WidgetHandle.'
    const { content, replacements } = autoLink(input, MAP)
    expect(replacements).toBe(1)
    expect(content).toMatch(/title: "WidgetHandle"/)
    expect(content).toMatch(
      /Body mentions <a href="\/api-docs\/widgethandle" class="wiki-link">WidgetHandle<\/a>/
    )
  })

  it('matches axiom IDs at word boundaries', () => {
    const { replacements } = autoLink('Per A1 this is invalid.', MAP)
    expect(replacements).toBe(1)
  })

  it('matches ADR IDs at word boundaries', () => {
    const { replacements } = autoLink('See D14 for context.', MAP)
    expect(replacements).toBe(1)
  })

  it('prefers longer symbols when overlapping', () => {
    const map = new Map([
      ['define', '/short'],
      ['defineExtension', '/long'],
    ])
    const { content } = autoLink('Call defineExtension now.', map)
    expect(content).toContain('href="/long"')
    expect(content).not.toContain('href="/short"')
  })
})
