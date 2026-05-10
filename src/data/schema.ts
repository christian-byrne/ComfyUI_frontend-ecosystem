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
