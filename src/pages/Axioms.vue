<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { marked } from 'marked'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import Badge from '@/components/ui/Badge.vue'
import Prose from '@/components/ui/Prose.vue'
import Toc from '@/components/ui/Toc.vue'
import { useToc } from '@/composables/useToc'
import { allAxioms, getRootBody, manifest } from '@/data/knowledge-loader'
import { detectAxiomRefs } from '@/utils/xref'

useHead({ title: 'Axioms — ComfyUI Frontend Ecosystem' })

/**
 * Wave-18 W18.G — "Bible" treatment.
 *
 * Layout:
 *   - Header with reference-doc kicker.
 *   - Quick chip-grid (count of ADRs per axiom) preserved from the
 *     old page since `/axioms#a1-refs` is linked from many places.
 *   - Preamble Prose (everything in AXIOMS.md before `## A1`) with
 *     drop-cap for editorial feel.
 *   - Per-axiom anchor cards: id="a1-refs" on the h3 so `useToc`
 *     picks them up; back-compat with existing fragment links.
 *   - Cross-ref chips auto-detected via `detectAxiomRefs`.
 *   - Sticky `<Toc>` on lg+, mobile `<details>` fallback above body.
 *   - Copy-permalink button per axiom on hover.
 */

interface ParsedAxiom {
  id: string
  title: string
  body: string
  bodyHtml: string
  crossRefs: string[]
}

/**
 * W19.A4 — Derived theorems rendered below the axiom index. Each
 * theorem cites ≥ 2 axiom premises (chip-linked to `/axioms#aN-refs`)
 * and ≥ 1 ADR consequence (chip-linked to `/decisions/<slug>`).
 */
interface ParsedTheorem {
  id: string
  title: string
  premises: string[]
  consequenceLinks: Array<{ slug: string; label: string }>
  bodyHtml: string
}

const rawBody = computed(() => getRootBody('axioms') ?? '')
const rawTheoremsBody = computed(() => getRootBody('axioms-theorems') ?? '')

function parseAxioms(md: string): {
  preamble: string
  axioms: ParsedAxiom[]
} {
  if (!md) return { preamble: '', axioms: [] }
  const lines = md.split('\n')
  // `## A12: Mount-Lifecycle as the Sole DOM Seam` — capture id + title.
  const headerRe = /^## (A\d+):\s*(.+?)\s*$/
  const sections: Array<{ id: string; title: string; start: number }> = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headerRe)
    if (m) sections.push({ id: m[1], title: m[2], start: i })
  }
  const preamble = sections.length ? lines.slice(0, sections[0].start).join('\n') : md
  const parsed: ParsedAxiom[] = sections.map((s, idx) => {
    const end = sections[idx + 1]?.start ?? lines.length
    // Skip the `## A1: Title` header line; we render that in the card chrome.
    const body = lines
      .slice(s.start + 1, end)
      .join('\n')
      .trim()
    return {
      id: s.id,
      title: s.title,
      body,
      bodyHtml: marked.parse(body) as string,
      crossRefs: detectAxiomRefs(body, s.id)
    }
  })
  // Numeric sort so A1, A2, … A14, A15, A16 render in order.
  parsed.sort((a, b) => Number.parseInt(a.id.slice(1), 10) - Number.parseInt(b.id.slice(1), 10))
  return { preamble, axioms: parsed }
}

/**
 * Parse `axioms-theorems.md` — `## Theorem N: Title` headers; the body
 * holds `**Premises**: A5, A11.` and bullet links under `**Consequences**:`
 * pointing at `./decisions/<slug>.md` or `(./decisions/<slug>)`.
 */
