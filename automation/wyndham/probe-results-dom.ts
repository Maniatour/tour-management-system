/**
 * Inspect search results page structure for prices.
 * npx tsx --env-file=.env.local automation/wyndham/probe-results-dom.ts
 */
import { chromium } from 'playwright'

async function main() {
  const url =
    'https://www.wyndhamhotels.com/en-uk/hotels/page-az-usa?brand_id=ALL&checkInDate=8/20/2026&checkOutDate=8/21/2026&useWRPoints=false&children=0&adults=1&rooms=1&loc=ChIJj3XN_VsTNIcROU44U1EvmG4'
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const apiHits: string[] = []
  page.on('response', (res) => {
    const u = res.url()
    if (/rate|price|search|hotel|availability|graphql|api/i.test(u) && res.status() < 500) {
      apiHits.push(`${res.status()} ${u.slice(0, 160)}`)
    }
  })

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForTimeout(8000)

  const info = await page.evaluate(() => {
    const text = document.body?.innerText?.replace(/\s+/g, ' ') || ''
    const html = document.body?.innerHTML || ''
    const dollar = [...text.matchAll(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/g)].map((m) => m[0])
    const pound = [...text.matchAll(/£\s*([0-9]+(?:\.[0-9]{1,2})?)/g)].map((m) => m[0])
    const from = [...text.matchAll(/from\s*[£$]?\s*([0-9]+)/gi)].map((m) => m[0])
    const classes = Array.from(document.querySelectorAll('[class*="price"], [class*="rate"], [class*="hotel"], [data-testid]'))
      .slice(0, 40)
      .map((el) => ({
        tag: el.tagName,
        className: String((el as HTMLElement).className).slice(0, 80),
        testid: el.getAttribute('data-testid'),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      }))
    return {
      title: document.title,
      url: location.href,
      textLen: text.length,
      snippet: text.slice(0, 500),
      dollar: [...new Set(dollar)].slice(0, 15),
      pound: [...new Set(pound)].slice(0, 15),
      from: [...new Set(from)].slice(0, 15),
      hasNoResult: /no result|not found|sold out|unavailable|0 hotels/i.test(text),
      classes,
      htmlHasPrice: /price|avgNightly|nightly/i.test(html),
    }
  })

  console.log(JSON.stringify({ info, apiHits: apiHits.slice(0, 30) }, null, 2))
  await page.screenshot({
    path: 'automation/wyndham/artifacts/results-dom.png',
    fullPage: false,
  })
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
