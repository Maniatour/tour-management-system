import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { generatePickupScheduleEmailContent } from '@/app/api/send-pickup-schedule-notification/route'
import { getGoblinTourWeatherData, normalizeDate } from '@/lib/weatherApi'
import { fetchProductDetailsForReservationEmail } from '@/lib/fetchProductDetailsForEmail'
import { resolveReservationEmailIsEnglish } from '@/lib/reservationEmailLocale'
import {
  getEffectivePickupHotelId,
  loadPickupResolveContextForTour,
  type PickupResolveContext,
} from '@/lib/pickupGroupPreset'
import type { PickupHotel as PickupHotelUtil } from '@/utils/pickupHotelUtils'

export type PickupScheduleEmailPreviewResult = {
  emailContent: {
    subject: string
    html: string
    customer: {
      name: string
      email: string
      language: string | null | undefined
    }
  }
  preparationInfo: string
}

export type BuildPickupScheduleEmailPreviewParams = {
  reservationId: string
  reservation: Record<string, unknown>
  customer: { name: string; email: string; language?: string | null }
  product: Record<string, unknown> | null
  pickupTime: string
  tourDate: string
  locale?: 'ko' | 'en'
  tourId?: string | null
  preparationInfoOverride?: string | null
  imageProxyBaseUrl?: string | null
  /** 예약·투어 데이터 없을 때 샘플 픽업 정보 사용 */
  useSamplePickupFallback?: boolean
  db?: SupabaseClient
}

function normalizeIds(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter((v) => v.length > 0)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        return Array.isArray(parsed)
          ? parsed.map((v: unknown) => String(v).trim()).filter((v: string) => v.length > 0)
          : []
      } catch {
        return []
      }
    }
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    }
    return trimmed.length > 0 ? [trimmed] : []
  }
  return []
}

function normalizePickupTime(pickupTime: string): string {
  if (!pickupTime) return '07:30:00'
  return pickupTime.includes(':') && pickupTime.split(':').length === 2
    ? `${pickupTime}:00`
    : pickupTime
}

function sortAndDedupePickups(allPickups: Record<string, unknown>[], tourDate: string) {
  if (allPickups.length === 0) return allPickups

  const uniquePickups = new Map<string, Record<string, unknown>>()
  allPickups.forEach((pickup) => {
    const normalizedTime = pickup.pickup_time
      ? String(pickup.pickup_time).substring(0, 5)
      : ''
    const key = `${normalizedTime}-${pickup.hotel_name}`
    if (!uniquePickups.has(key)) uniquePickups.set(key, pickup)
  })

  const sorted = Array.from(uniquePickups.values())
  sorted.sort((a, b) => {
    const parseTime = (time: string) => {
      if (!time) return 0
      const [hours, minutes] = time.split(':').map(Number)
      return hours * 60 + (minutes || 0)
    }
    const parseDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(year, month - 1, day)
    }
    const timeA = parseTime(String(a.pickup_time ?? ''))
    const timeB = parseTime(String(b.pickup_time ?? ''))
    const referenceTime = 21 * 60
    let dateA = parseDate(String(a.tour_date || tourDate))
    let dateB = parseDate(String(b.tour_date || tourDate))
    if (timeA >= referenceTime) {
      dateA = new Date(dateA)
      dateA.setDate(dateA.getDate() - 1)
    }
    if (timeB >= referenceTime) {
      dateB = new Date(dateB)
      dateB.setDate(dateB.getDate() - 1)
    }
    return dateA.getTime() + timeA * 60 * 1000 - (dateB.getTime() + timeB * 60 * 1000)
  })
  return sorted
}

function samplePickupHotel(isEnglish: boolean) {
  return {
    id: 'preview-sample-hotel',
    hotel: isEnglish ? 'Sample Hotel (Preview)' : '샘플 호텔 (미리보기)',
    pick_up_location: isEnglish ? 'Main lobby' : '1층 로비',
    address: isEnglish ? '123 Sample Blvd, Las Vegas, NV' : '샘플 주소, 라스베이거스',
    link: null,
    media: null,
  }
}

const PICKUP_HOTEL_EMAIL_SELECT =
  'id, hotel, pick_up_location, address, link, media, description_ko, description_en, from_inside_hotel_ko, from_inside_hotel_en, from_outside_hotel_ko, from_outside_hotel_en'

