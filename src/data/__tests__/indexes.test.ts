import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  categoriesByPatternId,
  evidenceByPatternId,
  patternsByPack,
  patternsBySurface,
  rollupByPatternId
} from '@/data'
import { useDataStore } from '@/stores/data'

describe('data indexes', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('groups patterns by surface_family with the expected counts', () => {
    expect(patternsBySurface.S4).toHaveLength(5)
    expect(patternsBySurface.S2).toHaveLength(19)
    expect(patternsBySurface.S6).toHaveLength(4)
  })

  it('S4.W1 evidence index has 15 rows, all carrying pattern_id', () => {
    const ev = evidenceByPatternId['S4.W1']
    expect(ev).toBeDefined()
    expect(ev).toHaveLength(15)
    for (const row of ev) {
      expect(row.pattern_id).toBe('S4.W1')
    }
  })

  it('patternsByPack indexes packs that appear in evidence rows', () => {
    const pack = 'crom8505/ComfyUI-Dynamic-Sigmas'
    expect(patternsByPack[pack]).toBeDefined()
    expect(patternsByPack[pack].some((p) => p.pattern_id === 'S4.W1')).toBe(true)
  })

  it('S4.W1 belongs to BC.10 (Widget value subscription)', () => {
    const cats = categoriesByPatternId['S4.W1']
    expect(cats).toBeDefined()
    expect(cats.map((c) => c.category_id)).toContain('BC.10')
  })

  it('rollupByPatternId returns S6.A1 with the highest known blast_radius', () => {
    const top = rollupByPatternId['S6.A1']
    expect(top).toBeDefined()
    expect(top.blast_radius).toBeCloseTo(7.016, 2)
  })
})

describe('useDataStore queries', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('topByBlastRadius(5) returns 5 rollup entries sorted desc', () => {
    const store = useDataStore()
    const top = store.topByBlastRadius(5)
    expect(top).toHaveLength(5)
    expect(top[0].pattern_id).toBe('S6.A1')
    for (let i = 0; i < top.length - 1; i++) {
      expect(top[i].blast_radius).toBeGreaterThanOrEqual(top[i + 1].blast_radius)
    }
  })

  it('getPattern + getRollup resolve known IDs', () => {
    const store = useDataStore()
    expect(store.getPattern('S4.W1')?.surface_family).toBe('S4')
    expect(store.getRollup('S6.A1')?.surface_family).toBe('S6')
    expect(store.getPattern('does-not-exist')).toBeUndefined()
  })

  it('getEvidenceForPattern returns 15 rows for S4.W1, [] for unknown', () => {
    const store = useDataStore()
    expect(store.getEvidenceForPattern('S4.W1')).toHaveLength(15)
    expect(store.getEvidenceForPattern('does-not-exist')).toEqual([])
  })

  it('getCategoriesForPattern includes BC.10 for S4.W1', () => {
    const store = useDataStore()
    const cats = store.getCategoriesForPattern('S4.W1')
    expect(cats.map((c) => c.category_id)).toContain('BC.10')
  })

  it('searchPatterns matches case-insensitively across multiple fields', () => {
    const store = useDataStore()
    expect(store.searchPatterns('').length).toBe(0)
    expect(store.searchPatterns('s4.w1').length).toBeGreaterThanOrEqual(1)
    const widgetHits = store.searchPatterns('widget.callback')
    expect(widgetHits.some((p) => p.pattern_id === 'S4.W1')).toBe(true)
  })
})
