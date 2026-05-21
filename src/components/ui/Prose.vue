<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/lib/cn'

/**
 * Prose — long-form markdown / rich-text typography wrapper
 * (Wave-18 W18.F).
 *
 * Two consumption modes:
 *   1. HTML mode: `<Prose :html="rendered" />` — wraps a string of
 *      pre-rendered markup (used by `MarkdownView` when opting in
 *      via `:prose`).
 *   2. Slot mode: `<Prose><h2>…</h2><p>…</p></Prose>` — wraps
 *      arbitrary Vue children for inline markdown-style sections.
 *
 * Styles are applied via a single namespaced class (`.prose-comfy`)
 * defined in a non-scoped `<style>` block so they reach inside
 * `v-html` content (which doesn't carry a scoped data-v hash).
 *
 * See `src/design-system/system.md` §Typography for the role this
 * primitive plays. Density / max-width modes let pages tune the
 * vertical rhythm without per-page CSS.
 */
type Density = 'comfortable' | 'compact'
type MaxWidth = 'prose' | 'wide' | 'full'

const props = withDefaults(
  defineProps<{
    /** Raw HTML to render. Trusted — caller is responsible for sanitization. */
    html?: string
    /** Apply a serif drop-cap to the first paragraph. */
    dropCap?: boolean
    /** Vertical rhythm tightness. */
    density?: Density
    /** Maximum measure. */
    maxWidth?: MaxWidth
  }>(),
  {
    html: undefined,
    dropCap: false,
    density: 'comfortable',
    maxWidth: 'prose'
  }
)

const MAX_WIDTHS: Record<MaxWidth, string> = {
  prose: 'max-w-prose',
  wide: 'max-w-3xl',
  full: 'max-w-none'
}

const DENSITY_CLASSES: Record<Density, string> = {
  comfortable: 'prose-comfy--comfortable',
  compact: 'prose-comfy--compact'
}

const wrapperClass = computed(() =>
  cn(
    'prose-comfy',
    DENSITY_CLASSES[props.density],
    MAX_WIDTHS[props.maxWidth],
    'mx-auto text-[15px] text-zinc-900 dark:text-zinc-100',
    props.dropCap && 'prose-comfy--dropcap'
  )
)
</script>

<template>
  <div
    v-if="html"
    :class="wrapperClass"
    data-testid="prose"
    v-html="html"
  />
  <div v-else :class="wrapperClass" data-testid="prose">
    <slot />
  </div>
</template>

<!--
  NOTE: intentionally NOT `scoped`. Markup injected via `v-html`
  does not carry the data-v scoping hash, so a scoped style block
  would skip every heading / paragraph that came in as a string.
  The single `.prose-comfy` class namespace keeps these selectors
  from leaking into unrelated parts of the app.
-->
<style>
.prose-comfy {
  line-height: 1.7;
}

.prose-comfy--compact {
  line-height: 1.5;
}

/* Headings ─────────────────────────────────────────────────── */
.prose-comfy :where(h1, h2, h3, h4, h5, h6) {
  scroll-margin-top: 5rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  text-wrap: balance;
}

.prose-comfy h1 {
  font-size: 1.875rem; /* text-3xl */
  margin-top: 3rem;
  margin-bottom: 1.5rem;
}
.prose-comfy h2 {
  font-size: 1.25rem; /* text-xl */
  margin-top: 2.5rem;
  margin-bottom: 1rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid rgb(228 228 231); /* zinc-200 */
}
:where(.dark) .prose-comfy h2 {
  border-bottom-color: rgb(39 39 42); /* zinc-800 */
}
.prose-comfy h3 {
  font-size: 1.125rem; /* text-lg */
  margin-top: 2rem;
  margin-bottom: 0.75rem;
}
.prose-comfy h4 {
  font-size: 1rem; /* text-base */
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.prose-comfy--compact :where(h1, h2, h3, h4) {
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

/* Paragraphs ───────────────────────────────────────────────── */
.prose-comfy p {
  margin-top: 1rem;
  margin-bottom: 1rem;
  text-wrap: pretty;
}
.prose-comfy--compact p {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

/* Lists ────────────────────────────────────────────────────── */
.prose-comfy ul,
.prose-comfy ol {
  margin-top: 1rem;
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}
.prose-comfy ul {
  list-style: disc;
  list-style-position: outside;
}
.prose-comfy ol {
  list-style: decimal;
  list-style-position: outside;
}
.prose-comfy li + li {
  margin-top: 0.375rem;
}
.prose-comfy li > ul,
.prose-comfy li > ol {
  margin-top: 0.375rem;
  margin-bottom: 0.375rem;
}

/* Inline code ──────────────────────────────────────────────── */
.prose-comfy :not(pre) > code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', monospace;
  font-size: 0.9em;
  background-color: rgb(244 244 245); /* zinc-100 */
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
}
:where(.dark) .prose-comfy :not(pre) > code {
  background-color: rgb(39 39 42); /* zinc-800 */
}

/* Code blocks ─────────────────────────────────────────────── */
.prose-comfy pre {
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  border-radius: 0.375rem;
  background-color: rgb(244 244 245); /* zinc-100 */
  border: 1px solid rgb(228 228 231); /* zinc-200 */
  overflow-x: auto;
  font-size: 0.875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', monospace;
  line-height: 1.6;
}
:where(.dark) .prose-comfy pre {
  background-color: rgb(24 24 27); /* zinc-900 */
  border-color: rgb(39 39 42); /* zinc-800 */
}
.prose-comfy pre code {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  font-size: inherit;
}

/* Blockquotes ─────────────────────────────────────────────── */
.prose-comfy blockquote {
  margin-top: 1rem;
  margin-bottom: 1rem;
  padding-left: 1rem;
  border-left: 4px solid rgb(212 212 216); /* zinc-300 */
  font-style: italic;
  color: rgb(113 113 122); /* zinc-500 */
}
:where(.dark) .prose-comfy blockquote {
  border-left-color: rgb(82 82 91); /* zinc-600 */
  color: rgb(161 161 170); /* zinc-400 */
}

/* HR ──────────────────────────────────────────────────────── */
.prose-comfy hr {
  margin-top: 2rem;
  margin-bottom: 2rem;
  border-color: rgb(228 228 231); /* zinc-200 */
}
:where(.dark) .prose-comfy hr {
  border-color: rgb(39 39 42); /* zinc-800 */
}

/* Tables ─────────────────────────────────────────────────── */
.prose-comfy table {
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.prose-comfy th,
.prose-comfy td {
  border: 1px solid rgb(228 228 231); /* zinc-200 */
  padding: 0.5rem 0.75rem;
  text-align: left;
}
:where(.dark) .prose-comfy th,
:where(.dark) .prose-comfy td {
  border-color: rgb(39 39 42); /* zinc-800 */
}
.prose-comfy th {
  font-weight: 600;
}

/* Links ───────────────────────────────────────────────────── */
.prose-comfy a {
  color: rgb(37 99 235); /* blue-600 */
  text-underline-offset: 2px;
}
:where(.dark) .prose-comfy a {
  color: rgb(96 165 250); /* blue-400 */
}
.prose-comfy a:hover {
  text-decoration: underline;
}

/* Drop-cap (opt-in) ───────────────────────────────────────── */
.prose-comfy--dropcap > p:first-of-type::first-letter,
.prose-comfy--dropcap h2:first-of-type + p::first-letter {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 3rem; /* ≈ text-5xl */
  font-weight: 600;
  float: left;
  margin-right: 0.5rem;
  margin-top: 0.25rem;
  line-height: 1;
}
</style>
