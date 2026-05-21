import { describe, expect, it } from 'vitest'

import {
  allAxioms,
  decisionsByStatus,
  decisionsSorted,
  getDecisionBody,
  getRootBody,
  manifest
} from '@/data/knowledge-loader'

describe('knowledge-loader', () => {
  it('loads a non-empty decisions manifest', () => {
    expect(manifest.decisions.length).toBeGreaterThan(10)
    expect(decisionsSorted.length).toBe(manifest.decisions.length)
  })

  it('exposes root context docs (AXIOMS, CONTEXT, AGENTS, todo)', () => {
    const slugs = manifest.root.map((r) => r.slug.toLowerCase())
    expect(slugs).toContain('axioms')
    expect(slugs).toContain('context')
    expect(slugs).toContain('agents')
    expect(slugs).toContain('todo')
  })

  it('round-trips a decision body by slug', () => {
    const first = decisionsSorted[0]
    const body = getDecisionBody(first.slug)
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)
  })

  it('returns the AXIOMS root body when asked', () => {
    const body = getRootBody('axioms')
    expect(body).toBeTruthy()
    expect(body!.toLowerCase()).toMatch(/axiom|widget|serial/)
  })

  it('cross-references at least one axiom from the ADR corpus', () => {
    expect(allAxioms.length).toBeGreaterThan(0)
    const firstAxiomReferencedAdrs = manifest.axiomIndex[allAxioms[0]]
    expect(firstAxiomReferencedAdrs.length).toBeGreaterThan(0)
  })

  it('groups decisions by status (covers accepted/proposed/superseded shapes)', () => {
    const buckets = Object.keys(decisionsByStatus)
    expect(buckets.length).toBeGreaterThan(0)
    // Every decision lands in exactly one bucket.
    const totalInBuckets = Object.values(decisionsByStatus).reduce(
      (s, list) => s + list.length,
      0
    )
    expect(totalInBuckets).toBe(manifest.decisions.length)
  })

  it('builds an adrBacklinks reverse index that points to real ADRs only', () => {
    const knownSlugs = new Set(manifest.decisions.map((d) => d.slug))
    for (const referencedSlug of Object.keys(manifest.adrBacklinks)) {
      expect(knownSlugs.has(referencedSlug)).toBe(true)
    }
  })

  it('returns undefined for an unknown decision slug (no throw)', () => {
    expect(getDecisionBody('d-this-does-not-exist')).toBeUndefined()
  })
})
