import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 예약 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      product_id,
      customer_name,
      customer_email,
      customer_phone,
      tour_date,
      departure_time,
      adults,
      children = 0,
      infants = 0,
      total_price,
      special_requests = '',
      nationality = '',
      selected_options = {},
      payment_method = 'pending',
      status = 'confirmed',
      uploaded_file_urls = []
    } = body

    // 필수 필드 검증
    if (!product_id || !customer_name || !customer_email || !customer_phone || !tour_date || !adults || !total_price) {
      return NextResponse.json({ 
        error: '필수 필드가 누락되었습니다' 
      }, { status: 400 })
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

    // 예약 ID 생성
    const reservationId = `reservation_${Date.now()}_${Math.random().toString(36).substring(2)}`

    // 예약 데이터 생성
    const reservationData = {
      id: reservationId,
      product_id,
      customer_name,
      customer_email,
      customer_phone,
      tour_date,
      departure_time: departure_time || null,
      adults: parseInt(adults),
      children: parseInt(children),
      infants: parseInt(infants),
      total_price: parseFloat(total_price),
      special_requests,
      nationality,
      selected_options,
      payment_method,
      status,
      uploaded_file_urls,
      created_by: user.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // 예약 생성
    const { data: newReservation, error } = await supabase
      .from('reservations')
      .insert(reservationData)
      .select('*')
      .single()

    if (error) {
      console.error('예약 생성 오류:', error)
      return NextResponse.json({ 
        error: '예약을 생성할 수 없습니다' 
      }, { status: 500 })
    }

    // 예약 옵션 저장 (선택된 옵션이 있는 경우)
    if (Object.keys(selected_options).length > 0) {
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
        console.error('예약 옵션 저장 오류:', optionsError)
        // 옵션 저장 실패해도 예약은 성공으로 처리
      }
    }

    return NextResponse.json({ 
      reservation: newReservation,
      message: '예약이 성공적으로 생성되었습니다'
    })

  } catch (error) {
    console.error('예약 생성 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다' 
    }, { status: 500 })
  }
}

// 예약 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reservationId = searchParams.get('id')
    const customerEmail = searchParams.get('email')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

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

    let query = supabase
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
          max_participants
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
        )
      `)

    // 특정 예약 조회
    if (reservationId) {
      query = query.eq('id', reservationId)
    }

    // 고객 이메일로 조회
    if (customerEmail) {
      query = query.eq('customer_email', customerEmail)
    }

    // 상태별 조회
    if (status) {
      query = query.eq('status', status)
    }

    // 페이지네이션
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to).order('created_at', { ascending: false })

    const { data: reservations, error } = await query

    if (error) {
      console.error('예약 조회 오류:', error)
      return NextResponse.json({ 
        error: '예약을 조회할 수 없습니다' 
      }, { status: 500 })
    }

    // 총 개수 조회
    let countQuery = supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })

    if (customerEmail) {
      countQuery = countQuery.eq('customer_email', customerEmail)
    }
    if (status) {
      countQuery = countQuery.eq('status', status)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('예약 개수 조회 오류:', countError)
    }

    return NextResponse.json({
      reservations: reservations || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    console.error('예약 조회 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다' 
    }, { status: 500 })
  }
}
