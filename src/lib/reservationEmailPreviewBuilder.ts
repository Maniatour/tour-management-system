import type { SupabaseClient } from '@supabase/supabase-js'
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

export type ReservationEmailPreviewType = 'receipt' | 'voucher' | 'both'

export type ReservationEmailPreviewResult = {
  emailContent: {
    subject: string
    html: string
    customer: {
      name: string
      email: string
      language: string | null | undefined
    }
  }
  productDetailEdit: Record<string, unknown> | null
}

type BuildParams = {
  reservation: Record<string, unknown>
  customer: { name: string; email: string; language?: string | null }
  product: Record<string, unknown>
  type?: ReservationEmailPreviewType
  locale?: 'ko' | 'en'
  includePriceInfo?: boolean
  injectProductDetailEditMarkers?: boolean
  db?: SupabaseClient
}

const PRODUCT_SELECT =
  'id, name, name_ko, name_en, customer_name_ko, customer_name_en, duration, departure_city, arrival_city, base_price'

export async function buildReservationEmailPreview(
  params: BuildParams
): Promise<ReservationEmailPreviewResult> {
  const {
    reservation,
    customer,
    product,
    type = 'both',
    locale: localeParam,
    includePriceInfo = true,
    injectProductDetailEditMarkers = true,
    db,
  } = params

  const emailRouteDb = db ?? supabaseAdmin ?? supabase
  const reservationId = String(reservation.id ?? '')
  const productId = String(reservation.product_id ?? product.id ?? '')

  if (!productId) {
    throw new Error('상품 ID가 없습니다.')
  }

  const isEnglish = resolveReservationEmailIsEnglish(customer.language, localeParam)
  const languageCode = isEnglish ? 'en' : 'ko'

  const reservationExtra = reservation
  const reservationForEmail: Record<string, unknown> = {
    ...reservation,
    customer_name: customer.name,
    adults: (reservation.adults as number | undefined) ?? 0,
    children:
      (reservation.child as number | undefined) ??
      (reservationExtra.children as number | undefined) ??
      0,
    infants:
      (reservation.infant as number | undefined) ??
      (reservationExtra.infants as number | undefined) ??
      0,
    total_price: (reservationExtra.total_price as number | undefined) ?? 0,
  }

  let pricing = null
  if (reservationId && !reservationId.startsWith('00000000')) {
    const { data: pricingData } = await emailRouteDb
      .from('reservation_pricing')
      .select('*')
      .eq('reservation_id', reservationId)
      .maybeSingle()
    pricing = pricingData
  }

  const channelsLookupClient = supabaseAdmin ?? supabase
  const productDetails = await fetchProductDetailsForReservationEmail(emailRouteDb, {
    productId,
    languageCode,
    channelId: (reservation.channel_id as string | null | undefined) ?? null,
    variantKey: (reservation as { variant_key?: string }).variant_key ?? 'default',
    channelsLookupClient,
  })

  let channelName: string | null = null
  if (reservation.channel_id) {
    const { data: ch } = await emailRouteDb
      .from('channels')
      .select('name')
      .eq('id', reservation.channel_id as string)
      .maybeSingle()
    if (ch?.name) channelName = ch.name
  }

  const productDisplayName = isEnglish
    ? (product.customer_name_en as string | undefined) ||
      (product.name_en as string | undefined) ||
      (product.name as string | undefined)
    : (product.customer_name_ko as string | undefined) ||
      (product.name_ko as string | undefined) ||
      (product.name as string | undefined)

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
            productDetails.channel_id != null ? String(productDetails.channel_id) : null,
          variantKey: String(productDetails.variant_key ?? 'default'),
          languageCode: String(productDetails.language_code ?? languageCode),
          channelName,
          productDisplayName: productDisplayName || '',
          sourceLabel,
        },
        fieldValues: pickProductDetailFieldValues(productDetails as Record<string, unknown>),
        sectionTitles: sectionTitlesParsed,
        customerPageVisibility: parseCustomerPageVisibilityJson(rawCustomerPageVisibility),
      }
    : null

  const { data: schedulesData } = await emailRouteDb
    .from('product_schedules')
    .select(
      'id, day_number, start_time, end_time, title_ko, title_en, description_ko, description_en, show_to_customers, order_index'
    )
    .eq('product_id', productId)
    .eq('show_to_customers', true)
    .order('day_number', { ascending: true })
    .order('order_index', { ascending: true })

  const productSchedules = schedulesData || []

  let tourStatus: string | null = null
  let tourDetails: Record<string, unknown> | null = null

  if (reservation.tour_id) {
    const { data: tourData } = await emailRouteDb
      .from('tours')
      .select('*')
      .eq('id', reservation.tour_id as string)
      .maybeSingle()

    tourStatus = tourData?.tour_status || (reservation.status as string | undefined) || null

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
            vehicle_type_info: vehicleTypeData
              ? {
                  name: vehicleTypeData.name,
                  brand: vehicleTypeData.brand,
                  model: vehicleTypeData.model,
                  passenger_capacity:
                    vehicleTypeData.passenger_capacity || vehicleData.capacity,
                  description: vehicleTypeData.description,
                }
              : {
                  name: vehicleData.vehicle_type,
                  passenger_capacity: vehicleData.capacity,
                },
            vehicle_type_photos: photosData || [],
          }
        }
      }

      tourDetails = {
        ...tourData,
        tour_guide: tourGuideInfo,
        assistant: assistantInfo,
        vehicle: vehicleInfo,
      }
    }
  } else {
    tourStatus = (reservation.status as string | undefined) ?? null
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

  const isDepartureConfirmation = type === 'voucher'
  const includeGcSunriseEmailBlock =
    (type === 'voucher' || type === 'both') && isGoblinGrandCanyonSunriseTour(product as never)
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
  const { data: pcRows } = await emailRouteDb
    .from('product_choices')
    .select('id, choice_group_ko, choice_group, options')
    .eq('product_id', productId)
  productChoicesForEmail = (pcRows as ProductChoiceRowForResidentFees[] | null) ?? null

  let reservationOptionLines: Awaited<
    ReturnType<typeof fetchReservationOptionLinesForEmail>
  > = []
  if (reservationId && !reservationId.startsWith('00000000')) {
    reservationOptionLines = await fetchReservationOptionLinesForEmail(
      emailRouteDb,
      reservationId,
      isEnglish
    )
  }

  const emailContent = generateEmailContent(
    reservationForEmail,
    customer,
    product as never,
    pricing,
    productDetails,
    productSchedules,
    tourStatus,
    tourDetails,
    type,
    isEnglish,
    isDepartureConfirmation,
    {
      injectProductDetailEditMarkers: injectProductDetailEditMarkers && !!productDetails,
      pickupHotel: pickupHotelForEmail,
      grandCanyonSunrisePickup,
      productChoices: productChoicesForEmail,
      reservationOptionLines,
      includePriceInfo: includePriceInfo !== false,
    }
  )

  return {
    emailContent: {
      ...emailContent,
      customer: {
        name: customer.name,
        email: customer.email,
        language: customer.language,
      },
    },
    productDetailEdit,
  }
}

