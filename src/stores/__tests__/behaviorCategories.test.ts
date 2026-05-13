import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

import { useBehaviorCategoriesStore } from '../behaviorCategories'

describe('useBehaviorCategoriesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('categories', () => {
    it('returns all behavior categories as an array', () => {
      const store = useBehaviorCategoriesStore()
      expect(Array.isArray(store.categories)).toBe(true)
      expect(store.categories.length).toBeGreaterThan(0)
    })

    it('each category has required fields', () => {
      const store = useBehaviorCategoriesStore()
      const category = store.categories[0]
      expect(category).toHaveProperty('category_id')
      expect(category).toHaveProperty('name')
      expect(category).toHaveProperty('intent')
      expect(category).toHaveProperty('member_pattern_ids')
    })

    it('category_id follows BC.XX format', () => {
      const store = useBehaviorCategoriesStore()
      for (const cat of store.categories.slice(0, 10)) {
        expect(cat.category_id).toMatch(/^BC\.\d+$/)
      }
    })
  })

  describe('byId', () => {
    it('returns a Map keyed by category_id', () => {
      const store = useBehaviorCategoriesStore()
      expect(store.byId).toBeInstanceOf(Map)
      expect(store.byId.size).toBe(store.categories.length)
    })

    it('map values are the same category objects', () => {
      const store = useBehaviorCategoriesStore()
      const firstCat = store.categories[0]
      const fromMap = store.byId.get(firstCat.category_id)
      expect(fromMap).toBe(firstCat)
    })
  })

  describe('get', () => {
    it('returns category by id', () => {
      const store = useBehaviorCategoriesStore()
      const category = store.get('BC.01')
      expect(category).toBeDefined()
      expect(category?.category_id).toBe('BC.01')
    })

    it('returns undefined for unknown id', () => {
      const store = useBehaviorCategoriesStore()
      expect(store.get('BC.9999')).toBeUndefined()
    })

    it('returns undefined for non-BC format id', () => {
      const store = useBehaviorCategoriesStore()
      expect(store.get('INVALID')).toBeUndefined()
    })
  })

  describe('data integrity', () => {
    it('all categories have at least one member pattern', () => {
      const store = useBehaviorCategoriesStore()
      for (const cat of store.categories) {
        expect(cat.member_pattern_ids.length).toBeGreaterThan(0)
      }
    })

    it('member_pattern_ids are strings', () => {
      const store = useBehaviorCategoriesStore()
      for (const cat of store.categories.slice(0, 5)) {
        for (const pid of cat.member_pattern_ids) {
          expect(typeof pid).toBe('string')
        }
      }
    })
  })
})
