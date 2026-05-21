<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { marked, Renderer } from 'marked'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import Badge from '@/components/ui/Badge.vue'
import Card from '@/components/ui/Card.vue'
import Prose from '@/components/ui/Prose.vue'
import Toc from '@/components/ui/Toc.vue'
import { ensureHighlighter, highlightCode } from '@/composables/useHighlighter'
import { useToc } from '@/composables/useToc'
import { getDecisionBody, manifest, decisionsSorted } from '@/data/knowledge-loader'
import { pickRelatedDecisions, statusVariant, wrapCallouts } from './decision-detail-helpers'

/**
 * DecisionDetail — pretty-printed ADR page (Wave-18 W18.H).
 *
 * Layout: two-column on `lg+` (article + sticky TOC + related sidebar),
 * single-column with a mobile `<details>` TOC below `lg`. Header carries
 * a colour-coded status badge, ISO date, wave chips, axiom chips, and
 * supersedes / superseded-by chips that link to the related ADRs.
 *
 * The markdown body is rendered through `<Prose>` (Wave-18 W18.F) with
 * a small post-processor that wraps the `## Decision` and
 * `## Consequences` H2-delimited sections in callout boxes — see the
 * `.adr-callout-*` selectors in the non-scoped style block at the
 * bottom of this file.
 */

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? '').toLowerCase())

const meta = computed(() => manifest.decisions.find((d) => d.slug === slug.value))
const body = computed(() => getDecisionBody(slug.value))
const backlinks = computed(() => manifest.adrBacklinks[slug.value] ?? [])

useHead(() => ({
  title: meta.value ? `${meta.value.slug} — ${meta.value.title}` : 'Decision not found'
}))

// ── Prev / next navigation ────────────────────────────────────────────
const navIndex = computed(() => decisionsSorted.findIndex((d) => d.slug === slug.value))
const prev = computed(() => (navIndex.value > 0 ? decisionsSorted[navIndex.value - 1] : null))
const next = computed(() =>
  navIndex.value >= 0 && navIndex.value < decisionsSorted.length - 1
    ? decisionsSorted[navIndex.value + 1]
    : null
)

// ── Markdown renderer with stable heading ids ────────────────────────
const renderer = new Renderer()
renderer.code = ({ text, lang }) => highlightCode(text, lang || 'text')

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

renderer.heading = function ({ tokens, depth, text }) {
  const inner = this.parser.parseInline(tokens)
  const id = slugify(text)
  return `<h${depth} id="${id}">${inner}</h${depth}>\n`
}

marked.setOptions({ gfm: true, breaks: false })
marked.use({ renderer })

const highlighterReady = ref(false)
onMounted(async () => {
  await ensureHighlighter()
  highlighterReady.value = true
})

const renderedBody = computed(() => {
  void highlighterReady.value // re-run after the highlighter loads
  if (!body.value) return ''
  return wrapCallouts(marked.parse(body.value) as string)
})

// ── TOC ──────────────────────────────────────────────────────────────
const bodyRef = ref<HTMLElement | null>(null)
const { items: tocItems, rebuild: rebuildToc } = useToc(() => bodyRef.value)

watch(renderedBody, () => {
  void nextTick(rebuildToc)
})

// ── Related decisions ────────────────────────────────────────────────
const relatedDecisions = computed(() =>
  meta.value ? pickRelatedDecisions(meta.value, decisionsSorted) : []
)
</script>

