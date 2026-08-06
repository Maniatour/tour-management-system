/**
 * Probe Wyndham en-uk booking widget after optional auth-state load.
 * npx tsx --env-file=.env.local automation/wyndham/probe-search-form.ts
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

async function main() {
  const authPath = path.join(
    process.cwd(),
    'automation',
    'wyndham',
    'auth-state',
    'storage.json'
  )
  const hasAuth = await fs.access(authPath).then(() => true).catch(() => false)

  const browser = await chromium.launch({
    headless: true,
    ...(process.env.WYNDHAM_USE_CHROME === '1' ? { channel: 'chrome' as const } : {}),
  })
  const context = await browser.newContext({
    ...(hasAuth ? { storageState: authPath } : {}),
    locale: 'en-GB',
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  await page.goto('https://www.wyndhamhotels.com/en-uk', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)

  const outDir = path.join(process.cwd(), 'automation', 'wyndham', 'artifacts', 'probe-search')
  await fs.mkdir(outDir, { recursive: true })
  await page.screenshot({ path: path.join(outDir, 'home.png'), fullPage: true })

  const info = await page.evaluate(() => {
    const els = Array.from(
      document.querySelectorAll('input, button, [role="button"], [role="combobox"]')
    )
    return els
      .map((el) => {
        const html = el as HTMLElement
        const visible = !!(html.offsetWidth || html.offsetHeight || html.getClientRects().length)
        if (!visible) return null
        return {
          tag: el.tagName,
          type: el.getAttribute('type'),
          role: el.getAttribute('role'),
          name: el.getAttribute('name'),
          id: el.id,
          placeholder: el.getAttribute('placeholder'),
          ariaLabel: el.getAttribute('aria-label'),
          dataTestId: el.getAttribute('data-testid'),
          className: String(el.className).slice(0, 100),
          text: (html.innerText || html.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        }
      })
      .filter(Boolean)
      .slice(0, 80)
  })

  console.log(JSON.stringify({ url: page.url(), hasAuth, count: info.length, info }, null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
