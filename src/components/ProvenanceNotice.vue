<script setup lang="ts">
import { computed } from 'vue'

import {
  localCategoryCount,
  localEvidenceCount,
  localPatternCount,
  MISSING_UPSTREAM_IDS,
  missingCategoryCount,
  missingPatternCount,
  reauditGrowth,
  starCacheAsofOldest,
  UPSTREAM_CATEGORY_COUNT,
  UPSTREAM_PATTERN_COUNT,
  V2_STATUS
} from '@/data/provenance'

/**
 * ProvenanceNotice — a standing "do not read these numbers as complete" callout.
 *
 * Two independent understatements affect every figure in this dashboard, and
 * before this component neither was visible anywhere in the UI:
 *
 *  1. the bundle is one workspace-amend behind upstream (missing patterns and
 *     a behavior category), and
 *  2. evidence counts are 5-13x below what the W2F-1 re-audit found, because
 *     those corrections were never back-propagated.
 *
 * Rendered collapsed by default so it informs without dominating the page.
 * All figures come from `@/data/provenance`, which derives the "here" side from
 * the bundled data rather than hardcoding it.
 */
const props = withDefaults(
  defineProps<{
    /** Also show the deferred-v2 / retired-compat-floor block. */
    v2?: boolean
    /** Start expanded. */
    open?: boolean
  }>(),
  { v2: false, open: false }
)

const summary = computed(() =>
  props.v2
    ? 'Data provenance — counts are a floor, and v2 is deferred'
    : 'Data provenance — these counts are a floor, not a measurement'
)
</script>

<template>
  <details
    :open="props.open"
    data-testid="provenance-notice"
    class="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
  >
    <summary
      class="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wide"
    >
      ⚠️ {{ summary }}
    </summary>

    <div class="space-y-3 border-t border-amber-200 dark:border-amber-900 px-3 py-3 text-xs">
      <p>
        <strong>One workspace-amend behind upstream.</strong>
        This bundle has
        <strong class="tabular-nums">{{ localPatternCount }}</strong> patterns against upstream's
        <strong class="tabular-nums">{{ UPSTREAM_PATTERN_COUNT }}</strong>
        ({{ missingPatternCount }} missing) and
        <strong class="tabular-nums">{{ localCategoryCount }}</strong> behavior categories against
        <strong class="tabular-nums">{{ UPSTREAM_CATEGORY_COUNT }}</strong>
        ({{ missingCategoryCount }} missing). Absent here:
        <code class="break-words">{{ MISSING_UPSTREAM_IDS.join(', ') }}</code
        >.
      </p>

      <p>
        <strong>Evidence counts are {{ reauditGrowth.min }}–{{ reauditGrowth.max }}× low.</strong>
        The W2F-1 re-audit re-counted
        <strong class="tabular-nums">{{ reauditGrowth.surfaces }}</strong> surfaces and found far
        more real usage than the original sweep recorded (worst case
        <code>{{ reauditGrowth.worst }}</code
        >). Those corrections live in <code>litegraph-audit.json → reauditDelta</code> and were
        <strong>never back-propagated</strong> into the touch-points database. So the
        <strong class="tabular-nums">{{ localEvidenceCount }}</strong> evidence rows, every
        <code>occurrences</code>, every <code>blast_radius</code> and every
        <code>usage_weight</code> in the bundled data are floors. Relative ranking is still
        informative; absolute magnitudes are not.
      </p>

      <p>
        <strong>Star data staleness floor:</strong> the oldest row in the star cache is from
        <code>{{ starCacheAsofOldest }}</code
        >.
      </p>

      <template v-if="props.v2">
        <p class="border-t border-amber-200 dark:border-amber-900 pt-3">
          <strong>{{ V2_STATUS.headline }}.</strong> {{ V2_STATUS.detail }}
        </p>
        <p>
          <strong>Compat floor: RETIRED (wave-10).</strong> {{ V2_STATUS.compatFloorDetail }}
          <RouterLink :to="V2_STATUS.compatFloorRef" class="underline underline-offset-2">
            See the axioms →
          </RouterLink>
        </p>
      </template>
    </div>
  </details>
</template>
