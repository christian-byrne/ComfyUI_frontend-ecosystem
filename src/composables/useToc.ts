import { onMounted, ref } from 'vue'

/**
 * Heading entry produced by `useToc`. Matches `Toc.vue`'s `TocItem`.
 */
export interface TocItem {
  id: string
  title: string
  depth: number
}

/**
 * `useToc` — extracts an ordered list of h2 / h3 headings (those
 * with an `id` attribute) from a rendered container element.
 *
 * Pair with `<MarkdownView :prose>` which emits ids via the
 * `renderer.heading` slugifier (see `MarkdownView.vue`).
 *
 * The container is fetched lazily via a getter so callers can pass
 * a template ref before it's resolved without races. Call
 * `rebuild()` after any async render that changes headings.
 *
 * @example
 *   const root = ref<HTMLElement | null>(null)
 *   const { items, rebuild } = useToc(() => root.value)
 *   watch(body, () => nextTick(rebuild))
 */
export function useToc(containerEl: () => HTMLElement | null) {
  const items = ref<TocItem[]>([])

  function rebuild() {
    const el = containerEl()
    if (!el) {
      items.value = []
      return
    }
    const headings = el.querySelectorAll<HTMLHeadingElement>('h2[id], h3[id]')
    items.value = Array.from(headings).map((h) => ({
      id: h.id,
      title: h.textContent?.trim() ?? '',
      depth: Number(h.tagName.slice(1))
    }))
  }

  onMounted(rebuild)
  return { items, rebuild }
}
