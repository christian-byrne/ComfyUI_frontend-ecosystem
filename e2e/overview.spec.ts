import { test, expect } from '@playwright/test'

test.describe('Overview Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('displays overview stats', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('shows pattern count', async ({ page }) => {
    // Scope to the hero <dl>. An unscoped /\d+ patterns/ text match also hits
    // the provenance notice ("73 patterns against upstream's 79"), which lives
    // in a collapsed <details> and is therefore not visible.
    const stat = page.getByTestId('hero-patterns')
    await expect(stat).toBeVisible()
    await expect(stat.locator('dd')).toHaveText(/^\d+$/)
  })

  test('shows evidence count', async ({ page }) => {
    const stat = page.getByTestId('hero-evidence-rows')
    await expect(stat).toBeVisible()
    await expect(stat.locator('dd')).toHaveText(/^[\d,]+$/)
  })

  test('has quick links to other pages', async ({ page }) => {
    await expect(page.getByRole('link', { name: /patterns/i }).first()).toBeVisible()
  })

  test('carries a provenance notice warning the counts are a floor', async ({ page }) => {
    const notice = page.getByTestId('provenance-notice')
    await expect(notice).toBeVisible()
    // Collapsed by default so it informs without dominating the page.
    await expect(notice).not.toHaveAttribute('open', /.*/)

    await notice.locator('summary').click()
    await expect(notice).toContainText(/one workspace-amend behind upstream/i)
    await expect(notice).toContainText(/never back-propagated/i)
    await expect(notice).toContainText(/v2 extension API rewrite is deferred/i)
    await expect(notice).toContainText(/compat floor: retired/i)
  })
})
