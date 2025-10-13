import React from 'react'
import { ReservationSection } from './ReservationSection'

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

interface AssignmentManagementProps {
  assignedReservations: Reservation[]
  pendingReservations: Reservation[]
  otherToursAssignedReservations: Reservation[]
  otherStatusReservations: Reservation[]
  expandedSections: Set<string>
  loadingStates: { reservations: boolean }
  isStaff: boolean
  onToggleSection: (sectionId: string) => void
  onAssignAllReservations: () => void
  onUnassignAllReservations: () => void
  onEditReservationClick: (reservation: Reservation) => void
  onUnassignReservation: (reservationId: string) => void
  onReassignFromOtherTour: (reservationId: string, fromTourId: string) => void
  onEditPickupTime?: (reservation: Reservation) => void
  onEditPickupHotel?: (reservation: Reservation) => void
  getCustomerName: (customerId: string) => string
  getCustomerLanguage: (customerId: string) => string
  safeJsonParse: (data: string | object | null | undefined, fallback?: unknown) => unknown
  pickupHotels?: Array<{ id: string; hotel: string; pick_up_location?: string }>
}

export const AssignmentManagement: React.FC<AssignmentManagementProps> = ({
  assignedReservations,
  pendingReservations,
  otherToursAssignedReservations,
  otherStatusReservations,
  expandedSections,
  loadingStates,
  isStaff,
  onToggleSection,
  onAssignAllReservations,
  onUnassignAllReservations,
  onEditReservationClick,
  onUnassignReservation,
  onReassignFromOtherTour,
  onEditPickupTime,
  onEditPickupHotel,
  getCustomerName,
  getCustomerLanguage,
  safeJsonParse,
  pickupHotels = []
}) => {
  const isExpanded = expandedSections.has('assignment-management')

  // 배정된 예약을 픽업 시간으로 정렬
  const sortedAssignedReservations = assignedReservations.sort((a, b) => {
    const timeA = a.pickup_time ? a.pickup_time.substring(0, 5) : '08:00'
    const timeB = b.pickup_time ? b.pickup_time.substring(0, 5) : '08:00'
    return timeA.localeCompare(timeB)
  })

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => onToggleSection('assignment-management')}
        >
          <h2 className="text-lg font-semibold text-gray-900">배정 관리</h2>
          <div className="flex items-center space-x-2">
            {loadingStates.reservations && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
            <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4">
            {/* 전체 액션 버튼들 */}
            {isStaff && (
              <div className="mb-4 flex space-x-2">
                <button
                  onClick={onAssignAllReservations}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  모든 대기 예약 배정
                </button>
                <button
                  onClick={onUnassignAllReservations}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  모든 배정 해제
                </button>
              </div>
            )}

            {/* 1. 이 투어에 배정된 예약 */}
            <ReservationSection
              title="1. 이 투어에 배정된 예약"
              reservations={sortedAssignedReservations}
              isStaff={isStaff}
              showActions={true}
              emptyMessage="이 투어에 배정된 예약이 없습니다."
              onEditReservation={onEditReservationClick}
              onUnassignReservation={onUnassignReservation}
              {...(onEditPickupTime && { onEditPickupTime })}
              {...(onEditPickupHotel && { onEditPickupHotel })}
              getCustomerName={getCustomerName}
              getCustomerLanguage={getCustomerLanguage}
              safeJsonParse={safeJsonParse}
              pickupHotels={pickupHotels}
            />

            {/* 2. 배정 대기 중인 예약 */}
            <ReservationSection
              title="2. 배정 대기 중인 예약"
              reservations={pendingReservations}
              isStaff={isStaff}
              showActions={false}
              emptyMessage="배정 대기 중인 예약이 없습니다."
              onEditReservation={onEditReservationClick}
              {...(onEditPickupTime && { onEditPickupTime })}
              {...(onEditPickupHotel && { onEditPickupHotel })}
              getCustomerName={getCustomerName}
              getCustomerLanguage={getCustomerLanguage}
              safeJsonParse={safeJsonParse}
              pickupHotels={pickupHotels}
            />

            {/* 3. 다른 투어에 배정된 예약 */}
            <ReservationSection
              title="3. 다른 투어에 배정된 예약"
              reservations={otherToursAssignedReservations}
              isStaff={isStaff}
              showActions={true}
              showTourInfo={true}
              emptyMessage="다른 투어에 배정된 예약이 없습니다."
              onEditReservation={onEditReservationClick}
              onReassignFromOtherTour={onReassignFromOtherTour}
              {...(onEditPickupTime && { onEditPickupTime })}
              {...(onEditPickupHotel && { onEditPickupHotel })}
              getCustomerName={getCustomerName}
              getCustomerLanguage={getCustomerLanguage}
              safeJsonParse={safeJsonParse}
              pickupHotels={pickupHotels}
            />

            {/* 4. 다른 상태의 예약 */}
            <ReservationSection
              title="4. 다른 상태의 예약"
              reservations={otherStatusReservations}
              isStaff={isStaff}
              showActions={false}
              showStatus={true}
              emptyMessage="다른 상태의 예약이 없습니다."
              onEditReservation={onEditReservationClick}
              {...(onEditPickupTime && { onEditPickupTime })}
              {...(onEditPickupHotel && { onEditPickupHotel })}
              getCustomerName={getCustomerName}
              getCustomerLanguage={getCustomerLanguage}
              safeJsonParse={safeJsonParse}
              pickupHotels={pickupHotels}
            />
          </div>
        )}
      </div>
    </div>
  )
}