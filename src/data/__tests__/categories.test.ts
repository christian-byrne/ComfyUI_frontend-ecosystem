import { describe, it, expect } from 'vitest'

import { behaviorCategories, categoriesByPatternId } from '../categories'

describe('categories', () => {
  describe('behaviorCategories', () => {
    it('is an array of categories', () => {
      expect(Array.isArray(behaviorCategories)).toBe(true)
      expect(behaviorCategories.length).toBeGreaterThan(0)
    })

    it('each category has required fields', () => {
      for (const cat of behaviorCategories.slice(0, 5)) {
        expect(cat).toHaveProperty('category_id')
        expect(cat).toHaveProperty('name')
        expect(cat).toHaveProperty('intent')
        expect(cat).toHaveProperty('member_pattern_ids')
      }
    })

    it('category_id follows BC.XX format', () => {
      for (const cat of behaviorCategories) {
        expect(cat.category_id).toMatch(/^BC\.\d+$/)
      }
    })

    it('member_pattern_ids is an array', () => {
      for (const cat of behaviorCategories) {
        expect(Array.isArray(cat.member_pattern_ids)).toBe(true)
      }
    })

    it('categories have usage_weight', () => {
      for (const cat of behaviorCategories) {
        expect(typeof cat.usage_weight).toBe('number')
      }
    })
  })

  describe('categoriesByPatternId', () => {
    it('is an object', () => {
      expect(typeof categoriesByPatternId).toBe('object')
    })

    it('keys are pattern_ids', () => {
      const keys = Object.keys(categoriesByPatternId)
      expect(keys.length).toBeGreaterThan(0)
      // Pattern IDs should match SX.YZ format
      for (const key of keys.slice(0, 10)) {
        expect(key).toMatch(/^S\d+\.[A-Z0-9]+$/)
      }
    })

    it('values are arrays of categories', () => {
      const keys = Object.keys(categoriesByPatternId)
      for (const key of keys.slice(0, 5)) {
        const cats = categoriesByPatternId[key]
        expect(Array.isArray(cats)).toBe(true)
        expect(cats.length).toBeGreaterThan(0)
        for (const cat of cats) {
          expect(cat).toHaveProperty('category_id')
        }
      }
    })

    it('reverse lookup is consistent', () => {
      // For each pattern in a category, that pattern should map back to that category
      for (const cat of behaviorCategories.slice(0, 3)) {
        for (const pid of cat.member_pattern_ids) {
          const mappedCats = categoriesByPatternId[pid]
          expect(mappedCats).toBeDefined()
          expect(mappedCats.some((c) => c.category_id === cat.category_id)).toBe(
            true
          )
        }
      }
    })
  })
})
