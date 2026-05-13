import { test, expect } from '@playwright/test'

test.describe('Behavior Categories Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/behavior-categories')
  })

  test('displays categories grid', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/behavior categories/i)
    // Should have category cards
    await expect(page.locator('[data-test="bc-grid"]')).toBeVisible()
    await expect(page.locator('[data-test="bc-card"]').first()).toBeVisible()
  })

  test('categories show BC.XX format ids', async ({ page }) => {
    // Categories should have BC.XX format IDs
    await expect(page.getByText(/BC\.\d+/).first()).toBeVisible()
  })

  test('clicking category navigates to detail', async ({ page }) => {
    // Click first category card
    await page.locator('[data-test="bc-card"]').first().click()
    await expect(page).toHaveURL(/\/behavior-categories\/BC\.\d+/)
  })
})

test.describe('Category Detail Page', () => {
  test('displays category info', async ({ page }) => {
    await page.goto('/behavior-categories/BC.01')

    // Should show category ID
    await expect(page.getByText('BC.01')).toBeVisible()
  })

  test('shows member patterns section', async ({ page }) => {
    await page.goto('/behavior-categories/BC.01')

    // Should show member patterns heading
    await expect(page.getByRole('heading', { name: /member patterns/i })).toBeVisible()
  })

  test('back link returns to categories list', async ({ page }) => {
    await page.goto('/behavior-categories/BC.01')

    // Click back link (the categories nav link)
    await page.getByTestId('primary-nav').getByRole('link', { name: /behavior categories/i }).click()
    await expect(page).toHaveURL(/\/behavior-categories$/)
  })
})
