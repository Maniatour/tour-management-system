/**
 * Probe check-in calendar interaction on en-uk.
 * npx tsx --env-file=.env.local automation/wyndham/probe-calendar.ts
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

async function main() {
  const authPath = path.join(process.cwd(), 'automation', 'wyndham', 'auth-state', 'storage.json')
  const hasAuth = await fs.access(authPath).then(() => true).catch(() => false)
  const outDir = path.join(process.cwd(), 'automation', 'wyndham', 'artifacts', 'probe-search')
  await fs.mkdir(outDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    ...(hasAuth ? { storageState: authPath } : {}),
    locale: 'en-GB',
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  await page.goto('https://www.wyndhamhotels.com/en-uk', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  await page.locator('button.check-in-button, button.check-in.calendar-button').first().click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(outDir, 'calendar-open.png'), fullPage: true })

  const calendar = await page.evaluate(() => {
    const root =
      document.querySelector('.datepicker, .calendar, [class*="datepicker"], [class*="calendar"], .ui-datepicker') ||
      document.body
    const days = Array.from(
      document.querySelectorAll(
        'td[data-date], td[data-handler], .ui-datepicker-calendar td a, button[data-day], [class*="day"]:not([class*="disabled"])'
      )
    ).slice(0, 40)
    return {
      monthLabel: document.querySelector('.ui-datepicker-title, .calendar-title, [class*="month"]')?.textContent?.trim(),
      htmlSample: root ? (root as HTMLElement).innerHTML.slice(0, 2500) : '',
      daySamples: days.map((d) => ({
        tag: d.tagName,
        text: (d.textContent || '').trim().slice(0, 20),
        className: String((d as HTMLElement).className).slice(0, 80),
        dataDate: d.getAttribute('data-date'),
        ariaLabel: d.getAttribute('aria-label'),
        href: d.getAttribute('href'),
      })),
    }
  })

  console.log(JSON.stringify(calendar, null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
