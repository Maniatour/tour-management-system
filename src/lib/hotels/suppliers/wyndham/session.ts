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

function resolveLaunchOptions() {
  /**
   * Next.js API routes: headed Chrome (WYNDHAM_HEADLESS=0) often flakes
   * (connection timeouts / focus issues). Prefer headless unless forced.
   */
  const forceHeaded = process.env.WYNDHAM_FORCE_HEADED === '1'
  const preferHeadlessInApi =
    !forceHeaded &&
    (process.env.WYNDHAM_API_HEADLESS === '1' ||
      process.env.NEXT_RUNTIME === 'nodejs' ||
      typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string')

  const headless = forceHeaded
    ? false
    : preferHeadlessInApi
      ? true
      : process.env.WYNDHAM_HEADLESS !== '0'

  /** Prefer real Chrome when available — helps with Auth0/Akamai bot checks */
  const channel =
    process.env.WYNDHAM_BROWSER_CHANNEL ||
    (process.env.WYNDHAM_USE_CHROME === '1' && !headless ? 'chrome' : undefined)

  return {
    headless,
    ...(channel ? { channel } : {}),
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  }
}

/**
 * Navigate to Wyndham with retries — transient ERR_CONNECTION_TIMED_OUT is common.
 */
export async function gotoWyndham(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  url: string,
  artifact?: WyndhamArtifactMeta,
  opts?: { attempts?: number; timeoutMs?: number }
): Promise<void> {
  const attempts = opts?.attempts ?? 3
  const timeout = opts?.timeoutMs ?? 90_000
  let lastError: unknown

  for (let i = 1; i <= attempts; i++) {
    try {
      if (artifact) {
        await appendWyndhamLog(artifact, `goto ${url} (attempt ${i}/${attempts})`)
      }
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout,
      })
      return
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (artifact) {
        await appendWyndhamLog(artifact, `goto failed: ${message}`)
      }
      const retryable =
        /ERR_CONNECTION_TIMED_OUT|ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|Timeout|net::ERR_/i.test(
          message
        )
      if (!retryable || i === attempts) break
      await page.waitForTimeout(1_500 * i)
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError)
  throw new WyndhamAutomationError(
    `Wyndham 사이트 접속 실패 (${url}). ${message}. ` +
      '일시적 네트워크 문제일 수 있으니 잠시 후 「멤버 요금 가져오기」를 다시 눌러 보세요. ' +
      '계속되면 .env에서 WYNDHAM_HEADLESS=1 로 두고(권장), VPN/방화벽을 확인하세요.',
    'failed'
  )
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

  const launchOpts = resolveLaunchOptions()
  const browser = await playwright.chromium.launch(launchOpts).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    if (/Executable doesn't exist|playwright install/i.test(message)) {
      throw new WyndhamAutomationError(
        'Playwright Chromium이 없습니다. 프로젝트 폴더에서 실행: npx playwright install chromium',
        'needs_manual'
      )
    }
    // Chrome channel missing — fall back to bundled chromium
    if (launchOpts.channel) {
      return playwright.chromium.launch({
        headless: launchOpts.headless,
        args: launchOpts.args,
      })
    }
    throw error
  })

  const hasAuth = await fileExists(AUTH_STATE_PATH)
  const context = await browser.newContext({
    ...(hasAuth ? { storageState: AUTH_STATE_PATH } : {}),
    locale: 'en-GB',
    viewport: { width: 1440, height: 900 },
    userAgent:
      process.env.WYNDHAM_USER_AGENT ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
  })
  const page = await context.newPage()
  page.setDefaultTimeout(60_000)
  page.setDefaultNavigationTimeout(90_000)

  // Soften webdriver flag a bit
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  if (artifact) {
    await appendWyndhamLog(
      artifact,
      hasAuth
        ? `Loaded auth state from ${AUTH_STATE_PATH}`
        : `No saved auth state (headless=${launchOpts.headless}, channel=${launchOpts.channel || 'chromium'})`
    )
  }

  return { browser, context, page }
}

/**
 * Wyndham Rewards login (en-uk):
 * 1) Open https://www.wyndhamhotels.com/en-uk
 * 2) Click Sign In (#login) → login.wyndhamhotels.com
 * 3) Fill #username + #password, click CONTINUE
 *
 * If Auth0/Akamai returns 403, prefer a manually saved auth-state:
 *   npx tsx --env-file=.env.local automation/wyndham/save-auth.ts
 */
