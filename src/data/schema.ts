import { z } from 'zod'

// ───────────────────────────────────────────────────────────────────────
// Evidence row (one row of clone-and-grep / MCP search evidence)
// ───────────────────────────────────────────────────────────────────────
export const EvidenceRowSchema = z.object({
  pattern_id: z.string().optional(),
  repo: z.string(),
  file: z.string(),
  lines: z.array(z.number()).optional(),
  url: z.string().url().optional(),
  variant: z.string().optional(),
  breakage_class: z.string().optional(),
  excerpt: z.string().optional(),
  matched_regex: z.string().optional(),
  notes: z.string().optional(),
  rule: z.string().optional(),
  source: z.string().optional()
})

export type EvidenceRow = z.infer<typeof EvidenceRowSchema>

// ───────────────────────────────────────────────────────────────────────
// Pattern (touch-points-database.yaml)
// ───────────────────────────────────────────────────────────────────────
export const PatternSchema = z.object({
  pattern_id: z.string(),
  surface_family: z.string(),
  surface: z.string(),
  fingerprint: z.string().optional(),
  semantic: z.string().optional(),
  v2_replacement: z.string().optional(),
  decision_ref: z.string().optional(),
  test_target: z.string().optional(),
  evidence: z.array(EvidenceRowSchema).default([]),
  evidence_status: z.string().optional(),
  candidate_for_removal: z.boolean().optional(),
  canonical_signatures: z.array(z.unknown()).optional(),
  derived: z.unknown().optional(),
  lifecycle_coupling: z.unknown().optional(),
  notes: z.string().optional(),
  severity: z.string().optional()
})

export type Pattern = z.infer<typeof PatternSchema>

export const PatternFileSchema = z.object({
  meta: z.record(z.unknown()).optional(),
  patterns: z.array(PatternSchema)
})

// ───────────────────────────────────────────────────────────────────────
// Rollup entry (touch-points-rollup.yaml)
// ───────────────────────────────────────────────────────────────────────
export const TopRepoSchema = z.object({
  repo: z.string(),
  stars: z.number()
})

export type TopRepo = z.infer<typeof TopRepoSchema>

export const RollupEntrySchema = z.object({
  pattern_id: z.string(),
  surface_family: z.string(),
  name: z.string(),
  occurrences: z.number(),
  unique_repos: z.number(),
  cumulative_stars: z.number(),
  signature_count: z.number(),
  silent_breakage: z.number(),
  lifecycle_coupling: z.number(),
  blast_radius: z.number(),
  top_repos: z.array(TopRepoSchema).default([])
})

export type RollupEntry = z.infer<typeof RollupEntrySchema>

export const RollupFileSchema = z.object({
  meta: z.record(z.unknown()).optional(),
  patterns: z.array(RollupEntrySchema)
})

// ───────────────────────────────────────────────────────────────────────
// Star cache (touch-points-star-cache.yaml)
// ───────────────────────────────────────────────────────────────────────
export const StarCacheEntrySchema = z.object({
  repo: z.string(),
  stars: z.number(),
  archived: z.boolean().optional(),
  forks: z.number().optional(),
  last_commit: z.string().optional(),
  asof: z.string().optional()
})

export type StarCacheEntry = z.infer<typeof StarCacheEntrySchema>

export const StarCacheFileSchema = z.object({
  asof: z.string().optional(),
  populated_via: z.string().optional(),
  repos: z.array(StarCacheEntrySchema)
})

// ───────────────────────────────────────────────────────────────────────
// Behavior categories (behavior-categories.yaml)
// ───────────────────────────────────────────────────────────────────────
export const BehaviorExemplarSchema = z.object({
  pattern_id: z.string(),
  repo: z.string(),
  url: z.string().url(),
  stars: z.number()
})

export type BehaviorExemplar = z.infer<typeof BehaviorExemplarSchema>

export const BehaviorCategorySchema = z.object({
  category_id: z.string(),
  name: z.string(),
  intent: z.string(),
  member_pattern_ids: z.array(z.string()),
  usage_weight: z.number(),
  exemplars: z.array(BehaviorExemplarSchema).default([]),
  notes: z.string().optional(),
  mechanism: z.string().optional(),
  source: z.string().optional(),
  v1_scope_note: z.string().optional()
})

export type BehaviorCategory = z.infer<typeof BehaviorCategorySchema>

export const BehaviorCategoriesFileSchema = z.object({
  meta: z.record(z.unknown()).optional(),
  categories: z.array(BehaviorCategorySchema)
})
