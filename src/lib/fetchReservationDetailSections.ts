import { supabase } from '@/lib/supabase'
import { getEffectivePickupHotelId } from '@/lib/effectivePickupHotel'
import { loadPickupResolveContextForTour, type PickupResolveContext } from '@/lib/pickupGroupPreset'
import type { PickupHotel as PickupHotelUtil } from '@/utils/pickupHotelUtils'
import type {
  PickupInfo,
  PickupSchedule,
  ProductDetails,
  ProductSchedule,
  ReservationDetails,
  TourDetails,
} from '@/components/customer/customerReservationTypes'

interface SupabaseReservation {
  pickup_hotel?: string | null
  pickup_time?: string | null
  tour_date?: string | null
  tour_time?: string | null
  tour_id?: string
  customer_id?: string
}

interface SupabaseVehicleData {
  vehicle_type: string
  capacity: number
  color?: string
}

interface SupabaseVehicleTypeData {
  id: string
  name: string
  brand: string
  model: string
  passenger_capacity: number
  description?: string
}

interface SupabaseTourDetails {
  id?: string
  tour_guide_id?: string
  assistant_id?: string
  tour_car_id?: string
}

export async function fetchReservationProductDetails(
  productId: string,
  locale: string,
  channelId?: string | null
): Promise<ProductDetails | null> {
  try {
    let productDetails: Record<string, unknown> | null = null

    if (channelId) {
      const { data: channelDetails, error: channelError } = await supabase
        .from('product_details_multilingual')
        .select('*')
        .eq('product_id', productId)
        .eq('language_code', locale)
        .eq('channel_id', channelId)
        .maybeSingle()

      if (!channelError && channelDetails) {
        productDetails = channelDetails
      }
    }

    if (!productDetails) {
      const { data: commonDetails, error: commonError } = await supabase
        .from('product_details_multilingual')
        .select('*')
        .eq('product_id', productId)
        .eq('language_code', locale)
        .is('channel_id', null)
        .maybeSingle()

      if (!commonError && commonDetails) {
        productDetails = commonDetails
      } else if (commonError && commonError.code !== 'PGRST116') {
        console.warn('상품 세부 정보 조회 오류:', commonError)
      }
    }

    if (!productDetails) {
      const { data: anyDetailsArray, error: anyError } = await supabase
        .from('product_details_multilingual')
        .select('*')
        .eq('product_id', productId)
        .eq('language_code', locale)
        .limit(1)

      if (!anyError && anyDetailsArray && anyDetailsArray.length > 0) {
        productDetails = anyDetailsArray[0]
      } else if (anyError && anyError.code !== 'PGRST116') {
        console.warn('상품 세부 정보 조회 오류:', anyError)
      }
    }

    return productDetails as ProductDetails | null
  } catch (error) {
    console.error('상품 세부 정보 조회 중 예외:', error)
    return null
  }
}

