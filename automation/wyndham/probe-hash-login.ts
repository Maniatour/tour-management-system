import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

async function main() {
  const outDir = path.join(process.cwd(), 'automation', 'wyndham', 'artifacts', 'smoke-login')
  await fs.mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ locale: 'en-GB' })
  page.setDefaultTimeout(45_000)

  await page.goto('https://www.wyndhamhotels.com/en-uk', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  // Click ONLY hash login link
  await page.locator('a[href$="#login"]').filter({ hasText: /^Sign In$/i }).first().click()
  await page.waitForTimeout(4000)
  await page.screenshot({ path: path.join(outDir, '05-hash-login.png'), fullPage: true })

  const frames = page.frames().map((f) => f.url())
  const info = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map((el) => ({
      type: el.type,
      name: el.name,
      id: el.id,
      placeholder: el.placeholder,
      visible: !!(el.offsetParent || el.getClientRects().length),
    }))
    return {
      url: location.href,
      hash: location.hash,
      dialogs: Array.from(document.querySelectorAll('[role="dialog"], .modal, [class*="login"]'))
        .slice(0, 10)
        .map((el) => ({
          tag: el.tagName,
          className: String(el.className).slice(0, 80),
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
        })),
      inputs: inputs.filter((i) => i.visible).slice(0, 20),
    }
  })

  console.log(JSON.stringify({ frames, info }, null, 2))
  await browser.close()
}

main()
