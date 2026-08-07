import type { HotelRateQuote, RateQueryParams } from '@/lib/hotels/types'
import { WyndhamAutomationError } from '@/lib/hotels/suppliers/wyndham/session'

/**
 * When set on Vercel (or any host without Playwright), rate scrapes are forwarded
 * to a long-running worker that has Chromium installed.
 *
 * Worker process must set WYNDHAM_WORKER_SELF=1 (and leave WYNDHAM_WORKER_URL empty)
 * so it executes Playwright locally instead of looping back to itself.
 */
export function shouldUseWyndhamWorker(): boolean {
  return (
    Boolean(process.env.WYNDHAM_WORKER_URL?.trim()) &&
    process.env.WYNDHAM_WORKER_SELF !== '1'
  )
}

export function getWyndhamWorkerConfig() {
  return {
    configured: shouldUseWyndhamWorker(),
    url: process.env.WYNDHAM_WORKER_URL?.trim() || null,
    hasSecret: Boolean(process.env.WYNDHAM_WORKER_SECRET?.trim()),
  }
}

export async function fetchRatesViaWyndhamWorker(
  params: RateQueryParams
): Promise<HotelRateQuote[]> {
  const base = process.env.WYNDHAM_WORKER_URL?.trim()?.replace(/\/$/, '')
  if (!base) {
    throw new WyndhamAutomationError('WYNDHAM_WORKER_URL이 없습니다.', 'failed')
  }

  const secret = process.env.WYNDHAM_WORKER_SECRET?.trim()
  if (!secret) {
    throw new WyndhamAutomationError(
      'WYNDHAM_WORKER_SECRET이 없습니다. Vercel과 worker에 동일한 시크릿을 설정하세요.',
      'failed'
    )
  }

  const timeoutMs = Number(process.env.WYNDHAM_WORKER_TIMEOUT_MS || 120_000)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${base}/v1/wyndham/get-rates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ params }),
      signal: controller.signal,
    })

    const json = (await res.json().catch(() => ({}))) as {
      error?: string
      quotes?: HotelRateQuote[]
    }

    if (!res.ok) {
      throw new WyndhamAutomationError(
        json.error || `Wyndham worker HTTP ${res.status}`,
        res.status === 422 ? 'needs_manual' : 'failed'
      )
    }

    return Array.isArray(json.quotes) ? json.quotes : []
  } catch (error) {
    if (error instanceof WyndhamAutomationError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new WyndhamAutomationError(
        `Wyndham worker 응답 시간 초과 (${Math.round(timeoutMs / 1000)}초). worker가 실행 중인지 확인하세요.`,
        'failed'
      )
    }
    const message = error instanceof Error ? error.message : String(error)
    throw new WyndhamAutomationError(
      `Wyndham worker 호출 실패: ${message}. WYNDHAM_WORKER_URL / worker 상태를 확인하세요.`,
      'failed'
    )
  } finally {
    clearTimeout(timer)
  }
}
