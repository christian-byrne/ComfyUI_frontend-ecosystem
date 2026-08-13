import { test, expect } from '@playwright/test'

test.describe('API Diff Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/api-diff')
  })

  test('displays api diff page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/api diff/i)
  })

  test('shows diff content', async ({ page }) => {
    // Scope to a card. The provenance notice above the grid also contains
    // <code> elements, so an unscoped 'pre, code' no longer proves the diff
    // itself rendered.
    const firstCard = page.getByTestId('api-diff-card').first()
    await expect(firstCard).toBeVisible()
    await expect(firstCard.locator('pre, code').first()).toBeVisible()
  })

  test('states up-front that the v2 rewrite is deferred', async ({ page }) => {
    // This page is the easiest to misread as a live roadmap, so its notice is
    // expanded by default rather than behind a disclosure triangle.
    const notice = page.getByTestId('provenance-notice')
    await expect(notice).toBeVisible()
    await expect(notice).toHaveAttribute('open', /.*/)
    await expect(notice).toContainText(/v2 extension API rewrite is deferred/i)
    await expect(notice).toContainText(/compat floor: retired/i)
  })

  test('has toggle controls', async ({ page }) => {
    // Should have some controls for the diff view
    const controls = page.locator('button, input[type="checkbox"]')
    await expect(controls.first()).toBeVisible()
  })
})
