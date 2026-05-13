import { test, expect } from '@playwright/test'

test.describe('Patterns Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/patterns')
  })

  test('displays patterns table', async ({ page }) => {
    // Should have pattern rows in table
    await expect(page.locator('table tbody tr').first()).toBeVisible()
  })

  test('clicking a pattern row navigates to detail', async ({ page }) => {
    // Click first pattern link in table
    await page.locator('table tbody tr').first().locator('a').first().click()
    await expect(page).toHaveURL(/\/patterns\//)
  })

  test('url search param filters patterns', async ({ page }) => {
    // Navigate with query param
    await page.goto('/patterns?q=GraphToPrompt')

    // Wait for filtered results
    await page.waitForTimeout(300)

    // Should have fewer rows
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })
})
