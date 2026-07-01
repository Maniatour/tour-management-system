import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { generatePickupScheduleEmailContent } from '@/app/api/send-pickup-schedule-notification/route'
import { getGoblinTourWeatherData, normalizeDate } from '@/lib/weatherApi'
import { fetchProductDetailsForReservationEmail } from '@/lib/fetchProductDetailsForEmail'
import { resolveReservationEmailIsEnglish } from '@/lib/reservationEmailLocale'

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

async function fetchPickupHotel(
  routeDb: SupabaseClient,
  pickupHotelId: string | null | undefined
) {
  if (!pickupHotelId) return null
  const { data: hotelData } = await routeDb
    .from('pickup_hotels')
    .select('id, hotel, pick_up_location, address, link, media')
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

async function fetchAllPickups(
  routeDb: SupabaseClient,
  params: {
    tourData: Record<string, unknown> | null
    productId?: string | null
    tourDate: string
  }
) {
  const { tourData, productId, tourDate } = params
  let allPickups: Record<string, unknown>[] = []

  const mapReservationToPickup = async (res: Record<string, unknown>) => {
    const { data: customerInfo } = await routeDb
      .from('customers')
      .select('name')
      .eq('id', res.customer_id as string)
      .maybeSingle()

    const { data: hotelInfo } = await routeDb
      .from('pickup_hotels')
      .select('hotel, pick_up_location, address, link')
      .eq('id', res.pickup_hotel as string)
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
      tour_date: res.tour_date,
    }
  }

  if (tourData?.reservation_ids) {
    const reservationIds = normalizeIds(tourData.reservation_ids)
    if (reservationIds.length > 0) {
      const { data: allReservations } = await routeDb
        .from('reservations')
        .select('id, pickup_hotel, pickup_time, customer_id, total_people, tour_date, status')
        .in('id', reservationIds)
        .not('pickup_time', 'is', null)
        .not('pickup_hotel', 'is', null)
        .neq('status', 'cancelled')

      if (allReservations?.length) {
        allPickups = await Promise.all(allReservations.map(mapReservationToPickup))
      }
    }
  } else if (productId && tourDate) {
    const { data: allReservations } = await routeDb
      .from('reservations')
      .select('id, pickup_hotel, pickup_time, customer_id, total_people, tour_date, status')
      .eq('product_id', productId)
      .eq('tour_date', tourDate)
      .not('pickup_time', 'is', null)
      .not('pickup_hotel', 'is', null)
      .neq('status', 'cancelled')

    if (allReservations?.length) {
      allPickups = await Promise.all(allReservations.map(mapReservationToPickup))
    }
  }

  return sortAndDedupePickups(allPickups, tourDate)
}

