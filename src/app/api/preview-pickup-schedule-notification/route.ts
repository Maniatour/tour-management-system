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
    const { reservationId, pickupTime, tourDate, locale = 'ko', tourId } = body

    console.log('[preview-pickup-schedule-notification] 요청 데이터:', { reservationId, pickupTime, tourDate, locale, tourId })

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

    // reservation_ids 배열 정규화 함수
    const normalizeIds = (value: unknown): string[] => {
      if (!value) return []
      if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(v => v.length > 0)
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            const parsed = JSON.parse(trimmed)
            return Array.isArray(parsed) ? parsed.map((v: unknown) => String(v).trim()).filter((v: string) => v.length > 0) : []
          } catch { return [] }
        }
        if (trimmed.includes(',')) return trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0)
        return trimmed.length > 0 ? [trimmed] : []
      }
      return []
    }

    // Tour Details 조회
    let tourDetails: any = null
    let tourData = null
    
    // tourId가 제공된 경우 직접 조회 (투어 상세 페이지에서 호출한 경우)
    if (tourId) {
      console.log('[preview-pickup-schedule-notification] tourId로 직접 투어 조회:', tourId)
      const { data: tourDataById, error: tourError } = await supabase
        .from('tours')
        .select('*')
        .eq('id', tourId)
        .maybeSingle()

      if (tourError) {
        console.error('[preview-pickup-schedule-notification] 투어 조회 오류:', tourError)
      } else if (tourDataById) {
        // reservation_ids에 현재 예약 ID가 포함되어 있는지 확인
        const reservationIds = normalizeIds(tourDataById.reservation_ids)
        const normalizedReservationId = String(reservationId).trim()
        const found = reservationIds.some(id => String(id).trim() === normalizedReservationId)
        if (found) {
          tourData = tourDataById
          console.log('[preview-pickup-schedule-notification] tourId로 조회된 투어 (reservation_ids 확인됨):', tourData.id)
        } else {
          console.log('[preview-pickup-schedule-notification] tourId로 조회된 투어에 현재 예약 ID가 없음')
          // tourId가 제공되었지만 reservation_ids에 없어도 tourData로 사용 (투어 상세 페이지에서 호출한 경우)
          tourData = tourDataById
          console.log('[preview-pickup-schedule-notification] tourId로 조회된 투어 사용 (reservation_ids 확인 없이):', tourData.id)
        }
      } else {
        console.log('[preview-pickup-schedule-notification] tourId로 조회된 투어가 없음')
      }
    } else {
      // tourId가 없는 경우: reservation_ids에 현재 예약 ID가 포함된 투어 찾기
      console.log('[preview-pickup-schedule-notification] reservation_ids로 투어 조회 시작:', {
        reservationId,
        product_id: reservation.product_id,
        tour_date: tourDate
      })
      
      // product_id와 tour_date로 먼저 필터링한 후, reservation_ids 배열에서 확인
      if (reservation.product_id && tourDate) {
        const { data: toursByProduct, error: tourError } = await supabase
          .from('tours')
          .select('*')
          .eq('product_id', reservation.product_id)
          .eq('tour_date', tourDate)

        if (tourError) {
          console.error('[preview-pickup-schedule-notification] 투어 조회 오류:', tourError)
        } else if (toursByProduct && toursByProduct.length > 0) {
          console.log('[preview-pickup-schedule-notification] 조회된 투어 개수:', toursByProduct.length)
          // reservation_ids 배열에 예약 ID가 포함된 투어 찾기
          const normalizedReservationId = String(reservationId).trim()
          console.log('[preview-pickup-schedule-notification] 검색할 예약 ID:', normalizedReservationId)
          
          for (const tour of toursByProduct) {
            const reservationIds = normalizeIds((tour as any).reservation_ids)
            console.log('[preview-pickup-schedule-notification] 투어 ID:', tour.id, 'reservation_ids:', reservationIds, '원본:', (tour as any).reservation_ids)
            
            // 정규화된 ID로 비교 (문자열로 변환하여 비교)
            const found = reservationIds.some(id => String(id).trim() === normalizedReservationId)
            if (found) {
              tourData = tour
              console.log('[preview-pickup-schedule-notification] reservation_ids로 조회된 투어:', tourData.id)
              break
            }
          }

          if (!tourData) {
            console.log('[preview-pickup-schedule-notification] reservation_ids에 예약 ID가 포함된 투어를 찾지 못함')
            console.log('[preview-pickup-schedule-notification] 검색한 예약 ID:', normalizedReservationId)
            console.log('[preview-pickup-schedule-notification] 조회된 투어들의 reservation_ids:', toursByProduct.map(t => ({ id: t.id, reservation_ids: (t as any).reservation_ids })))
          }
        } else {
          console.log('[preview-pickup-schedule-notification] product_id/tour_date로 조회된 투어가 없음')
        }
      }
    }

    // All Pickup Schedule 조회
    let allPickups: any[] = []
    
    if (tourData && tourData.reservation_ids) {
      // tourData를 찾은 경우: tourData의 reservation_ids로 조회
      console.log('[preview-pickup-schedule-notification] tourData를 찾았으므로 reservation_ids로 모든 픽업 스케줄 조회')
      const reservationIds = normalizeIds(tourData.reservation_ids)
      console.log('[preview-pickup-schedule-notification] 조회할 reservation_ids:', reservationIds)
      
      if (reservationIds.length > 0) {
        // reservation_ids에 포함된 예약만 조회 (취소된 예약 제외)
        const { data: allReservations, error: allReservationsError } = await supabase
          .from('reservations')
          .select('id, pickup_hotel, pickup_time, customer_id, total_people, tour_date, status')
          .in('id', reservationIds)
          .not('pickup_time', 'is', null)
          .not('pickup_hotel', 'is', null)
          .neq('status', 'cancelled')

        if (allReservationsError) {
          console.error('[preview-pickup-schedule-notification] 예약 조회 오류:', allReservationsError)
        } else if (allReservations && allReservations.length > 0) {
          console.log('[preview-pickup-schedule-notification] 조회된 예약 개수:', allReservations.length)
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
        } else {
          console.log('[preview-pickup-schedule-notification] reservation_ids에 해당하는 예약이 없음')
        }
      } else {
        console.log('[preview-pickup-schedule-notification] reservation_ids가 비어있음')
      }
    } else if (reservation.product_id && tourDate) {
      // tourData를 찾지 못한 경우: product_id와 tour_date로 fallback 조회
      console.log('[preview-pickup-schedule-notification] tourData를 찾지 못했으므로 product_id와 tour_date로 모든 픽업 스케줄 조회 (fallback)')
      const { data: allReservations, error: allReservationsError } = await supabase
        .from('reservations')
        .select('id, pickup_hotel, pickup_time, customer_id, total_people, tour_date, status')
        .eq('product_id', reservation.product_id)
        .eq('tour_date', tourDate)
        .not('pickup_time', 'is', null)
        .not('pickup_hotel', 'is', null)
        .neq('status', 'cancelled')

      if (allReservationsError) {
        console.error('[preview-pickup-schedule-notification] 예약 조회 오류 (fallback):', allReservationsError)
      } else if (allReservations && allReservations.length > 0) {
        console.log('[preview-pickup-schedule-notification] 조회된 예약 개수 (fallback):', allReservations.length)
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
      } else {
        console.log('[preview-pickup-schedule-notification] product_id/tour_date로 조회된 예약이 없음 (fallback)')
      }
    } else {
      console.log('[preview-pickup-schedule-notification] tourData를 찾지 못했고 product_id/tour_date도 없어서 모든 픽업 스케줄을 조회할 수 없음')
    }
    
    // 같은 시간과 같은 호텔을 가진 항목 중복 제거 및 정렬
    if (allPickups.length > 0) {
      // 같은 시간과 같은 호텔을 가진 항목 중복 제거 (정렬 전에 먼저 제거)
      const uniquePickups = new Map<string, any>()
      allPickups.forEach(pickup => {
        // 시간을 정규화 (HH:MM 형식으로 통일)
        const normalizedTime = pickup.pickup_time ? pickup.pickup_time.substring(0, 5) : ''
        // 호텔 이름으로 중복 확인 (같은 호텔이지만 ID가 다를 수 있으므로 이름으로 비교)
        const key = `${normalizedTime}-${pickup.hotel_name}`
        if (!uniquePickups.has(key)) {
          uniquePickups.set(key, pickup)
        }
      })
      allPickups = Array.from(uniquePickups.values())
      
      // 오후 9시(21:00) 이후 시간은 전날로 취급하여 정렬
      allPickups.sort((a, b) => {
        const parseTime = (time: string) => {
          if (!time) return 0
          const [hours, minutes] = time.split(':').map(Number)
          return hours * 60 + (minutes || 0)
        }
        
        const parseDate = (dateStr: string) => {
          const [year, month, day] = dateStr.split('-').map(Number)
          return new Date(year, month - 1, day)
        }
        
        const timeA = parseTime(a.pickup_time)
        const timeB = parseTime(b.pickup_time)
        const referenceTime = 21 * 60 // 오후 9시 (21:00) = 1260분
        
        // 오후 9시 이후 시간은 전날로 취급
        let dateA = parseDate(a.tour_date || tourDate)
        let dateB = parseDate(b.tour_date || tourDate)
        
        if (timeA >= referenceTime) {
          dateA = new Date(dateA)
          dateA.setDate(dateA.getDate() - 1)
        }
        if (timeB >= referenceTime) {
          dateB = new Date(dateB)
          dateB.setDate(dateB.getDate() - 1)
        }
        
        // 날짜와 시간을 함께 고려하여 정렬
        const dateTimeA = dateA.getTime() + timeA * 60 * 1000
        const dateTimeB = dateB.getTime() + timeB * 60 * 1000
        
        return dateTimeA - dateTimeB
      })
      
      console.log('[preview-pickup-schedule-notification] 모든 픽업 스케줄 조회 완료:', allPickups.length, '건')
    } else {
      console.log('[preview-pickup-schedule-notification] 모든 픽업 스케줄이 없음')
    }

    // Tour Details 조회
    if (tourData) {
      console.log('[preview-pickup-schedule-notification] 투어 데이터:', {
        id: tourData.id,
        tour_guide_id: tourData.tour_guide_id,
        assistant_id: tourData.assistant_id,
        tour_car_id: tourData.tour_car_id
      })
      
      let tourGuideInfo = null
      let assistantInfo = null
      let vehicleInfo = null

      if (tourData.tour_guide_id) {
        console.log('[preview-pickup-schedule-notification] 가이드 조회:', tourData.tour_guide_id)
        const { data: guideData, error: guideError } = await supabase
          .from('team')
          .select('name_ko, name_en, phone, email, languages')
          .eq('email', tourData.tour_guide_id)
          .maybeSingle()
        
        if (guideError) {
          console.error('[preview-pickup-schedule-notification] 가이드 조회 오류:', guideError)
        } else {
          tourGuideInfo = guideData
          console.log('[preview-pickup-schedule-notification] 가이드 정보:', tourGuideInfo ? '있음' : '없음')
        }
      }

      if (tourData.assistant_id) {
        console.log('[preview-pickup-schedule-notification] 어시스턴트 조회:', tourData.assistant_id)
        const { data: assistantData, error: assistantError } = await supabase
          .from('team')
          .select('name_ko, name_en, phone, email')
          .eq('email', tourData.assistant_id)
          .maybeSingle()
        
        if (assistantError) {
          console.error('[preview-pickup-schedule-notification] 어시스턴트 조회 오류:', assistantError)
        } else {
          assistantInfo = assistantData
          console.log('[preview-pickup-schedule-notification] 어시스턴트 정보:', assistantInfo ? '있음' : '없음')
        }
      }

      if (tourData.tour_car_id) {
        console.log('[preview-pickup-schedule-notification] 차량 조회:', tourData.tour_car_id)
        const { data: vehicleData, error: vehicleError } = await supabase
          .from('vehicles')
          .select('vehicle_type, capacity, color')
          .eq('id', tourData.tour_car_id)
          .maybeSingle()

        if (vehicleError) {
          console.error('[preview-pickup-schedule-notification] 차량 조회 오류:', vehicleError)
        } else if (vehicleData?.vehicle_type) {
          const { data: vehicleTypeData, error: vehicleTypeError } = await supabase
            .from('vehicle_types')
            .select('id, name, brand, model, passenger_capacity, description')
            .eq('name', vehicleData.vehicle_type)
            .maybeSingle()

          if (vehicleTypeError) {
            console.error('[preview-pickup-schedule-notification] 차량 타입 조회 오류:', vehicleTypeError)
          }

          const { data: photosData, error: photosError } = await supabase
            .from('vehicle_type_photos')
            .select('photo_url, photo_name, description, is_primary, display_order')
            .eq('vehicle_type_id', vehicleTypeData?.id || '')
            .order('display_order', { ascending: true })
            .order('is_primary', { ascending: false })

          if (photosError) {
            console.error('[preview-pickup-schedule-notification] 차량 사진 조회 오류:', photosError)
          }

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
          console.log('[preview-pickup-schedule-notification] 차량 정보:', vehicleInfo ? '있음' : '없음')
        }
      }

      tourDetails = {
        ...tourData,
        tour_guide: tourGuideInfo,
        assistant: assistantInfo,
        vehicle: vehicleInfo
      }
      
      console.log('[preview-pickup-schedule-notification] 최종 tourDetails:', {
        hasTourGuide: !!tourDetails.tour_guide,
        hasAssistant: !!tourDetails.assistant,
        hasVehicle: !!tourDetails.vehicle
      })
    } else {
      console.log('[preview-pickup-schedule-notification] 투어 데이터를 찾을 수 없음 - tourDetails는 null로 유지')
    }

    // Chat Room 정보 조회 - tourData가 있으면 tour_id로 조회
    let chatRoomCode: string | null = null
    if (tourData && tourData.id) {
      console.log('[preview-pickup-schedule-notification] 채팅방 조회 시작 (tour_id):', tourData.id)
      const { data: chatRoomData, error: chatRoomError } = await supabase
        .from('chat_rooms')
        .select('room_code')
        .eq('tour_id', tourData.id)
        .eq('is_active', true)
        .maybeSingle()

      if (chatRoomError) {
        console.error('[preview-pickup-schedule-notification] 채팅방 조회 오류:', chatRoomError)
      } else if (chatRoomData) {
        chatRoomCode = chatRoomData.room_code
        console.log('[preview-pickup-schedule-notification] 채팅방 코드 조회 성공:', chatRoomCode)
      } else {
        console.log('[preview-pickup-schedule-notification] 채팅방을 찾을 수 없음 (tour_id:', tourData.id, ')')
      }
    } else {
      console.log('[preview-pickup-schedule-notification] tourData가 없어서 채팅방을 조회할 수 없음')
    }
    
    if (!chatRoomCode) {
      console.log('[preview-pickup-schedule-notification] 최종 채팅방 코드: 없음')
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
      tourDetails,
      chatRoomCode
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

