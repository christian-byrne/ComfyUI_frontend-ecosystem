/**
 * Wave-18 W18.O — End-to-end navigation smoke test.
 *
 * Asserts:
 *  1. Every static (non-dynamic) router path renders with h1 visible and
 *     no console errors.
 *  2. One representative fixture per dynamic route renders.
 *  3. From `/decisions`, clicking the first row reaches the detail page
 *     and the status badge is visible.
 *  4. From `/axioms`, clicking the first permalink chip updates the URL
 *     hash AND causes the viewport to scroll (scrollBehavior wired
 *     correctly — W18.B regression guard).
 *  5. From a decision detail page that cites axioms, clicking an axiom
 *     chip navigates to `/axioms#a*-refs` (chip-target alignment from
 *     W18.B).
 */
import { test, expect, type ConsoleMessage } from '@playwright/test'

const STATIC_ROUTES = [
  '/',
  '/patterns',
  '/behavior-categories',
  '/node-packs',
  '/heatmap',
  '/api-diff',
  '/audit',
  '/api-docs',
  '/handoff',
  '/decisions',
  '/axioms',
  '/glossary',
  '/knowledge-graph'
] as const

// One representative fixture per dynamic route. Slugs verified against
// real bundled data (patterns S6.A1, BC.01, comfyui-kjnodes, etc.).
const DYNAMIC_FIXTURES: Array<{ path: string; route: string }> = [
  { path: '/patterns/S6.A1', route: '/patterns/:id' },
  { path: '/behavior-categories/BC.01', route: '/behavior-categories/:id' },
  { path: '/node-packs/comfyui-kjnodes', route: '/node-packs/:packId' },
  { path: '/api-docs/createnodelocatorid', route: '/api-docs/:slug' },
  { path: '/handoff/root/axioms', route: '/handoff/root/:slug' },
  { path: '/decisions/d-api-surface-finalization', route: '/decisions/:slug' }
]

/**
 * Attach a console-error sink to a page. Returns the captured array so
 * tests can assert it stayed empty.
 *
 * We tolerate Vue's dev-mode HMR / hydration warnings (filtered below)
 * but reject anything classified as `error`.
 */
function captureConsoleErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = []
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    // Filter known-benign noise (e.g. favicon 404 in preview).
    if (/favicon|net::ERR_ABORTED.*favicon/i.test(text)) return
    errors.push(text)
  })
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`)
  })
  return errors
}

test.describe('Navigation smoke (W18.O)', () => {
  for (const path of STATIC_ROUTES) {
    test(`static route ${path} renders h1 + no console errors`, async ({ page }) => {
      const errors = captureConsoleErrors(page)
      const resp = await page.goto(path)
      expect(resp?.status(), `HTTP status for ${path}`).toBeLessThan(400)
      // h1 may render slightly after hydration on prose-heavy pages.
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 })
      expect(errors, `console errors on ${path}`).toEqual([])
    })
  }

  for (const { path, route } of DYNAMIC_FIXTURES) {
    test(`dynamic ${route} fixture ${path} renders h1`, async ({ page }) => {
      const errors = captureConsoleErrors(page)
      const resp = await page.goto(path)
      expect(resp?.status(), `HTTP status for ${path}`).toBeLessThan(400)
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 })
      expect(errors, `console errors on ${path}`).toEqual([])
    })
  }

  test('decisions: row click navigates to detail + status badge visible', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/decisions')
    await expect(page.locator('h1').first()).toBeVisible()
    // First decision-row link.
    const firstRow = page.locator('a[href^="/decisions/"]').first()
    await expect(firstRow).toBeVisible()
    const href = await firstRow.getAttribute('href')
    await firstRow.click()
    await expect(page).toHaveURL(new RegExp(href!.replace(/[/]/g, '\\/') + '$'))
    // Status badge: per W18.H, the ADR detail page renders a Badge with
    // testid `adr-status-badge` carrying the uppercased status label.
    const statusBadge = page.getByTestId('adr-status-badge')
    await expect(statusBadge).toBeVisible({ timeout: 5_000 })
    expect(errors, 'console errors on decision detail').toEqual([])
  })

  test('axioms: permalink chip updates hash and scrolls (W18.B scrollBehavior)', async ({
    page
  }) => {
    await page.goto('/axioms')
    await expect(page.locator('h1').first()).toBeVisible()
    // Wait for the axiom permalink chips to render.
    const firstChip = page.locator('a[href*="/axioms#a"]').first()
    await expect(firstChip).toBeVisible({ timeout: 10_000 })
    const href = await firstChip.getAttribute('href')
    expect(href).toMatch(/\/axioms#a\d+-refs?$/)
    await firstChip.click()
    // URL hash updates.
    await expect(page).toHaveURL(new RegExp('#a\\d+(-refs)?$'))
    // Viewport scrolled past initial position (scrollBehavior fires on hash nav).
    // Wait briefly for the smooth-scroll to settle.
    await page.waitForTimeout(800)
    const scrollY = await page.evaluate(() => window.scrollY)
    expect(scrollY, 'scrollBehavior should scroll past origin').toBeGreaterThan(50)
  })

  // ───────────────────────────────────────────────────────────────
  // W19.A4 — Derived-theorems section on /axioms.
  // ───────────────────────────────────────────────────────────────
  test('axioms: derived-theorems section visible + ADR chip navigates', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/axioms')
    await expect(page.locator('h1').first()).toBeVisible()
    const theoremSection = page.getByTestId('theorems')
    await expect(theoremSection).toBeVisible({ timeout: 10_000 })
    // At least one theorem card renders.
    const firstCard = page.getByTestId('theorem-card').first()
    await expect(firstCard).toBeVisible()
    // Each card carries at least one ADR link in its consequence chips.
    const firstAdrChip = firstCard.getByTestId('theorem-adrs').locator('a').first()
    await expect(firstAdrChip).toBeVisible()
    const href = await firstAdrChip.getAttribute('href')
    expect(href, 'theorem ADR chip must target /decisions/<slug>').toMatch(/^\/decisions\//)
    await firstAdrChip.click()
    await expect(page).toHaveURL(new RegExp(href!.replace(/[/]/g, '\\/') + '$'))
    // ADR detail page renders h1.
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 })
    expect(errors, 'console errors on theorems → ADR navigation').toEqual([])
  })

  // ── Wave-19 W19.A11 — deeper deep-link regression coverage ─────────
  // Targets DrJKL's specific complaint pattern: dedupe slugs (W18.M),
  // scrollBehavior (W18.A), and chip→`-refs` alignment (W18.B) tested
  // against real ADR/axiom content rather than synthetic fixtures.

  test('W19.A11: /decisions/d13-ecs-alignment-audit#action-items deep-link + DecisionDetail dedupe gap', async ({
    page
  }) => {
    // Wave-19 W19.A11 finding (real production bug, kept un-fixed per
    // W19.A11 worker-prompt instruction "document but don't fix"):
    // DecisionDetail.vue registers its OWN `marked` renderer with a
    // stateless `slugify()` — the W18.M dedupe fix only landed in
    // MarkdownView.vue. So on D13 (which has `### Action Items` 6× and
    // `### Impact on Extension API` 4×) all repeated headings emit the
    // SAME `id="action-items"`, producing invalid HTML and breaking
    // hash-links #action-items-1..#action-items-5.
    //
    // This test asserts the CURRENT (buggy) behavior so it acts as a
    // regression guard for both directions:
    //   (a) if someone backports the W18.M dedupe to DecisionDetail.vue,
    //       `#action-items-1` will appear → this test will fail loudly →
    //       update the test to assert the new correct behavior.
    //   (b) if the page somehow stops emitting `id="action-items"` at
    //       all, this test fails too.
    //
    // Follow-up: file an issue to extract slugify+dedupe into a shared
    // composable used by all three marked-using pages (MarkdownView,
    // DecisionDetail, Axioms, ApiDocs).
    await page.goto('/decisions/d13-ecs-alignment-audit#action-items')
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(1200)
    // Exactly one element is reachable via #action-items (the first one).
    const firstActionItems = page.locator('h3#action-items').first()
    await expect(firstActionItems, 'first #action-items h3 must exist').toBeVisible({
      timeout: 5_000
    })
    expect(
      await firstActionItems.evaluate((el) => {
        const r = el.getBoundingClientRect()
        return r.top >= -50 && r.top < window.innerHeight
      }),
      'first h3#action-items should be in viewport after scrollBehavior'
    ).toBe(true)
    // Document the gap: the dedupe-suffix anchors should exist but DON'T.
    // When DecisionDetail.vue gains dedupe, this expectation flips to >= 5.
    const dedupedCount = await page.locator('h3[id^="action-items-"]').count()
    expect(
      dedupedCount,
      'DecisionDetail.vue currently lacks dedupe (W18.M gap) — 0 suffixed ids until fixed'
    ).toBe(0)
    // And there are 6 duplicate-id elements (invalid HTML, real bug).
    const duplicateCount = await page.locator('h3#action-items').count()
    expect(duplicateCount, 'D13 emits 6 duplicate id="action-items" h3s (real bug)').toBe(6)
  })

  test('W19.A11: /axioms#a12-refs puts A12 axiom card into viewport', async ({ page }) => {
    // The axioms page renders a card per axiom with `<h3 id="aN-refs">`.
    // Spec called for `#a12-mount-lifecycle-as-the-sole-dom-seam`, but the
    // page's actual canonical anchor for A12 is `#a12-refs` (see
    // src/pages/Axioms.vue card chrome). Use the real anchor — same
    // invariant: deep link → MarkdownView/Prose-rendered heading scrolls
    // into view via the router's scrollBehavior (W18.A).
    await page.goto('/axioms#a12-refs')
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 })
    const a12 = page.locator('h3#a12-refs')
    await expect(a12, 'A12 axiom card h3 must exist').toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(800)
    expect(
      await a12.evaluate((el) => {
        const r = el.getBoundingClientRect()
        return r.top >= 0 && r.top < window.innerHeight
      }),
      'h3#a12-refs should be in viewport after scrollBehavior fired'
    ).toBe(true)
  })

  test('W19.A11: in-content axiom cross-link scrolls hash + target into viewport', async ({
    page
  }) => {
    // No ADR in the synced knowledge currently contains an in-body
    // `[A12](#a12-...)` markdown link (verified via grep over
    // src/data/knowledge/). Per W19.A11 spec note, scaffold against the
    // known-stable `/axioms` "Related:" cross-ref chips, which are
    // in-content links from inside one axiom card → another axiom card
    // anchor. Tests the same invariant the spec named: click an in-content
    // cross-link → hash updates → target scrolls into viewport.
    await page.goto('/axioms')
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 })
    // Find the first cross-ref chip inside any axiom card.
    const xref = page.locator('[data-testid="axiom-xrefs"] a[href*="/axioms#a"]').first()
    await expect(xref, 'at least one axiom card must expose a Related: cross-ref').toBeVisible({
      timeout: 10_000
    })
    const href = await xref.getAttribute('href')
    expect(href, 'cross-ref chip must target /axioms#aN-refs').toMatch(/\/axioms#a\d+-refs$/)
    const targetId = href!.split('#')[1]
    await xref.click()
    await expect(page).toHaveURL(new RegExp(`#${targetId}$`))
    // Smooth scroll across a long page (A14→A1 etc.) needs ~1.5s.
    await page.waitForTimeout(1800)
    const target = page.locator(`h3#${targetId}`)
    await expect(target, `${targetId} target h3 must exist`).toBeVisible()
    expect(
      await target.evaluate((el) => {
        const r = el.getBoundingClientRect()
        return r.top >= -100 && r.top < window.innerHeight
      }),
      `${targetId} should be in viewport after click + scrollBehavior`
    ).toBe(true)
  })

  // ───────────────────────────────────────────────────────────────
  // W19.A3 — Glossary page renders ≥14 terms as h2.
  // ───────────────────────────────────────────────────────────────
  test('glossary: ≥14 term h2 headings render', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    const resp = await page.goto('/glossary')
    expect(resp?.status(), 'HTTP status for /glossary').toBeLessThan(400)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 })
    // Wait for MarkdownView to flush the parsed body so h2 ids exist.
    const h2 = page.locator('article[data-testid="glossary-content"] h2')
    await expect(h2.first()).toBeVisible({ timeout: 10_000 })
    const count = await h2.count()
    expect(
      count,
      'glossary must publish ≥14 Capitalized Terms of Art (W19.A3 baseline)'
    ).toBeGreaterThanOrEqual(14)
    expect(errors, 'console errors on /glossary').toEqual([])
  })

  test('decision → axiom chip navigates to /axioms#a*-refs', async ({ page }) => {
    // Open an ADR known to cite axioms (D-api-surface-finalization references
    // multiple A* axioms in its header chips).
    await page.goto('/decisions/d-api-surface-finalization')
    await expect(page.locator('h1').first()).toBeVisible()
    // Axiom chips on a decision page link to /axioms#aN-refs per W18.B fix.
    const axiomChip = page.locator('a[href^="/axioms#a"][href$="-refs"]').first()
    // If this ADR doesn't have axiom chips, fall back to another known one.
    if (!(await axiomChip.isVisible().catch(() => false))) {
      await page.goto('/decisions/d-no-node-widget-access')
      await expect(page.locator('h1').first()).toBeVisible()
    }
    const chip = page.locator('a[href^="/axioms#a"][href$="-refs"]').first()
    await expect(chip).toBeVisible({ timeout: 10_000 })
    const href = await chip.getAttribute('href')
    expect(href, 'axiom chip must use -refs suffix per W18.B').toMatch(/\/axioms#a\d+-refs$/)
    await chip.click()
    await expect(page).toHaveURL(new RegExp('/axioms#a\\d+-refs$'))
  })
})