async function fetchTourDetailsForPickup(
  routeDb: SupabaseClient,
  tourData: Record<string, unknown>
) {
  let tourGuideInfo = null
  let assistantInfo = null
  let vehicleInfo = null

  const teamDb = supabaseAdmin ?? supabase
  if (tourData.tour_guide_id) {
    const { data: guideData } = await teamDb
      .from('team')
      .select('name_ko, name_en, phone, email, languages')
      .eq('email', tourData.tour_guide_id as string)
      .maybeSingle()
    tourGuideInfo = guideData
  }

  if (tourData.assistant_id) {
    const { data: assistantData } = await teamDb
      .from('team')
      .select('name_ko, name_en, phone, email')
      .eq('email', tourData.assistant_id as string)
      .maybeSingle()
    assistantInfo = assistantData
  }

  if (tourData.tour_car_id) {
    const vehiclesDb = supabaseAdmin ?? supabase
    const { data: vehicleData } = await vehiclesDb
      .from('vehicles')
      .select('vehicle_type, capacity, color')
      .eq('id', tourData.tour_car_id as string)
      .maybeSingle()

    if (vehicleData?.vehicle_type) {
      const { data: vehicleTypeData } = await routeDb
        .from('vehicle_types')
        .select('id, name, brand, model, passenger_capacity, description')
        .eq('name', vehicleData.vehicle_type)
        .maybeSingle()

      const { data: typePhotosData } = await routeDb
        .from('vehicle_type_photos')
        .select('photo_url, photo_name, description, is_primary, display_order')
        .eq('vehicle_type_id', vehicleTypeData?.id || '')
        .order('display_order', { ascending: true })
        .order('is_primary', { ascending: false })

      const { data: vehiclePhotosData } = await routeDb
        .from('vehicle_photos')
        .select('photo_url, photo_name, is_primary, display_order')
        .eq('vehicle_id', tourData.tour_car_id as string)
        .order('display_order', { ascending: true })
        .order('is_primary', { ascending: false })

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

      const processedTypePhotos = (typePhotosData || [])
        .map(toPublicPhotoUrl)
        .filter((p): p is Record<string, unknown> => p !== null)
      const processedVehiclePhotos = (vehiclePhotosData || [])
        .map(toPublicPhotoUrl)
        .filter((p): p is Record<string, unknown> => p !== null)
      const displayPhotos =
        processedVehiclePhotos.length > 0 ? processedVehiclePhotos : processedTypePhotos

      const displayPhotosWithViewUrl = await Promise.all(
        displayPhotos.map(async (photo) => {
          const photoUrl = String(photo.photo_url ?? '')
          if (!photoUrl.startsWith('data:image')) {
            return { ...photo, viewUrl: photoUrl }
          }
          try {
            const [header, base64] = photoUrl.split(',')
            const mime = (header.match(/data:(.+);/)?.[1] || 'image/jpeg').trim()
            const ext = (mime.split('/')[1] || 'jpg').replace(/\+xml$/, '') || 'jpg'
            const buffer = Buffer.from(base64, 'base64')
            const path = `email-view/${crypto.randomUUID()}.${ext}`
            const { error } = await supabase.storage
              .from('images')
              .upload(path, buffer, { contentType: mime, upsert: false })
            if (error) return { ...photo, viewUrl: null }
            const {
              data: { publicUrl },
            } = supabase.storage.from('images').getPublicUrl(path)
            return { ...photo, viewUrl: simplifyUrl(publicUrl) }
          } catch {
            return { ...photo, viewUrl: null }
          }
        })
      )

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
  }

  return {
    ...tourData,
    tour_guide: tourGuideInfo,
    assistant: assistantInfo,
    vehicle: vehicleInfo,
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

  let pickupHotel = await fetchPickupHotel(routeDb, reservation.pickup_hotel as string | undefined)
  if (!pickupHotel && useSamplePickupFallback) {
    pickupHotel = samplePickupHotel(isEnglish)
  }

  const tourData = await findTourData(routeDb, {
    reservationId,
    productId,
    tourDate,
    ...(tourId ? { tourId } : {}),
  })

  let allPickups = await fetchAllPickups(routeDb, {
    tourData,
    productId,
    tourDate,
  })

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

  let tourDetails: Record<string, unknown> | null = null
  if (tourData) {
    tourDetails = await fetchTourDetailsForPickup(routeDb, tourData)
  }

  let chatRoomCode: string | null = null
  if (tourData?.id) {
    const { data: chatRoomData } = await routeDb
      .from('chat_rooms')
      .select('room_code')
      .eq('tour_id', tourData.id as string)
      .eq('is_active', true)
      .maybeSingle()
    chatRoomCode = chatRoomData?.room_code ?? null
  }

  let tourDayWeather: Awaited<ReturnType<typeof getGoblinTourWeatherData>> | null = null
  try {
    tourDayWeather = await getGoblinTourWeatherData(normalizeDate(tourDate))
  } catch {
    tourDayWeather = null
  }

  let preparationInfo: string | null = null
  if (preparationInfoOverride !== undefined && preparationInfoOverride !== null) {
    preparationInfo =
      typeof preparationInfoOverride === 'string'
        ? preparationInfoOverride
        : String(preparationInfoOverride)
  } else if (productId) {
    const languageCode = isEnglish ? 'en' : 'ko'
    const row = await fetchProductDetailsForReservationEmail(routeDb, {
      productId,
      languageCode,
      channelId: (reservation.channel_id as string | null | undefined) ?? null,
      variantKey: (reservation.variant_key as string | undefined) ?? 'default',
      channelsLookupClient: supabaseAdmin ?? supabase,
    })
    preparationInfo = (row?.preparation_info as string) ?? null
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
