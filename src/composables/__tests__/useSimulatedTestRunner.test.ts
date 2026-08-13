import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import behaviorCategories from '@/data/behavior-categories.json'
import { PATTERN_TO_BC, UNCATEGORISED_PATTERN_IDS } from '@/data/pattern-bc-map'
import rollup from '@/data/touch-points-rollup.json'
import { IS_SIMULATED, SIMULATED_NOTICE, useSimulatedTestRunner } from '../useSimulatedTestRunner'

describe('useSimulatedTestRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * The map used to be hand-maintained inline in the composable. It covered 28
   * of 73 patterns and four entries were wrong. The old tests passed anyway,
   * because they only asserted entries that happened to be correct — pinning a
   * subset of a hand-written table can never catch the table being wrong.
   *
   * These tests instead assert the *property* that made the bug impossible:
   * the map is exhaustively derived from behavior-categories.json.
   */
  describe('pATTERN_TO_BC is generated, not hand-maintained', () => {
    it('contains exactly the inverse of every category member_pattern_ids', () => {
      const expected: Record<string, string[]> = {}
      for (const category of behaviorCategories.categories) {
        for (const patternId of category.member_pattern_ids) {
          ;(expected[patternId] ??= []).push(category.category_id)
        }
      }
      for (const ids of Object.values(expected)) ids.sort()

      expect(PATTERN_TO_BC).toEqual(expected)
    })

    it('covers every pattern that any behavior category claims', () => {
      const claimed = new Set(behaviorCategories.categories.flatMap((c) => c.member_pattern_ids))
      expect(Object.keys(PATTERN_TO_BC).sort()).toEqual([...claimed].sort())
      // Guards the specific regression: the old hand-written map had 28 keys.
      expect(Object.keys(PATTERN_TO_BC).length).toBeGreaterThan(28)
    })

    it('accounts for every rollup pattern as either mapped or explicitly uncategorised', () => {
      const rollupIds = rollup.patterns.map((p) => p.pattern_id).sort()
      const accounted = [...Object.keys(PATTERN_TO_BC), ...UNCATEGORISED_PATTERN_IDS].sort()
      expect(accounted).toEqual(rollupIds)
    })

    it('pins the four entries the hand-written map got wrong', () => {
      // Old value -> correct value, per behavior-categories.json member lists.
      expect(PATTERN_TO_BC['S2.N2']).toEqual(['BC.16']) // was BC.02
      expect(PATTERN_TO_BC['S2.N4']).toEqual(['BC.02']) // was BC.04
      expect(PATTERN_TO_BC['S2.N5']).toEqual(['BC.22']) // was BC.04
      expect(PATTERN_TO_BC['S2.N6']).toEqual(['BC.13']) // was BC.03
    })

    it('exposes the uncategorised patterns rather than hiding them', () => {
      expect([...UNCATEGORISED_PATTERN_IDS]).toEqual(['S12.UI2', 'S16.D1', 'S16.D3', 'S16.D7'])
    })
  })

  describe('simulation is declared loudly', () => {
    it('exports a hard IS_SIMULATED flag', () => {
      expect(IS_SIMULATED).toBe(true)
    })

    it('exposes the notice through the composable so the UI can render it', () => {
      const { isSimulated, simulatedNotice } = useSimulatedTestRunner('S2.N1')
      expect(isSimulated).toBe(true)
      expect(simulatedNotice).toBe(SIMULATED_NOTICE)
      expect(simulatedNotice.toLowerCase()).toContain('simulated')
    })

    it('marks every result object as simulated', async () => {
      const { runTest } = useSimulatedTestRunner('S2.N1')
      const promise = runTest()
      await vi.advanceTimersByTimeAsync(1500)
      const result = await promise
      expect(result.simulated).toBe(true)
    })

    it('marks the skipped/unmapped result as simulated too', async () => {
      const { runTest } = useSimulatedTestRunner('UNKNOWN.X1')
      const promise = runTest()
      await vi.advanceTimersByTimeAsync(100)
      const result = await promise
      expect(result.simulated).toBe(true)
    })
  })

  describe('pattern to BC mapping', () => {
    it('maps S2.N1 to BC.01', () => {
      const { bcCategories, bcLabel } = useSimulatedTestRunner('S2.N1')
      expect(bcCategories.value).toEqual(['BC.01'])
      expect(bcLabel.value).toBe('BC.01')
    })

    it('maps S9.SG1 to BC.28', () => {
      const { bcCategories } = useSimulatedTestRunner('S9.SG1')
      expect(bcCategories.value).toEqual(['BC.28'])
    })

    it('returns empty array for unknown pattern', () => {
      const { bcCategories, bcLabel, canRun } = useSimulatedTestRunner('UNKNOWN.X1')
      expect(bcCategories.value).toEqual([])
      expect(bcLabel.value).toBe('No BC mapping')
      expect(canRun.value).toBe(false)
    })
  })

  describe('test file mapping', () => {
    it('resolves test file path for known BC category', () => {
      const { testFiles } = useSimulatedTestRunner('S2.N1')
      expect(testFiles.value).toContain('src/extension-api-v2/__tests__/bc-01.v2.test.ts')
    })

    it('returns empty array for unmapped pattern', () => {
      const { testFiles } = useSimulatedTestRunner('UNKNOWN.X1')
      expect(testFiles.value).toEqual([])
    })

    it('reports no runnable stub for a pattern whose BC has no published stub', () => {
      // S2.N2 correctly maps to BC.16, which has no upstream stub. The old
      // wrong mapping (BC.02) made this look runnable.
      const { canRun } = useSimulatedTestRunner('S2.N2')
      expect(canRun.value).toBe(false)
    })
  })

  describe('canRun computed', () => {
    it('returns true when pattern has BC mapping with a published stub', () => {
      const { canRun } = useSimulatedTestRunner('S2.N1')
      expect(canRun.value).toBe(true)
    })

    it('returns false when pattern has no BC mapping', () => {
      const { canRun } = useSimulatedTestRunner('UNKNOWN.X1')
      expect(canRun.value).toBe(false)
    })
  })

  describe('runTest', () => {
    it('sets state to running then resolves', async () => {
      const { state, runTest } = useSimulatedTestRunner('S2.N1')
      expect(state.value).toBe('idle')

      const promise = runTest()
      expect(state.value).toBe('running')

      // Fast-forward past simulated delay
      await vi.advanceTimersByTimeAsync(1500)
      await promise

      expect(state.value).not.toBe('running')
    })

    it('returns result with duration and state', async () => {
      const { runTest } = useSimulatedTestRunner('S2.N1')

      const promise = runTest()
      await vi.advanceTimersByTimeAsync(1500)
      const result = await promise

      expect(result.state).toBeDefined()
      expect(typeof result.duration).toBe('number')
    })

    it('returns skipped for unmapped patterns', async () => {
      const { runTest, state } = useSimulatedTestRunner('UNKNOWN.X1')

      const promise = runTest()
      await vi.advanceTimersByTimeAsync(100)
      const result = await promise

      expect(result.state).toBe('skipped')
      expect(state.value).toBe('skipped')
      expect(result.error).toContain('No test mapping')
    })
  })

  describe('reset', () => {
    it('resets state to idle and clears result', async () => {
      const { state, result, runTest, reset } = useSimulatedTestRunner('S2.N1')

      const promise = runTest()
      await vi.advanceTimersByTimeAsync(1500)
      await promise

      expect(state.value).not.toBe('idle')
      expect(result.value).not.toBeNull()

      reset()

      expect(state.value).toBe('idle')
      expect(result.value).toBeNull()
    })
  })

  describe('reactive patternId', () => {
    it('updates mappings when patternId ref changes', () => {
      const patternId = ref('S2.N1')
      const { bcCategories } = useSimulatedTestRunner(patternId)

      expect(bcCategories.value).toEqual(['BC.01'])

      patternId.value = 'S9.SG1'
      expect(bcCategories.value).toEqual(['BC.28'])
    })
  })
})
