/**
 * sanitizeHtml — DOMPurify guard at every `v-html` injection site
 * (Wave-19 W19.P4.A).
 *
 * **Threat model today**: the dashboard's `v-html` content originates
 * from in-tree markdown / TypeDoc output authored by Christian. Risk
 * is LOW. **Threat model on the day external content lands**
 * (third-party PR descriptions in `AuditPRDetail`, external markdown
 * mirroring into `src/data/knowledge/`, etc.): risk flips to P0 unless
 * sanitization is already wired. This helper exists so that day is a
 * no-op rather than a scramble.
 *
 * Why DOMPurify: actively maintained, fast (~50KB gzipped), default
 * profile blocks `<script>`, `<style>` (configurable), inline event
 * handlers, `javascript:` URIs, and known XSS bypasses.
 *
 * Why keep heading anchors safe: the `gfm-heading-id` plugin emits
 * `<h2 id="…">…</h2>` — DOMPurify's default allow-list preserves
 * `id` attributes, so deep-links remain functional.
 *
 * Why keep `class="wiki-link"` attributes: same — `class` is in the
 * default allow-list.
 *
 * Performance note: per call the cost is O(size of HTML). All call
 * sites are inside `computed()` blocks, so the cost amortizes across
 * Vue's reactive cache; no per-keystroke re-sanitization.
 */

import DOMPurify from 'dompurify'

/**
 * Sanitize an HTML string with DOMPurify defaults. Returns a string
 * safe for `v-html` injection.
 *
 * Currently a thin wrapper, but centralized so a future tightening
 * (e.g. forbidding `<iframe>` or restricting `target=_blank` without
 * `rel="noopener"`) lands at one call site.
 */
export function sanitizeHtml(html: string): string {
  // DOMPurify in jsdom environments (vitest) returns a TrustedHTML-ish
  // string; coerce explicitly so the return type stays `string`.
  return String(DOMPurify.sanitize(html))
}
