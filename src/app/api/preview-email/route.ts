import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateEmailContent } from '@/app/api/send-email/route'

/**
 * POST /api/preview-email
 * 
 * 예약 확인 이메일 미리보기 API (발송 없이 내용만 반환)
 * 
 * 요청 본문:
 * {
 *   reservationId: string,
 *   type: 'receipt' | 'voucher' | 'both',
 *   locale?: 'ko' | 'en'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[preview-email] 요청 수신')
    const body = await request.json()
    const { reservationId, type = 'both', locale = 'ko' } = body

    console.log('[preview-email] 요청 데이터:', { reservationId, type, locale })

    if (!reservationId) {
      console.error('[preview-email] 예약 ID 누락')
      return NextResponse.json(
        { error: '예약 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 예약 정보 조회 (관계 쿼리 대신 별도 조회로 변경)
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single()

    if (reservationError || !reservation) {
      console.error('[preview-email] 예약 조회 실패:', reservationError)
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다.', details: reservationError?.message },
        { status: 404 }
      )
    }

    console.log('[preview-email] 예약 조회 성공:', reservation.id)

    // 상품 정보 별도 조회
    let product = null
    if (reservation.product_id) {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, name, name_ko, name_en, customer_name_ko, customer_name_en, duration, departure_city, arrival_city')
        .eq('id', reservation.product_id)
        .maybeSingle()

      if (productError) {
        console.error('[preview-email] 상품 조회 실패:', productError)
      } else {
        product = productData
      }
    }

    if (!product) {
      console.error('[preview-email] 상품 정보 없음')
      return NextResponse.json(
        { error: '상품 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 고객 정보 별도 조회
    let customer = null
    if (reservation.customer_id) {
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, name, email, language')
        .eq('id', reservation.customer_id)
        .maybeSingle()

      if (customerError) {
        console.error('[preview-email] 고객 조회 실패:', customerError)
      } else {
        customer = customerData
      }
    }

    if (!customer) {
      return NextResponse.json(
        { error: '고객 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const customerLanguage = customer.language?.toLowerCase()
    const isEnglish = locale === 'en' || customerLanguage === 'en' || customerLanguage === 'english' || customerLanguage === '영어'

    console.log('[preview-email] 이메일 내용 생성 중...', { customerLanguage, isEnglish, type })
    console.log('[preview-email] 예약 데이터:', JSON.stringify(reservation, null, 2))
    console.log('[preview-email] 상품 데이터:', JSON.stringify(product, null, 2))

    // reservation 객체에 필요한 필드 추가 (generateEmailContent가 필요로 함)
    // 데이터베이스 스키마: adults, child, infant (단수형)
    // generateEmailContent 기대: adults, children, infants (복수형)
    const reservationForEmail = {
      ...reservation,
      customer_name: customer.name,
      // 인원 필드 매핑 (child → children, infant → infants)
      adults: reservation.adults ?? 0,
      children: reservation.child ?? reservation.children ?? 0,
      infants: reservation.infant ?? reservation.infants ?? 0,
      // total_price는 reservation_pricing 테이블에 있을 수 있으므로 일단 0으로 설정
      // 실제로는 reservation_pricing에서 가져와야 할 수도 있음
      total_price: reservation.total_price ?? 0
    }

    // 이메일 내용 생성 (product를 객체로 전달)
    let emailContent
    try {
      emailContent = generateEmailContent(reservationForEmail, product as any, type, isEnglish)
      console.log('[preview-email] 이메일 내용 생성 완료')
    } catch (genError) {
      console.error('[preview-email] 이메일 내용 생성 오류:', genError)
      console.error('[preview-email] 오류 상세:', genError instanceof Error ? genError.stack : genError)
      throw genError
    }

    return NextResponse.json({
      success: true,
      emailContent: {
        ...emailContent,
        customer: {
          name: customer.name,
          email: customer.email,
          language: customer.language
        }
      }
    })

  } catch (error) {
    console.error('[preview-email] 서버 오류:', error)
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: errorMessage },
      { status: 500 }
    )
  }
}


