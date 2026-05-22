import { describe, expect, it } from 'vitest'

import { sanitizeHtml } from '../sanitizeHtml'

/**
 * W19.P4.A — DOMPurify guard regression suite.
 *
 * Asserts the guard actually blocks the standard XSS vectors AND
 * preserves the dashboard markup it MUST keep functional
 * (heading ids for deep-links, wiki-link anchors, code highlighting,
 * inline style attributes from shiki).
 */
describe('sanitizeHtml (W19.P4.A)', () => {
  it('strips <script> tags entirely', () => {
    // Note: happy-dom (test env) drops surrounding mixed content when the
    // input contains a top-level <script>; in real browsers DOMPurify keeps
    // siblings. The security guarantee — no <script> content survives —
    // holds in both. We assert only that guarantee here.
    const dirty = '<p>hi</p><script>alert(1)</script><p>bye</p>'
    const clean = sanitizeHtml(dirty)
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('alert(1)')
  })

  it('preserves clean adjacent paragraphs (no script)', () => {
    const dirty = '<p>hi</p><p>bye</p>'
    const clean = sanitizeHtml(dirty)
    expect(clean).toContain('<p>hi</p>')
    expect(clean).toContain('<p>bye</p>')
  })

  it('strips inline event handlers', () => {
    const dirty = '<button onclick="alert(1)">click</button>'
    const clean = sanitizeHtml(dirty)
    expect(clean).not.toMatch(/onclick=/i)
    expect(clean).toContain('<button')
  })

  it('strips javascript: URIs', () => {
    const dirty = '<a href="javascript:alert(1)">x</a>'
    const clean = sanitizeHtml(dirty)
    expect(clean).not.toContain('javascript:')
  })

  it('preserves heading ids (deep-link support)', () => {
    const html = '<h2 id="action-items">Action Items</h2>'
    const clean = sanitizeHtml(html)
    expect(clean).toContain('id="action-items"')
  })

  it('preserves wiki-link class on anchors', () => {
    const html =
      '<a href="/decisions/D14-serialization-convergence" class="wiki-link">D14</a>'
    const clean = sanitizeHtml(html)
    expect(clean).toContain('class="wiki-link"')
    expect(clean).toContain('href="/decisions/D14-serialization-convergence"')
  })

  it('preserves shiki code highlight markup', () => {
    // shiki output: <pre><code><span style="color:#xxx">...</span></code></pre>
    const html =
      '<pre class="shiki"><code><span style="color:#abc">foo</span></code></pre>'
    const clean = sanitizeHtml(html)
    expect(clean).toContain('<pre')
    expect(clean).toContain('<span')
    // style attr preservation isn't strictly required (we could pin colors
    // via class), but DOMPurify's default profile keeps it.
    expect(clean.toLowerCase()).toContain('color')
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('')
  })
})
