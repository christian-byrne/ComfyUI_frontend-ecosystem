<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { cn } from '@/lib/cn'

/**
 * CodeChip — inline `<code>` chip (Wave-18 W18.D).
 *
 * Trivial wrapper that eliminates the repeated
 * `class="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-mono text-xs"`
 * pattern duplicated across 10+ sites in the dashboard.
 */
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()

const chipClass = computed(() =>
  cn(
    'rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-mono text-xs',
    (attrs.class as string | undefined) ?? ''
  )
)
</script>

<template>
  <code :class="chipClass" data-testid="code-chip" v-bind="$attrs">
    <slot />
  </code>
</template>
