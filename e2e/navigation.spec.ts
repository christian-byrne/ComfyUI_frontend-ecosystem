import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('homepage shows overview', async ({ page }) => {
    await page.goto('/')
    // Overview is the home page
    await expect(page.getByText(/overview/i).first()).toBeVisible()
  })

  test('main nav links work', async ({ page }) => {
    await page.goto('/')

    // Click Patterns nav in header
    await page.getByTestId('primary-nav').getByRole('link', { name: /patterns/i }).click()
    await expect(page).toHaveURL(/\/patterns/)

    // Click Heatmap nav
    await page.getByTestId('primary-nav').getByRole('link', { name: /heatmap/i }).click()
    await expect(page).toHaveURL(/\/heatmap/)

    // Click Behavior Categories nav
    await page.getByTestId('primary-nav').getByRole('link', { name: /behavior categories/i }).click()
    await expect(page).toHaveURL(/\/behavior-categories/)
  })

  test('header nav is visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('primary-nav')).toBeVisible()
  })

  test('dark mode toggle works', async ({ page }) => {
    await page.goto('/')
    const toggle = page.getByTestId('dark-mode-toggle')
    await expect(toggle).toBeVisible()
    await toggle.click()
    // Toggle should change aria-pressed state
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })
})
