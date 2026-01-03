import React from 'react'
import { ReservationCard } from './ReservationCard'

interface Reservation {
  id: string
  customer_id: string | null
  product_id: string | null
  tour_date: string
  tour_time: string | null
  pickup_hotel: string | null
  pickup_time: string | null
  adults: number | null
  children?: number | null
  infants?: number | null
  status: string | null
  tour_id: string | null
  choices?: string | null
  [key: string]: unknown
}

interface ReservationSectionProps {
  title: string
  reservations: Reservation[]
  isStaff: boolean
  showActions?: boolean
  showStatus?: boolean
  showTourInfo?: boolean
  emptyMessage?: string
  onEditReservation?: (reservation: Reservation) => void
  onUnassignReservation?: (reservationId: string) => void
  onReassignFromOtherTour?: (reservationId: string, fromTourId: string) => void
  onEditPickupTime?: (reservation: Reservation) => void
  onEditPickupHotel?: (reservation: Reservation) => void
  getCustomerName: (customerId: string) => string
  getCustomerLanguage: (customerId: string) => string
  getChannelInfo?: (channelId: string) => Promise<{ name: string; favicon?: string } | null | undefined>
  safeJsonParse: (data: string | object | null | undefined, fallback?: unknown) => unknown
  pickupHotels?: Array<{ id: string; hotel: string; pick_up_location?: string }>
}

export const ReservationSection: React.FC<ReservationSectionProps> = ({
  title,
  reservations,
  isStaff,
  showActions = false,
  showStatus = true,
  showTourInfo = false,
  emptyMessage = '예약이 없습니다.',
  onEditReservation,
  onUnassignReservation,
  onReassignFromOtherTour,
  onEditPickupTime,
  onEditPickupHotel,
  getCustomerName,
  getCustomerLanguage,
  getChannelInfo,
  safeJsonParse,
  pickupHotels = []
}) => {
  // 중복 제거: 같은 ID를 가진 예약 중 첫 번째 것만 유지
  const uniqueReservations = React.useMemo(() => {
    const seen = new Set<string>()
    return reservations.filter(reservation => {
      if (seen.has(reservation.id)) {
        console.warn(`⚠️ 중복된 예약 ID 발견: ${reservation.id} - 제거됨`)
        return false
      }
      seen.add(reservation.id)
      return true
    })
  }, [reservations])

  // 총 인원 계산
  const totalPeople = uniqueReservations.reduce((sum, reservation) => {
    const adults = reservation.adults || 0
    const children = reservation.children || 0
    const infants = reservation.infants || 0
    return sum + adults + children + infants
  }, 0)

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-medium text-gray-700">
          {title} ({uniqueReservations.length})
        </h3>
        {totalPeople > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            👥 <span>{totalPeople}</span>
          </span>
        )}
      </div>
      <div className="space-y-2">
        {uniqueReservations.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          uniqueReservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              isStaff={isStaff}
              showActions={showActions}
              showStatus={showStatus}
              showTourInfo={showTourInfo}
              onEdit={onEditReservation}
              onUnassign={onUnassignReservation}
              onReassign={onReassignFromOtherTour}
              onEditPickupTime={onEditPickupTime}
              onEditPickupHotel={onEditPickupHotel}
              getCustomerName={getCustomerName}
              getCustomerLanguage={getCustomerLanguage}
              getChannelInfo={getChannelInfo}
              safeJsonParse={safeJsonParse}
              pickupHotels={pickupHotels}
            />
          ))
        )}
      </div>
    </div>
  )
}
