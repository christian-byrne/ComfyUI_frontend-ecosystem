import { beforeEach, describe, expect, it } from 'vitest'

import { _resetPackCoverageCache, getPackCoverage, topPacksByEvidence } from '../usePackCoverage'

describe('usePackCoverage', () => {
  beforeEach(() => {
    _resetPackCoverageCache()
  })

  describe('getPackCoverage', () => {
    it('returns coverage for known repo', () => {
      // kijai is a well-known pack in the evidence
      const cov = getPackCoverage('kijai/ComfyUI-KJNodes')
      expect(cov).toBeDefined()
      expect(cov?.repo).toBe('kijai/ComfyUI-KJNodes')
    })

    it('returns undefined for unknown repo', () => {
      const cov = getPackCoverage('unknown/not-in-evidence')
      expect(cov).toBeUndefined()
    })

    it('coverage has required fields', () => {
      const cov = getPackCoverage('kijai/ComfyUI-KJNodes')
      expect(cov).toHaveProperty('repo')
      expect(cov).toHaveProperty('totalHits')
      expect(cov).toHaveProperty('patternHits')
      expect(cov).toHaveProperty('weightedImpact')
      expect(cov).toHaveProperty('rows')
    })

    it('totalHits is sum of row hits', () => {
      const cov = getPackCoverage('kijai/ComfyUI-KJNodes')
      if (!cov) return
      const sumHits = cov.rows.reduce((acc, r) => acc + r.hits, 0)
      expect(cov.totalHits).toBe(sumHits)
    })

    it('patternHits equals number of unique patterns', () => {
      const cov = getPackCoverage('kijai/ComfyUI-KJNodes')
      if (!cov) return
      expect(cov.patternHits).toBe(cov.rows.length)
    })

    it('rows are sorted by blast_radius desc', () => {
      const cov = getPackCoverage('kijai/ComfyUI-KJNodes')
      if (!cov || cov.rows.length < 2) return
      for (let i = 1; i < cov.rows.length; i++) {
        expect(cov.rows[i - 1].blast_radius).toBeGreaterThanOrEqual(cov.rows[i].blast_radius)
      }
    })

    it('each row has evidence array', () => {
      const cov = getPackCoverage('kijai/ComfyUI-KJNodes')
      if (!cov) return
      for (const row of cov.rows) {
        expect(Array.isArray(row.evidence)).toBe(true)
        expect(row.evidence.length).toBeGreaterThan(0)
      }
    })
  })

  describe('topPacksByEvidence', () => {
    it('returns array of repo strings', () => {
      const top = topPacksByEvidence(5)
      expect(Array.isArray(top)).toBe(true)
      expect(top.length).toBeLessThanOrEqual(5)
      for (const repo of top) {
        expect(typeof repo).toBe('string')
      }
    })

    it('returns N or fewer packs', () => {
      const top3 = topPacksByEvidence(3)
      expect(top3.length).toBeLessThanOrEqual(3)

      const top100 = topPacksByEvidence(100)
      expect(top100.length).toBeLessThanOrEqual(100)
    })

    it('packs are sorted by evidence count desc', () => {
      const top = topPacksByEvidence(10)
      for (let i = 1; i < top.length; i++) {
        const prevCov = getPackCoverage(top[i - 1])
        const currCov = getPackCoverage(top[i])
        if (prevCov && currCov) {
          expect(prevCov.totalHits).toBeGreaterThanOrEqual(currCov.totalHits)
        }
      }
    })
  })

  describe('cache behavior', () => {
    it('returns same object on repeated calls', () => {
      const cov1 = getPackCoverage('kijai/ComfyUI-KJNodes')
      const cov2 = getPackCoverage('kijai/ComfyUI-KJNodes')
      expect(cov1).toBe(cov2)
    })

    it('reset clears cache', () => {
      const cov1 = getPackCoverage('kijai/ComfyUI-KJNodes')
      _resetPackCoverageCache()
      const cov2 = getPackCoverage('kijai/ComfyUI-KJNodes')
      // After reset, should be a new object with same data
      expect(cov1).not.toBe(cov2)
      expect(cov1?.repo).toBe(cov2?.repo)
    })
  })
})
