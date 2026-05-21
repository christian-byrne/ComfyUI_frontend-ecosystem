/**
 * Pure helpers for `DecisionDetail.vue` (Wave-18 W18.H).
 * Extracted into a `.ts` module so they're importable from the
 * test file — Vue `<script setup>` doesn't allow re-exports.
 */

import type { ManifestEntry } from '@/data/knowledge-loader'

export type BadgeVariant = 'success' | 'warning' | 'neutral' | 'danger'

/**
 * Map an ADR status (`accepted`, `proposed`, `superseded`, etc.) to a
 * `Badge.vue` semantic variant. Tolerates any casing and matches via
 * substring, so legacy non-normalised values still colour-code sanely.
 */
export function statusVariant(status: string | null | undefined): BadgeVariant {
  if (!status) return 'neutral'
  const s = status.toUpperCase()
  if (s.includes('ACCEPTED')) return 'success'
  if (s.includes('PROPOSED') || s.includes('DRAFT')) return 'warning'
  if (s.includes('SUPERSEDED') || s.includes('REJECTED') || s.includes('DEPRECATED'))
    return 'danger'
  return 'neutral'
}

/**
 * Wrap the H2-delimited "Decision" and "Consequences" sections in
 * `<div class="adr-callout adr-callout-{decision,consequences}">`
 * blocks. Operates on the post-`marked.parse` HTML string so the
 * matching styles in `DecisionDetail.vue` can paint them.
 *
 * Anchors on the `id` attribute (slugified heading text) rather than
 * the visible heading text — so "Decision summary" still gets the
 * callout treatment as long as the id slugifies to `decision`.
 */
export function wrapCallouts(html: string): string {
  return html.replace(
    /<h2 id="(decision|consequences)">([\s\S]*?<\/h2>)([\s\S]*?)(?=<h2 |<\/article>|$)/gi,
    (_match, id: string, headingTail: string, content: string) => {
      const k = id.toLowerCase()
      return `<div class="adr-callout adr-callout-${k}"><h2 id="${k}">${headingTail}${content}</div>`
    }
  )
}

/**
 * "Related decisions" picker — other ADRs that share at least one
 * axiom-ref with the current one and aren't already linked via
 * supersedes/superseded-by. Sorted by overlap count, then slug.
 * Capped at `limit` to keep the sidebar compact.
 */
export function pickRelatedDecisions(
  current: ManifestEntry,
  all: readonly ManifestEntry[],
  limit = 5
): ManifestEntry[] {
  const ourAxioms = new Set(current.axioms)
  if (!ourAxioms.size) return []
  const ourLinks = new Set<string>([...(current.supersedes ?? []), ...(current.supersededBy ?? [])])
  return all
    .filter((d) => d.slug !== current.slug && !ourLinks.has(d.slug))
    .map((d) => ({
      entry: d,
      overlap: d.axioms.filter((a) => ourAxioms.has(a)).length
    }))
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.entry.slug.localeCompare(b.entry.slug))
    .slice(0, limit)
    .map((x) => x.entry)
}
