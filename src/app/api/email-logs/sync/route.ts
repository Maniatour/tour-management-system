import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import {
  syncEmailLogsFromResendForReservationIds,
  syncReservationEmailLogsFromResend,
} from '@/lib/emailLogDeliverySync'

/**
 * POST /api/email-logs/sync
 * Resend API로 전달 확인 중(sent) 로그의 실제 상태를 동기화합니다.
 * Body: { reservationId?: string, reservationIds?: string[] }
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const singleId = typeof body.reservationId === 'string' ? body.reservationId.trim() : ''
  const rawIds = Array.isArray(body.reservationIds) ? body.reservationIds : []
  const batchIds = rawIds
    .map((id) => (typeof id === 'string' ? id.trim() : ''))
    .filter(Boolean)

  if (singleId) batchIds.unshift(singleId)

  const uniqueIds = [...new Set(batchIds)]
  if (uniqueIds.length === 0) {
    return NextResponse.json({ error: 'reservationId 또는 reservationIds가 필요합니다.' }, { status: 400 })
  }

  const result =
    uniqueIds.length === 1
      ? await syncReservationEmailLogsFromResend(uniqueIds[0]!)
      : await syncEmailLogsFromResendForReservationIds(uniqueIds)

  return NextResponse.json({
    success: true,
    ...result,
  })
}
