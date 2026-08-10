/* @ts-nocheck */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { refreshCustomerInList } from '@/lib/refreshCustomerInList'
import { toReservationUpdatePayload, updateReservation } from '@/lib/reservationUpdate'
import { generateTourId } from '@/lib/entityIds'
import { reservationIdsLooselyEqual } from '@/utils/tourUtils'
import { allowTeamPairAssignment } from '@/lib/teamDoNotTeamWith'
import type { Database } from '@/lib/supabase'
import ReservationForm from '@/components/reservation/ReservationForm'
import VehicleAssignmentModal from '@/components/VehicleAssignmentModal'
import TicketBookingForm from '@/components/booking/TicketBookingForm'
import TicketBookingBulkAddModal from '@/components/booking/TicketBookingBulkAddModal'
import TourHotelBookingForm from '@/components/booking/TourHotelBookingForm'
import BookingHistory from '@/components/booking/BookingHistory'
import TourWeather from '@/components/TourWeather'
import { useAuth } from '@/contexts/AuthContext'
import { isSuperAdminActor } from '@/lib/superAdmin'
import {
  filterTicketBookingsExcludedFromMainUi,
  canRequestTicketBookingSoftDelete,
} from '@/lib/ticketBookingSoftDelete'
import { useFloatingChat } from '@/contexts/FloatingChatContext'
import { SkeletonCard, SkeletonText } from '@/components/tour/TourUIComponents'
import { TeamAndVehicleAssignment } from '@/components/tour/TeamAndVehicleAssignment'
import { TourInfo } from '@/components/tour/TourInfo'
import { BookingManagement } from '@/components/tour/BookingManagement'
import { PickupSchedule } from '@/components/tour/PickupSchedule'
import { TourSchedule } from '@/components/tour/TourSchedule'
import { OptionManagement } from '@/components/tour/OptionManagement'
import { AssignmentManagement } from '@/components/tour/AssignmentManagement'
import { TourReport } from '@/components/tour/TourReport'
import { TourFinance } from '@/components/tour/TourFinance'
import { TourPhotos } from '@/components/tour/TourPhotos'
import { TourChat } from '@/components/tour/TourChat'
import TourHeader from '@/components/tour/TourHeader'
import {
  TourDetailSectionChromeProvider,
  useTourDetailModalChrome,
} from '@/components/tour/TourDetailModalChromeContext'
import PickupTimeModal from '@/components/tour/modals/PickupTimeModal'
import PickupHotelModal from '@/components/tour/modals/PickupHotelModal'
import PrivateTourModal from '@/components/tour/modals/PrivateTourModal'
import BookingModal from '@/components/tour/modals/BookingModal'
import PickupScheduleAutoGenerateModal from '@/components/tour/modals/PickupScheduleAutoGenerateModal'
import TourEditModal from '@/components/tour/modals/TourEditModal'
import CustomerReceiptModal from '@/components/receipt/CustomerReceiptModal'
import TourPrintModal from '@/components/tour/modals/TourPrintModal'
import { ReservationFormEmailSendButtons } from '@/components/reservation/ReservationFormEmailSendButtons'
import { ReservationFormSmsSendButton } from '@/components/reservation/ReservationFormSmsSendButton'
import type { CustomerCommunicationChannel } from '@/lib/customerCommunicationChannel'
import CancellationReasonModal from '@/components/reservation/CancellationReasonModal'
import TourEnvelopeModal from '@/components/receipt/TourEnvelopeModal'
import { GuideScheduleConfirmPreviewModal } from '@/components/admin/todo/GuideScheduleConfirmPreviewModal'
import { GuideScheduleAssignmentPreviewModal } from '@/components/admin/todo/GuideScheduleAssignmentPreviewModal'

const GuideScheduleAssignmentHistoryModal = dynamic(
  () => import('@/components/schedule/GuideScheduleAssignmentHistoryModal'),
  { ssr: false },
)
import { useTourDetailData } from '@/hooks/useTourDetailData'
import { useTourHandlers } from '@/hooks/useTourHandlers'
import {
  normalizeReservationIds,
  isTourDeletedStatus,
  resolveTeamTypeForTourCreate,
} from '@/utils/tourUtils'
import { upsertReservationCancellationReason } from '@/lib/reservationCancellationReason'
import { applyNoShowReservationSideEffects } from '@/lib/reservationNoShowEffects'
import { RESERVATION_EDIT_MODAL_RECT_KEY } from '@/lib/adminModalRectStorage'
import { productShowsResidentStatusSectionByCode } from '@/utils/residentStatusSectionProducts'
import {
  fetchActivePickupGroupPresets,
  fetchPickupGroupPresetWithReps,
  buildPickupResolveContextFromTour,
  normalizeGroupModeOverrides,
  normalizeGroupRepresentativeOverrides,
  type PickupGroupPresetRow,
  type PickupGroupPresetWithReps,
  type PickupGroupMode,
} from '@/lib/pickupGroupPreset'
import type { Customer } from '@/types/reservation'
import { 
  getStatusColor,
  getStatusText,
  getAssignmentStatusColor,
  getAssignmentStatusText,
  tourStatusOptions,
  assignmentStatusOptions,
  openGoogleMaps,
  safeJsonParse,
  isTourCancelled,
  tourStaffVehicleAssignmentClearPatch,
} from '@/utils/tourStatusUtils'
import { 
  Info, 
  Cloud, 
  MapPin, 
  Calendar, 
  Settings, 
  Users, 
  ClipboardList, 
  BookOpen, 
  MessageSquare, 
  Camera, 
  DollarSign, 
  FileText,
  Menu,
  X,
  Printer,
} from 'lucide-react'

const PickupScheduleEmailPreviewModal = dynamic(
  () => import('@/components/tour/modals/PickupScheduleEmailPreviewModal'),
  { ssr: false, loading: () => null }
)

// setTour 콜백용 투어 타입
type TourRow = Database['public']['Tables']['tours']['Row']

// 로컬 폼 전달용 간략 타입
type LocalTicketBooking = {
  id: string
  reservation_id?: string | null
  status?: string | null
  company?: string | null
  category?: string | null
  time?: string | null
  ea?: number | null
  rn_number?: string | null
  invoice_number?: string | null
  deletion_requested_at?: string | null
  deletion_requested_by?: string | null
  check_in_date?: string | null
  /** 간단히 보기 시 회사별 하위 행 (체크인, 시간, 인원, 예약번호, 상태) */
  bookingDetails?: {
    check_in_date: string | null
    time: string | null
    ea: number
    reservation_id: string | null
    rn_number: string | null
    invoice_number?: string | null
    status?: string | null
  }[]
}

type LocalTourHotelBooking = {
  id: string
  reservation_id?: string | null
  reservation_name?: string | null
  status?: string | null
  hotel?: string | null
  room_type?: string | null
  rooms?: number | null
  check_in_date?: string | null
  check_out_date?: string | null
  rn_number?: string | null
  booking_reference?: string | null
  total_price?: number | null
  unit_price?: number | null
  payment_method?: string | null
  city?: string | null
  website?: string | null
  cc?: string | null
  tour_id?: string | null
  event_date?: string | null
  replaces_booking_id?: string | null
}

// 외부 폼 컴포넌트의 엄격한 타입 충돌을 피하기 위한 any 캐스팅 래퍼
const ReservationFormAny = ReservationForm as any
const TicketBookingFormAny = TicketBookingForm as any
const TourHotelBookingFormAny = TourHotelBookingForm as any

