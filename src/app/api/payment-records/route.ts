import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 입금 내역 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reservationId = searchParams.get('reservation_id')

    // Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // 토큰으로 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 입금 내역 조회 (간단한 쿼리로 변경)
    try {
      let query = supabase
        .from('payment_records')
        .select('*')
        .order('created_at', { ascending: false })

      if (reservationId) {
        query = query.eq('reservation_id', reservationId)
      }

      const { data: paymentRecords, error } = await query

      if (error) {
        console.error('입금 내역 조회 오류:', error)
        // 테이블이 존재하지 않는 경우 빈 배열 반환
        return NextResponse.json({ paymentRecords: [] })
      }

      return NextResponse.json({ paymentRecords: paymentRecords || [] })
    } catch (error) {
      console.error('입금 내역 조회 예외:', error)
      // 테이블이 존재하지 않는 경우 빈 배열 반환
      return NextResponse.json({ paymentRecords: [] })
    }
  } catch (error) {
    console.error('입금 내역 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

// 입금 내역 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      reservation_id, 
      payment_status = 'pending',
      amount, 
      payment_method, 
      note, 
      image_file_url,
      amount_krw 
    } = body

    // 필수 필드 검증
    if (!reservation_id || !amount || !payment_method) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다' }, { status: 400 })
    }

    // Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // 토큰으로 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 입금 내역 생성
    const { data: newPaymentRecord, error } = await supabase
      .from('payment_records')
      .insert({
        id: `payment_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        reservation_id,
        payment_status,
        amount: parseFloat(amount),
        payment_method,
        note: note || null,
        image_file_url: image_file_url || null,
        submit_by: user.email!,
        amount_krw: amount_krw ? parseFloat(amount_krw) : null
      })
      .select('*')
      .single()

    if (error) {
      console.error('입금 내역 생성 오류:', error)
      return NextResponse.json({ error: '입금 내역을 생성할 수 없습니다' }, { status: 500 })
    }

    return NextResponse.json({ paymentRecord: newPaymentRecord })
  } catch (error) {
    console.error('입금 내역 생성 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
