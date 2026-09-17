import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { tryApplyReservationImportPickupChange } from '@/lib/reservationImportBookingChange'

/**
 * POST /api/reservation-imports/[id]/apply-pickup-change
 * 변경 메일의 픽업 호텔을 기존 예약에 반영. body.hotel_id 가 있으면 그 호텔로 수동 반영.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let hotelId: string | undefined
  try {
    const body = (await request.json().catch(() => ({}))) as { hotel_id?: string }
    if (typeof body.hotel_id === 'string' && body.hotel_id.trim()) {
      hotelId = body.hotel_id.trim()
    }
  } catch {
    hotelId = undefined
  }

  const client = supabaseAdmin ?? (await import('@/lib/supabase')).supabase
  const result = await tryApplyReservationImportPickupChange(client as never, id, {
    ...(hotelId ? { hotelId } : {}),
    source: 'manual',
  })

  if (!result.handledAsChange) {
    return NextResponse.json({ error: '변경 메일이 아닙니다.', reason: result.reason }, { status: 400 })
  }
  if (!result.ok) {
    const status =
      result.reason === 'reservation_not_found' || result.reason === 'missing_channel_rn' ? 404 : 400
    return NextResponse.json({ error: result.reason, ...result }, { status })
  }
  return NextResponse.json(result)
}
