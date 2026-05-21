<script setup lang="ts">
import { computed } from 'vue'

/**
 * PlannedBadge — small shadcn-style chip indicating a page/surface that is
 * documented but not yet shipped at the Phase A freeze.
 *
 * Drop on any MDX/page that describes a planned-but-not-built surface so the
 * reader instantly sees the deferral and (optionally) jumps to the ADR/PR
 * that explains it.
 *
 * Variants:
 * - `phase-b`        → amber  "Phase B"          (deferred to Phase B work)
 * - `ecs-pr-11939`   → violet "ECS (PR #11939)"  (blocked on Alex's ECS rebase)
 * - `hypothetical`   → gray   "Hypothetical"     (illustrative only)
 *
 * Conventions match NodePackBanner.vue / EvidenceDrawer.vue: Tailwind utility
 * classes, dark-mode variants, single-file `<script setup lang="ts">`.
 */
type PlannedVariant = 'phase-b' | 'ecs-pr-11939' | 'hypothetical'

const props = defineProps<{
  /** Drives label and color. */
  variant: PlannedVariant
  /** Optional native title= tooltip. */
  tooltip?: string
  /** Optional href — when present the chip renders as an <a>, else a <span>. */
  href?: string
}>()

interface VariantSpec {
  label: string
  classes: string
}

const VARIANTS: Record<PlannedVariant, VariantSpec> = {
  'phase-b': {
    label: 'Phase B',
    classes:
      'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-amber-200/60 dark:ring-amber-700/40'
  },
  'ecs-pr-11939': {
    label: 'ECS (PR #11939)',
    classes:
      'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-violet-200/60 dark:ring-violet-700/40'
  },
  hypothetical: {
    label: 'Hypothetical',
    classes:
      'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 ring-zinc-200/60 dark:ring-zinc-700/40'
  }
}

const spec = computed(() => VARIANTS[props.variant])

const baseClasses =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset transition-colors'

const linkHoverClasses =
  'hover:ring-zinc-400/60 dark:hover:ring-zinc-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1'
</script>

<template>
  <a
    v-if="href"
    :href="href"
    :title="tooltip"
    :class="[baseClasses, spec.classes, linkHoverClasses]"
    data-testid="planned-badge"
  >
    <span aria-hidden="true">○</span>
    <span>{{ spec.label }}</span>
  </a>
  <span v-else :title="tooltip" :class="[baseClasses, spec.classes]" data-testid="planned-badge">
    <span aria-hidden="true">○</span>
    <span>{{ spec.label }}</span>
  </span>
</template>
