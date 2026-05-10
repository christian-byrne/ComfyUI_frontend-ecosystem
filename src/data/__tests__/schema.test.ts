import { describe, expect, it } from 'vitest'

import {
  behaviorCategories,
  patterns,
  rollup,
  starCache
} from '@/data'
import {
  BehaviorCategorySchema,
  PatternSchema,
  RollupEntrySchema,
  StarCacheEntrySchema
} from '@/data/schema'

describe('data: yaml -> zod schema -> typed modules', () => {
  it('loads exactly 59 patterns from touch-points-database.yaml', () => {
    expect(patterns).toHaveLength(59)
  })

  it('loads exactly 634 evidence rows across all patterns', () => {
    const total = patterns.reduce((acc, p) => acc + p.evidence.length, 0)
    expect(total).toBe(634)
  })

  it('loads exactly 41 behavior categories', () => {
    expect(behaviorCategories).toHaveLength(41)
  })

  it('rollup has the same pattern count as the database', () => {
    expect(rollup).toHaveLength(patterns.length)
  })

  it('star cache has at least one entry and is a record keyed by repo', () => {
    expect(Object.keys(starCache).length).toBeGreaterThan(0)
    for (const [key, entry] of Object.entries(starCache)) {
      expect(entry.repo).toBe(key)
    }
  })

  it('every loaded pattern revalidates against PatternSchema', () => {
    for (const p of patterns) {
      expect(() => PatternSchema.parse(p)).not.toThrow()
    }
  })

  it('every rollup entry revalidates against RollupEntrySchema', () => {
    for (const r of rollup) {
      expect(() => RollupEntrySchema.parse(r)).not.toThrow()
    }
  })

  it('every category revalidates against BehaviorCategorySchema', () => {
    for (const c of behaviorCategories) {
      expect(() => BehaviorCategorySchema.parse(c)).not.toThrow()
    }
  })

  it('every star-cache entry revalidates against StarCacheEntrySchema', () => {
    for (const entry of Object.values(starCache)) {
      expect(() => StarCacheEntrySchema.parse(entry)).not.toThrow()
    }
  })

  it('rejects malformed pattern data', () => {
    const bad = { pattern_id: 'X', surface_family: 'S0' } // missing `surface`
    expect(() => PatternSchema.parse(bad)).toThrow()
  })
})
