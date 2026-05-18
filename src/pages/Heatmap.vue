<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useElementHover } from "@vueuse/core";
import { useHead } from "@unhead/vue";

import EvidenceDrawer from "@/components/EvidenceDrawer.vue";
import { useHeatmap, type HeatmapCell } from "@/composables/useHeatmap";

useHead({
  title: "Heatmap - ComfyUI Frontend Ecosystem",
});

const { matrix, cellAt, cellsByRowCol, cellKey } = useHeatmap();

// ──────────────────────────────────────────────────────────────────
// Pre-rendered per-cell display rows. The composable's `cellsByRowCol`
// Map is computed once per data change (review #3), and we additionally
// hoist the per-cell lookup + style derivation into a single pass so
// the template performs ONE lookup per cell instead of 6.
// ──────────────────────────────────────────────────────────────────
interface CellView {
  key: string;
  pack: string;
  count: number;
  ariaLabel: string;
  style: { backgroundColor: string; color: string };
}
interface RowView {
  pattern: (typeof matrix.value.patterns)[number];
  cells: CellView[];
}

const displayRows = computed<RowView[]>(() => {
  const m = matrix.value;
  const byKey = cellsByRowCol.value;
  const max = m.max;
  return m.patterns.map((row) => ({
    pattern: row,
    cells: m.packs.map((pack) => {
      const cell = byKey.get(cellKey(row.pattern_id, pack));
      const count = cell?.count ?? 0;
      return {
        key: `c-${row.pattern_id}-${pack}`,
        pack,
        count,
        ariaLabel: `${row.pattern_id} in ${pack}: ${count} evidence rows`,
        style: {
          backgroundColor: rampColor(count, max),
          color: textColor(count, max),
        },
      };
    }),
  }));
});

// ──────────────────────────────────────────────────────────────────
// Color ramp: zinc-50 (#fafafa) → zinc-900 (#18181b)
// ──────────────────────────────────────────────────────────────────
const ZINC_50 = [250, 250, 250] as const;
const ZINC_900 = [24, 24, 27] as const;

// Truncation limits for axis labels
const TRUNCATE_ROW_LABEL = 32;
const TRUNCATE_COL_LABEL = 22;
const TRUNCATE_DEFAULT = 28;

// Contrast threshold for switching to light text on dark backgrounds
const CONTRAST_FLIP_THRESHOLD = 0.55;

const logScale = ref(false);

function intensity(count: number, max: number): number {
  if (max <= 0 || count <= 0) return 0;
  if (!logScale.value) return count / max;
  return Math.log1p(count) / Math.log1p(max);
}

function rampColor(count: number, max: number): string {
  const t = intensity(count, max);
  if (t === 0) return "rgb(250 250 250)"; // zinc-50 baseline for empty cells
  const r = Math.round(ZINC_50[0] + (ZINC_900[0] - ZINC_50[0]) * t);
  const g = Math.round(ZINC_50[1] + (ZINC_900[1] - ZINC_50[1]) * t);
  const b = Math.round(ZINC_50[2] + (ZINC_900[2] - ZINC_50[2]) * t);
  return `rgb(${r} ${g} ${b})`;
}

function textColor(count: number, max: number): string {
  // Flip to white once the cell is dark enough to keep contrast readable.
  return intensity(count, max) > CONTRAST_FLIP_THRESHOLD
    ? "rgb(250 250 250)"
    : "rgb(63 63 70)";
}

// ──────────────────────────────────────────────────────────────────
// Hover tooltip — `useElementHover` gates tooltip visibility, while
// per-cell mouseenter sets the active cell for content.
// ──────────────────────────────────────────────────────────────────
const gridRef = useTemplateRef<HTMLElement>("gridRef");
const gridHovered = useElementHover(gridRef);
const hoveredCell = ref<{
  patternId: string;
  pack: string;
  count: number;
} | null>(null);

function onCellEnter(patternId: string, pack: string): void {
  const c = cellAt(patternId, pack);
  hoveredCell.value = { patternId, pack, count: c?.count ?? 0 };
}
function onCellLeave(): void {
  hoveredCell.value = null;
}

const showTooltip = computed(
  () => gridHovered.value && hoveredCell.value !== null,
);

// ──────────────────────────────────────────────────────────────────
// Drawer state — opened on cell click. Track the triggering cell so
// focus can be restored to it when the drawer closes (a11y: drawer
// keyboard return-focus contract).
// ──────────────────────────────────────────────────────────────────
const drawerOpen = ref(false);
const drawerCell = ref<HeatmapCell | null>(null);
const drawerTrigger = ref<HTMLElement | null>(null);

function onCellClick(patternId: string, pack: string, ev: MouseEvent): void {
  const c = cellAt(patternId, pack);
  drawerCell.value = c ?? { patternId, pack, count: 0, evidence: [] };
  drawerTrigger.value = ev.currentTarget as HTMLElement | null;
  drawerOpen.value = true;
}
function closeDrawer(): void {
  drawerOpen.value = false;
  // Return focus to the cell that opened the drawer.
  const trigger = drawerTrigger.value;
  drawerTrigger.value = null;
  if (trigger) {
    // Defer to next microtask so the drawer's own focus handlers don't fight us.
    queueMicrotask(() => trigger.focus());
  }
}

// Truncate long pattern/pack labels for axis cells.
function truncate(s: string, n = TRUNCATE_DEFAULT): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
</script>

