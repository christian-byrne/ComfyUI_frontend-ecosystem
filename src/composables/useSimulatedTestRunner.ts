import type { Ref } from 'vue'
import { computed, ref } from 'vue'

import { PATTERN_TO_BC } from '@/data/pattern-bc-map'

/**
 * useSimulatedTestRunner — a **fake** test runner for the pattern-detail page.
 *
 * ## READ THIS BEFORE TRUSTING ANY NUMBER THIS PRODUCES
 *
 * Nothing here executes a test. There is no vitest harness on the other end of
 * `runTest()`. What it actually does:
 *
 * 1. waits 800-1200 ms on a `setTimeout` and calls that a "duration";
 * 2. looks the pattern up in {@link SIMULATED_RESULTS}, a nine-entry hardcoded
 *    table;
 * 3. **defaults every pattern not in that table to `'passed'`** — so 64 of the
 *    73 patterns report a green tick that means only "we have no data";
 * 4. invents an assertion count with `Math.random()`.
 *
 * It was written as W5.1 scaffolding with "will be wired to a real vitest
 * harness in W5.2" in the docblock. W5.2 never happened, and the v2 extension
 * API rewrite the harness was for is now **deferred** — so this will stay
 * simulated for the foreseeable future. Hence the rename (it was
 * `useTestRunner`, which read as real) and {@link IS_SIMULATED}, which the UI
 * uses to render an unmissable banner.
 *
 * The pattern→BC mapping is the one part that is real: it is derived from
 * `behavior-categories.json` via `@/data/pattern-bc-map`, not hand-maintained.
 *
 * @example
 *   const { state, runTest, canRun } = useSimulatedTestRunner('S2.N1')
 *   if (canRun.value) await runTest()
 */

/**
 * Hard flag: these results are fabricated. Consumers MUST surface this.
 * Exported as a const rather than inlined so a grep for `IS_SIMULATED` finds
 * every place that renders fake data.
 */
export const IS_SIMULATED = true as const

/** Banner copy, kept next to the flag so the two cannot drift apart. */
export const SIMULATED_NOTICE =
  'Simulated — no tests are executed. Results are a hardcoded table with a ' +
  'setTimeout delay; unlisted patterns always report "passed". The real ' +
  'vitest harness (W5.2) was never built and the v2 API work it targeted is deferred.'

export type TestState = 'idle' | 'running' | 'passed' | 'failed' | 'skipped'

export interface TestResult {
  state: TestState
  /** Wall-clock ms spent in the artificial delay — NOT a test duration. */
  duration?: number
  error?: string
  testFile?: string
  /** Fabricated via Math.random(). Not a count of anything. */
  assertions?: number
  /** Always true. Present on the object so callers cannot ignore it. */
  simulated: true
}

/**
 * BC category → upstream test-stub path.
 *
 * Hand-maintained on purpose: this is the set of stubs actually *published* on
 * the upstream branch, which is a smaller and slower-moving set than the 41
 * behavior categories. A category absent here has no stub yet, so `canRun` is
 * false for its patterns — which is the honest answer.
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
 * The entire "test result" corpus. Nine entries. Everything else defaults to
 * `'passed'` — see the class comment; that default is the reason this
 * composable is named "simulated".
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

export function useSimulatedTestRunner(patternId: Ref<string> | string) {
  const patternIdRef = typeof patternId === 'string' ? ref(patternId) : patternId

  const state = ref<TestState>('idle')
  const result = ref<TestResult | null>(null)

  /** BC categories this pattern maps to (derived from behavior-categories.json). */
  const bcCategories = computed(() => PATTERN_TO_BC[patternIdRef.value] ?? [])

  /** Published upstream stubs for this pattern's BC categories. */
  const testFiles = computed(() =>
    bcCategories.value.map((bc) => BC_TO_TEST_FILE[bc]).filter(Boolean)
  )

  /** Whether a stub exists to pretend to run. */
  const canRun = computed(() => testFiles.value.length > 0)

  /** Human-readable BC category string. */
  const bcLabel = computed(() => {
    if (bcCategories.value.length === 0) return 'No BC mapping'
    return bcCategories.value.join(', ')
  })

  /**
   * Pretend to run the v1↔v2 contract test for this pattern.
   *
   * Returns fabricated data. See {@link SIMULATED_NOTICE}.
   */
  async function runTest(): Promise<TestResult> {
    if (!canRun.value) {
      result.value = {
        state: 'skipped',
        error: 'No test mapping for this pattern',
        simulated: true
      }
      state.value = 'skipped'
      return result.value
    }

    state.value = 'running'
    result.value = null

    // Artificial delay so the UI has something to animate. Not a measurement.
    const startTime = performance.now()
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400))
    const duration = Math.round(performance.now() - startTime)

    const simState = SIMULATED_RESULTS[patternIdRef.value] ?? 'passed'

    result.value = {
      state: simState,
      duration,
      testFile: testFiles.value[0],
      assertions: simState === 'passed' ? Math.floor(Math.random() * 10) + 3 : 0,
      error: simState === 'failed' ? 'Assertion failed (simulated)' : undefined,
      simulated: true
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
    reset,
    isSimulated: IS_SIMULATED,
    simulatedNotice: SIMULATED_NOTICE
  }
}
