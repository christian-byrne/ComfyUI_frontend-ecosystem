/**
 * pattern_id → behavior-category ids, DERIVED from the authoritative join.
 *
 * ## Why this file exists
 *
 * `behavior-categories.json` already carries the join: each category lists its
 * `member_pattern_ids`. That is the only place the mapping is curated, so it is
 * the only place it can be correct.
 *
 * A hand-maintained copy of this map used to live inline in the test-runner
 * composable. It covered 28 of 73 patterns and four of its entries were simply
 * wrong — `S2.N2`→BC.02 (really BC.16), `S2.N4`→BC.04 (really BC.02),
 * `S2.N5`→BC.04 (really BC.22), `S2.N6`→BC.03 (really BC.13). Nothing detected
 * that, because the map's tests only asserted entries that happened to be
 * right. Deriving the map removes the class of bug rather than the four
 * instances.
 *
 * The derivation runs against the JSON import, so Vite resolves it at build
 * time and the map cannot drift from the data it claims to summarise.
 */
import type { BehaviorCategoriesFile, RollupFile } from './schema'
import behaviorCategoriesData from './behavior-categories.json'
import rollupData from './touch-points-rollup.json'

const categoriesFile = behaviorCategoriesData as BehaviorCategoriesFile
const rollupFile = rollupData as RollupFile

/**
 * Invert `category.member_pattern_ids` into `pattern_id -> category_id[]`.
 *
 * A pattern may belong to more than one category, so values are arrays. Both
 * the outer keys and the inner arrays are sorted so the map is deterministic
 * regardless of category ordering in the source file.
 */
function buildPatternToBc(): Readonly<Record<string, string[]>> {
  const out: Record<string, string[]> = {}
  for (const category of categoriesFile.categories ?? []) {
    for (const patternId of category.member_pattern_ids ?? []) {
      ;(out[patternId] ??= []).push(category.category_id)
    }
  }
  for (const ids of Object.values(out)) ids.sort()
  return Object.freeze(
    Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
  )
}

export const PATTERN_TO_BC: Readonly<Record<string, string[]>> = buildPatternToBc()

/**
 * Patterns present in the rollup that no behavior category claims.
 *
 * These are not a bug in the derivation — they are genuinely uncategorised
 * upstream (the S16 security-scan indicators and `S12.UI2` were ingested from
 * sweeps that never assigned a BC). Exported so the gap is a visible, tested
 * number rather than a silent hole in coverage.
 */
export const UNCATEGORISED_PATTERN_IDS: readonly string[] = Object.freeze(
  (rollupFile.patterns ?? [])
    .map((p) => p.pattern_id)
    .filter((id) => !(id in PATTERN_TO_BC))
    .sort()
)

/** Behavior categories for a pattern; empty array when unmapped. */
export function bcForPattern(patternId: string): string[] {
  return PATTERN_TO_BC[patternId] ?? []
}
