export interface BehaviorExemplar {
  pattern_id: string
  repo: string
  url: string
  stars: number
  /** Pre-normalisation slug — see EvidenceRow.repo_original in data/schema.ts. */
  repo_original?: string
}

export interface BehaviorCategory {
  category_id: string
  name: string
  intent: string
  notes?: string
  member_pattern_ids: string[]
  /** sum over member patterns of (blast_radius * occurrences). */
  usage_weight: number
  /** Value before the 2026-08 recompute — see data/schema.ts. */
  usage_weight_legacy?: number
  exemplars: BehaviorExemplar[]
}

export interface BehaviorCategoriesFile {
  meta: Record<string, unknown>
  categories: BehaviorCategory[]
}
