/**
 * Fast public rate scrape via direct results URL (skip home form).
 * npx tsx --env-file=.env.local automation/wyndham/probe-direct-rates.ts
 */
import { chromium } from 'playwright'

function toQueryDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${m}/${d}/${y}`
}

async function main() {
  const checkIn = '2026-08-20'
  const checkOut = '2026-08-21'
  const destination = 'Page AZ'
  const home = 'https://www.wyndhamhotels.com/en-uk'
  const qs = new URLSearchParams({
    brand_id: 'ALL',
    checkInDate: toQueryDate(checkIn),
    checkOutDate: toQueryDate(checkOut),
    useWRPoints: 'false',
    children: '0',
    adults: '1',
    rooms: '1',
    childrenAges: '',
  })

  // Known-good slug from earlier probe; also try destination search paths
  const candidates = [
    `${home}/hotels/page-az-usa?${qs}`,
    `${home}/hotels?destination=${encodeURIComponent(destination)}&${qs}`,
    `${home}/search?destination=${encodeURIComponent(destination)}&${qs}`,
  ]

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(30_000)

  for (const url of candidates) {
    const t0 = Date.now()
    console.log('\nTRY', url)
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await page.waitForTimeout(3000)
      const body = await page.locator('body').innerText()
      const prices = [...body.matchAll(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/g)]
        .map((m) => Number(m[1]))
        .filter((n) => n > 20 && n < 5000)
      const unique = [...new Set(prices)].slice(0, 8)
      console.log(
        JSON.stringify(
          {
            ms: Date.now() - t0,
            finalUrl: page.url(),
            title: await page.title(),
            prices: unique,
            bodySnippet: body.replace(/\s+/g, ' ').slice(0, 280),
          },
          null,
          2
        )
      )
      if (unique.length) break
    } catch (e) {
      console.log('FAIL', String(e).slice(0, 300), 'ms', Date.now() - t0)
    }
  }

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
