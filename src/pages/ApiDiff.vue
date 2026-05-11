<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { diffLines, type Change } from 'diff'

import { useApiSurface } from '../composables/useApiSurface'
import { MIGRATION_STATUS, type MigrationStatus } from '../data/migration-status'

const { loading, error, data, load } = useApiSurface()

onMounted(load)

/**
 * `diff` library output, one entry per hunk. Empty until data arrives.
 */
const hunks = computed<Change[]>(() => {
  if (!data.value) return []
  return diffLines(data.value.v1, data.value.v2)
})

/**
 * Detected v1 methods present in the fetched v1 source. Used to drive
 * the per-method badge legend at the top of the page.
 */
const detectedMethods = computed<string[]>(() => {
  if (!data.value) return []
  const out: string[] = []
  for (const name of Object.keys(MIGRATION_STATUS)) {
    const re = new RegExp(`\\b${name}\\b`)
    if (re.test(data.value.v1)) out.push(name)
  }
  return out
})

const STATUS_STYLES: Record<MigrationStatus, string> = {
  replaced: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  're-implemented': 'bg-sky-100 text-sky-800 ring-sky-200',
  'strangler-fig': 'bg-amber-100 text-amber-800 ring-amber-200',
  dropped: 'bg-rose-100 text-rose-800 ring-rose-200'
}

// ─── synced scroll ───────────────────────────────────────────────────────
// `syncing` lives in setup() so each component instance has its own
// re-entrancy guard — sharing the flag at module scope would cause
// cross-instance interference and prevent GC of detached elements.
const leftCol = ref<HTMLElement | null>(null)
const rightCol = ref<HTMLElement | null>(null)
let syncing = false

function bindSync(source: HTMLElement | null, target: HTMLElement | null) {
  if (!source || !target) return
  // useEventListener auto-removes on unmount — no manual cleanup needed.
  useEventListener(source, 'scroll', () => {
    if (syncing) return
    syncing = true
    target.scrollTop = source.scrollTop
    requestAnimationFrame(() => {
      syncing = false
    })
  })
}

watch([leftCol, rightCol], ([l, r]) => {
  bindSync(l, r)
  bindSync(r, l)
})
</script>

<template>
  <!-- TODO(N16b): per-MIGRATION_STATUS card layout — render one card per
       entry showing v1 signature ↔ v2 replacement instead of diffing two
       unrelated source files end-to-end. -->
  <section class="space-y-4">
    <header>
      <h1 class="text-2xl font-semibold text-zinc-900">
        API Diff — v1 ComfyExtension vs v2 declarations
      </h1>
      <p class="mt-1 text-sm text-zinc-500">
        Live fetch from
        <code class="text-xs">main</code> (v1) and
        <code class="text-xs">ext-api/i-foundation</code> (v2).
        Cached in <code class="text-xs">localStorage</code> for 24 hours.
      </p>
    </header>

    <div v-if="loading" class="text-sm text-zinc-500">Loading sources…</div>
    <div
      v-else-if="error"
      class="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
      data-testid="error"
    >
      Failed to load: {{ error.message }}
    </div>

    <template v-else-if="data">
      <div
        class="flex flex-wrap items-center gap-2"
        data-testid="method-badges"
      >
        <span class="text-xs font-medium text-zinc-500"
          >Detected v1 methods ({{ detectedMethods.length }}):</span
        >
        <span
          v-for="m in detectedMethods"
          :key="m"
          class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-mono ring-1"
          :class="STATUS_STYLES[MIGRATION_STATUS[m].status]"
          :title="MIGRATION_STATUS[m].note"
        >
          {{ m }}
          <span class="opacity-60">— {{ MIGRATION_STATUS[m].status }}</span>
        </span>
      </div>

      <div class="grid grid-cols-2 gap-4" data-testid="diff-grid">
        <div class="flex flex-col">
          <h2 class="mb-1 text-xs font-semibold uppercase text-zinc-500">
            v1 — comfy.ts
          </h2>
          <pre
            ref="leftCol"
            class="h-[70vh] overflow-auto rounded border border-zinc-200 bg-zinc-50 p-3 text-xs leading-snug font-mono"
          ><template v-for="(h, i) in hunks" :key="`l${i}`"><del
              v-if="h.removed"
              class="bg-rose-100 text-rose-900 no-underline"
            ><span class="sr-only">removed: </span>{{ h.value }}</del><span
              v-else-if="!h.added"
            >{{ h.value }}</span></template></pre>
        </div>

        <div class="flex flex-col">
          <h2 class="mb-1 text-xs font-semibold uppercase text-zinc-500">
            v2 — {{ data.v2Label }}
          </h2>
          <pre
            ref="rightCol"
            class="h-[70vh] overflow-auto rounded border border-zinc-200 bg-zinc-50 p-3 text-xs leading-snug font-mono"
          ><template v-for="(h, i) in hunks" :key="`r${i}`"><ins
              v-if="h.added"
              class="bg-emerald-100 text-emerald-900 no-underline"
            ><span class="sr-only">added: </span>{{ h.value }}</ins><span
              v-else-if="!h.removed"
            >{{ h.value }}</span></template></pre>
        </div>
      </div>
    </template>
  </section>
</template>
