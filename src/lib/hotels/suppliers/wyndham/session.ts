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
 * Playwright injects --no-sandbox by default in some setups; real Chrome then shows
 * "You are using an unsupported command-line flag: --no-sandbox".
 * Strip it (and automation banner flags) for headed/manual Chrome.
 */
const CHROME_IGNORE_DEFAULT_ARGS = [
  '--enable-automation',
  '--no-sandbox',
  '--disable-setuid-sandbox',
] as const

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
    chromiumSandbox: true,
    ignoreDefaultArgs: [...CHROME_IGNORE_DEFAULT_ARGS],
    ...(channel ? { channel } : {}),
    // Do NOT pass --disable-blink-features=AutomationControlled — Chrome shows a
    // yellow "unsupported command-line flag" bar and Wyndham may route to Rate Support.
    args: ['--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check'],
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
 *
 * @param opts.useAuthState — default false for public rate scrapes (saved login often
 *   lands on ratesupport.wyndhamhotels.com / improper-route). Set true only for member flows.
 */
export async function openWyndhamSession(
  artifact?: WyndhamArtifactMeta,
  opts?: { useAuthState?: boolean }
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
        chromiumSandbox: true,
        ignoreDefaultArgs: [...CHROME_IGNORE_DEFAULT_ARGS],
        args: launchOpts.args,
      })
    }
    throw error
  })

  const useAuth = opts?.useAuthState === true
  const hasAuth = useAuth && (await fileExists(AUTH_STATE_PATH))
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
        : `Guest session (no auth-state) headless=${launchOpts.headless}`
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
    if (!signInVisible || alreadySignedIn) {
      if (artifact) await appendWyndhamLog(artifact, 'Session already authenticated — skip login')
      await persistAuthState(context, artifact)
      return
    }
  }

  if (!username || !password) {
    throw new WyndhamAutomationError(
      '저장된 로그인 세션이 없거나 만료되었습니다. 관리 화면에서 「Wyndham 로그인」을 눌러 Chrome에서 Sign In하세요.',
      'needs_manual'
    )
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
      'Wyndham 로그인이 봇 차단(403)되었습니다. 관리 화면 「Wyndham 로그인」으로 Chrome에서 직접 Sign In하세요.',
      'needs_manual'
    )
  }

  if (hasLoginError || (stillOnAuth && /wrong|invalid|incorrect|try again/i.test(bodyText))) {
    throw new WyndhamAutomationError(
      'Wyndham username/password가 거부되었습니다. 「Wyndham 로그인」으로 수동 로그인하거나 .env 계정을 확인하세요.',
      'needs_manual'
    )
  }

  if (stillOnAuth) {
    await authPage
      .waitForURL((url: URL) => !/login\.wyndhamhotels\.com/i.test(url.href), {
        timeout: 30_000,
      })
      .catch(() => undefined)
  }

  if (/login\.wyndhamhotels\.com/i.test(authPage.url())) {
    throw new WyndhamAutomationError(
      '로그인 후에도 Auth 페이지에 있습니다. 「Wyndham 로그인」으로 수동 세션을 저장하세요.',
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

export async function hasWyndhamAuthState(): Promise<boolean> {
  return fileExists(AUTH_STATE_PATH)
}

export async function getWyndhamAuthStateMeta(): Promise<{
  exists: boolean
  path: string
  mtimeMs: number | null
  ageMinutes: number | null
}> {
  try {
    const stat = await fs.stat(AUTH_STATE_PATH)
    const ageMinutes = Math.round((Date.now() - stat.mtimeMs) / 60_000)
    return {
      exists: true,
      path: AUTH_STATE_PATH,
      mtimeMs: stat.mtimeMs,
      ageMinutes,
    }
  } catch {
    return { exists: false, path: AUTH_STATE_PATH, mtimeMs: null, ageMinutes: null }
  }
}

/** Prevent overlapping headed login windows from the admin UI. */
let manualLoginInFlight: Promise<ManualLoginResult> | null = null

export type ManualLoginResult = {
  saved: true
  path: string
  waitedMs: number
}

/**
 * Open headed Chrome for the admin to Sign In manually, then save storageState.
 * Detects login by Sign Out / account UI (no terminal Enter needed).
 */
export async function runManualWyndhamLogin(opts?: {
  timeoutMs?: number
}): Promise<ManualLoginResult> {
  if (manualLoginInFlight) {
    return manualLoginInFlight
  }

  manualLoginInFlight = (async () => {
    const timeoutMs = opts?.timeoutMs ?? 5 * 60_000
    let playwright: typeof import('playwright')
    try {
      playwright = await import('playwright')
    } catch {
      throw new WyndhamAutomationError(
        'Playwright가 없습니다. 터미널에서: npx playwright install chromium',
        'needs_manual'
      )
    }

    const useChrome = process.env.WYNDHAM_USE_CHROME !== '0'
    const launchArgs = [
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
    ]

    // Persistent profile avoids Windows "URL in omnibox, blank page" with channel:chrome
    const profileDir =
      process.env.WYNDHAM_CHROME_PROFILE_DIR ||
      path.join(process.cwd(), 'automation', 'wyndham', 'chrome-profile')
    await fs.mkdir(profileDir, { recursive: true })

    const context = await playwright.chromium
      .launchPersistentContext(profileDir, {
        headless: false,
        ...(useChrome ? { channel: 'chrome' as const } : {}),
        chromiumSandbox: true,
        ignoreDefaultArgs: [...CHROME_IGNORE_DEFAULT_ARGS],
        args: launchArgs,
        locale: 'en-GB',
        viewport: { width: 1440, height: 900 },
        userAgent:
          process.env.WYNDHAM_USER_AGENT ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
        ignoreHTTPSErrors: true,
      })
      .catch(() =>
        playwright.chromium.launchPersistentContext(profileDir, {
          headless: false,
          chromiumSandbox: true,
          ignoreDefaultArgs: [...CHROME_IGNORE_DEFAULT_ARGS],
          args: launchArgs,
          locale: 'en-GB',
          viewport: { width: 1440, height: 900 },
          ignoreHTTPSErrors: true,
        })
      )

    const page = context.pages()[0] || (await context.newPage())
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })

    const started = Date.now()
    try {
      // Windows + channel:chrome often shows URL in omnibox without loading until Enter.
      await ensurePageActuallyLoads(page, WYNDHAM_URLS.home)

      // Open Sign In so the admin lands on the Auth0 form quickly
      const hashSignIn = page
        .locator('a[href$="#login"]')
        .filter({ hasText: /^Sign In$/i })
        .first()
      if (await hashSignIn.isVisible().catch(() => false)) {
        await hashSignIn.click().catch(() => undefined)
        await page.waitForTimeout(1_000)
      }

      await waitForManualLoginSuccess(context, timeoutMs)

      await fs.mkdir(path.dirname(AUTH_STATE_PATH), { recursive: true })
      await context.storageState({ path: AUTH_STATE_PATH })

      return {
        saved: true as const,
        path: AUTH_STATE_PATH,
        waitedMs: Date.now() - started,
      }
    } finally {
      await context.close().catch(() => undefined)
      manualLoginInFlight = null
    }
  })()

  try {
    return await manualLoginInFlight
  } catch (error) {
    manualLoginInFlight = null
    throw error
  }
}

