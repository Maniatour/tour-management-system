import fs from 'node:fs/promises'
import path from 'node:path'
import { appendWyndhamLog, type WyndhamArtifactMeta } from '@/lib/hotels/suppliers/wyndham/artifacts'
import { WYNDHAM_SELECTORS, WYNDHAM_URLS } from '@/lib/hotels/suppliers/wyndham/selectors'

const AUTH_STATE_PATH =
  process.env.WYNDHAM_AUTH_STATE_PATH ||
  path.join(process.cwd(), 'automation', 'wyndham', 'auth-state', 'storage.json')

export type WyndhamBrowserSession = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any
}

/**
 * Launch Playwright with optional saved auth state.
 * Credentials must come from env refs — never hardcode secrets.
 */
export async function openWyndhamSession(
  artifact?: WyndhamArtifactMeta
): Promise<WyndhamBrowserSession> {
  let playwright: typeof import('playwright')
  try {
    playwright = await import('playwright')
  } catch {
    throw new WyndhamAutomationError(
      'Playwright is not installed. Run: npx playwright install chromium',
      'needs_manual'
    )
  }

  const browser = await playwright.chromium.launch({
    headless: process.env.WYNDHAM_HEADLESS !== '0',
  })

  const hasAuth = await fileExists(AUTH_STATE_PATH)
  const context = await browser.newContext(
    hasAuth ? { storageState: AUTH_STATE_PATH } : undefined
  )
  const page = await context.newPage()

  if (artifact) {
    await appendWyndhamLog(
      artifact,
      hasAuth ? `Loaded auth state from ${AUTH_STATE_PATH}` : 'No saved auth state'
    )
  }

  return { browser, context, page }
}

export async function ensureWyndhamLogin(
  session: WyndhamBrowserSession,
  artifact?: WyndhamArtifactMeta
): Promise<void> {
  const email = process.env.WYNDHAM_LOGIN_EMAIL
  const password = process.env.WYNDHAM_LOGIN_PASSWORD

  if (!email || !password) {
    throw new WyndhamAutomationError(
      'WYNDHAM_LOGIN_EMAIL / WYNDHAM_LOGIN_PASSWORD not configured',
      'needs_manual'
    )
  }

  const { page, context } = session
  await page.goto(WYNDHAM_URLS.login, { waitUntil: 'domcontentloaded' })

  if (await page.$(WYNDHAM_SELECTORS.captcha)) {
    throw new WyndhamAutomationError(
      'CAPTCHA detected — manual intervention required',
      'needs_manual'
    )
  }

  await page.fill(WYNDHAM_SELECTORS.loginEmail, email)
  await page.fill(WYNDHAM_SELECTORS.loginPassword, password)
  await page.click(WYNDHAM_SELECTORS.loginSubmit)
  await page.waitForLoadState('networkidle').catch(() => undefined)

  if (await page.$(WYNDHAM_SELECTORS.captcha)) {
    throw new WyndhamAutomationError(
      'CAPTCHA after login — manual intervention required',
      'needs_manual'
    )
  }

  await fs.mkdir(path.dirname(AUTH_STATE_PATH), { recursive: true })
  await context.storageState({ path: AUTH_STATE_PATH })
  if (artifact) {
    await appendWyndhamLog(artifact, `Saved auth state to ${AUTH_STATE_PATH}`)
  }
}

export async function closeWyndhamSession(
  session: WyndhamBrowserSession
): Promise<void> {
  await session.context.close().catch(() => undefined)
  await session.browser.close().catch(() => undefined)
}

export class WyndhamAutomationError extends Error {
  readonly kind: 'needs_manual' | 'failed'

  constructor(message: string, kind: 'needs_manual' | 'failed' = 'failed') {
    super(message)
    this.name = 'WyndhamAutomationError'
    this.kind = kind
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
