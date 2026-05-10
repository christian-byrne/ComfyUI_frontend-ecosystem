/**
 * Behavior categories loader (W3 — moves to its own page in W4).
 *
 * Reads `research/workspace-mirror/research/touch-points/behavior-categories.yaml`
 * via Vite's `?raw` import so it is bundled at build time alongside the rest
 * of the touch-points data.
 */
import { parse as parseYaml } from 'yaml'

import categoriesRaw from '../../research/workspace-mirror/research/touch-points/behavior-categories.yaml?raw'

export interface BehaviorExemplar {
  pattern_id: string
  repo: string
  url: string
  stars: number
}

export interface BehaviorCategory {
  category_id: string
  name: string
  intent: string
  member_pattern_ids: string[]
  usage_weight: number
  exemplars: BehaviorExemplar[]
  notes?: string
  mechanism?: string
  source?: string
  v1_scope_note?: string
}

interface CategoriesFile {
  meta?: Record<string, unknown>
  categories: BehaviorCategory[]
}

const file = parseYaml(categoriesRaw) as CategoriesFile

export const behaviorCategories: BehaviorCategory[] = file.categories ?? []

/** Behavior categories that include the given pattern_id as a member. */
export const categoriesByPatternId: Record<string, BehaviorCategory[]> = (() => {
  const out: Record<string, BehaviorCategory[]> = {}
  for (const c of behaviorCategories) {
    for (const pid of c.member_pattern_ids ?? []) {
      ;(out[pid] ??= []).push(c)
    }
  }
  return out
})()