/**
 * Make sure the document actually loads — not just URL sitting in the address bar.
 */
async function ensurePageActuallyLoads(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  url: string
): Promise<void> {
  await page.bringToFront().catch(() => undefined)
  // Let the headed window finish creating the window (Windows quirk)
  await page.waitForTimeout(800)

  const looksLoaded = async () => {
    try {
      const ready = await page.evaluate(() => document.readyState)
      const href = page.url()
      const textLen = await page
        .locator('body')
        .innerText()
        .then((t: string) => t.replace(/\s+/g, '').length)
        .catch(() => 0)
      return (
        /wyndhamhotels\.com/i.test(href) &&
        ready !== 'loading' &&
        textLen > 80
      )
    } catch {
      return false
    }
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      })
    } catch {
      // Fall through to force navigation
    }

    if (await looksLoaded()) return

    // Force reload — fixes "URL in bar, blank page until Enter" on Windows Chrome
    try {
      await page.evaluate((target: string) => {
        window.location.replace(target)
      }, url)
      await page.waitForLoadState('domcontentloaded', { timeout: 60_000 })
    } catch {
      /* continue */
    }

    if (await looksLoaded()) return

    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 })
    } catch {
      /* continue */
    }

    if (await looksLoaded()) return

    await page.waitForTimeout(500 * attempt)
  }

  // Last resort: F5 after focusing the page
  await page.bringToFront().catch(() => undefined)
  await page.mouse.click(200, 200).catch(() => undefined)
  await page.keyboard.press('F5').catch(() => undefined)
  await page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => undefined)

  // If still blank, leave the window open — admin can press Enter in the address bar.
  // waitForManualLoginSuccess will still detect Sign In afterwards.
}

