import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generatePickupScheduleEmailContent } from '@/app/api/send-pickup-schedule-notification/route'

/**
 * POST /api/preview-pickup-schedule-notification
 * 
 * 픽업 스케줄 알림 이메일 미리보기 API (발송 없이 내용만 반환)
 * 
 * 요청 본문:
 * {
 *   reservationId: string,
 *   pickupTime: string,
 *   tourDate: string,
 *   locale?: 'ko' | 'en'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[preview-pickup-schedule-notification] 요청 수신')
    const body = await request.json()
    const { reservationId, pickupTime, tourDate, locale = 'ko' } = body

    console.log('[preview-pickup-schedule-notification] 요청 데이터:', { reservationId, pickupTime, tourDate, locale })

    if (!reservationId || !pickupTime || !tourDate) {
      console.error('[preview-pickup-schedule-notification] 필수 파라미터 누락')
      return NextResponse.json(
        { error: '예약 ID, 픽업 시간, 투어 날짜가 필요합니다.' },
        { status: 400 }
      )
    }

    // 예약 정보 조회
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single()

    if (reservationError || !reservation) {
      console.error('[preview-pickup-schedule-notification] 예약 조회 실패:', reservationError)
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다.', details: reservationError?.message },
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
        console.error('[preview-pickup-schedule-notification] 고객 조회 실패:', customerError)
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

    // 상품 정보 별도 조회
    let product = null
    if (reservation.product_id) {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, name, name_ko, name_en, customer_name_ko, customer_name_en')
        .eq('id', reservation.product_id)
        .maybeSingle()

      if (productError) {
        console.error('[preview-pickup-schedule-notification] 상품 조회 실패:', productError)
      } else {
        product = productData
      }
    }

    // 픽업 호텔 정보 별도 조회
    let pickupHotel = null
    if (reservation.pickup_hotel) {
      const { data: hotelData, error: hotelError } = await supabase
        .from('pickup_hotels')
        .select('id, hotel, pick_up_location, address, link, media')
        .eq('id', reservation.pickup_hotel)
        .maybeSingle()

      if (hotelError) {
        console.error('[preview-pickup-schedule-notification] 호텔 조회 실패:', hotelError)
      } else {
        pickupHotel = hotelData
      }
    }

    // 고객 언어에 따라 locale 결정
    const customerLanguage = customer.language?.toLowerCase()
    const isEnglish = locale === 'en' || customerLanguage === 'en' || customerLanguage === 'english' || customerLanguage === '영어'

    // All Pickup Schedule 조회 (같은 tour_id의 모든 예약)
    let allPickups: any[] = []
    if (reservation.tour_id) {
      const { data: allReservations } = await supabase
        .from('reservations')
        .select('id, pickup_hotel, pickup_time, customer_id, total_people, tour_date')
        .eq('tour_id', reservation.tour_id)
        .not('pickup_time', 'is', null)
        .not('pickup_hotel', 'is', null)

      if (allReservations) {
        allPickups = await Promise.all(
          allReservations.map(async (res: any) => {
            const { data: customerInfo } = await supabase
              .from('customers')
              .select('name')
              .eq('id', res.customer_id)
              .maybeSingle()

            const { data: hotelInfo } = await supabase
              .from('pickup_hotels')
              .select('hotel, pick_up_location, address, link')
              .eq('id', res.pickup_hotel)
              .maybeSingle()

            return {
              reservation_id: res.id,
              pickup_time: res.pickup_time || '',
              pickup_hotel: res.pickup_hotel || '',
              hotel_name: hotelInfo?.hotel || 'Unknown Hotel',
              pick_up_location: hotelInfo?.pick_up_location || '',
              address: hotelInfo?.address || '',
              link: hotelInfo?.link || '',
              customer_name: customerInfo?.name || 'Unknown Customer',
              total_people: res.total_people,
              tour_date: res.tour_date
            }
          })
        )
        // 시간순으로 정렬
        allPickups.sort((a, b) => a.pickup_time.localeCompare(b.pickup_time))
      }
    }

    // Tour Details 조회
    let tourDetails: any = null
    if (reservation.tour_id) {
      const { data: tourData } = await supabase
        .from('tours')
        .select('*')
        .eq('id', reservation.tour_id)
        .maybeSingle()

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
    }

    // 이메일 내용 생성
    console.log('[preview-pickup-schedule-notification] 이메일 내용 생성 중...')
    const emailContent = generatePickupScheduleEmailContent(
      reservation,
      customer,
      product,
      pickupHotel,
      pickupTime,
      tourDate,
      isEnglish,
      allPickups,
      tourDetails
    )

    console.log('[preview-pickup-schedule-notification] 이메일 내용 생성 완료')
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
    console.error('[preview-pickup-schedule-notification] 서버 오류:', error)
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: errorMessage },
      { status: 500 }
    )
  }
}

