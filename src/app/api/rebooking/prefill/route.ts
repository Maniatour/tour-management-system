import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchRebookingPrefillForReservation } from '@/lib/rebookingPrefillServer'

/** 고객 재예약 링크용 prefill (예약 ID만으로 날짜·인원·초이스 복원) */
export async function GET(request: NextRequest) {
  const admin = supabaseAdmin
  if (!admin) {
    return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 })
  }

  const reservationId = new URL(request.url).searchParams.get('reservation_id')?.trim()
  if (!reservationId) {
    return NextResponse.json({ error: 'reservation_id가 필요합니다.' }, { status: 400 })
  }

  try {
    const prefill = await fetchRebookingPrefillForReservation(admin, reservationId)
    if (!prefill) {
      return NextResponse.json({ error: '예약을 찾을 수 없습니다.' }, { status: 404 })
    }
    return NextResponse.json({ prefill })
  } catch (error) {
    console.error('[rebooking/prefill]', error)
    return NextResponse.json({ error: 'prefill을 불러올 수 없습니다.' }, { status: 500 })
  }
}
