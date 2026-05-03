import React, { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { ReservationSection } from './ReservationSection'
import { supabase } from '@/lib/supabase'
import { ChevronDown, ChevronUp, Sparkles, Wallet, X } from 'lucide-react'
import { getStatusColor, getStatusText, getAssignmentStatusColor, getAssignmentStatusText } from '@/utils/tourStatusUtils'
import {
  getBalanceAmountForDisplay,
  withNormalizedBalanceAmountForDisplay,
  type PartySizeSource,
  type PricingBalanceFields,
  type PaymentRecordLike,
} from '@/utils/reservationPricingBalance'
import { getReservationPartySize } from '@/utils/reservationUtils'
import AutoAssignModal from './modals/AutoAssignModal'

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
  tour_status: string | null
  assignment_status: string | null
}

interface TeamMember {
  email: string
  name_ko: string | null
  name_en: string | null
  nick_name?: string | null
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
  onAssignReservation?: (reservationId: string) => void
  onUnassignReservation: (reservationId: string) => void
  /** 다른 투어로 옮기기(미구현 시 생략 가능) */
  onReassignFromOtherTour?: (reservationId: string, fromTourId: string) => void
  onStatusChange?: (reservationId: string, newStatus: string) => Promise<void>
  onNavigateToTour?: (tourId: string) => void
  onEditPickupTime?: (reservation: Reservation) => void
  onEditPickupHotel?: (reservation: Reservation) => void
  getCustomerName: (customerId: string) => string
  getCustomerLanguage: (customerId: string) => string
  getChannelInfo?: (channelId: string) => Promise<{ name: string; favicon?: string } | null | undefined>
  safeJsonParse: (data: string | object | null | undefined, fallback?: unknown) => unknown
  pickupHotels?: Array<{ id: string; hotel: string; pick_up_location?: string }>
  onRefresh?: (updatedPickup?: { reservationId: string; pickup_time: string; pickup_hotel: string }) => Promise<void> | void
  hasMultipleToursOnSameDay?: boolean
  currentTourId?: string
  productId?: string | null
  tourDate?: string | null
  onAutoAssignSuccess?: () => Promise<void>
  /** 예약 product_id → product_code (거주 상태 UI) */
  allProducts?: Array<{ id: string; product_code?: string | null }>
  /** 같은 상품·날짜의 다른 투어 id (현재 투어 제외). 1개 이상이면 1번 섹션에서 다른 투어로 배정 가능 */
  sameDayPeerTourIds?: string[]
  onMoveAssignedReservationToTour?: (reservationId: string, targetTourId: string) => Promise<void>
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
  onAssignReservation,
  onUnassignReservation,
  onReassignFromOtherTour,
  onStatusChange,
  onNavigateToTour,
  onEditPickupTime,
  onEditPickupHotel,
  getCustomerName,
  getCustomerLanguage,
  getChannelInfo,
  safeJsonParse,
  pickupHotels = [],
  onRefresh,
  hasMultipleToursOnSameDay = false,
  currentTourId = '',
  productId = null,
  tourDate = null,
  onAutoAssignSuccess,
  allProducts = [],
  sameDayPeerTourIds = [],
  onMoveAssignedReservationToTour
}) => {
  const getProductCodeForReservation = React.useCallback(
    (r: Reservation) => {
      const pid = r.product_id
      if (!pid || !allProducts.length) return null
      return allProducts.find((p) => p.id === pid)?.product_code ?? null
    },
    [allProducts]
  )

  const t = useTranslations('tours.assignmentManagement')
  const tHeader = useTranslations('tours.tourHeader')
  const locale = useLocale()
  const isExpanded = expandedSections.has('assignment-management')
  const [tourInfos, setTourInfos] = useState<Record<string, TourInfo>>({})
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [showAutoAssignModal, setShowAutoAssignModal] = useState(false)
  const [assignedBalanceTotal, setAssignedBalanceTotal] = useState(0)

  const [moveToTourModalReservationId, setMoveToTourModalReservationId] = useState<string | null>(null)
  const [peerPickerRows, setPeerPickerRows] = useState<Array<{ id: string; label: string }>>([])
  const [peerPickerLoading, setPeerPickerLoading] = useState(false)
  const [selectedTargetTourId, setSelectedTargetTourId] = useState<string | null>(null)
  const [moveSubmitting, setMoveSubmitting] = useState(false)

  useEffect(() => {
    const loadAssignedBalanceTotal = async () => {
      const reservationIds = [...new Set(assignedReservations.map((r) => String(r.id).trim()).filter(Boolean))]
      if (reservationIds.length === 0) {
        setAssignedBalanceTotal(0)
        return
      }

      try {
        const [{ data: pricingRows, error: pErr }, { data: payRows, error: payErr }, { data: optRows, error: oErr }] =
          await Promise.all([
            supabase.from('reservation_pricing').select('*').in('reservation_id', reservationIds),
            supabase
              .from('payment_records')
              .select('reservation_id, payment_status, amount')
              .in('reservation_id', reservationIds),
            supabase.from('reservation_options').select('reservation_id, total_price').in('reservation_id', reservationIds),
          ])

        if (pErr || payErr || oErr) {
          console.error('배정 예약 잔금 합계 조회 오류:', pErr || payErr || oErr)
          setAssignedBalanceTotal(0)
          return
        }

        const pricingById = new Map<string, Record<string, unknown>>()
        for (const row of pricingRows || []) {
          const id = String((row as { reservation_id: string }).reservation_id)
          pricingById.set(id, row as Record<string, unknown>)
        }

        const paymentsById = new Map<string, PaymentRecordLike[]>()
        for (const row of payRows || []) {
          const id = String((row as { reservation_id: string }).reservation_id)
          const list = paymentsById.get(id) || []
          list.push({
            payment_status: String((row as { payment_status?: string | null }).payment_status || ''),
            amount: Number((row as { amount?: unknown }).amount) || 0,
          })
          paymentsById.set(id, list)
        }

        const optSumById = new Map<string, number>()
        const optCountById = new Map<string, number>()
        for (const row of optRows || []) {
          const id = String((row as { reservation_id: string }).reservation_id)
          const tp = Number((row as { total_price?: unknown }).total_price) || 0
          optSumById.set(id, (optSumById.get(id) || 0) + tp)
          optCountById.set(id, (optCountById.get(id) || 0) + 1)
        }

        const resById = new Map(assignedReservations.map((r) => [String(r.id), r]))

        let total = 0
        for (const id of reservationIds) {
          const pricing = pricingById.get(id)
          const res = resById.get(id)
          if (!pricing || !res) continue

          const row = res as Record<string, unknown>
          const paRaw = pricing.pricing_adults
          const hasPa =
            paRaw !== undefined &&
            paRaw !== null &&
            paRaw !== '' &&
            Number.isFinite(Number(paRaw)) &&
            Math.floor(Number(paRaw)) >= 0
          const party: PartySizeSource = {
            adults: hasPa ? Math.floor(Number(paRaw)) : ((row.adults as number | null | undefined) ?? null),
            children: (row.children ?? row.child ?? null) as number | null,
            infants: (row.infants ?? row.infant ?? null) as number | null,
          }

          const nOpts = optCountById.get(id) ?? 0
          const optionsTotalFromOptions = nOpts > 0 ? (optSumById.get(id) || 0) : null

          const b = getBalanceAmountForDisplay(
            withNormalizedBalanceAmountForDisplay(pricing),
            optionsTotalFromOptions,
            party,
            {
              paymentRecords: paymentsById.get(id) || [],
              reservationStatus: res.status ?? null,
            }
          )
          if (b > 0) total += b
        }

        setAssignedBalanceTotal(total)
      } catch (error) {
        console.error('배정 예약 잔금 합계 조회 중 오류:', error)
        setAssignedBalanceTotal(0)
      }
    }

    void loadAssignedBalanceTotal()
  }, [assignedReservations])

  const formatBalanceBadge = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return '$0.00'
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const peerIdsKey = React.useMemo(
    () => [...sameDayPeerTourIds].sort().join('|'),
    [sameDayPeerTourIds]
  )

  const openMoveToTourPicker = React.useCallback((reservationId: string) => {
    setSelectedTargetTourId(null)
    setMoveToTourModalReservationId(reservationId)
  }, [])

  useEffect(() => {
    if (!moveToTourModalReservationId) {
      setPeerPickerRows([])
      setSelectedTargetTourId(null)
      return
    }
    const ids = sameDayPeerTourIds
    if (ids.length === 0) {
      setPeerPickerRows([])
      return
    }
    let cancelled = false
    ;(async () => {
      setPeerPickerLoading(true)
      try {
        const { data: toursData, error } = await supabase
          .from('tours')
          .select('id, tour_guide_id, assistant_id')
          .in('id', ids)
        if (error) {
          console.error('피어 투어 조회 오류:', error)
          if (!cancelled) setPeerPickerRows([])
          return
        }
        if (cancelled) return
        const emails = new Set<string>()
        ;(toursData || []).forEach((row: { tour_guide_id?: string | null; assistant_id?: string | null }) => {
          if (row.tour_guide_id) emails.add(row.tour_guide_id)
          if (row.assistant_id) emails.add(row.assistant_id)
        })
        const teamByEmail = new Map<string, string>()
        if (emails.size > 0) {
          const { data: teamData } = await supabase
            .from('team')
            .select('email, name_ko, name_en, nick_name')
            .in('email', [...emails])
          ;(teamData || []).forEach((m: TeamMember) => {
            teamByEmail.set(m.email, m.nick_name || m.name_ko || m.name_en || m.email)
          })
        }
        const rows = (toursData || [])
          .map((row: { id: string; tour_guide_id?: string | null }) => ({
            id: row.id,
            label: `${row.tour_guide_id ? teamByEmail.get(row.tour_guide_id) || row.tour_guide_id : t('unassigned')} · ${row.id.slice(0, 8)}`
          }))
          .sort((a, b) => a.label.localeCompare(b.label, locale))
        if (!cancelled) {
          setPeerPickerRows(rows)
          setSelectedTargetTourId(rows.length === 1 ? rows[0].id : null)
        }
      } finally {
        if (!cancelled) setPeerPickerLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [moveToTourModalReservationId, peerIdsKey, locale, t])

  const handleConfirmMoveToTour = async () => {
    if (!moveToTourModalReservationId || !selectedTargetTourId || !onMoveAssignedReservationToTour) return
    setMoveSubmitting(true)
    try {
      await onMoveAssignedReservationToTour(moveToTourModalReservationId, selectedTargetTourId)
      setMoveToTourModalReservationId(null)
    } finally {
      setMoveSubmitting(false)
    }
  }

  // 다른 투어에 배정된 예약의 투어 정보 가져오기
  useEffect(() => {
    const fetchTourInfos = async () => {
      if (otherToursAssignedReservations.length === 0) return

      try {
        // 그룹화와 동일한 키 사용: assigned_tour_id 우선, 없으면 tour_id
        const uniqueTourIds = [...new Set(
          otherToursAssignedReservations
            .map(r => (r as { assigned_tour_id?: string | null; tour_id: string | null }).assigned_tour_id || r.tour_id)
            .filter(Boolean)
        )] as string[]

        if (uniqueTourIds.length === 0) return

        // 투어 정보 가져오기
        const { data: toursData, error: toursError } = await supabase
          .from('tours')
          .select('id, tour_guide_id, assistant_id, tour_status, assignment_status')
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
            .select('email, name_ko, name_en, nick_name')
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
    
    return member.nick_name || member.name_ko || member.name_en || email
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
  // assigned_tour_id를 사용하여 그룹화 (각 투어의 reservation_ids에 있는 예약만 표시)
  const groupedOtherToursReservations = otherToursAssignedReservations.reduce((groups, reservation) => {
    // assigned_tour_id가 있으면 사용하고, 없으면 reservation의 tour_id 사용
    const tourId = (reservation as any).assigned_tour_id || reservation.tour_id || 'unknown'
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
              <div className="mb-4 flex flex-wrap items-center gap-2">
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
                {hasMultipleToursOnSameDay && currentTourId && productId && tourDate && (
                  <button
                    onClick={() => setShowAutoAssignModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600 text-white text-sm rounded hover:bg-amber-700"
                    title={locale === 'ko' ? '조건에 맞게 팀 배정 제안 및 적용' : 'Auto-assign by language, choice, hotel, capacity'}
                  >
                    <Sparkles className="w-4 h-4" />
                    {locale === 'ko' ? '자동 배정' : 'Auto assign'}
                  </button>
                )}
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
              {...(sameDayPeerTourIds.length > 0 &&
                onMoveAssignedReservationToTour && {
                  onMoveReservationToOtherTour: openMoveToTourPicker,
                  moveToOtherTourButtonTitle: t('moveToOtherTour')
                })}
              {...(onStatusChange && { onStatusChange })}
              {...(onEditPickupTime && { onEditPickupTime })}
              {...(onEditPickupHotel && { onEditPickupHotel })}
              getCustomerName={getCustomerName}
              getCustomerLanguage={getCustomerLanguage}
              {...(getChannelInfo && { getChannelInfo })}
              safeJsonParse={safeJsonParse}
              pickupHotels={pickupHotels}
              {...(onRefresh && { onRefresh })}
              getProductCodeForReservation={getProductCodeForReservation}
              headerBadges={
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  <Wallet className="w-3.5 h-3.5" />
                  <span>{`잔금 ${formatBalanceBadge(assignedBalanceTotal)}`}</span>
                </span>
              }
            />

            {/* 2. 배정 대기 중인 예약 */}
            <ReservationSection
              title={t('pendingAssignments')}
              reservations={pendingReservations}
              isStaff={isStaff}
              showActions={true}
              showStatus={true}
              emptyMessage={t('noPendingReservations')}
              onEditReservation={onEditReservationClick}
              {...(onAssignReservation && { onAssignReservation })}
              {...(onStatusChange && { onStatusChange })}
              {...(onEditPickupTime && { onEditPickupTime })}
              {...(onEditPickupHotel && { onEditPickupHotel })}
              getCustomerName={getCustomerName}
              getCustomerLanguage={getCustomerLanguage}
              {...(getChannelInfo && { getChannelInfo })}
              safeJsonParse={safeJsonParse}
              pickupHotels={pickupHotels}
              {...(onRefresh && { onRefresh })}
              getProductCodeForReservation={getProductCodeForReservation}
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
                     const tourStatus = tourInfo?.tour_status || null
                     const assignmentStatus = tourInfo?.assignment_status || null
                     
                     // 예약들의 상태 뱃지들
                     const statusCounts = reservations.reduce((acc, reservation) => {
                       const status = reservation.status || 'unknown'
                       const assignmentStatus = reservation.assignment_status || 'unknown'
                       
                       acc.status[status] = (acc.status[status] || 0) + 1
                       acc.assignmentStatus[assignmentStatus] = (acc.assignmentStatus[assignmentStatus] || 0) + 1
                       return acc
                     }, { status: {} as Record<string, number>, assignmentStatus: {} as Record<string, number> })
                     
                     // 총 인원 계산 (성인+아동+유아; child/infant 필드 호환)
                     const totalPeople = reservations.reduce(
                       (sum, reservation) => sum + getReservationPartySize(reservation as Record<string, unknown>),
                       0
                     )
                     
                     return (
                       <div key={tourId} className="border rounded-lg p-3 bg-gray-50">
                         {/* 헤더: 모바일 최적화 - 여러 줄로 배치 */}
                         <div className="mb-3 space-y-2">
                           {/* 1행: 가이드 및 어시스턴트 정보 + 투어 ID (오른쪽 상단) */}
                           <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                             <div>
                               <h4 className="text-sm font-medium text-gray-900">
                                 {t('guide')}: {guideName}
                               </h4>
                               <p className="text-xs text-gray-600">
                                 {t('assistant')}: {assistantName}
                               </p>
                             </div>
                             <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                               {/* 투어 상태 및 배정 상태 */}
                               {tourStatus && (
                                 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tourStatus)}`}>
                                   {tHeader('tour')}: {getStatusText(tourStatus, locale)}
                                 </span>
                               )}
                               {assignmentStatus && (
                                 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getAssignmentStatusColor({ assignment_status: assignmentStatus })}`}>
                                   {tHeader('assignment')}: {getAssignmentStatusText({ assignment_status: assignmentStatus }, locale)}
                                 </span>
                               )}
                               {tourId !== 'unknown' && (
                                 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 font-mono self-start sm:self-auto">
                                   {tourId.substring(0, 8)}
                                 </span>
                               )}
                             </div>
                           </div>
                           
                           {/* 2행: 예약 상태 뱃지들 */}
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
                           
                           {/* 3행: 예약 건수, 인원, 버튼 */}
                           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                             <div className="flex flex-wrap items-center gap-2">
                               <span className="text-xs text-gray-500">
                                 {reservations.length} {t('reservations')}
                               </span>
                               {totalPeople > 0 && (
                                 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                   👥 <span>{totalPeople}</span>
                                 </span>
                               )}
                             </div>
                             {onNavigateToTour && tourId !== 'unknown' && (
                               <button
                                 onClick={() => onNavigateToTour(tourId)}
                                 className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors w-full sm:w-auto"
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
                           emptyMessage=""
                           onEditReservation={onEditReservationClick}
                           {...(onAssignReservation && { onAssignReservation })}
                           assignIconVariant="import"
                           assignButtonTitle={t('assignToThisTourPullIn')}
                           {...(onReassignFromOtherTour && { onReassignFromOtherTour })}
                           {...(onStatusChange && { onStatusChange })}
                           {...(onEditPickupTime && { onEditPickupTime })}
                           {...(onEditPickupHotel && { onEditPickupHotel })}
                           getCustomerName={getCustomerName}
                           getCustomerLanguage={getCustomerLanguage}
                           {...(getChannelInfo && { getChannelInfo })}
                           safeJsonParse={safeJsonParse}
                           pickupHotels={pickupHotels}
                           {...(onRefresh && { onRefresh })}
                           getProductCodeForReservation={getProductCodeForReservation}
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
              {...(onStatusChange && { onStatusChange })}
              {...(onEditPickupTime && { onEditPickupTime })}
              {...(onEditPickupHotel && { onEditPickupHotel })}
              getCustomerName={getCustomerName}
              getCustomerLanguage={getCustomerLanguage}
              {...(getChannelInfo && { getChannelInfo })}
              safeJsonParse={safeJsonParse}
              pickupHotels={pickupHotels}
              {...(onRefresh && { onRefresh })}
              getProductCodeForReservation={getProductCodeForReservation}
            />
          </div>
        )}
      </div>

      {showAutoAssignModal && currentTourId && productId && tourDate && onAutoAssignSuccess && (
        <AutoAssignModal
          isOpen={showAutoAssignModal}
          onClose={() => setShowAutoAssignModal(false)}
          currentTourId={currentTourId}
          productId={productId}
          tourDate={tourDate}
          getCustomerName={getCustomerName}
          getCustomerLanguage={getCustomerLanguage}
          onSuccess={onAutoAssignSuccess}
        />
      )}

      {moveToTourModalReservationId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="move-to-tour-modal-title"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 id="move-to-tour-modal-title" className="text-base font-semibold text-gray-900">
                {t('moveToOtherTourModalTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setMoveToTourModalReservationId(null)}
                className="p-1 rounded hover:bg-gray-100 text-gray-500"
                aria-label={t('moveToOtherTourCancel')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-3 overflow-y-auto flex-1">
              <p className="text-sm text-gray-600 mb-3">{t('moveToOtherTourModalHint')}</p>
              {peerPickerLoading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                  <span className="text-xs text-gray-500">{t('moveToOtherTourLoading')}</span>
                </div>
              ) : peerPickerRows.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">{t('moveToOtherTourNoTargets')}</p>
              ) : (
                <ul className="space-y-2">
                  {peerPickerRows.map((row) => {
                    const selected = selectedTargetTourId === row.id
                    return (
                      <li key={row.id}>
                        <label
                          className={`flex items-start gap-2 cursor-pointer rounded-lg border p-3 ${
                            selected
                              ? 'border-indigo-500 bg-indigo-50/50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="move-to-tour-target"
                            value={row.id}
                            checked={selected}
                            onChange={() => setSelectedTargetTourId(row.id)}
                            className="mt-1"
                          />
                          <span className="text-sm text-gray-900">{row.label}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t px-4 py-3 bg-gray-50 rounded-b-lg">
              <button
                type="button"
                onClick={() => setMoveToTourModalReservationId(null)}
                className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded"
              >
                {t('moveToOtherTourCancel')}
              </button>
              <button
                type="button"
                disabled={!selectedTargetTourId || moveSubmitting || peerPickerLoading || peerPickerRows.length === 0}
                onClick={() => void handleConfirmMoveToTour()}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {moveSubmitting ? '…' : t('moveToOtherTourConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}