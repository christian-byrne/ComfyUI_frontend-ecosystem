import { test, expect } from '@playwright/test'

test.describe('Pack Detail Page', () => {
  test('navigates from node packs to pack detail', async ({ page }) => {
    await page.goto('/node-packs')

    // Click first tile to go to detail
    const firstTile = page.locator('[data-testid="node-packs-grid"] li').first()
    await firstTile.click()

    // Should navigate to pack detail
    await expect(page).toHaveURL(/\/node-packs\//)
    await expect(page.getByTestId('pack-detail-page')).toBeVisible()
  })

  test('displays pack metadata', async ({ page }) => {
    // Navigate to a known pack
    await page.goto('/node-packs/comfyui-kjnodes')

    // Should show metadata
    await expect(page.getByText('Pack id')).toBeVisible()
    await expect(page.getByText('Publisher')).toBeVisible()
    await expect(page.getByText('Stars')).toBeVisible()
  })

  test('shows pattern coverage section', async ({ page }) => {
    await page.goto('/node-packs/comfyui-kjnodes')

    // Should have pattern coverage heading
    await expect(page.getByText(/pattern coverage/i)).toBeVisible()
  })

  test('back link returns to node packs list', async ({ page }) => {
    await page.goto('/node-packs/comfyui-kjnodes')

    // Click back link
    await page.getByRole('link', { name: /all node packs/i }).click()
    await expect(page).toHaveURL(/\/node-packs$/)
  })

  test('handles unknown pack', async ({ page }) => {
    await page.goto('/node-packs/unknown-pack-xyz-123')

    // Should still render page
    await expect(page.getByTestId('pack-detail-page')).toBeVisible()
  })
})
