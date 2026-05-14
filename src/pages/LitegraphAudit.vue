<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";

import {
  surfaces,
  prs,
  reauditDelta,
  sunsetGates,
  auditMeta,
  verdictCounts,
  deltaBySurface,
} from "@/data/litegraph-audit-loader";
import type { VerdictRow } from "@/data/litegraph-audit-loader";

/**
 * LitegraphAudit — entry page for the LiteGraph pruning audit dashboard.
 *
 * Sections:
 *   - KPI strip: verdict counts (KEEP, DELETE-NOW, DELETE-LATER, etc.)
 *   - Verdict table: AUDIT-LG.10 master verdict table, sortable + filterable.
 *     Per-row severity badge + W2F-1 re-audit pre→post consumer count
 *     visualization (inline CSS bar).
 *   - PR strip: each open + merged pruning PR with status badge.
 *   - Sunset gates: D6.2 ADR gates + status.
 *
 * No URL-state mirroring (kept simpler than /patterns) — this is a
 * read-mostly dashboard for sharing audit findings with teammates.
 */

type SortKey = "id" | "symbol" | "external" | "tier" | "verdict";
type SortDir = "asc" | "desc";

const sortKey = ref<SortKey>("external");
const sortDir = ref<SortDir>("desc");
const filterVerdict = ref<string>("");
const filterTier = ref<string>("");
const filterText = ref<string>("");

const tierOrder: Record<string, number> = {
  critical: 4,
  high: 3,
  med: 2,
  low: 1,
};

const verdictOrder: Record<string, number> = {
  "DELETE-NOW": 0,
  "DELETE-LATER": 1,
  KEEP: 2,
};

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortKey.value = key;
    sortDir.value = "desc";
  }
}

function sortIndicator(key: SortKey): string {
  if (sortKey.value !== key) return "";
  return sortDir.value === "asc" ? "▲" : "▼";
}

const allVerdicts = computed<string[]>(() =>
  [...new Set(surfaces.map((s) => s.verdict))].sort(),
);
const allTiers = computed<string[]>(() =>
  [...new Set(surfaces.map((s) => s.risk))].sort(
    (a, b) => (tierOrder[b] ?? 0) - (tierOrder[a] ?? 0),
  ),
);

const filteredRows = computed<VerdictRow[]>(() => {
  let rows = surfaces.slice();
  if (filterVerdict.value) {
    rows = rows.filter((r) => r.verdict === filterVerdict.value);
  }
  if (filterTier.value) {
    rows = rows.filter((r) => r.risk === filterTier.value);
  }
  if (filterText.value) {
    const q = filterText.value.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.symbol.toLowerCase().includes(q) ||
        (r.notes ?? "").toLowerCase().includes(q),
    );
  }
  rows.sort((a, b) => {
    const dir = sortDir.value === "asc" ? 1 : -1;
    switch (sortKey.value) {
      case "id":
        return a.id.localeCompare(b.id) * dir;
      case "symbol":
        return a.symbol.localeCompare(b.symbol) * dir;
      case "external":
        return (a.external - b.external) * dir;
      case "tier":
        return ((tierOrder[a.risk] ?? 0) - (tierOrder[b.risk] ?? 0)) * dir;
      case "verdict":
        return (
          ((verdictOrder[a.verdict] ?? 99) -
            (verdictOrder[b.verdict] ?? 99)) *
          dir
        );
      default:
        return 0;
    }
  });
  return rows;
});

function tierBadge(tier: string): string {
  const map: Record<string, string> = {
    critical:
      "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-700",
    high: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-300",
    med: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-300",
    low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  };
  return map[tier] ?? map.low;
}

