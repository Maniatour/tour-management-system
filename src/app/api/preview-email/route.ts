import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import {
  generateEmailContent,
  type GenerateEmailContentOptions,
} from '@/app/api/send-email/route'
import type { ProductChoiceRowForResidentFees } from '@/utils/usResidentChoiceSync'
import {
  fetchProductDetailsForReservationEmail,
  parseCustomerPageVisibilityJson,
  parseSectionTitlesMap,
  pickProductDetailFieldValues,
} from '@/lib/fetchProductDetailsForEmail'
import { resolveReservationEmailIsEnglish } from '@/lib/reservationEmailLocale'
import { getCachedSunriseSunsetData } from '@/lib/weatherApi'
import {
  buildGrandCanyonSunrisePickupEmailInfo,
  isGoblinGrandCanyonSunriseTour,
} from '@/lib/goblinGrandCanyonSunrisePickup'
import { fetchReservationOptionLinesForEmail } from '@/lib/reservationOptionsForEmail'

export const dynamic = 'force-dynamic'

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
    const { reservationId, type = 'both', locale: localeParam, includePriceInfo } = body

    console.log('[preview-email] 요청 데이터:', { reservationId, type, locale: localeParam })

    if (!reservationId) {
      console.error('[preview-email] 예약 ID 누락')
      return NextResponse.json(
        { error: '예약 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const emailRouteDb = supabaseAdmin ?? supabase

    // 예약 정보 조회 (관계 쿼리 대신 별도 조회로 변경)
    const { data: reservation, error: reservationError } = await emailRouteDb
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
      const { data: productData, error: productError } = await emailRouteDb
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
      const { data: customerData, error: customerError } = await emailRouteDb
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

    const isEnglish = resolveReservationEmailIsEnglish(customer.language, localeParam)
    const languageCode = isEnglish ? 'en' : 'ko'

    console.log('[preview-email] generating email body', {
      customerLanguage: customer.language,
      isEnglish,
      localeParam,
      type,
    })
    console.log('[preview-email] 예약 데이터:', JSON.stringify(reservation, null, 2))
    console.log('[preview-email] 상품 데이터:', JSON.stringify(product, null, 2))

    // reservation 객체에 필요한 필드 추가 (generateEmailContent가 필요로 함)
    // 데이터베이스 스키마: adults, child, infant (단수형)
    // generateEmailContent 기대: adults, children, infants (복수형)
    const reservationExtra = reservation as Record<string, unknown>
    const reservationForEmail = {
      ...reservation,
      customer_name: customer.name,
      adults: reservation.adults ?? 0,
      children: reservation.child ?? (reservationExtra.children as number | undefined) ?? 0,
      infants: reservation.infant ?? (reservationExtra.infants as number | undefined) ?? 0,
      total_price: (reservationExtra.total_price as number | undefined) ?? 0,
    }

    // 가격 정보 조회
    let pricing = null
    const { data: pricingData } = await emailRouteDb
      .from('reservation_pricing')
      .select('*')
      .eq('reservation_id', reservationId)
      .maybeSingle()
    pricing = pricingData

    // 상품 상세 정보 (채널·언어·variant 일치 행 — 리뉴얼 필드 포함 전체 컬럼)
    const channelsLookupClient = supabaseAdmin ?? supabase
    const productId = reservation.product_id
    if (!productId) {
      return NextResponse.json({ error: '상품 ID가 없습니다.' }, { status: 400 })
    }

    const productDetails = await fetchProductDetailsForReservationEmail(emailRouteDb, {
      productId,
      languageCode,
      channelId: reservation.channel_id ?? null,
      variantKey: (reservation as { variant_key?: string }).variant_key ?? 'default',
      channelsLookupClient,
    })

    let channelName: string | null = null
    if (reservation.channel_id) {
      const { data: ch } = await emailRouteDb
        .from('channels')
        .select('name')
        .eq('id', reservation.channel_id)
        .maybeSingle()
      if (ch?.name) channelName = ch.name
    }

    const productDisplayName = isEnglish
      ? (product as { customer_name_en?: string; name_en?: string; name?: string })
          .customer_name_en ||
        (product as { name_en?: string }).name_en ||
        (product as { name?: string }).name
      : (product as { customer_name_ko?: string; name_ko?: string; name?: string })
          .customer_name_ko ||
        (product as { name_ko?: string }).name_ko ||
        (product as { name?: string }).name

    const sourceLabel = channelName
      ? `${channelName} · ${productDisplayName || '상품'}`
      : productDisplayName || '상품'

    const pdRow = productDetails as Record<string, unknown> | null
    const rawSectionTitles = pdRow?.section_titles ?? pdRow?.sectionTitles
    const sectionTitlesParsed = parseSectionTitlesMap(rawSectionTitles)

    const rawCustomerPageVisibility = (
      productDetails as Record<string, unknown> | null
    )?.customer_page_visibility

    const productDetailEdit = productDetails
      ? {
          context: {
            productId: String(productDetails.product_id),
            channelId:
              productDetails.channel_id != null
                ? String(productDetails.channel_id)
                : null,
            variantKey: String(productDetails.variant_key ?? 'default'),
            languageCode: String(
              productDetails.language_code ?? languageCode
            ),
            channelName,
            productDisplayName: productDisplayName || '',
            sourceLabel,
          },
          fieldValues: pickProductDetailFieldValues(
            productDetails as Record<string, unknown>
          ),
          sectionTitles: sectionTitlesParsed,
          customerPageVisibility: parseCustomerPageVisibilityJson(
            rawCustomerPageVisibility
          ),
        }
      : null

    // 투어 스케줄 조회
    let productSchedules = null
    const { data: schedulesData } = await emailRouteDb
      .from('product_schedules')
      .select('id, day_number, start_time, end_time, title_ko, title_en, description_ko, description_en, show_to_customers, order_index')
      .eq('product_id', productId)
      .eq('show_to_customers', true)
      .order('day_number', { ascending: true })
      .order('order_index', { ascending: true })
    productSchedules = schedulesData || []

    // 투어 상태 조회 및 Tour Details 조회
    let tourStatus = null
    let tourDetails: any = null
    if (reservation.tour_id) {
      const { data: tourData } = await emailRouteDb
        .from('tours')
        .select('*')
        .eq('id', reservation.tour_id)
        .maybeSingle()
      
      tourStatus = tourData?.tour_status || reservation.status

      // Tour Details 조회 (가이드, 어시스턴트, 차량 정보)
      if (tourData) {
        let tourGuideInfo = null
        let assistantInfo = null
        let vehicleInfo = null

        const teamDb = supabaseAdmin ?? supabase
        if (tourData.tour_guide_id) {
          const { data: guideData } = await teamDb
            .from('team')
            .select('name_ko, name_en, phone, email, languages')
            .eq('email', tourData.tour_guide_id)
            .maybeSingle()
          tourGuideInfo = guideData
        }

        if (tourData.assistant_id) {
          const { data: assistantData } = await teamDb
            .from('team')
            .select('name_ko, name_en, phone, email')
            .eq('email', tourData.assistant_id)
            .maybeSingle()
          assistantInfo = assistantData
        }

        if (tourData.tour_car_id) {
          const vehiclesDb = supabaseAdmin ?? supabase
          const { data: vehicleData } = await vehiclesDb
            .from('vehicles')
            .select('vehicle_type, capacity, color')
            .eq('id', tourData.tour_car_id)
            .maybeSingle()

          if (vehicleData?.vehicle_type) {
            const { data: vehicleTypeData } = await emailRouteDb
              .from('vehicle_types')
              .select('id, name, brand, model, passenger_capacity, description')
              .eq('name', vehicleData.vehicle_type)
              .maybeSingle()

            const { data: photosData } = await emailRouteDb
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

    let pickupHotelForEmail: GenerateEmailContentOptions['pickupHotel'] = null
    const pickupHotelId = reservationForEmail.pickup_hotel as string | null | undefined
    if (pickupHotelId) {
      const pickupDb = supabaseAdmin ?? supabase
      const { data: hotelRow } = await pickupDb
        .from('pickup_hotels')
        .select('hotel, pick_up_location, address')
        .eq('id', pickupHotelId)
        .maybeSingle()
      if (hotelRow) pickupHotelForEmail = hotelRow
    }

    // 이메일 내용 생성
    const isDepartureConfirmation = type === 'voucher'
    const includeGcSunriseEmailBlock =
      (type === 'voucher' || type === 'both') && product && isGoblinGrandCanyonSunriseTour(product as any)
    let grandCanyonSunrisePickup: GenerateEmailContentOptions['grandCanyonSunrisePickup'] = null
    if (includeGcSunriseEmailBlock) {
      const tourYmd = String(reservationForEmail.tour_date ?? '').split('T')[0]
      if (/^\d{4}-\d{2}-\d{2}$/.test(tourYmd)) {
        let cachedSunrise: string | null = null
        try {
          const sunData = await getCachedSunriseSunsetData('Grand Canyon South Rim', tourYmd)
          cachedSunrise = sunData?.sunrise ?? null
        } catch {
          cachedSunrise = null
        }
        grandCanyonSunrisePickup = buildGrandCanyonSunrisePickupEmailInfo(tourYmd, cachedSunrise)
      }
    }

    let productChoicesForEmail: ProductChoiceRowForResidentFees[] | null = null
    if (reservation.product_id) {
      const { data: pcRows } = await emailRouteDb
        .from('product_choices')
        .select('id, choice_group_ko, choice_group, options')
        .eq('product_id', reservation.product_id)
      productChoicesForEmail = (pcRows as ProductChoiceRowForResidentFees[] | null) ?? null
    }

    const reservationOptionLines = await fetchReservationOptionLinesForEmail(
      emailRouteDb,
      reservationId,
      isEnglish
    )

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
        isDepartureConfirmation,
        {
          injectProductDetailEditMarkers: !!productDetails,
          pickupHotel: pickupHotelForEmail,
          grandCanyonSunrisePickup,
          productChoices: productChoicesForEmail,
          reservationOptionLines,
          includePriceInfo: includePriceInfo !== false,
        }
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
      },
      productDetailEdit,
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


