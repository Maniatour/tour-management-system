/**
 * Probe visible destination fields after auth.
 * npx tsx --env-file=.env.local automation/wyndham/probe-dest.ts
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
  await page.goto('https://www.wyndhamhotels.com/en-uk', {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: path.join(outDir, 'dest-home.png'), fullPage: true })

  const info = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map((el) => {
      const r = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      return {
        name: el.name,
        placeholder: el.placeholder,
        className: String(el.className).slice(0, 120),
        ariaLabel: el.getAttribute('aria-label'),
        role: el.getAttribute('role'),
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        rect: { w: r.width, h: r.height, t: r.top, l: r.left },
        inViewport: r.top >= 0 && r.top < window.innerHeight && r.width > 0 && r.height > 0,
      }
    })
    return {
      url: location.href,
      title: document.title,
      inputs: inputs.filter(
        (i) =>
          /dest|search|location|hotel/i.test(
            `${i.name} ${i.placeholder} ${i.className} ${i.ariaLabel}`
          )
      ),
      searchButtons: Array.from(document.querySelectorAll('button'))
        .filter((b) => /search|find/i.test(b.textContent || '') || /search/i.test(b.className))
        .map((b) => {
          const r = b.getBoundingClientRect()
          return {
            text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
            className: String(b.className).slice(0, 80),
            visible: r.width > 0 && r.height > 0,
          }
        }),
    }
  })

  console.log(JSON.stringify({ hasAuth, ...info }, null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
