/**
 * Runtime readiness for Wyndham Playwright automation (local / worker).
 * Never returns secrets — only whether env + playwright look ready.
 */
export async function getWyndhamAutomationStatus() {
  const liveFlag = process.env.HOTEL_WYNDHAM_LIVE === '1'
  const hasUsername = Boolean(
    process.env.WYNDHAM_LOGIN_USERNAME?.trim() ||
      process.env.WYNDHAM_LOGIN_EMAIL?.trim()
  )
  const hasPassword = Boolean(process.env.WYNDHAM_LOGIN_PASSWORD?.trim())
  const credentialsConfigured = hasUsername && hasPassword

  let playwrightInstalled = false
  let playwrightError: string | null = null
  try {
    await import('playwright')
    playwrightInstalled = true
  } catch (error) {
    playwrightError =
      error instanceof Error ? error.message : 'playwright import failed'
  }

  const readyForLive = credentialsConfigured && playwrightInstalled
  const blockers: string[] = []
  if (!credentialsConfigured) {
    blockers.push(
      '.env.local에 WYNDHAM_LOGIN_USERNAME / WYNDHAM_LOGIN_PASSWORD를 넣으세요. (이메일 아님 · username)'
    )
  }
  if (!playwrightInstalled) {
    blockers.push(
      'Playwright가 없습니다. 터미널에서: npm i -D playwright && npx playwright install chromium'
    )
  }
  if (!liveFlag && readyForLive) {
    blockers.push(
      '수동 조회는 forceLive로 시도할 수 있습니다. 상시 자동화는 HOTEL_WYNDHAM_LIVE=1을 권장합니다.'
    )
  }

  return {
    supplier: 'wyndham' as const,
    liveFlag,
    credentialsConfigured,
    playwrightInstalled,
    playwrightError,
    readyForLive,
    blockers,
    hint: readyForLive
      ? '로그인 후 멤버(Wyndham Rewards) 요금 수동 조회가 가능합니다.'
      : 'Wyndham 실조회 전에 자격증명과 Playwright를 준비하세요.',
  }
}
