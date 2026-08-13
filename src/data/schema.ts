/**
 * Hand-authored TypeScript types for the touch-points research bundle.
 *
 * These mirror the shapes in `research/touch-points-database.yaml` and
 * `research/touch-points-rollup.yaml`. Fields are intentionally permissive
 * (`?: optional`) because the YAML evolves through sweeps and we want loaders
 * to stay forward-compatible — schema drift fails loud at the page-level, not
 * at the import boundary.
 */

export interface EvidenceRow {
  /** Backfilled at load time when missing from the source row. */
  pattern_id?: string
  repo: string
  /**
   * Pre-normalisation slug, set by scripts/normalize-repo-slugs.py when a bare
   * or fork slug was rewritten to its canonical upstream. Kept so the
   * MCP-code-search vs clone-and-grep provenance stays answerable (issue #30).
   */
  repo_original?: string
  file: string
  lines?: number[]
  url?: string
  variant?: string
  breakage_class?: string
  excerpt?: string
  matched_regex?: string
  notes?: string
  rule?: string
  source?: string
}

export interface Pattern {
  pattern_id: string
  surface_family: string
  surface: string
  fingerprint?: string
  semantic?: string
  v2_replacement?: string
  decision_ref?: string
  test_target?: string
  evidence: EvidenceRow[]
  evidence_status?: string
  candidate_for_removal?: boolean
  notes?: string
  severity?: string
}

export interface PatternFile {
  meta?: Record<string, unknown>
  patterns: Pattern[]
}

export interface TopRepo {
  repo: string
  stars: number
  /** See EvidenceRow.repo_original. */
  repo_original?: string
}

export interface RollupEntry {
  pattern_id: string
  surface_family: string
  name: string
  occurrences: number
  unique_repos: number
  cumulative_stars: number
  signature_count: number
  silent_breakage: number
  lifecycle_coupling: number
  blast_radius: number
  top_repos: TopRepo[]
}

export interface RollupFile {
  meta?: Record<string, unknown>
  patterns: RollupEntry[]
}

export interface BehaviorExemplar {
  pattern_id: string
  repo: string
  url: string
  stars: number
  /** See EvidenceRow.repo_original. */
  repo_original?: string
}

export interface BehaviorCategory {
  category_id: string
  name: string
  intent: string
  member_pattern_ids: string[]
  /** sum over member patterns of (blast_radius * occurrences). */
  usage_weight: number
  /**
   * The value `usage_weight` held before the 2026-08 recompute. Preserved by
   * scripts/recompute-usage-weights.py so the historical (wrong) ranking stays
   * auditable — 11 categories were a placeholder 0.00 because they post-dated
   * the last run of the never-vendored generator.
   */
  usage_weight_legacy?: number
  exemplars?: BehaviorExemplar[]
  notes?: string
  mechanism?: string
  source?: string
  v1_scope_note?: string
}

export interface BehaviorCategoriesFile {
  meta?: Record<string, unknown>
  categories: BehaviorCategory[]
}

export interface StarCacheEntry {
  repo: string
  stars: number
  archived?: boolean
  forks?: number
  last_commit?: string
  asof?: string
}

export interface StarCacheFile {
  /** Newest row — when the cache was last touched at all. */
  asof?: string
  /**
   * Oldest row — the staleness *floor*. A targeted backfill of one repo moves
   * `asof` forward while leaving the rest months old, so `asof` alone reads as
   * fresher than the data is. Prefer this when reporting staleness.
   */
  asof_oldest?: string
  populated_via?: string
  repos: StarCacheEntry[]
}