<template>
  <section class="space-y-4">
    <header class="flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          Pattern × Pack Heatmap
        </h1>
        <p class="text-sm text-zinc-600 dark:text-zinc-400">
          Rows: {{ matrix.patterns.length }} patterns sorted by blast radius
          (desc). Columns: top {{ matrix.packs.length }} packs by total
          evidence. Cell intensity: evidence count
          <span class="font-mono text-xs">(max {{ matrix.max }})</span>.
        </p>
      </div>
      <div class="flex items-center gap-4">
        <!-- Color legend: gradient bar with 0 → max labels mapping shade to count. -->
        <div
          class="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300"
          data-testid="heatmap-legend"
          aria-label="Color legend: lighter shades indicate fewer evidence rows, darker shades indicate more"
        >
          <span class="font-mono text-zinc-500 dark:text-zinc-400">0</span>
          <span
            class="inline-block h-2 w-32 rounded border border-zinc-200 dark:border-zinc-800"
            :style="{
              backgroundImage:
                'linear-gradient(to right, rgb(250 250 250), rgb(24 24 27))',
            }"
            aria-hidden="true"
          />
          <span class="font-mono text-zinc-700 dark:text-zinc-300">{{
            matrix.max
          }}</span>
        </div>
        <label
          class="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 print:hidden"
        >
          <input
            v-model="logScale"
            type="checkbox"
            class="size-4 accent-zinc-900"
            data-testid="log-scale-toggle"
          />
          log-scale color ramp
        </label>
      </div>
    </header>

    <div
      class="relative overflow-auto border border-zinc-200 dark:border-zinc-800 rounded"
    >
      <div
        ref="gridRef"
        class="heatmap-grid inline-grid text-xs"
        :style="{
          gridTemplateColumns: `minmax(220px, max-content) repeat(${matrix.packs.length}, minmax(28px, 1fr))`,
        }"
        data-testid="heatmap-grid"
      >
        <!-- Header row: empty corner + pack labels -->
        <div
          class="sticky top-0 left-0 z-20 bg-white dark:bg-zinc-900 border-b border-r border-zinc-200 dark:border-zinc-800"
        />
        <div
          v-for="pack in matrix.packs"
          :key="`h-${pack}`"
          class="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-1.5 text-zinc-700 dark:text-zinc-300 font-mono text-[10px] leading-tight align-bottom"
          :title="pack"
        >
          <div
            class="origin-bottom-left -rotate-45 whitespace-nowrap translate-y-2"
          >
            {{ truncate(pack.split("/").pop() ?? pack, TRUNCATE_COL_LABEL) }}
          </div>
        </div>

        <!-- Body rows: pattern label + cells -->
        <template v-for="rv in displayRows" :key="`r-${rv.pattern.pattern_id}`">
          <div
            class="sticky left-0 z-10 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 px-2 py-1 font-mono text-[11px] text-zinc-800 dark:text-zinc-200 whitespace-nowrap"
            :title="`${rv.pattern.pattern_id} — ${rv.pattern.name} (blast ${rv.pattern.blast_radius.toFixed(2)})`"
          >
            <span class="text-zinc-500 dark:text-zinc-400">{{
              rv.pattern.pattern_id
            }}</span>
            <span class="text-zinc-400 dark:text-zinc-500 mx-1">·</span>
            <span>{{ truncate(rv.pattern.name, TRUNCATE_ROW_LABEL) }}</span>
          </div>
          <button
            v-for="cv in rv.cells"
            :key="cv.key"
            type="button"
            class="heatmap-cell h-7 border-b border-r border-zinc-100 dark:border-zinc-800 cursor-pointer focus:outline-2 focus:outline-zinc-900 focus:z-10 print:bg-white! print:border-zinc-200"
            :style="cv.style"
            :data-pattern="rv.pattern.pattern_id"
            :data-pack="cv.pack"
            :data-count="cv.count"
            :aria-label="cv.ariaLabel"
            @mouseenter="onCellEnter(rv.pattern.pattern_id, cv.pack)"
            @mouseleave="onCellLeave"
            @focus="onCellEnter(rv.pattern.pattern_id, cv.pack)"
            @blur="onCellLeave"
            @click="onCellClick(rv.pattern.pattern_id, cv.pack, $event)"
          >
            <span
              v-if="cv.count > 0"
              class="text-[10px] font-mono leading-none print:text-zinc-700"
              >{{ cv.count }}</span
            >
          </button>
        </template>
      </div>

      <!-- Hover tooltip -->
      <div
        v-if="showTooltip && hoveredCell"
        class="pointer-events-none absolute top-2 right-2 z-30 bg-zinc-900 dark:bg-zinc-100 text-zinc-50 text-xs rounded px-2 py-1.5 shadow-md print:hidden"
        data-testid="heatmap-tooltip"
        role="tooltip"
      >
        <span class="font-mono">{{ hoveredCell.patternId }}</span>
        <span class="text-zinc-400 dark:text-zinc-500 mx-1">·</span>
        <span class="font-mono">{{ hoveredCell.pack }}</span>
        <span class="text-zinc-400 dark:text-zinc-500 mx-1">·</span>
        <span
          >{{ hoveredCell.count }} row{{
            hoveredCell.count === 1 ? "" : "s"
          }}</span
        >
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
