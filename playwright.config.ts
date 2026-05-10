import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for the dashboard E2E suite.
 *
 * Tests live in `e2e/` and are added in W5.2. Today this config exists so
 * `pnpm test:e2e` doesn't error and so future agents can drop a `*.spec.ts`
 * into `e2e/` and have it picked up automatically.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'pnpm preview --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
})
