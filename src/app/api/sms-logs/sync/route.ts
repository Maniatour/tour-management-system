import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { syncReservationSmsLogsFromTwilio } from '@/lib/smsLogDeliverySync'

/**
 * POST /api/sms-logs/sync
 * Twilio API로 전달 확인 중(sent) SMS 로그의 실제 상태를 동기화합니다.
 * Body: { reservationId: string }
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

  const reservationId = typeof body.reservationId === 'string' ? body.reservationId.trim() : ''
  if (!reservationId) {
    return NextResponse.json({ error: 'reservationId가 필요합니다.' }, { status: 400 })
  }

  const result = await syncReservationSmsLogsFromTwilio(reservationId)

  return NextResponse.json({
    success: true,
    ...result,
  })
}
