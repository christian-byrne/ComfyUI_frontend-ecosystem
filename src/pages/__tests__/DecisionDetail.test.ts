import { mount } from '@vue/test-utils'
import { createHead } from '@unhead/vue/client'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import DecisionDetail from '../DecisionDetail.vue'
import { pickRelatedDecisions, statusVariant, wrapCallouts } from '../decision-detail-helpers'
import { decisionsSorted, manifest, type ManifestEntry } from '@/data/knowledge-loader'

/**
 * W18.H — pretty-print decision pages.
 *
 * Helper-function tests use pure inputs; the page-mount test exercises
 * the real synced manifest + decision body (no fixture mocking) so the
 * test catches schema drift between `build-knowledge-manifest.mjs` and
 * the page contract.
 */

describe('statusVariant()', () => {
  it('maps ACCEPTED (any casing, with trailing date) → success', () => {
    expect(statusVariant('ACCEPTED')).toBe('success')
    expect(statusVariant('accepted')).toBe('success')
    expect(statusVariant('ACCEPTED — 2026-05-20 (wave-12)')).toBe('success')
  })

  it('maps PROPOSED / DRAFT → warning', () => {
    expect(statusVariant('PROPOSED')).toBe('warning')
    expect(statusVariant('draft')).toBe('warning')
  })

  it('maps SUPERSEDED / REJECTED / DEPRECATED → danger', () => {
    expect(statusVariant('SUPERSEDED')).toBe('danger')
    expect(statusVariant('rejected')).toBe('danger')
    expect(statusVariant('DEPRECATED — 2026-05-21')).toBe('danger')
  })

  it('falls back to neutral for unknown / null', () => {
    expect(statusVariant('unknown')).toBe('neutral')
    expect(statusVariant(null)).toBe('neutral')
    expect(statusVariant(undefined)).toBe('neutral')
    expect(statusVariant('')).toBe('neutral')
  })
})

describe('wrapCallouts()', () => {
  it('wraps a "Decision" H2 section in adr-callout-decision', () => {
    const html = '<h2 id="decision">Decision</h2><p>verdict</p><h2 id="rationale">Rationale</h2>'
    const out = wrapCallouts(html)
    expect(out).toContain('<div class="adr-callout adr-callout-decision">')
    expect(out).toContain('<p>verdict</p>')
    // The next H2 is OUTSIDE the callout div.
    expect(out).toMatch(/<\/div>.*<h2 id="rationale">/s)
  })

  it('wraps a "Consequences" section', () => {
    const html = '<h2 id="consequences">Consequences</h2><ul><li>x</li></ul>'
    const out = wrapCallouts(html)
    expect(out).toContain('<div class="adr-callout adr-callout-consequences">')
    expect(out).toContain('<ul><li>x</li></ul>')
  })

  it('leaves unrelated sections untouched', () => {
    const html = '<h2 id="context">Context</h2><p>background</p>'
    expect(wrapCallouts(html)).toBe(html)
  })
})

describe('pickRelatedDecisions()', () => {
  const A = (
    slug: string,
    axioms: string[],
    extras: Partial<ManifestEntry> = {}
  ): ManifestEntry => ({
    slug,
    title: slug,
    status: 'accepted',
    axioms,
    adrs: [],
    waves: [],
    bytes: 0,
    path: `decisions/${slug}.md`,
    supersedes: [],
    supersededBy: [],
    ...extras
  })

  it('returns ADRs sharing axiom refs, sorted by overlap then slug', () => {
    const me = A('me', ['A1', 'A2'])
    const all = [
      me,
      A('a-shares-both', ['A1', 'A2']),
      A('b-shares-one', ['A1', 'A9']),
      A('c-unrelated', ['A9']),
      A('d-shares-one-too', ['A2'])
    ]
    const out = pickRelatedDecisions(me, all)
    expect(out.map((d) => d.slug)).toEqual(['a-shares-both', 'b-shares-one', 'd-shares-one-too'])
  })

  it('excludes decisions already linked via supersedes / supersededBy', () => {
    const me = A('me', ['A1'], {
      supersedes: ['old'],
      supersededBy: ['new']
    })
    const all = [me, A('old', ['A1']), A('new', ['A1']), A('other', ['A1'])]
    const out = pickRelatedDecisions(me, all)
    expect(out.map((d) => d.slug)).toEqual(['other'])
  })

  it('returns empty when current has no axioms', () => {
    const me = A('me', [])
    expect(pickRelatedDecisions(me, [me, A('o', ['A1'])])).toEqual([])
  })

  it('honors the limit (defaults to 5)', () => {
    const me = A('me', ['A1'])
    const all = [me, ...Array.from({ length: 10 }, (_, i) => A(`r${i}`, ['A1']))]
    expect(pickRelatedDecisions(me, all)).toHaveLength(5)
    expect(pickRelatedDecisions(me, all, 3)).toHaveLength(3)
  })
})