export async function fetchReservationPickupSchedule(
  reservationId: string
): Promise<PickupSchedule | null> {
  try {
    const { data: currentReservation, error: reservationError } = await supabase
      .from('reservations')
      .select(`
        pickup_hotel,
        pickup_time,
        tour_date,
        tour_time,
        tour_id,
        customer_id
      `)
      .eq('id', reservationId)
      .single()

    if (reservationError) {
      console.warn('픽업 스케줄 조회 오류:', reservationError)
      return null
    }

    const result: PickupSchedule = {
      ...(currentReservation as SupabaseReservation),
      allPickups: [],
    }

    let pickupContext: PickupResolveContext = {}
    let pickupHotelsCatalog: PickupHotelUtil[] = []
    const tourId = (currentReservation as SupabaseReservation)?.tour_id

    if (tourId) {
      const { data: tourRow } = await supabase
        .from('tours')
        .select('use_representative_pickup, pickup_group_preset_id, pickup_group_mode_overrides, pickup_group_representative_overrides')
        .eq('id', tourId)
        .maybeSingle()
      if (tourRow) {
        const loaded = await loadPickupResolveContextForTour(supabase, tourRow)
        pickupContext = loaded.context
        pickupHotelsCatalog = loaded.hotelsCatalog as PickupHotelUtil[]
      }
    }

    if ((currentReservation as SupabaseReservation)?.pickup_hotel) {
      try {
        const requestedId = (currentReservation as SupabaseReservation).pickup_hotel!
        const effectiveId =
          getEffectivePickupHotelId(requestedId, pickupHotelsCatalog, pickupContext) ||
          requestedId
        const { data: hotelInfo, error: hotelError } = await supabase
          .from('pickup_hotels')
          .select(`
            hotel,
            pick_up_location,
            address,
            description_ko,
            link,
            media,
            youtube_link
          `)
          .eq('id', effectiveId)
          .single()

        if (!hotelError && hotelInfo) {
          result.pickup_hotels = hotelInfo as NonNullable<PickupSchedule['pickup_hotels']>
        } else {
          console.warn('픽업 호텔 정보 조회 실패:', hotelError)
        }
      } catch (error) {
        console.warn('픽업 호텔 정보 조회 중 오류:', error)
      }
    }

    if (tourId) {
      const { data: allReservations, error: allReservationsError } = await supabase
        .from('reservations')
        .select(`
          id,
          pickup_hotel,
          pickup_time,
          customer_id,
          total_people,
          tour_date
        `)
        .eq('tour_id', tourId)
        .not('pickup_time', 'is', null)
        .not('pickup_hotel', 'is', null)

      if (!allReservationsError && allReservations) {
        const pickupInfos = await Promise.all(
          allReservations.map(async (res: {
            id: string
            pickup_hotel: string | null
            pickup_time: string | null
            customer_id: string | null
            total_people: number | null
            tour_date: string
          }) => {
            const { data: customerInfo } = await supabase
              .from('customers')
              .select('name')
              .eq('id', res.customer_id ?? '')
              .single()

            let hotelInfo = null
            try {
              const effectiveId =
                getEffectivePickupHotelId(
                  res.pickup_hotel!,
                  pickupHotelsCatalog,
                  pickupContext
                ) || res.pickup_hotel!
              const { data, error: hotelError } = await supabase
                .from('pickup_hotels')
                .select('hotel, pick_up_location, address, link')
                .eq('id', effectiveId)
                .single()

              if (!hotelError && data) {
                hotelInfo = data
              } else {
                console.warn('픽업 호텔 정보 조회 실패:', hotelError)
              }
            } catch (error) {
              console.warn('픽업 호텔 정보 조회 중 오류:', error)
            }

            const effectiveHotelId =
              getEffectivePickupHotelId(
                res.pickup_hotel!,
                pickupHotelsCatalog,
                pickupContext
              ) || res.pickup_hotel || ''

            return {
              reservation_id: res.id,
              pickup_time: res.pickup_time || '',
              pickup_hotel: effectiveHotelId,
              hotel: (hotelInfo as { hotel?: string } | null)?.hotel || 'Unknown Hotel',
              pick_up_location: (hotelInfo as { pick_up_location?: string } | null)?.pick_up_location || '',
              address: (hotelInfo as { address?: string } | null)?.address || '',
              link: (hotelInfo as { link?: string } | null)?.link || '',
              customer_name: (customerInfo as { name?: string } | null)?.name || 'Unknown Customer',
              total_people: res.total_people ?? 0,
              tour_date: res.tour_date,
            } as PickupInfo
          })
        )

        // 대표 픽업 모드: 동일 시간·호텔 중복 제거
        let finalPickups = pickupInfos
        if (pickupContext.preset || pickupContext.useRepresentativePickup) {
          const uniquePickups = new Map<string, PickupInfo>()
          pickupInfos.forEach((pickup) => {
            const normalizedTime = pickup.pickup_time ? pickup.pickup_time.substring(0, 5) : ''
            const key = `${normalizedTime}-${pickup.hotel}`
            if (!uniquePickups.has(key)) uniquePickups.set(key, pickup)
          })
          finalPickups = Array.from(uniquePickups.values())
        }

        finalPickups.sort((a, b) => a.pickup_time.localeCompare(b.pickup_time))
        result.allPickups = finalPickups
      }
    }

    return result
  } catch (error) {
    console.error('픽업 스케줄 조회 중 예외:', error)
    return null
  }
}

