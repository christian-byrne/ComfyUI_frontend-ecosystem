import { describe, expect, it } from 'vitest'

import { isInStarCache, starCache, starsFor } from '../star-cache'

describe('star-cache', () => {
  describe('starCache', () => {
    it('is an object keyed by repo', () => {
      expect(typeof starCache).toBe('object')
      expect(Object.keys(starCache).length).toBeGreaterThan(0)
    })

    it('entries have required fields', () => {
      const repos = Object.keys(starCache).slice(0, 5)
      for (const repo of repos) {
        const entry = starCache[repo]
        expect(entry).toHaveProperty('repo')
        expect(entry).toHaveProperty('stars')
        expect(entry.repo).toBe(repo)
      }
    })

    it('entries have numeric stars', () => {
      const repos = Object.keys(starCache).slice(0, 10)
      for (const repo of repos) {
        expect(typeof starCache[repo].stars).toBe('number')
      }
    })
  })

  describe('isInStarCache', () => {
    it('returns true for known repo', () => {
      const knownRepo = Object.keys(starCache)[0]
      expect(isInStarCache(knownRepo)).toBe(true)
    })

    it('returns false for unknown repo', () => {
      expect(isInStarCache('unknown/not-in-cache')).toBe(false)
    })

    it('is case-sensitive', () => {
      const knownRepo = Object.keys(starCache)[0]
      const upperRepo = knownRepo.toUpperCase()
      // Unless the repo is already uppercase, this should be false
      if (knownRepo !== upperRepo) {
        expect(isInStarCache(upperRepo)).toBe(false)
      }
    })
  })

  describe('starsFor', () => {
    it('returns star count for known repo', () => {
      const knownRepo = Object.keys(starCache)[0]
      const stars = starsFor(knownRepo)
      expect(typeof stars).toBe('number')
      expect(stars).toBe(starCache[knownRepo].stars)
    })

    it('returns 0 for unknown repo', () => {
      expect(starsFor('unknown/not-in-cache')).toBe(0)
    })

    it('returns 0 for empty string', () => {
      expect(starsFor('')).toBe(0)
    })
  })
})
