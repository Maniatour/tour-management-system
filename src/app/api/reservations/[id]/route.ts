import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 특정 예약 조회, 수정, 삭제
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reservationId = params.id

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
      .eq('id', reservationId)
      .single()

    if (error) {
      console.error('예약 조회 오류:', error)
      return NextResponse.json({ 
        error: '예약을 찾을 수 없습니다' 
      }, { status: 404 })
    }

    return NextResponse.json({ reservation })

  } catch (error) {
    console.error('예약 조회 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다' 
    }, { status: 500 })
  }
}

// 예약 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reservationId = params.id
    const body = await request.json()
    const {
      customer_name,
      customer_email,
      customer_phone,
      tour_date,
      departure_time,
      adults,
      children,
      infants,
      total_price,
      special_requests,
      nationality,
      selected_options,
      payment_method,
      status
    } = body

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

    // 기존 예약 확인
    const { data: existingReservation, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single()

    if (fetchError || !existingReservation) {
      return NextResponse.json({ 
        error: '예약을 찾을 수 없습니다' 
      }, { status: 404 })
    }

    // 업데이트할 데이터 준비
    const updateData: any = {
      updated_at: new Date().toISOString(),
      updated_by: user.email
    }

    if (customer_name !== undefined) updateData.customer_name = customer_name
    if (customer_email !== undefined) updateData.customer_email = customer_email
    if (customer_phone !== undefined) updateData.customer_phone = customer_phone
    if (tour_date !== undefined) updateData.tour_date = tour_date
    if (departure_time !== undefined) updateData.departure_time = departure_time
    if (adults !== undefined) updateData.adults = parseInt(adults)
    if (children !== undefined) updateData.children = parseInt(children)
    if (infants !== undefined) updateData.infants = parseInt(infants)
    if (total_price !== undefined) updateData.total_price = parseFloat(total_price)
    if (special_requests !== undefined) updateData.special_requests = special_requests
    if (nationality !== undefined) updateData.nationality = nationality
    if (selected_options !== undefined) updateData.selected_options = selected_options
    if (payment_method !== undefined) updateData.payment_method = payment_method
    if (status !== undefined) updateData.status = status

    // 예약 업데이트
    const { data: updatedReservation, error } = await supabase
      .from('reservations')
      .update(updateData)
      .eq('id', reservationId)
      .select('*')
      .single()

    if (error) {
      console.error('예약 수정 오류:', error)
      return NextResponse.json({ 
        error: '예약을 수정할 수 없습니다' 
      }, { status: 500 })
    }

    // 예약 옵션 업데이트 (선택된 옵션이 있는 경우)
    if (selected_options !== undefined && Object.keys(selected_options).length > 0) {
      // 기존 옵션 삭제
      await supabase
        .from('reservation_options')
        .delete()
        .eq('reservation_id', reservationId)

      // 새로운 옵션 추가
      const reservationOptions = Object.entries(selected_options).map(([choice_id, option_id]) => ({
        reservation_id: reservationId,
        choice_id,
        option_id: option_id as string,
        created_at: new Date().toISOString()
      }))

      const { error: optionsError } = await supabase
        .from('reservation_options')
        .insert(reservationOptions)

      if (optionsError) {
        console.error('예약 옵션 업데이트 오류:', optionsError)
        // 옵션 업데이트 실패해도 예약 수정은 성공으로 처리
      }
    }

    return NextResponse.json({ 
      reservation: updatedReservation,
      message: '예약이 성공적으로 수정되었습니다'
    })

  } catch (error) {
    console.error('예약 수정 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다' 
    }, { status: 500 })
  }
}

// 예약 취소/삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reservationId = params.id
    const { searchParams } = new URL(request.url)
    const cancelOnly = searchParams.get('cancel_only') === 'true'

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

    // 기존 예약 확인
    const { data: existingReservation, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single()

    if (fetchError || !existingReservation) {
      return NextResponse.json({ 
        error: '예약을 찾을 수 없습니다' 
      }, { status: 404 })
    }

    if (cancelOnly) {
      // 예약 취소 (상태만 변경)
      const { data: cancelledReservation, error } = await supabase
        .from('reservations')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
          updated_by: user.email
        })
        .eq('id', reservationId)
        .select('*')
        .single()

      if (error) {
        console.error('예약 취소 오류:', error)
        return NextResponse.json({ 
          error: '예약을 취소할 수 없습니다' 
        }, { status: 500 })
      }

      return NextResponse.json({ 
        reservation: cancelledReservation,
        message: '예약이 성공적으로 취소되었습니다'
      })
    } else {
      // 예약 완전 삭제
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservationId)

      if (error) {
        console.error('예약 삭제 오류:', error)
        return NextResponse.json({ 
          error: '예약을 삭제할 수 없습니다' 
        }, { status: 500 })
      }

      return NextResponse.json({ 
        message: '예약이 성공적으로 삭제되었습니다'
      })
    }

  } catch (error) {
    console.error('예약 삭제 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다' 
    }, { status: 500 })
  }
}