export async function fetchReservationTourDetails(
  reservationId: string
): Promise<TourDetails | null> {
  try {
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('tour_id')
      .eq('id', reservationId)
      .single()

    if (reservationError || !(reservation as SupabaseReservation)?.tour_id) {
      console.warn('예약 ID 조회 오류:', reservationError)
      return null
    }

    const { data: tourDetails, error: tourError } = await supabase
      .from('tours')
      .select('*')
      .eq('id', (reservation as SupabaseReservation).tour_id!)
      .single()

    if (tourError) {
      console.warn('투어 상세 정보 조회 오류:', tourError)
      return null
    }

    let tourGuideInfo = null
    let assistantInfo = null
    let vehicleInfo = null

    const tourDetailsTyped = tourDetails as SupabaseTourDetails

    if (tourDetailsTyped?.tour_guide_id) {
      const { data: guideData } = await supabase
        .from('team')
        .select('name_ko, name_en, phone, email, languages')
        .eq('email', tourDetailsTyped.tour_guide_id)
        .maybeSingle()
      tourGuideInfo = guideData
    }

    if (tourDetailsTyped?.assistant_id) {
      const { data: assistantData } = await supabase
        .from('team')
        .select('name_ko, name_en, phone, email')
        .eq('email', tourDetailsTyped.assistant_id)
        .maybeSingle()
      assistantInfo = assistantData
    }

    if (tourDetailsTyped?.tour_car_id) {
      const { data: vehicleData, error: vehicleError } = await supabase
        .from('vehicles')
        .select('vehicle_type, capacity, color')
        .eq('id', tourDetailsTyped.tour_car_id)
        .maybeSingle()

      if (vehicleError && vehicleError.code !== 'PGRST116') {
        console.error('차량 정보 조회 오류:', vehicleError)
      }

      if (
        vehicleData &&
        typeof vehicleData === 'object' &&
        'vehicle_type' in vehicleData &&
        (vehicleData as SupabaseVehicleData).vehicle_type
      ) {
        const vehicleDataTyped = vehicleData as SupabaseVehicleData

        const { data: vehicleTypeData } = await supabase
          .from('vehicle_types')
          .select('id, name, brand, model, passenger_capacity, description')
          .eq('name', vehicleDataTyped.vehicle_type)
          .single()

        let vehiclePhotosData = null
        if (
          vehicleTypeData &&
          typeof vehicleTypeData === 'object' &&
          'id' in vehicleTypeData &&
          (vehicleTypeData as SupabaseVehicleTypeData).id
        ) {
          const vehicleTypeDataTyped = vehicleTypeData as SupabaseVehicleTypeData
          const { data: photosData } = await supabase
            .from('vehicle_type_photos')
            .select('photo_url, photo_name, description, is_primary, display_order')
            .eq('vehicle_type_id', vehicleTypeDataTyped.id)
            .order('display_order', { ascending: true })
            .order('is_primary', { ascending: false })
          vehiclePhotosData = photosData
        }

        vehicleInfo = {
          vehicle_type: vehicleDataTyped.vehicle_type,
          color: vehicleDataTyped.color,
          vehicle_type_info:
            vehicleTypeData &&
            typeof vehicleTypeData === 'object' &&
            'name' in vehicleTypeData
              ? {
                  name: (vehicleTypeData as SupabaseVehicleTypeData).name,
                  brand: (vehicleTypeData as SupabaseVehicleTypeData).brand,
                  model: (vehicleTypeData as SupabaseVehicleTypeData).model,
                  passenger_capacity:
                    (vehicleTypeData as SupabaseVehicleTypeData).passenger_capacity ||
                    vehicleDataTyped.capacity,
                  description: (vehicleTypeData as SupabaseVehicleTypeData).description,
                }
              : {
                  name: vehicleDataTyped.vehicle_type,
                  passenger_capacity: vehicleDataTyped.capacity,
                },
          vehicle_type_photos: vehiclePhotosData || [],
        }
      }
    }

    return {
      ...tourDetailsTyped,
      tour_guide: tourGuideInfo,
      assistant: assistantInfo,
      vehicle: vehicleInfo,
    } as unknown as TourDetails
  } catch (error) {
    console.error('투어 상세 정보 조회 중 예외:', error)
    return null
  }
}

export async function fetchReservationProductSchedules(
  productId: string
): Promise<ProductSchedule[] | null> {
  try {
    const { data: schedules, error } = await supabase
      .from('product_schedules')
      .select(
        'id, day_number, start_time, end_time, title_ko, title_en, description_ko, description_en, show_to_customers, order_index'
      )
      .eq('product_id', productId)
      .eq('show_to_customers', true)
      .order('day_number', { ascending: true })
      .order('order_index', { ascending: true })

    if (error) {
      console.warn('상품 스케줄 조회 오류:', error)
      return null
    }

    return schedules as ProductSchedule[]
  } catch (error) {
    console.error('상품 스케줄 조회 중 예외:', error)
    return null
  }
}

export async function fetchReservationDetailBundle(
  reservationId: string,
  productId: string,
  locale: string,
  channelId?: string | null
): Promise<ReservationDetails> {
  const [productDetails, pickupSchedule, tourDetails, productSchedules] = await Promise.all([
    fetchReservationProductDetails(productId, locale, channelId),
    fetchReservationPickupSchedule(reservationId),
    fetchReservationTourDetails(reservationId),
    fetchReservationProductSchedules(productId),
  ])

  return {
    productDetails,
    pickupSchedule,
    tourDetails,
    productSchedules,
  }
}