function parseTheorems(md: string): ParsedTheorem[] {
  if (!md) return []
  const lines = md.split('\n')
  const headerRe = /^## (Theorem \d+):\s*(.+?)\s*$/
  const sections: Array<{ id: string; title: string; start: number }> = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headerRe)
    if (m) sections.push({ id: m[1], title: m[2], start: i })
  }
  return sections.map((s, idx) => {
    const end = sections[idx + 1]?.start ?? lines.length
    const body = lines
      .slice(s.start + 1, end)
      .join('\n')
      .trim()
    // Premises: pull the A-numbers cited on the `**Premises**:` line(s).
    const premiseLine = body.match(/^\*\*Premises\*\*:\s*(.+?)$/m)?.[1] ?? ''
    const premises = Array.from(
      new Set(Array.from(premiseLine.matchAll(/\bA(\d{1,2})\b/g)).map((m) => `A${m[1]}`))
    )
    // Consequences: harvest links to ./decisions/<slug>(.md)?
    const consequenceLinks: Array<{ slug: string; label: string }> = []
    const seen = new Set<string>()
    // Match either Markdown links `[label](path)` or bare slug refs the
    // author may have inlined (e.g. parenthesised `(planned — W19.A10)`).
    for (const m of body.matchAll(/\[([^\]]+)\]\(\.?\/?decisions\/([^)\s#]+?)(?:\.md)?\)/g)) {
      const slug = m[2].toLowerCase()
      if (seen.has(slug)) continue
      seen.add(slug)
      // Strip the "[D-foo](" prefix if the label is itself the slug.
      const label = m[1].replace(/\[|\]/g, '').trim() || slug
      consequenceLinks.push({ slug, label })
    }
    return {
      id: s.id,
      title: s.title,
      premises,
      consequenceLinks,
      bodyHtml: marked.parse(body) as string
    }
  })
}

const parsed = computed(() => parseAxioms(rawBody.value))
const theorems = computed(() => parseTheorems(rawTheoremsBody.value))
const preamble = computed(() => parsed.value.preamble)
const axioms = computed(() => parsed.value.axioms)
const preambleHtml = computed(() => marked.parse(preamble.value) as string)

const axiomCounts = computed(() => {
  const out: Record<string, number> = {}
  for (const a of allAxioms) {
    out[a] = manifest.axiomIndex[a]?.length ?? 0
  }
  return out
})

/**
 * Enriched "Cited by" lookup (Wave-18 W18.L). Prefers the
 * `axiomBacklinks` array emitted by the builder (carries titles);
 * falls back to synthesising from the flat `axiomIndex` for older
 * manifests + the test fixture that mocks only `axiomIndex`.
 */
function backlinksFor(
  axiomId: string
): Array<{ id: string; title: string; type: 'decision' | 'axiom' }> {
  const enriched = manifest.axiomBacklinks?.[axiomId]
  if (enriched?.length) return enriched
  const slugs = manifest.axiomIndex[axiomId] ?? []
  return slugs.map((s) => ({ id: s, title: s, type: 'decision' as const }))
}

// TOC: scan the article body for h3 ids the per-axiom cards emit.
const bodyRef = ref<HTMLElement | null>(null)
const { items: tocItems, rebuild } = useToc(() => bodyRef.value)

// Rebuild whenever the parsed axioms change (e.g., on HMR reload).
watch(axioms, () => nextTick(rebuild), { flush: 'post' })
onMounted(() => nextTick(rebuild))

// Permalink copy ─────────────────────────────────────────────
const copiedId = ref<string | null>(null)
let copyTimer: ReturnType<typeof setTimeout> | null = null

async function copyPermalink(id: string) {
  const hash = `${id.toLowerCase()}-refs`
  const url = `${window.location.origin}${window.location.pathname}#${hash}`
  try {
    await navigator.clipboard.writeText(url)
    copiedId.value = id
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copiedId.value = null
    }, 1500)
  } catch {
    // Clipboard API can fail in non-secure contexts / older browsers.
    // The UI silently no-ops; the link is still copyable via right-click.
  }
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8">
    <!-- Mobile TOC dropdown -->
    <details
      v-if="tocItems.length"
      class="lg:hidden mb-6 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm"
      data-testid="axioms-toc-mobile"
    >
      <summary
        class="cursor-pointer select-none px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100"
      >
        On this page
      </summary>
      <ul class="px-3 pb-3 border-l border-zinc-200 dark:border-zinc-800 ml-3">
        <li v-for="item in tocItems" :key="item.id" :data-depth="item.depth">
          <a
            :href="`#${item.id}`"
            class="block py-1 text-sm border-l-2 -ml-px pl-3 border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700"
          >
            {{ item.title }}
          </a>
        </li>
      </ul>
    </details>

    <div class="lg:grid lg:grid-cols-[1fr_220px] lg:gap-12">
      <!-- Main bible column -->
      <article ref="bodyRef" class="min-w-0">
        <header class="mb-12 border-b border-zinc-200 dark:border-zinc-800 pb-8">
          <p class="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
            Reference
          </p>
          <h1
            class="text-4xl font-semibold tracking-tight text-balance text-zinc-900 dark:text-zinc-100"
          >
            Axioms
          </h1>
          <p class="mt-4 text-zinc-600 dark:text-zinc-400 text-pretty max-w-2xl">
            Non-negotiable design constraints. Every ADR must respect these; any violation requires
            a retroactive axiom change. Each entry below has a copy-permalink button on hover for
            citing in PR comments and reviews.
          </p>
        </header>

        <!-- Quick chip-grid — preserved from the old page so back-links
             like `/axioms#a1-refs` still land on the right index entry,
             and contributors can scan ADR coverage at a glance. -->
        <section
          class="mb-12 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          data-testid="axiom-grid"
        >
          <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Quick index — click an axiom to jump
          </h2>
          <div class="flex flex-wrap gap-2">
            <RouterLink
              v-for="a in allAxioms"
              :key="a"
              :to="`/axioms#${a.toLowerCase()}-refs`"
              class="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-mono text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-900/40 dark:text-violet-200 dark:hover:bg-violet-900/70"
            >
              {{ a }}
              <span
                class="ml-1 rounded bg-violet-200 px-1 text-[10px] text-violet-800 dark:bg-violet-700 dark:text-violet-100"
                >{{ axiomCounts[a] }}</span
              >
            </RouterLink>
          </div>
        </section>

        <!-- Preamble (the intro text before `## A1`). -->
        <Prose v-if="preambleHtml" :html="preambleHtml" :drop-cap="true" max-width="wide" />

        <!-- Empty-state fallback if the knowledge sync hasn't run. -->
        <div
          v-if="!rawBody"
          class="rounded border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/30"
        >
          AXIOMS.md not found in synced knowledge. Run
          <code>pnpm sync:knowledge</code>.
        </div>

        <!-- Per-axiom anchor cards. The h3 carries the canonical id
             so `useToc` picks them up for the sidebar. -->
        <section v-if="axioms.length" class="mt-16 space-y-12" data-testid="axiom-refs">
          <h2
            class="text-2xl font-semibold border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-6 text-zinc-900 dark:text-zinc-100"
          >
            Axiom index
          </h2>
          <article v-for="a in axioms" :key="a.id" class="group scroll-mt-20">
            <header class="flex items-baseline gap-3 mb-3 flex-wrap">
              <Badge variant="neutral" size="sm">{{ a.id }}</Badge>
              <h3
                :id="`${a.id.toLowerCase()}-refs`"
                class="text-xl font-semibold text-zinc-900 dark:text-zinc-100 scroll-mt-20"
              >
                {{ a.title }}
              </h3>
              <button
                type="button"
                class="ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                :aria-label="`Copy permalink to ${a.id}`"
                :data-testid="`copy-permalink-${a.id}`"
                @click="copyPermalink(a.id)"
              >
                {{ copiedId === a.id ? 'copied' : '# permalink' }}
              </button>
            </header>

            <Prose density="compact" :html="a.bodyHtml" max-width="wide" />

            <!-- Cross-ref chips (related axioms auto-detected). -->
            <div
              v-if="a.crossRefs.length"
              class="mt-4 flex flex-wrap items-center gap-2 text-xs"
              data-testid="axiom-xrefs"
            >
              <span class="text-zinc-500 dark:text-zinc-400">Related:</span>
              <RouterLink
                v-for="ref in a.crossRefs"
                :key="ref"
                :to="`/axioms#${ref.toLowerCase()}-refs`"
                class="inline-flex items-center px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-400 text-zinc-700 dark:text-zinc-300 font-mono"
              >
                {{ ref }}
              </RouterLink>
            </div>

            <!--
              ADR backlinks ("Cited by"). W18.L upgrades the chips to
              use the enriched `axiomBacklinks` data (titles surfaced
              as native tooltips) while preserving the previous slug
              chips so deep-link landings still match prior visuals.
            -->
            <div
              v-if="backlinksFor(a.id).length"
              class="mt-3 flex flex-wrap items-center gap-2 text-xs"
              :data-testid="`axiom-cited-by-${a.id}`"
            >
              <span class="text-zinc-500 dark:text-zinc-400"
                >Cited by {{ backlinksFor(a.id).length }} ADR(s):</span
              >
              <RouterLink
                v-for="b in backlinksFor(a.id)"
                :key="b.id"
                :to="
                  b.type === 'decision'
                    ? `/decisions/${b.id}`
                    : `/axioms#${b.id.toLowerCase()}-refs`
                "
                :title="b.title"
                class="rounded bg-zinc-100 px-2 py-0.5 font-mono text-blue-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-blue-400"
              >
                {{ b.id }}
              </RouterLink>
            </div>
          </article>
        </section>

        <!--
          W19.A4 — Derived theorems. Rendered AFTER the axiom index so
          back-compat anchors `/axioms#aN-refs` still land on the
          axiom card, not on a theorem. Theorems are derived (not
          axiomatic); each cites ≥ 2 axiom premises + ≥ 1 ADR.
        -->
        <section
          v-if="theorems.length"
          id="theorems"
          class="mt-20 space-y-10 scroll-mt-20"
          data-testid="theorems"
        >
          <header>
            <h2
              class="text-2xl font-semibold border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-2 text-zinc-900 dark:text-zinc-100"
            >
              Derived theorems
            </h2>
            <p class="text-sm text-zinc-600 dark:text-zinc-400 text-pretty max-w-2xl">
              Statements that follow logically from the axioms above. Each theorem cites its
              premises (chips link to the axiom card) and at least one ADR consequence. Theorems are
              derived, not axiomatic — modifying one does not require an axiom change.
            </p>
          </header>
          <article
            v-for="t in theorems"
            :key="t.id"
            class="group scroll-mt-20"
            data-testid="theorem-card"
          >
            <header class="flex items-baseline gap-3 mb-3 flex-wrap">
              <Badge variant="neutral" size="sm">{{ t.id }}</Badge>
              <h3
                :id="`theorem-${t.id.toLowerCase().replace(/\s+/g, '-')}`"
                class="text-xl font-semibold text-zinc-900 dark:text-zinc-100 scroll-mt-20"
              >
                {{ t.title }}
              </h3>
            </header>

            <!-- Premise chips link to each axiom card. -->
            <div
              v-if="t.premises.length"
              class="mb-3 flex flex-wrap items-center gap-2 text-xs"
              data-testid="theorem-premises"
            >
              <span class="text-zinc-500 dark:text-zinc-400">Premises:</span>
              <RouterLink
                v-for="p in t.premises"
                :key="p"
                :to="`/axioms#${p.toLowerCase()}-refs`"
                class="rounded border border-violet-200 bg-violet-50 px-2 py-0.5 font-mono text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-900/40 dark:text-violet-200 dark:hover:bg-violet-900/70"
              >
                {{ p }}
              </RouterLink>
            </div>

            <Prose density="compact" :html="t.bodyHtml" max-width="wide" />

            <!-- ADR consequence chips. -->
            <div
              v-if="t.consequenceLinks.length"
              class="mt-3 flex flex-wrap items-center gap-2 text-xs"
              data-testid="theorem-adrs"
            >
              <span class="text-zinc-500 dark:text-zinc-400">ADRs:</span>
              <RouterLink
                v-for="c in t.consequenceLinks"
                :key="c.slug"
                :to="`/decisions/${c.slug}`"
                class="rounded bg-zinc-100 px-2 py-0.5 font-mono text-blue-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-blue-400"
              >
                {{ c.slug }}
              </RouterLink>
            </div>
          </article>
        </section>
      </article>

      <!-- Sticky desktop TOC -->
      <aside class="hidden lg:block">
        <Toc :items="tocItems" :sticky="true" title="On this page" />
      </aside>
    </div>
  </div>
</template>
