<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";

import {
  surfaceById,
  consumerByPatternId,
  deltaBySurface,
  PR_REPO,
} from "@/data/litegraph-audit-loader";
import {
  buildCommentMarkdown,
  type CommentContext,
} from "@/composables/useEvidenceComment";

/**
 * AuditSurfaceDetail — drill-down for one verdict-table row.
 *
 * Shows: header (id, symbol, severity, verdict, v2 replacement),
 *        consumer evidence list with "Open in PR + copy comment" buttons.
 *
 * "Open in PR + copy comment" UX limitation:
 *   GitHub has no documented URL that auto-opens the inline review-comment
 *   compose modal on a specific diff line. The button:
 *     1. opens the PR's "Files changed" tab (deep-linked when possible);
 *     2. copies a pre-filled markdown comment to the clipboard;
 *     3. shows a brief tooltip explaining step 3.
 */
const route = useRoute();

const surfaceId = computed(() => String(route.params.id ?? ""));
const verdict = computed(() => surfaceById[surfaceId.value]);
const consumer = computed(() => consumerByPatternId[surfaceId.value]);
const delta = computed(() => deltaBySurface[surfaceId.value]);

function tierBadge(tier?: string): string {
  const map: Record<string, string> = {
    critical:
      "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-700",
    high: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-300",
    med: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-300",
    low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  };
  return map[tier ?? "low"] ?? map.low;
}

