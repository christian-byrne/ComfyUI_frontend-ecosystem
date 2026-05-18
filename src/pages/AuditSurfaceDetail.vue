<script setup lang="ts">
import type { CommentContext } from '@/composables/useEvidenceComment'
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'

import { RouterLink, useRoute } from 'vue-router'
import { buildCommentMarkdown } from '@/composables/useEvidenceComment'
import {
  getConsumerForSurface,
  getDeltaForSurface,
  getRelatedConsumers,
  PR_REPO,
  surfaceById
} from '@/data/litegraph-audit-loader'

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
const route = useRoute()

const surfaceId = computed(() => String(route.params.id ?? ''))
const verdict = computed(() => surfaceById[surfaceId.value])
// Use helper functions that handle both verdict IDs and pattern IDs
const consumer = computed(() => getConsumerForSurface(surfaceId.value))
const delta = computed(() => getDeltaForSurface(surfaceId.value))
// Get all related consumers for more comprehensive evidence
const relatedConsumers = computed(() => getRelatedConsumers(surfaceId.value))

function tierBadge(tier?: string): string {
  const map: Record<string, string> = {
    critical:
      'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-700',
    high: 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-300',
    med: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-300',
    low: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
  }
  return map[tier ?? 'low'] ?? map.low
}

function verdictBadge(v?: string): string {
  if (!v) return 'bg-zinc-100 text-zinc-700'
  if (v.startsWith('DELETE-NOW'))
    return 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-300'
  if (v.startsWith('DELETE-LATER'))
    return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300'
  if (v.startsWith('KEEP'))
    return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-300'
  return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
}

const { copy, copied } = useClipboard()
const copiedIndex = ref<number | null>(null)

