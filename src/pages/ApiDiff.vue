<script setup lang="ts">
import { computed, ref } from "vue";
import { useHead } from "@unhead/vue";

import { MIGRATION_STATUSES, migrationEntries } from "@/data/migration-status";
import type { MigrationStatus } from "@/data/migration-status";

useHead({
  title: "API Diff - ComfyUI Frontend Ecosystem",
});

/**
 * ApiDiff — per-pattern card view of the v1 → v2 surface migration.
 *
 * Each card represents ONE entry from `MIGRATION_STATUS` (see
 * `src/data/migration-status.ts`). The previous skeleton-placeholder
 * relied on a line-by-line `diffLines` between two source dumps, which
 * conflated unrelated patterns; this view is per-pattern by construction.
 *
 * Controls above the grid:
 *   - free-text search across name + signatures
 *   - status chip group (multi-select)
 *   - pattern picker that scrolls the chosen card into view
 *
 * The full bundle is parsed at build time (Vite `?raw` import in
 * `src/data/index.ts`), so this page does no runtime fetching. The N16b
 * brief mentions an `AbortSignal` + 10 s timeout + cache-prefix rename
 * (`apidiff:v1:` → `apidiff:src:`) for the fetching variant — left as a
 * follow-up because the current data path is build-time inlined.
 */
const STATUS_STYLES: Record<MigrationStatus, string> = {
  "ECS-native":
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "strangler-bridge":
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "unchanged-legacy":
    "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  "uwf-resolved":
    "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
};

const search = ref("");
const activeStatuses = ref<Set<MigrationStatus>>(
  new Set<MigrationStatus>(MIGRATION_STATUSES),
);
const pickerSelection = ref<string>("");

function toggleStatus(status: MigrationStatus) {
  const next = new Set(activeStatuses.value);
  if (next.has(status)) next.delete(status);
  else next.add(status);
  activeStatuses.value = next;
}

const filteredEntries = computed(() => {
  const q = search.value.trim().toLowerCase();
  return migrationEntries.filter((e) => {
    if (!activeStatuses.value.has(e.status)) return false;
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q) ||
      e.v1Signature.toLowerCase().includes(q) ||
      e.v2Replacement.toLowerCase().includes(q)
    );
  });
});

const statusCounts = computed(() => {
  const counts: Record<MigrationStatus, number> = {
    "ECS-native": 0,
    "strangler-bridge": 0,
    "unchanged-legacy": 0,
    "uwf-resolved": 0,
  };
  for (const e of migrationEntries) counts[e.status] += 1;
  return counts;
});

