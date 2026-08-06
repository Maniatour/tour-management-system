import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

async function main() {
  const username = process.env.WYNDHAM_LOGIN_USERNAME!
  const password = process.env.WYNDHAM_LOGIN_PASSWORD!
  const outDir = path.join(process.cwd(), 'automation', 'wyndham', 'artifacts', 'smoke-login')
  await fs.mkdir(outDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    locale: 'en-GB',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  })

  const responses: Array<{ status: number; url: string }> = []
  page.on('response', (r) => {
    const u = r.url()
    if (/login|oauth|token|usernamepassword|callback/i.test(u)) {
      responses.push({ status: r.status(), url: u.slice(0, 160) })
    }
  })

  await page.goto('https://www.wyndhamhotels.com/en-uk', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.locator('a[href$="#login"]').filter({ hasText: /^Sign In$/i }).first().click()
  await page.waitForURL(/login\.wyndhamhotels\.com/i, { timeout: 45_000 })
  await page.waitForSelector('#username', { state: 'visible' })

  await page.fill('#username', username)
  await page.fill('#password', password)
  const values = {
    username: await page.inputValue('#username'),
    passwordLen: (await page.inputValue('#password')).length,
  }

  await page.locator('form').first().evaluate((form: HTMLFormElement) => form.requestSubmit())
  await page.waitForTimeout(8000)
  await page.screenshot({ path: path.join(outDir, '06-form-submit.png'), fullPage: true })

  console.log(
    JSON.stringify(
      {
        values,
        url: page.url(),
        title: await page.title(),
        heading: await page.locator('h1,h2').first().innerText().catch(() => ''),
        bodyStart: (await page.locator('body').innerText()).slice(0, 400),
        responses: responses.slice(-15),
      },
      null,
      2
    )
  )
  await browser.close()
}

main()
