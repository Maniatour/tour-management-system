import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Resend } from 'resend'

/**
 * POST /api/send-pickup-schedule-notification
 * 
 * 픽업 스케줄 확정 알림 이메일 발송 API
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
    const body = await request.json()
    const { reservationId, pickupTime, tourDate, locale = 'ko', sentBy } = body

    if (!reservationId || !pickupTime || !tourDate) {
      return NextResponse.json(
        { error: '예약 ID, 픽업 시간, 투어 날짜가 필요합니다.' },
        { status: 400 }
      )
    }

    // 예약 정보 조회
    console.log('[send-pickup-schedule-notification] 예약 조회 시작:', { reservationId })
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single()

    if (reservationError) {
      console.error('[send-pickup-schedule-notification] 예약 조회 오류:', reservationError)
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다.', details: reservationError.message },
        { status: 404 }
      )
    }

    if (!reservation) {
      console.error('[send-pickup-schedule-notification] 예약을 찾을 수 없음:', reservationId)
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    console.log('[send-pickup-schedule-notification] 예약 조회 성공:', { 
      reservationId: reservation.id,
      customerId: reservation.customer_id,
      productId: reservation.product_id,
      pickupHotel: reservation.pickup_hotel
    })

    // 고객 정보 별도 조회
    let customer = null
    if (reservation.customer_id) {
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, name, email, language')
        .eq('id', reservation.customer_id)
        .single()

      if (customerError) {
        console.error('[send-pickup-schedule-notification] 고객 조회 오류:', customerError)
      } else {
        customer = customerData
      }
    }

    // 상품 정보 별도 조회
    let product = null
    if (reservation.product_id) {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, name, name_ko, name_en, customer_name_ko, customer_name_en')
        .eq('id', reservation.product_id)
        .single()

      if (productError) {
        console.error('[send-pickup-schedule-notification] 상품 조회 오류:', productError)
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
        .single()

      if (hotelError) {
        console.error('[send-pickup-schedule-notification] 픽업 호텔 조회 오류:', hotelError)
      } else {
        pickupHotel = hotelData
      }
    }

    if (!customer) {
      console.error('[send-pickup-schedule-notification] 고객 정보 없음:', { 
        reservationId, 
        customerId: reservation.customer_id 
      })
      return NextResponse.json(
        { error: '고객 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (!customer.email) {
      console.error('[send-pickup-schedule-notification] 고객 이메일 없음:', { 
        reservationId, 
        customerId: reservation.customer_id,
        customerName: customer.name
      })
      return NextResponse.json(
        { error: '고객 이메일을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 고객 언어에 따라 locale 결정
    const customerLanguage = customer.language?.toLowerCase()
    const isEnglish = locale === 'en' || customerLanguage === 'en' || customerLanguage === 'english' || customerLanguage === '영어'

    // All Pickup Schedule 조회 (tours 테이블의 reservation_ids에 포함된 예약만)
    let allPickups: any[] = []
    if (reservation.tour_id) {
      // tours 테이블에서 reservation_ids 가져오기
      const { data: tourData } = await supabase
        .from('tours')
        .select('reservation_ids')
        .eq('id', reservation.tour_id)
        .maybeSingle()

      if (!tourData || !tourData.reservation_ids || !Array.isArray(tourData.reservation_ids) || tourData.reservation_ids.length === 0) {
        // reservation_ids가 없으면 빈 배열 반환
        allPickups = []
      } else {
        // reservation_ids에 포함된 예약만 조회 (취소된 예약 제외)
        const { data: allReservations } = await supabase
          .from('reservations')
          .select('id, pickup_hotel, pickup_time, customer_id, total_people, tour_date, status')
          .in('id', tourData.reservation_ids)
          .not('pickup_time', 'is', null)
          .not('pickup_hotel', 'is', null)
          .neq('status', 'cancelled')

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
        }
      }
    }

    // Tour Details 조회
    let tourDetails: any = null
    let tourData = null
    
    // 먼저 reservation.tour_id로 조회 시도
    if (reservation.tour_id) {
      console.log('[send-pickup-schedule-notification] tour_id로 투어 조회:', reservation.tour_id)
      const { data: tourDataById, error: tourError } = await supabase
        .from('tours')
        .select('*')
        .eq('id', reservation.tour_id)
        .maybeSingle()

      if (tourError) {
        console.error('[send-pickup-schedule-notification] 투어 조회 오류:', tourError)
      } else {
        tourData = tourDataById
        console.log('[send-pickup-schedule-notification] tour_id로 조회된 투어:', tourData ? '있음' : '없음')
      }
    }
    
    // tour_id가 없거나 조회 실패 시, reservation_ids 배열에 예약 ID가 포함된 투어 찾기
    if (!tourData && reservation.product_id && tourDate) {
      console.log('[send-pickup-schedule-notification] reservation_ids로 투어 조회 시도:', {
        reservationId,
        product_id: reservation.product_id,
        tour_date: tourDate
      })
      
      // product_id와 tour_date로 먼저 필터링한 후, reservation_ids 배열에서 확인
      const { data: toursByProduct, error: tourError } = await supabase
        .from('tours')
        .select('*')
        .eq('product_id', reservation.product_id)
        .eq('tour_date', tourDate)

      if (tourError) {
        console.error('[send-pickup-schedule-notification] 투어 조회 오류:', tourError)
      } else if (toursByProduct && toursByProduct.length > 0) {
        // reservation_ids 배열에 예약 ID가 포함된 투어 찾기
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

        // reservation_ids 배열에 예약 ID가 포함된 투어 찾기
        for (const tour of toursByProduct) {
          const reservationIds = normalizeIds((tour as any).reservation_ids)
          if (reservationIds.includes(reservationId)) {
            tourData = tour
            console.log('[send-pickup-schedule-notification] reservation_ids로 조회된 투어:', tourData.id)
            break
          }
        }

        if (!tourData) {
          console.log('[send-pickup-schedule-notification] reservation_ids에 예약 ID가 포함된 투어를 찾지 못함')
        }
      } else {
        console.log('[send-pickup-schedule-notification] product_id/tour_date로 조회된 투어가 없음')
      }
    }

    if (tourData) {
      console.log('[send-pickup-schedule-notification] 투어 데이터:', {
        id: tourData.id,
        tour_guide_id: tourData.tour_guide_id,
        assistant_id: tourData.assistant_id,
        tour_car_id: tourData.tour_car_id
      })
      
      let tourGuideInfo = null
      let assistantInfo = null
      let vehicleInfo = null

      if (tourData.tour_guide_id) {
        console.log('[send-pickup-schedule-notification] 가이드 조회:', tourData.tour_guide_id)
        const { data: guideData, error: guideError } = await supabase
          .from('team')
          .select('name_ko, name_en, phone, email, languages')
          .eq('email', tourData.tour_guide_id)
          .maybeSingle()
        
        if (guideError) {
          console.error('[send-pickup-schedule-notification] 가이드 조회 오류:', guideError)
        } else {
          tourGuideInfo = guideData
          console.log('[send-pickup-schedule-notification] 가이드 정보:', tourGuideInfo ? '있음' : '없음')
        }
      }

      if (tourData.assistant_id) {
        console.log('[send-pickup-schedule-notification] 어시스턴트 조회:', tourData.assistant_id)
        const { data: assistantData, error: assistantError } = await supabase
          .from('team')
          .select('name_ko, name_en, phone, email')
          .eq('email', tourData.assistant_id)
          .maybeSingle()
        
        if (assistantError) {
          console.error('[send-pickup-schedule-notification] 어시스턴트 조회 오류:', assistantError)
        } else {
          assistantInfo = assistantData
          console.log('[send-pickup-schedule-notification] 어시스턴트 정보:', assistantInfo ? '있음' : '없음')
        }
      }

      if (tourData.tour_car_id) {
        console.log('[send-pickup-schedule-notification] 차량 조회:', tourData.tour_car_id)
        const { data: vehicleData, error: vehicleError } = await supabase
          .from('vehicles')
          .select('vehicle_type, capacity, color')
          .eq('id', tourData.tour_car_id)
          .maybeSingle()

        if (vehicleError) {
          console.error('[send-pickup-schedule-notification] 차량 조회 오류:', vehicleError)
        } else if (vehicleData?.vehicle_type) {
          const { data: vehicleTypeData, error: vehicleTypeError } = await supabase
            .from('vehicle_types')
            .select('id, name, brand, model, passenger_capacity, description')
            .eq('name', vehicleData.vehicle_type)
            .maybeSingle()

          if (vehicleTypeError) {
            console.error('[send-pickup-schedule-notification] 차량 타입 조회 오류:', vehicleTypeError)
          }

          const { data: photosData, error: photosError } = await supabase
            .from('vehicle_type_photos')
            .select('photo_url, photo_name, description, is_primary, display_order')
            .eq('vehicle_type_id', vehicleTypeData?.id || '')
            .order('display_order', { ascending: true })
            .order('is_primary', { ascending: false })

          if (photosError) {
            console.error('[send-pickup-schedule-notification] 차량 사진 조회 오류:', photosError)
          }

          // 차량 사진 URL 처리: base64 이미지는 제외하고, 상대 경로는 공개 URL로 변환
          const processedPhotos = (photosData || []).map((photo: any) => {
            // base64 이미지는 이메일에서 표시되지 않으므로 제외
            if (photo.photo_url && photo.photo_url.startsWith('data:image')) {
              console.log('[send-pickup-schedule-notification] base64 이미지 제외:', photo.photo_name)
              return null
            }

            // photo_url이 상대 경로인 경우 Supabase Storage 공개 URL로 변환
            if (photo.photo_url && !photo.photo_url.startsWith('http') && !photo.photo_url.startsWith('data:')) {
              try {
                // vehicle-type-photos 버킷에서 공개 URL 생성 시도
                if (photo.photo_url.includes('vehicle-type-photos') || photo.photo_url.startsWith('vehicle-type-photos/')) {
                  const path = photo.photo_url.replace('vehicle-type-photos/', '').replace(/^vehicle-type-photos/, '')
                  const { data: { publicUrl } } = supabase.storage
                    .from('vehicle-type-photos')
                    .getPublicUrl(path)
                  return { ...photo, photo_url: publicUrl }
                } else {
                  // 다른 버킷일 수 있으므로 images 버킷으로 시도
                  const { data: { publicUrl } } = supabase.storage
                    .from('images')
                    .getPublicUrl(photo.photo_url)
                  return { ...photo, photo_url: publicUrl }
                }
              } catch (error) {
                console.error('[send-pickup-schedule-notification] 공개 URL 생성 오류:', error)
                return photo // 원본 URL 유지
              }
            }

            return photo
          }).filter((photo: any) => photo !== null) // null 제거

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
            vehicle_type_photos: processedPhotos
          }
          console.log('[send-pickup-schedule-notification] 차량 정보:', vehicleInfo ? '있음' : '없음')
        }
      }

      tourDetails = {
        ...tourData,
        tour_guide: tourGuideInfo,
        assistant: assistantInfo,
        vehicle: vehicleInfo
      }
      
      console.log('[send-pickup-schedule-notification] 최종 tourDetails:', {
        hasTourGuide: !!tourDetails.tour_guide,
        hasAssistant: !!tourDetails.assistant,
        hasVehicle: !!tourDetails.vehicle
      })
    } else {
      console.log('[send-pickup-schedule-notification] 투어 데이터를 찾을 수 없음')
    }

    // Chat Room 정보 조회
    let chatRoomCode: string | null = null
    if (reservation.tour_id) {
      const { data: chatRoomData } = await supabase
        .from('chat_rooms')
        .select('room_code')
        .eq('tour_id', reservation.tour_id)
        .eq('is_active', true)
        .maybeSingle()

      if (chatRoomData) {
        chatRoomCode = chatRoomData.room_code
      }
    }

    // 이메일 내용 생성
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

    // Resend를 사용한 이메일 발송
    const resendApiKey = process.env.RESEND_API_KEY
    const isDevelopment = process.env.NODE_ENV === 'development'
    const skipEmailInDev = process.env.SKIP_EMAIL_IN_DEV === 'true'
    
    // 환경 변수 상세 디버깅
    const allResendKeys = Object.keys(process.env).filter(key => 
      key.toUpperCase().includes('RESEND') || key.toLowerCase().includes('resend')
    )
    
    if (!resendApiKey) {
      console.error('[send-pickup-schedule-notification] RESEND_API_KEY 환경 변수가 설정되지 않았습니다.')
      console.error('[send-pickup-schedule-notification] 환경 변수 확인:', {
        hasResendApiKey: !!process.env.RESEND_API_KEY,
        nodeEnv: process.env.NODE_ENV,
        skipEmailInDev,
        allResendKeys,
        resendKeysDetails: allResendKeys.map(key => ({
          key,
          exists: !!process.env[key],
          hasValue: !!(process.env[key] && process.env[key]!.trim().length > 0),
          length: process.env[key]?.length || 0
        })),
        // 모든 환경 변수 키 목록 (디버깅용, 처음 50개만)
        sampleEnvKeys: Object.keys(process.env).slice(0, 50)
      })
      
      // 개발 환경에서 이메일 발송을 건너뛰는 옵션이 활성화되어 있으면 성공으로 처리
      if (isDevelopment && skipEmailInDev) {
        console.log('[send-pickup-schedule-notification] 개발 환경에서 이메일 발송 건너뛰기 (SKIP_EMAIL_IN_DEV=true)')
        
        // 예약 상태만 업데이트
        try {
          await supabase
            .from('reservations')
            .update({ pickup_notification_sent: true })
            .eq('id', reservationId)
        } catch (error) {
          console.error('pickup_notification_sent 업데이트 오류:', error)
        }
        
        return NextResponse.json({
          success: true,
          message: '개발 환경: 이메일 발송이 건너뛰어졌습니다. (RESEND_API_KEY 미설정)',
          skipped: true
        })
      }
      
      return NextResponse.json(
        { 
          error: '이메일 서비스 설정 오류입니다. RESEND_API_KEY 환경 변수가 설정되지 않았습니다.',
          details: '개발 환경에서는 .env.local 파일에 RESEND_API_KEY를 설정하거나, SKIP_EMAIL_IN_DEV=true로 설정하여 이메일 발송을 건너뛸 수 있습니다.'
        },
        { status: 500 }
      )
    }

    const resend = new Resend(resendApiKey)
    // RESEND_FROM_EMAIL이 설정되어 있으면 사용, 없으면 기본값 사용
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@maniatour.com'
    
    console.log('[send-pickup-schedule-notification] 발신자 이메일:', {
      fromEmail,
      isDevelopment,
      hasConfiguredEmail: !!process.env.RESEND_FROM_EMAIL
    })
    
    console.log('[send-pickup-schedule-notification] 이메일 발송 준비:', {
      fromEmail,
      to: customer.email,
      hasApiKey: !!resendApiKey,
      apiKeyLength: resendApiKey?.length || 0,
      subject: emailContent.subject,
      htmlLength: emailContent.html?.length || 0
    })

    try {
      console.log('[send-pickup-schedule-notification] Resend API 호출 시작...')
      const { data: emailResult, error: emailError } = await resend.emails.send({
        from: fromEmail,
        to: customer.email,
        subject: emailContent.subject,
        html: emailContent.html,
        // 읽음 추적 활성화
        open_tracking: true,
        click_tracking: true,
      })

      if (emailError) {
        console.error('[send-pickup-schedule-notification] Resend 이메일 발송 오류:', emailError)
        console.error('[send-pickup-schedule-notification] Resend 에러 상세:', {
          message: emailError.message,
          name: emailError.name,
          statusCode: (emailError as any).statusCode,
          response: (emailError as any).response,
          fromEmail,
          to: customer.email
        })
        
        // 도메인 인증 오류인 경우 더 자세한 안내 제공
        const errorMessage = emailError.message || 'Resend API 오류'
        let details = errorMessage
        let suggestion = ''
        
        if (errorMessage.includes('domain is not verified') || errorMessage.includes('domain')) {
          suggestion = `도메인 인증이 필요합니다. Resend 대시보드(https://resend.com/domains)에서 다음을 확인하세요:
1. ${fromEmail.split('@')[1]} 도메인이 추가되어 있는지 확인
2. DNS 레코드(DKIM, SPF, MX)가 모두 "Verified" 상태인지 확인
3. DNS 전파가 완료되었는지 확인 (1-2시간 소요 가능)
4. 서브도메인(${fromEmail.split('@')[1]})을 사용하는 경우, 해당 서브도메인을 별도로 추가해야 할 수 있습니다.`
        }
        
        return NextResponse.json(
          { 
            error: '이메일 발송에 실패했습니다.', 
            details,
            suggestion,
            errorType: emailError.name || 'ResendError',
            fromEmail,
            domain: fromEmail.split('@')[1]
          },
          { status: 500 }
        )
      }
      
      console.log('[send-pickup-schedule-notification] Resend API 호출 성공:', {
        emailId: emailResult?.id,
        to: customer.email
      })

      console.log('[send-pickup-schedule-notification] 픽업 스케줄 알림 이메일 발송 성공:', {
        to: customer.email,
        subject: emailContent.subject,
        reservationId,
        emailId: emailResult?.id
      })

      // reservations 테이블에 pickup_notification_sent 업데이트
      try {
        const { error: updateError } = await supabase
          .from('reservations')
          .update({ pickup_notification_sent: true })
          .eq('id', reservationId)

        if (updateError) {
          console.error('pickup_notification_sent 업데이트 오류:', updateError)
        }
      } catch (error) {
        console.error('pickup_notification_sent 업데이트 중 오류:', error)
      }

      // 이메일 발송 기록 저장
      try {
        const { error: logError } = await supabase
          .from('email_logs')
          .insert({
            reservation_id: reservationId,
            email: customer.email,
            email_type: 'pickup',
            subject: emailContent.subject,
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_by: sentBy || null,
            resend_email_id: emailResult?.id || null
          } as never)
          .catch(() => {
            // email_logs 테이블이 없으면 무시
          })

        if (logError) {
          console.error('이메일 로그 저장 오류 (무시):', logError)
        }
      } catch (error) {
        console.log('이메일 로그 테이블이 없습니다. (무시됨)')
      }
    } catch (error) {
      console.error('[send-pickup-schedule-notification] 이메일 발송 오류:', error)
      console.error('[send-pickup-schedule-notification] 에러 상세:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        errorType: typeof error,
        errorString: String(error)
      })
      
      // 실패 기록 저장
      try {
        await supabase
          .from('email_logs')
          .insert({
            reservation_id: reservationId,
            email: customer.email,
            email_type: 'pickup',
            subject: emailContent.subject,
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            sent_at: new Date().toISOString(),
            sent_by: sentBy || null
          } as never)
          .catch(() => {})
      } catch (logError) {
        // 무시
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return NextResponse.json(
        { 
          error: '이메일 발송에 실패했습니다.',
          details: errorMessage,
          errorType: error instanceof Error ? error.name : 'Unknown'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '픽업 스케줄 알림 이메일이 발송되었습니다.',
    })

  } catch (error) {
    console.error('[send-pickup-schedule-notification] 픽업 스케줄 알림 발송 오류:', error)
    console.error('[send-pickup-schedule-notification] 최상위 에러 상세:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      errorType: typeof error,
      errorString: String(error)
    })
    return NextResponse.json(
      { 
        error: '서버 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.name : 'Unknown'
      },
      { status: 500 }
    )
  }
}

export function generatePickupScheduleEmailContent(
  reservation: any,
  customer: any,
  product: any,
  pickupHotel: any,
  pickupTime: string,
  tourDate: string,
  isEnglish: boolean,
  allPickups?: any[],
  tourDetails?: any,
  chatRoomCode?: string | null
) {
  const productName = isEnglish 
    ? (product?.customer_name_en || product?.name_en || product?.name) 
    : (product?.customer_name_ko || product?.name_ko || product?.name)
  
  // tourDate를 직접 파싱하여 시간대 문제 방지
  const parseTourDate = (dateStr: string) => {
    // YYYY-MM-DD 형식의 날짜 문자열을 파싱
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day) // 월은 0부터 시작하므로 -1
    return date
  }
  
  const formattedTourDate = parseTourDate(tourDate).toLocaleDateString(isEnglish ? 'en-US' : 'ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })

  // 픽업 시간 포맷팅 (HH:MM -> HH:MM AM/PM)
  const formatTime = (time: string) => {
    if (!time) return time
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours, 10)
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes || '00'} ${period}`
  }

  // 픽업 시간과 날짜 포맷팅 (오후 9시 이후는 하루 마이너스)
  const formatTimeWithDate = (time: string, baseDate: string) => {
    if (!time) return time
    
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours, 10)
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    const timeFormatted = `${displayHour}:${minutes || '00'} ${period}`
    
    // 오후 9시(21:00)보다 큰 시간은 하루를 마이너스
    let displayDate = parseTourDate(baseDate)
    if (hour >= 21) {
      displayDate = new Date(displayDate)
      displayDate.setDate(displayDate.getDate() - 1)
    }
    
    const dateFormatted = displayDate.toLocaleDateString(isEnglish ? 'en-US' : 'ko-KR', {
      month: 'short',
      day: 'numeric'
    })
    
    return `${timeFormatted} ${dateFormatted}`
  }

  const formattedPickupTime = formatTime(pickupTime)

  const subject = isEnglish
    ? `Pickup Schedule Confirmed - ${productName} on ${formattedTourDate}`
    : `픽업 스케줄 확정 안내 - ${formattedTourDate} ${productName}`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
        .info-box { background: white; border-left: 4px solid #2563eb; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; color: #374151; }
        .value { color: #1f2937; font-size: 18px; }
        .highlight { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b; }
        .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        .media-gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0; }
        .media-item { width: 100%; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.2s, box-shadow 0.2s; }
        .media-item:hover { transform: scale(1.02); box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
        .media-item a { display: block; text-decoration: none; }
        .media-item img { width: 100%; height: auto; display: block; }
        .pickup-location-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isEnglish ? 'Pickup Schedule Confirmed' : '픽업 스케줄 확정 안내'}</h1>
        </div>
        <div class="content">
          <p>${isEnglish ? `Dear ${customer.name},` : `${customer.name}님,`}</p>
          
          <p>${isEnglish 
            ? `Your pickup schedule for the tour has been confirmed. Please find the details below:`
            : `투어 픽업 스케줄이 확정되었습니다. 아래 내용을 확인해주세요.`}</p>

          <div class="info-box">
            <div class="info-row">
              <span class="label">${isEnglish ? 'Tour:' : '투어:'}</span>
              <span class="value">${productName}</span>
            </div>
            <div class="info-row">
              <span class="label">${isEnglish ? 'Tour Date:' : '투어 날짜:'}</span>
              <span class="value">${formattedTourDate}</span>
            </div>
            <div class="info-row">
              <span class="label">${isEnglish ? 'Pickup Time:' : '픽업 시간:'}</span>
              <span class="value" style="color: #2563eb; font-weight: bold; font-size: 20px;">${formattedPickupTime}</span>
            </div>
            ${pickupHotel ? `
            <div class="info-row">
              <span class="label">${isEnglish ? 'Pickup Hotel:' : '픽업 호텔:'}</span>
              <span class="value">${pickupHotel.hotel}</span>
            </div>
            ${pickupHotel.pick_up_location ? `
            <div class="info-row">
              <span class="label">${isEnglish ? 'Pickup Location:' : '픽업 장소:'}</span>
              <span class="value" style="color: #1e40af; font-weight: bold;">${pickupHotel.pick_up_location}</span>
            </div>
            ` : ''}
            ${pickupHotel.address ? `
            <div class="info-row">
              <span class="label">${isEnglish ? 'Address:' : '주소:'}</span>
              <span class="value">${pickupHotel.address}</span>
            </div>
            ` : ''}
            ${pickupHotel.link ? `
            <div class="info-row">
              <a href="${pickupHotel.link}" target="_blank" class="button">${isEnglish ? 'View on Map' : '지도에서 보기'}</a>
            </div>
            ` : ''}
            ` : `
            <div class="info-row">
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px; margin-top: 10px;">
                <p style="margin: 0; color: #92400e; font-weight: 600; font-size: 14px;">
                  ${isEnglish 
                    ? '⚠️ Your pickup hotel has not been confirmed yet. Please select one from the "All Pickup Schedule" below and inform us of your choice in advance.'
                    : '⚠️ 픽업 호텔이 아직 확정되지 않았습니다. 아래 "모든 픽업 스케줄" 중 하나를 선택하여 미리 알려주시기 바랍니다.'}
                </p>
              </div>
            </div>
            `}
          </div>

          ${pickupHotel && pickupHotel.media && Array.isArray(pickupHotel.media) && pickupHotel.media.length > 0 ? `
          <div class="info-box">
            <div class="info-row">
              <span class="label" style="font-size: 16px; margin-bottom: 10px; display: block;">${isEnglish ? '📸 Pickup Location Images:' : '📸 픽업 장소 이미지:'}</span>
              <p style="font-size: 12px; color: #6b7280; margin-top: 5px;">${isEnglish ? '(Click on images to view in full size)' : '(이미지를 클릭하면 크게 볼 수 있습니다)'}</p>
            </div>
            <div class="media-gallery">
              ${pickupHotel.media.map((mediaUrl: string) => `
                <div class="media-item">
                  <a href="${mediaUrl}" target="_blank" style="display: block; cursor: pointer;">
                    <img src="${mediaUrl}" alt="${isEnglish ? 'Pickup location' : '픽업 장소'}" style="max-width: 100%; height: auto; transition: transform 0.2s;" />
                  </a>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          ${allPickups && allPickups.length > 0 ? `
          <div class="info-box" style="margin-top: 30px;">
            <h2 style="font-size: 20px; font-weight: bold; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
              ${isEnglish ? '🚌 All Pickup Schedule' : '🚌 모든 픽업 스케줄'}
            </h2>
            ${!pickupHotel ? `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px; margin-bottom: 15px;">
              <p style="margin: 0; color: #92400e; font-weight: 600; font-size: 14px; line-height: 1.6;">
                ${isEnglish 
                  ? '⚠️ Your pickup hotel has not been confirmed yet. Please select one of the hotels from the schedule below and inform us of your choice in advance so we can arrange your pickup accordingly.'
                  : '⚠️ 픽업 호텔이 아직 확정되지 않았습니다. 아래 스케줄 중 하나의 호텔을 선택하여 미리 알려주시기 바랍니다. 선택하신 호텔에 맞춰 픽업을 준비하겠습니다.'}
              </p>
            </div>
            ` : ''}
            <div style="space-y: 10px;">
              ${allPickups.map((pickup: any) => {
                const isMyReservation = pickup.reservation_id === reservation.id
                const pickupTimeFormatted = formatTimeWithDate(pickup.pickup_time, pickup.tour_date || tourDate)
                return `
                  <div style="padding: 15px; margin-bottom: 15px; border-left: 4px solid ${isMyReservation ? '#2563eb' : '#9ca3af'}; background: ${isMyReservation ? '#eff6ff' : '#f9fafb'}; border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                      <div>
                        <span style="font-size: 18px; font-weight: bold; color: ${isMyReservation ? '#2563eb' : '#374151'};">
                          ${pickupTimeFormatted}
                        </span>
                        ${isMyReservation ? `<span style="background: #2563eb; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">${isEnglish ? 'My Reservation' : '내 예약'}</span>` : ''}
                      </div>
                    </div>
                    <div style="margin-bottom: 8px;">
                      <span style="font-weight: bold; color: #1f2937;">${pickup.hotel_name}</span>
                    </div>
                    ${pickup.pick_up_location ? `
                    <div style="margin-bottom: 8px;">
                      <span style="color: #ea580c; font-weight: 600; font-size: 15px;">📍 ${pickup.pick_up_location}</span>
                    </div>
                    ` : ''}
                    ${pickup.address ? `
                    <div style="margin-bottom: 8px; color: #6b7280; font-size: 14px;">
                      ${pickup.address}
                    </div>
                    ` : ''}
                    ${pickup.link ? `
                    <div style="margin-top: 10px;">
                      <a href="${pickup.link}" target="_blank" style="color: #2563eb; text-decoration: none; font-size: 13px;">
                        ${isEnglish ? '📍 View on Map' : '📍 지도에서 보기'}
                      </a>
                    </div>
                    ` : ''}
                  </div>
                `
              }).join('')}
            </div>
          </div>
          ` : ''}

          ${tourDetails ? `
          <div class="info-box" style="margin-top: 30px;">
            <h2 style="font-size: 20px; font-weight: bold; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
              ${isEnglish ? '👥 Tour Details' : '👥 투어 상세 정보'}
            </h2>
            ${tourDetails.tour_guide ? `
            <div style="margin-bottom: 20px; padding: 15px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #0ea5e9;">
              <div style="font-weight: bold; color: #0c4a6e; margin-bottom: 8px; font-size: 16px;">
                ${isEnglish ? '👨‍🏫 Tour Guide' : '👨‍🏫 투어 가이드'}
              </div>
              <div style="color: #1e293b;">
                <div style="margin-bottom: 5px;">
                  <strong>${isEnglish ? 'Name:' : '이름:'}</strong> 
                  ${isEnglish 
                    ? (tourDetails.tour_guide.name_en || tourDetails.tour_guide.name_ko || 'N/A')
                    : (tourDetails.tour_guide.name_ko || tourDetails.tour_guide.name_en || 'N/A')}
                </div>
                ${tourDetails.tour_guide.phone ? `
                <div style="margin-bottom: 5px;">
                  <strong>${isEnglish ? 'Phone:' : '전화번호:'}</strong> ${tourDetails.tour_guide.phone}
                </div>
                ` : ''}
                ${tourDetails.tour_guide.languages ? `
                <div style="margin-bottom: 5px;">
                  <strong>${isEnglish ? 'Languages:' : '언어:'}</strong> 
                  ${Array.isArray(tourDetails.tour_guide.languages) 
                    ? tourDetails.tour_guide.languages.join(', ')
                    : tourDetails.tour_guide.languages}
                </div>
                ` : ''}
              </div>
            </div>
            ` : ''}
            ${tourDetails.assistant ? `
            <div style="margin-bottom: 20px; padding: 15px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">
              <div style="font-weight: bold; color: #065f46; margin-bottom: 8px; font-size: 16px;">
                ${isEnglish ? '👨‍💼 Assistant' : '👨‍💼 어시스턴트'}
              </div>
              <div style="color: #1e293b;">
                <div style="margin-bottom: 5px;">
                  <strong>${isEnglish ? 'Name:' : '이름:'}</strong> 
                  ${isEnglish 
                    ? (tourDetails.assistant.name_en || tourDetails.assistant.name_ko || 'N/A')
                    : (tourDetails.assistant.name_ko || tourDetails.assistant.name_en || 'N/A')}
                </div>
                ${tourDetails.assistant.phone ? `
                <div style="margin-bottom: 5px;">
                  <strong>${isEnglish ? 'Phone:' : '전화번호:'}</strong> ${tourDetails.assistant.phone}
                </div>
                ` : ''}
              </div>
            </div>
            ` : ''}
            ${tourDetails.vehicle ? `
            <div style="margin-bottom: 20px; padding: 15px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <div style="font-weight: bold; color: #92400e; margin-bottom: 8px; font-size: 16px;">
                ${isEnglish ? '🚗 Vehicle' : '🚗 차량'}
              </div>
              <div style="color: #1e293b;">
                ${tourDetails.vehicle.vehicle_type_info ? `
                <div style="margin-bottom: 5px;">
                  <strong>${isEnglish ? 'Type:' : '타입:'}</strong> ${tourDetails.vehicle.vehicle_type_info.name || tourDetails.vehicle.vehicle_type || 'N/A'}
                </div>
                ${tourDetails.vehicle.vehicle_type_info.brand && tourDetails.vehicle.vehicle_type_info.model ? `
                <div style="margin-bottom: 5px;">
                  <strong>${isEnglish ? 'Model:' : '모델:'}</strong> ${tourDetails.vehicle.vehicle_type_info.brand} ${tourDetails.vehicle.vehicle_type_info.model}
                </div>
                ` : ''}
                ${tourDetails.vehicle.vehicle_type_info.passenger_capacity ? `
                <div style="margin-bottom: 5px;">
                  <strong>${isEnglish ? 'Capacity:' : '정원:'}</strong> ${tourDetails.vehicle.vehicle_type_info.passenger_capacity} ${isEnglish ? 'people' : '명'}
                </div>
                ` : ''}
                ${tourDetails.vehicle.color ? `
                <div style="margin-bottom: 5px;">
                  <strong>${isEnglish ? 'Color:' : '색상:'}</strong> ${tourDetails.vehicle.color}
                </div>
                ` : ''}
                ${tourDetails.vehicle.vehicle_type_info.description ? `
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #d1d5db;">
                  <div style="font-size: 14px; color: #4b5563;">${tourDetails.vehicle.vehicle_type_info.description}</div>
                </div>
                ` : ''}
                ` : `
                <div style="margin-bottom: 5px;">
                  <strong>${isEnglish ? 'Type:' : '타입:'}</strong> ${tourDetails.vehicle.vehicle_type || 'N/A'}
                </div>
                `}
                ${tourDetails.vehicle.vehicle_type_photos && Array.isArray(tourDetails.vehicle.vehicle_type_photos) && tourDetails.vehicle.vehicle_type_photos.length > 0 ? `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #d1d5db;">
                  <div style="font-weight: bold; color: #92400e; margin-bottom: 10px; font-size: 14px;">
                    ${isEnglish ? '📸 Vehicle Photos:' : '📸 차량 사진:'}
                  </div>
                  <p style="font-size: 12px; color: #6b7280; margin-top: 5px; margin-bottom: 10px;">
                    ${isEnglish ? '(Click on images to view in full size)' : '(이미지를 클릭하면 크게 볼 수 있습니다)'}
                  </p>
                  <div class="media-gallery" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0; align-items: start;">
                    ${tourDetails.vehicle.vehicle_type_photos.map((photo: any) => `
                      <div class="media-item" style="width: 100%; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column;">
                        <a href="${photo.photo_url}" target="_blank" style="display: block; text-decoration: none; cursor: pointer; flex: 1; display: flex; align-items: center; justify-content: center;">
                          <img src="${photo.photo_url}" alt="${photo.photo_name || (isEnglish ? 'Vehicle photo' : '차량 사진')}" style="width: 100%; height: auto; max-width: 100%; display: block; transition: transform 0.2s; object-fit: contain;" />
                        </a>
                      </div>
                    `).join('')}
                  </div>
                </div>
                ` : ''}
              </div>
            </div>
            ` : ''}
            ${!tourDetails.tour_guide && !tourDetails.assistant && !tourDetails.vehicle ? `
            <div style="padding: 15px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b; margin-top: 10px;">
              <p style="margin: 0; color: #92400e; font-weight: 600; font-size: 14px;">
                ${isEnglish 
                  ? 'ℹ️ Tour details (guide, assistant, vehicle) will be updated and shared closer to the tour date.'
                  : 'ℹ️ 투어 상세 정보(가이드, 어시스턴트, 차량)는 투어 날짜가 가까워지면 업데이트되어 공유됩니다.'}
              </p>
            </div>
            ` : ''}
          </div>
          ` : ''}

          <div class="highlight">
            <p style="margin: 0; font-weight: bold;">${isEnglish 
              ? '⚠️ Important: Please arrive at the pickup location 5 minutes before the scheduled time.'
              : '⚠️ 중요: 픽업 시간보다 5분 전에 픽업 장소에 도착해주세요.'}</p>
          </div>

          ${chatRoomCode ? `
          <div class="info-box" style="background: #f0fdf4; border-left: 4px solid #10b981; margin-top: 30px;">
            <h2 style="font-size: 20px; font-weight: bold; color: #065f46; margin-bottom: 15px; border-bottom: 2px solid #10b981; padding-bottom: 10px;">
              ${isEnglish ? '💬 Tour Chat Room' : '💬 투어 채팅방'}
            </h2>
            <div style="margin-bottom: 15px;">
              <p style="color: #1e293b; line-height: 1.8; margin-bottom: 15px;">
                ${isEnglish 
                  ? 'Join the tour chat room to communicate with your guide during pickup and view tour photos after the tour ends.'
                  : '투어 채팅방에 참여하시면 픽업 시 가이드와 연락할 수 있으며, 투어가 끝난 후 투어 사진을 이곳에서 볼 수 있습니다.'}
              </p>
              <a href="https://www.kovegas.com/chat/${chatRoomCode}" target="_blank" class="button" style="background: #10b981; display: inline-block; padding: 12px 24px; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                ${isEnglish ? 'Open Tour Chat Room' : '투어 채팅방 열기'}
              </a>
            </div>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #d1d5db;">
              <p style="font-size: 13px; color: #6b7280; margin: 0;">
                ${isEnglish 
                  ? '📱 You can access the chat room anytime using the link above. The guide will be available to assist you during pickup, and tour photos will be shared here after the tour.'
                  : '📱 위 링크를 통해 언제든지 채팅방에 접속할 수 있습니다. 픽업 시 가이드가 도움을 드리며, 투어가 끝난 후 투어 사진이 이곳에 공유됩니다.'}
              </p>
            </div>
          </div>
          ` : ''}

          <p>${isEnglish 
            ? `If you have any questions or need to make changes, please contact us as soon as possible.`
            : `궁금한 사항이 있거나 변경이 필요한 경우, 가능한 한 빨리 연락주시기 바랍니다.`}</p>

          <p>${isEnglish 
            ? `We look forward to seeing you on the tour!`
            : `투어에서 만나뵙기를 기대하겠습니다!`}</p>
        </div>
        <div class="footer">
          <p>${isEnglish 
            ? 'This is an automated email. Please do not reply to this email.'
            : '이 이메일은 자동으로 발송된 메일입니다. 회신하지 마세요.'}</p>
        </div>
      </div>
    </body>
    </html>
  `

  return { subject, html }
}

