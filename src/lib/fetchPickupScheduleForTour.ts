import type { SupabaseClient } from '@supabase/supabase-js'
import { formatTimeWithAMPM } from '@/lib/utils'
import { resolvePickupStopCoords } from '@/lib/geo'
import { hhmmToSortMinutes } from '@/lib/tourPickupLiveWindow'

export type GuidePickupScheduleRow = {
  time: string
  date: string
  hotel: string
  location: string
  people: number
  sortMinutes: number
  lat: number | null
  lng: number | null
}

type TourRow = {
  reservation_ids: string[] | null
}

type ReservationRow = {
  id: string
  pickup_hotel: string
  pickup_time: string
  total_people: number
  customer_id: string
  status: string
}

type CustomerRow = {
  id: string
  name: string
}

type PickupHotelRow = {
  id: string
  hotel: string
  pick_up_location: string
  pin: string | null
  link: string | null
}

type GroupedStop = {
  time: string
  date: string
  hotel: string
  location: string
  people: number
  sortMinutes: number
  pin: string | null
  link: string | null
  customers: Array<{ name: string; people: number }>
}

/**
 * 투어 ID·투어일 기준 픽업 스케줄(호텔 그룹, 좌표 포함).
 * 예약/호텔 없으면 빈 배열.
 */
export async function fetchPickupScheduleForTour(
  supabase: SupabaseClient,
  tourId: string,
  tourDate: string
): Promise<GuidePickupScheduleRow[]> {
  const { data: tour, error: tourError } = await supabase
    .from('tours')
    .select('reservation_ids, tour_date')
    .eq('id', tourId)
    .single()

  if (tourError || !tour) {
    console.error('[fetchPickupScheduleForTour] tour load error:', tourError)
    return []
  }

  const tourData = tour as TourRow & { tour_date?: string | null }
  const effectiveTourDate =
    (tourDate && tourDate.trim()) || (tourData.tour_date ? String(tourData.tour_date).split('T')[0] : '')
  if (!tourData.reservation_ids || tourData.reservation_ids.length === 0) {
    return []
  }

  const { data: reservations, error: reservationsError } = await supabase
    .from('reservations')
    .select(
      `
        id,
        pickup_hotel,
        pickup_time,
        total_people,
        customer_id,
        status
      `
    )
    .in('id', tourData.reservation_ids)
    .not('pickup_hotel', 'is', null)
    .not('pickup_time', 'is', null)

  if (reservationsError || !reservations?.length) {
    if (reservationsError) {
      console.error('[fetchPickupScheduleForTour] reservations error:', reservationsError)
    }
    return []
  }

  const reservationsData = reservations as ReservationRow[]

  const customerIds = reservationsData.map((r) => r.customer_id).filter(Boolean)
  let customersData: CustomerRow[] = []
  if (customerIds.length > 0) {
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, name')
      .in('id', customerIds)

    if (customersError) {
      console.error('[fetchPickupScheduleForTour] customers error:', customersError)
    } else {
      customersData = (customers as CustomerRow[]) || []
    }
  }

  const reservationsWithCustomers = reservationsData.map((reservation) => {
    const customer = customersData.find((c) => c.id === reservation.customer_id)
    return {
      ...reservation,
      ...(customer ? { customers: customer } : {})
    }
  }) as Array<ReservationRow & { customers?: CustomerRow }>

  const pickupHotelIds = [
    ...new Set(
      reservationsWithCustomers.map((r) => r.pickup_hotel).filter(Boolean) as string[]
    )
  ]

  let pickupHotels: PickupHotelRow[] = []
  if (pickupHotelIds.length > 0) {
    const { data: hotelsData, error: hotelsError } = await supabase
      .from('pickup_hotels')
      .select('id, hotel, pick_up_location, pin, link')
      .in('id', pickupHotelIds)
      .eq('is_active', true)

    if (hotelsError) {
      console.error('[fetchPickupScheduleForTour] pickup_hotels error:', hotelsError)
    } else {
      pickupHotels = (hotelsData as PickupHotelRow[]) || []
    }
  }

  const groupedByHotel = reservationsWithCustomers.reduce<Record<string, GroupedStop>>((acc, reservation) => {
    const hotel = pickupHotels.find((h) => h.id === reservation.pickup_hotel)
    if (!hotel) {
      const hotelKey = `unknown-${reservation.pickup_hotel}`
        if (!acc[hotelKey]) {
          const pickupTime = reservation.pickup_time ? reservation.pickup_time.substring(0, 5) : ''
          const timeHour = pickupTime ? parseInt(pickupTime.split(':')[0], 10) : 0

          let displayDate = effectiveTourDate || ''
          if (timeHour >= 21 && effectiveTourDate) {
            const date = new Date(effectiveTourDate)
            date.setDate(date.getDate() - 1)
            displayDate = date.toISOString().split('T')[0]
          }

        acc[hotelKey] = {
          time: formatTimeWithAMPM(pickupTime),
          date: displayDate,
          hotel: `호텔 ID: ${reservation.pickup_hotel}`,
          location: '위치 미상',
          people: 0,
          sortMinutes: hhmmToSortMinutes(pickupTime),
          pin: null,
          link: null,
          customers: []
        }
      }
      acc[hotelKey].people += reservation.total_people || 0
      const ptUn = reservation.pickup_time ? reservation.pickup_time.substring(0, 5) : ''
      acc[hotelKey].sortMinutes = Math.min(acc[hotelKey].sortMinutes, hhmmToSortMinutes(ptUn))
      acc[hotelKey].customers.push({
        name: reservation.customers?.name || 'Unknown Customer',
        people: reservation.total_people || 0
      })
      return acc
    }

    const hotelKey = `${hotel.hotel}-${hotel.pick_up_location}`
    if (!acc[hotelKey]) {
      const pickupTime = reservation.pickup_time ? reservation.pickup_time.substring(0, 5) : ''
      const timeHour = pickupTime ? parseInt(pickupTime.split(':')[0], 10) : 0

      let displayDate = effectiveTourDate || ''
      if (timeHour >= 21 && effectiveTourDate) {
        const date = new Date(effectiveTourDate)
        date.setDate(date.getDate() - 1)
        displayDate = date.toISOString().split('T')[0]
      }

      acc[hotelKey] = {
        time: formatTimeWithAMPM(pickupTime),
        date: displayDate,
        hotel: hotel.hotel || '',
        location: hotel.pick_up_location || '',
        people: 0,
        sortMinutes: hhmmToSortMinutes(pickupTime),
        pin: hotel.pin ?? null,
        link: hotel.link ?? null,
        customers: []
      }
    }
    acc[hotelKey].people += reservation.total_people || 0
    const ptKn = reservation.pickup_time ? reservation.pickup_time.substring(0, 5) : ''
    acc[hotelKey].sortMinutes = Math.min(acc[hotelKey].sortMinutes, hhmmToSortMinutes(ptKn))
    acc[hotelKey].customers.push({
      name: reservation.customers?.name || 'Unknown Customer',
      people: reservation.total_people || 0
    })
    return acc
  }, {})

  return Object.values(groupedByHotel)
    .sort((a, b) => {
      if (!a || !b) return 0
      return a.sortMinutes - b.sortMinutes
    })
    .map((item) => {
      const c = resolvePickupStopCoords(item.pin, item.link)
      return {
        time: item.time,
        date: item.date,
        hotel: item.hotel,
        location: item.location,
        people: item.people,
        sortMinutes: item.sortMinutes,
        lat: c?.lat ?? null,
        lng: c?.lng ?? null
      }
    })
}