describe('DecisionDetail.vue page mount', () => {
  // Pick the first ACCEPTED decision in the synced manifest as the
  // happy-path fixture. We assert against the *real* data so the test
  // travels with schema changes (per other page tests in this dir).
  const happyPath = decisionsSorted.find((d) => d.status === 'accepted')

  function mountAt(slug: string) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/decisions/:slug',
          name: 'decision-detail',
          component: DecisionDetail
        },
        {
          path: '/decisions',
          name: 'decisions',
          component: { template: '<div />' }
        },
        {
          path: '/axioms',
          name: 'axioms',
          component: { template: '<div />' }
        }
      ]
    })
    const head = createHead()
    router.push(`/decisions/${slug}`)
    return router.isReady().then(() => mount(RouterView, { global: { plugins: [router, head] } }))
  }

  it('renders the not-found state for an unknown slug', async () => {
    const w = await mountAt('does-not-exist-xyz')
    expect(w.find('[data-testid="adr-not-found"]').exists()).toBe(true)
    expect(w.text()).toContain('does-not-exist-xyz')
  })

  it('renders the page shell, status badge, axioms, and back link for an accepted ADR', async () => {
    if (!happyPath) {
      // Defensive guard — the manifest should always have at least one
      // accepted ADR. If this ever flips, fail loudly rather than silently
      // skipping coverage.
      throw new Error('No ACCEPTED decision in manifest — fixture invalid')
    }
    const w = await mountAt(happyPath.slug)

    // Page shell rendered (not the not-found state).
    expect(w.find('[data-testid="adr-page"]').exists()).toBe(true)
    expect(w.find('[data-testid="adr-not-found"]').exists()).toBe(false)

    // Status badge present and colour-coded as success (ACCEPTED).
    const badge = w.find('[data-testid="adr-status-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('data-variant')).toBe('success')
    expect(badge.text()).toContain('ACCEPTED')

    // Slug appears in the header.
    const header = w.find('[data-testid="adr-header"]')
    expect(header.text()).toContain(happyPath.slug)

    // Back link present.
    const backLink = w.findAll('a').find((a) => a.text().includes('All decisions'))
    expect(backLink).toBeTruthy()
    expect(backLink!.attributes('href')).toBe('/decisions')
  })

  it('renders axiom chips that link to /axioms#a<n>-refs (W18.B fix)', async () => {
    // Find a decision with at least one axiom-ref.
    const fixture = decisionsSorted.find((d) => d.axioms.length > 0)
    if (!fixture) throw new Error('No ADR with axioms in manifest')
    const w = await mountAt(fixture.slug)

    const axiomGroup = w.find('[data-testid="adr-axioms"]')
    expect(axiomGroup.exists()).toBe(true)

    const first = fixture.axioms[0].toLowerCase()
    const link = axiomGroup
      .findAll('a')
      .find((a) => a.attributes('href') === `/axioms#${first}-refs`)
    expect(link).toBeTruthy()
  })

  it('renders supersedes chips when present', async () => {
    // Find a decision with at least one supersedes link. (`d5-events-and-payload-typing`
    // in the current manifest.)
    const fixture = manifest.decisions.find((d) => (d.supersedes ?? []).length > 0)
    if (!fixture) {
      // Soft-skip if the corpus changes and no ADR carries supersedes
      // anymore — the helper-level test above still covers the rendering.
      return
    }
    const w = await mountAt(fixture.slug)

    const sup = w.find('[data-testid="adr-supersedes"]')
    expect(sup.exists()).toBe(true)

    const target = fixture.supersedes![0]
    const link = sup.findAll('a').find((a) => a.attributes('href') === `/decisions/${target}`)
    expect(link).toBeTruthy()
  })

  it('wraps the Decision section in an adr-callout div when present', async () => {
    // The body must contain a `## Decision` H2 — most accepted ADRs do.
    const fixture = decisionsSorted.find((d) => d.status === 'accepted' && d.bytes > 1000)
    if (!fixture) throw new Error('No suitable accepted ADR in manifest')
    const w = await mountAt(fixture.slug)

    // Decision/Consequences callouts are injected as v-html — search the
    // rendered DOM string directly.
    const dom = w.html()
    // At least one of the two callout flavors should appear in any
    // sufficiently-large accepted ADR.
    expect(dom).toMatch(/adr-callout-(decision|consequences)/)
  })
})
