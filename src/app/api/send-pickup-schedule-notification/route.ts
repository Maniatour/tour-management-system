import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'
import { getGoblinTourWeatherData, normalizeDate } from '@/lib/weatherApi'
import { fetchProductDetailsForReservationEmail } from '@/lib/fetchProductDetailsForEmail'
import { resolveReservationEmailIsEnglish } from '@/lib/reservationEmailLocale'
import { getOperationsCc } from '@/lib/emailConfig'
import { renderTourChatRoomEmailSectionHtml } from '@/lib/tourChatRoomEmailHtml'

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
    const { reservationId, pickupTime, tourDate, locale: localeParam, sentBy, preparationInfo: preparationInfoFromBody } = body

    if (!reservationId || !pickupTime || !tourDate) {
      return NextResponse.json(
        { error: '예약 ID, 픽업 시간, 투어 날짜가 필요합니다.' },
        { status: 400 }
      )
    }

    const routeDb = supabaseAdmin ?? supabase

    // 예약 정보 조회
    console.log('[send-pickup-schedule-notification] 예약 조회 시작:', { reservationId })
    const { data: reservation, error: reservationError } = await routeDb
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
      const { data: customerData, error: customerError } = await routeDb
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
      const { data: productData, error: productError } = await routeDb
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
      const { data: hotelData, error: hotelError } = await routeDb
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
    const isEnglish = resolveReservationEmailIsEnglish(customer.language, localeParam)


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

    // Tour Details 조회 - 먼저 reservation_ids에 현재 예약 ID가 포함된 투어 찾기
    let tourDetails: any = null
    let tourData = null
    
    // 1. reservation.tour_id로 먼저 시도
    if (reservation.tour_id) {
      console.log('[send-pickup-schedule-notification] tour_id로 투어 조회:', reservation.tour_id)
      const { data: tourDataById, error: tourError } = await routeDb
        .from('tours')
        .select('*')
        .eq('id', reservation.tour_id)
        .maybeSingle()

      if (tourError) {
        console.error('[send-pickup-schedule-notification] 투어 조회 오류:', tourError)
      } else if (tourDataById) {
        // reservation_ids에 현재 예약 ID가 포함되어 있는지 확인
        const reservationIds = normalizeIds(tourDataById.reservation_ids)
        if (reservationIds.includes(reservationId)) {
          tourData = tourDataById
          console.log('[send-pickup-schedule-notification] tour_id로 조회된 투어 (reservation_ids 확인됨):', tourData.id)
        } else {
          console.log('[send-pickup-schedule-notification] tour_id로 조회된 투어에 현재 예약 ID가 없음')
        }
      }
    }
    
    // 2. tour_id가 없거나 reservation_ids에 포함되지 않은 경우, reservation_ids 배열에 예약 ID가 포함된 투어 찾기
    if (!tourData && reservation.product_id && tourDate) {
      console.log('[send-pickup-schedule-notification] reservation_ids로 투어 조회 시도:', {
        reservationId,
        product_id: reservation.product_id,
        tour_date: tourDate
      })
      
      // product_id와 tour_date로 먼저 필터링한 후, reservation_ids 배열에서 확인
      const { data: toursByProduct, error: tourError } = await routeDb
        .from('tours')
        .select('*')
        .eq('product_id', reservation.product_id)
        .eq('tour_date', tourDate)

      if (tourError) {
        console.error('[send-pickup-schedule-notification] 투어 조회 오류:', tourError)
      } else if (toursByProduct && toursByProduct.length > 0) {
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

    // All Pickup Schedule 조회 (찾은 투어의 reservation_ids에 포함된 예약만)
    let allPickups: any[] = []
    if (tourData && tourData.reservation_ids) {
      const reservationIds = normalizeIds(tourData.reservation_ids)
      
      if (reservationIds.length > 0) {
        // reservation_ids에 포함된 예약만 조회 (취소된 예약 제외)
        const { data: allReservations } = await routeDb
          .from('reservations')
          .select('id, pickup_hotel, pickup_time, customer_id, total_people, tour_date, status')
          .in('id', reservationIds)
          .not('pickup_time', 'is', null)
          .not('pickup_hotel', 'is', null)
          .neq('status', 'cancelled')

        if (allReservations) {
          allPickups = await Promise.all(
            allReservations.map(async (res: any) => {
              const { data: customerInfo } = await routeDb
                .from('customers')
                .select('name')
                .eq('id', res.customer_id)
                .maybeSingle()

              const { data: hotelInfo } = await routeDb
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

      const teamDb = supabaseAdmin ?? supabase
      if (tourData.tour_guide_id) {
        console.log('[send-pickup-schedule-notification] 가이드 조회:', tourData.tour_guide_id)
        const { data: guideData, error: guideError } = await teamDb
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
        const { data: assistantData, error: assistantError } = await teamDb
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
        const vehiclesDb = supabaseAdmin ?? supabase
        const { data: vehicleData, error: vehicleError } = await vehiclesDb
          .from('vehicles')
          .select('vehicle_type, capacity, color')
          .eq('id', tourData.tour_car_id)
          .maybeSingle()

        if (vehicleError) {
          console.error('[send-pickup-schedule-notification] 차량 조회 오류:', vehicleError)
        } else if (vehicleData?.vehicle_type) {
          const { data: vehicleTypeData, error: vehicleTypeError } = await routeDb
            .from('vehicle_types')
            .select('id, name, brand, model, passenger_capacity, description')
            .eq('name', vehicleData.vehicle_type)
            .maybeSingle()

          if (vehicleTypeError) {
            console.error('[send-pickup-schedule-notification] 차량 타입 조회 오류:', vehicleTypeError)
          }

          const { data: typePhotosData, error: typePhotosError } = await routeDb
            .from('vehicle_type_photos')
            .select('photo_url, photo_name, description, is_primary, display_order')
            .eq('vehicle_type_id', vehicleTypeData?.id || '')
            .order('display_order', { ascending: true })
            .order('is_primary', { ascending: false })

          if (typePhotosError) {
            console.error('[send-pickup-schedule-notification] vehicle_type_photos 조회 오류:', typePhotosError)
          }

          const { data: vehiclePhotosData, error: vehiclePhotosError } = await routeDb
            .from('vehicle_photos')
            .select('photo_url, photo_name, is_primary, display_order')
            .eq('vehicle_id', tourData.tour_car_id)
            .order('display_order', { ascending: true })
            .order('is_primary', { ascending: false })

          if (vehiclePhotosError) {
            console.error('[send-pickup-schedule-notification] vehicle_photos 조회 오류:', vehiclePhotosError)
          }

          const simplifyUrl = (url: string): string => {
            if (!url) return url
            try {
              const urlObj = new URL(url)
              urlObj.search = ''
              urlObj.hash = ''
              return urlObj.toString()
            } catch {
              return url
            }
          }

          const toPublicPhotoUrl = (photo: any): any => {
            if (!photo.photo_url) return null
            if (photo.photo_url.startsWith('data:image')) {
              return { ...photo, photo_url: photo.photo_url }
            }
            if (!photo.photo_url.startsWith('http') && !photo.photo_url.startsWith('data:')) {
              try {
                const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(photo.photo_url)
                return { ...photo, photo_url: simplifyUrl(publicUrl) }
              } catch (error) {
                console.error('[send-pickup-schedule-notification] 공개 URL 생성 오류:', error)
                return photo
              }
            }
            return { ...photo, photo_url: simplifyUrl(photo.photo_url) }
          }

          const processedTypePhotos = (typePhotosData || []).map(toPublicPhotoUrl).filter((p: any) => p !== null)
          const processedVehiclePhotos = (vehiclePhotosData || []).map(toPublicPhotoUrl).filter((p: any) => p !== null)
          const displayPhotos = processedVehiclePhotos.length > 0 ? processedVehiclePhotos : processedTypePhotos

          // data URL 사진은 클릭 시 새 탭에서 보이도록 Storage에 임시 업로드 후 viewUrl 부여
          const displayPhotosWithViewUrl = await Promise.all(
            displayPhotos.map(async (photo: any) => {
              if (!photo.photo_url?.startsWith('data:image')) {
                return { ...photo, viewUrl: photo.photo_url }
              }
              try {
                const [header, base64] = photo.photo_url.split(',')
                const mime = (header.match(/data:(.+);/)?.[1] || 'image/jpeg').trim()
                const ext = (mime.split('/')[1] || 'jpg').replace(/\+xml$/, '') || 'jpg'
                const buffer = Buffer.from(base64, 'base64')
                const path = `email-view/${crypto.randomUUID()}.${ext}`
                const { error } = await supabase.storage
                  .from('images')
                  .upload(path, buffer, { contentType: mime, upsert: false })
                if (error) {
                  console.warn('[send-pickup-schedule-notification] data URL 업로드 실패:', error.message)
                  return { ...photo, viewUrl: null }
                }
                const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path)
                return { ...photo, viewUrl: simplifyUrl(publicUrl) }
              } catch (e) {
                console.warn('[send-pickup-schedule-notification] data URL 업로드 예외:', e)
                return { ...photo, viewUrl: null }
              }
            })
          )

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
            vehicle_type_photos: displayPhotosWithViewUrl
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

    // Chat Room 정보 조회 (찾은 투어 ID 사용)
    let chatRoomCode: string | null = null
    if (tourData && tourData.id) {
      const { data: chatRoomData } = await routeDb
        .from('chat_rooms')
        .select('room_code')
        .eq('tour_id', tourData.id)
        .eq('is_active', true)
        .maybeSingle()

      if (chatRoomData) {
        chatRoomCode = chatRoomData.room_code
      }
    }

    // 투어일 날씨 조회 (YYYY-MM-DD 통일로 투어 상세 페이지와 동일 데이터 사용)
    let tourDayWeather: Awaited<ReturnType<typeof getGoblinTourWeatherData>> | null = null
    try {
      tourDayWeather = await getGoblinTourWeatherData(normalizeDate(tourDate))
    } catch (weatherErr) {
      console.warn('[send-pickup-schedule-notification] 투어일 날씨 조회 실패 (무시):', weatherErr)
    }

    // 상품 준비사항(추천 준비물): 요청에 값이 있으면 사용, 없으면 DB 조회
    let preparationInfo: string | null = null
    if (preparationInfoFromBody !== undefined && preparationInfoFromBody !== null) {
      preparationInfo = typeof preparationInfoFromBody === 'string' ? preparationInfoFromBody : String(preparationInfoFromBody)
    } else if (reservation.product_id) {
      const languageCode = isEnglish ? 'en' : 'ko'
      const rez = reservation as {
        channel_id?: string | null
        variant_key?: string | null
      }
      const channelsLookupClient = supabaseAdmin ?? supabase
      const row = await fetchProductDetailsForReservationEmail(supabase, {
        productId: reservation.product_id,
        languageCode,
        channelId: rez.channel_id ?? null,
        variantKey: rez.variant_key ?? 'default',
        channelsLookupClient,
      })
      preparationInfo = (row?.preparation_info as string) ?? null
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
      chatRoomCode,
      tourDayWeather,
      preparationInfo
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
          await routeDb
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
    // Reply-To 설정: 회신은 info@maniatour.com으로 받기
    const replyTo = process.env.RESEND_REPLY_TO || 'info@maniatour.com'
    
    console.log('[send-pickup-schedule-notification] 발신자 이메일:', {
      fromEmail,
      replyTo,
      isDevelopment,
      hasConfiguredEmail: !!process.env.RESEND_FROM_EMAIL
    })
    
    console.log('[send-pickup-schedule-notification] 이메일 발송 준비:', {
      fromEmail,
      replyTo,
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
        reply_to: replyTo,
        to: customer.email,
        cc: getOperationsCc(customer.email),
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
        const { error: updateError } = await routeDb
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
        if (supabaseAdmin) {
          const { error: logError } = await supabaseAdmin
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

          if (logError) {
            console.error('이메일 로그 저장 오류 (무시):', logError)
          }
        } else {
          console.error('email_logs: supabaseAdmin 미설정, 발송 로그 미저장')
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
        if (supabaseAdmin) {
          await supabaseAdmin
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
        } else {
          console.error('email_logs: supabaseAdmin 미설정, 실패 로그 미저장')
        }
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

/** 투어일 날씨 데이터 (getGoblinTourWeatherData 반환형과 호환) */
export type TourDayWeather = {
  grandCanyon: { location: string; weather: { temperature: number | null; temp_max: number | null; temp_min: number | null; weather_main: string | null; weather_description: string | null } }
  zionCanyon: { location: string; weather: { temperature: number | null; temp_max: number | null; temp_min: number | null; weather_main: string | null; weather_description: string | null } }
  pageCity: { location: string; weather: { temperature: number | null; temp_max: number | null; temp_min: number | null; weather_main: string | null; weather_description: string | null } }
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
  chatRoomCode?: string | null,
  tourDayWeather?: TourDayWeather | null,
  preparationInfo?: string | null,
  /** 미리보기에서 이미지 로딩용. 설정 시 차량 사진 img src를 이 베이스 URL의 /api/proxy-image?url=... 로 래핑 */
  imageProxyBaseUrl?: string | null
) {
  const imageUrl = (url: string) => {
    if (!url || url.startsWith('data:')) return url
    if (imageProxyBaseUrl) {
      return `${imageProxyBaseUrl.replace(/\/$/, '')}/api/proxy-image?url=${encodeURIComponent(url)}`
    }
    return url
  }
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

  // 전화번호를 tel: 링크로 변환하는 헬퍼 함수
  const formatPhoneLink = (phone: string) => {
    if (!phone) return phone
    // 전화번호에서 숫자만 추출
    const phoneNumber = phone.replace(/\D/g, '')
    if (!phoneNumber) return phone
    return `tel:${phoneNumber}`
  }

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

  // 픽업 시간과 날짜 포맷팅 (오후 9시~자정 사이는 하루 마이너스, 요일 포함)
  const formatPickupTimeWithFullDate = (time: string, baseDate: string) => {
    if (!time) return formatTime(time)
    
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours, 10)
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    const timeFormatted = `${displayHour}:${minutes || '00'} ${period}`
    
    // 오후 9시(21:00)~자정(23:59) 사이는 하루를 마이너스
    let displayDate = parseTourDate(baseDate)
    if (hour >= 21 && hour <= 23) {
      displayDate = new Date(displayDate)
      displayDate.setDate(displayDate.getDate() - 1)
    }
    
    const dateFormatted = displayDate.toLocaleDateString(isEnglish ? 'en-US' : 'ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
    
    return `${timeFormatted} (${dateFormatted})`
  }

  const formattedPickupTime = formatPickupTimeWithFullDate(pickupTime, tourDate)

  const subject = isEnglish
    ? `Pickup Schedule Confirmed - ${productName} on ${formattedTourDate}`
    : `픽업 스케줄 확정 안내 - ${formattedTourDate} ${productName}`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
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
        .media-item { width: 100%; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .media-item a { display: block; text-decoration: none; }
        .media-item img { max-width: 250px; max-height: 250px; width: auto; height: auto; object-fit: cover; display: block; }
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
            <div class="info-row" style="margin-top: 12px;">
              <p style="margin: 0; font-size: 13px; color: #4b5563; line-height: 1.6;">
                ${isEnglish
                  ? 'Please click the button to check the exact pickup location on Google Maps. Many Las Vegas hotels have multiple entrances, and the pickup point may be different from the main lobby. Please come to the exact location shown on Google Maps.'
                  : '위 버튼을 눌러 구글 지도에서 정확한 픽업 위치를 확인해 주세요. 라스베가스 호텔은 입구가 여러 곳이며, 픽업 장소가 메인 로비와 다른 경우가 많습니다. 반드시 구글 지도에 표시된 픽업 포인트로 와주시기 바랍니다.'}
              </p>
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
              ${pickupHotel.media.slice(0, 4).map((mediaUrl: string) => `
                <div class="media-item">
                  <a href="${mediaUrl}" target="_blank" style="display: block; cursor: pointer;">
                    <img src="${mediaUrl}" alt="${isEnglish ? 'Pickup location' : '픽업 장소'}" width="250" height="250" style="max-width: 250px; max-height: 250px; width: auto; height: auto; object-fit: cover; transition: transform 0.2s;" loading="lazy" />
                  </a>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          ${tourDayWeather ? (() => {
            const fmt = (c: number | null) => c != null ? `${Math.round(c)}°C (${Math.round(c * 9/5 + 32)}°F)` : '—'
            const productNameForTour = (product?.name_ko || product?.name || '').toLowerCase()
            const isGoblinGrandCanyonTour = productNameForTour.includes('밤도깨비') && (productNameForTour.includes('그랜드캐년') || productNameForTour.includes('그랜드 캐니언'))
            const weatherIcon = (main: string | null, desc: string | null) => {
              const m = (main || '').toLowerCase()
              const d = (desc || '').toLowerCase()
              if (m === 'clear') return '☀️'
              if (d.includes('thunderstorm') || m === 'thunderstorm') return '⛈️'
              if (d.includes('drizzle') || m === 'drizzle') return '🌦️'
              if (d.includes('rain') || m === 'rain') return '🌧️'
              if (d.includes('snow') || m === 'snow') return '❄️'
              if (d.includes('mist') || d.includes('fog') || m === 'mist' || m === 'fog') return '🌫️'
              if (d.includes('overcast') || m === 'clouds' && d.includes('overcast')) return '☁️'
              if (d.includes('broken clouds') || d.includes('broken')) return '⛅'
              if (d.includes('scattered') || d.includes('few clouds')) return '🌤️'
              if (m === 'clouds') return '☁️'
              return '🌤️'
            }
            const clothingByTemp = (temp: number | null) => {
              if (temp == null) return ''
              const t = Math.round(temp)
              if (t >= 28) return isEnglish ? '👕 Short sleeves recommended' : '👕 반팔 차림이 좋겠어요'
              if (t >= 22) return isEnglish ? '👔 Light long sleeves' : '👔 가벼운 긴팔 추천'
              if (t >= 15) return isEnglish ? '🧥 Thin jacket recommended' : '🧥 얇은 자켓을 준비하세요'
              if (t >= 8) return isEnglish ? '🧥 Thick jacket needed' : '🧥 두꺼운 자켓이 필요해요'
              return isEnglish ? '🧶 Warm layers needed' : '🧶 두꺼운 옷이 필요해요'
            }
            const locations = [
              { data: tourDayWeather.grandCanyon, title: isEnglish ? 'Grand Canyon South Rim' : '그랜드 캐니언 사우스 림', showOnlyMin: isGoblinGrandCanyonTour, showOnlyMax: false, primaryTemp: 'min' as const },
              { data: tourDayWeather.pageCity, title: 'Antelope Canyon & Horseshoe Bend', showOnlyMin: false, showOnlyMax: isGoblinGrandCanyonTour, primaryTemp: 'max' as const }
            ]
            return `
          <div class="info-box" style="margin-top: 30px;">
            <h2 style="font-size: 20px; font-weight: bold; color: #0d9488; margin-bottom: 15px; border-bottom: 2px solid #14b8a6; padding-bottom: 10px;">
              ${isEnglish ? '🌤️ Tour Day Weather' : '🌤️ 투어일 날씨 정보'}
            </h2>
            <p style="font-size: 14px; color: #6b7280; margin-bottom: 15px;">${isEnglish ? 'Weather forecast for your tour date (reference only).' : '투어일 기준 날씨 예보입니다. 참고용으로 활용해 주세요.'}</p>
            <div style="display: block;">
              ${locations.map(({ data: locData, title, showOnlyMin, showOnlyMax, primaryTemp }) => {
                const w = locData?.weather
                const icon = weatherIcon(w?.weather_main ?? null, w?.weather_description ?? null)
                const descText = (w?.weather_description || w?.weather_main || '—')
                const descDisplay = descText.replace(/\b\w/g, (c: string) => c.toUpperCase())
                let tempLine = ''
                let tempForClothing: number | null = null
                if (showOnlyMin) {
                  tempLine = (w?.temp_min != null) ? `${isEnglish ? 'Day low' : '낮 최저'} ${fmt(w.temp_min)}` : '—'
                  tempForClothing = w?.temp_min ?? null
                } else if (showOnlyMax) {
                  tempLine = (w?.temp_max != null) ? `${isEnglish ? 'Day high' : '낮 최고'} ${fmt(w.temp_max)}` : '—'
                  tempForClothing = w?.temp_max ?? null
                } else {
                  const primary = primaryTemp === 'min' ? (w?.temp_min != null ? fmt(w.temp_min) : '—') : (w?.temp_max != null ? fmt(w.temp_max) : '—')
                  tempLine = `<span style="font-size: 20px; font-weight: bold; color: #1f2937;">${primary}</span>`
                  if (w?.temp_min != null || w?.temp_max != null) tempLine += `<br><span style="font-size: 13px; color: #6b7280;">${isEnglish ? 'Min' : '최저'} ${fmt(w?.temp_min)} / ${isEnglish ? 'Max' : '최고'} ${fmt(w?.temp_max)}</span>`
                  tempForClothing = primaryTemp === 'max' ? (w?.temp_max ?? null) : (w?.temp_min ?? w?.temperature ?? w?.temp_max ?? null)
                }
                const clothing = clothingByTemp(tempForClothing)
                return `
                <div style="width: 100%; padding: 12px; margin-bottom: 12px; background: #f0fdfa; border-radius: 8px; border-left: 4px solid #14b8a6; box-sizing: border-box;">
                  <div style="font-weight: bold; color: #0f766e; margin-bottom: 8px;">${title}</div>
                  <div style="font-size: 18px; margin-bottom: 6px;">${icon} <span style="font-size: 14px; color: #374151;">${descDisplay}</span></div>
                  <div style="font-size: 15px; color: #1f2937;">${tempLine}</div>
                  ${clothing ? `<div style="font-size: 13px; color: #059669; margin-top: 8px; font-weight: 500;">${clothing}</div>` : ''}
                </div>
              `}).join('')}
            </div>
          </div>
          `
          })() : ''}

          ${preparationInfo && preparationInfo.trim() ? `
          <div class="info-box" style="margin-top: 30px;">
            <h2 style="font-size: 20px; font-weight: bold; color: #059669; margin-bottom: 15px; border-bottom: 2px solid #10b981; padding-bottom: 10px;">
              ${isEnglish ? '🎒 Recommended Preparation' : '🎒 추천 준비물'}
            </h2>
            <div style="font-size: 15px; line-height: 1.6; color: #1f2937;">${String(preparationInfo).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>')}</div>
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
                  <strong>${isEnglish ? 'Phone:' : '전화번호:'}</strong> 
                  <a href="${formatPhoneLink(tourDetails.tour_guide.phone)}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${tourDetails.tour_guide.phone}</a>
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
                  <strong>${isEnglish ? 'Phone:' : '전화번호:'}</strong> 
                  <a href="${formatPhoneLink(tourDetails.assistant.phone)}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${tourDetails.assistant.phone}</a>
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
                    ${tourDetails.vehicle.vehicle_type_photos
                      .filter((photo: any) => photo.photo_url)
                      .slice(0, 4)
                      .map((photo: any) => {
                        const src = imageUrl(photo.photo_url)
                        const linkUrl = (photo as any).viewUrl || (!(photo.photo_url as string).startsWith('data:') ? photo.photo_url : null)
                        const imgTag = `<img src="${src}" alt="${photo.photo_name || (isEnglish ? 'Vehicle photo' : '차량 사진')}" width="250" height="250" style="max-width: 250px; max-height: 250px; width: auto; height: auto; display: block; transition: transform 0.2s; object-fit: cover;" loading="lazy" />`
                        const wrapStyle = 'display: block; text-decoration: none; flex: 1; display: flex; align-items: center; justify-content: center;'
                        return `
                      <div class="media-item" style="width: 100%; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column;">
                        ${linkUrl ? `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" style="${wrapStyle} cursor: pointer;">${imgTag}</a>` : `<span style="${wrapStyle} cursor: default;">${imgTag}</span>`}
                      </div>
                    `}).join('')}
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

          ${chatRoomCode ? renderTourChatRoomEmailSectionHtml(chatRoomCode, isEnglish) : ''}

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

