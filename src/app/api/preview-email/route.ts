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
    const languageCode = isEnglish ? 'en' : 'ko'

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

    // 가격 정보 조회
    let pricing = null
    const { data: pricingData } = await supabase
      .from('reservation_pricing')
      .select('*')
      .eq('reservation_id', reservationId)
      .maybeSingle()
    pricing = pricingData

    // 상품 상세 정보 조회 (multilingual)
    let productDetails = null
    if (reservation.channel_id) {
      const { data: channelDetails } = await supabase
        .from('product_details_multilingual')
        .select('*')
        .eq('product_id', reservation.product_id)
        .eq('language_code', languageCode)
        .eq('channel_id', reservation.channel_id)
        .maybeSingle()
      productDetails = channelDetails
    }
    
    if (!productDetails) {
      const { data: commonDetails } = await supabase
        .from('product_details_multilingual')
        .select('*')
        .eq('product_id', reservation.product_id)
        .eq('language_code', languageCode)
        .is('channel_id', null)
        .maybeSingle()
      productDetails = commonDetails
    }

    // 투어 스케줄 조회
    let productSchedules = null
    const { data: schedulesData } = await supabase
      .from('product_schedules')
      .select('id, day_number, start_time, end_time, title_ko, title_en, description_ko, description_en, show_to_customers, order_index')
      .eq('product_id', reservation.product_id)
      .eq('show_to_customers', true)
      .order('day_number', { ascending: true })
      .order('order_index', { ascending: true })
    productSchedules = schedulesData || []

    // 투어 상태 조회 및 Tour Details 조회
    let tourStatus = null
    let tourDetails: any = null
    if (reservation.tour_id) {
      const { data: tourData } = await supabase
        .from('tours')
        .select('*')
        .eq('id', reservation.tour_id)
        .maybeSingle()
      
      tourStatus = tourData?.tour_status || tourData?.status || reservation.status

      // Tour Details 조회 (가이드, 어시스턴트, 차량 정보)
      if (tourData) {
        let tourGuideInfo = null
        let assistantInfo = null
        let vehicleInfo = null

        if (tourData.tour_guide_id) {
          const { data: guideData } = await supabase
            .from('team')
            .select('name_ko, name_en, phone, email, languages')
            .eq('email', tourData.tour_guide_id)
            .maybeSingle()
          tourGuideInfo = guideData
        }

        if (tourData.assistant_id) {
          const { data: assistantData } = await supabase
            .from('team')
            .select('name_ko, name_en, phone, email')
            .eq('email', tourData.assistant_id)
            .maybeSingle()
          assistantInfo = assistantData
        }

        if (tourData.tour_car_id) {
          const { data: vehicleData } = await supabase
            .from('vehicles')
            .select('vehicle_type, capacity, color')
            .eq('id', tourData.tour_car_id)
            .maybeSingle()

          if (vehicleData?.vehicle_type) {
            const { data: vehicleTypeData } = await supabase
              .from('vehicle_types')
              .select('id, name, brand, model, passenger_capacity, description')
              .eq('name', vehicleData.vehicle_type)
              .maybeSingle()

            const { data: photosData } = await supabase
              .from('vehicle_type_photos')
              .select('photo_url, photo_name, description, is_primary, display_order')
              .eq('vehicle_type_id', vehicleTypeData?.id || '')
              .order('display_order', { ascending: true })
              .order('is_primary', { ascending: false })

            vehicleInfo = {
              vehicle_type: vehicleData.vehicle_type,
              color: vehicleData.color,
              vehicle_type_info: vehicleTypeData ? {
                name: vehicleTypeData.name,
                brand: vehicleTypeData.brand,
                model: vehicleTypeData.model,
                passenger_capacity: vehicleTypeData.passenger_capacity || vehicleData.capacity,
                description: vehicleTypeData.description
              } : {
                name: vehicleData.vehicle_type,
                passenger_capacity: vehicleData.capacity
              },
              vehicle_type_photos: photosData || []
            }
          }
        }

        tourDetails = {
          ...tourData,
          tour_guide: tourGuideInfo,
          assistant: assistantInfo,
          vehicle: vehicleInfo
        }
      }
    } else {
      tourStatus = reservation.status
    }

    // 이메일 내용 생성
    const isDepartureConfirmation = type === 'voucher'
    let emailContent
    try {
      emailContent = generateEmailContent(
        reservationForEmail,
        customer,
        product as any,
        pricing,
        productDetails,
        productSchedules,
        tourStatus,
        tourDetails,
        type,
        isEnglish,
        isDepartureConfirmation
      )
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


