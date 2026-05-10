<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useElementHover } from '@vueuse/core'

import EvidenceDrawer from '@/components/EvidenceDrawer.vue'
import { useHeatmap, type HeatmapCell } from '@/composables/useHeatmap'

const { matrix, cellAt } = useHeatmap()

// ──────────────────────────────────────────────────────────────────
// Color ramp: zinc-50 (#fafafa) → zinc-900 (#18181b)
// ──────────────────────────────────────────────────────────────────
const ZINC_50 = [250, 250, 250] as const
const ZINC_900 = [24, 24, 27] as const

const logScale = ref(false)

function intensity(count: number, max: number): number {
  if (max <= 0 || count <= 0) return 0
  if (!logScale.value) return count / max
  return Math.log1p(count) / Math.log1p(max)
}

function rampColor(count: number, max: number): string {
  const t = intensity(count, max)
  if (t === 0) return 'rgb(250 250 250)' // zinc-50 baseline for empty cells
  const r = Math.round(ZINC_50[0] + (ZINC_900[0] - ZINC_50[0]) * t)
  const g = Math.round(ZINC_50[1] + (ZINC_900[1] - ZINC_50[1]) * t)
  const b = Math.round(ZINC_50[2] + (ZINC_900[2] - ZINC_50[2]) * t)
  return `rgb(${r} ${g} ${b})`
}

function textColor(count: number, max: number): string {
  // Flip to white once the cell is dark enough to keep contrast readable.
  return intensity(count, max) > 0.55 ? 'rgb(250 250 250)' : 'rgb(63 63 70)'
}

// ──────────────────────────────────────────────────────────────────
// Hover tooltip — `useElementHover` gates tooltip visibility, while
// per-cell mouseenter sets the active cell for content.
// ──────────────────────────────────────────────────────────────────
const gridRef = useTemplateRef<HTMLElement>('gridRef')
const gridHovered = useElementHover(gridRef)
const hoveredCell = ref<{ patternId: string; pack: string; count: number } | null>(null)

function onCellEnter(patternId: string, pack: string): void {
  const c = cellAt(patternId, pack)
  hoveredCell.value = { patternId, pack, count: c?.count ?? 0 }
}
function onCellLeave(): void {
  hoveredCell.value = null
}

const showTooltip = computed(() => gridHovered.value && hoveredCell.value !== null)

// ──────────────────────────────────────────────────────────────────
// Drawer state — opened on cell click.
// ──────────────────────────────────────────────────────────────────
const drawerOpen = ref(false)
const drawerCell = ref<HeatmapCell | null>(null)

function onCellClick(patternId: string, pack: string): void {
  const c = cellAt(patternId, pack)
  drawerCell.value =
    c ?? { patternId, pack, count: 0, evidence: [] }
  drawerOpen.value = true
}
function closeDrawer(): void {
  drawerOpen.value = false
}

// Truncate long pattern/pack labels for axis cells.
function truncate(s: string, n = 28): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}
</script>

