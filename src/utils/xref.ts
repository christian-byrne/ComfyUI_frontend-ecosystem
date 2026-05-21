/**
 * xref — small helpers for detecting cross-references between
 * named knowledge entities (Wave-18 W18.G).
 *
 * Currently scoped to axiom IDs (`A1`..`A16`) used by `/axioms`,
 * but the shape is reusable for ADRs (`D1`..) and waves (`W1`..)
 * when those need similar back-linking UX.
 */

/**
 * Matches `A1` through `A16` as standalone tokens.
 * Anchored with `\b` to avoid matching variable names like `axiomA1Spec`.
 */
const AXIOM_RE = /\b(A1[0-6]|A[1-9])\b/g

/**
 * Extract every axiom ID that appears in `body` other than `selfId`.
 * Returned IDs are de-duplicated and sorted by numeric index
 * (A1, A2, … A14, A15, A16).
 *
 * @param body   Raw markdown / plain text to scan.
 * @param selfId Axiom whose body we're scanning — excluded from results.
 */
export function detectAxiomRefs(body: string, selfId: string): string[] {
  const found = new Set<string>()
  for (const match of body.matchAll(AXIOM_RE)) {
    const id = match[1]
    if (id !== selfId) found.add(id)
  }
  return [...found].sort((a, b) => {
    const na = Number.parseInt(a.slice(1), 10)
    const nb = Number.parseInt(b.slice(1), 10)
    return na - nb
  })
}
