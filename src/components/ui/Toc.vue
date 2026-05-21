<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/lib/cn'

/**
 * Toc — table of contents primitive (Wave-18 W18.F).
 *
 * Pairs with `useToc()` to render a sticky nav of h2/h3 headings on
 * `lg+`, and a collapsible `<details>` accordion on smaller
 * viewports.
 */
export interface TocItem {
  id: string
  title: string
  depth: number
}

const props = withDefaults(
  defineProps<{
    items: TocItem[]
    /** Optional active heading id — highlights the matching link. */
    currentId?: string
    /** Apply `sticky top-20` to the desktop nav (default true). */
    sticky?: boolean
    /** Heading shown above the link list. */
    title?: string
  }>(),
  {
    currentId: undefined,
    sticky: true,
    title: 'On this page'
  }
)

const wrapperClass = computed(() =>
  cn(
    'hidden lg:block w-56 shrink-0',
    props.sticky && 'lg:sticky lg:top-20 lg:self-start'
  )
)

function linkClass(item: TocItem) {
  const isActive = props.currentId === item.id
  return cn(
    'block py-1 text-sm border-l-2 -ml-px pl-3',
    item.depth >= 3 && 'pl-6 text-[13px]',
    isActive
      ? 'border-blue-500 text-zinc-900 dark:text-zinc-100 font-medium'
      : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700'
  )
}
</script>

<template>
  <!-- Desktop sticky sidebar -->
  <nav
    :class="wrapperClass"
    aria-label="Table of contents"
    data-testid="toc-desktop"
  >
    <p
      class="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
    >
      {{ title }}
    </p>
    <ul class="border-l border-zinc-200 dark:border-zinc-800">
      <li v-for="item in items" :key="item.id" :data-depth="item.depth">
        <a :href="`#${item.id}`" :class="linkClass(item)">
          {{ item.title }}
        </a>
      </li>
    </ul>
  </nav>

  <!-- Mobile accordion fallback -->
  <details
    class="lg:hidden mb-6 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
    data-testid="toc-mobile"
  >
    <summary
      class="cursor-pointer select-none px-3 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100"
    >
      {{ title }}
    </summary>
    <ul class="px-3 pb-3 border-l border-zinc-200 dark:border-zinc-800 ml-3">
      <li v-for="item in items" :key="item.id" :data-depth="item.depth">
        <a :href="`#${item.id}`" :class="linkClass(item)">
          {{ item.title }}
        </a>
      </li>
    </ul>
  </details>
</template>
