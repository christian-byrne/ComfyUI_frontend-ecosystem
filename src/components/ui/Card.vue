<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { cn } from '@/lib/cn'

/**
 * Card — shadcn-style boxed surface (Wave-18 W18.D).
 *
 * Replaces inline `<div class="rounded-lg border border-zinc-200 dark:border-zinc-800 ...">`
 * blocks repeated across the dashboard. Depth strategy is **borders-only**;
 * no shadows on the standard scale.
 *
 * - `variant=default`  — border + bg-elevated (most cases)
 * - `variant=sunken`   — bg-page tone, no border (recessed slots)
 * - `variant=outlined` — border only, no bg (transparent inside another surface)
 *
 * `tone` paints a *left-border accent* in the matching semantic color
 * (warning / success / danger / planned). Default keeps the neutral
 * zinc border.
 */
type Variant = 'default' | 'sunken' | 'outlined'
type Padding = 'none' | 'sm' | 'md' | 'lg'
type Tone = 'default' | 'warning' | 'success' | 'danger' | 'planned'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    padding?: Padding
    tone?: Tone
    /** Element tag — useful when wrapping `<article>`, `<section>`, etc. */
    as?: keyof HTMLElementTagNameMap
  }>(),
  {
    variant: 'default',
    padding: 'md',
    tone: 'default',
    as: 'div'
  }
)

defineOptions({ inheritAttrs: false })
const attrs = useAttrs()

const VARIANTS: Record<Variant, string> = {
  default:
    'border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900',
  sunken: 'bg-zinc-50 dark:bg-zinc-950',
  outlined: 'border border-zinc-200 dark:border-zinc-800'
}

const PADDINGS: Record<Padding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6'
}

// Tones add a 4px coloured left border on top of any base border.
const TONES: Record<Tone, string> = {
  default: '',
  warning: 'border-l-4 border-l-amber-500 dark:border-l-amber-400',
  success: 'border-l-4 border-l-emerald-500 dark:border-l-emerald-400',
  danger: 'border-l-4 border-l-red-500 dark:border-l-red-400',
  planned: 'border-l-4 border-l-violet-500 dark:border-l-violet-400'
}

const cardClass = computed(() =>
  cn(
    'rounded-lg',
    VARIANTS[props.variant],
    PADDINGS[props.padding],
    TONES[props.tone],
    (attrs.class as string | undefined) ?? ''
  )
)
</script>

<template>
  <component :is="as" :class="cardClass" data-testid="card" v-bind="$attrs">
    <header v-if="$slots.header" class="mb-3">
      <slot name="header" />
    </header>
    <slot />
    <footer v-if="$slots.footer" class="mt-3">
      <slot name="footer" />
    </footer>
  </component>
</template>
