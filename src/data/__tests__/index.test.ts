import { describe, it, expect } from 'vitest'

import { buildDataset } from '../index'

const EMPTY_ROLLUP = 'patterns: []\n'

describe('buildDataset', () => {
  it('handles empty `patterns:` key (?? [] branch)', () => {
    const ds = buildDataset('patterns: []\n', EMPTY_ROLLUP)
    expect(ds.patterns).toEqual([])
    expect(ds.rollup).toEqual([])
    expect(ds.patternById).toEqual({})
    expect(ds.rollupByPatternId).toEqual({})
    expect(ds.evidenceByPatternId).toEqual({})
    expect(ds.evidenceCountByPack).toEqual({})
  })

  it('handles a missing `patterns:` key entirely', () => {
    const ds = buildDataset('meta: {}\n', 'meta: {}\n')
    expect(ds.patterns).toEqual([])
    expect(ds.rollup).toEqual([])
  })

  it('skips evidence rows without `repo` when counting per pack', () => {
    const patternsYaml = `
patterns:
  - pattern_id: P1
    surface_family: F
    surface: s
    evidence:
      - repo: pack-a
        file: a.js
      - file: orphan.js  # no repo — should not increment any pack count
      - repo: pack-a
        file: b.js
`
    const ds = buildDataset(patternsYaml, EMPTY_ROLLUP)
    expect(ds.evidenceCountByPack).toEqual({ 'pack-a': 2 })
    // Row without repo is preserved in evidenceByPatternId (no data loss).
    expect(ds.evidenceByPatternId.P1).toHaveLength(3)
    // pattern_id is backfilled on every row, including the orphan.
    expect(ds.evidenceByPatternId.P1.every((r) => r.pattern_id === 'P1')).toBe(true)
  })

  it('keeps evidenceCountByPack and evidenceByPatternId in lockstep (same source)', () => {
    const patternsYaml = `
patterns:
  - pattern_id: P1
    surface_family: F
    surface: s
    evidence:
      - repo: pack-a
        file: a.js
      - repo: pack-b
        file: b.js
  - pattern_id: P2
    surface_family: F
    surface: s
    evidence:
      - repo: pack-a
        file: c.js
`
    const ds = buildDataset(patternsYaml, EMPTY_ROLLUP)
    // Recount from evidenceByPatternId — must match evidenceCountByPack exactly.
    const recount: Record<string, number> = {}
    for (const rows of Object.values(ds.evidenceByPatternId)) {
      for (const r of rows) {
        if (r.repo) recount[r.repo] = (recount[r.repo] ?? 0) + 1
      }
    }
    expect(recount).toEqual(ds.evidenceCountByPack)
    expect(ds.evidenceCountByPack).toEqual({ 'pack-a': 2, 'pack-b': 1 })
  })

  it('throws a labelled error on malformed YAML (parse error)', () => {
    const malformed = 'patterns:\n  - pattern_id: P1\n    surface_family: [unclosed\n'
    expect(() => buildDataset(malformed, EMPTY_ROLLUP)).toThrow(
      /\[data\] failed to parse YAML touch-points-database\.yaml/
    )
  })

  it('last-write-wins on duplicate pattern_id (documents current behaviour)', () => {
    const patternsYaml = `
patterns:
  - pattern_id: DUP
    surface_family: F
    surface: first
    evidence:
      - repo: pack-a
        file: first.js
  - pattern_id: DUP
    surface_family: F
    surface: second
    evidence:
      - repo: pack-b
        file: second.js
`
    const ds = buildDataset(patternsYaml, EMPTY_ROLLUP)
    // Both array entries are preserved (no de-dup on the array).
    expect(ds.patterns).toHaveLength(2)
    // patternById is built via Object.fromEntries → last wins.
    expect(ds.patternById.DUP.surface).toBe('second')
    // evidenceByPatternId is built by iterating patterns in order → last write wins.
    expect(ds.evidenceByPatternId.DUP).toHaveLength(1)
    expect(ds.evidenceByPatternId.DUP[0].file).toBe('second.js')
    // Both packs still get counted (single pass walks all evidence).
    expect(ds.evidenceCountByPack).toEqual({ 'pack-a': 1, 'pack-b': 1 })
  })

  it('backfills missing `evidence:` on a pattern as []', () => {
    const patternsYaml = `
patterns:
  - pattern_id: NOEV
    surface_family: F
    surface: s
`
    const ds = buildDataset(patternsYaml, EMPTY_ROLLUP)
    expect(ds.patterns[0].evidence).toEqual([])
    expect(ds.evidenceByPatternId.NOEV).toEqual([])
  })
})
