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

  // ── W18.L: enriched backlinks shape ───────────────────────────────
  it('attaches enriched per-decision `backlinks` carrying title + type + relation', () => {
    // At least one decision in the real corpus is referenced by another.
    const withBacklinks = manifest.decisions.find(
      (d) => (d.backlinks ?? []).length > 0
    )
    expect(withBacklinks, 'corpus must contain a back-linked ADR').toBeTruthy()
    const b = withBacklinks!.backlinks![0]
    expect(b).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      type: 'decision'
    })
    // Relation is constrained to the documented set.
    expect(['supersedes', 'superseded-by', 'mentions']).toContain(b.relation)
    // Title is enriched — must not be the bare slug.
    const src = manifest.decisions.find((d) => d.slug === b.id)
    expect(b.title).toBe(src?.title)
  })

  it('classifies supersedes-style backlinks with the correct relation', () => {
    // Find a (target, source) pair where source.supersedes contains target.
    const source = manifest.decisions.find(
      (d) => (d.supersedes ?? []).length > 0
    )
    expect(source, 'corpus must contain a supersedes pair').toBeTruthy()
    const targetSlug = source!.supersedes![0]
    const target = manifest.decisions.find((d) => d.slug === targetSlug)
    expect(target).toBeTruthy()
    const back = (target!.backlinks ?? []).find((b) => b.id === source!.slug)
    expect(back?.relation).toBe('supersedes')
  })

  it('emits a parallel `axiomBacklinks` map with enriched citations', () => {
    expect(manifest.axiomBacklinks).toBeTruthy()
    // Every axiom in the flat axiomIndex must have a matching entry.
    for (const axiomId of Object.keys(manifest.axiomIndex)) {
      const enriched = manifest.axiomBacklinks[axiomId] ?? []
      expect(enriched.length).toBe(manifest.axiomIndex[axiomId].length)
      for (const link of enriched) {
        expect(link).toMatchObject({
          id: expect.any(String),
          title: expect.any(String),
          type: 'decision'
        })
        // Title must come from a real decision entry.
        const src = manifest.decisions.find((d) => d.slug === link.id)
        expect(link.title).toBe(src?.title)
      }
    }
  })

  it('dedupes backlinks by source id (no duplicate citations)', () => {
    for (const d of manifest.decisions) {
      const ids = (d.backlinks ?? []).map((b) => b.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
    for (const axiomId of Object.keys(manifest.axiomBacklinks ?? {})) {
      const ids = manifest.axiomBacklinks[axiomId].map((b) => b.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('returns undefined for an unknown decision slug (no throw)', () => {
    expect(getDecisionBody('d-this-does-not-exist')).toBeUndefined()
  })
})
