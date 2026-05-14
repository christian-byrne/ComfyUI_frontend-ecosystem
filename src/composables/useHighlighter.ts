/**
 * useHighlighter — async Shiki highlighter for code blocks.
 *
 * Loads shiki once on first use, then caches the instance.
 * Returns highlighted HTML for TypeScript/JavaScript code.
 */
import { ref, shallowRef } from "vue";
import { createHighlighter, type Highlighter } from "shiki";

const highlighter = shallowRef<Highlighter | null>(null);
const loading = ref(false);
const ready = ref(false);

export async function ensureHighlighter(): Promise<Highlighter> {
  if (highlighter.value) return highlighter.value;
  if (loading.value) {
    // Wait for existing load to complete
    while (loading.value) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return highlighter.value!;
  }

  loading.value = true;
  try {
    highlighter.value = await createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: ["typescript", "javascript", "json", "bash"],
    });
    ready.value = true;
  } finally {
    loading.value = false;
  }
  return highlighter.value!;
}

export function useHighlighter() {
  return { highlighter, loading, ready, ensureHighlighter };
}

/**
 * Highlight code synchronously if highlighter is ready, else return escaped HTML.
 */
export function highlightCode(
  code: string,
  lang: string = "typescript"
): string {
  if (!highlighter.value) {
    // Fallback: escape HTML and wrap in pre/code
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre class="shiki"><code>${escaped}</code></pre>`;
  }

  return highlighter.value.codeToHtml(code, {
    lang,
    themes: {
      light: "github-light",
      dark: "github-dark",
    },
  });
}
