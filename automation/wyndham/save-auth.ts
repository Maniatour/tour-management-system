/**
 * Manual Wyndham Rewards login → save Playwright storageState.
 *
 * Why: automated CONTINUE often gets Auth0/Akamai 403.
 * After saving once, 「멤버 요금 가져오기」 reuses the session.
 *
 * Run (headed Chrome):
 *   set WYNDHAM_HEADLESS=0
 *   set WYNDHAM_USE_CHROME=1
 *   npx tsx --env-file=.env.local automation/wyndham/save-auth.ts
 *
 * Steps:
 * 1) Browser opens en-uk
 * 2) Sign In and complete login (CAPTCHA if any)
 * 3) When back on wyndhamhotels.com, return to this terminal and press Enter
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline'
import { chromium } from 'playwright'

const AUTH_STATE_PATH = path.join(
  process.cwd(),
  'automation',
  'wyndham',
  'auth-state',
  'storage.json'
)

async function main() {
  const home = process.env.WYNDHAM_HOME_URL || 'https://www.wyndhamhotels.com/en-uk'
  const useChrome = process.env.WYNDHAM_USE_CHROME !== '0'

  const browser = await chromium.launch({
    headless: false,
    ...(useChrome ? { channel: 'chrome' as const } : {}),
    args: ['--disable-blink-features=AutomationControlled'],
  }).catch(async () =>
    chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled'],
    })
  )

  const context = await browser.newContext({
    locale: 'en-GB',
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  await page.goto(home, { waitUntil: 'domcontentloaded' })

  console.log('')
  console.log('1) 열린 브라우저에서 Sign In → username/password로 로그인하세요.')
  console.log('2) 로그인 후 wyndhamhotels.com 으로 돌아오면 이 터미널에서 Enter.')
  console.log('')

  await waitForEnter()

  await fs.mkdir(path.dirname(AUTH_STATE_PATH), { recursive: true })
  await context.storageState({ path: AUTH_STATE_PATH })
  console.log('Saved:', AUTH_STATE_PATH)
  console.log('이제 관리 화면에서 「멤버 요금 가져오기」를 다시 실행하세요.')

  await browser.close()
}

function waitForEnter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise<void>((resolve) => {
    rl.question('로그인 완료 후 Enter > ', () => {
      rl.close()
      resolve()
    })
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