export function TourDetailPageView({
  tourId,
  modalLightLoad = false,
  onNavigateToTour: onNavigateToTourProp,
}: {
  tourId: string
  modalLightLoad?: boolean
  /** 모달 내 투어 이동 시 콜백. 없으면 전체 페이지로 라우팅 */
  onNavigateToTour?: (tourId: string) => void
}) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('tours')
  
  const { hasPermission, loading, userPosition, authUser } = useAuth()
  const isSuper = isSuperAdminActor(authUser?.email, userPosition)
  const canRequestTicketBookingSoftDeleteUi = canRequestTicketBookingSoftDelete(userPosition)
  const { openChat } = useFloatingChat()

  // 커스텀 훅으로 데이터와 상태 관리 (모달에서는 route의 id 대신 tourId 사용)
  const tourData = useTourDetailData({ tourId, modalLightLoad })
  const tourHandlers = useTourHandlers()
  const modalChrome = useTourDetailModalChrome()
  const scrollMt = modalLightLoad ? 'scroll-mt-2' : 'scroll-mt-20'

  useEffect(() => {
    if (!modalLightLoad || !modalChrome || !tourData.tour || tourData.pageLoading) return
    const productName =
      locale === 'ko' ? tourData.product?.name_ko : tourData.product?.name_en
    modalChrome.setMeta({
      title: productName || 'Tour Detail',
      ...(tourData.tour.tour_date ? { date: tourData.tour.tour_date } : {}),
      tourId: tourData.tour.id,
      statusLabel: getStatusText(tourData.tour.tour_status, locale),
    })
  }, [
    modalLightLoad,
    modalChrome,
    tourData.tour?.id,
    tourData.tour?.tour_date,
    tourData.tour?.tour_status,
    tourData.pageLoading,
    tourData.product?.name_ko,
    tourData.product?.name_en,
    locale,
  ])
  
  // 부킹 관련 상태 (로컬 상태로 유지)
  const [ticketBookings, setTicketBookings] = useState<LocalTicketBooking[]>([])
  const [tourHotelBookings, setTourHotelBookings] = useState<LocalTourHotelBooking[]>([])
  const [showTicketBookingForm, setShowTicketBookingForm] = useState<boolean>(false)
  const [showTicketBookingBulkAdd, setShowTicketBookingBulkAdd] = useState<boolean>(false)
  const [showTourHotelBookingForm, setShowTourHotelBookingForm] = useState<boolean>(false)
  const [hotelBookingSeed, setHotelBookingSeed] = useState<LocalTourHotelBooking | null>(null)
  const [replacesBookingId, setReplacesBookingId] = useState<string | null>(null)
  const [hotelBookingHistoryId, setHotelBookingHistoryId] = useState<string | null>(null)
  const [editingTicketBooking, setEditingTicketBooking] = useState<LocalTicketBooking | null>(null)
  const [editingTourHotelBooking, setEditingTourHotelBooking] = useState<LocalTourHotelBooking | null>(null)
  const [editingReservation, setEditingReservation] = useState<any>(null)
  const [showPickupScheduleModal, setShowPickupScheduleModal] = useState<boolean>(false)
  const [showEmailPreviewModal, setShowEmailPreviewModal] = useState<boolean>(false)
  const [showTourEditModal, setShowTourEditModal] = useState<boolean>(false)
  const [showBatchReceiptModal, setShowBatchReceiptModal] = useState<boolean>(false)
  const [showEditReceiptModal, setShowEditReceiptModal] = useState<boolean>(false)
  const [showGuideScheduleConfirmModal, setShowGuideScheduleConfirmModal] = useState(false)
  const [showGuideScheduleAssignmentModal, setShowGuideScheduleAssignmentModal] = useState(false)
  const [showGuideAssignmentHistoryModal, setShowGuideAssignmentHistoryModal] = useState(false)
  const [envelopeModalVariant, setEnvelopeModalVariant] = useState<'tip' | 'balance' | null>(null)
  const [showTourPrintModal, setShowTourPrintModal] = useState<boolean>(false)
  const [pickupPresets, setPickupPresets] = useState<PickupGroupPresetRow[]>([])
  const [activePickupPreset, setActivePickupPreset] = useState<PickupGroupPresetWithReps | null>(null)
  const [activeSection, setActiveSection] = useState<string>('')
  const [showFloatingMenu, setShowFloatingMenu] = useState<boolean>(false)
  
  // 예약 편집 모달용 데이터
  const [reservationFormData, setReservationFormData] = useState<{
    productOptions: any[]
    options: any[]
    coupons: any[]
  }>({
    productOptions: [],
    options: [],
    coupons: []
  })
  
  // 스크롤 감지로 현재 섹션 추적
  useEffect(() => {
    void fetchActivePickupGroupPresets(supabase).then(setPickupPresets)
  }, [])

  useEffect(() => {
    const presetId = tourData.tour?.pickup_group_preset_id ?? null
    if (!presetId) {
      setActivePickupPreset(null)
      return
    }
    void fetchPickupGroupPresetWithReps(supabase, presetId).then(setActivePickupPreset)
  }, [tourData.tour?.pickup_group_preset_id])

  const pickupGroupModeOverrides = useMemo(
    () => normalizeGroupModeOverrides(tourData.tour?.pickup_group_mode_overrides),
    [tourData.tour?.pickup_group_mode_overrides]
  )

  const pickupGroupRepresentativeOverrides = useMemo(
    () =>
      normalizeGroupRepresentativeOverrides(
        tourData.tour?.pickup_group_representative_overrides
      ),
    [tourData.tour?.pickup_group_representative_overrides]
  )

  const pickupResolveContext = useMemo(
    () =>
      buildPickupResolveContextFromTour(
        {
          use_representative_pickup: tourData.tour?.use_representative_pickup ?? null,
          pickup_group_preset_id: tourData.tour?.pickup_group_preset_id ?? null,
          pickup_group_mode_overrides: pickupGroupModeOverrides,
          pickup_group_representative_overrides: pickupGroupRepresentativeOverrides,
        },
        activePickupPreset
      ),
    [
      tourData.tour?.use_representative_pickup,
      tourData.tour?.pickup_group_preset_id,
      pickupGroupModeOverrides,
      pickupGroupRepresentativeOverrides,
      activePickupPreset,
    ]
  )

  useEffect(() => {
    const sections = [
      'tour-info',
      'tour-weather',
      'pickup-schedule',
      'tour-schedule',
      'option-management',
      'team-vehicle',
      'assignment-management',
      'booking-management',
      'tour-chat',
      'tour-photos',
      'tour-finance',
      'tour-report'
    ]

    const scrollRoot = modalLightLoad
      ? document.querySelector<HTMLElement>('[data-tour-detail-modal-scroll]')
      : null

    const handleScroll = () => {
      const scrollTop = scrollRoot?.scrollTop ?? window.scrollY
      const scrollPosition = scrollTop + 100
      const rootTop = scrollRoot?.getBoundingClientRect().top ?? 0

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i])
        if (section) {
          const offsetTop = scrollRoot
            ? section.getBoundingClientRect().top - rootTop + scrollTop
            : section.offsetTop
          if (scrollPosition >= offsetTop) {
            setActiveSection(sections[i])
            break
          }
        }
      }
    }

    const target: HTMLElement | Window = scrollRoot ?? window
    target.addEventListener('scroll', handleScroll as EventListener)
    handleScroll()

    return () => target.removeEventListener('scroll', handleScroll as EventListener)
  }, [modalLightLoad])
  
  // 외부 클릭 감지 로직 제거 - backdrop에서 직접 처리
  
  // 마일리지 관련 상태
  const [startMileage, setStartMileage] = useState<number>(0)
  const [endMileage, setEndMileage] = useState<number>(0)
  const [isMileageLoading, setIsMileageLoading] = useState<boolean>(false)

  // 팀 수수료 관련 상태
  const [guideFee, setGuideFee] = useState<number>(0)
  const [assistantFee, setAssistantFee] = useState<number>(0)
  const [isGuideFeeFromTour, setIsGuideFeeFromTour] = useState<boolean>(false)
  const [isAssistantFeeFromTour, setIsAssistantFeeFromTour] = useState<boolean>(false)
  const [isGuideFeeFromDefault, setIsGuideFeeFromDefault] = useState<boolean>(false)
  const [isAssistantFeeFromDefault, setIsAssistantFeeFromDefault] = useState<boolean>(false)
  /** DB에서 투어 수수료 행을 읽은 뒤에만 기본 가이드비를 채움 (비동기 레이스 방지) */
  const [feesHydrated, setFeesHydrated] = useState(false)
  const activeTourIdRef = useRef<string | undefined>(undefined)
  activeTourIdRef.current = tourData.tour?.id

  const openGuideScheduleConfirmModal = useCallback(() => {
    setShowGuideScheduleConfirmModal(true)
  }, [])

  const openGuideScheduleAssignmentModal = useCallback(() => {
    setShowGuideScheduleAssignmentModal(true)
  }, [])

  const openGuideAssignmentHistoryModal = useCallback(() => {
    setShowGuideAssignmentHistoryModal(true)
  }, [])

  const canSendGuideScheduleConfirm = Boolean(
    tourData.tour?.tour_guide_id || tourData.tour?.assistant_id,
  )

  // 핸들러 함수들
  const handlePrivateTourToggle = () => {
    tourData.setPendingPrivateTourValue(!tourData.isPrivateTour)
    tourData.setShowPrivateTourModal(true)
  }

  const handlePrivateTourConfirm = async () => {
    if (!tourData.tour) return
    const success = await tourHandlers.updatePrivateTourStatus(tourData.tour, tourData.pendingPrivateTourValue)
    if (success) {
      tourData.setIsPrivateTour(tourData.pendingPrivateTourValue)
      tourData.setTour((prev: TourRow | null) => prev ? { ...prev, is_private_tour: tourData.pendingPrivateTourValue } : null)
      tourData.setShowPrivateTourModal(false)
    }
  }

  const handleTourStatusUpdate = async (status: string) => {
    console.log('=== handleTourStatusUpdate 호출 ===', status)
    
    if (!tourData.tour) {
      console.error('투어 데이터가 없습니다.')
      return
    }
    
    // 현재 상태와 새 상태 비교 (대소문자 무시, 공백 제거)
    const currentStatus = (tourData.tour.tour_status || '').toLowerCase().trim()
    const newStatus = (status || '').toLowerCase().trim()
    
    console.log('상태 비교:', { 
      currentStatus: currentStatus, 
      newStatus: newStatus, 
      currentStatusRaw: tourData.tour.tour_status,
      newStatusRaw: status
    })
    
    if (currentStatus === newStatus) {
      console.log('이미 같은 상태입니다. 업데이트를 건너뜁니다.')
      return
    }
    
    console.log('=== 투어 상태 업데이트 시작 ===')
    console.log('현재 상태:', tourData.tour.tour_status)
    console.log('새 상태:', status)
    console.log('투어 ID:', tourData.tour.id)
    
    // 이전 투어 데이터 저장
    const previousTour = { ...tourData.tour }
    
    // 먼저 로컬 상태를 즉시 업데이트 (낙관적 업데이트)
    tourData.setTour((prev: TourRow | null) => {
      if (!prev) return null
      console.log('로컬 상태 업데이트:', { 이전: prev.tour_status, 새: status })
      const cleared = isTourCancelled(status) ? tourStaffVehicleAssignmentClearPatch() : {}
      return { ...prev, tour_status: status, ...cleared }
    })
    
    // 데이터베이스 업데이트
    try {
      const success = await tourHandlers.updateTourStatus(previousTour, status, tourData.isStaff)
      console.log('데이터베이스 업데이트 결과:', success)
      
      if (success) {
        // 데이터베이스에서 최신 투어 데이터 다시 불러오기
        const { data: updatedTour, error } = await supabase
          .from('tours')
          .select(`
            *,
            products (*)
          `)
          .eq('id', previousTour.id)
          .single()
        
        if (error) {
          console.error('투어 데이터 다시 불러오기 실패:', error)
          // 에러가 발생해도 로컬 상태는 이미 업데이트됨
        } else if (updatedTour) {
          console.log('✅ 투어 데이터 다시 불러오기 성공:', updatedTour.tour_status)
          // 실제 DB 값으로 업데이트
          tourData.setTour(updatedTour)
          tourData.setIsPrivateTour((updatedTour as any)?.is_private_tour || false)
        }
      } else {
        console.error('데이터베이스 업데이트 실패 - 이전 상태로 복원')
        // 실패 시 이전 상태로 복원
        tourData.setTour(previousTour)
        alert('상태 업데이트에 실패했습니다.')
      }
    } catch (error) {
      console.error('투어 상태 업데이트 중 오류:', error)
      // 오류 발생 시 이전 상태로 복원
      tourData.setTour(previousTour)
      alert('상태 업데이트 중 오류가 발생했습니다.')
    }
  }

  const handleAssignmentStatusUpdate = async (status: string) => {
    console.log('=== handleAssignmentStatusUpdate 호출 ===', status)
    
    if (!tourData.tour) {
      console.error('투어 데이터가 없습니다.')
      return
    }
    
    // 이미 같은 상태면 업데이트하지 않음
    if (tourData.tour.assignment_status === status) {
      console.log('이미 같은 배정 상태입니다:', status)
      return
    }
    
    console.log('=== 배정 상태 업데이트 시작 ===')
    console.log('현재 상태:', tourData.tour.assignment_status)
    console.log('새 상태:', status)
    console.log('투어 ID:', tourData.tour.id)
    
    // 이전 투어 데이터 저장
    const previousTour = tourData.tour
    
    // 먼저 로컬 상태를 즉시 업데이트 (낙관적 업데이트)
    tourData.setTour((prev: TourRow | null) => {
      if (!prev) return null
      return { ...prev, assignment_status: status }
    })
    
    // 데이터베이스 업데이트
    try {
      const success = await tourHandlers.updateAssignmentStatus(previousTour, status, tourData.isStaff)
      console.log('데이터베이스 업데이트 결과:', success)
      
      if (success) {
        // 데이터베이스에서 최신 투어 데이터 다시 불러오기
        const { data: updatedTour, error } = await supabase
          .from('tours')
          .select(`
            *,
            products (*)
          `)
          .eq('id', previousTour.id)
          .single()
        
        if (error) {
          console.error('투어 데이터 다시 불러오기 실패:', error)
          // 에러가 발생해도 로컬 상태는 이미 업데이트됨
        } else if (updatedTour) {
          console.log('✅ 배정 상태 업데이트 완료:', updatedTour.assignment_status)
          // 실제 DB 값으로 업데이트
          tourData.setTour(updatedTour)
          tourData.setIsPrivateTour((updatedTour as any)?.is_private_tour || false)
        }
      } else {
        console.error('데이터베이스 업데이트 실패 - 이전 상태로 복원')
        // 실패 시 이전 상태로 복원
        tourData.setTour(previousTour)
        alert('배정 상태 업데이트에 실패했습니다.')
      }
    } catch (error) {
      console.error('배정 상태 업데이트 중 오류:', error)
      // 오류 발생 시 이전 상태로 복원
      tourData.setTour(previousTour)
      alert('배정 상태 업데이트 중 오류가 발생했습니다.')
    }
  }

  const handleTeamTypeChange = async (type: '1guide' | '2guide' | 'guide+driver') => {
    console.log('handleTeamTypeChange 호출됨:', { type, tour: tourData.tour })
    
    if (!tourData.tour) return
    const success = await tourHandlers.handleTeamTypeChange(tourData.tour, type)
    
    console.log('팀 타입 변경 결과:', success)
    
    if (success) {
      tourData.setTeamType(type)
      if (type === '1guide') {
        tourData.setSelectedAssistant('')
      }
      // 투어 데이터도 업데이트
      tourData.setTour((prev: TourRow | null) => prev ? { ...prev, team_type: type } : null)
      
      // 팀 타입 변경 시에는 수수료 상태를 초기화하지 않음
      // 저장된 수수료가 있으면 그대로 유지
      console.log('로컬 상태 업데이트 완료, 기존 수수료 유지')
    } else {
      console.log('팀 타입 변경 실패')
    }
  }

  const handleGuideSelect = async (guideEmail: string) => {
    if (!tourData.tour) return
    
    console.log('가이드 선택:', guideEmail)
    const success = await tourHandlers.handleGuideSelect(tourData.tour, guideEmail, tourData.teamType)
    
    if (success) {
      tourData.setSelectedGuide(guideEmail)
      console.log('가이드 배정 성공')
      
      // 가이드 배정 후에는 수수료 상태를 초기화하지 않음
      // 저장된 수수료가 있으면 그대로 유지
      console.log('가이드 배정 완료, 기존 수수료 유지')
    }
  }

  const handleAssistantSelect = async (assistantEmail: string) => {
    if (!tourData.tour) return
    
    console.log('어시스턴트 선택:', assistantEmail)
    const success = await tourHandlers.handleAssistantSelect(tourData.tour, assistantEmail)
    
    if (success) {
      tourData.setSelectedAssistant(assistantEmail)
      console.log('어시스턴트 배정 성공')
      
      // 어시스턴트 배정 후에는 수수료 상태를 초기화하지 않음
      // 저장된 수수료가 있으면 그대로 유지
      console.log('어시스턴트 배정 완료, 기존 수수료 유지')
    }
  }

  const handleTourNoteChange = async (note: string) => {
    if (!tourData.tour) return
    tourData.setTourNote(note)
    await tourHandlers.handleTourNoteChange(tourData.tour, note)
  }

  // 투어 날짜 업데이트 핸들러
  const handleTourDateChange = async (date: string) => {
    if (!tourData.tour) return

    try {
      const { error } = await (supabase as any)
        .from('tours')
        .update({ tour_date: date })
        .eq('id', tourData.tour.id)

      if (error) {
        console.error('투어 날짜 업데이트 오류:', error)
        alert(locale === 'ko' ? '투어 날짜 업데이트 중 오류가 발생했습니다.' : 'Error updating tour date.')
        return
      }

      // 투어 데이터 업데이트
      tourData.setTour((prev: TourRow | null) => prev ? { ...prev, tour_date: date } : null)
    } catch (error) {
      console.error('투어 날짜 업데이트 오류:', error)
      alert(locale === 'ko' ? '투어 날짜 업데이트 중 오류가 발생했습니다.' : 'Error updating tour date.')
    }
  }

  // 투어 시작 시간 업데이트 핸들러
  const handleTourTimeChange = async (datetime: string) => {
    if (!tourData.tour) return

    try {
      const { error } = await (supabase as any)
        .from('tours')
        .update({ tour_start_datetime: datetime })
        .eq('id', tourData.tour.id)

      if (error) {
        console.error('투어 시작 시간 업데이트 오류:', error)
        alert(locale === 'ko' ? '투어 시작 시간 업데이트 중 오류가 발생했습니다.' : 'Error updating tour start time.')
        return
      }

      // 투어 데이터 업데이트
      tourData.setTour((prev: TourRow | null) => prev ? { ...prev, tour_start_datetime: datetime } : null)
    } catch (error) {
      console.error('투어 시작 시간 업데이트 오류:', error)
      alert(locale === 'ko' ? '투어 시작 시간 업데이트 중 오류가 발생했습니다.' : 'Error updating tour start time.')
    }
  }

  // 투어 product_id 업데이트 핸들러
  const handleTourProductUpdate = async (productId: string) => {
    if (!tourData.tour) return

    try {
      const { error } = await (supabase as any)
        .from('tours')
        .update({ product_id: productId })
        .eq('id', tourData.tour.id)

      if (error) {
        console.error('투어 product_id 업데이트 오류:', error)
        throw error
      }

      // 투어 데이터 새로고침
      window.location.reload()
    } catch (error) {
      console.error('투어 product_id 업데이트 오류:', error)
      throw error
    }
  }

  // 부킹 데이터 로드
  const loadBookings = useCallback(async () => {
    if (!tourData.tour?.id) return

    try {
      console.log('부킹 데이터 로드 시작:', tourData.tour.id)
      
      // 티켓 부킹 로드
      const { data: ticketBookingsData, error: ticketError } = await supabase
        .from('ticket_bookings')
        .select('*')
        .eq('tour_id', tourData.tour.id)
        .order('check_in_date', { ascending: false })

      if (ticketError) {
        console.error('티켓 부킹 로드 오류:', ticketError)
      } else {
        setTicketBookings(filterTicketBookingsExcludedFromMainUi(ticketBookingsData || []))
        console.log('티켓 부킹 로드됨:', ticketBookingsData?.length || 0, '건')
      }

      // 투어 호텔 부킹 로드
      const { data: tourHotelBookingsData, error: tourHotelError } = await supabase
        .from('tour_hotel_bookings')
        .select('*')
        .eq('tour_id', tourData.tour.id)
        .order('check_in_date', { ascending: false })

      if (tourHotelError) {
        console.error('투어 호텔 부킹 로드 오류:', tourHotelError)
      } else {
        setTourHotelBookings(tourHotelBookingsData || [])
        console.log('투어 호텔 부킹 로드됨:', tourHotelBookingsData?.length || 0, '건')
      }
    } catch (error) {
      console.error('부킹 데이터 로드 오류:', error)
    }
  }, [tourData.tour?.id])

  // 투어별 저장된 수수료 로드
  const loadTourFees = useCallback(async () => {
    const t = tourData.tour
    const tourId = t?.id
    if (!tourId) return

    if (isTourCancelled(t.tour_status)) {
      setGuideFee(0)
      setAssistantFee(0)
      setIsGuideFeeFromTour(false)
      setIsAssistantFeeFromTour(false)
      setIsGuideFeeFromDefault(false)
      setIsAssistantFeeFromDefault(false)
      if (activeTourIdRef.current === tourId) setFeesHydrated(true)
      return
    }

    try {
      const { data: tour, error } = await supabase
        .from('tours')
        .select('guide_fee, assistant_fee')
        .eq('id', tourId)
        .single()

      if (error) {
        console.error('투어 수수료 로드 오류:', error)
        return
      }

      if (activeTourIdRef.current !== tourId) return

      if (tour) {
        // 저장된 수수료가 있으면 사용 (0은 스키마 기본값이므로 '저장된 금액'으로 보지 않음 → 가이드비 관리 기본값 로드 허용)
        const row = tour as { 
          guide_fee: number | null; 
          assistant_fee: number | null; 
        }
        if (row.guide_fee !== null && row.guide_fee !== undefined) {
          setGuideFee(Number(row.guide_fee))
          setIsGuideFeeFromTour(Number(row.guide_fee) > 0)
        }
        if (row.assistant_fee !== null && row.assistant_fee !== undefined) {
          setAssistantFee(Number(row.assistant_fee))
          setIsAssistantFeeFromTour(Number(row.assistant_fee) > 0)
        }
        console.log('투어 수수료 로드됨:', row)
      }
    } catch (error) {
      console.error('투어 수수료 로드 오류:', error)
    } finally {
      if (activeTourIdRef.current === tourId) setFeesHydrated(true)
    }
  }, [tourData.tour?.id, tourData.tour?.tour_status])

  // 가이드비 관리에서 기본값 로드 (팀 타입별)
  const loadGuideCosts = useCallback(async () => {
    if (isTourCancelled(tourData.tour?.tour_status)) return

    if (!tourData.tour?.product_id || !tourData.teamType) {
      console.log('loadGuideCosts 조건 불만족:', {
        productId: tourData.tour?.product_id,
        teamType: tourData.teamType
      })
      return
    }

    // 팀 타입 불일치 방지
    if (tourData.tour?.team_type && tourData.teamType !== tourData.tour.team_type) {
      console.log('⚠️ loadGuideCosts: 팀 타입 불일치로 중단:', {
        localTeamType: tourData.teamType,
        tourTeamType: tourData.tour.team_type
      })
      return
    }

    try {
      // 팀 타입별 매핑
      const teamTypeMap: Record<string, string> = {
        '1guide': '1_guide',
        '2guide': '2_guides', 
        'guide+driver': 'guide_driver'
      }

      const mappedTeamType = teamTypeMap[tourData.teamType]
      if (!mappedTeamType) {
        console.warn('알 수 없는 팀 타입:', tourData.teamType)
        return
      }

      console.log(`가이드비 로드 시작 - 팀 타입: ${tourData.teamType} (${mappedTeamType}), 상품 ID: ${tourData.tour.product_id}`)

      const response = await fetch(`/api/guide-costs?product_id=${tourData.tour.product_id}&team_type=${mappedTeamType}`)
      const data = await response.json()

      if (data.guideCost) {
        console.log(`가이드비 데이터 수신됨 (${mappedTeamType}):`, data.guideCost)
        
        // 팀 타입별로 올바른 수수료 설정
        if (tourData.teamType === '1guide') {
          // 1가이드 타입: 가이드 수수료만 설정
          if (!isGuideFeeFromTour) {
            setGuideFee(data.guideCost.guide_fee)
            setIsGuideFeeFromDefault(true)
            console.log(`✅ 1가이드 기본 수수료 설정됨 (${mappedTeamType}):`, data.guideCost.guide_fee)
          } else {
            console.log(`⏭️ 1가이드 수수료는 이미 투어에서 로드됨, 기본값 사용 안함`)
          }
        } else if (tourData.teamType === '2guide') {
          // 2가이드 타입: 가이드와 어시스턴트 수수료 모두 설정
          if (!isGuideFeeFromTour) {
            setGuideFee(data.guideCost.guide_fee)
            setIsGuideFeeFromDefault(true)
            console.log(`✅ 2가이드 - 가이드 기본 수수료 설정됨 (${mappedTeamType}):`, data.guideCost.guide_fee)
          } else {
            console.log(`⏭️ 2가이드 - 가이드 수수료는 이미 투어에서 로드됨, 기본값 사용 안함`)
          }
          
          if (!isAssistantFeeFromTour) {
            setAssistantFee(data.guideCost.assistant_fee)
            setIsAssistantFeeFromDefault(true)
            console.log(`✅ 2가이드 - 2차 가이드 기본 수수료 설정됨 (${mappedTeamType}):`, data.guideCost.assistant_fee)
          } else {
            console.log(`⏭️ 2가이드 - 2차 가이드 수수료는 이미 투어에서 로드됨, 기본값 사용 안함`)
          }
        } else if (tourData.teamType === 'guide+driver') {
          // 가이드+드라이버 타입: 가이드와 드라이버 수수료 설정
          if (!isGuideFeeFromTour) {
            setGuideFee(data.guideCost.guide_fee)
            setIsGuideFeeFromDefault(true)
            console.log(`✅ 가이드+드라이버 - 가이드 기본 수수료 설정됨 (${mappedTeamType}):`, data.guideCost.guide_fee)
          } else {
            console.log(`⏭️ 가이드+드라이버 - 가이드 수수료는 이미 투어에서 로드됨, 기본값 사용 안함`)
          }
          
          if (!isAssistantFeeFromTour) {
            setAssistantFee(data.guideCost.driver_fee)
            setIsAssistantFeeFromDefault(true)
            console.log(`✅ 가이드+드라이버 - 드라이버 기본 수수료 설정됨 (${mappedTeamType}) → assistant_fee:`, data.guideCost.driver_fee)
          } else {
            console.log(`⏭️ 가이드+드라이버 - 드라이버 수수료는 이미 투어에서 로드됨, 기본값 사용 안함`)
          }
        }
      } else {
        console.log(`❌ 팀 타입 ${mappedTeamType}에 대한 가이드비 설정이 없습니다.`)
      }
    } catch (error) {
      console.error('가이드비 로드 오류:', error)
    }
  }, [tourData.tour?.product_id, tourData.tour?.tour_status, tourData.teamType, tourData.tour?.team_type, isGuideFeeFromTour, isAssistantFeeFromTour])

  // 팀 수수료 변경 핸들러 (자동 저장 제거)
  const handleGuideFeeChange = (fee: number) => {
    setGuideFee(fee)
    setIsGuideFeeFromTour(true)
    setIsGuideFeeFromDefault(false)
  }

  const handleAssistantFeeChange = (fee: number) => {
    setAssistantFee(fee)
    setIsAssistantFeeFromTour(true)
    setIsAssistantFeeFromDefault(false)
  }

  // 통합 저장 함수
  const handleTeamAndVehicleSave = async () => {
    if (!tourData.tour?.id) return

    try {
      const nextGuide = tourData.selectedGuide ? String(tourData.selectedGuide).trim() : ''
      const nextAssistant =
        tourData.teamType === '1guide'
          ? ''
          : tourData.selectedAssistant
            ? String(tourData.selectedAssistant).trim()
            : ''
      if (
        nextGuide &&
        nextAssistant &&
        nextGuide !== nextAssistant &&
        !allowTeamPairAssignment(
          nextGuide,
          nextAssistant,
          (tourData.teamMembers || []) as Array<{
            email: string
            name_ko?: string | null
            nick_name?: string | null
            name_en?: string | null
            do_not_team_with?: string[] | null
            avoid_team_with?: string[] | null
          }>,
          locale,
        )
      ) {
        return
      }

      const feesCancelled = isTourCancelled(tourData.tour.tour_status)
      const updateData: any = {
        team_type: tourData.teamType,
        guide_fee: feesCancelled ? 0 : guideFee,
        assistant_fee: feesCancelled ? 0 : assistantFee
      }

      // 가이드 배정
      if (tourData.selectedGuide) {
        updateData.tour_guide_id = tourData.selectedGuide
      }

      // 어시스턴트 배정
      if (tourData.selectedAssistant) {
        updateData.assistant_id = tourData.selectedAssistant
      } else if (tourData.teamType === '1guide') {
        updateData.assistant_id = null
      }

      // 차량 배정 (비우면 해제 — 해제 시 DB 트리거로 max_participants → 12)
      updateData.tour_car_id = tourData.selectedVehicleId
        ? tourData.selectedVehicleId
        : null

      const { data: savedTourRow, error } = await (supabase as any)
        .from('tours')
        .update(updateData)
        .eq('id', tourData.tour.id)
        .select()
        .maybeSingle()

      if (error) {
        console.error('팀 구성 및 차량 배정 저장 오류:', error)
        alert(t('detail.saveError'))
        return
      }

      if (tourData.selectedVehicleId && endMileage > 0) {
        const { error: mileageError } = await supabase
          .from('vehicles')
          .update({ current_mileage: endMileage } satisfies Database['public']['Tables']['vehicles']['Update'])
          .eq('id', tourData.selectedVehicleId)
        if (mileageError) {
          console.error('차량 종료 마일리지 저장 오류:', mileageError)
        }
      }

      // 상태 업데이트
      setIsGuideFeeFromTour(true)
      setIsAssistantFeeFromTour(true)
      setIsGuideFeeFromDefault(false)
      setIsAssistantFeeFromDefault(false)

      // 투어 데이터 업데이트 (트리거로 조정된 max_participants 등 반영)
      tourData.setTour((prev: TourRow | null) => {
        if (!prev) return null
        if (savedTourRow && typeof savedTourRow === 'object') {
          return { ...prev, ...savedTourRow }
        }
        return { ...prev, ...updateData }
      })

      console.log('팀 구성 및 차량 배정 저장 완료:', updateData)
      alert(t('detail.saveSuccess'))
    } catch (error) {
      console.error('팀 구성 및 차량 배정 저장 오류:', error)
      alert(t('detail.saveError'))
    }
  }

  const handleMaxParticipantsChange = async (value: number) => {
    if (!tourData.tour?.id) return
    try {
      const { data, error } = await supabase
        .from('tours')
        .update({ max_participants: value } satisfies Database['public']['Tables']['tours']['Update'])
        .eq('id', tourData.tour.id)
        .select()
        .maybeSingle()

      if (error) throw error
      tourData.setTour((prev: TourRow | null) => {
        if (!prev) return null
        if (data && typeof data === 'object') return { ...prev, ...data }
        return { ...prev, max_participants: value }
      })
    } catch (e) {
      console.error('최대 수용 인원 저장 오류:', e)
      alert(t('detail.saveError'))
    }
  }




  // 차량 이름 가져오기 함수
  const getVehicleName = (vehicleId: string) => {
    if (!vehicleId) return t('detail.vehicleNotSelected')
    
    const vehicle = tourData.vehicles.find((v) => v.id === vehicleId)
    if (!vehicle) {
      return vehicleId
    }

    const formatRentalDateShort = (dateStr?: string | null) => {
      if (!dateStr) return ''
      const raw = String(dateStr).slice(0, 10)
      const [year, month, day] = raw.split('-')
      if (!year || !month || !day) return ''
      const m = Number(month)
      const d = Number(day)
      if (Number.isNaN(m) || Number.isNaN(d)) return ''
      return `${m}/${d}`
    }

    const v = vehicle as Database['public']['Tables']['vehicles']['Row']
    const baseLabel = `${v.memo?.trim() || v.vehicle_number || t('detail.noNumber')} - ${v.vehicle_type || t('detail.noType')}`
    if (v.vehicle_category === 'company') return baseLabel

    const start = formatRentalDateShort(v.rental_start_date)
    const end = formatRentalDateShort(v.rental_end_date)
    if (start && end) {
      return `${baseLabel} (${start}~${end})`
    }
    return baseLabel
  }

  // 채널 정보 가져오기 함수
  const getChannelInfo = async (channelId: string) => {
    if (!channelId) return null
    
    try {
      const { data: channel, error } = await supabase
        .from('channels')
        .select('id, name, favicon_url')
        .eq('id', channelId)
        .single()

      if (error) {
        console.error('채널 정보 조회 오류:', error)
        return { name: 'Unknown Channel', favicon: undefined }
      }

      return {
        name: (channel as any)?.name || 'Unknown Channel',
        favicon: (channel as any)?.favicon_url || undefined
      }
    } catch (error) {
      console.error('채널 정보 조회 중 오류:', error)
      return { name: 'Unknown Channel', favicon: undefined }
    }
  }

  // 마일리지 로드 함수
  const loadMileage = useCallback(async (vehicleId: string) => {
    if (!vehicleId) {
      setStartMileage(0)
      setEndMileage(0)
      return
    }

    setIsMileageLoading(true)
    try {
      // 차량의 current_mileage 사용 (이전 투어 조회 제거)
      console.log('차량 마일리지 조회 시작')
      const { data: vehicle, error: vehicleError } = await (supabase as any)
        .from('vehicles')
        .select('current_mileage')
        .eq('id', vehicleId)
        .single()

      console.log('차량 조회 결과:', { vehicle, vehicleError })

      let startMileageValue = 0

      if (vehicleError) {
        console.error('차량 마일리지 조회 오류:', vehicleError)
        console.log('차량 오류 상세:', {
          message: vehicleError.message,
          details: vehicleError.details,
          hint: vehicleError.hint,
          code: vehicleError.code
        })
      } else if (vehicle && (vehicle as any).current_mileage) {
        startMileageValue = (vehicle as any).current_mileage
        console.log('차량 현재 마일리지 사용:', startMileageValue)
      } else {
        console.log('차량 마일리지가 없거나 0입니다.')
      }

      setStartMileage(startMileageValue)
      setEndMileage(0)

    } catch (error) {
      console.error('마일리지 로드 오류:', error)
    } finally {
      setIsMileageLoading(false)
    }
  }, [])

  // 차량 선택 변경 핸들러
  const handleVehicleSelect = (vehicleId: string) => {
    tourData.setSelectedVehicleId(vehicleId)
    loadMileage(vehicleId)
  }

  // 차량 선택 시 마일리지 로드
  useEffect(() => {
    if (tourData.selectedVehicleId) {
      loadMileage(tourData.selectedVehicleId)
    }
  }, [tourData.selectedVehicleId, loadMileage])

  // 투어 전환 시 수수료 하이드레이션 리셋 (loadTourFees 완료 전에 기본값 덮어쓰기 방지)
  useEffect(() => {
    setFeesHydrated(false)
  }, [tourData.tour?.id])

  // 투어 수수료 및 가이드비 로드 useEffect
  useEffect(() => {
    if (tourData.tour?.id) {
      // 먼저 투어별 저장된 수수료 로드
      loadTourFees()
      // 부킹 데이터 로드
      loadBookings()
    }
  }, [tourData.tour?.id, loadTourFees, loadBookings])

  useEffect(() => {
    // teamType과 tour.team_type이 일치할 때만 가이드 수수료 로딩
    if (!feesHydrated) return undefined
    if (!(tourData.tour?.product_id && tourData.teamType && tourData.tour?.team_type)) {
      return undefined
    }

    console.log('팀 타입 로딩 완료, 가이드 수수료 로딩 시작:', {
      teamType: tourData.teamType,
      tourTeamType: tourData.tour.team_type,
      isGuideFeeFromTour,
      isAssistantFeeFromTour
    })

    if (tourData.teamType !== tourData.tour.team_type) {
      console.log('⚠️ 팀 타입 불일치 감지, 기본값 로드하지 않음:', {
        localTeamType: tourData.teamType,
        tourTeamType: tourData.tour.team_type
      })
      return undefined
    }

    let timeoutId: number | undefined
    if (!isGuideFeeFromTour || !isAssistantFeeFromTour) {
      timeoutId = window.setTimeout(() => {
        loadGuideCosts()
      }, 100)
    } else {
      console.log('저장된 수수료가 있으므로 기본값 로드하지 않음')
    }

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [feesHydrated, tourData.tour?.product_id, tourData.teamType, tourData.tour?.team_type, loadGuideCosts, isGuideFeeFromTour, isAssistantFeeFromTour])


  const handleAssignReservation = async (reservationId: string) => {
    if (!tourData.tour) return

    const pendingReservation = tourData.pendingReservations.find((r: any) => r.id === reservationId)
    if (pendingReservation) {
      const updatedReservationIds = await tourHandlers.handleAssignReservation(
        { ...tourData.tour },
        reservationId
      )
      if (updatedReservationIds) {
        tourData.setAssignedReservations([...tourData.assignedReservations, pendingReservation])
        tourData.setPendingReservations(tourData.pendingReservations.filter((r: any) => r.id !== reservationId))
        tourData.setTour((prev: TourRow | null) =>
          prev ? { ...prev, reservation_ids: updatedReservationIds } : null
        )
        if (tourData.refreshReservations) {
          await tourData.refreshReservations()
        }
      }
      return
    }

    const otherTourReservation = tourData.otherToursAssignedReservations.find((r: any) => r.id === reservationId)
    if (otherTourReservation) {
      const fromTourId =
        (otherTourReservation as { assigned_tour_id?: string | null }).assigned_tour_id ||
        (otherTourReservation as { tour_id?: string | null }).tour_id
      if (!fromTourId) {
        alert('원본 투어 정보를 찾을 수 없습니다.')
        return
      }
      const moved = await tourHandlers.handleMoveReservationBetweenTours(
        reservationId,
        fromTourId,
        tourData.tour.id
      )
      if (moved) {
        tourData.setTour((prev: TourRow | null) =>
          prev ? { ...prev, reservation_ids: moved.newToIds } : null
        )
        if (tourData.refreshReservations) {
          await tourData.refreshReservations()
        }
      }
    }
  }

  const handleUnassignReservation = async (reservationId: string) => {
    if (!tourData.tour) {
      alert(locale === 'ko' ? '투어 정보를 불러오지 못했습니다.' : 'Tour data is not loaded.')
      return
    }

    const currentReservationIds = tourData.getEffectiveTourReservationIds()
    const optimisticIds = currentReservationIds.filter(
      (id) => !reservationIdsLooselyEqual(id, reservationId)
    )

    if (optimisticIds.length === currentReservationIds.length) {
      alert(locale === 'ko' ? '배정 해제에 실패했습니다.' : 'Failed to unassign reservation.')
      return
    }

    const reservation = tourData.assignedReservations.find((r: any) =>
      reservationIdsLooselyEqual(r.id, reservationId)
    )

    // 네트워크 대기 중 백그라운드 로드가 이전 배정 목록으로 덮어쓰지 않도록 즉시 잠금
    tourData.beginAssignmentIdsMutation(optimisticIds)
    tourData.setTour((prev: TourRow | null) =>
      prev ? { ...prev, reservation_ids: optimisticIds } : null
    )
    if (reservation) {
      tourData.setAssignedReservationsForced((prev: any) =>
        prev.filter((r: any) => !reservationIdsLooselyEqual(r.id, reservationId))
      )
      tourData.setPendingReservationsForced((prev: any) => [...prev, reservation])
    }

    const updatedReservationIds = await tourHandlers.handleUnassignReservation(
      {
        ...tourData.tour,
        reservation_ids: currentReservationIds,
      },
      reservationId
    )

    if (updatedReservationIds === undefined) {
      tourData.clearAssignmentIdsMutationOverride()
      if (tourData.refreshReservations) {
        await tourData.refreshReservations()
      }
      alert(locale === 'ko' ? '배정 해제에 실패했습니다.' : 'Failed to unassign reservation.')
      return
    }

    tourData.setTour((prev: TourRow | null) =>
      prev ? { ...prev, reservation_ids: updatedReservationIds } : null
    )
  }

  const handleMoveAssignedToOtherTour = async (reservationId: string, targetTourId: string) => {
    if (!tourData.tour) return

    const currentReservationIds = tourData.getEffectiveTourReservationIds()
    const optimisticFromIds = currentReservationIds.filter(
      (id) => !reservationIdsLooselyEqual(id, reservationId)
    )

    if (optimisticFromIds.length === currentReservationIds.length) {
      alert(locale === 'ko' ? '배정 이동에 실패했습니다.' : 'Failed to move reservation.')
      return
    }

    const reservation = tourData.assignedReservations.find((r: any) =>
      reservationIdsLooselyEqual(r.id, reservationId)
    )

    tourData.beginAssignmentIdsMutation(optimisticFromIds)
    tourData.setTour((prev: TourRow | null) =>
      prev ? { ...prev, reservation_ids: optimisticFromIds } : null
    )
    if (reservation) {
      tourData.setAssignedReservationsForced((prev: any) =>
        prev.filter((r: any) => !reservationIdsLooselyEqual(r.id, reservationId))
      )
      tourData.setPendingReservationsForced((prev: any) => [...prev, reservation])
    }

    const moved = await tourHandlers.handleMoveReservationBetweenTours(
      reservationId,
      tourData.tour.id,
      targetTourId
    )

    if (!moved) {
      tourData.clearAssignmentIdsMutationOverride()
      if (tourData.refreshReservations) {
        await tourData.refreshReservations()
      }
      return
    }

    tourData.setTour((prev: TourRow | null) =>
      prev ? { ...prev, reservation_ids: moved.newFromIds } : null
    )
  }

  const handleAssignAllReservations = async () => {
    if (!tourData.tour) return
    const updatedReservationIds = await tourHandlers.handleAssignAllReservations({
      ...tourData.tour,
      reservation_ids: tourData.tour.reservation_ids || []
    }, tourData.pendingReservations)
    if (updatedReservationIds) {
      tourData.setAssignedReservations([...tourData.assignedReservations, ...tourData.pendingReservations])
      tourData.setPendingReservations([])
      tourData.setTour((prev: TourRow | null) => prev ? { ...prev, reservation_ids: updatedReservationIds } : null)
    }
  }

  const handleUnassignAllReservations = async () => {
    if (!tourData.tour) return
    const updatedReservationIds = await tourHandlers.handleUnassignAllReservations(tourData.tour)
    if (updatedReservationIds !== undefined) {
      tourData.setPendingReservations([...tourData.pendingReservations, ...tourData.assignedReservations])
      tourData.setAssignedReservations([])
      tourData.setTour((prev: TourRow | null) => prev ? { ...prev, reservation_ids: updatedReservationIds } : null)
    }
  }

  const [cancellationReasonModalOpen, setCancellationReasonModalOpen] = useState(false)
  const [cancellationReasonSaving, setCancellationReasonSaving] = useState(false)
  const [cancellationReasonValue, setCancellationReasonValue] = useState('')
  const cancellationReasonResolveRef = useRef<((value: string | null) => void) | null>(null)

  const requestCancellationReason = useCallback(() => {
    setCancellationReasonValue('')
    setCancellationReasonModalOpen(true)
    return new Promise<string | null>((resolve) => {
      cancellationReasonResolveRef.current = resolve
    })
  }, [])

  const closeCancellationReasonModal = useCallback(() => {
    setCancellationReasonModalOpen(false)
    cancellationReasonResolveRef.current?.(null)
    cancellationReasonResolveRef.current = null
  }, [])

  const submitCancellationReasonModal = useCallback(async (reason: string) => {
    const trimmed = reason.trim()
    if (!trimmed) return
    setCancellationReasonSaving(true)
    try {
      setCancellationReasonValue(trimmed)
      setCancellationReasonModalOpen(false)
      cancellationReasonResolveRef.current?.(trimmed)
      cancellationReasonResolveRef.current = null
    } finally {
      setCancellationReasonSaving(false)
    }
  }, [])

  const handleReservationStatusChange = async (reservationId: string, newStatus: string) => {
    const normalized = (newStatus || '').toLowerCase()
    if (normalized === 'cancelled' || normalized === 'canceled') {
      const reason = await requestCancellationReason()
      if (!reason) return
      const { error } = await supabase
        .from('reservations')
        .update({ status: newStatus })
        .eq('id', reservationId)
      if (error) {
        console.error('예약 상태 변경 오류:', error)
        throw error
      }
      await upsertReservationCancellationReason(reservationId, reason, authUser?.email ?? null)
      await tourData.refreshReservations()
      return
    }
    if (normalized === 'no_show') {
      const { error } = await supabase
        .from('reservations')
        .update({ status: newStatus })
        .eq('id', reservationId)
      if (error) {
        console.error('예약 상태 변경 오류:', error)
        throw error
      }
      await upsertReservationCancellationReason(reservationId, 'No Show', authUser?.email ?? null)
      await applyNoShowReservationSideEffects(reservationId)
      await tourData.refreshReservations()
      return
    }
    const { error } = await supabase
      .from('reservations')
      .update({ status: newStatus })
      .eq('id', reservationId)
    if (error) {
      console.error('예약 상태 변경 오류:', error)
      throw error
    }
    await tourData.refreshReservations()
  }

  const handleCommunicationChannelChange = async (
    reservationId: string,
    channel: CustomerCommunicationChannel
  ) => {
    const patchReservation = <T extends { id: string }>(r: T): T =>
      r.id === reservationId ? { ...r, customer_communication_channel: channel } : r

    tourData.setAllReservations((prev) => prev.map(patchReservation))
    tourData.setAssignedReservations((prev) => prev.map(patchReservation))
    tourData.setPendingReservations((prev) => prev.map(patchReservation))
    tourData.setOtherToursAssignedReservations((prev) => prev.map(patchReservation))
    tourData.setOtherStatusReservations((prev) => prev.map(patchReservation))

    const { error } = await supabase
      .from('reservations')
      .update({ customer_communication_channel: channel })
      .eq('id', reservationId)

    if (error) {
      console.error('소통 채널 변경 오류:', error)
      await tourData.refreshReservations()
      throw error
    }
  }

  const handleCopyTour = async () => {
    if (!tourData.tour) return
    const tour = tourData.tour
    if (!confirm('같은 상품/날짜로 새 투어를 생성하시겠습니까?')) return

    try {
      const tourId = generateTourId()
      // UI 선택값 우선. 밤도깨비 등 상품 기본이 2guide인데 DB/상태에 1guide만 있으면 2guide로 복사
      const teamTypeToCopy = resolveTeamTypeForTourCreate({
        sourceTeamType: tourData.teamType || tour.team_type,
        product: tourData.product
          ? {
              id: tourData.product.id,
              name: (tourData.product as { name?: string | null }).name ?? null,
              name_ko: tourData.product.name_ko,
              name_en: tourData.product.name_en,
              internal_name_ko:
                (tourData.product as { internal_name_ko?: string | null }).internal_name_ko ?? null,
              customer_name_ko:
                (tourData.product as { customer_name_ko?: string | null }).customer_name_ko ?? null,
            }
          : { id: tour.product_id },
      })
      const { data: newTour, error } = await supabase
        .from('tours')
        .insert({
          id: tourId,
          product_id: tour.product_id,
          tour_date: tour.tour_date,
          reservation_ids: [],
          tour_status: 'scheduled',
          is_private_tour: false,
          // 원본의 팀 구성(1가이드 / 2가이드 / 가이드+드라이버) 유지 · 상품 기본 반영
          team_type: teamTypeToCopy,
        })
        .select()
        .single()

      if (error) {
        console.error('투어 복사 오류:', error)
        alert('투어 복사 중 오류가 발생했습니다: ' + error.message)
        return
      }

      alert('새 투어가 생성되었습니다.')
      // 모달에서 복사 시: 페이지 이동 대신 생성된 투어 상세 모달로 전환
      if (onNavigateToTourProp) {
        onNavigateToTourProp(newTour.id)
        return
      }
      router.push(`/${locale}/admin/tours/${newTour.id}`)
    } catch (err) {
      console.error('투어 복사 오류:', err)
      alert('투어 복사 중 오류가 발생했습니다.')
    }
  }

  const handleRestoreTour = async () => {
    if (!tourData.tour || !tourData.isStaff) return
    if (!isTourDeletedStatus(tourData.tour.tour_status)) return
    const msg =
      locale === 'ko'
        ? '삭제됨 상태를 해제하고 투어를 "예정(scheduled)"으로 복구합니다. 가이드·차량은 비어 있으니 다시 배정해 주세요. 계속할까요?'
        : 'Restore this tour to scheduled status? Guide and vehicle assignments stay cleared — please reassign. Continue?'
    if (!confirm(msg)) return
    try {
      const { error } = await supabase
        .from('tours')
        .update({ tour_status: 'scheduled' })
        .eq('id', tourData.tour.id)
      if (error) {
        console.error('투어 복구 오류:', error)
        alert(locale === 'ko' ? '복구 실패: ' + error.message : 'Restore failed: ' + error.message)
        return
      }
      alert(locale === 'ko' ? '투어가 복구되었습니다.' : 'Tour restored.')
      const { data: updatedTour, error: refetchErr } = await supabase
        .from('tours')
        .select(`*, products (*)`)
        .eq('id', tourData.tour.id)
        .single()
      if (!refetchErr && updatedTour) {
        tourData.setTour(updatedTour)
        tourData.setIsPrivateTour((updatedTour as any)?.is_private_tour || false)
      } else {
        router.refresh()
      }
    } catch (err) {
      console.error('투어 복구 오류:', err)
      alert(locale === 'ko' ? '복구 중 오류가 발생했습니다.' : 'Restore failed.')
    }
  }

  const handleDeleteTour = async () => {
    if (!tourData.tour) return
    if (!confirm('이 투어를 삭제하시겠습니까? 데이터는 삭제되지 않고 투어 상태만 "삭제됨"으로 변경됩니다.')) return

    try {
      const { error } = await supabase
        .from('tours')
        .update({ tour_status: 'Deleted', ...tourStaffVehicleAssignmentClearPatch() })
        .eq('id', tourData.tour.id)

      if (error) {
        console.error('투어 삭제(상태 변경) 오류:', error)
        alert('투어 삭제 처리 중 오류가 발생했습니다: ' + error.message)
        return
      }

      alert('투어가 삭제됨 상태로 변경되었습니다.')
      router.push(`/${locale}/admin/tours`)
    } catch (err) {
      console.error('투어 삭제 처리 오류:', err)
      alert('투어 삭제 처리 중 오류가 발생했습니다.')
    }
  }

  const handleSavePickupTime = async () => {
    if (!tourData.selectedReservation) return
    const success = await tourHandlers.handleSavePickupTime(tourData.selectedReservation, tourData.pickupTimeValue)
    if (success) {
      tourData.setAssignedReservations((prev: any) => 
        prev.map((res: any) => 
          res.id === tourData.selectedReservation?.id 
            ? { ...res, pickup_time: tourData.pickupTimeValue }
            : res
        )
      )
      tourData.setPendingReservations((prev: any) => 
        prev.map((res: any) => 
          res.id === tourData.selectedReservation?.id 
            ? { ...res, pickup_time: tourData.pickupTimeValue }
            : res
        )
      )
      tourData.setShowTimeModal(false)
      tourData.setSelectedReservation(null)
      tourData.setPickupTimeValue('')
    }
  }

  const handleSavePickupHotel = async (newHotelId: string) => {
    if (!tourData.selectedReservationForHotelChange) return
    const success = await tourHandlers.handleSavePickupHotel(tourData.selectedReservationForHotelChange, newHotelId)
    if (success) {
      tourData.setAssignedReservations((prev: any) => 
        prev.map((res: any) => 
          res.id === tourData.selectedReservationForHotelChange?.id 
            ? { ...res, pickup_hotel: newHotelId }
            : res
        )
      )
      tourData.setPendingReservations((prev: any) => 
        prev.map((res: any) => 
          res.id === tourData.selectedReservationForHotelChange?.id 
            ? { ...res, pickup_hotel: newHotelId }
            : res
        )
      )
      tourData.setShowPickupHotelModal(false)
      tourData.setSelectedReservationForHotelChange(null)
    }
  }

  // 픽업 시간 일괄 발송 핸들러
  const handleBatchSendPickupScheduleNotifications = async () => {
    try {
      // 배정된 예약 중 픽업 시간이 설정된 예약만 필터링
      const reservationsWithPickupTime = tourData.assignedReservations.filter(
        (res: any) => res.pickup_time && res.pickup_time.trim() !== ''
      )

      if (reservationsWithPickupTime.length === 0) {
        alert('픽업 시간이 설정된 예약이 없습니다.')
        return
      }

      // 현재 사용자 이메일 가져오기 (발송 내역 기록용)
      const { data: { user } } = await supabase.auth.getUser()
      const sentBy = user?.email || null

      // 각 예약에 대해 알림 발송
      let successCount = 0
      let failCount = 0

      for (const reservation of reservationsWithPickupTime) {
        try {
          // 예약 정보에서 투어 날짜 확인
          const tourDate = reservation.tour_date || tourData.tour?.tour_date
          
          if (!tourDate) {
            console.warn(`예약 ${reservation.id}의 투어 날짜를 찾을 수 없습니다.`)
            failCount++
            continue
          }

          const response = await fetchApiWithAuth('/api/send-pickup-schedule-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              reservationId: reservation.id,
              pickupTime: reservation.pickup_time && reservation.pickup_time.includes(':') 
                ? reservation.pickup_time 
                : reservation.pickup_time 
                  ? `${reservation.pickup_time}:00`
                  : '',
              tourDate: tourDate,
              sentBy: sentBy
            })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error(`예약 ${reservation.id} 알림 발송 실패:`, errorData)
            failCount++
          } else {
            successCount++
          }
        } catch (error) {
          console.error(`예약 ${reservation.id} 알림 발송 오류:`, error)
          failCount++
        }
      }

      if (successCount > 0) {
        alert(t('pickupSchedule.notificationSent', { count: successCount }) + (failCount > 0 ? t('pickupSchedule.notificationSentPartial', { failed: failCount }) : ''))
        // 데이터 새로고침
        if (tourData.refreshReservations) {
          await tourData.refreshReservations()
        }
      } else {
        alert(t('pickupSchedule.notificationSendFailed'))
      }
    } catch (error) {
      console.error('일괄 알림 발송 오류:', error)
      alert(t('pickupSchedule.notificationBatchError'))
    }
  }

  const handlePickupPresetChange = async (presetId: string | null) => {
    if (!tourData.tour?.id) return
    const { error } = await supabase
      .from('tours')
      .update({
        pickup_group_preset_id: presetId,
        use_representative_pickup: presetId != null,
      } as never)
      .eq('id', tourData.tour.id)

    if (error) {
      console.error('픽업 프리셋 저장 오류:', error)
      alert(t('pickupSchedule.presetSaveFailed'))
      throw error
    }

    tourData.setTour({
      ...tourData.tour,
      pickup_group_preset_id: presetId,
      use_representative_pickup: presetId != null,
    })
  }

  const handleGroupModeOverrideChange = async (groupIndex: number, mode: PickupGroupMode) => {
    if (!tourData.tour?.id) return
    const next = {
      ...pickupGroupModeOverrides,
      [String(groupIndex)]: mode,
    }
    const { error } = await supabase
      .from('tours')
      .update({ pickup_group_mode_overrides: next } as never)
      .eq('id', tourData.tour.id)

    if (error) {
      console.error('그룹 픽업 모드 저장 오류:', error)
      alert(t('pickupSchedule.groupModeSaveFailed'))
      throw error
    }

    tourData.setTour({
      ...tourData.tour,
      pickup_group_mode_overrides: next,
    })
  }

  const handleGroupRepresentativeOverrideChange = async (
    groupIndex: number,
    hotelId: string | null
  ) => {
    if (!tourData.tour?.id) return
    const next = { ...pickupGroupRepresentativeOverrides }
    if (hotelId) {
      next[String(groupIndex)] = hotelId
    } else {
      delete next[String(groupIndex)]
    }
    const { error } = await supabase
      .from('tours')
      .update({ pickup_group_representative_overrides: next } as never)
      .eq('id', tourData.tour.id)

    if (error) {
      console.error('그룹 대표 픽업 호텔 저장 오류:', error)
      alert(t('pickupSchedule.groupRepSaveFailed'))
      throw error
    }

    tourData.setTour({
      ...tourData.tour,
      pickup_group_representative_overrides: next,
    })
  }

  const handleSavePickupSchedule = async (pickupTimes: Record<string, string>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      // 여러 예약의 픽업 시간을 일괄 업데이트
      const updates = Object.entries(pickupTimes).map(([reservationId, pickupTime]) => ({
        id: reservationId,
        pickup_time: pickupTime
      }))

      // 각 예약을 개별적으로 업데이트하고 알림 발송
      for (const update of updates) {
        const { error } = await (supabase as any)
          .from('reservations')
          .update({ pickup_time: update.pickup_time })
          .eq('id', update.id)

        if (error) {
          console.error(`예약 ${update.id} 픽업 시간 업데이트 오류:`, error)
          throw error
        }

        // 자동 알림 발송은 제거 (일괄 발송 버튼 사용)
      }

      // 데이터 새로고침 - 페이지 새로고침으로 대체
      window.location.reload()

      console.log('픽업 스케줄 저장 완료:', updates.length, '건')
    } catch (error) {
      console.error('픽업 스케줄 저장 오류:', error)
      throw error
    }
  }

  const handleCancelEditPickupTime = () => {
    tourData.setShowTimeModal(false)
    tourData.setSelectedReservation(null)
    tourData.setPickupTimeValue('')
  }

  const handleCancelEditPickupHotel = () => {
    tourData.setShowPickupHotelModal(false)
    tourData.setSelectedReservationForHotelChange(null)
    tourData.setHotelSearchTerm('')
  }

  // 검색어에 따라 호텔 목록 필터링
  const filteredHotels = tourData.pickupHotels.filter((hotel: any) => {
    if (!tourData.hotelSearchTerm) return true
    const searchLower = tourData.hotelSearchTerm.toLowerCase()
    return (
      hotel.hotel?.toLowerCase().includes(searchLower) ||
      hotel.pick_up_location?.toLowerCase().includes(searchLower)
    )
  })

  // 예약 데이터를 Reservation 타입으로 변환
  const convertReservationToFormType = (reservation: any): any => {
    return {
      id: reservation.id,
      customerId: reservation.customer_id || '',
      productId: reservation.product_id || '',
      tourDate: reservation.tour_date || tourData.tour?.tour_date || '',
      tourTime: reservation.tour_time || '',
      eventNote: reservation.event_note || '',
      pickUpHotel: reservation.pickup_hotel || '',
      pickUpTime: reservation.pickup_time || '',
      adults: reservation.adults || 0,
      child: reservation.child || 0,
      infant: reservation.infant || 0,
      totalPeople: reservation.total_people || 0,
      channelId: reservation.channel_id || '',
      channelRN: reservation.channel_rn || '',
      addedBy: reservation.added_by || '',
      addedTime: reservation.created_at || '',
      tourId: reservation.tour_id || '',
      status: (reservation.status as 'inquiry' | 'pending' | 'confirmed' | 'completed' | 'cancelled') || 'pending',
      selectedOptions: (typeof reservation.selected_options === 'string'
        ? (() => { try { return JSON.parse(reservation.selected_options) } catch { return {} } })()
        : (reservation.selected_options as { [optionId: string]: string[] }) || {}),
      selectedOptionPrices: (typeof reservation.selected_option_prices === 'string'
        ? (() => { try { return JSON.parse(reservation.selected_option_prices) } catch { return {} } })()
        : (reservation.selected_option_prices as { [key: string]: number }) || {}),
      isPrivateTour: reservation.is_private_tour || false
    }
  }

  // 예약 편집 모달용 데이터 로드
  const loadReservationFormData = useCallback(async (productId: string) => {
    try {
      // productOptions 로드
      const { data: productOptionsData } = await supabase
        .from('product_options')
        .select('*')
        .eq('product_id', productId)

      // options 로드
      const { data: optionsData } = await supabase
        .from('options')
        .select('*')
        .order('name', { ascending: true })

      setReservationFormData(prev => ({
        ...prev,
        productOptions: productOptionsData || [],
        options: optionsData || []
      }))
    } catch (error) {
      console.error('Error loading reservation form data:', error)
    }
  }, [])

  // 활성 쿠폰 목록 로드 (예약 편집 모달 쿠폰 드롭다운용)
  useEffect(() => {
    let cancelled = false
    const loadCoupons = async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('status', 'active')
        .order('coupon_code', { ascending: true })
      if (cancelled) return
      if (error) {
        console.warn('쿠폰 로드 오류:', error)
        return
      }
      setReservationFormData(prev => ({ ...prev, coupons: data || [] }))
    }
    loadCoupons()
    return () => { cancelled = true }
  }, [])

  // 예약 편집 모달 열기
  const handleEditReservationClick = async (reservation: any) => {
    if (!tourData.isStaff) return
    const convertedReservation = convertReservationToFormType(reservation)
    setEditingReservation(convertedReservation)
    
    // 예약의 상품 ID로 필요한 데이터 로드
    if (reservation.product_id) {
      await loadReservationFormData(reservation.product_id)
    }
  }

  // 예약 편집 모달 닫기
  const handleCloseEditModal = async () => {
    setEditingReservation(null)
    setShowEditReceiptModal(false)
  }

  // 예약 ID로 수정 모달 열기 (Tips 쉐어 등에서 예약 클릭 시)
  const handleOpenReservationById = useCallback(async (reservationId: string) => {
    if (!tourData.isStaff) return
    const found = tourData.assignedReservations?.find((r: any) => r.id === reservationId)
    if (found) {
      await handleEditReservationClick(found)
      return
    }
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .maybeSingle()
      if (error || !data) return
      await handleEditReservationClick(data)
    } catch (_) {}
  }, [tourData.isStaff, tourData.assignedReservations, handleEditReservationClick])

  // 부킹 관련 핸들러들
  const handleAddTicketBooking = async () => {
    setEditingTicketBooking(null)
    setShowTicketBookingForm(true)
    // 부킹 데이터 새로고침
    await loadBookings()
  }

  const handleBulkAddTicketBooking = () => {
    setShowTicketBookingBulkAdd(true)
  }

  const handleEditTicketBooking = async (booking: LocalTicketBooking) => {
    setEditingTicketBooking(booking)
    setShowTicketBookingForm(true)
    // 부킹 데이터 새로고침
    await loadBookings()
  }

  const handleCloseTicketBookingForm = async () => {
    setShowTicketBookingForm(false)
    setEditingTicketBooking(null)
    await loadBookings()
  }

  /** 사용자: 삭제 요청만 (DB에 삭제 요청 상태 저장) */
  const handleRequestTicketBookingDelete = async (id: string) => {
    const email = authUser?.email || ''
    const { error } = await supabase
      .from('ticket_bookings')
      .update({
        deletion_requested_at: new Date().toISOString(),
        deletion_requested_by: email || null
      })
      .eq('id', id)
    if (error) {
      console.error('삭제 요청 오류:', error)
      alert(locale === 'ko' ? '삭제 요청 처리 중 오류가 발생했습니다.' : 'Failed to request deletion.')
      return
    }
    alert(locale === 'ko' ? '삭제 요청되었습니다. Super가 확인 후 삭제합니다.' : 'Deletion requested. Super will delete after review.')
    await loadBookings()
    setEditingTicketBooking(prev => prev?.id === id ? { ...prev, deletion_requested_at: new Date().toISOString(), deletion_requested_by: email } : prev)
  }

  /** Super: 실제 삭제 */
  const handleActualTicketBookingDelete = async (id: string) => {
    const { error } = await supabase.from('ticket_bookings').delete().eq('id', id)
    if (error) {
      console.error('삭제 오류:', error)
      alert(locale === 'ko' ? '삭제 중 오류가 발생했습니다.' : 'Failed to delete.')
      return
    }
    alert(locale === 'ko' ? '삭제되었습니다.' : 'Deleted.')
    setShowTicketBookingForm(false)
    setEditingTicketBooking(null)
    await loadBookings()
  }

  const handleAddTourHotelBooking = async () => {
    setEditingTourHotelBooking(null)
    setHotelBookingSeed(null)
    setReplacesBookingId(null)
    setShowTourHotelBookingForm(true)
    await loadBookings()
  }

  const handleEditTourHotelBooking = async (booking: LocalTourHotelBooking) => {
    setEditingTourHotelBooking(booking)
    setHotelBookingSeed(null)
    setReplacesBookingId(null)
    setShowTourHotelBookingForm(true)
    await loadBookings()
  }

  const handleRebookTourHotelBooking = async (booking: LocalTourHotelBooking) => {
    const isKo = locale === 'ko'
    const confirmed = window.confirm(
      isKo
        ? '새 부킹을 추가합니다. 저장할 때 기존 예약이 취소됩니다.\n호텔·날짜는 유지되고 RN#·금액은 새로 입력합니다. 계속할까요?'
        : 'Add a new booking. The current booking will be cancelled when you save.\nHotel and dates will be kept; enter a new RN# and price. Continue?'
    )
    if (!confirmed) return

    try {
      const { data: full, error: fetchError } = await supabase
        .from('tour_hotel_bookings')
        .select('*')
        .eq('id', booking.id)
        .maybeSingle()

      if (fetchError || !full) {
        throw fetchError || new Error('Booking not found')
      }

      const {
        id: _id,
        rn_number: _rn,
        unit_price: _unit,
        total_price: _total,
        status: _status,
        created_at: _ca,
        updated_at: _ua,
        replaces_booking_id: _rep,
        ...rest
      } = full as Record<string, unknown>

      setEditingTourHotelBooking(null)
      setHotelBookingSeed(rest as LocalTourHotelBooking)
      setReplacesBookingId(booking.id)
      setShowTourHotelBookingForm(true)
    } catch (error) {
      console.error('호텔 재예약 준비 오류:', error)
      alert(locale === 'ko' ? '재예약 준비에 실패했습니다.' : 'Failed to start rebooking.')
    }
  }

  const handleViewTourHotelBookingHistory = (booking: LocalTourHotelBooking) => {
    setHotelBookingHistoryId(booking.id)
  }

  const clearHotelBookingFormExtras = () => {
    setHotelBookingSeed(null)
    setReplacesBookingId(null)
  }

  const handleCloseTourHotelBookingForm = async () => {
    setShowTourHotelBookingForm(false)
    setEditingTourHotelBooking(null)
    clearHotelBookingFormExtras()
    await loadBookings()
  }

  const handleBookingSubmit = async (_booking: LocalTicketBooking | LocalTourHotelBooking, type: 'ticket' | 'hotel') => {
    const wasHotelRebook = type === 'hotel' && Boolean(replacesBookingId)
    if (tourData.tour) {
      await loadBookings()
    }
    const savedMessage =
      type === 'hotel' && wasHotelRebook
        ? locale === 'ko'
          ? '새 부킹이 저장되었습니다. 이전 예약은 취소 상태이며 히스토리에서 확인할 수 있습니다.'
          : 'New booking saved. The previous booking is cancelled — see history for details.'
        : locale === 'ko'
          ? '저장 완료되었습니다.'
          : 'Saved successfully.'
    alert(savedMessage)
    if (type === 'ticket') {
      setShowTicketBookingForm(false)
      setEditingTicketBooking(null)
    } else {
      setShowTourHotelBookingForm(false)
      setEditingTourHotelBooking(null)
      clearHotelBookingFormExtras()
    }
  }

  useEffect(() => {
    if (!modalLightLoad || !modalChrome) return

    if (!tourData.tour || tourData.pageLoading) {
      modalChrome.setToolbarContent(null)
      return
    }

    modalChrome.setToolbarContent(
      <TourHeader
        variant="modal-toolbar"
        tour={tourData.tour}
        product={tourData.product}
        params={{ locale }}
        showTourStatusDropdown={tourData.showTourStatusDropdown}
        showAssignmentStatusDropdown={tourData.showAssignmentStatusDropdown}
        tourStatusOptions={tourStatusOptions}
        assignmentStatusOptions={assignmentStatusOptions}
        getTotalAssignedPeople={tourData.getTotalAssignedPeople}
        getTotalPeopleNonCancelled={tourData.getTotalPeopleNonCancelled}
        getTotalCancelledPeople={tourData.getTotalCancelledPeople}
        onToggleTourStatusDropdown={() =>
          tourData.setShowTourStatusDropdown(!tourData.showTourStatusDropdown)
        }
        onToggleAssignmentStatusDropdown={() =>
          tourData.setShowAssignmentStatusDropdown(!tourData.showAssignmentStatusDropdown)
        }
        onUpdateTourStatus={handleTourStatusUpdate}
        onUpdateAssignmentStatus={handleAssignmentStatusUpdate}
        getStatusColor={getStatusColor}
        getStatusText={getStatusText}
        getAssignmentStatusColor={getAssignmentStatusColor}
        getAssignmentStatusText={getAssignmentStatusText}
        onEditClick={() => setShowTourEditModal(true)}
        onCopyTour={handleCopyTour}
        onDeleteTour={handleDeleteTour}
        {...(tourData.isStaff &&
        tourData.tour &&
        isTourDeletedStatus(tourData.tour.tour_status)
          ? { onRestoreTour: handleRestoreTour }
          : {})}
        onPrintTourInfo={() => setShowTourPrintModal(true)}
        onPrintReceipts={() => setShowBatchReceiptModal(true)}
        onPrintTipEnvelopes={() => setEnvelopeModalVariant('tip')}
        onPrintBalanceEnvelopes={() => setEnvelopeModalVariant('balance')}
        {...(canSendGuideScheduleConfirm
          ? {
              onSendGuideScheduleConfirm: openGuideScheduleConfirmModal,
              onSendGuideScheduleAssignment: openGuideScheduleAssignmentModal,
            }
          : {})}
        {...(tourData.isStaff ? { onViewAssignmentHistory: openGuideAssignmentHistoryModal } : {})}
        onCloseModal={modalChrome.onClose}
        isPrivateTour={tourData.isPrivateTour}
        maxParticipants={
          typeof tourData.tour.max_participants === 'number' &&
          Number.isFinite(tourData.tour.max_participants)
            ? tourData.tour.max_participants
            : 12
        }
      />
    )

    return () => modalChrome.setToolbarContent(null)
  }, [
    modalLightLoad,
    modalChrome,
    tourData.tour?.id,
    tourData.pageLoading,
    tourData.product?.id,
    tourData.tour?.tour_status,
    tourData.isStaff,
    tourData.isPrivateTour,
    tourData.tour?.max_participants,
    locale,
  ])

  useLayoutEffect(() => {
    if (!modalLightLoad || !modalChrome || tourData.pageLoading || !tourData.tour) return
    modalChrome.resetScroll()
    const raf = requestAnimationFrame(() => {
      modalChrome.resetScroll()
    })
    return () => cancelAnimationFrame(raf)
  }, [
    modalLightLoad,
    modalChrome,
    tourData.pageLoading,
    tourData.tour?.id,
  ])

  // 인증·투어 데이터 로딩 — 전체 스피너 대신 레이아웃 스켈레톤
  // 모달: 관리자 페이지에서 이미 로그인된 경우가 많아 auth loading 대기를 건너뛰어 첫 페인트 단축
  const blockOnAuth = !modalLightLoad || (!authUser && loading)
  if (blockOnAuth || tourData.pageLoading) {
    return (
      <div className={modalLightLoad ? 'min-h-0 bg-white' : 'min-h-screen app-page-bg'}>
        {!modalLightLoad ? (
          <div className="border-b bg-white shadow-sm">
            <div className="px-2 py-2 sm:px-6 sm:py-4">
              <div className="flex items-center space-x-4">
                <SkeletonCard className="h-8 w-8" />
                <div className="flex-1">
                  <SkeletonCard className="mb-2 h-6 w-64" />
                  <div className="flex gap-2">
                    <SkeletonCard className="h-4 w-20" />
                    <SkeletonCard className="h-4 w-24" />
                    <SkeletonCard className="h-4 w-16" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* 메인 콘텐츠 스켈레톤 */}
        <div className="px-2 py-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 왼쪽 컬럼 */}
            <div className="lg:col-span-2 space-y-4">
              {/* 투어 정보 카드 */}
              <div className="bg-white rounded-lg shadow p-4">
                <SkeletonCard className="h-6 w-32 mb-4" />
                <div className="space-y-3">
                  <SkeletonText lines={3} />
                  <div className="grid grid-cols-2 gap-4">
                    <SkeletonText lines={2} />
                    <SkeletonText lines={2} />
                  </div>
                </div>
              </div>

              {/* 예약 정보 카드 */}
              <div className="bg-white rounded-lg shadow p-4">
                <SkeletonCard className="h-6 w-24 mb-4" />
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center space-x-3">
                        <SkeletonCard className="w-8 h-8 rounded-full" />
                        <div>
                          <SkeletonCard className="h-4 w-32 mb-1" />
                          <SkeletonCard className="h-3 w-24" />
                        </div>
                      </div>
                      <SkeletonCard className="h-6 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 오른쪽 컬럼 */}
            <div className="space-y-4">
              {/* 팀 정보 카드 */}
              <div className="bg-white rounded-lg shadow p-4">
                <SkeletonCard className="h-6 w-20 mb-4" />
                <div className="space-y-3">
                  <SkeletonText lines={2} />
                  <SkeletonCard className="h-10 w-full" />
                </div>
              </div>

              {/* 차량 정보 카드 */}
              <div className="bg-white rounded-lg shadow p-4">
                <SkeletonCard className="h-6 w-16 mb-4" />
                <SkeletonText lines={2} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 권한이 없을 때는 리다이렉트 중이므로 빈 화면 표시
  if (!tourData.isStaff) {
    return null
  }

  if (!tourData.tour) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('detail.tourNotFound')}</div>
      </div>
    )
  }

  return (
    <>
    <div className={modalLightLoad ? 'min-h-0 bg-white' : 'min-h-screen app-page-bg'}>
      {!modalLightLoad ? (
      <TourHeader
        variant="page"
        tour={tourData.tour}
        product={tourData.product}
        params={{ locale }}
        showTourStatusDropdown={tourData.showTourStatusDropdown}
        showAssignmentStatusDropdown={tourData.showAssignmentStatusDropdown}
              tourStatusOptions={tourStatusOptions}
              assignmentStatusOptions={assignmentStatusOptions}
        getTotalAssignedPeople={tourData.getTotalAssignedPeople}
        getTotalPeopleNonCancelled={tourData.getTotalPeopleNonCancelled}
        getTotalCancelledPeople={tourData.getTotalCancelledPeople}
        onToggleTourStatusDropdown={() => tourData.setShowTourStatusDropdown(!tourData.showTourStatusDropdown)}
        onToggleAssignmentStatusDropdown={() => tourData.setShowAssignmentStatusDropdown(!tourData.showAssignmentStatusDropdown)}
        onUpdateTourStatus={handleTourStatusUpdate}
        onUpdateAssignmentStatus={handleAssignmentStatusUpdate}
              getStatusColor={getStatusColor}
        getStatusText={getStatusText}
        getAssignmentStatusColor={getAssignmentStatusColor}
        getAssignmentStatusText={getAssignmentStatusText}
        onEditClick={() => setShowTourEditModal(true)}
        onCopyTour={handleCopyTour}
        onDeleteTour={handleDeleteTour}
        {...(tourData.isStaff && tourData.tour && isTourDeletedStatus(tourData.tour.tour_status)
          ? { onRestoreTour: handleRestoreTour }
          : {})}
        onPrintTourInfo={() => setShowTourPrintModal(true)}
        onPrintReceipts={() => setShowBatchReceiptModal(true)}
        onPrintTipEnvelopes={() => setEnvelopeModalVariant('tip')}
        onPrintBalanceEnvelopes={() => setEnvelopeModalVariant('balance')}
        {...(canSendGuideScheduleConfirm
          ? {
              onSendGuideScheduleConfirm: openGuideScheduleConfirmModal,
              onSendGuideScheduleAssignment: openGuideScheduleAssignmentModal,
            }
          : {})}
        {...(tourData.isStaff ? { onViewAssignmentHistory: openGuideAssignmentHistoryModal } : {})}
      />
      ) : null}

      {/* 영수증 일괄 인쇄: 픽업 스케줄/배정 관리와 동일한 목록 사용(assignedReservations 우선) */}
      {(() => {
        const fromAssigned = (tourData.assignedReservations || []).map((r: { id: string }) => r.id).filter(Boolean)
        const fromTour = normalizeReservationIds(tourData.tour?.reservation_ids)
        const receiptReservationIds = fromAssigned.length > 0 ? fromAssigned : fromTour
        return (
          <CustomerReceiptModal
            isOpen={showBatchReceiptModal}
            onClose={() => setShowBatchReceiptModal(false)}
            reservationId={receiptReservationIds[0] || ''}
            reservationIds={receiptReservationIds}
          />
        )
      })()}

      {/* 투어 봉투 일괄 인쇄 모달: 배정된 예약 목록 우선 사용 */}
      {(() => {
        const fromAssigned = (tourData.assignedReservations || []).map((r: { id: string }) => r.id).filter(Boolean)
        const fromTour = normalizeReservationIds(tourData.tour?.reservation_ids)
        const envelopeReservationIds = fromAssigned.length > 0 ? fromAssigned : fromTour
        return (
          <TourEnvelopeModal
            isOpen={envelopeModalVariant !== null}
            onClose={() => setEnvelopeModalVariant(null)}
            variant={envelopeModalVariant ?? 'tip'}
            reservationIds={envelopeReservationIds}
            tourDate={tourData.tour?.tour_date || ''}
            productNameKo={tourData.product?.name_ko || tourData.product?.name_en || ''}
            productNameEn={tourData.product?.name_en || tourData.product?.name_ko || ''}
            guideAndAssistantKo={[
              tourData.selectedGuide ? tourData.getTeamMemberNameForLocale(tourData.selectedGuide, 'ko') : null,
              tourData.selectedAssistant ? tourData.getTeamMemberNameForLocale(tourData.selectedAssistant, 'ko') : null,
            ].filter(Boolean).join(' & ') || '—'}
            guideAndAssistantEn={[
              tourData.selectedGuide ? tourData.getTeamMemberNameForLocale(tourData.selectedGuide, 'en') : null,
              tourData.selectedAssistant ? tourData.getTeamMemberNameForLocale(tourData.selectedAssistant, 'en') : null,
            ].filter(Boolean).join(' & ') || '—'}
            locale={locale}
          />
        )
      })()}

      {/* 투어 정보 인쇄 모달 (팀/픽업/부킹, Letter) */}
      <TourPrintModal
        isOpen={showTourPrintModal}
        onClose={() => setShowTourPrintModal(false)}
        locale={locale}
        tourDate={tourData.tour?.tour_date || ''}
        productNameKo={tourData.product?.name_ko || tourData.product?.name_en || ''}
        productNameEn={tourData.product?.name_en || tourData.product?.name_ko || ''}
        guideName={tourData.selectedGuide ? tourData.getTeamMemberName(tourData.selectedGuide) : null}
        teamType={tourData.teamType}
        secondMemberName={
          tourData.selectedAssistant ? tourData.getTeamMemberName(tourData.selectedAssistant) : null
        }
        vehicleLabel={tourData.selectedVehicleId ? getVehicleName(tourData.selectedVehicleId) : null}
        assignedReservations={tourData.assignedReservations}
        pickupHotels={tourData.pickupHotels}
        useRepresentativePickup={pickupResolveContext.useRepresentativePickup === true || !!pickupResolveContext.preset}
        pickupResolveContext={pickupResolveContext}
        getCustomerName={(customerId: string) => tourData.getCustomerName(customerId) || ''}
        ticketBookings={ticketBookings}
        tourHotelBookings={tourHotelBookings}
      />

      <GuideScheduleConfirmPreviewModal
        isOpen={showGuideScheduleConfirmModal}
        tourId={tourData.tour?.id ?? null}
        locale={locale}
        onClose={() => setShowGuideScheduleConfirmModal(false)}
      />

      <GuideScheduleAssignmentPreviewModal
        isOpen={showGuideScheduleAssignmentModal}
        tourId={tourData.tour?.id ?? null}
        locale={locale}
        onClose={() => setShowGuideScheduleAssignmentModal(false)}
      />

      <GuideScheduleAssignmentHistoryModal
        isOpen={showGuideAssignmentHistoryModal}
        onClose={() => setShowGuideAssignmentHistoryModal(false)}
        tourId={tourData.tour?.id ?? null}
        locale={locale}
        teamMembers={tourData.teamMembers.map((member: any) => ({
          email: member.email,
          name_ko: member.name_ko,
          nick_name: member.nick_name,
        }))}
        tourLabel={
          tourData.product
            ? `${locale === 'ko' ? tourData.product.name_ko : tourData.product.name_en || tourData.product.name_ko} · ${tourData.tour?.tour_date || ''}`
            : tourData.tour?.tour_date || null
        }
      />

      <TourDetailSectionChromeProvider compact={modalLightLoad}>
      <div className={modalLightLoad ? 'px-3 py-3 pb-4' : 'px-0 py-6 pb-24 lg:pb-6'}>
        {/* 4열 그리드 레이아웃 */}
        <div className={`grid grid-cols-1 lg:grid-cols-4 ${modalLightLoad ? 'gap-4' : 'gap-6'}`}>
          {/* 1열: 기본 정보, 픽업 스케줄, 옵션 관리 */}
          <div className={modalLightLoad ? 'space-y-4' : 'space-y-6'}>
            {/* 기본 정보 */}
            <div id="tour-info" className={scrollMt}>
              <TourInfo
              tour={tourData.tour}
              product={tourData.product}
              tourNote={tourData.tourNote}
              isPrivateTour={tourData.isPrivateTour}
              connectionStatus={{ tours: tourData.connectionStatus.tours }}
              params={{ locale }}
              onTourNoteChange={handleTourNoteChange}
              onPrivateTourToggle={handlePrivateTourToggle}
              onTourDateChange={handleTourDateChange}
              onTourTimeChange={handleTourTimeChange}
              onProductChange={handleTourProductUpdate}
              {...(modalLightLoad
                ? { compactForModal: true }
                : {
                    onMaxParticipantsChange: handleMaxParticipantsChange,
                    getStatusColor,
                    getStatusText,
                    getAssignmentStatusColor,
                    getAssignmentStatusText,
                    onUpdateTourStatus: handleTourStatusUpdate,
                    onUpdateAssignmentStatus: handleAssignmentStatusUpdate,
                  })}
            />
            </div>

        {/* 날씨 정보 섹션 */}
        <div id="tour-weather" className={scrollMt}>
          <div className="bg-white rounded-lg shadow-sm border">
            <div className={modalLightLoad ? 'p-3' : 'p-4'}>
              <TourWeather 
                    tourDate={tourData.tour.tour_date} 
                    {...(tourData.product?.id && { productId: tourData.product.id })}
              />
            </div>
          </div>
        </div>

        {/* 픽업 스케줄 */}
        <div id="pickup-schedule" className={scrollMt}>
          <PickupSchedule
              assignedReservations={tourData.assignedReservations.map((res: any) => ({
                ...res,
                tour_date: res.tour_date || tourData.tour?.tour_date
              }))}
              pickupHotels={tourData.pickupHotels}
              expandedSections={tourData.expandedSections}
              connectionStatus={{ reservations: tourData.connectionStatus.reservations }}
              onToggleSection={tourData.toggleSection}
          onAutoGenerate={() => {
            setShowPickupScheduleModal(true)
          }}
          onBatchSendNotification={handleBatchSendPickupScheduleNotifications}
          onPreviewEmail={() => {
            setShowEmailPreviewModal(true)
          }}
              getPickupHotelNameOnly={tourData.getPickupHotelNameOnly}
              getCustomerName={(customerId: string) => tourData.getCustomerName(customerId) || 'Unknown'}
              getCustomerLanguage={(customerId: string) => tourData.getCustomerLanguage(customerId) || ''}
          openGoogleMaps={openGoogleMaps}
              residentStatusIndicatorsEnabled={productShowsResidentStatusSectionByCode(
                tourData.product?.product_code != null
                  ? String(tourData.product.product_code)
                  : null
              )}
              useRepresentativePickup={
                !!tourData.tour?.pickup_group_preset_id ||
                tourData.tour?.use_representative_pickup === true
              }
              pickupPresets={pickupPresets}
              activePresetId={tourData.tour?.pickup_group_preset_id ?? null}
              activePreset={activePickupPreset}
              groupModeOverrides={pickupGroupModeOverrides}
              groupRepresentativeOverrides={pickupGroupRepresentativeOverrides}
              onPickupPresetChange={handlePickupPresetChange}
              onGroupModeOverrideChange={handleGroupModeOverrideChange}
              onGroupRepresentativeOverrideChange={handleGroupRepresentativeOverrideChange}
        />
        </div>

        {/* 투어 스케줄 섹션 */}
        <div id="tour-schedule" className={scrollMt}>
          <TourSchedule
              tour={tourData.tour}
              expandedSections={tourData.expandedSections}
              onToggleSection={tourData.toggleSection}
              locale="ko"
        />
        </div>

            {/* 옵션 관리 */}
            <div id="option-management" className={scrollMt}>
              <OptionManagement reservationIds={tourData.tour?.reservation_ids || []} />
            </div>
          </div>

          {/* 2열: 팀 구성 & 차량 배정, 배정 관리 */}
          <div className={modalLightLoad ? 'space-y-4' : 'space-y-6'}>
            {/* 팀 구성 & 차량 배정 통합 */}
            <div id="team-vehicle" className={scrollMt}>
              <TeamAndVehicleAssignment
              tourDate={tourData.tour?.tour_date}
              teamMembers={tourData.teamMembers.map((member: any) => ({
                id: member.email,
                name_ko: member.name_ko,
                nick_name: member.nick_name || null,
                email: member.email,
                position: member.position ?? 'guide',
                // DB is_active 반영 (없음·null은 예전 데이터 호환으로 활성 취급)
                is_active: member.is_active !== false
              }))}
              vehicles={tourData.vehicles}
              vehiclesLoading={tourData.vehiclesLoading}
              vehiclesError={tourData.vehiclesError}
              teamType={tourData.teamType}
              selectedGuide={tourData.selectedGuide}
              selectedAssistant={tourData.selectedAssistant}
              selectedVehicleId={tourData.selectedVehicleId}
              guideFee={guideFee}
              assistantFee={assistantFee}
              isGuideFeeFromTour={isGuideFeeFromTour}
              isAssistantFeeFromTour={isAssistantFeeFromTour}
              isGuideFeeFromDefault={isGuideFeeFromDefault}
              isAssistantFeeFromDefault={isAssistantFeeFromDefault}
              expandedSections={tourData.expandedSections}
              connectionStatus={{ 
                team: tourData.connectionStatus.team, 
                vehicles: tourData.connectionStatus.vehicles 
              }}
              onToggleSection={tourData.toggleSection}
              onTeamTypeChange={handleTeamTypeChange}
              onGuideSelect={handleGuideSelect}
              onAssistantSelect={handleAssistantSelect}
              onVehicleSelect={handleVehicleSelect}
              onGuideFeeChange={handleGuideFeeChange}
              onAssistantFeeChange={handleAssistantFeeChange}
              startMileage={startMileage}
              endMileage={endMileage}
              isMileageLoading={isMileageLoading}
              onStartMileageChange={setStartMileage}
              onEndMileageChange={setEndMileage}
              onSave={handleTeamAndVehicleSave}
              onLoadTeamMembersFallback={() => {}}
              onFetchVehicles={() => {}}
              getTeamMemberName={tourData.getTeamMemberName}
              getVehicleName={getVehicleName}
            />
            </div>

            {/* 배정 관리 */}
            <div id="assignment-management" className={scrollMt}>
              <AssignmentManagement
              assignedReservations={tourData.assignedReservations as any}
              pendingReservations={tourData.pendingReservations as any}
              otherToursAssignedReservations={tourData.otherToursAssignedReservations as any}
              otherStatusReservations={tourData.otherStatusReservations as any}
              expandedSections={tourData.expandedSections}
              loadingStates={tourData.loadingStates}
              isStaff={tourData.isStaff}
              onToggleSection={tourData.toggleSection}
              onAssignAllReservations={handleAssignAllReservations}
              onUnassignAllReservations={handleUnassignAllReservations}
              onEditReservationClick={handleEditReservationClick}
              onAssignReservation={handleAssignReservation}
              onUnassignReservation={handleUnassignReservation}
              onStatusChange={handleReservationStatusChange}
              onNavigateToTour={(targetTourId: string) => {
                if (onNavigateToTourProp) {
                  onNavigateToTourProp(targetTourId)
                  return
                }
                router.push(`/${locale}/admin/tours/${targetTourId}`)
              }}
              onEditPickupTime={handleEditReservationClick}
              onEditPickupHotel={handleEditReservationClick}
              getCustomerName={(customerId: string) => tourData.getCustomerName(customerId) || 'Unknown'}
              getCustomerLanguage={(customerId: string) => tourData.getCustomerLanguage(customerId) ?? 'Unknown'}
              onRefresh={async (updatedPickup) => {
                if (updatedPickup) {
                  tourData.setAssignedReservationsForced((prev: any) =>
                    prev.map((r: any) =>
                      r.id === updatedPickup.reservationId
                        ? { ...r, pickup_time: updatedPickup.pickup_time, pickup_hotel: updatedPickup.pickup_hotel }
                        : r
                    )
                  )
                  tourData.setPendingReservationsForced((prev: any) =>
                    prev.map((r: any) =>
                      r.id === updatedPickup.reservationId
                        ? { ...r, pickup_time: updatedPickup.pickup_time, pickup_hotel: updatedPickup.pickup_hotel }
                        : r
                    )
                  )
                }
                await tourData.refreshReservations()
              }}
              getChannelInfo={getChannelInfo}
              safeJsonParse={safeJsonParse}
              pickupHotels={tourData.pickupHotels}
              hasMultipleToursOnSameDay={(tourData.sameDayTourIds?.length ?? 0) >= 2}
              sameDayPeerTourIds={(tourData.sameDayTourIds || []).filter((id) => id !== tourData.tour?.id)}
              onMoveAssignedReservationToTour={handleMoveAssignedToOtherTour}
              currentTourId={tourData.tour?.id ?? ''}
              productId={tourData.tour?.product_id ?? null}
              tourDate={tourData.tour?.tour_date ?? null}
              onAutoAssignSuccess={tourData.refreshReservations}
              allProducts={tourData.allProducts ?? []}
              onCommunicationChannelChange={handleCommunicationChannelChange}
            />
            </div>
          </div>

          {/* 3열: 부킹 관리 */}
          <div className={modalLightLoad ? 'space-y-4' : 'space-y-6'}>
            {/* 부킹 관리 */}
            <div id="booking-management" className={scrollMt}>
              <BookingManagement
              ticketBookings={ticketBookings}
              tourHotelBookings={tourHotelBookings}
              loadingStates={tourData.loadingStates}
              connectionStatus={{ bookings: tourData.connectionStatus.bookings, hotelBookings: tourData.connectionStatus.hotelBookings }}
              isStaff={tourData.isStaff}
              onAddTicketBooking={handleAddTicketBooking}
              onBulkAddTicketBooking={handleBulkAddTicketBooking}
              onAddTourHotelBooking={handleAddTourHotelBooking}
              onEditTicketBooking={handleEditTicketBooking}
              onEditTourHotelBooking={handleEditTourHotelBooking}
              onRebookTourHotelBooking={handleRebookTourHotelBooking}
              onViewTourHotelBookingHistory={handleViewTourHotelBookingHistory}
            />
            </div>

            {/* 투어 채팅방 */}
            <div id="tour-chat" className={scrollMt}>
              <TourChat
              tour={tourData.tour}
              user={tourData.user}
              openChat={openChat}
            />
            </div>

            {/* 투어 사진 */}
            <div id="tour-photos" className={scrollMt}>
              <TourPhotos
              tour={tourData.tour}
              onPhotosUpdated={() => {
                console.log('Photos updated')
              }}
            />
            </div>
          </div>

        {/* 4열: 정산 관리 (재무 권한 보유자만) */}
        {hasPermission && hasPermission('canViewFinance') && (
          <div className={modalLightLoad ? 'space-y-4' : 'space-y-6'}>
            <div id="tour-finance" className={scrollMt}>
              <TourFinance
                 tour={tourData.tour}
                 connectionStatus={{ bookings: tourData.connectionStatus.bookings }}
                 userRole="admin"
                 userEmail={authUser?.email ?? null}
                 onExpenseUpdated={() => {
                   console.log('Expenses updated')
                 }}
                 onReservationClick={handleOpenReservationById}
               />
            </div>

             {/* 투어 리포트 섹션 */}
            <div id="tour-report" className={scrollMt}>
              <TourReport
                tour={tourData.tour}
                product={tourData.product}
                connectionStatus={{ bookings: tourData.connectionStatus.bookings }}
                isStaff={tourData.isStaff}
                userRole="admin"
                params={{ locale }}
            />
            </div>
          </div>
        )}
        </div>
      </div>
      </TourDetailSectionChromeProvider>

      {/* 모바일 플로팅 메뉴 */}
      {!modalLightLoad ? (
      <div className="lg:hidden fixed bottom-20 right-4 z-50">
        {/* 플로팅 메뉴 버튼 */}
        <button
          onClick={() => setShowFloatingMenu(!showFloatingMenu)}
          className="w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors flex items-center justify-center"
        >
          {showFloatingMenu ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* 플로팅 메뉴 드롭다운 */}
        {showFloatingMenu && (
          <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-xl border border-gray-200 max-h-[calc(70vh-80px)] overflow-y-auto w-48 mb-2">
            <div className="p-2 space-y-1">
              {[
                { id: 'tour-info', label: '기본정보', icon: Info },
                { id: 'tour-weather', label: '날씨', icon: Cloud },
                { id: 'pickup-schedule', label: '픽업 스케줄', icon: MapPin },
                { id: 'tour-schedule', label: '투어 스케줄', icon: Calendar },
                { id: 'option-management', label: '옵션 관리', icon: Settings },
                { id: 'team-vehicle', label: '팀/차량', icon: Users },
                { id: 'assignment-management', label: '배정 관리', icon: ClipboardList },
                { id: 'booking-management', label: '부킹 관리', icon: BookOpen },
                { id: 'tour-chat', label: '투어 채팅', icon: MessageSquare },
                { id: 'tour-photos', label: '투어 사진', icon: Camera },
                ...(hasPermission && hasPermission('canViewFinance') ? [
                  { id: 'tour-finance', label: '정산 관리', icon: DollarSign },
                  { id: 'tour-report', label: '투어 리포트', icon: FileText }
                ] : [])
              ].map((section) => {
                const Icon = section.icon
                const isActive = activeSection === section.id
                
                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      const element = document.getElementById(section.id)
                      const scrollRoot = modalLightLoad
                        ? document.querySelector<HTMLElement>('[data-tour-detail-modal-scroll]')
                        : null
                      if (element) {
                        if (scrollRoot) {
                          const rootTop = scrollRoot.getBoundingClientRect().top
                          const targetTop =
                            element.getBoundingClientRect().top - rootTop + scrollRoot.scrollTop - 16
                          scrollRoot.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
                        } else {
                          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }
                        setActiveSection(section.id)
                        setShowFloatingMenu(false)
                      }
                    }}
                    className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                      isActive
                        ? 'bg-primary/5 text-primary font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-primary' : 'text-gray-500'} />
                    <span>{section.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
      ) : null}

      {/* 모달들 */}
      {tourData.selectedReservation && (
        <PickupTimeModal
          isOpen={tourData.showTimeModal}
          selectedReservation={tourData.selectedReservation}
          pickupTimeValue={tourData.pickupTimeValue}
          onTimeChange={tourData.setPickupTimeValue}
          onSave={handleSavePickupTime}
          onCancel={handleCancelEditPickupTime}
          getCustomerName={(customerId: string) => tourData.getCustomerName(customerId) || 'Unknown'}
          getCustomerLanguage={(customerId: string) => tourData.getCustomerLanguage(customerId) || 'Unknown'}
          getPickupHotelName={tourData.getPickupHotelName}
          getCountryCode={tourData.getCountryCode}
        />
      )}

      <PickupHotelModal
        isOpen={tourData.showPickupHotelModal}
        selectedReservation={tourData.selectedReservationForHotelChange}
        hotelSearchTerm={tourData.hotelSearchTerm}
        filteredHotels={filteredHotels}
        onSearchChange={tourData.setHotelSearchTerm}
        onHotelSelect={handleSavePickupHotel}
        onCancel={handleCancelEditPickupHotel}
        getCustomerName={(customerId: string) => tourData.getCustomerName(customerId) || 'Unknown'}
      />

      <PrivateTourModal
        isOpen={tourData.showPrivateTourModal}
        pendingValue={tourData.pendingPrivateTourValue}
        onConfirm={handlePrivateTourConfirm}
        onCancel={() => tourData.setShowPrivateTourModal(false)}
      />

      {/* 예약 편집 모달 */}
      {editingReservation && (
        <ReservationFormAny
          reservation={editingReservation}
          customers={tourData.customers}
          products={tourData.allProducts}
          channels={tourData.channels}
          productOptions={reservationFormData.productOptions}
          options={reservationFormData.options}
          pickupHotels={tourData.pickupHotels}
          coupons={reservationFormData.coupons}
          useServerCustomerInsert
          modalStackLevel="nested"
          modalRectStorageKey={RESERVATION_EDIT_MODAL_RECT_KEY}
          titleAction={
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setShowEditReceiptModal(true)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                title={locale === 'ko' ? '영수증 인쇄' : 'Print receipt'}
              >
                <Printer className="w-5 h-5" />
              </button>
              <div className="hidden sm:block h-6 w-px bg-gray-200 shrink-0" aria-hidden />
              <ReservationFormEmailSendButtons
                reservation={editingReservation}
                customers={tourData.customers as Customer[]}
                sentBy={authUser?.email ?? null}
                uiLocale={locale === 'en' ? 'en' : 'ko'}
              />
              <ReservationFormSmsSendButton
                reservation={editingReservation}
                customers={tourData.customers as Customer[]}
                sentBy={authUser?.email ?? null}
                uiLocale={locale === 'en' ? 'en' : 'ko'}
              />
            </div>
          }
          onSubmit={async (reservationData: any) => {
            try {
              const fullPayload = toReservationUpdatePayload(reservationData)
              const result = await updateReservation(editingReservation.id, fullPayload)
              if (!result.success) {
                alert('예약 수정 중 오류가 발생했습니다: ' + (result.error ?? ''))
                return
              }
              await tourData.refreshReservations()
              handleCloseEditModal()
              alert('예약이 성공적으로 수정되었습니다!')
            } catch (error) {
              console.error('Error updating reservation:', error)
              alert('예약 수정 중 오류가 발생했습니다.')
            }
          }}
          onCancel={handleCloseEditModal}
          onRefreshCustomers={async () => {
            const customerId =
              editingReservation?.customerId ||
              (editingReservation as { customer_id?: string | null })?.customer_id
            await refreshCustomerInList(customerId, tourData.setCustomers)
          }}
          onDelete={async () => {
            if (confirm('정말 이 예약을 삭제하시겠습니까?')) {
              try {
                const { error } = await supabase
                  .from('reservations')
                  .delete()
                  .eq('id', editingReservation.id)

                if (error) {
                  console.error('Error deleting reservation:', error)
                  alert('예약 삭제 중 오류가 발생했습니다: ' + error.message)
                  return
                }

                // 예약 목록 새로고침
                await tourData.refreshReservations()
                handleCloseEditModal()
                alert('예약이 성공적으로 삭제되었습니다!')
              } catch (error) {
                console.error('Error deleting reservation:', error)
                alert('예약 삭제 중 오류가 발생했습니다.')
              }
            }
          }}
          />
      )}

      {/* 예약 편집 모달에서 열리는 영수증 인쇄 모달 */}
      {editingReservation && (
        <CustomerReceiptModal
          isOpen={showEditReceiptModal}
          onClose={() => setShowEditReceiptModal(false)}
          reservationId={editingReservation.id}
        />
      )}

      {/* 차량 배정 모달 */}
      {tourData.showVehicleAssignment && tourData.tour && (
        <VehicleAssignmentModal
          tourId={tourData.tour?.id || ''}
          tourDate={tourData.tour?.tour_date || ''}
          onClose={() => tourData.setShowVehicleAssignment(false)}
          onAssignmentComplete={() => {
            // 차량 배정 완료 후 데이터 새로고침
            if (tourData.tour) {
              // fetchTourData(tourData.tour.id)
            }
          }}
        />
      )}

      {/* 입장권 부킹 폼 모달 */}
      <BookingModal
        isOpen={showTicketBookingForm}
        title={editingTicketBooking ? (locale === 'ko' ? '입장권 부킹 수정' : 'Edit Ticket Booking') : (locale === 'ko' ? '새 입장권 부킹' : 'New Ticket Booking')}
        onClose={handleCloseTicketBookingForm}
      >
        {showTicketBookingForm && tourData.tour && (
            <TicketBookingFormAny
              key={editingTicketBooking?.id ?? 'new'}
              booking={editingTicketBooking || undefined}
              tourId={tourData.tour?.id || ''}
              onSave={(b: any) => handleBookingSubmit(b as unknown as LocalTicketBooking, 'ticket')}
              onCancel={handleCloseTicketBookingForm}
              isSuper={isSuper}
              canRequestSoftDelete={canRequestTicketBookingSoftDeleteUi}
              onRequestDelete={handleRequestTicketBookingDelete}
              onDelete={isSuper ? handleActualTicketBookingDelete : undefined}
            />
      )}
      </BookingModal>

      <TicketBookingBulkAddModal
        open={showTicketBookingBulkAdd}
        onClose={() => setShowTicketBookingBulkAdd(false)}
        tourId={tourData.tour?.id ?? null}
        defaultSubmittedBy={authUser?.email ?? ''}
        onSuccess={async () => {
          await loadBookings()
        }}
      />

      {/* 투어 호텔 부킹 폼 모달 */}
      <BookingModal
        isOpen={showTourHotelBookingForm}
        title=""
        suppressHeader
        onClose={handleCloseTourHotelBookingForm}
      >
        {showTourHotelBookingForm && tourData.tour && (
              <TourHotelBookingFormAny
                key={editingTourHotelBooking?.id ?? replacesBookingId ?? 'new-hotel'}
                booking={editingTourHotelBooking || undefined}
                seedBooking={!editingTourHotelBooking && hotelBookingSeed ? hotelBookingSeed : undefined}
                replacesBookingId={replacesBookingId ?? undefined}
            tourId={tourData.tour?.id || ''}
            defaultTourDate={tourData.tour?.tour_date || ''}
            modalTitle={
              editingTourHotelBooking
                ? locale === 'ko'
                  ? '투어 호텔 부킹 수정'
                  : 'Edit Tour Hotel Booking'
                : replacesBookingId
                  ? locale === 'ko'
                    ? '새 호텔 부킹 (가격 변경)'
                    : 'New hotel booking (price change)'
                  : locale === 'ko'
                    ? '새 투어 호텔 부킹'
                    : 'New Tour Hotel Booking'
            }
            showHeaderClose
                onSave={(b: any) => handleBookingSubmit(b as unknown as LocalTourHotelBooking, 'hotel')}
                onCancel={handleCloseTourHotelBookingForm}
              />
        )}
      </BookingModal>

      {hotelBookingHistoryId ? (
        <BookingHistory
          bookingType="hotel"
          bookingId={hotelBookingHistoryId}
          onClose={() => setHotelBookingHistoryId(null)}
        />
      ) : null}

      {/* 픽업 스케줄 자동 생성 모달 */}
      {tourData.tour && (
        <PickupScheduleAutoGenerateModal
          isOpen={showPickupScheduleModal}
          tourDate={tourData.tour.tour_date}
          productId={tourData.tour.product_id ?? tourData.product?.id ?? null}
          assignedReservations={tourData.assignedReservations}
          pickupHotels={tourData.pickupHotels as any}
          onClose={() => setShowPickupScheduleModal(false)}
          onSave={handleSavePickupSchedule}
          getCustomerName={(customerId: string) => tourData.getCustomerName(customerId) || 'Unknown'}
          useRepresentativePickup={
            !!tourData.tour.pickup_group_preset_id ||
            tourData.tour.use_representative_pickup === true
          }
          pickupResolveContext={pickupResolveContext}
        />
      )}

      {/* 픽업 스케줄 이메일 미리보기 모달 */}
      {tourData.tour && (
        <PickupScheduleEmailPreviewModal
          isOpen={showEmailPreviewModal}
          onClose={() => setShowEmailPreviewModal(false)}
          reservations={tourData.assignedReservations.map((res: any) => ({
            id: res.id,
            customer_id: res.customer_id,
            pickup_time: res.pickup_time,
            tour_date: res.tour_date || tourData.tour?.tour_date
          }))}
          tourDate={tourData.tour.tour_date}
          tourId={tourData.tour.id}
          onSend={handleBatchSendPickupScheduleNotifications}
        />
      )}

      {/* 투어 편집 모달 */}
      {tourData.tour && (
        <TourEditModal
          isOpen={showTourEditModal}
          tour={{
            id: tourData.tour.id,
            product_id: tourData.tour.product_id || ''
          }}
          currentProduct={tourData.product}
          locale={locale}
          onClose={() => setShowTourEditModal(false)}
          onSave={handleTourProductUpdate}
        />
      )}
      <CancellationReasonModal
        isOpen={cancellationReasonModalOpen}
        locale={locale}
        initialValue={cancellationReasonValue}
        saving={cancellationReasonSaving}
        onClose={closeCancellationReasonModal}
        onSubmit={submitCancellationReasonModal}
      />
    </div>
    </>
  )
}