<template>
  <div v-if="!meta || !body" class="mx-auto max-w-4xl px-4 py-12" data-testid="adr-not-found">
    <div
      class="rounded border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950/30"
    >
      <h1 class="text-xl font-semibold">Decision not found</h1>
      <p class="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
        No ADR with slug <code>{{ slug }}</code> in the synced knowledge base.
      </p>
      <RouterLink
        to="/decisions"
        class="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← All decisions
      </RouterLink>
    </div>
  </div>

  <div v-else class="mx-auto max-w-7xl px-4 py-8" data-testid="adr-page">
    <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-10">
      <!-- ─────────────── Main body ─────────────── -->
      <article ref="bodyRef" class="min-w-0">
        <!-- Back link -->
        <nav class="mb-4 text-sm">
          <RouterLink
            to="/decisions"
            class="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← All decisions
          </RouterLink>
        </nav>

        <!-- ── Metadata header ───────────────────────────────────── -->
        <header
          class="mb-8 border-b border-zinc-200 pb-6 dark:border-zinc-800"
          data-testid="adr-header"
        >
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <Badge :variant="statusVariant(meta.status)" size="sm" data-testid="adr-status-badge">
              {{ (meta.status ?? 'unknown').toUpperCase() }}
            </Badge>
            <span
              v-if="meta.date"
              class="text-xs text-zinc-500 dark:text-zinc-400"
              data-testid="adr-date"
            >
              {{ meta.date }}
            </span>
            <template v-if="meta.waves.length">
              <span class="text-xs text-zinc-400 dark:text-zinc-600">·</span>
              <span
                v-for="w in meta.waves"
                :key="w"
                class="text-xs text-zinc-500 dark:text-zinc-400"
                data-testid="adr-wave"
              >
                {{ w }}
              </span>
            </template>
            <span
              class="ml-auto font-mono text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-600"
            >
              {{ meta.slug }}
            </span>
          </div>

          <h1
            class="text-3xl font-semibold tracking-tight text-zinc-900 text-balance dark:text-zinc-100"
          >
            {{ meta.title }}
          </h1>

          <!-- Axiom refs — links into /axioms#a<n>-refs (W18.B fix). -->
          <div
            v-if="meta.axioms.length"
            class="mt-4 flex flex-wrap items-center gap-2 text-xs"
            data-testid="adr-axioms"
          >
            <span class="text-zinc-500 dark:text-zinc-400">Axioms:</span>
            <RouterLink
              v-for="a in meta.axioms"
              :key="a"
              :to="`/axioms#${a.toLowerCase()}-refs`"
              class="inline-flex items-center rounded-md border border-violet-300 px-2 py-0.5 text-violet-800 hover:border-violet-500 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-200 dark:hover:border-violet-400 dark:hover:bg-violet-900/30"
            >
              {{ a }}
            </RouterLink>
          </div>

          <!-- Supersedes / superseded-by chips -->
          <div
            v-if="meta.supersedes?.length"
            class="mt-3 flex flex-wrap items-center gap-2 text-xs"
            data-testid="adr-supersedes"
          >
            <span class="text-zinc-500 dark:text-zinc-400">Supersedes:</span>
            <RouterLink
              v-for="s in meta.supersedes"
              :key="s"
              :to="`/decisions/${s}`"
              class="inline-flex items-center rounded-md border border-amber-300 px-2 py-0.5 font-mono text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/20"
            >
              {{ s }}
            </RouterLink>
          </div>
          <div
            v-if="meta.supersededBy?.length"
            class="mt-2 flex flex-wrap items-center gap-2 text-xs"
            data-testid="adr-superseded-by"
          >
            <span class="text-zinc-500 dark:text-zinc-400">Superseded by:</span>
            <RouterLink
              v-for="s in meta.supersededBy"
              :key="s"
              :to="`/decisions/${s}`"
              class="inline-flex items-center rounded-md border border-amber-300 px-2 py-0.5 font-mono text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/20"
            >
              {{ s }}
            </RouterLink>
          </div>
        </header>

        <!-- Mobile TOC (between header + body, lg-hidden). -->
        <div v-if="tocItems.length" class="lg:hidden">
          <Toc :items="tocItems" :sticky="false" />
        </div>

        <!-- ── Body ──────────────────────────────────────────────── -->
        <Prose :html="renderedBody" max-width="full" />

        <!-- Backlinks (preserved from prior layout). -->
        <section
          v-if="backlinks.length"
          class="mt-10 rounded border border-zinc-200 p-4 dark:border-zinc-800"
          data-testid="adr-backlinks"
        >
          <h2 class="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Referenced by ({{ backlinks.length }})
          </h2>
          <ul class="flex flex-wrap gap-2 text-xs">
            <li v-for="b in backlinks" :key="b">
              <RouterLink
                :to="`/decisions/${b}`"
                class="rounded bg-zinc-100 px-2 py-1 font-mono text-blue-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-blue-400"
              >
                {{ b }}
              </RouterLink>
            </li>
          </ul>
        </section>

        <!-- Prev / next -->
        <nav
          class="mt-10 flex justify-between border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800"
        >
          <RouterLink
            v-if="prev"
            :to="`/decisions/${prev.slug}`"
            class="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← {{ prev.slug }}
          </RouterLink>
          <span v-else />
          <RouterLink
            v-if="next"
            :to="`/decisions/${next.slug}`"
            class="text-blue-600 hover:underline dark:text-blue-400"
          >
            {{ next.slug }} →
          </RouterLink>
        </nav>
      </article>

      <!-- ─────────────── Sidebar ─────────────── -->
      <aside class="hidden lg:flex lg:flex-col lg:gap-6">
        <Toc v-if="tocItems.length" :items="tocItems" :sticky="true" title="On this page" />

        <Card
          v-if="relatedDecisions.length"
          variant="outlined"
          padding="md"
          data-testid="adr-related"
        >
          <template #header>
            <h3
              class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Related decisions
            </h3>
          </template>
          <ul class="space-y-2 text-sm">
            <li v-for="r in relatedDecisions" :key="r.slug">
              <RouterLink
                :to="`/decisions/${r.slug}`"
                class="block text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
              >
                <span class="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  {{ r.slug }}
                </span>
              </RouterLink>
            </li>
          </ul>
        </Card>
      </aside>
    </div>
  </div>
</template>

<!--
  Callout boxes for the "Decision" / "Consequences" sections are
  injected by `wrapCallouts()` into the v-html'd Prose markup, so
  the styles below must NOT be scoped (scoped styles only reach
  template-authored markup).
-->
<style>
.adr-callout {
  margin: 1.5rem 0;
  padding: 1rem 1.25rem;
  border-left: 4px solid;
  border-radius: 0 0.375rem 0.375rem 0;
}
.adr-callout > h2 {
  margin-top: 0;
  border-bottom: none;
  padding-bottom: 0;
}
.adr-callout-decision {
  border-color: rgb(59 130 246); /* blue-500 */
  background: rgb(239 246 255); /* blue-50 */
}
:where(.dark) .adr-callout-decision {
  background: rgba(30, 58, 138, 0.15); /* blue-900/15 */
}
.adr-callout-consequences {
  border-color: rgb(245 158 11); /* amber-500 */
  background: rgb(255 251 235); /* amber-50 */
}
:where(.dark) .adr-callout-consequences {
  background: rgba(120, 53, 15, 0.15); /* amber-900/15 */
}
</style>