export async function ensureWyndhamLogin(
  session: WyndhamBrowserSession,
  artifact?: WyndhamArtifactMeta
): Promise<void> {
  const username =
    process.env.WYNDHAM_LOGIN_USERNAME?.trim() ||
    process.env.WYNDHAM_LOGIN_EMAIL?.trim()
  const password = process.env.WYNDHAM_LOGIN_PASSWORD?.trim()

  if (!username || !password) {
    throw new WyndhamAutomationError(
      'WYNDHAM_LOGIN_USERNAME / WYNDHAM_LOGIN_PASSWORD not configured',
      'needs_manual'
    )
  }

  const { page, context } = session

  // If saved session already works on en-uk, skip credential login
  await gotoWyndham(page, WYNDHAM_URLS.home, artifact)
  await page.waitForTimeout(2_000)

  const alreadySignedIn = await page
    .locator(
      'a:has-text("Sign Out"), button:has-text("Sign Out"), a:has-text("My Account"), [data-testid*="account"]'
    )
    .first()
    .isVisible()
    .catch(() => false)

  const signInVisible = await page
    .locator(WYNDHAM_SELECTORS.signInLink)
    .first()
    .isVisible()
    .catch(() => false)

  if (alreadySignedIn || !signInVisible) {
    // Double-check: if Sign In is gone, treat as logged in
    if (!signInVisible || alreadySignedIn) {
      if (artifact) await appendWyndhamLog(artifact, 'Session already authenticated — skip login')
      await persistAuthState(context, artifact)
      return
    }
  }

  let sawForbidden = false
  page.on('response', (response: { status: () => number; url: () => string }) => {
    if (
      response.status() === 403 &&
      /login\.wyndhamhotels\.com/i.test(response.url())
    ) {
      sawForbidden = true
    }
  })

  // Prefer the hash Sign In used on en-uk (avoids unrelated Sign In links)
  const hashSignIn = page.locator('a[href$="#login"]').filter({ hasText: /^Sign In$/i }).first()
  if (await hashSignIn.isVisible().catch(() => false)) {
    await Promise.all([
      page.waitForURL(/login\.wyndhamhotels\.com/i, { timeout: 45_000 }).catch(() => undefined),
      hashSignIn.click(),
    ])
  } else {
    const signIn = page.locator(WYNDHAM_SELECTORS.signInLink).first()
    if (!(await signIn.isVisible().catch(() => false))) {
      throw new WyndhamAutomationError(
        'en-uk 홈에서 Sign In을 찾지 못했습니다.',
        'needs_manual'
      )
    }
    await Promise.all([
      page.waitForURL(/login\.wyndhamhotels\.com/i, { timeout: 45_000 }).catch(() => undefined),
      signIn.click(),
    ])
  }

  await page.waitForTimeout(1_500)

  if (!/login\.wyndhamhotels\.com/i.test(page.url())) {
    const authPage = context
      .pages()
      .find((p: { url: () => string }) => /login\.wyndhamhotels\.com/i.test(p.url()))
    if (authPage) session.page = authPage
    else {
      throw new WyndhamAutomationError(
        `Sign In 후 로그인 페이지로 이동하지 못했습니다. URL: ${page.url()}`,
        'needs_manual'
      )
    }
  }

  const authPage = session.page

  const usernameInput = authPage.locator(WYNDHAM_SELECTORS.loginUsername).first()
  await usernameInput.waitFor({ state: 'visible', timeout: 30_000 })

  // Human-like typing reduces bot challenges vs instant fill
  await usernameInput.click()
  await usernameInput.fill('')
  await usernameInput.pressSequentially(username, { delay: 40 })

  const passwordInput = authPage.locator(WYNDHAM_SELECTORS.loginPassword).first()
  await passwordInput.click()
  await passwordInput.fill('')
  await passwordInput.pressSequentially(password, { delay: 40 })

  const continueBtn = authPage.getByRole('button', { name: /^continue$/i }).first()
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click()
  } else {
    await authPage.locator(WYNDHAM_SELECTORS.loginSubmit).first().click()
  }

  await authPage.waitForTimeout(5_000)

  const bodyText = await authPage.locator('body').innerText().catch(() => '')
  const looksLikeRateSupport = /Rate Support|Want access to Wyndham Hotels and Resorts Data/i.test(
    bodyText
  )
  const stillOnAuth = /login\.wyndhamhotels\.com/i.test(authPage.url())
  const hasLoginError = await authPage
    .locator('#error-element-password, #error-element-username, [role="alert"], .ulp-error-info')
    .first()
    .isVisible()
    .catch(() => false)

  if (sawForbidden || looksLikeRateSupport) {
    throw new WyndhamAutomationError(
      'Wyndham 로그인이 봇 차단(403) 또는 Rate Support 페이지로 막혔습니다. ' +
        '한 번 수동 로그인해 auth-state를 저장하세요: ' +
        'npx tsx --env-file=.env.local automation/wyndham/save-auth.ts ' +
        '(창이 열리면 Sign In 후 브라우저를 닫지 말고 안내대로 Enter). ' +
        '또는 .env에 WYNDHAM_HEADLESS=0 / WYNDHAM_USE_CHROME=1 후 재시도.',
      'needs_manual'
    )
  }

  if (hasLoginError || (stillOnAuth && /wrong|invalid|incorrect|try again/i.test(bodyText))) {
    throw new WyndhamAutomationError(
      'Wyndham username/password가 거부되었습니다. .env.local의 WYNDHAM_LOGIN_USERNAME / PASSWORD를 확인하세요.',
      'needs_manual'
    )
  }

  if (stillOnAuth) {
    // Wait a bit more for redirect after CONTINUE
    await authPage
      .waitForURL((url: URL) => !/login\.wyndhamhotels\.com/i.test(url.href), {
        timeout: 30_000,
      })
      .catch(() => undefined)
  }

  if (/login\.wyndhamhotels\.com/i.test(authPage.url())) {
    throw new WyndhamAutomationError(
      '로그인 후에도 Auth 페이지에 있습니다. 수동 auth-state 저장을 권장합니다: automation/wyndham/save-auth.ts',
      'needs_manual'
    )
  }

  session.page = authPage
  await persistAuthState(context, artifact)
}

async function persistAuthState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
  artifact?: WyndhamArtifactMeta
) {
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

export function getWyndhamAuthStatePath() {
  return AUTH_STATE_PATH
}
