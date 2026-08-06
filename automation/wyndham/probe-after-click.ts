/**
 * Inspect DOM before/after clicking destination.
 * npx tsx --env-file=.env.local automation/wyndham/probe-after-click.ts
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const SEL = 'input.destination.ui-autocomplete-input[placeholder="Enter destination"]'

async function snap(page: import('playwright').Page, label: string) {
  const info = await page.evaluate((sel) => {
    const all = Array.from(document.querySelectorAll('input')).map((el) => ({
      name: el.getAttribute('name'),
      placeholder: el.getAttribute('placeholder'),
      className: el.className,
      ariaHidden: el.getAttribute('aria-hidden'),
      type: el.type,
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
    }))
    const dest = document.querySelector(sel)
    return {
      url: location.href,
      destExists: !!dest,
      destCount: document.querySelectorAll(sel).length,
      destClass: dest?.className ?? null,
      inputs: all.filter(
        (i) =>
          /dest/i.test(i.name || '') ||
          /dest/i.test(i.placeholder || '') ||
          /dest/i.test(i.className || '')
      ),
      bodySnippet: document.body?.innerText?.slice(0, 400) ?? '',
    }
  }, SEL)
  console.log(`\n=== ${label} ===`)
  console.log(JSON.stringify(info, null, 2))
}

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
  page.setDefaultTimeout(30_000)

  await page.goto('https://www.wyndhamhotels.com/en-uk', {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  })
  await page.waitForTimeout(3500)
  await snap(page, 'BEFORE')

  const dest = page.locator(SEL).first()
  const count = await dest.count()
  console.log('locator count', count, 'visible', await dest.isVisible())

  // Click WITHOUT force first
  try {
    await dest.click({ timeout: 5_000 })
    console.log('click OK (no force)')
  } catch (e) {
    console.log('click FAIL (no force)', String(e).slice(0, 200))
    await dest.click({ force: true, timeout: 5_000 })
    console.log('click OK (force)')
  }

  await page.waitForTimeout(800)
  await snap(page, 'AFTER_CLICK')
  await page.screenshot({ path: 'automation/wyndham/artifacts/after-dest-click.png' })

  // Try fill immediately with short timeout
  try {
    await dest.fill('Page', { force: true, timeout: 5_000 })
    console.log('fill OK', await dest.inputValue())
  } catch (e) {
    console.log('fill FAIL', String(e).slice(0, 300))
  }

  // Try page.locator again fresh
  try {
    const dest2 = page.locator(SEL).first()
    console.log('fresh visible', await dest2.isVisible().catch(() => false))
    await dest2.fill('Page AZ', { force: true, timeout: 5_000 })
    console.log('fresh fill OK', await dest2.inputValue())
  } catch (e) {
    console.log('fresh fill FAIL', String(e).slice(0, 300))
  }

  // JS set without relying on locator stability
  const jsResult = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLInputElement | null
    if (!el) return { ok: false, reason: 'missing' }
    el.focus()
    el.value = 'Page AZ'
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('keyup', { bubbles: true }))
    return { ok: true, value: el.value }
  }, SEL)
  console.log('js set', jsResult)

  await page.waitForTimeout(1000)
  await snap(page, 'AFTER_JS')
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
