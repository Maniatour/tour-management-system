import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 예약 확인 (고객용 - 인증 없이 이메일과 예약 ID로 확인)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reservation_id, customer_email } = body

    // 필수 필드 검증
    if (!reservation_id || !customer_email) {
      return NextResponse.json({ 
        error: '예약 ID와 고객 이메일을 입력해주세요' 
      }, { status: 400 })
    }

    // 예약 조회
    const { data: reservation, error } = await supabase
      .from('reservations')
      .select(`
        *,
        product:products(
          id,
          name,
          name_ko,
          customer_name_ko,
          base_price,
          duration,
          max_participants,
          departure_city,
          arrival_city,
          departure_country,
          arrival_country
        ),
        customer:customers(
          id,
          name,
          email,
          phone,
          resident_status
        ),
        reservation_options:reservation_options(
          choice_id,
          option_id,
          choice:choices(
            choice_name,
            choice_name_ko,
            choice_type
          ),
          option:options(
            option_name,
            option_name_ko,
            option_price
          )
        ),
        payment_records:payment_records(
          id,
          payment_status,
          amount,
          payment_method,
          submit_on,
          confirmed_on
        )
      `)
      .eq('id', reservation_id)
      .eq('customer_email', customer_email)
      .single()

    if (error || !reservation) {
      return NextResponse.json({ 
        error: '예약을 찾을 수 없습니다. 예약 ID와 이메일을 확인해주세요.' 
      }, { status: 404 })
    }

    return NextResponse.json({ reservation })

  } catch (error) {
    console.error('예약 확인 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다' 
    }, { status: 500 })
  }
}

// 예약 상태 업데이트 (간단한 상태 변경용)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { reservation_id, status, customer_email } = body

    // 필수 필드 검증
    if (!reservation_id || !status || !customer_email) {
      return NextResponse.json({ 
        error: '필수 필드가 누락되었습니다' 
      }, { status: 400 })
    }

    // 유효한 상태인지 확인
    const validStatuses = ['confirmed', 'pending', 'cancelled', 'completed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: '유효하지 않은 상태입니다' 
      }, { status: 400 })
    }

    // 예약 존재 확인 및 소유자 확인
    const { data: existingReservation, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservation_id)
      .eq('customer_email', customer_email)
      .single()

    if (fetchError || !existingReservation) {
      return NextResponse.json({ 
        error: '예약을 찾을 수 없습니다' 
      }, { status: 404 })
    }

    // 상태 업데이트
    const { data: updatedReservation, error } = await supabase
      .from('reservations')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', reservation_id)
      .select('*')
      .single()

    if (error) {
      console.error('예약 상태 업데이트 오류:', error)
      return NextResponse.json({ 
        error: '예약 상태를 업데이트할 수 없습니다' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      reservation: updatedReservation,
      message: '예약 상태가 성공적으로 업데이트되었습니다'
    })

  } catch (error) {
    console.error('예약 상태 업데이트 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다' 
    }, { status: 500 })
  }
}
