/**
 * Runtime readiness for Wyndham Playwright automation (local / worker).
 * Default path: guest/public rates (no login) — Rewards login hits Rate Support.
 *
 * Production: set WYNDHAM_WORKER_URL on Vercel; run `npm run wyndham:worker` on a PC/VPS.
 */
import { getWyndhamWorkerConfig } from '@/lib/hotels/suppliers/wyndham/worker-client'

export async function getWyndhamAutomationStatus() {
  const liveFlag = process.env.HOTEL_WYNDHAM_LIVE === '1'
  const worker = getWyndhamWorkerConfig()

  if (worker.configured) {
    const blockers: string[] = []
    if (!worker.hasSecret) {
      blockers.push(
        'WYNDHAM_WORKER_SECRET이 없습니다. Vercel과 worker에 동일한 값을 설정하세요.'
      )
    }
    if (!liveFlag) {
      blockers.push(
        'HOTEL_WYNDHAM_LIVE=1 을 Vercel에 설정하면 상시 조회가 가능합니다.'
      )
    }

    return {
      supplier: 'wyndham' as const,
      liveFlag,
      credentialsConfigured: false,
      playwrightInstalled: false,
      playwrightError: null as string | null,
      authStateSaved: false,
      authStateAgeMinutes: null as number | null,
      readyForLive: worker.hasSecret && liveFlag,
      canScrapeRates: worker.hasSecret,
      mode: 'worker' as const,
      workerUrl: worker.url,
      blockers,
      hint: worker.hasSecret
        ? `원격 worker로 공개 요금을 조회합니다 (${worker.url}). worker PC에서 npm run wyndham:worker 가 실행 중이어야 합니다.`
        : 'WYNDHAM_WORKER_URL은 있으나 SECRET이 없습니다.',
    }
  }

  let playwrightInstalled = false
  let playwrightError: string | null = null
  try {
    await import('playwright')
    playwrightInstalled = true
  } catch (error) {
    playwrightError =
      error instanceof Error ? error.message : 'playwright import failed'
  }

  const readyForLive = playwrightInstalled
  const blockers: string[] = []

  if (!playwrightInstalled) {
    blockers.push(
      'Playwright가 없습니다. 로컬: npm i -D playwright && npx playwright install chromium — 또는 Vercel에는 WYNDHAM_WORKER_URL을 설정하세요.'
    )
  }
  if (!liveFlag && readyForLive) {
    blockers.push(
      '수동 「요금 가져오기」는 가능합니다. 상시 자동화는 HOTEL_WYNDHAM_LIVE=1을 권장합니다.'
    )
  }

  return {
    supplier: 'wyndham' as const,
    liveFlag,
    credentialsConfigured: false,
    playwrightInstalled,
    playwrightError,
    authStateSaved: false,
    authStateAgeMinutes: null as number | null,
    readyForLive,
    canScrapeRates: playwrightInstalled,
    mode: 'public' as const,
    workerUrl: null as string | null,
    blockers,
    hint: playwrightInstalled
      ? '로그인 없이 공개(게스트) 요금을 조회합니다. 「요금 가져오기」를 누르세요.'
      : 'Playwright를 설치하거나 WYNDHAM_WORKER_URL(원격 worker)을 설정하세요.',
  }
}
