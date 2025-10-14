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
  showStatus = false,
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
  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-gray-700 mb-2">
        {title} ({reservations.length})
      </h3>
      <div className="space-y-2">
        {reservations.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          reservations.map((reservation) => (
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
