import { test, expect } from '@playwright/test'

test.describe('Overview Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('displays overview stats', async ({ page }) => {
    // Overview is the home page
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('shows pattern count', async ({ page }) => {
    // Should show number of patterns
    await expect(page.getByText(/\d+ patterns/i)).toBeVisible()
  })

  test('shows evidence count', async ({ page }) => {
    // Should show evidence stats
    await expect(page.getByText('evidence rows')).toBeVisible()
  })

  test('has quick links to other pages', async ({ page }) => {
    // Should have links to patterns, heatmap, etc.
    await expect(page.getByRole('link', { name: /patterns/i }).first()).toBeVisible()
  })
})
