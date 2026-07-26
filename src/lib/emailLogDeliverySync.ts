import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase'

export type EmailLogRowForDeliverySync = {
  id: string
  resend_email_id?: string | null
  status?: string | null
  delivered_at?: string | null
  bounced_at?: string | null
  opened_at?: string | null
  clicked_at?: string | null
}

type ResendEmailSnapshot = {
  last_event?: string | null
  bounce?: {
    message?: string | null
    type?: string | null
    subType?: string | null
  } | null
}

function buildBounceReason(snapshot: ResendEmailSnapshot): string {
  const bounce = snapshot.bounce
  if (!bounce) return 'Bounced'
  const parts = [bounce.message, bounce.type, bounce.subType].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0
  )
  return parts.length > 0 ? parts.join(' · ') : 'Bounced'
}

function isPendingDeliveryLog(log: EmailLogRowForDeliverySync): boolean {
  const status = String(log.status ?? '').toLowerCase()
  if (log.delivered_at || log.bounced_at) return false
  return status === 'sent'
}

const DEFAULT_MAX_LOGS_PER_BATCH = 8
const DEFAULT_MAX_RESERVATIONS_PER_BATCH = 8
/** Resend 한도 10 req/s — 여유 두고 초당 ~4회 */
const RESEND_MIN_INTERVAL_MS = 250
const RESEND_MAX_RETRIES = 5
const RESEND_RATE_LIMIT_BASE_MS = 1200

let resendQueue: Promise<unknown> = Promise.resolve()
let lastResendRequestAt = 0

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function isResendRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { statusCode?: number; name?: string; message?: string }
  return e.statusCode === 429 || e.name === 'rate_limit_exceeded'
}

/** 이전 Resend 요청 완료 후 최소 간격을 두고 직렬 실행 */
function runThroughResendQueue<T>(fn: () => Promise<T>): Promise<T> {
  const task = resendQueue.then(async () => {
    const wait = Math.max(0, RESEND_MIN_INTERVAL_MS - (Date.now() - lastResendRequestAt))
    if (wait > 0) await sleep(wait)
    lastResendRequestAt = Date.now()
    return fn()
  })
  resendQueue = task.then(
    () => undefined,
    () => undefined
  )
  return task
}

/** Resend API에서 단일 이메일 전달 상태를 조회합니다. */
export async function fetchResendEmailSnapshot(
  resendEmailId: string
): Promise<ResendEmailSnapshot | null> {
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.error('[emailLogDeliverySync] RESEND_API_KEY is not configured')
    return null
  }

  return runThroughResendQueue(async () => {
    const resend = new Resend(resendApiKey)

    for (let attempt = 0; attempt <= RESEND_MAX_RETRIES; attempt++) {
      const { data, error } = await resend.emails.get(resendEmailId)

      if (!error) {
        return (data ?? null) as ResendEmailSnapshot | null
      }

      if (isResendRateLimitError(error) && attempt < RESEND_MAX_RETRIES) {
        const backoffMs = RESEND_RATE_LIMIT_BASE_MS * 2 ** attempt
        await sleep(backoffMs)
        continue
      }

      if (!isResendRateLimitError(error)) {
        console.error('[emailLogDeliverySync] Resend API 조회 오류:', {
          resendEmailId,
          error,
        })
      }
      return null
    }

    return null
  })
}

function normalizeResendLastEvent(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s.startsWith('email.')) return s.slice(6)
  return s
}