async function fetchPickupHotel(
  routeDb: SupabaseClient,
  pickupHotelId: string | null | undefined
) {
  if (!pickupHotelId) return null
  const { data: hotelData } = await routeDb
    .from('pickup_hotels')
    .select(PICKUP_HOTEL_EMAIL_SELECT)
    .eq('id', pickupHotelId)
    .maybeSingle()
  return hotelData
}

async function findTourData(
  routeDb: SupabaseClient,
  params: {
    tourId?: string | null
    reservationId: string
    productId?: string | null
    tourDate: string
  }
) {
  const { tourId, reservationId, productId, tourDate } = params
  let tourData: Record<string, unknown> | null = null

  if (tourId) {
    const { data: tourDataById } = await routeDb
      .from('tours')
      .select('*')
      .eq('id', tourId)
      .maybeSingle()
    if (tourDataById) tourData = tourDataById
  } else if (productId && tourDate) {
    const { data: toursByProduct } = await routeDb
      .from('tours')
      .select('*')
      .eq('product_id', productId)
      .eq('tour_date', tourDate)

    const normalizedReservationId = String(reservationId).trim()
    for (const tour of toursByProduct ?? []) {
      const reservationIds = normalizeIds((tour as Record<string, unknown>).reservation_ids)
      if (reservationIds.some((id) => String(id).trim() === normalizedReservationId)) {
        tourData = tour as Record<string, unknown>
        break
      }
    }
  }

  return tourData
}

async function fetchAllPickupHotelsCatalog(routeDb: SupabaseClient): Promise<PickupHotelUtil[]> {
  const { data } = await routeDb
    .from('pickup_hotels')
    .select('*')
    .eq('use_for_pickup', true)
    .or('is_active.is.null,is_active.eq.true')
  return (data || []) as PickupHotelUtil[]
}

type PickupHotelEmailRow = {
  id: string
  hotel: string | null
  pick_up_location: string | null
  address: string | null
  link: string | null
  description_ko: string | null
  description_en: string | null
  from_inside_hotel_ko: string | null
  from_inside_hotel_en: string | null
  from_outside_hotel_ko: string | null
  from_outside_hotel_en: string | null
}

