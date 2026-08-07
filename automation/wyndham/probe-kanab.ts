import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  // Form search to discover Kanab results URL
  await page.goto('https://www.wyndhamhotels.com/en-uk', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await page.waitForTimeout(2000)
  const dest = page.locator('input.destination.ui-autocomplete-input:not([aria-hidden="true"])').first()
  await dest.click()
  await dest.fill('', { force: true })
  await page.keyboard.type('Kanab UT', { delay: 40 })
  await page.waitForTimeout(1200)
  const sug = page.locator('ul.ui-autocomplete li').first()
  if (await sug.isVisible().catch(() => false)) await sug.click({ force: true })
  else await page.keyboard.press('Enter')

  await page.locator('button.check-in-button').locator('visible=true').first().click({ force: true })
  await page.waitForTimeout(500)
  const inDay = page.locator('td[aria-label="20 August 2026"]').first()
  if (await inDay.isVisible().catch(() => false)) {
    const a = inDay.locator('a').first()
    if (await a.count()) await a.click({ force: true })
    else await inDay.click({ force: true })
  }
  await page.waitForTimeout(400)
  const outDay = page.locator('td[aria-label="21 August 2026"]').first()
  if (await outDay.isVisible().catch(() => false)) {
    const a = outDay.locator('a').first()
    if (await a.count()) await a.click({ force: true })
    else await outDay.click({ force: true })
  }
  await page.locator('button.search-btn').locator('visible=true').first().click({ force: true })
  await page.waitForTimeout(6000)
  const body = await page.locator('body').innerText()
  const prices = [...body.matchAll(/FROM\s*\$\s*([0-9]+)/gi)].map((m) => m[0]).slice(0, 8)
  console.log(JSON.stringify({ url: page.url(), title: await page.title(), prices }, null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
