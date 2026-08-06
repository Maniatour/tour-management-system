/**
 * Probe destination fill strategies.
 * npx tsx --env-file=.env.local automation/wyndham/probe-dest-fill.ts
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
  await page.waitForTimeout(4000)

  // dismiss cookies if any
  for (const label of ['Accept', 'Accept All', 'Agree', 'I Agree', 'OK']) {
    const b = page.getByRole('button', { name: label }).first()
    if (await b.isVisible().catch(() => false)) {
      await b.click().catch(() => undefined)
      break
    }
  }

  const selectors = [
    'input.destination.ui-autocomplete-input[placeholder="Enter destination"]',
    'input.destination.ui-autocomplete-input',
    'input[placeholder="Enter destination"]',
    '#destination',
    'input[name="destination"]',
  ]

  const report: Array<Record<string, unknown>> = []
  for (const sel of selectors) {
    const loc = page.locator(sel)
    const count = await loc.count()
    const rows: Array<Record<string, unknown>> = []
    for (let i = 0; i < count; i++) {
      const el = loc.nth(i)
      rows.push({
        i,
        visible: await el.isVisible().catch(() => false),
        enabled: await el.isEnabled().catch(() => false),
        box: await el.boundingBox().catch(() => null),
        value: await el.inputValue().catch(() => null),
        outer: (await el.evaluate((n) => (n as HTMLElement).outerHTML.slice(0, 200)).catch(() => null)),
      })
    }
    report.push({ sel, count, rows })
  }
  console.log('SELECTORS', JSON.stringify(report, null, 2))

  // Strategy A: force fill
  const dest = page.locator('input.destination.ui-autocomplete-input').first()
  try {
    await dest.waitFor({ state: 'attached', timeout: 10_000 })
    await dest.scrollIntoViewIfNeeded()
    await dest.click({ force: true })
    await dest.fill('Page AZ', { force: true })
    console.log('STRATEGY_A_OK', await dest.inputValue())
  } catch (e) {
    console.log('STRATEGY_A_FAIL', String(e).slice(0, 400))
  }

  // Strategy B: pressSequentially
  try {
    await dest.click({ force: true })
    await dest.fill('', { force: true })
    await dest.pressSequentially('Page AZ', { delay: 30 })
    console.log('STRATEGY_B_OK', await dest.inputValue())
  } catch (e) {
    console.log('STRATEGY_B_FAIL', String(e).slice(0, 400))
  }

  // Strategy C: keyboard after focusing via JS
  try {
    await page.evaluate(() => {
      const el = document.querySelector('input.destination.ui-autocomplete-input') as HTMLInputElement | null
      if (!el) throw new Error('missing')
      el.scrollIntoView({ block: 'center' })
      el.focus()
      el.value = ''
      el.dispatchEvent(new Event('focus', { bubbles: true }))
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.keyboard.type('Page AZ', { delay: 40 })
    console.log('STRATEGY_C_OK', await dest.inputValue().catch(() => 'n/a'))
  } catch (e) {
    console.log('STRATEGY_C_FAIL', String(e).slice(0, 400))
  }

  await page.screenshot({ path: 'automation/wyndham/artifacts/dest-fill.png', fullPage: false })
  console.log('screenshot saved')
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
