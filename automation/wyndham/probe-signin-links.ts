import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ locale: 'en-GB' })
  await page.goto('https://www.wyndhamhotels.com/en-uk', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a'))
      .filter((a) => /sign\s*in|log\s*in|account|rewards/i.test(`${a.textContent} ${a.href}`))
      .map((a) => ({
        text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        href: a.href,
      }))
      .slice(0, 40)
  )
  console.log(JSON.stringify(links, null, 2))
  await browser.close()
}

main()
