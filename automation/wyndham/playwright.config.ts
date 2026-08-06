import type { PlaywrightTestConfig } from '@playwright/test'

/**
 * Optional Playwright config for Wyndham smoke scripts.
 * Core app does not depend on this file at build time.
 */
const config: PlaywrightTestConfig = {
  testDir: './',
  timeout: 120_000,
  use: {
    headless: process.env.WYNDHAM_HEADLESS !== '0',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  outputDir: './artifacts/test-results',
}

export default config
