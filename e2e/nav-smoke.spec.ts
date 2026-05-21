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

  test('axioms: permalink chip updates hash and scrolls (W18.B scrollBehavior)', async ({ page }) => {
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
