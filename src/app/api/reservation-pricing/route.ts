import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // URL에서 reservation_id 파라미터 가져오기
    const { searchParams } = new URL(request.url)
    const reservationId = searchParams.get('reservation_id')

    if (!reservationId) {
      return NextResponse.json(
        { error: 'reservation_id 파라미터가 필요합니다.' },
        { status: 400 }
      )
    }

    // Supabase에서 reservation_pricing 데이터 조회
    const { data: pricing, error } = await supabase
      .from('reservation_pricing')
      .select('*')
      .eq('reservation_id', reservationId)
      .single()

    if (error) {
      console.error('reservation_pricing 조회 오류:', error)
      // 데이터가 없는 경우에도 200 응답으로 빈 데이터 반환
      if (error.code === 'PGRST116') { // PGRST116은 "no rows found" 오류
        return NextResponse.json({ pricing: null })
      }
      return NextResponse.json(
        { error: '예약 가격 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ pricing })
  } catch (error) {
    console.error('API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
