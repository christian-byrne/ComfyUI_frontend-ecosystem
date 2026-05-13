import { test, expect } from '@playwright/test'

test.describe('Node Packs Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/node-packs')
  })

  test('displays node packs grid with tiles', async ({ page }) => {
    // Page should load
    await expect(page.locator('h1')).toContainText(/node packs/i)

    // Should NOT show empty message
    await expect(page.getByTestId('node-packs-empty')).not.toBeVisible()

    // Should have grid with tiles
    await expect(page.getByTestId('node-packs-grid')).toBeVisible()

    // Should have at least one tile
    const tiles = page.locator('[data-testid="node-packs-grid"] li')
    await expect(tiles.first()).toBeVisible()
    const count = await tiles.count()
    expect(count).toBeGreaterThan(0)
  })

  test('sort buttons are functional', async ({ page }) => {
    // Should have sort buttons
    await expect(page.getByTestId('sort-stars')).toBeVisible()
    await expect(page.getByTestId('sort-patternHits')).toBeVisible()
    await expect(page.getByTestId('sort-weightedImpact')).toBeVisible()

    // Click pattern hits sort
    await page.getByTestId('sort-patternHits').click()
    await expect(page.getByTestId('sort-patternHits')).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })

  test('tiles show repo info', async ({ page }) => {
    // First tile should have repo name
    const firstTile = page.locator('[data-testid="node-packs-grid"] li').first()
    await expect(firstTile).toBeVisible()

    // Should have some text content (repo name)
    const text = await firstTile.textContent()
    expect(text?.length).toBeGreaterThan(0)
  })
})