/** Resend last_event 값을 email_logs 컬럼 업데이트로 변환합니다. */
export function buildEmailLogDeliveryUpdate(
  log: EmailLogRowForDeliverySync,
  snapshot: ResendEmailSnapshot
): Record<string, string> | null {
  const lastEvent = normalizeResendLastEvent(snapshot.last_event)
  const now = new Date().toISOString()

  if (lastEvent === 'bounced' || lastEvent === 'failed' || lastEvent === 'suppressed') {
    if (log.bounced_at) return null
    return {
      bounced_at: now,
      bounce_reason: buildBounceReason(snapshot),
      status: 'bounced',
    }
  }

  if (lastEvent === 'delivered' || lastEvent === 'opened' || lastEvent === 'clicked') {
    if (log.delivered_at && String(log.status ?? '').toLowerCase() === 'delivered') {
      return null
    }
    return {
      delivered_at: log.delivered_at ?? now,
      status: 'delivered',
    }
  }

  return null
}

/** 단일 email_logs 행을 Resend API와 동기화합니다. */
export async function syncEmailLogDeliveryFromResend(
  log: EmailLogRowForDeliverySync
): Promise<boolean> {
  if (!supabaseAdmin) return false
  if (!isPendingDeliveryLog(log)) return false

  const resendEmailId = String(log.resend_email_id ?? '').trim()
  if (!resendEmailId) return false

  const snapshot = await fetchResendEmailSnapshot(resendEmailId)
  if (!snapshot) return false

  const lastEvent = normalizeResendLastEvent(snapshot.last_event)
  if (!lastEvent || lastEvent === 'sent' || lastEvent === 'scheduled' || lastEvent === 'delivery_delayed') {
    return false
  }

  const update = buildEmailLogDeliveryUpdate(log, snapshot)
  if (!update) return false

  const { error } = await supabaseAdmin
    .from('email_logs')
    .update(update as never)
    .eq('id', log.id)

  if (error) {
    console.error('[emailLogDeliverySync] email_logs 업데이트 오류:', {
      logId: log.id,
      error,
    })
    return false
  }

  return true
}

/** 예약의 전달 확인 중 이메일 로그를 Resend API와 동기화합니다. */
export async function syncReservationEmailLogsFromResend(
  reservationId: string
): Promise<{ synced: number; checked: number }> {
  return syncEmailLogsFromResendForReservationIds([reservationId])
}

/** 여러 예약의 sent 로그를 한 번에 Resend와 동기화 (API 호출 수 제한) */
export async function syncEmailLogsFromResendForReservationIds(
  reservationIds: string[],
  options?: { maxLogs?: number; maxReservations?: number }
): Promise<{ synced: number; checked: number; updatedReservationIds: string[] }> {
  if (!supabaseAdmin) {
    return { synced: 0, checked: 0, updatedReservationIds: [] }
  }

  const maxLogs = options?.maxLogs ?? DEFAULT_MAX_LOGS_PER_BATCH
  const maxReservations = options?.maxReservations ?? DEFAULT_MAX_RESERVATIONS_PER_BATCH
  const unique = [
    ...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean)),
  ].slice(0, maxReservations)

  if (unique.length === 0) {
    return { synced: 0, checked: 0, updatedReservationIds: [] }
  }

  const { data, error } = await supabaseAdmin
    .from('email_logs')
    .select(
      'id, reservation_id, resend_email_id, status, delivered_at, bounced_at, opened_at, clicked_at'
    )
    .in('reservation_id', unique)
    .is('delivered_at', null)
    .is('bounced_at', null)
    .not('resend_email_id', 'is', null)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(maxLogs)

  if (error) {
    console.error('[emailLogDeliverySync] batch pending logs 조회 오류:', error)
    return { synced: 0, checked: 0, updatedReservationIds: [] }
  }

  const logs = (data ?? []) as (EmailLogRowForDeliverySync & { reservation_id?: string })[]
  const updatedReservationIds = new Set<string>()
  let synced = 0

  for (const log of logs) {
    const updated = await syncEmailLogDeliveryFromResend(log)
    if (updated) {
      synced++
      const rid = String(log.reservation_id ?? '').trim()
      if (rid) updatedReservationIds.add(rid)
    }
  }

  return { synced, checked: logs.length, updatedReservationIds: [...updatedReservationIds] }
}
