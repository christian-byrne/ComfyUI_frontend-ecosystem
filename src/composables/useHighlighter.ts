import type { Highlighter } from 'shiki'
/**
 * useHighlighter — lazy-loaded async Shiki highlighter for code blocks.
 *
 * Loads shiki on first highlightCode() call via dynamic import for code splitting.
 * Returns placeholder/skeleton while loading, then re-renders when ready.
 */
import { ref, shallowRef } from 'vue'

const highlighter = shallowRef<Highlighter | null>(null)
const loading = ref(false)
const ready = ref(false)
const initPromise = shallowRef<Promise<Highlighter> | null>(null)

/** Map short lang aliases to full names for shiki */
const LANG_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  sh: 'bash',
  shell: 'bash'
}

export function normalizeLang(lang: string): string {
  return LANG_ALIASES[lang] || lang
}

export async function ensureHighlighter(): Promise<Highlighter> {
  if (highlighter.value) return highlighter.value
  if (initPromise.value) return initPromise.value

  loading.value = true
  initPromise.value = (async () => {
    const { createHighlighter } = await import('shiki')
    highlighter.value = await createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: ['typescript', 'javascript', 'json', 'bash']
    })
    ready.value = true
    loading.value = false
    return highlighter.value
  })()

  return initPromise.value
}

export function useHighlighter() {
  return { highlighter, loading, ready, ensureHighlighter }
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(code: string): string {
  return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Generate skeleton placeholder HTML while highlighter loads
 */
function getPlaceholderHtml(code: string): string {
  const escaped = escapeHtml(code)
  return `<pre class="shiki shiki-placeholder" data-loading="true"><code>${escaped}</code></pre>`
}

/**
 * Highlight code synchronously if highlighter is ready.
 * If not ready, triggers lazy load and returns placeholder.
 */
export function highlightCode(code: string, lang: string = 'typescript'): string {
  const normalizedLang = normalizeLang(lang)

  if (!highlighter.value) {
    // Trigger lazy load on first call (fire and forget)
    if (!initPromise.value) {
      ensureHighlighter()
    }
    // Return placeholder while loading
    return getPlaceholderHtml(code)
  }

  return highlighter.value.codeToHtml(code, {
    lang: normalizedLang,
    themes: {
      light: 'github-light',
      dark: 'github-dark'
    }
  })
}
