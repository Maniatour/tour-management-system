/**
 * One-off probe: discover Wyndham en-uk login entry points.
 * Run: npx tsx automation/wyndham/probe-login.ts
 */
import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(45_000)

  const home = 'https://www.wyndhamhotels.com/en-uk'
  await page.goto(home, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)

  const before = {
    url: page.url(),
    title: await page.title(),
    passwordVisible: await page.locator('input[type="password"]').count(),
  }

  // Try common sign-in triggers
  const triggers = [
    'button:has-text("Sign In")',
    'a:has-text("Sign In")',
    'button:has-text("Log In")',
    'a:has-text("Log In")',
    '[data-testid*="sign-in"]',
    '[aria-label*="Sign In" i]',
    'text=Sign In',
  ]

  let clicked: string | null = null
  for (const sel of triggers) {
    const loc = page.locator(sel).first()
    if (await loc.count()) {
      try {
        await loc.click({ timeout: 3000 })
        clicked = sel
        await page.waitForTimeout(2500)
        break
      } catch {
        /* try next */
      }
    }
  }

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map((el) => ({
      type: el.getAttribute('type'),
      name: el.getAttribute('name'),
      id: el.id,
      placeholder: el.getAttribute('placeholder'),
      autocomplete: el.getAttribute('autocomplete'),
      ariaLabel: el.getAttribute('aria-label'),
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
    }))
  })

  const passwordVisible = await page.locator('input[type="password"]:visible').count()

  console.log(JSON.stringify({ before, clicked, passwordVisible, url: page.url(), inputs }, null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
