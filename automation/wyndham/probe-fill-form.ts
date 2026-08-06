/**
 * Exercise fillWyndhamSearchForm with step logs.
 * npx tsx --env-file=.env.local automation/wyndham/probe-fill-form.ts
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { fillWyndhamSearchForm } from '../../src/lib/hotels/suppliers/wyndham/search'

async function main() {
  const authPath = path.join(process.cwd(), 'automation', 'wyndham', 'auth-state', 'storage.json')
  const hasAuth = await fs.access(authPath).then(() => true).catch(() => false)
  console.log('auth', hasAuth)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    ...(hasAuth ? { storageState: authPath } : {}),
    locale: 'en-GB',
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  page.setDefaultTimeout(45_000)

  console.log('goto…')
  await page.goto('https://www.wyndhamhotels.com/en-uk', {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  })
  await page.waitForTimeout(2500)
  console.log('filling form…')

  await fillWyndhamSearchForm(page, {
    destination: 'Page AZ',
    checkIn: '2026-08-20',
    checkOut: '2026-08-21',
  })

  console.log('search clicked, waiting…')
  await page.waitForLoadState('domcontentloaded').catch(() => undefined)
  await page.waitForTimeout(5000)
  console.log(
    JSON.stringify(
      {
        url: page.url(),
        title: await page.title(),
      },
      null,
      2
    )
  )
  await page.screenshot({
    path: 'automation/wyndham/artifacts/fill-form-result.png',
    fullPage: false,
  })
  await browser.close()
  console.log('done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
