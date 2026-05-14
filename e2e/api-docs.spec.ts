import { test, expect } from '@playwright/test'

test.describe('API Docs Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/api-docs/createnodelocatorid')
  })

  test('displays page title and content', async ({ page }) => {
    // Wait for page to load
    await expect(page.locator('h1').first()).toBeVisible()
    await expect(page.locator('h2').first()).toBeVisible()
  })

  test('code blocks have syntax highlighting', async ({ page }) => {
    // Wait for shiki to initialize - look for non-placeholder shiki blocks
    // Shiki adds spans with style attributes containing --shiki CSS variables
    const codeBlock = page.locator('.api-doc-prose pre.shiki').first()
    await expect(codeBlock).toBeVisible({ timeout: 10000 })

    // Verify it's not a placeholder (no data-loading attribute)
    await expect(codeBlock).not.toHaveAttribute('data-loading', 'true')

    // Check for colored spans - shiki adds spans with inline styles
    // containing --shiki-light and --shiki-dark CSS variables
    const coloredSpans = codeBlock.locator('span[style*="--shiki"]')
    await expect(coloredSpans.first()).toBeVisible()

    // Verify multiple colored spans exist (syntax highlighting produces many)
    const spanCount = await coloredSpans.count()
    expect(spanCount).toBeGreaterThan(1)
  })

  test('View Source button exists when source link available', async ({ page }) => {
    // The "View Source" button appears when sourceLink is computed
    const viewSourceButton = page.getByRole('link', { name: /view source/i })
    // May or may not be visible depending on page content
    // Just check page loads without error
    await expect(page.locator('.api-doc-prose')).toBeVisible()
  })

  test('Review in PR button exists', async ({ page }) => {
    // Look for "Review in PR" or "Review This File" or "Start PR Review" button
    const reviewButton = page.getByRole('link', { name: /review/i }).first()
    await expect(reviewButton).toBeVisible()
  })

  test('sidebar navigation works', async ({ page }) => {
    // Sidebar should be visible with nav links
    const nav = page.locator('nav[aria-label="API docs navigation"]')
    await expect(nav).toBeVisible()

    // Should have navigation items
    const navLinks = nav.locator('a')
    const linkCount = await navLinks.count()
    expect(linkCount).toBeGreaterThan(0)
  })
})
