import type { Database } from '@/lib/supabase'

type Tour = Database['public']['Tables']['tours']['Row']
type Reservation = Database['public']['Tables']['reservations']['Row']

/**
 * 1. 배정된 예약 인원 수를 계산합니다
 * tour.reservation_ids에 있는 예약 ID들을 allReservations에서 찾아서 total_people의 합
 */
export const calculateAssignedPeople = (tour: Tour, allReservations: Reservation[]): number => {
  if (!tour.reservation_ids || tour.reservation_ids.length === 0) {
    return 0
  }

  const counted = new Set<string>()
  let totalPeople = 0

  for (const reservationId of tour.reservation_ids) {
    const rid = String(reservationId)
    if (counted.has(rid)) continue
    counted.add(rid)

    const reservation = allReservations.find(r => String(r.id) === rid)
    if (!reservation) continue

    // 동일한 상품/날짜 + 상태(recruiting/confirmed)만 합산 (대소문자 무시)
    const status = String(reservation.status || '').toLowerCase()
    const isValidStatus = status === 'recruiting' || status === 'confirmed'
    const isSameProductDate = reservation.product_id === tour.product_id && reservation.tour_date === tour.tour_date

    if (isValidStatus && isSameProductDate && reservation.total_people) {
      totalPeople += reservation.total_people
    }
  }

  return totalPeople
}

/**
 * 2. 해당 투어와 같은 상품/날짜의 총 예약 인원을 계산합니다
 * allReservations에서 tour.product_id와 tour.tour_date가 같은 예약들의 total_people 합
 */
export const calculateTotalPeopleForSameProductDate = (tour: Tour, allReservations: Reservation[]): number => {
  let totalPeople = 0
  
  for (const reservation of allReservations) {
    if (reservation.product_id === tour.product_id && 
        reservation.tour_date === tour.tour_date &&
        (reservation.status === 'confirmed' || reservation.status === 'recruiting') &&
        reservation.total_people) {
      totalPeople += reservation.total_people
    }
  }
  
  return totalPeople
}

/**
 * 3. 미배정 예약 인원을 계산합니다
 * 해당 투어와 같은 상품/날짜이면서 tour_id가 null인 예약들의 total_people 합
 */
export const calculateUnassignedPeople = (tour: Tour, allReservations: Reservation[]): number => {
  let totalPeople = 0
  
  for (const reservation of allReservations) {
    if (reservation.product_id === tour.product_id && 
        reservation.tour_date === tour.tour_date &&
        reservation.tour_id === null &&
        (reservation.status === 'confirmed' || reservation.status === 'recruiting') &&
        reservation.total_people) {
      totalPeople += reservation.total_people
    }
  }
  
  return totalPeople
}

/**
 * 4. 배정 대기중인 예약들을 가져옵니다
 * 해당 투어와 tour_date와 product_id가 같은 reservations이고, tour_id가 null인 것
 */
export const getPendingReservations = (tour: Tour, allReservations: Reservation[]): Reservation[] => {
  return allReservations.filter(res => 
    res.product_id === tour.product_id && 
    res.tour_date === tour.tour_date &&
    res.tour_id === null &&
    (res.status === 'confirmed' || res.status === 'recruiting')
  )
}

/**
 * 5. 다른 투어에 배정된 예약들을 가져옵니다
 * 이 투어와 tour_date와 product_id가 같은 tours id에 있는 reservation_ids에 있는 예약
 */
export const getOtherToursAssignedReservations = (tour: Tour, allTours: Tour[], allReservations: Reservation[]): Reservation[] => {
  // 같은 상품/날짜의 다른 투어들 찾기
  const otherTours = allTours.filter(t => 
    t.id !== tour.id && 
    t.product_id === tour.product_id && 
    t.tour_date === tour.tour_date
  )
  
  // 다른 투어들의 reservation_ids 수집
  const otherToursReservationIds = otherTours.flatMap(t => t.reservation_ids || [])
  
  // 해당 예약들을 allReservations에서 찾기
  const result = allReservations.filter(reservation => 
    otherToursReservationIds.includes(reservation.id) &&
    reservation.product_id === tour.product_id &&
    reservation.tour_date === tour.tour_date &&
    (reservation.status === 'confirmed' || reservation.status === 'recruiting')
  )
  
  // 각 예약에 assigned_tour_id 추가
  return result.map(reservation => ({
    ...reservation,
    assigned_tour_id: otherTours.find(t => t.reservation_ids?.includes(reservation.id))?.id || null
  }))
}