async function openAndCopy(idx: number, prNum?: number) {
  if (!consumer.value) return
  const ev = consumer.value.evidence[idx]
  if (!ev) return
  const ctx: CommentContext = {
    surface: consumer.value,
    evidence: ev,
    reauditTotal: delta.value?.reauditTotal,
    baseline: delta.value?.baseline,
    prNum
  }
  const markdown = buildCommentMarkdown(ctx)
  await copy(markdown)
  copiedIndex.value = idx
  setTimeout(() => {
    if (copiedIndex.value === idx) copiedIndex.value = null
  }, 2500)
  // Open the PR (or repo) in a new tab.
  const url = prNum
    ? `https://github.com/${PR_REPO}/pull/${prNum}/files`
    : (ev.url ??
      `https://github.com/${ev.repo}/blob/HEAD/${ev.file}${ev.line ? `#L${ev.line}` : ''}`)
  window.open(url, '_blank', 'noopener')
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
      No surface with id <code class="font-mono">{{ surfaceId }}</code
      >.
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
          <span
            >kind: <code class="font-mono">{{ verdict.kind }}</code></span
          >
          <span
            >tier: <code class="font-mono">{{ verdict.tier }}</code></span
          >
          <span
            >migration: <code class="font-mono">{{ verdict.migration }}</code></span
          >
          <span
            >internal refs: <strong class="tabular-nums">{{ verdict.internal }}</strong></span
          >
          <span
            >external refs: <strong class="tabular-nums">{{ verdict.external }}</strong></span
          >
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
        <div v-if="verdict.prs.length > 0" class="flex flex-wrap items-center gap-3 pt-2">
          <span class="text-[10px] uppercase tracking-wide text-zinc-500">Related PRs:</span>
          <div class="flex flex-wrap gap-2">
            <RouterLink
              v-for="n in verdict.prs"
              :key="n"
              :to="`/audit/pr/${n}`"
              class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <span class="font-mono text-zinc-900 dark:text-zinc-100">#{{ n }}</span>
              <span class="text-zinc-500">details</span>
            </RouterLink>
            <a
              v-for="n in verdict.prs"
              :key="`gh-${n}`"
              :href="`https://github.com/Comfy-Org/ComfyUI_frontend/pull/${n}`"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1.5 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1.5 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              :title="`Open PR #${n} on GitHub`"
            >
              <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                <path
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                />
              </svg>
              <span class="font-mono">#{{ n }}</span>
            </a>
            <a
              v-for="n in verdict.prs"
              :key="`review-${n}`"
              :href="`https://github.com/Comfy-Org/ComfyUI_frontend/pull/${n}/files`"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-medium transition-colors"
              :title="`Start reviewing PR #${n}`"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Review #{{ n }}
            </a>
          </div>
        </div>
      </header>

      <!-- Re-audit delta detail -->
      <section
        v-if="delta && delta.topNew && delta.topNew.length > 0"
        class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
      >
        <h2
          class="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300 mb-2"
        >
          Top newly-discovered consumers (W2F-1)
        </h2>
        <ul class="text-sm space-y-1">
          <li v-for="(item, i) in delta.topNew" :key="i" class="flex items-center justify-between">
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
      <section v-if="relatedConsumers.length > 0" class="space-y-4">
        <template v-for="(consumerItem, cIdx) in relatedConsumers" :key="consumerItem.patternId">
          <div class="space-y-3">
            <div class="flex items-baseline justify-between">
              <h2
                class="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300"
              >
                <span class="text-zinc-500 font-mono">{{ consumerItem.patternId }}</span>
                — {{ consumerItem.surface }}
                <span class="text-zinc-500 font-normal"
                  >({{ consumerItem.evidence.length }} evidence)</span
                >
              </h2>
              <span class="text-xs text-zinc-500">family: {{ consumerItem.surfaceFamily }}</span>
            </div>
            <div
              v-if="consumerItem.v2Replacement"
              class="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm"
            >
              <strong class="text-blue-900 dark:text-blue-300">v2 replacement:</strong>
              <code class="ml-2 font-mono text-blue-900 dark:text-blue-300">{{
                consumerItem.v2Replacement
              }}</code>
              <span
                v-if="consumerItem.decisionRef"
                class="ml-3 text-xs text-blue-700 dark:text-blue-400"
              >
                ref: <code class="font-mono">{{ consumerItem.decisionRef }}</code>
              </span>
            </div>
            <ol class="space-y-2">
              <li
                v-for="(ev, idx) in consumerItem.evidence"
                :key="`${cIdx}-${idx}`"
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
                      <span
                        v-if="ev.variant"
                        class="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5"
                      >
                        {{ ev.variant }}
                      </span>
                      <span
                        v-if="ev.breakageClass"
                        class="rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5"
                      >
                        {{ ev.breakageClass }}
                      </span>
                      <span
                        v-if="ev.source"
                        class="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-zinc-500"
                      >
                        src: {{ ev.source }}
                      </span>
                    </div>
                  </div>
                  <div class="flex flex-col items-end gap-1.5">
                    <a
                      :href="
                        ev.url ??
                        `https://github.com/${ev.repo}/blob/HEAD/${ev.file}${ev.line ? `#L${ev.line}` : ''}`
                      "
                      target="_blank"
                      rel="noopener"
                      class="inline-flex items-center gap-1.5 text-[11px] rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                      title="View source file on GitHub"
                    >
                      <svg
                        class="w-3 h-3 text-zinc-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                      View source
                    </a>
                    <button
                      v-for="prNum in verdict.prs"
                      :key="prNum"
                      type="button"
                      class="inline-flex items-center gap-1.5 text-[11px] rounded-md bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 font-medium transition-colors"
                      :title="`Opens PR #${prNum} files tab + copies a pre-filled markdown review comment. Paste it into the inline-comment compose box.`"
                      @click="openAndCopy(idx, prNum)"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                        />
                      </svg>
                      Comment on #{{ prNum }}
                    </button>
                    <span
                      v-if="copied && copiedIndex === idx"
                      class="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Copied to clipboard
                    </span>
                  </div>
                </div>
                <pre
                  v-if="ev.excerpt"
                  class="mt-2 overflow-x-auto rounded bg-zinc-50 dark:bg-zinc-950 p-2 text-[11px] font-mono text-zinc-700 dark:text-zinc-300"
                ><code>{{ ev.excerpt }}</code></pre>
                <p v-if="ev.notes" class="mt-2 text-xs text-zinc-500">
                  {{ ev.notes }}
                </p>
              </li>
            </ol>
          </div>
        </template>
      </section>
      <p v-else class="text-sm text-zinc-500">
        No consumer-evidence bundle for this surface yet — see
        <code class="font-mono">research/touch-points/database.yaml</code>.
      </p>
    </template>
  </article>
</template>
