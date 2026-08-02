import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { chunkStrings } from '@/lib/supabaseInChunks'
import {
  attachCancellationFollowUpMeta,
  fetchCancellationFollowUpMeta,
} from '@/lib/reservationCancellationReason'
import {
  calculateAssignedPeople,
  getDefaultTeamTypeForProduct,
  sumPeopleSameProductDate,
  isReservationDeletedStatus,
  isReservationCancelledStatus,
  normalizeReservationIds,
  dedupeReservationIdsPreservingOrder,
  dedupeReservationsPreservingOrder,
  canonicalReservationIdKey,
  reservationIdsLooselyEqual,
  parseTourAssignmentEmails,
} from '@/utils/tourUtils'
import { useAuth } from '@/contexts/AuthContext'
import { isInactiveVehicleStatus } from '@/lib/vehicleStatus'
import { scheduleDeferredWork } from '@/lib/scheduleDeferredWork'
import { getPickupHotelPrimaryName } from '@/utils/pickupHotelUtils'

// 타입 정의
type TourRow = Database['public']['Tables']['tours']['Row']
type ReservationRow = Database['public']['Tables']['reservations']['Row']
type PickupHotel = Database['public']['Tables']['pickup_hotels']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']
type ProductRow = { id: string; name_ko?: string | null; name_en?: string | null; [k: string]: unknown }
type CustomerRow = { id: string; name?: string | null; email?: string | null; language?: string | null; [k: string]: unknown }
/** team 테이블 (팀 구성 드롭다운: position·is_active·nick_name 필요) */
type TeamMember = {
  email: string
  name_ko: string
  name_en?: string | null
  display_name?: string | null
  nick_name?: string | null
  position?: string | null
  is_active?: boolean | null
}

// 확장된 예약 타입 (고객 정보 포함)
type ExtendedReservationRow = ReservationRow & {
  customers?: CustomerRow | null
  customer_name?: string
  customer_email?: string
  customer_language?: string
  assigned_tour_id?: string | null
  /** reservation_follow_ups cancellation_reason (배정 관리 카드 등) */
  cancellation_reason?: string | null
  /** 취소 사유 follow-up 최초 생성 시각(취소일 표시용) */
  cancellation_recorded_at?: string | null
}