function verdictBadge(v?: string): string {
  if (!v) return "bg-zinc-100 text-zinc-700";
  if (v.startsWith("DELETE-NOW"))
    return "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-300";
  if (v.startsWith("DELETE-LATER"))
    return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300";
  if (v.startsWith("KEEP"))
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-300";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

interface CopyState {
  index: number;
  ts: number;
}

const copied = ref<CopyState | null>(null);

async function openAndCopy(idx: number, prNum?: number) {
  if (!consumer.value) return;
  const ev = consumer.value.evidence[idx];
  if (!ev) return;
  const ctx: CommentContext = {
    surface: consumer.value,
    evidence: ev,
    reauditTotal: delta.value?.reauditTotal,
    baseline: delta.value?.baseline,
    prNum,
  };
  const markdown = buildCommentMarkdown(ctx);
  try {
    await navigator.clipboard.writeText(markdown);
    copied.value = { index: idx, ts: Date.now() };
    setTimeout(() => {
      if (copied.value?.index === idx) copied.value = null;
    }, 2500);
  } catch (e) {
    console.warn("clipboard write failed", e);
  }
  // Open the PR (or repo) in a new tab.
  const url = prNum
    ? `https://github.com/${PR_REPO}/pull/${prNum}/files`
    : (ev.url ??
       `https://github.com/${ev.repo}/blob/HEAD/${ev.file}` +
         (ev.line ? `#L${ev.line}` : ""));
  window.open(url, "_blank", "noopener");
}
</script>

<template>
  <article class="mx-auto max-w-5xl space-y-6 px-4 py-6">
    <RouterLink
      to="/audit"
      class="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
    >
      ← Back to audit
    </RouterLink>

    <div
      v-if="!verdict"
      class="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/30 p-4 text-sm"
    >
      No surface with id <code class="font-mono">{{ surfaceId }}</code>.
    </div>

    <template v-else>
      <header class="space-y-3">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-semibold font-mono text-zinc-900 dark:text-zinc-100">
            {{ verdict.id }}
          </h1>
          <span
            class="rounded px-2 py-0.5 text-[10px] font-medium uppercase"
            :class="tierBadge(verdict.risk)"
          >
            {{ verdict.risk }}
          </span>
          <span
            class="rounded px-2 py-0.5 text-[10px] font-medium"
            :class="verdictBadge(verdict.verdict)"
          >
            {{ verdict.verdict }}
          </span>
        </div>
        <div class="text-sm text-zinc-700 dark:text-zinc-300 font-mono">
          {{ verdict.symbol }}
        </div>
        <p v-if="verdict.notes" class="text-sm text-zinc-600 dark:text-zinc-400">
          {{ verdict.notes }}
        </p>
        <div class="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span>kind: <code class="font-mono">{{ verdict.kind }}</code></span>
          <span>tier: <code class="font-mono">{{ verdict.tier }}</code></span>
          <span>migration: <code class="font-mono">{{ verdict.migration }}</code></span>
          <span>internal refs: <strong class="tabular-nums">{{ verdict.internal }}</strong></span>
          <span>external refs: <strong class="tabular-nums">{{ verdict.external }}</strong></span>
          <span v-if="delta">
            re-audit:
            <span class="line-through">{{ delta.baseline }}</span>
            →
            <strong class="tabular-nums">{{ delta.reauditTotal }}</strong>
            <span v-if="delta.growth > 1" class="ml-1 text-amber-600 dark:text-amber-400">
              ({{ delta.growth.toFixed(1) }}×)
            </span>
          </span>
        </div>
        <div v-if="verdict.prs.length > 0" class="flex flex-wrap gap-2 text-xs">
          <RouterLink
            v-for="n in verdict.prs"
            :key="n"
            :to="`/audit/pr/${n}`"
            class="rounded border border-zinc-200 dark:border-zinc-800 px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            #{{ n }}
          </RouterLink>
        </div>
      </header>

      <!-- Re-audit delta detail -->
      <section
        v-if="delta && delta.topNew && delta.topNew.length > 0"
        class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
      >
        <h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300 mb-2">
          Top newly-discovered consumers (W2F-1)
        </h2>
        <ul class="text-sm space-y-1">
          <li
            v-for="(item, i) in delta.topNew"
            :key="i"
            class="flex items-center justify-between"
          >
            <a
              :href="`https://github.com/${item.repo}`"
              target="_blank"
              rel="noopener"
              class="font-mono text-xs text-zinc-700 dark:text-zinc-300 hover:underline"
            >
              {{ item.repo }}
            </a>
            <span class="text-xs tabular-nums text-zinc-500">{{ item.hits }} hits</span>
          </li>
        </ul>
      </section>

      <!-- Consumer evidence -->
      <section v-if="consumer" class="space-y-3">
        <div class="flex items-baseline justify-between">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
            Consumer evidence ({{ consumer.evidence.length }})
          </h2>
          <span class="text-xs text-zinc-500">family: {{ consumer.surfaceFamily }}</span>
        </div>
        <div
          v-if="consumer.v2Replacement"
          class="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm"
        >
          <strong class="text-blue-900 dark:text-blue-300">v2 replacement:</strong>
          <code class="ml-2 font-mono text-blue-900 dark:text-blue-300">{{ consumer.v2Replacement }}</code>
          <span v-if="consumer.decisionRef" class="ml-3 text-xs text-blue-700 dark:text-blue-400">
            ref: <code class="font-mono">{{ consumer.decisionRef }}</code>
          </span>
        </div>
        <ol class="space-y-2">
          <li
            v-for="(ev, idx) in consumer.evidence"
            :key="idx"
            class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0 flex-1">
                <a
                  :href="ev.url ?? `https://github.com/${ev.repo}`"
                  target="_blank"
                  rel="noopener"
                  class="font-mono text-xs text-zinc-900 dark:text-zinc-100 hover:underline"
                >
                  {{ ev.repo }}
                </a>
                <span class="ml-2 font-mono text-xs text-zinc-500">
                  {{ ev.file }}<span v-if="ev.line">:{{ ev.line }}</span>
                </span>
                <div v-if="ev.variant || ev.breakageClass" class="mt-1 flex gap-2 text-[10px]">
                  <span v-if="ev.variant" class="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5">
                    {{ ev.variant }}
                  </span>
                  <span v-if="ev.breakageClass" class="rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5">
                    {{ ev.breakageClass }}
                  </span>
                  <span v-if="ev.source" class="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-zinc-500">
                    src: {{ ev.source }}
                  </span>
                </div>
              </div>
              <div class="flex flex-col items-end gap-1">
                <button
                  v-for="prNum in verdict.prs"
                  :key="prNum"
                  type="button"
                  class="text-[11px] rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  :title="`Opens PR #${prNum} files tab in a new tab AND copies a pre-filled markdown review comment to your clipboard. Paste it into the inline-comment compose box on the relevant diff line. (GitHub has no documented URL to auto-open the compose modal — clipboard-paste is the closest UX.)`"
                  @click="openAndCopy(idx, prNum)"
                >
                  Open #{{ prNum }} + copy comment
                </button>
                <span
                  v-if="copied?.index === idx"
                  class="text-[10px] text-emerald-600 dark:text-emerald-400"
                >
                  ✓ copied
                </span>
              </div>
            </div>
            <pre
              v-if="ev.excerpt"
              class="mt-2 overflow-x-auto rounded bg-zinc-50 dark:bg-zinc-950 p-2 text-[11px] font-mono text-zinc-700 dark:text-zinc-300"
            ><code>{{ ev.excerpt }}</code></pre>
            <p v-if="ev.notes" class="mt-2 text-xs text-zinc-500">{{ ev.notes }}</p>
          </li>
        </ol>
      </section>
      <p v-else class="text-sm text-zinc-500">
        No consumer-evidence bundle for this surface yet — see
        <code class="font-mono">research/touch-points/database.yaml</code>.
      </p>
    </template>
  </article>
</template>
