<script setup lang="ts">
import { marked } from 'marked'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { deltaBySurface, PR_REPO, prByNum, surfacesByPr } from '@/data/litegraph-audit-loader'

// Configure marked for inline rendering (no <p> wrappers)
marked.setOptions({ gfm: true, breaks: false })

/**
 * AuditPRDetail — drill-down for one pruning PR.
 *
 * Shows: PR header (number, branch, status, title) + linked surfaces
 *        with re-audit-aware consumer impact.
 */
const route = useRoute()

const prNum = computed(() => Number(route.params.num))
const pr = computed(() => prByNum[prNum.value])
const surfaces = computed(() => surfacesByPr[prNum.value] ?? [])

function tierBadge(tier: string): string {
  const map: Record<string, string> = {
    critical:
      'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-700',
    high: 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-300',
    med: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-300',
    low: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
  }
  return map[tier] ?? map.low
}

function statusBadge(s: string): string {
  if (s === 'MERGED')
    return 'bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-300'
  if (s === 'DRAFT') return 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200'
  if (s === 'OPEN')
    return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-300'
  return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
}

const totalReauditConsumers = computed(() => {
  let t = 0
  for (const s of surfaces.value) {
    const d = deltaBySurface[s.id]
    t += d?.reauditTotal ?? s.external
  }
  return t
})

/**
 * Deduplicated description: if description starts with title text,
 * show only description to avoid visual repetition.
 */
const showTitle = computed(() => {
  if (!pr.value) return false
  const desc = pr.value.description ?? ''
  const title = pr.value.title ?? ''
  // Don't show title if description starts with same text
  return !desc.startsWith(title)
})

/** Render description as markdown (inline, no wrapping <p>) */
function renderDescription(desc: string): string {
  return marked.parseInline(desc) as string
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
      v-if="!pr"
      class="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/30 p-4 text-sm"
    >
      No PR with number <code class="font-mono">#{{ prNum }}</code> in the audit bundle.
    </div>

    <template v-else>
      <header class="space-y-2">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            <a
              :href="`https://github.com/${PR_REPO}/pull/${pr.num}`"
              target="_blank"
              rel="noopener"
              class="hover:underline"
            >
              #{{ pr.num }}
            </a>
            <span class="text-zinc-500 font-normal text-base ml-2">{{ pr.branch }}</span>
          </h1>
          <span
            class="rounded px-2 py-0.5 text-[10px] font-medium uppercase"
            :class="statusBadge(pr.status)"
          >
            {{ pr.status }}
          </span>
        </div>
        <p v-if="showTitle" class="text-sm text-zinc-700 dark:text-zinc-300">
          {{ pr.title }}
        </p>
        <p
          v-if="pr.description"
          class="text-xs text-zinc-500 dark:text-zinc-400 max-w-3xl prose prose-xs dark:prose-invert prose-code:text-[10px]"
          v-html="renderDescription(pr.description)"
        />
        <div class="flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
          <span>{{ pr.symbolCount }} symbols deleted/changed</span>
          <span>{{ surfaces.length }} mapped surfaces</span>
          <span>{{ totalReauditConsumers }} consumers (post-re-audit)</span>
        </div>
      </header>

      <!-- Mapped surfaces -->
      <section class="space-y-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
          Mapped surfaces
        </h2>
        <div v-if="surfaces.length === 0" class="text-sm text-zinc-500">
          No surfaces mapped to this PR in the audit bundle.
        </div>
        <ol class="space-y-2">
          <li
            v-for="s in surfaces"
            :key="s.id"
            class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex items-center gap-2">
                  <RouterLink
                    :to="`/audit/surface/${s.id}`"
                    class="font-mono text-sm text-zinc-900 dark:text-zinc-100 hover:underline"
                  >
                    {{ s.id }}
                  </RouterLink>
                  <span
                    class="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                    :class="tierBadge(s.risk)"
                  >
                    {{ s.risk }}
                  </span>
                </div>
                <div
                  class="font-mono text-xs text-zinc-700 dark:text-zinc-300 truncate"
                  :title="s.symbol"
                >
                  {{ s.symbol }}
                </div>
                <p v-if="s.notes" class="text-xs text-zinc-500 dark:text-zinc-400">
                  {{ s.notes }}
                </p>
              </div>
              <div class="text-right text-xs space-y-1">
                <div>
                  <span class="text-zinc-500">verdict:</span>
                  <code class="ml-1 font-mono">{{ s.verdict }}</code>
                </div>
                <div v-if="deltaBySurface[s.id]" class="tabular-nums">
                  <span class="text-zinc-500 line-through">
                    {{ deltaBySurface[s.id].baseline }}
                  </span>
                  →
                  <strong class="text-zinc-900 dark:text-zinc-100">
                    {{ deltaBySurface[s.id].reauditTotal }}
                  </strong>
                  <span
                    v-if="deltaBySurface[s.id].growth > 1"
                    class="ml-1 text-amber-600 dark:text-amber-400"
                  >
                    {{ deltaBySurface[s.id].growth.toFixed(1) }}×
                  </span>
                </div>
                <div v-else class="tabular-nums text-zinc-500">{{ s.external }} external refs</div>
              </div>
            </div>
          </li>
        </ol>
      </section>
    </template>
  </article>
</template>
