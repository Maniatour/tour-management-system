/**
 * Exercise direct-URL public scrape path used by the API.
 * npx tsx --env-file=.env.local automation/wyndham/probe-scrape-public.ts
 */
import { chromium } from 'playwright'
import { buildWyndhamResultsUrl } from '../../src/lib/hotels/suppliers/wyndham/search-url'

async function main() {
  const url = buildWyndhamResultsUrl({
    destination: 'Page AZ',
    checkIn: '2026-08-20',
    checkOut: '2026-08-21',
  })
  console.log('url', url)
  if (!url) throw new Error('no url')

  const t0 = Date.now()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await page.locator('.cmp-property-card').first().waitFor({ state: 'visible', timeout: 25_000 })
  await page.waitForTimeout(1500)

  const scraped = await page.evaluate(`(() => {
    const textOf = (el) => (el && el.textContent ? el.textContent.replace(/\\s+/g, ' ').trim() : '');
    return Array.from(document.querySelectorAll('.cmp-property-card'))
      .slice(0, 25)
      .map((card, index) => {
        const fullText = textOf(card);
        const priceMatch = fullText.match(/FROM\\s*\\$\\s*([0-9]+(?:\\.[0-9]{1,2})?)/i);
        const name =
          textOf(card.querySelector('.hotel-details-sec a, h2, h3')) ||
          (fullText.split(/FROM\\s*\\$/i)[0] || '').trim().slice(0, 100);
        return { index, name, price: Number((priceMatch && priceMatch[1]) || 0) };
      })
      .filter((r) => r.price > 0);
  })()`)

  console.log(JSON.stringify({ ms: Date.now() - t0, scraped }, null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
