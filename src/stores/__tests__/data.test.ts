import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

import { useDataStore } from '../data'

describe('useDataStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('patterns', () => {
    it('returns all patterns as an array', () => {
      const store = useDataStore()
      expect(Array.isArray(store.patterns)).toBe(true)
      expect(store.patterns.length).toBeGreaterThan(0)
    })

    it('each pattern has required fields', () => {
      const store = useDataStore()
      const pattern = store.patterns[0]
      expect(pattern).toHaveProperty('pattern_id')
      expect(pattern).toHaveProperty('surface_family')
      expect(pattern).toHaveProperty('surface')
    })
  })

  describe('rollup', () => {
    it('returns all rollup entries', () => {
      const store = useDataStore()
      expect(Array.isArray(store.rollup)).toBe(true)
      expect(store.rollup.length).toBeGreaterThan(0)
    })

    it('each rollup entry has blast_radius', () => {
      const store = useDataStore()
      for (const entry of store.rollup.slice(0, 5)) {
        expect(typeof entry.blast_radius).toBe('number')
      }
    })
  })

  describe('topByBlastRadius', () => {
    it('returns top N patterns sorted by blast_radius descending', () => {
      const store = useDataStore()
      const top5 = store.topByBlastRadius(5)

      expect(top5).toHaveLength(5)
      for (let i = 1; i < top5.length; i++) {
        expect(top5[i - 1].blast_radius).toBeGreaterThanOrEqual(
          top5[i].blast_radius
        )
      }
    })

    it('returns all if N > total count', () => {
      const store = useDataStore()
      const all = store.topByBlastRadius(10000)
      expect(all.length).toBe(store.rollup.length)
    })
  })

  describe('getPattern', () => {
    it('returns pattern by id', () => {
      const store = useDataStore()
      // Use a known pattern from the database
      const pattern = store.getPattern('S6.A1')
      expect(pattern).toBeDefined()
      expect(pattern?.pattern_id).toBe('S6.A1')
    })

    it('returns undefined for unknown id', () => {
      const store = useDataStore()
      expect(store.getPattern('UNKNOWN.X99')).toBeUndefined()
    })
  })

  describe('getRollup', () => {
    it('returns rollup entry by pattern id', () => {
      const store = useDataStore()
      const rollup = store.getRollup('S6.A1')
      expect(rollup).toBeDefined()
      expect(rollup?.pattern_id).toBe('S6.A1')
    })

    it('returns undefined for unknown id', () => {
      const store = useDataStore()
      expect(store.getRollup('UNKNOWN.X99')).toBeUndefined()
    })
  })

  describe('getEvidenceForPattern', () => {
    it('returns evidence rows for pattern', () => {
      const store = useDataStore()
      const evidence = store.getEvidenceForPattern('S6.A1')
      expect(Array.isArray(evidence)).toBe(true)
      expect(evidence.length).toBeGreaterThan(0)
    })

    it('returns empty array for unknown pattern', () => {
      const store = useDataStore()
      const evidence = store.getEvidenceForPattern('UNKNOWN.X99')
      expect(evidence).toEqual([])
    })
  })

  describe('searchPatterns', () => {
    it('returns all patterns for empty query', () => {
      const store = useDataStore()
      const results = store.searchPatterns('')
      expect(results.length).toBe(store.patterns.length)
    })

    it('returns all patterns for whitespace query', () => {
      const store = useDataStore()
      const results = store.searchPatterns('   ')
      expect(results.length).toBe(store.patterns.length)
    })

    it('finds patterns by pattern_id', () => {
      const store = useDataStore()
      const results = store.searchPatterns('S6.A1')
      expect(results.some((p) => p.pattern_id === 'S6.A1')).toBe(true)
    })

    it('finds patterns by surface_family', () => {
      const store = useDataStore()
      const results = store.searchPatterns('S2')
      // S2 matches in pattern_id or surface_family
      expect(results.length).toBeGreaterThan(0)
      expect(
        results.some(
          (p) =>
            p.surface_family.includes('S2') || p.pattern_id.startsWith('S2.')
        )
      ).toBe(true)
    })

    it('is case-insensitive', () => {
      const store = useDataStore()
      const upper = store.searchPatterns('GRAPHTOPROMPT')
      const lower = store.searchPatterns('graphtoprompt')
      expect(upper.length).toBe(lower.length)
    })

    it('finds patterns by evidence repo name', () => {
      const store = useDataStore()
      // Search for a known pack name that appears in evidence
      const results = store.searchPatterns('kijai')
      expect(results.length).toBeGreaterThan(0)
      // At least one result should have kijai in evidence
      const hasKijai = results.some((p) =>
        p.evidence.some((e) => e.repo?.toLowerCase().includes('kijai'))
      )
      expect(hasKijai).toBe(true)
    })
  })

  describe('starCache and starredPacks', () => {
    it('starCache is an object keyed by repo', () => {
      const store = useDataStore()
      expect(typeof store.starCache).toBe('object')
    })

    it('starredPacks returns entries with stars > 0', () => {
      const store = useDataStore()
      for (const pack of store.starredPacks.slice(0, 5)) {
        expect(pack.stars).toBeGreaterThan(0)
      }
    })
  })

  describe('totalEvidenceCount', () => {
    it('returns a positive number', () => {
      const store = useDataStore()
      expect(store.totalEvidenceCount).toBeGreaterThan(0)
    })
  })

  describe('evidenceCountByPack', () => {
    it('is an object with repo keys and count values', () => {
      const store = useDataStore()
      const keys = Object.keys(store.evidenceCountByPack)
      expect(keys.length).toBeGreaterThan(0)
      for (const key of keys.slice(0, 5)) {
        expect(typeof store.evidenceCountByPack[key]).toBe('number')
      }
    })
  })
})