async function fetchAllPickups(
  routeDb: SupabaseClient,
  params: {
    tourData: Record<string, unknown> | null
    productId?: string | null
    tourDate: string
    pickupContext?: PickupResolveContext
    pickupHotelsCatalog?: PickupHotelUtil[]
  }
) {
  const { tourData, productId, tourDate, pickupContext = { useRepresentativePickup: false } } =
    params
  let allReservations: Record<string, unknown>[] = []
  const hotelsCatalog =
    params.pickupHotelsCatalog ??
    (pickupContext.preset || pickupContext.useRepresentativePickup
      ? await fetchAllPickupHotelsCatalog(routeDb)
      : [])

  if (tourData?.reservation_ids) {
    const reservationIds = normalizeIds(tourData.reservation_ids)
    if (reservationIds.length > 0) {
      const { data } = await routeDb
        .from('reservations')
        .select('id, pickup_hotel, pickup_time, customer_id, total_people, tour_date, status')
        .in('id', reservationIds)
        .not('pickup_time', 'is', null)
        .not('pickup_hotel', 'is', null)
        .neq('status', 'cancelled')
      allReservations = (data ?? []) as Record<string, unknown>[]
    }
  } else if (productId && tourDate) {
    const { data } = await routeDb
      .from('reservations')
      .select('id, pickup_hotel, pickup_time, customer_id, total_people, tour_date, status')
      .eq('product_id', productId)
      .eq('tour_date', tourDate)
      .not('pickup_time', 'is', null)
      .not('pickup_hotel', 'is', null)
      .neq('status', 'cancelled')
    allReservations = (data ?? []) as Record<string, unknown>[]
  }

  if (allReservations.length === 0) {
    return []
  }

  const customerIds = [
    ...new Set(
      allReservations
        .map((r) => (r.customer_id ? String(r.customer_id) : ''))
        .filter((id) => id.length > 0)
    ),
  ]
  const effectiveHotelIds = [
    ...new Set(
      allReservations
        .map((r) => {
          const requested = r.pickup_hotel ? String(r.pickup_hotel) : ''
          if (!requested) return ''
          return (
            getEffectivePickupHotelId(requested, hotelsCatalog, pickupContext) || requested
          )
        })
        .filter((id) => id.length > 0)
    ),
  ]

  const [customersResult, hotelsResult] = await Promise.all([
    customerIds.length > 0
      ? routeDb.from('customers').select('id, name').in('id', customerIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
    effectiveHotelIds.length > 0
      ? routeDb
          .from('pickup_hotels')
          .select(
            'id, hotel, pick_up_location, address, link, description_ko, description_en, from_inside_hotel_ko, from_inside_hotel_en, from_outside_hotel_ko, from_outside_hotel_en'
          )
          .in('id', effectiveHotelIds)
      : Promise.resolve({ data: [] as PickupHotelEmailRow[] }),
  ])

  const customerNameById = new Map(
    ((customersResult.data ?? []) as { id: string; name: string | null }[]).map((c) => [
      c.id,
      c.name || 'Unknown Customer',
    ])
  )
  const hotelById = new Map(
    ((hotelsResult.data ?? []) as PickupHotelEmailRow[]).map((h) => [h.id, h])
  )

  const allPickups = allReservations.map((res) => {
    const requestedHotelId = res.pickup_hotel ? String(res.pickup_hotel) : ''
    const effectiveHotelId =
      getEffectivePickupHotelId(requestedHotelId, hotelsCatalog, pickupContext) ||
      requestedHotelId
    const hotelInfo = hotelById.get(effectiveHotelId)
    const customerId = res.customer_id ? String(res.customer_id) : ''

    return {
      reservation_id: res.id,
      pickup_time: res.pickup_time || '',
      pickup_hotel: effectiveHotelId || '',
      hotel_name: hotelInfo?.hotel || 'Unknown Hotel',
      pick_up_location: hotelInfo?.pick_up_location || '',
      address: hotelInfo?.address || '',
      link: hotelInfo?.link || '',
      description_ko: hotelInfo?.description_ko ?? null,
      description_en: hotelInfo?.description_en ?? null,
      from_inside_hotel_ko: hotelInfo?.from_inside_hotel_ko ?? null,
      from_inside_hotel_en: hotelInfo?.from_inside_hotel_en ?? null,
      from_outside_hotel_ko: hotelInfo?.from_outside_hotel_ko ?? null,
      from_outside_hotel_en: hotelInfo?.from_outside_hotel_en ?? null,
      customer_name: customerNameById.get(customerId) || 'Unknown Customer',
      total_people: res.total_people,
      tour_date: res.tour_date,
    }
  })

  return sortAndDedupePickups(allPickups, tourDate)
}

/**
 * 이메일 미리보기용 — Storage 업로드 없이 공개 URL만 해석.
 * (발송 API는 data URL을 임시 업로드하지만, 미리보기에서 하면 504의 주원인)
 */
async function fetchTourDetailsForPickup(
  routeDb: SupabaseClient,
  tourData: Record<string, unknown>
) {
  let tourGuideInfo = null
  let assistantInfo = null
  let vehicleInfo = null

  const teamDb = supabaseAdmin ?? supabase
  const guidePromise = tourData.tour_guide_id
    ? teamDb
        .from('team')
        .select('name_ko, name_en, phone, email, languages')
        .eq('email', tourData.tour_guide_id as string)
        .maybeSingle()
    : Promise.resolve({ data: null })

  const assistantPromise = tourData.assistant_id
    ? teamDb
        .from('team')
        .select('name_ko, name_en, phone, email')
        .eq('email', tourData.assistant_id as string)
        .maybeSingle()
    : Promise.resolve({ data: null })

  const vehiclesDb = supabaseAdmin ?? supabase
  const vehiclePromise = tourData.tour_car_id
    ? vehiclesDb
        .from('vehicles')
        .select('vehicle_type, capacity, color')
        .eq('id', tourData.tour_car_id as string)
        .maybeSingle()
    : Promise.resolve({ data: null })

  const [guideResult, assistantResult, vehicleResult] = await Promise.all([
    guidePromise,
    assistantPromise,
    vehiclePromise,
  ])
  tourGuideInfo = guideResult.data
  assistantInfo = assistantResult.data
  const vehicleData = vehicleResult.data

  if (vehicleData?.vehicle_type) {
    const { data: vehicleTypeData } = await routeDb
      .from('vehicle_types')
      .select('id, name, brand, model, passenger_capacity, description')
      .eq('name', vehicleData.vehicle_type)
      .maybeSingle()

    const [typePhotosResult, vehiclePhotosResult] = await Promise.all([
      routeDb
        .from('vehicle_type_photos')
        .select('photo_url, photo_name, description, is_primary, display_order')
        .eq('vehicle_type_id', vehicleTypeData?.id || '')
        .order('display_order', { ascending: true })
        .order('is_primary', { ascending: false }),
      tourData.tour_car_id
        ? routeDb
            .from('vehicle_photos')
            .select('photo_url, photo_name, is_primary, display_order')
            .eq('vehicle_id', tourData.tour_car_id as string)
            .order('display_order', { ascending: true })
            .order('is_primary', { ascending: false })
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ])

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

    const toPublicPhotoUrl = (photo: Record<string, unknown>) => {
      if (!photo.photo_url) return null
      const photoUrl = String(photo.photo_url)
      if (photoUrl.startsWith('data:image')) return { ...photo, photo_url: photoUrl }
      if (!photoUrl.startsWith('http') && !photoUrl.startsWith('data:')) {
        try {
          const {
            data: { publicUrl },
          } = supabase.storage.from('images').getPublicUrl(photoUrl)
          return { ...photo, photo_url: simplifyUrl(publicUrl) }
        } catch {
          return photo
        }
      }
      if (photoUrl.startsWith('http')) {
        return { ...photo, photo_url: simplifyUrl(photoUrl) }
      }
      return photo
    }

    const processedTypePhotos = (typePhotosResult.data || [])
      .map((p) => toPublicPhotoUrl(p as Record<string, unknown>))
      .filter((p): p is Record<string, unknown> => p !== null)
    const processedVehiclePhotos = (vehiclePhotosResult.data || [])
      .map((p) => toPublicPhotoUrl(p as Record<string, unknown>))
      .filter((p): p is Record<string, unknown> => p !== null)
    const displayPhotos =
      processedVehiclePhotos.length > 0 ? processedVehiclePhotos : processedTypePhotos

    // 미리보기: data URL은 그대로 사용 (Storage 업로드 생략)
    const displayPhotosWithViewUrl = displayPhotos.map((photo) => {
      const photoUrl = String(photo.photo_url ?? '')
      return {
        ...photo,
        viewUrl: photoUrl.startsWith('data:image') ? null : photoUrl || null,
      }
    })

    vehicleInfo = {
      vehicle_type: vehicleData.vehicle_type,
      color: vehicleData.color,
      vehicle_type_info: vehicleTypeData
        ? {
            name: vehicleTypeData.name,
            brand: vehicleTypeData.brand,
            model: vehicleTypeData.model,
            passenger_capacity: vehicleTypeData.passenger_capacity || vehicleData.capacity,
            description: vehicleTypeData.description,
          }
        : {
            name: vehicleData.vehicle_type,
            passenger_capacity: vehicleData.capacity,
          },
      vehicle_type_photos: displayPhotosWithViewUrl,
    }
  }

  return {
    ...tourData,
    tour_guide: tourGuideInfo,
    assistant: assistantInfo,
    vehicle: vehicleInfo,
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function buildPickupScheduleEmailPreview(
  params: BuildPickupScheduleEmailPreviewParams
): Promise<PickupScheduleEmailPreviewResult> {
  const {
    reservationId,
    reservation,
    customer,
    product,
    pickupTime: pickupTimeRaw,
    tourDate,
    locale: localeParam,
    tourId,
    preparationInfoOverride,
    imageProxyBaseUrl,
    useSamplePickupFallback = false,
    db,
  } = params

  const routeDb = db ?? supabaseAdmin ?? supabase
  const pickupTime = normalizePickupTime(pickupTimeRaw)
  const isEnglish = resolveReservationEmailIsEnglish(customer.language, localeParam)
  const productId = (reservation.product_id as string | undefined) ?? null

  let pickupHotel = null
  let requestedPickupHotel = null

  const tourData = await findTourData(routeDb, {
    reservationId,
    productId,
    tourDate,
    ...(tourId ? { tourId } : {}),
  })

  const { context: pickupContext, hotelsCatalog: pickupHotelsCatalog } = tourData
    ? await loadPickupResolveContextForTour(routeDb, tourData)
    : { context: { useRepresentativePickup: false }, hotelsCatalog: [] as PickupHotelUtil[] }

  if (reservation.pickup_hotel) {
    requestedPickupHotel = await fetchPickupHotel(routeDb, reservation.pickup_hotel as string)
    const effectiveId =
      getEffectivePickupHotelId(
        reservation.pickup_hotel as string,
        pickupHotelsCatalog,
        pickupContext
      ) || (reservation.pickup_hotel as string)
    pickupHotel =
      effectiveId === reservation.pickup_hotel
        ? requestedPickupHotel
        : await fetchPickupHotel(routeDb, effectiveId)
  }
  if (!pickupHotel && useSamplePickupFallback) {
    pickupHotel = samplePickupHotel(isEnglish)
  }

  // 픽업 목록·투어 상세·채팅·날씨·준비물 정보를 병렬 조회 (미리보기 지연·504 방지)
  const languageCode = isEnglish ? 'en' : 'ko'
  const [
    allPickupsRaw,
    tourDetailsRaw,
    chatRoomResult,
    tourDayWeather,
    preparationRow,
  ] = await Promise.all([
    fetchAllPickups(routeDb, {
      tourData,
      productId,
      tourDate,
      pickupContext,
      pickupHotelsCatalog,
    }),
    tourData ? fetchTourDetailsForPickup(routeDb, tourData) : Promise.resolve(null),
    tourData?.id
      ? routeDb
          .from('chat_rooms')
          .select('room_code')
          .eq('tour_id', tourData.id as string)
          .eq('is_active', true)
          .maybeSingle()
      : Promise.resolve({ data: null as { room_code: string } | null }),
    // 외부 날씨 API 폴백이 길면 미리보기만 먼저 반환
    withTimeout(getGoblinTourWeatherData(normalizeDate(tourDate)), 2500).catch(() => null),
    preparationInfoOverride !== undefined && preparationInfoOverride !== null
      ? Promise.resolve(null)
      : productId
        ? fetchProductDetailsForReservationEmail(routeDb, {
            productId,
            languageCode,
            channelId: (reservation.channel_id as string | null | undefined) ?? null,
            variantKey: (reservation.variant_key as string | undefined) ?? 'default',
            channelsLookupClient: supabaseAdmin ?? supabase,
          })
        : Promise.resolve(null),
  ])

  let allPickups = allPickupsRaw
  if (allPickups.length === 0 && useSamplePickupFallback && pickupHotel) {
    allPickups = [
      {
        reservation_id: reservationId,
        pickup_time: pickupTime,
        pickup_hotel: '',
        hotel_name: pickupHotel.hotel,
        pick_up_location: pickupHotel.pick_up_location,
        address: pickupHotel.address,
        link: pickupHotel.link ?? '',
        customer_name: customer.name,
        total_people: (reservation.total_people as number | undefined) ?? 2,
        tour_date: tourDate,
      },
    ]
  }

  const tourDetails = tourDetailsRaw
  const chatRoomCode = chatRoomResult.data?.room_code ?? null

  let preparationInfo: string | null = null
  if (preparationInfoOverride !== undefined && preparationInfoOverride !== null) {
    preparationInfo =
      typeof preparationInfoOverride === 'string'
        ? preparationInfoOverride
        : String(preparationInfoOverride)
  } else {
    preparationInfo = (preparationRow?.preparation_info as string) ?? null
  }

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
    preparationInfo,
    requestedPickupHotel,
    imageProxyBaseUrl
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
    preparationInfo: preparationInfo ?? '',
  }
}

/** 상품 편집용 — 컨텍스트에서 픽업 시간·투어일 추출 */
export function resolvePickupPreviewTimes(reservation: Record<string, unknown>): {
  tourDate: string
  pickupTime: string
} {
  const tourDateRaw = String(reservation.tour_date ?? '')
  const tourDate = tourDateRaw.split('T')[0] || tourDateRaw
  const pickupTime = String(reservation.pickup_time ?? '07:30:00')
  return { tourDate, pickupTime }
}
