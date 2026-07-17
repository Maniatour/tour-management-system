import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { resolveReservationChoices } from '@/lib/resolveReservationChoices'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getSupabaseForApiRoute(request)
  if (db instanceof NextResponse) return db

  const { id: reservationId } = await params
  if (!reservationId?.trim()) {
    return NextResponse.json({ choices: [] })
  }

  try {
    const choices = await resolveReservationChoices(db, reservationId)
    return NextResponse.json({ choices })
  } catch (error) {
    console.error('예약 초이스 API 조회 오류:', {
      reservationId,
      error: error instanceof Error ? error.message : error,
    })
    return NextResponse.json({ error: '예약 초이스 조회에 실패했습니다.' }, { status: 500 })
  }
}
