// 투어 관련 데이터 페칭 함수들
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

// 부킹 데이터 페칭
export const fetchBookings = async (tourId: string) => {
  try {
    // 입장권 부킹 조회
    const { data: ticketBookingsData, error: ticketError } = await supabase
      .from('ticket_bookings')
      .select('*')
      .eq('tour_id', tourId)
      .order('check_in_date', { ascending: false })

    if (ticketError) {
      console.error('입장권 부킹 조회 오류:', ticketError)
    }

    // 투어 호텔 부킹 조회
    const { data: tourHotelBookingsData, error: tourHotelError } = await supabase
      .from('tour_hotel_bookings')
      .select('*')
      .eq('tour_id', tourId)
      .order('check_in_date', { ascending: false })

    if (tourHotelError) {
      console.error('투어 호텔 부킹 조회 오류:', tourHotelError)
    }

    return {
      ticketBookings: ticketBookingsData || [],
      tourHotelBookings: tourHotelBookingsData || []
    }
  } catch (error) {
    console.error('부킹 데이터 조회 오류:', error)
    return {
      ticketBookings: [],
      tourHotelBookings: []
    }
  }
}

// 다른 투어에 배정된 예약들 조회
export const fetchOtherToursAssignedReservations = async (targetTour: { id: string; product_id: string; tour_date: string }) => {
  try {
    if (!targetTour || !targetTour.product_id || !targetTour.tour_date) return []

    // 1) 같은 상품/날짜의 모든 투어 가져오기
    const { data: siblingTours, error: toursError } = await supabase
      .from('tours')
      .select('id, reservation_ids, product_id, tour_date')
      .eq('product_id', targetTour.product_id)
      .eq('tour_date', targetTour.tour_date)

    if (toursError) {
      console.error('Error fetching sibling tours:', toursError)
      return []
    }

    // 2) 현재 투어를 제외한 다른 투어들의 예약 ID 수집
    const otherTourReservationIds = (siblingTours || [])
      .filter((tour: { id: string; reservation_ids?: string[] }) => tour.id !== targetTour.id)
      .flatMap((tour: { id: string; reservation_ids?: string[] }) => tour.reservation_ids || [])

    if (otherTourReservationIds.length === 0) return []

    // 3) 해당 예약들의 상세 정보 조회
    const { data: reservations, error: reservationsError } = await (supabase as any)
      .from('reservations')
      .select('*')
      .in('id', otherTourReservationIds)

    if (reservationsError) {
      console.error('Error fetching other tours reservations:', reservationsError)
      return []
    }

    return reservations || []
  } catch (error) {
    console.error('다른 투어 예약 조회 오류:', error)
    return []
  }
}

// 투어 데이터 페칭
export const fetchTourData = async (tourId: string) => {
  try {
    const { data: tourData, error: tourError } = await supabase
      .from('tours')
      .select(`
        *,
        product:products(*),
        customer:customers(*),
        pickup_hotel:pickup_hotels(*),
        channel:channels(*)
      `)
      .eq('id', tourId)
      .single()

    if (tourError) {
      console.error('투어 데이터 조회 오류:', tourError)
      return null
    }

    return tourData
  } catch (error) {
    console.error('투어 데이터 페칭 오류:', error)
    return null
  }
}

// 차량 데이터 페칭
export const fetchVehicles = async () => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('status', '운행 가능')
      .order('vehicle_type', { ascending: true })
      .order('vehicle_number', { ascending: true })

    if (error) {
      console.error('차량 데이터 조회 오류:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('차량 데이터 페칭 오류:', error)
    return []
  }
}
