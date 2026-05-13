import { test, expect } from '@playwright/test'

test.describe('API Diff Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/api-diff')
  })

  test('displays api diff page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/api diff/i)
  })

  test('shows diff content', async ({ page }) => {
    // Should have diff viewer or sections
    await expect(page.locator('pre, code').first()).toBeVisible()
  })

  test('has toggle controls', async ({ page }) => {
    // Should have some controls for the diff view
    const controls = page.locator('button, input[type="checkbox"]')
    await expect(controls.first()).toBeVisible()
  })
})