<template>
  <section class="space-y-4">
    <header class="flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          Pattern × Pack Heatmap
        </h1>
        <p class="text-sm text-zinc-600">
          Rows: {{ matrix.patterns.length }} patterns sorted by blast radius (desc).
          Columns: top {{ matrix.packs.length }} packs by total evidence.
          Cell intensity: evidence count
          <span class="font-mono text-xs">(max {{ matrix.max }})</span>.
        </p>
      </div>
      <label class="inline-flex items-center gap-2 text-sm text-zinc-700 print:hidden">
        <input
          v-model="logScale"
          type="checkbox"
          class="size-4 accent-zinc-900"
          data-testid="log-scale-toggle"
        />
        log-scale color ramp
      </label>
    </header>

    <div class="relative overflow-auto border border-zinc-200 rounded">
      <div
        ref="gridRef"
        class="heatmap-grid inline-grid text-xs"
        :style="{
          gridTemplateColumns: `minmax(220px, max-content) repeat(${matrix.packs.length}, minmax(28px, 1fr))`
        }"
        data-testid="heatmap-grid"
      >
        <!-- Header row: empty corner + pack labels -->
        <div class="sticky top-0 left-0 z-20 bg-white border-b border-r border-zinc-200" />
        <div
          v-for="pack in matrix.packs"
          :key="`h-${pack}`"
          class="sticky top-0 z-10 bg-white border-b border-zinc-200 p-1.5 text-zinc-700 font-mono text-[10px] leading-tight align-bottom"
          :title="pack"
        >
          <div class="origin-bottom-left -rotate-45 whitespace-nowrap translate-y-2">
            {{ truncate(pack.split('/').pop() ?? pack, 22) }}
          </div>
        </div>

        <!-- Body rows: pattern label + cells -->
        <template v-for="row in matrix.patterns" :key="`r-${row.pattern_id}`">
          <div
            class="sticky left-0 z-10 bg-white border-r border-zinc-200 px-2 py-1 font-mono text-[11px] text-zinc-800 whitespace-nowrap"
            :title="`${row.pattern_id} — ${row.name} (blast ${row.blast_radius.toFixed(2)})`"
          >
            <span class="text-zinc-500">{{ row.pattern_id }}</span>
            <span class="text-zinc-400 mx-1">·</span>
            <span>{{ truncate(row.name, 32) }}</span>
          </div>
          <button
            v-for="pack in matrix.packs"
            :key="`c-${row.pattern_id}-${pack}`"
            type="button"
            class="heatmap-cell h-7 border-b border-r border-zinc-100 cursor-pointer focus:outline-2 focus:outline-zinc-900 focus:z-10 print:bg-white! print:border-zinc-200"
            :style="{
              backgroundColor: rampColor(cellAt(row.pattern_id, pack)?.count ?? 0, matrix.max),
              color: textColor(cellAt(row.pattern_id, pack)?.count ?? 0, matrix.max)
            }"
            :data-pattern="row.pattern_id"
            :data-pack="pack"
            :data-count="cellAt(row.pattern_id, pack)?.count ?? 0"
            :aria-label="`${row.pattern_id} in ${pack}: ${cellAt(row.pattern_id, pack)?.count ?? 0} evidence rows`"
            @mouseenter="onCellEnter(row.pattern_id, pack)"
            @mouseleave="onCellLeave"
            @focus="onCellEnter(row.pattern_id, pack)"
            @blur="onCellLeave"
            @click="onCellClick(row.pattern_id, pack)"
          >
            <span
              v-if="(cellAt(row.pattern_id, pack)?.count ?? 0) > 0"
              class="text-[10px] font-mono leading-none print:text-zinc-700"
            >{{ cellAt(row.pattern_id, pack)?.count }}</span>
          </button>
        </template>
      </div>

      <!-- Hover tooltip -->
      <div
        v-if="showTooltip && hoveredCell"
        class="pointer-events-none absolute top-2 right-2 z-30 bg-zinc-900 text-zinc-50 text-xs rounded px-2 py-1.5 shadow-md print:hidden"
        data-testid="heatmap-tooltip"
        role="tooltip"
      >
        <span class="font-mono">{{ hoveredCell.patternId }}</span>
        <span class="text-zinc-400 mx-1">·</span>
        <span class="font-mono">{{ hoveredCell.pack }}</span>
        <span class="text-zinc-400 mx-1">·</span>
        <span>{{ hoveredCell.count }} row{{ hoveredCell.count === 1 ? '' : 's' }}</span>
      </div>
    </div>

    <EvidenceDrawer
      :open="drawerOpen"
      :pattern-id="drawerCell?.patternId ?? null"
      :pack="drawerCell?.pack ?? null"
      :evidence="drawerCell?.evidence ?? []"
      @close="closeDrawer"
    />
  </section>
</template>

<style scoped>
/* Print-friendly grayscale: neutralize cell colors when printing. */
@media print {
  .heatmap-cell {
    background-color: white !important;
    color: rgb(63 63 70) !important;
    border-color: rgb(228 228 231) !important;
  }
}
</style>