function jumpTo(id: string) {
  if (!id) return;
  const el = document.getElementById(`pattern-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  // Briefly highlight the target card so the jump is visually obvious.
  el.classList.add("ring-2", "ring-indigo-400");
  window.setTimeout(
    () => el.classList.remove("ring-2", "ring-indigo-400"),
    1200,
  );
}

function onPickerChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  pickerSelection.value = target.value;
  jumpTo(target.value);
}
</script>

<template>
  <article
    class="mx-auto max-w-6xl space-y-6 px-4 py-6"
    data-testid="api-diff-page"
  >
    <header class="space-y-2">
      <h1
        class="font-mono text-3xl font-semibold text-zinc-900 dark:text-zinc-100"
      >
        API Diff
      </h1>
      <p class="max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
        v1 → v2 surface mapping, one card per pattern, classified by D9
        strangler-fig status. Use search and status filters to narrow the grid;
        use the picker to jump to a specific pattern.
      </p>
    </header>

    <!-- Controls -->
    <section
      class="space-y-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="Filters"
    >
      <div class="flex flex-wrap items-end gap-4">
        <div class="min-w-[16rem] flex-1">
          <label
            for="api-diff-search"
            class="block text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400"
          >
            Search
          </label>
          <input
            id="api-diff-search"
            v-model="search"
            type="search"
            placeholder="filter by name or signature substring"
            class="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            data-testid="api-diff-search"
          />
        </div>

        <div class="min-w-[14rem]">
          <label
            for="api-diff-picker"
            class="block text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400"
          >
            Jump to pattern
          </label>
          <select
            id="api-diff-picker"
            :value="pickerSelection"
            class="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            data-testid="api-diff-picker"
            @change="onPickerChange"
          >
            <option value="">— select pattern —</option>
            <option
              v-for="entry in migrationEntries"
              :key="entry.id"
              :value="entry.id"
            >
              {{ entry.id }} · {{ entry.name }}
            </option>
          </select>
        </div>
      </div>

      <fieldset class="space-y-1">
        <legend
          class="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400"
        >
          Status
        </legend>
        <div
          class="flex flex-wrap gap-2"
          role="group"
          aria-label="Migration status filter"
          data-testid="api-diff-status-chips"
        >
          <button
            v-for="status in MIGRATION_STATUSES"
            :key="status"
            type="button"
            :aria-pressed="activeStatuses.has(status)"
            :class="[
              'rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-300',
              activeStatuses.has(status)
                ? STATUS_STYLES[status]
                : 'border-zinc-200 bg-white text-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-200',
            ]"
            @click="toggleStatus(status)"
          >
            {{ status }}
            <span class="ml-1 font-mono text-[10px] opacity-70">
              {{ statusCounts[status] }}
            </span>
          </button>
        </div>
      </fieldset>
    </section>

    <!-- Result summary -->
    <p
      class="text-xs text-zinc-500 dark:text-zinc-400"
      data-testid="api-diff-count"
    >
      Showing {{ filteredEntries.length }} of
      {{ migrationEntries.length }} patterns
    </p>

    <!-- Empty state -->
    <div
      v-if="filteredEntries.length === 0"
      class="rounded-md border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
      data-testid="api-diff-empty"
    >
      No patterns match the current filters.
    </div>

    <!-- Cards -->
    <ul v-else class="grid gap-4" aria-label="Migration patterns">
      <li
        v-for="entry in filteredEntries"
        :id="`pattern-${entry.id}`"
        :key="entry.id"
        class="space-y-3 rounded-md border border-zinc-200 bg-white p-4 transition dark:border-zinc-800 dark:bg-zinc-900"
        data-testid="api-diff-card"
      >
        <header class="flex flex-wrap items-baseline gap-3">
          <h2
            class="font-mono text-base font-semibold text-zinc-900 dark:text-zinc-100"
          >
            <span class="text-zinc-500 dark:text-zinc-400">{{ entry.id }}</span>
            <span
              class="ml-2 font-sans font-normal text-zinc-700 dark:text-zinc-300"
            >
              {{ entry.name }}
            </span>
          </h2>
          <span
            :class="[
              'rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
              STATUS_STYLES[entry.status],
            ]"
            data-testid="api-diff-status-badge"
          >
            {{ entry.status }}
          </span>
        </header>

        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <h3
              class="mb-1 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400"
            >
              v1 signature
            </h3>
            <pre
              class="overflow-x-auto rounded border border-zinc-200 bg-zinc-50 p-3 text-[12px] leading-relaxed text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            ><code data-testid="api-diff-v1">{{ entry.v1Signature }}</code></pre>
          </div>
          <div>
            <h3
              class="mb-1 text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400"
            >
              v2 replacement
            </h3>
            <pre
              class="overflow-x-auto rounded border border-emerald-200 bg-emerald-50 p-3 text-[12px] leading-relaxed text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
            ><code data-testid="api-diff-v2">{{ entry.v2Replacement }}</code></pre>
          </div>
        </div>

        <p
          v-if="entry.notes"
          class="text-xs text-zinc-600 dark:text-zinc-400"
          data-testid="api-diff-notes"
        >
          {{ entry.notes }}
        </p>
      </li>
    </ul>
  </article>
</template>
