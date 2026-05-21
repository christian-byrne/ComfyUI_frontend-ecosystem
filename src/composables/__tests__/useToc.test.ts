import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useToc } from '../useToc'

/**
 * Builds a tiny component that exposes `useToc` against an inline DOM
 * fragment. Avoids needing JSDom for raw container construction —
 * the test mounts and inspects the resulting `items` ref.
 */
function makeHarness(innerHtml: string) {
  return defineComponent({
    setup() {
      const root = ref<HTMLElement | null>(null)
      const { items, rebuild } = useToc(() => root.value)
      return { root, items, rebuild }
    },
    render() {
      return h('div', {
        ref: 'root',
        innerHTML: innerHtml
      })
    }
  })
}

describe('useToc', () => {
  it('extracts h2/h3 headings in document order with id/title/depth', async () => {
    const harness = makeHarness(
      '<h2 id="alpha">Alpha</h2>' +
        '<p>x</p>' +
        '<h3 id="alpha-sub">Alpha sub</h3>' +
        '<h2 id="beta">Beta</h2>'
    )
    const w = mount(harness)
    await nextTick()
    expect(w.vm.items).toEqual([
      { id: 'alpha', title: 'Alpha', depth: 2 },
      { id: 'alpha-sub', title: 'Alpha sub', depth: 3 },
      { id: 'beta', title: 'Beta', depth: 2 }
    ])
  })

  it('ignores headings that have no id', async () => {
    const harness = makeHarness(
      '<h2 id="kept">Kept</h2><h2>Dropped</h2><h3 id="kept-3">Kept 3</h3>'
    )
    const w = mount(harness)
    await nextTick()
    expect(w.vm.items.map((i) => i.id)).toEqual(['kept', 'kept-3'])
  })

  it('returns an empty list when the container is null', async () => {
    const harness = defineComponent({
      setup() {
        const { items } = useToc(() => null)
        return { items }
      },
      render() {
        return h('div')
      }
    })
    const w = mount(harness)
    await nextTick()
    expect(w.vm.items).toEqual([])
  })

  it('rebuild() picks up newly-inserted headings', async () => {
    const harness = defineComponent({
      setup() {
        const root = ref<HTMLElement | null>(null)
        const { items, rebuild } = useToc(() => root.value)
        return { root, items, rebuild }
      },
      render() {
        return h('div', { ref: 'root' }, [])
      }
    })
    const w = mount(harness)
    await nextTick()
    expect(w.vm.items).toEqual([])

    // Simulate an async render filling in headings.
    w.vm.root!.innerHTML = '<h2 id="late">Late</h2>'
    w.vm.rebuild()
    expect(w.vm.items).toEqual([
      { id: 'late', title: 'Late', depth: 2 }
    ])
  })
})
