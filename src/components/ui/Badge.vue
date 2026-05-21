<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { cn } from '@/lib/cn'

/**
 * Badge — shadcn-style chip primitive (Wave-18 W18.D).
 *
 * Use for status pills, tags, count indicators, planned-surface labels.
 * Variants mirror the semantic color roles in
 * `src/design-system/system.md` §Color roles.
 *
 * `PlannedBadge.vue` is a thin back-compat wrapper around
 * `<Badge variant="planned">`.
 */
type Variant = 'neutral' | 'success' | 'warning' | 'danger' | 'planned'
type Size = 'xs' | 'sm'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    /** Render as a link when an `href` is given (matches PlannedBadge API). */
    href?: string
  }>(),
  {
    variant: 'neutral',
    size: 'xs'
  }
)

defineOptions({ inheritAttrs: false })
const attrs = useAttrs()

const VARIANTS: Record<Variant, string> = {
  neutral: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  success:
    'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  warning:
    'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  danger: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200',
  planned:
    'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200'
}

const SIZES: Record<Size, string> = {
  xs: 'px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
  sm: 'px-2 py-0.5 text-xs'
}

const badgeClass = computed(() =>
  cn(
    'inline-flex items-center gap-1 rounded font-medium',
    VARIANTS[props.variant],
    SIZES[props.size],
    (attrs.class as string | undefined) ?? ''
  )
)
</script>

<template>
  <a
    v-if="href"
    :href="href"
    :class="badgeClass"
    data-testid="badge"
    :data-variant="variant"
    v-bind="$attrs"
  >
    <slot />
  </a>
  <span
    v-else
    :class="badgeClass"
    data-testid="badge"
    :data-variant="variant"
    v-bind="$attrs"
  >
    <slot />
  </span>
</template>
