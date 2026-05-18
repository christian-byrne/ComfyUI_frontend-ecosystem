import type { Ref } from 'vue'
/**
 * useTestRunner — W5.1 TestRunner composable
 *
 * Maps pattern_id to BC test categories and provides test execution state.
 * Currently uses a simulated test runner; will be wired to real vitest
 * harness in W5.2.
 *
 * @example
 *   const { state, runTest, canRun } = useTestRunner('S2.N1')
 *   if (canRun.value) await runTest()
 */
import { computed, ref } from 'vue'

export type TestState = 'idle' | 'running' | 'passed' | 'failed' | 'skipped'

export interface TestResult {
  state: TestState
  duration?: number
  error?: string
  testFile?: string
  assertions?: number
}

/**
 * Pattern ID to BC category mapping.
 * S = Surface family, maps to BC.xx test files.
 */
const PATTERN_TO_BC: Record<string, string[]> = {
  // S2 = Node lifecycle hooks
  'S2.N1': ['BC.01'],
  'S2.N2': ['BC.02'],
  'S2.N3': ['BC.07'],
  'S2.N4': ['BC.04'],
  'S2.N5': ['BC.04'],
  'S2.N6': ['BC.03'],
  'S2.N7': ['BC.03'],
  'S2.N9': ['BC.06'],
  'S2.N10': ['BC.04'],
  'S2.N12': ['BC.07'],
  'S2.N13': ['BC.07'],
  'S2.N14': ['BC.10'],
  'S2.N16': ['BC.11'],
  // S4 = Widget patterns
  'S4.W1': ['BC.10'],
  'S4.W3': ['BC.12'],
  'S4.W4': ['BC.11'],
  'S4.W5': ['BC.11'],
  // S9 = Subgraph patterns
  'S9.SG1': ['BC.28'],
  // S10 = Dynamic slots
  'S10.D1': ['BC.09'],
  'S10.D3': ['BC.09'],
  // S11 = Graph enumeration
  'S11.G2': ['BC.29'],
  // S14 = Cross-scope identity
  'S14.ID1': ['BC.29'],
  // S15 = Output slot sizing
  'S15.OS1': ['BC.09'],
  // S16 = DOM injection
  'S16.DOM1': ['BC.31'],
  'S16.DOM2': ['BC.31'],
  'S16.DOM3': ['BC.31'],
  'S16.DOM4': ['BC.31'],
  'S16.VUE1': ['BC.32']
}

/**
 * BC category to test file path mapping.
 */
const BC_TO_TEST_FILE: Record<string, string> = {
  'BC.01': 'src/extension-api-v2/__tests__/bc-01.v2.test.ts',
  'BC.02': 'src/extension-api-v2/__tests__/bc-02.v2.test.ts',
  'BC.03': 'src/extension-api-v2/__tests__/bc-03.v2.test.ts',
  'BC.04': 'src/extension-api-v2/__tests__/bc-04.v2.test.ts',
  'BC.06': 'src/extension-api-v2/__tests__/bc-06.v2.test.ts',
  'BC.07': 'src/extension-api-v2/__tests__/bc-07.v2.test.ts',
  'BC.09': 'src/extension-api-v2/__tests__/bc-09.v2.test.ts',
  'BC.10': 'src/extension-api-v2/__tests__/bc-10.v2.test.ts',
  'BC.11': 'src/extension-api-v2/__tests__/bc-11.v2.test.ts',
  'BC.12': 'src/extension-api-v2/__tests__/bc-12.v2.test.ts',
  'BC.28': 'src/extension-api-v2/__tests__/bc-28.v2.test.ts',
  'BC.29': 'src/extension-api-v2/__tests__/bc-29.v2.test.ts',
  'BC.31': 'src/extension-api-v2/__tests__/bc-31.v1.test.ts',
  'BC.32': 'src/extension-api-v2/__tests__/bc-32.v1.test.ts'
}

/**
 * Simulated test results for patterns.
 * Will be replaced with real vitest execution in W5.2.
 */
const SIMULATED_RESULTS: Record<string, TestState> = {
  'S2.N1': 'passed',
  'S2.N2': 'passed',
  'S2.N3': 'passed',
  'S4.W1': 'passed',
  'S9.SG1': 'passed',
  'S11.G2': 'passed',
  'S14.ID1': 'passed',
  'S16.DOM1': 'skipped', // fixture pending
  'S16.VUE1': 'skipped' // fixture pending
}

export function useTestRunner(patternId: Ref<string> | string) {
  const patternIdRef = typeof patternId === 'string' ? ref(patternId) : patternId

  const state = ref<TestState>('idle')
  const result = ref<TestResult | null>(null)

  /** BC categories this pattern maps to. */
  const bcCategories = computed(() => {
    return PATTERN_TO_BC[patternIdRef.value] ?? []
  })

  /** Test files for this pattern's BC categories. */
  const testFiles = computed(() => {
    return bcCategories.value.map((bc) => BC_TO_TEST_FILE[bc]).filter(Boolean)
  })

  /** Whether we have test coverage for this pattern. */
  const canRun = computed(() => testFiles.value.length > 0)

  /** Human-readable BC category string. */
  const bcLabel = computed(() => {
    if (bcCategories.value.length === 0) return 'No BC mapping'
    return bcCategories.value.join(', ')
  })

  /**
   * Run the v1↔v2 contract test for this pattern.
   * Currently simulated; will wire to vitest in W5.2.
   */
  async function runTest(): Promise<TestResult> {
    if (!canRun.value) {
      result.value = {
        state: 'skipped',
        error: 'No test mapping for this pattern'
      }
      state.value = 'skipped'
      return result.value
    }

    state.value = 'running'
    result.value = null

    // Simulate test execution delay
    const startTime = performance.now()
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400))
    const duration = Math.round(performance.now() - startTime)

    // Use simulated result or default to passed
    const simState = SIMULATED_RESULTS[patternIdRef.value] ?? 'passed'

    result.value = {
      state: simState,
      duration,
      testFile: testFiles.value[0],
      assertions: simState === 'passed' ? Math.floor(Math.random() * 10) + 3 : 0,
      error: simState === 'failed' ? 'Assertion failed (simulated)' : undefined
    }

    state.value = simState
    return result.value
  }

  /** Reset to idle state. */
  function reset() {
    state.value = 'idle'
    result.value = null
  }

  return {
    state,
    result,
    bcCategories,
    bcLabel,
    testFiles,
    canRun,
    runTest,
    reset
  }
}
