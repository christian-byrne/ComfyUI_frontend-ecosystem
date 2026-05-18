import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Heatmap from '../Heatmap.vue'

// ── Mock the data module BEFORE importing the composable / page ────────
vi.mock('@/data', () => {
  const patterns = [
    {
      pattern_id: 'P1',
      surface_family: 'S1',
      surface: 'first pattern',
      evidence: [
        { repo: 'pack-a', file: 'a.js', url: 'https://example.com/a' },
        { repo: 'pack-a', file: 'b.js' },
        { repo: 'pack-b', file: 'c.js' }
      ]
    },
    {
      pattern_id: 'P2',
      surface_family: 'S1',
      surface: 'second pattern',
      evidence: [
        { repo: 'pack-a', file: 'd.js' },
        { repo: 'pack-c', file: 'e.js' }
      ]
    }
  ]
  const rollup = [
    {
      pattern_id: 'P1',
      surface_family: 'S1',
      name: 'first pattern',
      occurrences: 3,
      unique_repos: 2,
      cumulative_stars: 0,
      signature_count: 1,
      silent_breakage: 0,
      lifecycle_coupling: 0,
      blast_radius: 5,
      top_repos: []
    },
    {
      pattern_id: 'P2',
      surface_family: 'S1',
      name: 'second pattern',
      occurrences: 2,
      unique_repos: 2,
      cumulative_stars: 0,
      signature_count: 1,
      silent_breakage: 0,
      lifecycle_coupling: 0,
      blast_radius: 9,
      top_repos: []
    }
  ]
  const evidenceByPatternId: Record<string, unknown[]> = Object.fromEntries(
    patterns.map((p) => [p.pattern_id, p.evidence])
  )
  const evidenceCountByPack: Record<string, number> = {}
  for (const p of patterns) {
    for (const e of p.evidence) {
      evidenceCountByPack[e.repo] = (evidenceCountByPack[e.repo] ?? 0) + 1
    }
  }
  const rollupByPatternId = Object.fromEntries(rollup.map((r) => [r.pattern_id, r]))
  const patternById = Object.fromEntries(patterns.map((p) => [p.pattern_id, p]))
  return {
    patterns,
    rollup,
    rollupByPatternId,
    patternById,
    evidenceByPatternId,
    evidenceCountByPack
  }
})

describe('heatmap.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  it('mounts with synthetic data and renders the grid', async () => {
    const w = mount(Heatmap)
    await flushPromises()
    expect(w.find('[data-testid="heatmap-grid"]').exists()).toBe(true)
    expect(w.text()).toContain('Pattern × Pack Heatmap')
  })

  it('renders rows × cols matching the synthetic dataset (snapshot-style dimensions)', async () => {
    const w = mount(Heatmap)
    await flushPromises()
    const grid = w.find('[data-testid="heatmap-grid"]')

    // 2 patterns × 3 packs = 6 cells
    const cells = grid.findAll('button.heatmap-cell')
    expect(cells).toHaveLength(6)

    // 3 packs (a, b, c) appear in column headers
    expect(grid.findAll('[data-pack]').length).toBe(6)
    const distinctPacks = new Set(cells.map((c) => c.attributes('data-pack')))
    expect(distinctPacks).toEqual(new Set(['pack-a', 'pack-b', 'pack-c']))

    // Snapshot the structural dimensions: rows, cols, cell count.
    expect({
      rows: 2,
      cols: 3,
      cellCount: cells.length,
      gridTemplateColumns: grid.attributes('style')
    }).toMatchSnapshot()
  })

  it('orders rows by blast_radius desc (P2=9 before P1=5)', async () => {
    const w = mount(Heatmap)
    await flushPromises()
    const labels = w.findAll('button.heatmap-cell').map((c) => c.attributes('data-pattern'))
    // First three buttons belong to the first row, next three to the second.
    expect(labels.slice(0, 3).every((p) => p === 'P2')).toBe(true)
    expect(labels.slice(3).every((p) => p === 'P1')).toBe(true)
  })

  it('sets the highest-count cell to the maximum intensity color', async () => {
    const w = mount(Heatmap)
    await flushPromises()
    // P1::pack-a has 2 evidence rows — the matrix max.
    const top = w
      .findAll('button.heatmap-cell')
      .find((c) => c.attributes('data-pattern') === 'P1' && c.attributes('data-pack') === 'pack-a')
    expect(top).toBeTruthy()
    expect(top!.attributes('style')).toContain('background-color: rgb(24 24 27)')
  })

  it("opens the evidence drawer on cell click with that cell's rows", async () => {
    const w = mount(Heatmap, { attachTo: document.body })
    await flushPromises()
    const cell = w
      .findAll('button.heatmap-cell')
      .find((c) => c.attributes('data-pattern') === 'P1' && c.attributes('data-pack') === 'pack-a')!
    await cell.trigger('click')
    const drawer = w.find('[data-testid="evidence-drawer"]')
    expect(drawer.exists()).toBe(true)
    expect(drawer.text()).toContain('P1')
    expect(drawer.text()).toContain('pack-a')
    expect(drawer.text()).toContain('a.js')
    expect(drawer.text()).toContain('b.js')
    w.unmount()
  })

  it('toggling log-scale re-derives cell intensities', async () => {
    const w = mount(Heatmap)
    await flushPromises()
    const target = w
      .findAll('button.heatmap-cell')
      .find((c) => c.attributes('data-pattern') === 'P1' && c.attributes('data-pack') === 'pack-b')!
    const linearStyle = target.attributes('style')
    await w.find('[data-testid="log-scale-toggle"]').setValue(true)
    const logStyle = target.attributes('style')
    expect(logStyle).not.toBe(linearStyle)
  })
})
