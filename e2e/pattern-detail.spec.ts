import { test, expect } from '@playwright/test'

test.describe('Pattern Detail Page', () => {
  test('displays pattern info', async ({ page }) => {
    // Navigate to a known pattern
    await page.goto('/patterns/S6.A1')

    // Should show pattern header with pattern ID
    await expect(page.getByTestId('pattern-header')).toBeVisible()
    await expect(page.locator('h1')).toContainText('S6.A1')

    // Should show v1/v2 surface pair
    await expect(page.getByTestId('surface-pair')).toBeVisible()

    // Should show evidence section
    await expect(page.getByTestId('evidence')).toBeVisible()
  })

  test('has contract test section', async ({ page }) => {
    await page.goto('/patterns/S6.A1')

    // Contract test section should exist
    await expect(page.getByTestId('contract-test')).toBeVisible()

    // Should have some button (either run-test-btn or disabled no-test button)
    const hasRunBtn = await page.getByTestId('run-test-btn').isVisible().catch(() => false)
    const hasDisabledBtn = await page.locator('button:has-text("No test available")').isVisible().catch(() => false)

    expect(hasRunBtn || hasDisabledBtn).toBe(true)
  })

  test('shows not found for invalid pattern', async ({ page }) => {
    await page.goto('/patterns/INVALID.X99')

    // Should show not found message
    await expect(page.getByTestId('pattern-not-found')).toBeVisible()
  })

  test('back link returns to patterns list', async ({ page }) => {
    await page.goto('/patterns/S6.A1')

    // Click back link
    await page.getByRole('link', { name: /patterns/i }).first().click()
    await expect(page).toHaveURL(/\/patterns$/)
  })
})
