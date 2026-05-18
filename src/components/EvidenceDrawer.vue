<script setup lang="ts">
import type { EvidenceRow } from '@/data/schema'

import { nextTick, useTemplateRef, watch } from 'vue'

const props = defineProps<{
  open: boolean
  patternId: string | null
  pack: string | null
  evidence: EvidenceRow[]
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

// First focusable element inside the drawer (the close button).
// We move keyboard focus here when the drawer opens so the user is
// not stranded back on the heatmap cell behind the modal scrim.
const closeBtnRef = useTemplateRef<HTMLButtonElement>('closeBtnRef')

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    await nextTick()
    closeBtnRef.value?.focus()
  },
  { immediate: true }
)

// Track keydown on the dialog so we can close on Escape without
// needing a global listener. Vue's `.esc` modifier also handles this
// but we keep it on the host element for tighter scoping.
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
  }
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-40 flex print:hidden"
    role="dialog"
    aria-modal="true"
    :aria-label="`Evidence for ${patternId} in ${pack}`"
    tabindex="-1"
    data-testid="evidence-drawer-root"
    @keydown="onKeydown"
  >
    <div class="flex-1 bg-zinc-900/30" data-testid="drawer-backdrop" @click="emit('close')" />
    <aside
      class="w-full max-w-xl h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 overflow-y-auto"
      data-testid="evidence-drawer"
    >
      <header
        class="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-5 py-4 flex items-start justify-between gap-4"
      >
        <div>
          <p class="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Evidence</p>
          <h2 class="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {{ patternId }}
            <span class="text-zinc-400 dark:text-zinc-500">·</span> {{ pack }}
          </h2>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {{ evidence.length }} row{{ evidence.length === 1 ? '' : 's' }}
          </p>
        </div>
        <button
          ref="closeBtnRef"
          class="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-sm focus:outline-2 focus:outline-zinc-900"
          aria-label="Close evidence drawer"
          data-testid="drawer-close"
          @click="emit('close')"
        >
          ✕
        </button>
      </header>
      <ol class="divide-y divide-zinc-100 text-sm">
        <li
          v-for="(row, i) in evidence"
          :key="`${row.file}:${row.lines?.[0] ?? i}`"
          class="px-5 py-3"
        >
          <a
            v-if="row.url"
            :href="row.url"
            target="_blank"
            rel="noopener"
            class="font-mono text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 break-all"
            >{{ row.file
            }}<span v-if="row.lines?.length" class="text-zinc-400 dark:text-zinc-500"
              >:{{ row.lines.join(',') }}</span
            ></a
          >
          <span v-else class="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all">
            {{ row.file
            }}<span v-if="row.lines?.length" class="text-zinc-400 dark:text-zinc-500"
              >:{{ row.lines.join(',') }}</span
            >
          </span>
          <div v-if="row.variant || row.breakage_class" class="mt-1 flex gap-2 text-[11px]">
            <span
              v-if="row.variant"
              class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              >{{ row.variant }}</span
            >
            <span
              v-if="row.breakage_class"
              class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              >{{ row.breakage_class }}</span
            >
          </div>
        </li>
        <li v-if="evidence.length === 0" class="px-5 py-6 text-zinc-500 dark:text-zinc-400 italic">
          No evidence rows for this cell.
        </li>
      </ol>
    </aside>
  </div>
</template>
