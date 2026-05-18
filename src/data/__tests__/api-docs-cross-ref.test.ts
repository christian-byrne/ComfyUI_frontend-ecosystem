import { describe, expect, it } from 'vitest'

import {
  getAffectedRepos,
  getBlastRadiusColor,
  getCrossRef,
  getTotalBlastRadius
} from '../api-docs-cross-ref'

describe('api-docs-cross-ref', () => {
  describe('getCrossRef', () => {
    it('returns patterns including S2.N1 for onnodemounted', () => {
      const result = getCrossRef('onnodemounted')
      expect(result).not.toBeNull()
      const patternIds = result!.patterns.map((p) => p.pattern_id)
      expect(patternIds).toContain('S2.N1')
    })

    it('returns multiple patterns and categories for nodehandle', () => {
      const result = getCrossRef('nodehandle')
      expect(result).not.toBeNull()
      expect(result!.patterns.length).toBeGreaterThan(1)
      expect(result!.categories.length).toBeGreaterThan(1)
    })

    it('returns null for nonexistent slug', () => {
      const result = getCrossRef('nonexistent')
      expect(result).toBeNull()
    })

    it('is case-insensitive', () => {
      const lower = getCrossRef('nodehandle')
      const upper = getCrossRef('NODEHANDLE')
      const mixed = getCrossRef('NodeHandle')
      expect(lower).toEqual(upper)
      expect(lower).toEqual(mixed)
    })
  })

  describe('getTotalBlastRadius', () => {
    it('sums pattern blast_radius values', () => {
      const data = getCrossRef('nodehandle')
      expect(data).not.toBeNull()
      const total = getTotalBlastRadius(data!)
      const expected = data!.patterns.reduce((sum, p) => sum + p.blast_radius, 0)
      expect(total).toBe(expected)
      expect(total).toBeGreaterThan(0)
    })

    it('returns 0 for empty patterns', () => {
      const total = getTotalBlastRadius({ patterns: [], categories: [] })
      expect(total).toBe(0)
    })
  })

  describe('getAffectedRepos', () => {
    it('returns unique repos sorted by stars', () => {
      const data = getCrossRef('nodehandle')
      expect(data).not.toBeNull()
      const repos = getAffectedRepos(data!)
      expect(repos.length).toBeGreaterThan(0)
      expect(repos.length).toBeLessThanOrEqual(5)
      // Verify sorted by stars descending
      for (let i = 1; i < repos.length; i++) {
        expect(repos[i - 1].stars).toBeGreaterThanOrEqual(repos[i].stars)
      }
    })

    it('returns no duplicates', () => {
      const data = getCrossRef('nodehandle')
      expect(data).not.toBeNull()
      const repos = getAffectedRepos(data!)
      const names = repos.map((r) => r.repo)
      const unique = new Set(names)
      expect(unique.size).toBe(names.length)
    })

    it('returns empty array for empty patterns', () => {
      const repos = getAffectedRepos({ patterns: [], categories: [] })
      expect(repos).toEqual([])
    })
  })

  describe('getBlastRadiusColor', () => {
    it('returns green for radius < 3', () => {
      expect(getBlastRadiusColor(0)).toContain('green')
      expect(getBlastRadiusColor(1)).toContain('green')
      expect(getBlastRadiusColor(2.9)).toContain('green')
    })

    it('returns yellow for radius 3-4.9', () => {
      expect(getBlastRadiusColor(3)).toContain('yellow')
      expect(getBlastRadiusColor(4)).toContain('yellow')
      expect(getBlastRadiusColor(4.9)).toContain('yellow')
    })

    it('returns red for radius >= 5', () => {
      expect(getBlastRadiusColor(5)).toContain('red')
      expect(getBlastRadiusColor(6)).toContain('red')
      expect(getBlastRadiusColor(10)).toContain('red')
    })
  })
})