export function useTourDetailData(opts?: { tourId?: string | null; modalLightLoad?: boolean }) {
  const modalLightLoad = opts?.modalLightLoad === true
  const params = useParams()
  const locale = useLocale()
  const effectiveTourId =
    typeof opts?.tourId === 'string' && opts.tourId.trim() !== ''
      ? opts.tourId.trim()
      : typeof params?.id === 'string'
        ? params.id
        : null
  const { hasPermission, userRole, user, loading } = useAuth()
  
  // 기본 상태들
  const [tour, setTourState] = useState<TourRow | null>(null)
  /** 배정 변경 직후 백그라운드 로드가 이전 reservation_ids 로 덮어쓰지 않도록 */
  const tourReservationIdsRef = useRef<string[]>([])
  const reservationIdsOverrideRef = useRef(false)
  /** 배정 변경 후 늦게 끝나는 백그라운드 로드가 UI를 덮어쓰지 않도록 */
  const assignmentMutationEpochRef = useRef(0)
  const deferredAssignmentCancelRef = useRef<(() => void) | null>(null)

  const reservationIdsSetsEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false
    return a.every((id) => b.some((other) => reservationIdsLooselyEqual(id, other)))
  }

  /** 배정 변경 직전(네트워크 await 전)에 호출 — 백그라운드 버킷 갱신 차단 */
  const beginAssignmentIdsMutation = useCallback((nextIds: string[]) => {
    deferredAssignmentCancelRef.current?.()
    deferredAssignmentCancelRef.current = null
    tourReservationIdsRef.current = dedupeReservationIdsPreservingOrder(nextIds)
    reservationIdsOverrideRef.current = true
    assignmentMutationEpochRef.current += 1
  }, [])

  const clearAssignmentIdsMutationOverride = useCallback(() => {
    reservationIdsOverrideRef.current = false
  }, [])

  const getEffectiveTourReservationIds = useCallback((): string[] => {
    if (reservationIdsOverrideRef.current) {
      return dedupeReservationIdsPreservingOrder(tourReservationIdsRef.current)
    }
    return dedupeReservationIdsPreservingOrder(tour?.reservation_ids)
  }, [tour?.reservation_ids])

  const setTour = useCallback<React.Dispatch<React.SetStateAction<TourRow | null>>>((updater) => {
    setTourState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (next?.reservation_ids !== undefined) {
        const nextIds = dedupeReservationIdsPreservingOrder(next.reservation_ids)
        const prevIds = dedupeReservationIdsPreservingOrder(prev?.reservation_ids)
        if (!reservationIdsSetsEqual(nextIds, prevIds)) {
          tourReservationIdsRef.current = nextIds
          reservationIdsOverrideRef.current = true
          assignmentMutationEpochRef.current += 1
        }
      }
      if (next === null) {
        tourReservationIdsRef.current = []
        reservationIdsOverrideRef.current = false
      }
      return next
    })
  }, [])
  const [isPrivateTour, setIsPrivateTour] = useState<boolean>(false)
  const [showPrivateTourModal, setShowPrivateTourModal] = useState(false)
  const [pendingPrivateTourValue, setPendingPrivateTourValue] = useState<boolean>(false)
  const [showPickupHotelModal, setShowPickupHotelModal] = useState(false)
  const [selectedReservationForHotelChange, setSelectedReservationForHotelChange] = useState<any>(null)
  const [hotelSearchTerm, setHotelSearchTerm] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<{[key: string]: boolean}>({})
  const [productOptions, setProductOptions] = useState<{[productId: string]: {[optionId: string]: {id: string, name: string}}}>({})
  
  // 드롭다운 상태 관리
  const [showTourStatusDropdown, setShowTourStatusDropdown] = useState(false)
  const [showAssignmentStatusDropdown, setShowAssignmentStatusDropdown] = useState(false)
  
  // 아코디언 상태 관리
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() =>
    modalLightLoad
      ? new Set(['pickup-schedule', 'team-vehicle-assignment', 'assignment-management'])
      : new Set([
          'team-composition',
          'vehicle-assignment',
          'team-vehicle-assignment',
          'pickup-schedule',
          'assignment-management',
        ])
  )

  // 데이터 상태들
  const [product, setProduct] = useState<ProductRow | null>(null)
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [reservations, setReservations] = useState<ReservationRow[]>([])
  const [allReservations, setAllReservations] = useState<ExtendedReservationRow[]>([])
  const [allTours, setAllTours] = useState<TourRow[]>([])
  const [allProducts, setAllProducts] = useState<ProductRow[]>([])
  const [channels, setChannels] = useState<{ id: string; name: string; favicon_url?: string }[]>([])
  const [assignedReservations, setAssignedReservationsState] = useState<ReservationRow[]>([])
  const [pendingReservations, setPendingReservationsState] = useState<ReservationRow[]>([])
  const [otherToursAssignedReservations, setOtherToursAssignedReservationsState] = useState<
    (ReservationRow & { assigned_tour_id?: string | null })[]
  >([])

  const setAssignedReservations = useCallback<React.Dispatch<React.SetStateAction<ReservationRow[]>>>(
    (updater) => {
      if (reservationIdsOverrideRef.current) return
      setAssignedReservationsState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        return dedupeReservationsPreservingOrder(next)
      })
    },
    []
  )
  const setAssignedReservationsForced = useCallback<React.Dispatch<React.SetStateAction<ReservationRow[]>>>(
    (updater) => {
      setAssignedReservationsState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        return dedupeReservationsPreservingOrder(next)
      })
    },
    []
  )
  const setPendingReservations = useCallback<React.Dispatch<React.SetStateAction<ReservationRow[]>>>(
    (updater) => {
      if (reservationIdsOverrideRef.current) return
      setPendingReservationsState(updater)
    },
    []
  )
  const setPendingReservationsForced = useCallback<React.Dispatch<React.SetStateAction<ReservationRow[]>>>(
    (updater) => {
      setPendingReservationsState(updater)
    },
    []
  )
  const setOtherToursAssignedReservations = useCallback<
    React.Dispatch<React.SetStateAction<(ReservationRow & { assigned_tour_id?: string | null })[]>>
  >((updater) => {
    if (reservationIdsOverrideRef.current) return
    setOtherToursAssignedReservationsState(updater)
  }, [])
  const [otherStatusReservations, setOtherStatusReservations] = useState<ReservationRow[]>([])
  const [inactiveReservations, setInactiveReservations] = useState<ReservationRow[]>([])
  const [pickupHotels, setPickupHotels] = useState<PickupHotel[]>([])
  const [pickupTimeValue, setPickupTimeValue] = useState<string>('')
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<ReservationRow | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamType, setTeamType] = useState<'1guide' | '2guide' | 'guide+driver'>('1guide')
  const [selectedGuide, setSelectedGuide] = useState<string>('')
  const [selectedAssistant, setSelectedAssistant] = useState<string>('')
  const [tourNote, setTourNote] = useState<string>('')
  const [pageLoading, setPageLoading] = useState(true)
  const [loadingStates, setLoadingStates] = useState({
    tour: false,
    reservations: false,
    customers: false,
    bookings: false,
    modal: false
  })
  const [editingReservation, setEditingReservation] = useState<ReservationRow | null>(null)
  const [showVehicleAssignment, setShowVehicleAssignment] = useState(false)
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('')
  const [vehiclesLoading, setVehiclesLoading] = useState<boolean>(false)
  const [vehiclesError, setVehiclesError] = useState<string>('')
  const [sameDayTourIds, setSameDayTourIds] = useState<string[]>([])

  // 권한 확인
  const isStaff = hasPermission('canManageReservations') || hasPermission('canManageTours') || (userRole === 'admin' || userRole === 'manager')

  // 아코디언 토글 함수
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = () => {
      if (showTourStatusDropdown || showAssignmentStatusDropdown) {
        setShowTourStatusDropdown(false)
        setShowAssignmentStatusDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showTourStatusDropdown, showAssignmentStatusDropdown])

  // 투어 데이터 가져오기
  useEffect(() => {
    let cancelled = false

    if (!effectiveTourId) {
      setPageLoading(false)
      return
    }

    tourReservationIdsRef.current = []
    reservationIdsOverrideRef.current = false

    const fetchTourData = async () => {
      if (!effectiveTourId || typeof effectiveTourId !== 'string') {
        return
      }

      setPageLoading(true)

      try {
        const { data: tourData, error: tourError } = await supabase
          .from('tours')
          .select(`
            *,
            products (*)
          `)
          .eq('id', effectiveTourId)
          .maybeSingle()

        if (tourError) {
          if (!isAbortLikeError(tourError)) {
            console.error('투어 데이터 가져오기 오류:', tourError)
          }
          return
        }

        if (!tourData) {
          setTourState(null)
          setProduct(null)
          return
        }

        if (cancelled) return

        setTourState(tourData as TourRow)
        tourReservationIdsRef.current = dedupeReservationIdsPreservingOrder(
          (tourData as TourRow).reservation_ids
        )
        reservationIdsOverrideRef.current = false
        setIsPrivateTour((tourData as TourRow).is_private_tour || false)
        setTourNote((tourData as TourRow).tour_note || '')
        setProduct((tourData as any).products as ProductRow | null)

        // 모달: 투어 헤더만이라도 즉시 그려 체감 대기 시간을 줄임
        if (modalLightLoad) {
          setPageLoading(false)
        }

        const tour = tourData as TourRow
        const productFromTour = (tourData as { products?: ProductRow | null }).products ?? null
        if (tour.team_type) {
          setTeamType(tour.team_type as '1guide' | '2guide' | 'guide+driver')
        } else {
          setTeamType(getDefaultTeamTypeForProduct(productFromTour?.name_ko, productFromTour?.name_en))
        }

        const productId = tour.product_id
        const tourDate = tour.tour_date

        const loadReservationsForProductDate = async (): Promise<ExtendedReservationRow[]> => {
          if (!productId || !tourDate) return []
          const { data: reservationsData, error: reservationsError } = await supabase
            .from('reservations')
            .select('*')
            .eq('product_id', productId)
            .eq('tour_date', tourDate)

          if (reservationsError) {
            console.error('예약 데이터 가져오기 오류:', reservationsError)
            return []
          }
          const reservations = (reservationsData || []) as ReservationRow[]
          if (reservations.length === 0) return []

          const customerIds = [...new Set(reservations.map((r) => r.customer_id).filter(Boolean) as string[])]
          if (customerIds.length === 0) {
            return reservations.map((r) => ({ ...r } as ExtendedReservationRow))
          }

          const { data: customersData, error: customersError } = await supabase
            .from('customers')
            .select('*')
            .in('id', customerIds)

          if (customersError) {
            console.error('고객 정보 조회 오류:', customersError)
            return reservations.map((r) => ({ ...r } as ExtendedReservationRow))
          }

          const customers = (customersData || []) as CustomerRow[]
          return reservations.map((reservation) => {
            const customer = customers.find((c) => c.id === reservation.customer_id)
            return {
              ...reservation,
              customers: customer || null,
              customer_name: customer?.name || '정보 없음',
              customer_email: customer?.email || '',
              customer_language: customer?.language || 'Unknown',
            } as ExtendedReservationRow
          })
        }

        const loadSameDayTours = async () => {
          if (!productId || !tourDate) return [] as Array<{ id: string; reservation_ids?: unknown }>
          const { data, error } = await supabase
            .from('tours')
            .select('id, reservation_ids')
            .eq('product_id', productId)
            .eq('tour_date', tourDate)
          if (error) {
            console.error('❌ Error loading all tours with same date/product:', error)
            return []
          }
          return (data || []) as Array<{ id: string; reservation_ids?: unknown }>
        }

        const loadVehicles = async (): Promise<{ rows: Vehicle[]; err: string }> => {
          try {
            const { data: allVehicles, error: vehiclesError } = await supabase
              .from('vehicles')
              .select('*')
              .in('status', ['available', 'reserved'])
              .order('vehicle_type', { ascending: true })
              .order('vehicle_number', { ascending: true })

            if (vehiclesError) {
              const { data: allVehiclesFallback, error: vehiclesErrorFallback } = await supabase
                .from('vehicles')
                .select('*')
                .order('vehicle_number', { ascending: true })
              if (vehiclesErrorFallback) {
                return {
                  rows: [],
                  err: vehiclesErrorFallback.message || '차량 목록을 불러올 수 없습니다.',
                }
              }
              return {
                rows: (allVehiclesFallback || []).filter((v) => !isInactiveVehicleStatus(v.status)),
                err: '',
              }
            }
            return {
              rows: (allVehicles || []).filter((v) => !isInactiveVehicleStatus(v.status)),
              err: '',
            }
          } catch {
            return { rows: [], err: '차량 목록을 가져오는 중 오류가 발생했습니다.' }
          }
        }

        const assignedVehiclePromise =
          tour.tour_car_id?.trim()
            ? supabase.from('vehicles').select('*').eq('id', tour.tour_car_id.trim()).maybeSingle()
            : Promise.resolve({ data: null as Vehicle | null, error: null as null })

        const guideAssistantPromise = Promise.all([
          tour.tour_guide_id
            ? supabase
                .from('team')
                .select('email, name_ko, name_en, display_name')
                .eq('email', tour.tour_guide_id)
                .maybeSingle()
            : Promise.resolve({ data: null as TeamMember | null, error: null }),
          tour.assistant_id
            ? supabase
                .from('team')
                .select('email, name_ko, name_en, display_name')
                .eq('email', tour.assistant_id)
                .maybeSingle()
            : Promise.resolve({ data: null as TeamMember | null, error: null }),
        ])

        const loadCatalogRefBundle = () =>
          Promise.all([
            supabase
              .from('pickup_hotels')
              .select('*')
              .eq('use_for_pickup', true)
              .or('is_active.is.null,is_active.eq.true')
              .order('hotel'),
            supabase.from('products').select('*').order('name_ko'),
            supabase.from('channels').select('id, name, favicon_url').order('name'),
            supabase
              .from('team')
              .select('email, name_ko, name_en, display_name, nick_name, position, is_active')
              .order('name_ko'),
          ])

        const applyRefBundle = (refBundle: Awaited<ReturnType<typeof loadCatalogRefBundle>>) => {
          const [pickupHotelsResult, productsResult, channelsResult, teamMembersResult] = refBundle
          const { data: pickupHotelsData, error: pickupHotelsError } = pickupHotelsResult
          if (pickupHotelsError) {
            console.error('픽업 호텔 데이터 가져오기 오류:', pickupHotelsError)
          } else {
            setPickupHotels(pickupHotelsData || [])
          }

          const { data: productsData, error: productsError } = productsResult
          if (productsError) {
            console.error('상품 데이터 가져오기 오류:', productsError)
          } else {
            setAllProducts(productsData || [])
          }

          const { data: channelsData, error: channelsError } = channelsResult
          if (channelsError) {
            console.error('채널 데이터 가져오기 오류:', channelsError)
          } else {
            setChannels((channelsData || []) as { id: string; name: string; favicon_url?: string }[])
          }

          const { data: allTeamMembers, error: teamMembersError } = teamMembersResult
          if (teamMembersError) {
            console.error('팀 멤버 목록 가져오기 오류:', teamMembersError)
          } else {
            setTeamMembers((allTeamMembers || []) as TeamMember[])
          }
        }

        const applyGuideVehicle = (
          assignedVehicleRes: Awaited<typeof assignedVehiclePromise>,
          [guideRes, assistantRes]: Awaited<typeof guideAssistantPromise>
        ) => {
          if (tour.tour_guide_id) {
            const { data: guideData, error: guideError } = guideRes
            if (guideError && guideError.code !== 'PGRST116') {
              console.error('가이드 정보 가져오기 오류:', guideError)
            }
            if (guideData) {
              const g = guideData as TeamMember
              setSelectedGuide(g.email || tour.tour_guide_id || '')
            } else {
              setSelectedGuide(tour.tour_guide_id || '')
            }
          } else {
            setSelectedGuide('')
          }

          if (tour.assistant_id) {
            const { data: assistantData, error: assistantError } = assistantRes
            if (assistantError && assistantError.code !== 'PGRST116') {
              console.error('어시스턴트 정보 가져오기 오류:', assistantError)
            }
            if (assistantData) {
              const a = assistantData as TeamMember
              setSelectedAssistant(a.email || tour.assistant_id || '')
            } else {
              setSelectedAssistant(tour.assistant_id || '')
            }
          } else {
            setSelectedAssistant('')
          }

          if (tour.tour_car_id?.trim()) {
            const { data: vehicleData, error: vehicleError } = assignedVehicleRes
            if (vehicleError && vehicleError.code !== 'PGRST116') {
              console.error('차량 정보 가져오기 오류:', vehicleError)
            }
            if (vehicleData) {
              setSelectedVehicleId(tour.tour_car_id || '')
              setAssignedVehicle(vehicleData as Vehicle)
            } else {
              setSelectedVehicleId('')
              setAssignedVehicle(null)
            }
          } else {
            setSelectedVehicleId('')
            setAssignedVehicle(null)
          }
        }

        const processAssignmentBuckets = async (
          reservationsExtended: ExtendedReservationRow[],
          sameDayTours: Array<{ id: string; reservation_ids?: unknown }>,
          mutationEpochAtStart?: number
        ) => {
          if (!productId || !tourDate) {
            setSameDayTourIds([])
            setAssignedReservations([])
            setPendingReservations([])
            setOtherToursAssignedReservations([])
            setOtherStatusReservations([])
            return
          }

          let extendedList = [...reservationsExtended]
          const byCanonId = new Map<string, ExtendedReservationRow>()
          for (const r of extendedList) {
            byCanonId.set(canonicalReservationIdKey(String(r.id)), r)
          }

          const allAssignedReservationIdsSet = new Set<string>()
          const reservationToTourMap = new Map<string, string>()
          const tours = sameDayTours
          setSameDayTourIds(tours.map((t) => t.id))

          for (const trow of tours) {
            const tourRow = trow as TourRow
            const idsForTour =
              tourRow.id === tour.id && reservationIdsOverrideRef.current
                ? tourReservationIdsRef.current
                : normalizeReservationIds(tourRow.reservation_ids)
            for (const reservationId of idsForTour) {
              if (reservationId) {
                const key = canonicalReservationIdKey(reservationId)
                allAssignedReservationIdsSet.add(key)
                reservationToTourMap.set(key, tourRow.id)
              }
            }
          }

          const currentTourRow = tours.find((trow) => trow.id === tour.id) as TourRow | undefined
          const assignedIds = dedupeReservationIdsPreservingOrder(
            reservationIdsOverrideRef.current
              ? tourReservationIdsRef.current
              : currentTourRow?.reservation_ids ?? tour.reservation_ids
          )
          const missingAssigned: string[] = []
          for (const aid of assignedIds) {
            const k = canonicalReservationIdKey(aid)
            if (!byCanonId.has(k)) {
              missingAssigned.push(String(aid).trim())
            }
          }

          if (missingAssigned.length > 0) {
            const missRes: ReservationRow[] = []
            for (const chunk of chunkStrings(missingAssigned)) {
              const { data: missData, error: missErr } = await supabase
                .from('reservations')
                .select('*')
                .in('id', chunk)
              if (missErr) {
                console.error('누락 배정 예약 조회 오류 (chunk):', missErr)
                continue
              }
              if (missData?.length) missRes.push(...(missData as ReservationRow[]))
            }
            if (missRes.length > 0) {
              const mcIds = [...new Set(missRes.map((r) => r.customer_id).filter(Boolean) as string[])]
              let mcRows: CustomerRow[] = []
              if (mcIds.length > 0) {
                const { data: mc } = await supabase.from('customers').select('*').in('id', mcIds)
                mcRows = (mc || []) as CustomerRow[]
              }
              for (const r of missRes) {
                const customer = mcRows.find((c) => c.id === r.customer_id)
                const ext = {
                  ...r,
                  customers: customer || null,
                  customer_name: customer?.name || '정보 없음',
                  customer_email: customer?.email || '',
                  customer_language: customer?.language || 'Unknown',
                } as ExtendedReservationRow
                byCanonId.set(canonicalReservationIdKey(String(r.id)), ext)
                extendedList.push(ext)
              }
              if (!cancelled) setAllReservations(extendedList)
            }
          }

          const assignedReservations: ExtendedReservationRow[] = []
          const seenAssignedKeys = new Set<string>()
          for (const aid of assignedIds) {
            const key = canonicalReservationIdKey(aid)
            if (seenAssignedKeys.has(key)) continue
            seenAssignedKeys.add(key)
            const row = byCanonId.get(key)
            if (row) assignedReservations.push(row)
          }

          const otherTourReservationKeys = new Set<string>()
          for (const trow of tours) {
            if (trow.id === tour.id) continue
            for (const rid of normalizeReservationIds((trow as TourRow).reservation_ids)) {
              if (rid) otherTourReservationKeys.add(canonicalReservationIdKey(rid))
            }
          }

          const otherToursAssignedReservations: ExtendedReservationRow[] = []
          for (const key of otherTourReservationKeys) {
            const r = byCanonId.get(key)
            if (!r) continue
            otherToursAssignedReservations.push({
              ...r,
              assigned_tour_id: reservationToTourMap.get(key) || null,
            } as ExtendedReservationRow)
          }

          const allSameDateProductReservationsList = extendedList

          const pendingReservations = allSameDateProductReservationsList.filter((r) => {
            const reservationId = canonicalReservationIdKey(String(r.id).trim())
            const isInAnyTour = allAssignedReservationIdsSet.has(reservationId)
            const status = r.status ? String(r.status).toLowerCase().trim() : ''
            const isConfirmedOrRecruiting = status === 'confirmed' || status === 'recruiting'
            return !isInAnyTour && isConfirmedOrRecruiting && !isReservationDeletedStatus(r.status)
          }) as ExtendedReservationRow[]

          const otherStatusReservations = allSameDateProductReservationsList.filter((r) => {
            const status = r.status ? String(r.status).toLowerCase().trim() : ''
            const isConfirmedOrRecruiting = status === 'confirmed' || status === 'recruiting'
            return !isConfirmedOrRecruiting && !isReservationDeletedStatus(r.status)
          }) as ExtendedReservationRow[]

          const isCancelled = (status: string | null | undefined): boolean => {
            if (!status) return false
            const normalizedStatus = String(status).toLowerCase().trim()
            return (
              normalizedStatus === 'cancelled' ||
              normalizedStatus === 'canceled' ||
              normalizedStatus.includes('cancel')
            )
          }

          const activeAssignedReservations = assignedReservations.filter(
            (r) => !isCancelled(r.status) && !isReservationDeletedStatus(r.status)
          )
          const activeOtherToursAssignedReservations = otherToursAssignedReservations.filter(
            (r) => !isCancelled(r.status) && !isReservationDeletedStatus(r.status)
          )

          const cancelledIdsForReasons = allSameDateProductReservationsList
            .filter((r) => isReservationCancelledStatus(r.status))
            .map((r) => String(r.id))
          const cancellationFollowUpMap = await fetchCancellationFollowUpMeta(cancelledIdsForReasons)

          if (cancelled) return
          if (
            mutationEpochAtStart !== undefined &&
            mutationEpochAtStart !== assignmentMutationEpochRef.current
          ) {
            return
          }
          if (reservationIdsOverrideRef.current) {
            return
          }

          setAssignedReservations(attachCancellationFollowUpMeta(activeAssignedReservations, cancellationFollowUpMap))
          setPendingReservations(attachCancellationFollowUpMeta(pendingReservations, cancellationFollowUpMap))
          setOtherToursAssignedReservations(
            attachCancellationFollowUpMeta(activeOtherToursAssignedReservations, cancellationFollowUpMap)
          )
          setOtherStatusReservations(
            attachCancellationFollowUpMeta(otherStatusReservations, cancellationFollowUpMap)
          )
        }

        const loadAssignedReservationsOnly = async (): Promise<ExtendedReservationRow[]> => {
          const assignedIds = normalizeReservationIds(tour.reservation_ids)
          const ids = [...new Set(assignedIds.map((id) => String(id).trim()).filter(Boolean))]
          if (!ids.length) return []

          const rows: ReservationRow[] = []
          for (const chunk of chunkStrings(ids)) {
            const { data, error } = await supabase.from('reservations').select('*').in('id', chunk)
            if (error) {
              console.error('배정 예약 데이터 가져오기 오류:', error)
              continue
            }
            if (data?.length) rows.push(...(data as ReservationRow[]))
          }
          if (!rows.length) return []

          const customerIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean) as string[])]
          let customerRows: CustomerRow[] = []
          if (customerIds.length > 0) {
            const { data: customersData, error: customersError } = await supabase
              .from('customers')
              .select('*')
              .in('id', customerIds)
            if (customersError) {
              console.error('배정 예약 고객 정보 조회 오류:', customersError)
            } else {
              customerRows = (customersData || []) as CustomerRow[]
            }
          }

          return rows.map((reservation) => {
            const customer = customerRows.find((c) => c.id === reservation.customer_id)
            return {
              ...reservation,
              customers: customer || null,
              customer_name: customer?.name || '정보 없음',
              customer_email: customer?.email || '',
              customer_language: customer?.language || 'Unknown',
            } as ExtendedReservationRow
          })
        }

        const loadAllCustomersInBackground = () => {
          void (async () => {
            try {
              let allCustomersData: CustomerRow[] = []
              let hasMore = true
              let page = 0
              const pageSize = 1000
              while (hasMore && !cancelled) {
                const { data, error } = await supabase
                  .from('customers')
                  .select('*')
                  .order('name')
                  .range(page * pageSize, (page + 1) * pageSize - 1)
                if (error) {
                  console.error('고객 데이터 가져오기 오류:', error)
                  break
                }
                if (data && data.length > 0) {
                  allCustomersData = [...allCustomersData, ...data]
                  page++
                } else {
                  hasMore = false
                }
              }
              if (!cancelled) setCustomers(allCustomersData)
            } catch (e) {
              console.error('전체 고객 백그라운드 로드 오류:', e)
            }
          })()
        }

        if (modalLightLoad) {
          // 모달 첫 페인트: 배정 예약 + 가이드/차량만 먼저 보여 체감 속도를 올림
          const [reservationsExtended, assignedVehicleRes, guideAssistantPair] = await Promise.all([
            loadAssignedReservationsOnly(),
            assignedVehiclePromise,
            guideAssistantPromise,
          ])

          if (cancelled) return

          setAllReservations(reservationsExtended)
          applyGuideVehicle(assignedVehicleRes, guideAssistantPair)

          const isCancelledQuick = (status: string | null | undefined): boolean => {
            if (!status) return false
            const normalizedStatus = String(status).toLowerCase().trim()
            return (
              normalizedStatus === 'cancelled' ||
              normalizedStatus === 'canceled' ||
              normalizedStatus.includes('cancel')
            )
          }
          setAssignedReservations(
            reservationsExtended.filter(
              (r) => !isCancelledQuick(r.status) && !isReservationDeletedStatus(r.status)
            )
          )
          setPageLoading(false)

          deferredAssignmentCancelRef.current?.()
          deferredAssignmentCancelRef.current = scheduleDeferredWork(() => {
            const mutationEpochAtDeferStart = assignmentMutationEpochRef.current
            void (async () => {
              if (cancelled) return
              setLoadingStates((s) => ({ ...s, reservations: true }))
              try {
                const [
                  ,
                  pickupHotelsResult,
                  fullReservations,
                  refBundle,
                  vehiclesPack,
                ] = await Promise.all([
                  loadSameDayTours(),
                  supabase
                    .from('pickup_hotels')
                    .select('*')
                    .eq('use_for_pickup', true)
                    .or('is_active.is.null,is_active.eq.true')
                    .order('hotel'),
                  loadReservationsForProductDate(),
                  loadCatalogRefBundle(),
                  loadVehicles(),
                ])
                if (cancelled) return

                const { data: pickupHotelsData, error: pickupHotelsError } = pickupHotelsResult
                if (pickupHotelsError) {
                  console.error('픽업 호텔 데이터 가져오기 오류:', pickupHotelsError)
                } else {
                  setPickupHotels(pickupHotelsData || [])
                }

                setAllReservations(fullReservations)
                applyRefBundle(refBundle)
                setVehicles(vehiclesPack.rows)
                setVehiclesError(vehiclesPack.err)

                const freshSameDayTours = await loadSameDayTours()
                if (cancelled) return
                await processAssignmentBuckets(
                  fullReservations,
                  freshSameDayTours,
                  mutationEpochAtDeferStart
                )
              } catch (e) {
                console.error('투어 모달 백그라운드 데이터 로드 오류:', e)
              } finally {
                if (!cancelled) {
                  setLoadingStates((s) => ({ ...s, reservations: false }))
                }
              }
            })()
          })

          scheduleDeferredWork(loadAllCustomersInBackground, 4000)
          return
        }

        const [
          reservationsExtended,
          sameDayTours,
          refBundle,
          vehiclesPack,
          assignedVehicleRes,
          [guideRes, assistantRes],
        ] = await Promise.all([
          loadReservationsForProductDate(),
          loadSameDayTours(),
          loadCatalogRefBundle(),
          loadVehicles(),
          assignedVehiclePromise,
          guideAssistantPromise,
        ])

        if (cancelled) return

        setAllReservations(reservationsExtended)

        applyRefBundle(refBundle)
        setVehicles(vehiclesPack.rows)
        setVehiclesError(vehiclesPack.err)
        applyGuideVehicle(assignedVehicleRes, [guideRes, assistantRes])
        await processAssignmentBuckets(reservationsExtended, sameDayTours)

        loadAllCustomersInBackground()

      } catch (error) {
        if (!isAbortLikeError(error)) {
          console.error('투어 데이터 가져오기 중 오류:', error)
        }
      } finally {
        setPageLoading(false)
      }
    }

    fetchTourData()
    return () => {
      cancelled = true
      deferredAssignmentCancelRef.current?.()
      deferredAssignmentCancelRef.current = null
    }
  }, [effectiveTourId, modalLightLoad])

  // 권한 체크는 AdminAuthGuard에서 처리하므로 여기서는 리다이렉트하지 않음
  // AdminAuthGuard가 이미 권한 없는 사용자를 홈으로 리다이렉트함

  // 계산된 값들
  const getTotalAssignedPeople = useMemo(() => {
    if (!tour || !allReservations || allReservations.length === 0) return 0
    return calculateAssignedPeople(tour as any, allReservations as any)
  }, [tour, allReservations])

  /** 같은 상품·날짜 예약 중 취소가 아닌 인원 (대기·확정·모집중 등 전부) */
  const getTotalPeopleNonCancelled = useMemo(() => {
    if (!tour || !allReservations || allReservations.length === 0) return 0
    return sumPeopleSameProductDate(tour, allReservations as any[], 'nonCancelled')
  }, [tour, allReservations])

  /** 같은 상품·날짜 취소 예약 인원 */
  const getTotalCancelledPeople = useMemo(() => {
    if (!tour || !allReservations || allReservations.length === 0) return 0
    return sumPeopleSameProductDate(tour, allReservations as any[], 'cancelled')
  }, [tour, allReservations])

  // 유틸리티 함수들
  const getCustomerName = (customerId: string) => {
    if (!customerId) return '정보 없음'

    const reservation = allReservations.find((r) => r.customer_id === customerId) as
      | ExtendedReservationRow
      | undefined
    if (reservation && reservation.customer_name && reservation.customer_name !== '정보 없음') {
      return reservation.customer_name
    }

    const customer = customers.find((c) => c.id === customerId)
    if (customer?.name) return customer.name

    return '정보 없음'
  }

  const getCustomerLanguage = (customerId: string) => {
    // 먼저 예약 데이터에서 직접 고객 언어 찾기
    const reservation = allReservations.find((r) => r.customer_id === customerId)
    if (reservation && reservation.customer_language) {
      return reservation.customer_language
    }
    
    // 예약 데이터에 없으면 customers 배열에서 찾기
    const customer = customers.find((c) => c.id === customerId)
    return customer ? customer.language : 'Unknown'
  }

  const getPickupHotelName = (pickupHotelId: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('getPickupHotelName called:', { pickupHotelId, pickupHotelsCount: pickupHotels.length })
    }
    
    const hotel = pickupHotels.find((h) => h.id === pickupHotelId)
    if (hotel) {
      const result = `${getPickupHotelPrimaryName(hotel)} - ${hotel.pick_up_location}`
      if (process.env.NODE_ENV === 'development') {
        console.log('Hotel found:', { hotel, result })
      }
      return result
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Hotel not found, returning ID:', pickupHotelId)
    }
    return pickupHotelId || '픽업 호텔 미지정'
  }

  const getPickupHotelNameOnly = (pickupHotelId: string) => {
    const hotel = pickupHotels.find((h) => h.id === pickupHotelId)
    return hotel ? getPickupHotelPrimaryName(hotel) : pickupHotelId || '픽업 호텔 미지정'
  }

  const getChannelInfo = (channelId: string) => {
    const channel = channels.find((c) => c.id === channelId)
    return channel || null
  }

  const getCountryCode = (language: string | null) => {
    if (!language) return 'US'
    const languageMap: Record<string, string> = {
      'ko': 'KR',
      'en': 'US',
      'ja': 'JP',
      'zh': 'CN',
      'es': 'ES',
      'fr': 'FR',
      'de': 'DE',
      'it': 'IT',
      'pt': 'PT',
      'ru': 'RU',
      'ar': 'SA',
      'th': 'TH',
      'vi': 'VN',
      'id': 'ID',
      'ms': 'MY',
      'tl': 'PH'
    }
    return languageMap[language] || 'US'
  }

  /** 투어 가이드·2차/어시스턴트 슬롯: display_name 우선 (비어 있으면 name_ko → name_en → 이메일). 콤마 구분 다중 이메일 지원. */
  const resolveTeamMemberDisplayLabel = (assignmentRaw: string) => {
    const emails = parseTourAssignmentEmails(assignmentRaw)
    if (emails.length === 0) return ''
    const labels = emails.map((email) => {
      const member = teamMembers.find(
        (m) => m.email && m.email.toLowerCase() === email.toLowerCase()
      )
      if (!member) return email
      const dn = member.display_name?.trim()
      if (dn) return dn
      return member.name_ko || member.name_en || email
    })
    return labels.join(' & ')
  }

  const getTeamMemberName = (email: string) => {
    if (!email?.trim()) return '직원 미선택'
    const label = resolveTeamMemberDisplayLabel(email)
    return label || email.trim() || '직원 미선택'
  }

  /** 봉투 인쇄 등: 항상 team.display_name 우선 (고객 언어별 ko/en 문자열은 동일 표시명 사용) */
  const getTeamMemberNameForLocale = (email: string, _lang: 'ko' | 'en') => {
    if (!email?.trim()) return ''
    return resolveTeamMemberDisplayLabel(email)
  }

  return {
    // 상태들
    tour,
    setTour,
    isPrivateTour,
    setIsPrivateTour,
    showPrivateTourModal,
    setShowPrivateTourModal,
    pendingPrivateTourValue,
    setPendingPrivateTourValue,
    showPickupHotelModal,
    setShowPickupHotelModal,
    selectedReservationForHotelChange,
    setSelectedReservationForHotelChange,
    hotelSearchTerm,
    setHotelSearchTerm,
    connectionStatus,
    setConnectionStatus,
    productOptions,
    setProductOptions,
    showTourStatusDropdown,
    setShowTourStatusDropdown,
    showAssignmentStatusDropdown,
    setShowAssignmentStatusDropdown,
    expandedSections,
    product,
    setProduct,
    customers,
    setCustomers,
    reservations,
    setReservations,
    allReservations,
    setAllReservations,
    allTours,
    setAllTours,
    allProducts,
    setAllProducts,
    channels,
    setChannels,
    assignedReservations,
    setAssignedReservations,
    setAssignedReservationsForced,
    pendingReservations,
    setPendingReservations,
    setPendingReservationsForced,
    sameDayTourIds,
    otherToursAssignedReservations,
    setOtherToursAssignedReservations,
    beginAssignmentIdsMutation,
    clearAssignmentIdsMutationOverride,
    getEffectiveTourReservationIds,
    otherStatusReservations,
    setOtherStatusReservations,
    inactiveReservations,
    setInactiveReservations,
    pickupHotels,
    setPickupHotels,
    pickupTimeValue,
    setPickupTimeValue,
    showTimeModal,
    setShowTimeModal,
    selectedReservation,
    setSelectedReservation,
    teamMembers,
    setTeamMembers,
    teamType,
    setTeamType,
    selectedGuide,
    setSelectedGuide,
    selectedAssistant,
    setSelectedAssistant,
    tourNote,
    setTourNote,
    pageLoading,
    setPageLoading,
    loadingStates,
    setLoadingStates,
    editingReservation,
    setEditingReservation,
    showVehicleAssignment,
    setShowVehicleAssignment,
    assignedVehicle,
    setAssignedVehicle,
    vehicles,
    setVehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    vehiclesLoading,
    setVehiclesLoading,
    vehiclesError,
    setVehiclesError,

    // 권한 및 사용자 정보
    isStaff,
    userRole,
    user,
    loading,

    // 함수들
    toggleSection,
    getTotalAssignedPeople,
    getTotalPeopleNonCancelled,
    getTotalCancelledPeople,
    getCustomerName,
    getCustomerLanguage,
    getPickupHotelName,
    getPickupHotelNameOnly,
    getChannelInfo,
    getCountryCode,
    getTeamMemberName,
    getTeamMemberNameForLocale,
    refreshReservations: async () => {
      if (!tour || !tour.product_id || !tour.tour_date) return
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select('*')
        .eq('product_id', tour.product_id)
        .eq('tour_date', tour.tour_date)

      if (reservationsError) {
        console.error('예약 데이터 새로고침 오류:', reservationsError)
        return
      }
      
      const reservations = (reservationsData || []) as ReservationRow[]
      if (reservations && reservations.length > 0) {
        const customerIds = [...new Set(reservations.map(r => r.customer_id).filter(Boolean) as string[])]
        let reservationsList: ExtendedReservationRow[] = reservations.map(r => ({
          ...r,
          customers: null,
          customer_name: '정보 없음',
          customer_email: '',
          customer_language: 'Unknown'
        } as ExtendedReservationRow))

        if (customerIds.length > 0) {
          const { data: customersData, error: customersError } = await supabase
            .from('customers')
            .select('*')
            .in('id', customerIds)

          if (!customersError && customersData) {
            const customers = (customersData || []) as CustomerRow[]
            reservationsList = reservations.map(reservation => {
              const customer = customers.find(c => c.id === reservation.customer_id)
              return {
                ...reservation,
                customers: customer || null,
                customer_name: customer?.name || '정보 없음',
                customer_email: customer?.email || '',
                customer_language: customer?.language || 'Unknown'
              } as ExtendedReservationRow
            })
          }
          if (customersError) {
            console.error('고객 정보 조회 오류:', customersError)
          }
        }

        setAllReservations(reservationsList)

        // 예약 분류도 다시 계산 (픽업 스케줄 등에 반영되도록 항상 수행)
        if (!tour.product_id || !tour.tour_date) {
          console.error('투어 product_id 또는 tour_date가 없습니다.')
        } else {
          const { data: allSameDateProductTours, error: allToursError } = await supabase
            .from('tours')
            .select('id, reservation_ids')
            .eq('product_id', tour.product_id)
            .eq('tour_date', tour.tour_date)

          if (allToursError) {
            console.error('❌ Error loading all tours with same date/product:', allToursError)
          }

          const allAssignedReservationIdsSet = new Set<string>()
          const reservationToTourMap = new Map<string, string>()

          const toursList = (allSameDateProductTours || []) as Array<{ id: string; reservation_ids?: unknown }>
          setSameDayTourIds(toursList.map((t) => t.id))
          if (toursList.length > 0) {
            toursList.forEach(t => {
              const tourRow = t as TourRow
              for (const reservationId of normalizeReservationIds(tourRow.reservation_ids)) {
                if (reservationId) {
                  const key = canonicalReservationIdKey(reservationId)
                  allAssignedReservationIdsSet.add(key)
                  reservationToTourMap.set(key, tourRow.id)
                }
              }
            })
          }

          const currentTourRow = toursList.find((row) => row.id === tour.id) as TourRow | undefined
          const assignedReservationIds: string[] = reservationIdsOverrideRef.current
            ? dedupeReservationIdsPreservingOrder(tourReservationIdsRef.current)
            : dedupeReservationIdsPreservingOrder(currentTourRow?.reservation_ids ?? tour.reservation_ids)
          if (!reservationIdsOverrideRef.current) {
            tourReservationIdsRef.current = assignedReservationIds
          }

          let assignedReservations: ExtendedReservationRow[] = []
          if (assignedReservationIds.length > 0) {
            assignedReservations = dedupeReservationsPreservingOrder(
              reservationsList.filter((r) =>
                assignedReservationIds.some((aid) => reservationIdsLooselyEqual(aid, String(r.id)))
              )
            )
          }

          const otherToursAssignedReservations = await (async () => {
            try {
              if (!tour.product_id || !tour.tour_date) return []
              const { data: otherTours, error: toursError } = await supabase
                .from('tours')
                .select('id, reservation_ids')
                .eq('product_id', tour.product_id)
                .eq('tour_date', tour.tour_date)
                .neq('id', tour.id)

              if (toursError || !otherTours || otherTours.length === 0) return []

              const otherReservationIdsSet = new Set<string>()
              otherTours.forEach(t => {
                const tourRow = t as TourRow
                for (const reservationId of normalizeReservationIds(tourRow.reservation_ids)) {
                  if (reservationId) {
                    otherReservationIdsSet.add(reservationId)
                    reservationToTourMap.set(canonicalReservationIdKey(reservationId), tourRow.id)
                  }
                }
              })
              const otherReservationIds = Array.from(otherReservationIdsSet)
              if (otherReservationIds.length === 0) return []

              const filteredReservations = reservationsList.filter(
                (r) =>
                  otherReservationIds.some((oid) => reservationIdsLooselyEqual(oid, String(r.id))) &&
                  !assignedReservationIds.some((aid) => reservationIdsLooselyEqual(aid, String(r.id)))
              )
              return filteredReservations.map((reservation) => ({
                ...reservation,
                assigned_tour_id:
                  reservationToTourMap.get(canonicalReservationIdKey(String(reservation.id))) || null,
              }))
            } catch (error) {
              console.error('❌ Error processing other tours reservations:', error)
              return []
            }
          })()

          const pendingReservations = reservationsList.filter((r) => {
            const reservationId = canonicalReservationIdKey(String(r.id).trim())
            const isInAnyTour = allAssignedReservationIdsSet.has(reservationId)
            const status = r.status ? String(r.status).toLowerCase().trim() : ''
            const isConfirmedOrRecruiting = status === 'confirmed' || status === 'recruiting'
            return !isInAnyTour && isConfirmedOrRecruiting && !isReservationDeletedStatus(r.status)
          })

          const otherStatusReservations = reservationsList.filter(r => {
            const status = r.status ? String(r.status).toLowerCase().trim() : ''
            const isConfirmedOrRecruiting = status === 'confirmed' || status === 'recruiting'
            return !isConfirmedOrRecruiting && !isReservationDeletedStatus(r.status)
          })

          const isCancelled = (status: string | null | undefined): boolean => {
            if (!status) return false
            const normalizedStatus = String(status).toLowerCase().trim()
            return normalizedStatus === 'cancelled' || normalizedStatus === 'canceled' || normalizedStatus.includes('cancel')
          }

          const activeAssignedReservations = assignedReservations.filter(
            r => !isCancelled(r.status) && !isReservationDeletedStatus(r.status)
          )
          const activeOtherToursAssignedReservations = otherToursAssignedReservations.filter(
            r => !isCancelled(r.status) && !isReservationDeletedStatus(r.status)
          )

          const cancelledIdsForReasons = reservationsList
            .filter((r) => isReservationCancelledStatus(r.status))
            .map((r) => String(r.id))
          const cancellationFollowUpMap = await fetchCancellationFollowUpMeta(cancelledIdsForReasons)

          if (!reservationIdsOverrideRef.current) {
            setAssignedReservations(attachCancellationFollowUpMeta(activeAssignedReservations, cancellationFollowUpMap))
            setPendingReservations(attachCancellationFollowUpMeta(pendingReservations, cancellationFollowUpMap))
            setOtherToursAssignedReservations(
              attachCancellationFollowUpMeta(activeOtherToursAssignedReservations, cancellationFollowUpMap)
            )
            setOtherStatusReservations(
              attachCancellationFollowUpMeta(otherStatusReservations, cancellationFollowUpMap)
            )
          }
        }
      } else {
        setAllReservations(reservationsData || [])
        setAssignedReservations([])
        setPendingReservations([])
        setSameDayTourIds([])
      }
    },

    // 파라미터
    params,
    locale
  }
}
