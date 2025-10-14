import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reservation_id, pickup_time, pickup_hotel } = body

    if (!reservation_id) {
      return NextResponse.json(
        { error: 'reservation_id가 필요합니다.' },
        { status: 400 }
      )
    }

    // Supabase에서 예약 정보 업데이트
    const { data, error } = await supabase
      .from('reservations')
      .update({
        pickup_time: pickup_time || null,
        pickup_hotel: pickup_hotel || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', reservation_id)
      .select()

    if (error) {
      console.error('예약 정보 업데이트 오류:', error)
      return NextResponse.json(
        { error: '픽업 정보 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      reservation: data[0] 
    })
  } catch (error) {
    console.error('API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