function verdictBadge(v: string): string {
  if (v.startsWith("DELETE-NOW"))
    return "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-300";
  if (v.startsWith("DELETE-LATER"))
    return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300";
  if (v.startsWith("KEEP"))
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-300";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

function prStatusBadge(s: string): string {
  if (s === "MERGED")
    return "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-300";
  if (s === "DRAFT")
    return "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200";
  if (s === "OPEN")
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-300";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

function deltaFor(id: string): { baseline: number; reauditTotal: number; growth: number } | null {
  const d = deltaBySurface[id];
  if (!d) return null;
  return { baseline: d.baseline, reauditTotal: d.reauditTotal, growth: d.growth };
}

const maxDelta = computed(() => {
  let m = 0;
  for (const d of reauditDelta) {
    if (d.reauditTotal > m) m = d.reauditTotal;
  }
  return m || 1;
});
</script>

<template>
  <article class="mx-auto max-w-7xl space-y-8 px-4 py-6">
    <!-- Header -->
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        LiteGraph Pruning Audit
      </h1>
      <p class="text-sm text-zinc-600 dark:text-zinc-400">
        AUDIT-LG.10 verdict table + W2F-1 listener-variant re-audit findings
        from the ECS + Vue hoisted client state research workspace.
      </p>
      <p class="text-xs text-zinc-500 dark:text-zinc-500">
        Generated {{ auditMeta.generatedAt }} ·
        {{ surfaces.length }} surfaces · {{ prs.length }} PRs ·
        {{ reauditDelta.length }} re-audited surfaces
      </p>
    </header>

    <!-- KPI strip -->
    <section class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div
        v-for="(count, verdict) in verdictCounts"
        :key="verdict"
        class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
      >
        <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {{ verdict }}
        </div>
        <div class="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
          {{ count }}
        </div>
      </div>
    </section>

    <!-- PR strip -->
    <section class="space-y-2">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
        Pruning PRs
      </h2>
      <div class="flex flex-wrap gap-2">
        <RouterLink
          v-for="pr in prs"
          :key="pr.num"
          :to="`/audit/pr/${pr.num}`"
          class="inline-flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          <span class="font-mono text-zinc-500">#{{ pr.num }}</span>
          <span class="text-zinc-700 dark:text-zinc-300">{{ pr.branch }}</span>
          <span
            class="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
            :class="prStatusBadge(pr.status)"
          >
            {{ pr.status }}
          </span>
          <span class="text-zinc-500 tabular-nums">{{ pr.symbolCount }} symbols</span>
        </RouterLink>
      </div>
    </section>

    <!-- Filters -->
    <section class="flex flex-wrap items-center gap-3">
      <input
        v-model="filterText"
        type="search"
        placeholder="Search id / symbol / notes…"
        class="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm w-64"
      />
      <select
        v-model="filterVerdict"
        class="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm"
      >
        <option value="">All verdicts</option>
        <option v-for="v in allVerdicts" :key="v" :value="v">{{ v }}</option>
      </select>
      <select
        v-model="filterTier"
        class="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm"
      >
        <option value="">All severities</option>
        <option v-for="t in allTiers" :key="t" :value="t">{{ t }}</option>
      </select>
      <span class="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
        {{ filteredRows.length }} / {{ surfaces.length }}
      </span>
    </section>

    <!-- Verdict table -->
    <section class="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table class="min-w-full text-sm">
        <thead class="bg-zinc-50 dark:bg-zinc-900 text-left">
          <tr>
            <th class="px-3 py-2">
              <button
                type="button"
                class="font-medium hover:text-zinc-900 dark:hover:text-zinc-100"
                @click="toggleSort('id')"
              >
                ID {{ sortIndicator("id") }}
              </button>
            </th>
            <th class="px-3 py-2">
              <button
                type="button"
                class="font-medium hover:text-zinc-900 dark:hover:text-zinc-100"
                @click="toggleSort('symbol')"
              >
                Symbol {{ sortIndicator("symbol") }}
              </button>
            </th>
            <th class="px-3 py-2 text-right">
              <button
                type="button"
                class="font-medium hover:text-zinc-900 dark:hover:text-zinc-100"
                @click="toggleSort('external')"
              >
                Consumers (pre→post) {{ sortIndicator("external") }}
              </button>
            </th>
            <th class="px-3 py-2">
              <button
                type="button"
                class="font-medium hover:text-zinc-900 dark:hover:text-zinc-100"
                @click="toggleSort('tier')"
              >
                Severity {{ sortIndicator("tier") }}
              </button>
            </th>
            <th class="px-3 py-2">
              <button
                type="button"
                class="font-medium hover:text-zinc-900 dark:hover:text-zinc-100"
                @click="toggleSort('verdict')"
              >
                Verdict {{ sortIndicator("verdict") }}
              </button>
            </th>
            <th class="px-3 py-2">PRs</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredRows.length === 0">
            <td colspan="6" class="px-3 py-8 text-center text-zinc-500">
              No surfaces match the current filters.
            </td>
          </tr>
          <tr
            v-for="row in filteredRows"
            :key="row.id"
            class="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
            @click="$router.push(`/audit/surface/${row.id}`)"
          >
            <td class="px-3 py-2 font-mono text-xs">
              <RouterLink
                :to="`/audit/surface/${row.id}`"
                class="text-zinc-900 dark:text-zinc-100 hover:underline"
                @click.stop
              >
                {{ row.id }}
              </RouterLink>
            </td>
            <td class="px-3 py-2 font-mono text-xs text-zinc-700 dark:text-zinc-300 max-w-xs truncate" :title="row.symbol">
              {{ row.symbol }}
            </td>
            <td class="px-3 py-2 text-right tabular-nums">
              <template v-if="deltaFor(row.id)">
                <span class="text-zinc-500 dark:text-zinc-500 line-through mr-1">
                  {{ deltaFor(row.id)!.baseline }}
                </span>
                <span class="font-semibold text-zinc-900 dark:text-zinc-100">
                  {{ deltaFor(row.id)!.reauditTotal }}
                </span>
                <span
                  v-if="deltaFor(row.id)!.growth > 1"
                  class="ml-1 text-[10px] text-amber-600 dark:text-amber-400"
                >
                  {{ deltaFor(row.id)!.growth.toFixed(1) }}×
                </span>
                <div
                  class="mt-1 h-1 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden"
                >
                  <div
                    class="h-full bg-blue-500 dark:bg-blue-600"
                    :style="{ width: ((deltaFor(row.id)!.reauditTotal / maxDelta) * 100) + '%' }"
                  />
                </div>
              </template>
              <template v-else>
                <span class="text-zinc-700 dark:text-zinc-300">{{ row.external }}</span>
                <span class="text-[10px] text-zinc-500 ml-1.5"> no re-audit</span>
              </template>
            </td>
            <td class="px-3 py-2">
              <span
                class="inline-block rounded px-2 py-0.5 text-[10px] font-medium uppercase"
                :class="tierBadge(row.risk)"
              >
                {{ row.risk }}
              </span>
            </td>
            <td class="px-3 py-2">
              <span
                class="inline-block rounded px-2 py-0.5 text-[10px] font-medium"
                :class="verdictBadge(row.verdict)"
              >
                {{ row.verdict }}
              </span>
            </td>
            <td class="px-3 py-2 font-mono text-xs text-zinc-500">
              <span v-for="(n, i) in row.prs" :key="n">
                <RouterLink
                  :to="`/audit/pr/${n}`"
                  class="hover:underline"
                  @click.stop
                >
                  #{{ n }}
                </RouterLink>
                <span v-if="i < row.prs.length - 1">, </span>
              </span>
              <span v-if="row.prs.length === 0">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- D6.2 sunset gates -->
    <section v-if="sunsetGates.length > 0" class="space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
        D6.2 Sunset Gates
      </h2>
      <ol class="space-y-2">
        <li
          v-for="g in sunsetGates"
          :key="g.num"
          class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
        >
          <div class="flex items-center gap-2">
            <span class="font-mono text-xs text-zinc-500">Gate {{ g.num }}</span>
            <span class="font-medium text-zinc-900 dark:text-zinc-100">
              {{ g.title }}
            </span>
            <span
              class="ml-auto inline-block rounded px-2 py-0.5 text-[10px] uppercase"
              :class="prStatusBadge(g.status === 'complete' ? 'MERGED' : 'DRAFT')"
            >
              {{ g.status }}
            </span>
          </div>
          <p class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{{ g.summary }}</p>
        </li>
      </ol>
    </section>
  </article>
</template>