export type ProductEmailPreviewContext = {
  product: Record<string, unknown>
  reservation: Record<string, unknown>
  customer: { name: string; email: string; language?: string | null }
  usedSampleData: boolean
}

/** 상품 ID 기준 — 최근 예약 또는 샘플 데이터로 미리보기 컨텍스트 구성 */
export async function resolveProductEmailPreviewContext(
  productId: string,
  locale: 'ko' | 'en' = 'ko',
  db?: SupabaseClient
): Promise<ProductEmailPreviewContext> {
  const emailRouteDb = db ?? supabaseAdmin ?? supabase

  const { data: product, error: productError } = await emailRouteDb
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('id', productId)
    .single()

  if (productError || !product) {
    throw new Error('상품을 찾을 수 없습니다.')
  }

  const { data: reservation } = await emailRouteDb
    .from('reservations')
    .select('*')
    .eq('product_id', productId)
    .not('customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (reservation?.customer_id) {
    const { data: customer } = await emailRouteDb
      .from('customers')
      .select('id, name, email, language')
      .eq('id', reservation.customer_id)
      .maybeSingle()

    if (customer) {
      return { product, reservation, customer, usedSampleData: false }
    }
  }

  const tourDate = new Date()
  tourDate.setDate(tourDate.getDate() + 14)
  const tourDateStr = tourDate.toISOString().split('T')[0]!
  const basePrice = (product.base_price as number | undefined) ?? 0
  const isEnglish = locale === 'en'

  return {
    product,
    usedSampleData: true,
    reservation: {
      id: '00000000-0000-0000-0000-000000000001',
      product_id: productId,
      customer_id: null,
      tour_date: tourDateStr,
      adults: 2,
      child: 0,
      infant: 0,
      status: 'confirmed',
      channel_id: null,
      variant_key: 'default',
      total_price: basePrice * 2,
      pickup_time: '07:30:00',
      total_people: 2,
    },
    customer: {
      name: isEnglish ? 'Sample Customer (Preview)' : '홍길동 (미리보기)',
      email: 'preview@example.com',
      language: locale,
    },
  }
}
