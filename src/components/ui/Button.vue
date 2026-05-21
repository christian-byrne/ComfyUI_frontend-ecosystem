<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { cn } from '@/lib/cn'

/**
 * Button — shadcn-style primitive (Wave-18 W18.D).
 *
 * Use anywhere a click action is needed instead of inline
 * `<button class="...">` blocks. Variants mirror the role map in
 * `src/design-system/system.md` §Color roles.
 *
 * All native button attributes (`@click`, `aria-*`, `form`, …) pass
 * through via `useAttrs`. `disabled` is forwarded to the underlying
 * element as well as gated by class.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    /** Visual treatment. */
    variant?: Variant
    /** Density. */
    size?: Size
    /** Disabled state — sets `disabled` attribute + class. */
    disabled?: boolean
    /** Replace label with spinner; auto-disables clicks. */
    loading?: boolean
    /** Native `type` (default `button` — avoids accidental form submits). */
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'primary',
    size: 'md',
    disabled: false,
    loading: false,
    type: 'button'
  }
)

defineOptions({ inheritAttrs: false })
const attrs = useAttrs()

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 border border-transparent',
  secondary:
    'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700',
  ghost:
    'bg-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 border border-transparent',
  danger:
    'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400 border border-transparent'
}

const SIZES: Record<Size, string> = {
  sm: 'px-2 py-1 text-xs gap-1',
  md: 'px-3 py-1.5 text-sm gap-1.5',
  lg: 'px-4 py-2 text-sm gap-2'
}

const isInactive = computed(() => props.disabled || props.loading)

const buttonClass = computed(() =>
  cn(
    'inline-flex items-center justify-center rounded-md font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[props.variant],
    SIZES[props.size],
    (attrs.class as string | undefined) ?? ''
  )
)
</script>

<template>
  <button
    :type="type"
    :disabled="isInactive"
    :class="buttonClass"
    :data-loading="loading || undefined"
    v-bind="$attrs"
  >
    <span
      v-if="loading"
      class="inline-block size-3 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden="true"
      data-testid="button-spinner"
    />
    <slot />
  </button>
</template>
