import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ReservationSection } from './ReservationSection'
import { supabase } from '@/lib/supabase'
import { ChevronDown, ChevronUp } from 'lucide-react'

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
  assignment_status?: string | null
  tour_id: string | null
  choices?: string | null
  [key: string]: unknown
}

interface TourInfo {
  id: string
  tour_guide_id: string | null
  assistant_id: string | null
}

interface TeamMember {
  email: string
  name_ko: string | null
  name_en: string | null
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
  onNavigateToTour?: (tourId: string) => void
  onEditPickupTime?: (reservation: Reservation) => void
  onEditPickupHotel?: (reservation: Reservation) => void
  getCustomerName: (customerId: string) => string
  getCustomerLanguage: (customerId: string) => string
  getChannelInfo?: (channelId: string) => Promise<{ name: string; favicon?: string } | null | undefined>
  safeJsonParse: (data: string | object | null | undefined, fallback?: unknown) => unknown
  pickupHotels?: Array<{ id: string; hotel: string; pick_up_location?: string }>
  onRefresh?: () => Promise<void> | void
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
  onNavigateToTour,
  onEditPickupTime,
  onEditPickupHotel,
  getCustomerName,
  getCustomerLanguage,
  getChannelInfo,
  safeJsonParse,
  pickupHotels = [],
  onRefresh
}) => {
  const t = useTranslations('tours.assignmentManagement')
  const isExpanded = expandedSections.has('assignment-management')
  const [tourInfos, setTourInfos] = useState<Record<string, TourInfo>>({})
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  // 다른 투어에 배정된 예약의 투어 정보 가져오기
  useEffect(() => {
    const fetchTourInfos = async () => {
      if (otherToursAssignedReservations.length === 0) return

      try {
        // 고유한 투어 ID 목록 추출
        const uniqueTourIds = [...new Set(
          otherToursAssignedReservations
            .map(r => r.tour_id)
            .filter(Boolean)
        )] as string[]

        if (uniqueTourIds.length === 0) return

        // 투어 정보 가져오기
        const { data: toursData, error: toursError } = await supabase
          .from('tours')
          .select('id, tour_guide_id, assistant_id')
          .in('id', uniqueTourIds)

        if (toursError) {
          console.error('투어 정보 가져오기 오류:', toursError)
          return
        }

        // 투어 정보를 Map으로 변환
        const tourInfoMap: Record<string, TourInfo> = {}
        toursData?.forEach((tour: TourInfo) => {
          tourInfoMap[tour.id] = tour
        })

        setTourInfos(tourInfoMap)

        // 팀 멤버 정보 가져오기
        const guideEmails = [...new Set(
          toursData?.map((t: TourInfo) => t.tour_guide_id).filter(Boolean)
        )] as string[]
        const assistantEmails = [...new Set(
          toursData?.map((t: TourInfo) => t.assistant_id).filter(Boolean)
        )] as string[]
        const allEmails = [...guideEmails, ...assistantEmails]

        if (allEmails.length > 0) {
          const { data: teamData, error: teamError } = await supabase
            .from('team')
            .select('email, name_ko, name_en')
            .in('email', allEmails)

          if (teamError) {
            console.error('팀 멤버 정보 가져오기 오류:', teamError)
          } else {
            setTeamMembers(teamData || [])
          }
        }
      } catch (error) {
        console.error('투어 정보 가져오기 중 오류:', error)
      }
    }

    fetchTourInfos()
  }, [otherToursAssignedReservations])

  // 팀 멤버 이름 가져오기 함수
  const getTeamMemberName = (email: string | null) => {
    if (!email) return t('unassigned')
    
    const member = teamMembers.find(m => m.email === email)
    if (!member) return email
    
    return member.name_ko || member.name_en || email
  }

  // 상태 뱃지 색상 결정 함수
  const getStatusBadgeColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800'
    
    const statusLower = status.toLowerCase()
    if (statusLower.includes('confirmed')) return 'bg-green-100 text-green-800'
    if (statusLower.includes('recruiting')) return 'bg-blue-100 text-blue-800'
    if (statusLower.includes('cancel')) return 'bg-red-100 text-red-800'
    if (statusLower.includes('pending')) return 'bg-yellow-100 text-yellow-800'
    return 'bg-gray-100 text-gray-800'
  }

  // 배정 상태 뱃지 색상 결정 함수
  const getAssignmentStatusBadgeColor = (assignmentStatus: string | null) => {
    if (!assignmentStatus) return 'bg-gray-100 text-gray-800'
    
    const statusLower = assignmentStatus.toLowerCase()
    if (statusLower.includes('assigned')) return 'bg-green-100 text-green-800'
    if (statusLower.includes('pending')) return 'bg-yellow-100 text-yellow-800'
    if (statusLower.includes('unassigned')) return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-800'
  }

  // 배정된 예약을 픽업 시간으로 정렬 (오후 9시 이후 시간은 전날로 취급)
  const sortedAssignedReservations = [...assignedReservations].sort((a, b) => {
    const parseTime = (time: string | null) => {
      if (!time) return 0
      const [hours, minutes] = time.split(':').map(Number)
      return hours * 60 + (minutes || 0)
    }
    
    const parseDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(year, month - 1, day)
    }
    
    const timeA = parseTime(a.pickup_time)
    const timeB = parseTime(b.pickup_time)
    const referenceTime = 21 * 60 // 오후 9시 (21:00) = 1260분
    
    // 오후 9시 이후 시간은 전날로 취급
    let dateA = parseDate(a.tour_date)
    let dateB = parseDate(b.tour_date)
    
    if (timeA >= referenceTime) {
      dateA = new Date(dateA)
      dateA.setDate(dateA.getDate() - 1)
    }
    if (timeB >= referenceTime) {
      dateB = new Date(dateB)
      dateB.setDate(dateB.getDate() - 1)
    }
    
    // 날짜와 시간을 함께 고려하여 정렬
    const dateTimeA = dateA.getTime() + timeA * 60 * 1000
    const dateTimeB = dateB.getTime() + timeB * 60 * 1000
    
    return dateTimeA - dateTimeB
  })

  // 다른 투어에 배정된 예약을 투어 ID별로 그룹화
  const groupedOtherToursReservations = otherToursAssignedReservations.reduce((groups, reservation) => {
    const tourId = reservation.tour_id || 'unknown'
    if (!groups[tourId]) {
      groups[tourId] = []
    }
    groups[tourId].push(reservation)
    return groups
  }, {} as Record<string, Reservation[]>)

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => onToggleSection('assignment-management')}
        >
          <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
          <div className="flex items-center space-x-2">
            {loadingStates.reservations && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
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
                  {t('assignAllPending')}
                </button>
                <button
                  onClick={onUnassignAllReservations}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  {t('unassignAll')}
                </button>
              </div>
            )}

            {/* 1. 이 투어에 배정된 예약 */}
            <ReservationSection
              title={t('assignedToTour')}
              reservations={sortedAssignedReservations}
              isStaff={isStaff}
              showActions={true}
              showStatus={true}
              emptyMessage={t('noAssignedReservations')}
              onEditReservation={onEditReservationClick}
              onUnassignReservation={onUnassignReservation}
              {...(onEditPickupTime && { onEditPickupTime })}
              {...(onEditPickupHotel && { onEditPickupHotel })}
              getCustomerName={getCustomerName}
              getCustomerLanguage={getCustomerLanguage}
              {...(getChannelInfo && { getChannelInfo })}
              safeJsonParse={safeJsonParse}
              pickupHotels={pickupHotels}
              {...(onRefresh && { onRefresh })}
            />

            {/* 2. 배정 대기 중인 예약 */}
            <ReservationSection
              title={t('pendingAssignments')}
              reservations={pendingReservations}
              isStaff={isStaff}
              showActions={false}
              showStatus={true}
              emptyMessage={t('noPendingReservations')}
              onEditReservation={onEditReservationClick}
              {...(onEditPickupTime && { onEditPickupTime })}
              {...(onEditPickupHotel && { onEditPickupHotel })}
              getCustomerName={getCustomerName}
              getCustomerLanguage={getCustomerLanguage}
              {...(getChannelInfo && { getChannelInfo })}
              safeJsonParse={safeJsonParse}
              pickupHotels={pickupHotels}
              {...(onRefresh && { onRefresh })}
            />

            {/* 3. 다른 투어에 배정된 예약 - 투어 ID별 그룹화 */}
            <div className="mb-6">
              <h3 className="text-md font-semibold text-gray-900 mb-3">{t('otherToursAssigned')}</h3>
              {Object.keys(groupedOtherToursReservations).length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm">{t('noOtherToursReservations')}</p>
                </div>
              ) : (
                 <div className="space-y-4">
                   {Object.entries(groupedOtherToursReservations).map(([tourId, reservations]) => {
                     const tourInfo = tourInfos[tourId]
                     const guideName = tourInfo ? getTeamMemberName(tourInfo.tour_guide_id) : t('unknown')
                     const assistantName = tourInfo ? getTeamMemberName(tourInfo.assistant_id) : t('unassigned')
                     
                     // 예약들의 상태 뱃지들
                     const statusCounts = reservations.reduce((acc, reservation) => {
                       const status = reservation.status || 'unknown'
                       const assignmentStatus = reservation.assignment_status || 'unknown'
                       
                       acc.status[status] = (acc.status[status] || 0) + 1
                       acc.assignmentStatus[assignmentStatus] = (acc.assignmentStatus[assignmentStatus] || 0) + 1
                       return acc
                     }, { status: {} as Record<string, number>, assignmentStatus: {} as Record<string, number> })
                     
                     // 총 인원 계산
                     const totalPeople = reservations.reduce((sum, reservation) => {
                       const adults = reservation.adults || 0
                       const children = reservation.children || 0
                       const infants = reservation.infants || 0
                       return sum + adults + children + infants
                     }, 0)
                     
                     return (
                       <div key={tourId} className="border rounded-lg p-3 bg-gray-50">
                         <div className="flex items-center justify-between mb-3">
                           <div className="flex-1">
                             <div className="flex items-center space-x-4 mb-2">
                               <div>
                                 <h4 className="text-sm font-medium text-gray-900">
                                   {t('guide')}: {guideName}
                                 </h4>
                                 <p className="text-xs text-gray-600">
                                   {t('assistant')}: {assistantName}
                                 </p>
                               </div>
                               <div className="flex flex-wrap gap-1">
                                 {Object.entries(statusCounts.status).map(([status, count]) => (
                                   <span
                                     key={status}
                                     className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeColor(status)}`}
                                   >
                                     {status} ({count})
                                   </span>
                                 ))}
                                 {Object.entries(statusCounts.assignmentStatus).map(([assignmentStatus, count]) => (
                                   <span
                                     key={`assignment-${assignmentStatus}`}
                                     className={`text-xs px-2 py-1 rounded-full ${getAssignmentStatusBadgeColor(assignmentStatus)}`}
                                   >
                                     {assignmentStatus} ({count})
                                   </span>
                                 ))}
                               </div>
                             </div>
                           </div>
                           <div className="flex items-center space-x-2">
                             <span className="text-xs text-gray-500">
                               {reservations.length} {t('reservations')}
                             </span>
                             {totalPeople > 0 && (
                               <div className="flex items-center space-x-1">
                                 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                   👥 <span>{totalPeople}</span>
                                 </span>
                                 {tourId !== 'unknown' && (
                                   <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 font-mono">
                                     {tourId.substring(0, 8)}
                                   </span>
                                 )}
                               </div>
                             )}
                             {onNavigateToTour && tourId !== 'unknown' && (
                               <button
                                 onClick={() => onNavigateToTour(tourId)}
                                 className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                 title={t('tourNavigate')}
                               >
                                 {t('tourNavigate')}
                               </button>
                             )}
                           </div>
                         </div>
                         <ReservationSection
                           title=""
                           reservations={reservations}
                           isStaff={isStaff}
                           showActions={true}
                           showStatus={true}
                           showTourInfo={true}
                           emptyMessage=""
                           onEditReservation={onEditReservationClick}
                           onReassignFromOtherTour={onReassignFromOtherTour}
                           {...(onEditPickupTime && { onEditPickupTime })}
                           {...(onEditPickupHotel && { onEditPickupHotel })}
                           getCustomerName={getCustomerName}
                           getCustomerLanguage={getCustomerLanguage}
                           {...(getChannelInfo && { getChannelInfo })}
                           safeJsonParse={safeJsonParse}
                           pickupHotels={pickupHotels}
                           {...(onRefresh && { onRefresh })}
                         />
                       </div>
                     )
                   })}
                 </div>
              )}
            </div>

            {/* 4. 다른 상태의 예약 */}
            <ReservationSection
              title={t('otherStatus')}
              reservations={otherStatusReservations}
              isStaff={isStaff}
              showActions={false}
              showStatus={true}
              emptyMessage={t('noOtherStatusReservations')}
              onEditReservation={onEditReservationClick}
              {...(onEditPickupTime && { onEditPickupTime })}
              {...(onEditPickupHotel && { onEditPickupHotel })}
              getCustomerName={getCustomerName}
              getCustomerLanguage={getCustomerLanguage}
              {...(getChannelInfo && { getChannelInfo })}
              safeJsonParse={safeJsonParse}
              pickupHotels={pickupHotels}
              {...(onRefresh && { onRefresh })}
            />
          </div>
        )}
      </div>
    </div>
  )
}