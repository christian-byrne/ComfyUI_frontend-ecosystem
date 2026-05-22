/**
 * useMarkdownWithSlugDedupe — shared marked renderer that emits
 * GitHub-compatible heading ids with per-render dedupe (W19.P2+P5).
 *
 * Replaces the hand-rolled `slugify()` + module-level `Map<string,number>`
 * dedupe pattern that lived in `MarkdownView.vue` (W18.M / W18.N) — and
 * was *missing* from `DecisionDetail.vue`'s sibling stateless renderer
 * (real bug surfaced by W19.A11 e2e test #3 documentation).
 *
 * The dedupe is delegated to `marked-gfm-heading-id`, which uses an
 * internal `github-slugger` instance and resets it via marked's
 * `preprocess` hook on every `parse()` call. This makes dedupe correctly
 * scoped per-render across all consumers, even though the marked
 * instance itself is a module singleton.
 *
 * Consumers stay in charge of `<Prose>` vs `prose-zinc` wrapping; this
 * composable owns only the markdown→HTML transform + code highlighting.
 */

import { Marked, type RendererObject } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'

import { highlightCode } from '@/composables/useHighlighter'

/**
 * A scoped marked instance — not the package-level singleton. Avoids
 * stomping on any other call site that might `marked.use(...)` for an
 * unrelated extension. Two consumers in this app share the same scoped
 * instance via the module-level constant below.
 */
const marked = new Marked()

const renderer: RendererObject = {
  code({ text, lang }) {
    return highlightCode(text, lang || 'text')
  },
}

marked.setOptions({ gfm: true, breaks: false })
marked.use({ renderer })
// gfm-heading-id replaces the default heading renderer + resets the
// internal slugger via marked's `preprocess` hook on every parse call,
// so two MarkdownView instances rendering different sources will not
// see id collisions between each other.
marked.use(gfmHeadingId())

/**
 * Composable returning a stable `render(source)` function. All callers
 * share the same scoped marked instance so registration costs are paid
 * once; per-render dedupe is handled by the gfm-heading-id preprocess
 * hook so concurrent consumers cannot pollute each other.
 */
export function useMarkdownWithSlugDedupe() {
  return {
    render(source: string): string {
      return marked.parse(source) as string
    },
  }
}
