import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

import { useTestRunner } from '../useTestRunner'

describe('useTestRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('pattern to BC mapping', () => {
    it('maps S2.N1 to BC.01', () => {
      const { bcCategories, bcLabel } = useTestRunner('S2.N1')
      expect(bcCategories.value).toEqual(['BC.01'])
      expect(bcLabel.value).toBe('BC.01')
    })

    it('maps S9.SG1 to BC.28', () => {
      const { bcCategories } = useTestRunner('S9.SG1')
      expect(bcCategories.value).toEqual(['BC.28'])
    })

    it('returns empty array for unknown pattern', () => {
      const { bcCategories, bcLabel, canRun } = useTestRunner('UNKNOWN.X1')
      expect(bcCategories.value).toEqual([])
      expect(bcLabel.value).toBe('No BC mapping')
      expect(canRun.value).toBe(false)
    })
  })

  describe('test file mapping', () => {
    it('resolves test file path for known BC category', () => {
      const { testFiles } = useTestRunner('S2.N1')
      expect(testFiles.value).toContain(
        'src/extension-api-v2/__tests__/bc-01.v2.test.ts'
      )
    })

    it('returns empty array for unmapped pattern', () => {
      const { testFiles } = useTestRunner('UNKNOWN.X1')
      expect(testFiles.value).toEqual([])
    })
  })

  describe('canRun computed', () => {
    it('returns true when pattern has BC mapping', () => {
      const { canRun } = useTestRunner('S2.N1')
      expect(canRun.value).toBe(true)
    })

    it('returns false when pattern has no BC mapping', () => {
      const { canRun } = useTestRunner('UNKNOWN.X1')
      expect(canRun.value).toBe(false)
    })
  })

  describe('runTest', () => {
    it('sets state to running then resolves', async () => {
      const { state, runTest } = useTestRunner('S2.N1')
      expect(state.value).toBe('idle')

      const promise = runTest()
      expect(state.value).toBe('running')

      // Fast-forward past simulated delay
      await vi.advanceTimersByTimeAsync(1500)
      await promise

      expect(state.value).not.toBe('running')
    })

    it('returns result with duration and state', async () => {
      const { runTest } = useTestRunner('S2.N1')

      const promise = runTest()
      await vi.advanceTimersByTimeAsync(1500)
      const result = await promise

      expect(result.state).toBeDefined()
      expect(typeof result.duration).toBe('number')
    })

    it('returns skipped for unmapped patterns', async () => {
      const { runTest, state } = useTestRunner('UNKNOWN.X1')

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
      const { state, result, runTest, reset } = useTestRunner('S2.N1')

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
      const { bcCategories } = useTestRunner(patternId)

      expect(bcCategories.value).toEqual(['BC.01'])

      patternId.value = 'S9.SG1'
      expect(bcCategories.value).toEqual(['BC.28'])
    })
  })
})
