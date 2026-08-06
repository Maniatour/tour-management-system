/**
 * Step-by-step destination + calendar debug.
 * npx tsx --env-file=.env.local automation/wyndham/probe-steps.ts
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { WYNDHAM_SELECTORS } from '../../src/lib/hotels/suppliers/wyndham/selectors'
import { toWyndhamAriaDate } from '../../src/lib/hotels/suppliers/wyndham/search'

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
  page.setDefaultTimeout(15_000)

  console.log('1 goto')
  await page.goto('https://www.wyndhamhotels.com/en-uk', {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  })
  await page.waitForTimeout(2500)

  console.log('2 dest click+type')
  const dest = page.locator(WYNDHAM_SELECTORS.searchDestination).first()
  await dest.waitFor({ state: 'visible', timeout: 20_000 })
  await dest.click()
  const active = page.locator(WYNDHAM_SELECTORS.searchDestination).first()
  await active.fill('', { force: true })
  await active.focus()
  await page.keyboard.type('Page AZ', { delay: 35 })
  console.log('   value', await active.inputValue())
  await page.waitForTimeout(1200)
  const sug = page.locator(WYNDHAM_SELECTORS.destinationSuggestion).first()
  console.log('   suggestion visible', await sug.isVisible().catch(() => false))
  if (await sug.isVisible().catch(() => false)) await sug.click({ force: true })
  else await page.keyboard.press('Enter')

  const checkIn = '2026-08-20'
  const aria = toWyndhamAriaDate(checkIn)
  console.log('3 calendar', aria)
  const btn = page.locator('button.check-in-button').locator('visible=true').first()
  console.log('   btn visible', await btn.isVisible().catch(() => false))
  await btn.click({ force: true })
  await page.waitForTimeout(600)
  const day = page.locator(`td[aria-label="${aria}"]`).first()
  console.log('   day visible', await day.isVisible().catch(() => false))
  console.log('   day count', await page.locator(`td[aria-label="${aria}"]`).count())
  // dump visible calendar titles / labels
  const labels = await page.evaluate(() => {
    const title = document.querySelector('.ui-datepicker-title')?.textContent
    const days = Array.from(document.querySelectorAll('td[aria-label]'))
      .slice(0, 10)
      .map((td) => td.getAttribute('aria-label'))
    return { title, days }
  })
  console.log('   cal', labels)
  if (await day.isVisible().catch(() => false)) {
    const link = day.locator('a').first()
    if (await link.count()) await link.click({ force: true })
    else await day.click({ force: true })
    console.log('   day clicked')
  }

  console.log('4 checkout')
  const outAria = toWyndhamAriaDate('2026-08-21')
  const outBtn = page.locator('button.check-out-button').locator('visible=true').first()
  await outBtn.click({ force: true })
  await page.waitForTimeout(600)
  const outDay = page.locator(`td[aria-label="${outAria}"]`).first()
  console.log('   out day', await outDay.isVisible().catch(() => false), outAria)
  if (await outDay.isVisible().catch(() => false)) {
    const link = outDay.locator('a').first()
    if (await link.count()) await link.click({ force: true })
    else await outDay.click({ force: true })
  }

  console.log('5 search')
  const search = page.locator('button.search-btn').locator('visible=true').first()
  await search.click({ force: true })
  await page.waitForTimeout(5000)
  console.log('url', page.url())
  await page.screenshot({ path: 'automation/wyndham/artifacts/steps-result.png' })
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
