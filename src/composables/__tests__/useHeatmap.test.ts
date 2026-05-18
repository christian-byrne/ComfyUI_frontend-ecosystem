import type { Pattern, RollupEntry } from '@/data/schema'

import { describe, expect, it } from 'vitest'
import { buildHeatmapMatrix } from '../useHeatmap'

function fixture() {
  const patterns: Pattern[] = [
    {
      pattern_id: 'P1',
      surface_family: 'S1',
      surface: 'p1',
      evidence: [
        { repo: 'pack-a', file: 'a.js' },
        { repo: 'pack-a', file: 'b.js' },
        { repo: 'pack-b', file: 'c.js' }
      ]
    },
    {
      pattern_id: 'P2',
      surface_family: 'S1',
      surface: 'p2',
      evidence: [
        { repo: 'pack-a', file: 'd.js' },
        { repo: 'pack-c', file: 'e.js' }
      ]
    }
  ]
  const rollup: RollupEntry[] = [
    {
      pattern_id: 'P1',
      surface_family: 'S1',
      name: 'p1',
      occurrences: 3,
      unique_repos: 2,
      cumulative_stars: 100,
      signature_count: 1,
      silent_breakage: 1,
      lifecycle_coupling: 0,
      blast_radius: 5,
      top_repos: []
    },
    {
      pattern_id: 'P2',
      surface_family: 'S1',
      name: 'p2',
      occurrences: 2,
      unique_repos: 2,
      cumulative_stars: 50,
      signature_count: 1,
      silent_breakage: 0,
      lifecycle_coupling: 0,
      blast_radius: 9,
      top_repos: []
    }
  ]
  const evidenceByPatternId: Record<string, Pattern['evidence']> = Object.fromEntries(
    patterns.map((p) => [p.pattern_id, p.evidence])
  )
  const evidenceCountByPack: Record<string, number> = {}
  for (const p of patterns) {
    for (const e of p.evidence) {
      evidenceCountByPack[e.repo] = (evidenceCountByPack[e.repo] ?? 0) + 1
    }
  }
  const rollupByPatternId = Object.fromEntries(rollup.map((r) => [r.pattern_id, r]))
  return {
    patterns,
    rollup,
    evidenceByPatternId,
    evidenceCountByPack,
    rollupByPatternId
  }
}

describe('buildHeatmapMatrix', () => {
  it('orders rows by blast_radius desc', () => {
    const m = buildHeatmapMatrix(fixture())
    expect(m.patterns.map((p) => p.pattern_id)).toEqual(['P2', 'P1'])
  })

  it('orders columns by total evidence desc and respects topPacks cap', () => {
    const m = buildHeatmapMatrix(fixture(), 2)
    // pack-a:3, pack-b:1, pack-c:1 → top-2 = [pack-a, pack-b] (b before c via stable sort)
    expect(m.packs).toHaveLength(2)
    expect(m.packs[0]).toBe('pack-a')
  })

  it('counts evidence per (pattern, pack) cell', () => {
    const m = buildHeatmapMatrix(fixture())
    expect(m.cells.get('P1::pack-a')?.count).toBe(2)
    expect(m.cells.get('P1::pack-b')?.count).toBe(1)
    expect(m.cells.get('P2::pack-a')?.count).toBe(1)
    expect(m.cells.get('P2::pack-c')?.count).toBe(1)
  })

  it('reports the max cell count', () => {
    expect(buildHeatmapMatrix(fixture()).max).toBe(2)
  })

  it('drops evidence whose pack is outside top-N', () => {
    const m = buildHeatmapMatrix(fixture(), 1) // only pack-a survives
    expect(m.packs).toEqual(['pack-a'])
    expect(m.cells.has('P1::pack-b')).toBe(false)
    expect(m.cells.has('P2::pack-c')).toBe(false)
    expect(m.cells.get('P1::pack-a')?.count).toBe(2)
  })
})
