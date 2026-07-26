import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export type EmailLogRowForResend = {
  id: string
  reservation_id: string
  email: string
  email_type: string
  status: string
  subject: string
}

async function callInternalSendApi(
  request: NextRequest,
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const authHeader = request.headers.get('authorization')
  if (authHeader) headers.Authorization = authHeader
  const cookie = request.headers.get('cookie')
  if (cookie) headers.Cookie = cookie

  const origin = request.nextUrl.origin
  const res = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof data.error === 'string' ? data.error : '이메일 재발송에 실패했습니다.',
    }
  }
  return { ok: true }
}

/** Resend(서비스)로 보낸 이메일 로그를 동일 유형으로 재발송 */
export async function resendEmailFromLog(
  request: NextRequest,
  emailLog: EmailLogRowForResend,
  options: { sentBy: string; emailOverride?: string }
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = supabaseAdmin
  if (!db) {
    return { ok: false, status: 500, error: '서버 설정 오류입니다.' }
  }

  const toEmail = (options.emailOverride || emailLog.email || '').trim()
  if (!toEmail) {
    return { ok: false, status: 400, error: '수신 이메일 주소가 없습니다.' }
  }

  const emailType = String(emailLog.email_type ?? '').toLowerCase()
  const baseBody = {
    reservationId: emailLog.reservation_id,
    sentBy: options.sentBy,
  }

  if (emailType === 'confirmation' || emailType === 'receipt' || emailType === 'both') {
    return callInternalSendApi(request, '/api/send-email', {
      ...baseBody,
      email: toEmail,
      type: 'both',
    })
  }

  if (emailType === 'departure' || emailType === 'voucher') {
    return callInternalSendApi(request, '/api/send-email', {
      ...baseBody,
      email: toEmail,
      type: 'voucher',
    })
  }

  if (emailType === 'pickup') {
    const { data: reservation, error } = await db
      .from('reservations')
      .select('pickup_time, tour_date')
      .eq('id', emailLog.reservation_id)
      .maybeSingle()

    if (error || !reservation) {
      return { ok: false, status: 404, error: '예약을 찾을 수 없습니다.' }
    }

    const row = reservation as { pickup_time?: string | null; tour_date?: string | null }
    const pickupTimeRaw = String(row.pickup_time ?? '').trim()
    const tourDate = String(row.tour_date ?? '').trim()

    if (!pickupTimeRaw || !tourDate) {
      return {
        ok: false,
        status: 400,
        error: '픽업 시간과 투어 날짜가 필요합니다. 예약 정보를 확인해 주세요.',
      }
    }

    const pickupTime = pickupTimeRaw.includes(':') ? pickupTimeRaw : `${pickupTimeRaw}:00`

    return callInternalSendApi(request, '/api/send-pickup-schedule-notification', {
      ...baseBody,
      pickupTime,
      tourDate,
      email: toEmail,
    })
  }

  if (emailType === 'resident_inquiry') {
    return callInternalSendApi(request, '/api/send-resident-inquiry-email', {
      ...baseBody,
      email: toEmail,
    })
  }

  return {
    ok: false,
    status: 400,
    error: `재발송을 지원하지 않는 이메일 유형입니다: ${emailLog.email_type}`,
  }
}

export function emailLogCanResend(status: string | null | undefined): boolean {
  const s = String(status ?? '').toLowerCase()
  return s === 'bounced' || s === 'failed'
}

export function emailLogDeliveryStatusLabel(
  log: {
    status: string
    delivered_at?: string | null
    bounced_at?: string | null
    error_message?: string | null
  },
  locale: 'ko' | 'en' = 'ko'
): { label: string; tone: 'success' | 'warning' | 'danger' | 'muted' | 'info' } {
  const en = locale === 'en'
  if (log.bounced_at || String(log.status).toLowerCase() === 'bounced') {
    return { label: en ? 'Bounced' : '반송됨', tone: 'danger' }
  }
  if (String(log.status).toLowerCase() === 'failed') {
    return { label: en ? 'Send failed' : '발송 실패', tone: 'danger' }
  }
  if (log.delivered_at || String(log.status).toLowerCase() === 'delivered') {
    return { label: en ? 'Delivered' : '전달 완료', tone: 'success' }
  }
  if (String(log.status).toLowerCase() === 'sent') {
    return { label: en ? 'Sent (awaiting delivery)' : '발송됨 (전달 확인 중)', tone: 'warning' }
  }
  return { label: log.status || (en ? 'Unknown' : '알 수 없음'), tone: 'muted' }
}
