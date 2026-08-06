/**
 * Probe search URL after filling classic form.
 * npx tsx --env-file=.env.local automation/wyndham/probe-search-url.ts
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

async function main() {
  const authPath = path.join(process.cwd(), 'automation', 'wyndham', 'auth-state', 'storage.json')
  const hasAuth = await fs.access(authPath).then(() => true).catch(() => false)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    ...(hasAuth ? { storageState: authPath } : {}),
    locale: 'en-GB',
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  await page.goto('https://www.wyndhamhotels.com/en-uk', { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForTimeout(3000)

  const dest = page.locator('input.destination.ui-autocomplete-input[placeholder="Enter destination"]')
  await dest.click({ timeout: 10_000 })
  await page.evaluate(() => {
    const el = document.querySelector(
      'input.destination.ui-autocomplete-input[placeholder="Enter destination"]'
    ) as HTMLInputElement | null
    if (!el) throw new Error('no dest')
    el.focus()
    el.value = ''
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await dest.type('Page AZ', { delay: 40 })
  await page.waitForTimeout(1200)
  const sug = page.locator('ul.ui-autocomplete li').first()
  if (await sug.isVisible().catch(() => false)) await sug.click()
  else await dest.press('Enter')

  await page.locator('button.check-in-button').first().click()
  await page.waitForTimeout(500)
  // pick a far-enough day if present
  const day = page.locator('td[aria-label*="August 2026"] a').nth(10)
  if (await day.isVisible().catch(() => false)) await day.click()
  await page.waitForTimeout(400)
  const day2 = page.locator('td[aria-label*="August 2026"] a').nth(11)
  if (await day2.isVisible().catch(() => false)) await day2.click()

  await page.locator('button.search-btn.btn-primary').first().click()
  await page.waitForLoadState('domcontentloaded').catch(() => undefined)
  await page.waitForTimeout(4000)
  console.log(JSON.stringify({ url: page.url(), title: await page.title() }, null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
