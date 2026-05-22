import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import Axioms from '../Axioms.vue'

// Provide a minimal AXIOMS.md fixture so tests don't depend on the
// real synced knowledge content.
vi.mock('@/data/knowledge-loader', () => {
  const fixtureMd = [
    '# Axioms test fixture',
    '',
    '> Intro paragraph used to exercise the preamble + drop-cap.',
    '',
    '## A1: Widget-Centric Philosophy',
    '',
    'A1 body referencing A14 and A15 for cross-ref detection.',
    '',
    '## A14: Phase A Surface Exclusions',
    '',
    'A14 body referencing A1 once.',
    '',
    '## A15: Widget Declarativity',
    '',
    'A15 body referencing A1 and A16.',
    '',
    '## A16: Unified Serialization Target',
    '',
    'A16 body referencing A15.'
  ].join('\n')
  // W19.A4 — derived-theorems fixture. Two theorems; each carries the
  // canonical `**Premises**:` line + a `[label](./decisions/<slug>.md)`
  // consequence link the page is expected to surface as chips.
  const fixtureTheoremsMd = [
    '# Derived theorems fixture',
    '',
    '## Theorem 1: Widget Identity Independence',
    '',
    '**Premises**: A1, A3.',
    '',
    'Statement paragraph.',
    '',
    '**Consequences**:',
    '',
    '- [D-linked-subgraph-constraint](./decisions/D-linked-subgraph-constraint.md) — explanation.',
    '- [D-widget-converge](./decisions/D-widget-converge.md) — explanation.',
    '',
    '## Theorem 2: Schema Validation Boundary',
    '',
    '**Premises**: A5, A1.',
    '',
    'Statement paragraph.',
    '',
    '**Consequences**:',
    '',
    '- [D-immutability-enforcement](./decisions/D-immutability-enforcement.md) — explanation.'
  ].join('\n')
  return {
    allAxioms: ['A1', 'A14', 'A15', 'A16'],
    getRootBody: (slug: string) => {
      const s = slug.toLowerCase()
      if (s === 'axioms') return fixtureMd
      if (s === 'axioms-theorems') return fixtureTheoremsMd
      return undefined
    },
    manifest: {
      axiomIndex: {
        A1: ['d-foo', 'd-bar'],
        A14: ['d-baz'],
        A15: [],
        A16: ['d-qux']
      }
    }
  }
})

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/axioms', name: 'axioms', component: Axioms },
      { path: '/decisions/:slug', name: 'decision', component: Axioms }
    ]
  })
}

async function mountAxioms() {
  const router = makeRouter()
  router.push('/axioms')
  await router.isReady()
  return mount(Axioms, {
    global: { plugins: [router] }
  })
}

describe('axioms.vue (W18.G bible treatment)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders without errors from a fixture body', async () => {
    const wrapper = await mountAxioms()
    expect(wrapper.find('h1').text()).toBe('Axioms')
    // Each fixture axiom renders an anchor card.
    const cards = wrapper.findAll('[data-testid="axiom-refs"] article')
    expect(cards).toHaveLength(4)
    // The h3 carries the canonical `${id}-refs` anchor so existing
    // `/axioms#a1-refs` deep-links keep working.
    expect(wrapper.find('h3#a1-refs').exists()).toBe(true)
    expect(wrapper.find('h3#a14-refs').exists()).toBe(true)
    expect(wrapper.find('h3#a15-refs').exists()).toBe(true)
    expect(wrapper.find('h3#a16-refs').exists()).toBe(true)
  })

  it('renders cross-ref chips with the right `:to` paths', async () => {
    const wrapper = await mountAxioms()
    // A1's body mentions A14 and A15.
    const a1Card = wrapper
      .findAll('[data-testid="axiom-refs"] article')
      .find((c) => c.find('h3#a1-refs').exists())
    expect(a1Card).toBeDefined()
    const a1Chips = a1Card!.findAll('[data-testid="axiom-xrefs"] a')
    const a1Targets = a1Chips.map((c) => c.attributes('href'))
    expect(a1Targets).toEqual(expect.arrayContaining(['/axioms#a14-refs', '/axioms#a15-refs']))
    // A14's body mentions A1 only.
    const a14Card = wrapper
      .findAll('[data-testid="axiom-refs"] article')
      .find((c) => c.find('h3#a14-refs').exists())
    const a14Chips = a14Card!.findAll('[data-testid="axiom-xrefs"] a')
    expect(a14Chips).toHaveLength(1)
    expect(a14Chips[0]!.attributes('href')).toBe('/axioms#a1-refs')
  })

  // ─────────────────────────────────────────────────────────────────
  // W19.A4 — Derived theorems section.
  // ─────────────────────────────────────────────────────────────────
  it('renders the derived-theorems section with one card per theorem', async () => {
    const wrapper = await mountAxioms()
    const theoremSection = wrapper.find('[data-testid="theorems"]')
    expect(theoremSection.exists()).toBe(true)
    const theoremCards = wrapper.findAll('[data-testid="theorem-card"]')
    expect(theoremCards).toHaveLength(2)
    // Each theorem heading is present.
    expect(wrapper.text()).toContain('Widget Identity Independence')
    expect(wrapper.text()).toContain('Schema Validation Boundary')
  })

  it('every theorem surfaces ≥ 1 ADR link and ≥ 2 axiom premises', async () => {
    const wrapper = await mountAxioms()
    const cards = wrapper.findAll('[data-testid="theorem-card"]')
    for (const card of cards) {
      const adrChips = card.findAll('[data-testid="theorem-adrs"] a')
      expect(adrChips.length, 'each theorem must cite at least one ADR').toBeGreaterThanOrEqual(1)
      // ADR chips point at /decisions/<slug>.
      for (const chip of adrChips) {
        expect(chip.attributes('href')).toMatch(/^\/decisions\//)
      }
      const premiseChips = card.findAll('[data-testid="theorem-premises"] a')
      expect(
        premiseChips.length,
        'each theorem must cite at least two axiom premises'
      ).toBeGreaterThanOrEqual(2)
      // Premise chips link back to the canonical axiom card anchor.
      for (const chip of premiseChips) {
        expect(chip.attributes('href')).toMatch(/^\/axioms#a\d+-refs$/)
      }
    }
  })

  it('copyPermalink writes the expected URL to the clipboard', async () => {
    // jsdom doesn't provide a writable clipboard; install a stub.
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })

    const wrapper = await mountAxioms()
    const btn = wrapper.find('[data-testid="copy-permalink-A1"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')

    // jsdom's window.location.origin is `http://localhost` by default
    // and `pathname` is `/`. The hash is the lowercased axiom id + `-refs`.
    expect(writeText).toHaveBeenCalledTimes(1)
    const url = writeText.mock.calls[0]![0] as string
    expect(url.endsWith('#a1-refs')).toBe(true)
    expect(url.includes('http')).toBe(true)
  })
})
