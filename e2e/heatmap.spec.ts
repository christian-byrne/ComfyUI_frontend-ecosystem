import { test, expect } from '@playwright/test'

test.describe('Heatmap Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/heatmap')
  })

  test('displays heatmap grid', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/heatmap/i)

    // Should have heatmap grid
    await expect(page.getByTestId('heatmap-grid')).toBeVisible()

    // Should have heatmap cells
    await expect(page.locator('.heatmap-cell').first()).toBeVisible()
  })

  test('cells are interactive', async ({ page }) => {
    const cell = page.locator('.heatmap-cell').first()

    // Hover should show tooltip
    await cell.hover()
    await expect(page.getByTestId('heatmap-tooltip')).toBeVisible()
  })

  test('legend is visible', async ({ page }) => {
    await expect(page.getByTestId('heatmap-legend')).toBeVisible()
  })

  test('log scale toggle works', async ({ page }) => {
    const toggle = page.getByTestId('log-scale-toggle')
    await expect(toggle).toBeVisible()
    await toggle.check()
    await expect(toggle).toBeChecked()
  })
})