/**
 * Wait until the admin has clearly finished Wyndham Rewards login.
 *
 * IMPORTANT: Never treat Auth0 copy like "Don't have an account?" as signed-in
 * (`has-text("Account")` was a false positive that closed the Chrome window
 * while the admin was still typing credentials).
 */
async function waitForManualLoginSuccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
  timeoutMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pages: any[] = context.pages()

    for (const p of pages) {
      const url: string = p.url()

      // Still on Auth0 / login host — never finish here
      if (/login\.wyndhamhotels\.com/i.test(url)) continue
      if (!/wyndhamhotels\.com/i.test(url)) continue

      const signedOutVisible = await p
        .getByRole('link', { name: /^Sign Out$/i })
        .or(p.getByRole('button', { name: /^Sign Out$/i }))
        .first()
        .isVisible()
        .catch(() => false)

      const myAccountVisible = await p
        .getByRole('link', { name: /^My Account$/i })
        .first()
        .isVisible()
        .catch(() => false)

      // Member greeting / rewards UI (avoid bare "Account" substring)
      const rewardsVisible = await p
        .locator('[data-testid*="sign-out"], [aria-label*="Sign Out" i], a[href*="signout" i], a[href*="sign-out" i]')
        .first()
        .isVisible()
        .catch(() => false)

      if (signedOutVisible || myAccountVisible || rewardsVisible) {
        // Re-check after a short delay so we don't close on a transient flash
        await new Promise((r) => setTimeout(r, 2_000))
        const stillOk =
          (await p
            .getByRole('link', { name: /^Sign Out$/i })
            .or(p.getByRole('button', { name: /^Sign Out$/i }))
            .first()
            .isVisible()
            .catch(() => false)) ||
          (await p
            .getByRole('link', { name: /^My Account$/i })
            .first()
            .isVisible()
            .catch(() => false)) ||
          (await p
            .locator(
              '[data-testid*="sign-out"], [aria-label*="Sign Out" i], a[href*="signout" i], a[href*="sign-out" i]'
            )
            .first()
            .isVisible()
            .catch(() => false))

        if (stillOk && !/login\.wyndhamhotels\.com/i.test(p.url())) {
          return
        }
      }
    }

    await new Promise((r) => setTimeout(r, 2_000))
  }

  throw new WyndhamAutomationError(
    '로그인 대기 시간이 초과되었습니다. Chrome에서 Sign In을 완료한 뒤(Sign Out이 보일 때까지) 기다려 주세요. 창이 먼저 닫히면 다시 「Wyndham 로그인」을 눌러 주세요.',
    'needs_manual'
  )
}
