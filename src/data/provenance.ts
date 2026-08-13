import type { StarCacheFile } from './schema'
import { behaviorCategories, patterns, totalEvidenceCount } from './index'
import { reauditDelta } from './litegraph-audit-loader'

/**
 * Provenance and staleness facts about the bundled dataset.
 *
 * ## Why this module exists
 *
 * Every number this dashboard renders is smaller than reality, in two
 * independent ways, and neither was visible anywhere in the UI. Someone reading
 * the Overview hero stats would reasonably conclude they were looking at a
 * complete, current picture. They are not. This module is the single source of
 * truth for that caveat so the same wording appears everywhere it matters.
 *
 * The counts on the "here" side are **derived from the bundled data**, never
 * hardcoded — that is the whole point, since hardcoded counts are what went
 * stale in the first place (the root README claimed 59 patterns and 634
 * evidence rows against an actual 73 and 699).
 */
import starCacheData from './touch-points-star-cache.json'

const starCacheFile = starCacheData as StarCacheFile

/**
 * Upstream = the cross-repo research workspace at
 * `~/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api`. This repo is one
 * workspace-amend behind it. These two numbers cannot be derived here — the
 * upstream files are not vendored — so they are asserted, with the specific
 * missing ids listed below to make the claim checkable.
 */
export const UPSTREAM_PATTERN_COUNT = 79
export const UPSTREAM_CATEGORY_COUNT = 42

/** Pattern + category ids that exist upstream and are absent from this bundle. */
export const MISSING_UPSTREAM_IDS: readonly string[] = Object.freeze([
  'S2.N9b',
  'S2.N10b',
  'S3.C3',
  'S4.W9',
  'S4.W10',
  'S4.W11',
  'S18.SER1',
  'S18.SER2',
  'S18.SER3',
  'BC.42'
])

/** Live counts, read from the bundle rather than asserted. */
export const localPatternCount = patterns.length
export const localCategoryCount = behaviorCategories.length
export const localEvidenceCount = totalEvidenceCount
export const localSurfaceFamilyCount = new Set(
  patterns.map((p) => p.surface_family ?? p.pattern_id.split('.')[0])
).size

export const missingPatternCount = UPSTREAM_PATTERN_COUNT - localPatternCount
export const missingCategoryCount = UPSTREAM_CATEGORY_COUNT - localCategoryCount

/**
 * How far the W2F-1 re-audit's consumer counts exceed the baseline evidence
 * counts this dashboard reports.
 *
 * The corrections live in `litegraph-audit.json` under `reauditDelta` and were
 * **never back-propagated** into the touch-points database or the rollup. So
 * `occurrences` — and therefore `blast_radius`, and therefore `usage_weight` —
 * is a floor, not a measurement.
 *
 * Derived, not asserted, so it tracks the audit bundle if that is ever updated.
 */
export const reauditGrowth = (() => {
  const rows = reauditDelta.filter((d) => d.baseline > 0 && d.reauditTotal > d.baseline)
  if (rows.length === 0) {
    return { surfaces: 0, min: 0, max: 0, worst: null as null | string }
  }
  const growths = rows.map((d) => d.reauditTotal / d.baseline)
  const worst = rows.reduce((a, b) =>
    b.reauditTotal / b.baseline > a.reauditTotal / a.baseline ? b : a
  )
  return {
    surfaces: rows.length,
    min: Math.round(Math.min(...growths)),
    max: Math.round(Math.max(...growths)),
    worst: `${worst.surface} ${worst.baseline}→${worst.reauditTotal}`
  }
})()

/** Star-cache staleness floor — see StarCacheFile.asof_oldest. */
export const starCacheAsofOldest = starCacheFile.asof_oldest ?? starCacheFile.asof ?? 'unknown'
export const starCacheAsofNewest = starCacheFile.asof ?? 'unknown'
export const starCacheRepoCount = (starCacheFile.repos ?? []).length

/**
 * Status of the v2 extension API programme. The rewrite is **deferred**; the
 * near-term focus is getting tests running against Nodes 2.0. Anything in this
 * dashboard describing a v1→v2 migration is retained-for-later reference, not
 * current direction.
 */
export const V2_STATUS = {
  deferred: true,
  headline: 'v2 extension API rewrite is deferred',
  detail:
    'Near-term focus is getting tests working against Nodes 2.0. The v1↔v2 ' +
    'migration content here is kept for when the rewrite resumes — it is not ' +
    'a current roadmap.',
  /** The compat-floor gate was retired in wave-10. */
  compatFloorRetired: true,
  compatFloorDetail:
    'The "blast_radius >= 2.0 MUST pass before v2 ships" compat floor was ' +
    'retired in wave-10. Compat floors based on ecosystem-consumer counts ' +
    'conflated evidence that a migration is needed with evidence that a ' +
    'specific surface must exist. Axioms and ADRs are the source of truth for ' +
    'the v2 surface.',
  compatFloorRef: '/handoff/root/axioms'
} as const
