import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { timeToHHmm } from '@/lib/utils'

function normalizePickupTimeForDb(value: unknown): string | null {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null
  const hhmm = timeToHHmm(raw)
  return hhmm ? `${hhmm}:00` : null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase

    const body = await request.json()
    const { reservation_id, pickup_time, pickup_hotel } = body as {
      reservation_id?: string
      pickup_time?: string | null
      pickup_hotel?: string | null
    }

    if (!reservation_id) {
      return NextResponse.json(
        { error: 'reservation_id가 필요합니다.' },
        { status: 400 }
      )
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const updatePayload: {
      pickup_time: string | null
      pickup_hotel?: string | null
      updated_at: string
    } = {
      pickup_time: normalizePickupTimeForDb(pickup_time),
      updated_at: new Date().toISOString(),
    }

    // 빈 문자열로 호텔을 덮어쓰지 않도록 — 명시적으로 전달된 경우만 갱신
    if (pickup_hotel !== undefined) {
      const hotel = typeof pickup_hotel === 'string' ? pickup_hotel.trim() : ''
      updatePayload.pickup_hotel = hotel || null
    }

    const { data, error } = await supabase
      .from('reservations')
      .update(updatePayload)
      .eq('id', reservation_id)
      .select('id, pickup_time, pickup_hotel')
      .maybeSingle()

    if (error) {
      console.error('예약 정보 업데이트 오류:', error)
      return NextResponse.json(
        { error: '픽업 정보 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    // RLS로 0행 업데이트되면 error 없이 data=null → 성공처럼 보이던 문제 방지
    if (!data) {
      return NextResponse.json(
        { error: '픽업 정보를 수정할 권한이 없거나 예약을 찾을 수 없습니다.' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      reservation: data,
    })
  } catch (error) {
    console.error('API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
