/* @ts-nocheck */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import ReservationForm from '@/components/reservation/ReservationForm'
import VehicleAssignmentModal from '@/components/VehicleAssignmentModal'
import TicketBookingForm from '@/components/booking/TicketBookingForm'
import TourHotelBookingForm from '@/components/booking/TourHotelBookingForm'
import TourWeather from '@/components/TourWeather'
import { useAuth } from '@/contexts/AuthContext'
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
import PickupTimeModal from '@/components/tour/modals/PickupTimeModal'
import PickupHotelModal from '@/components/tour/modals/PickupHotelModal'
import PrivateTourModal from '@/components/tour/modals/PrivateTourModal'
import BookingModal from '@/components/tour/modals/BookingModal'
import PickupScheduleAutoGenerateModal from '@/components/tour/modals/PickupScheduleAutoGenerateModal'
import PickupScheduleEmailPreviewModal from '@/components/tour/modals/PickupScheduleEmailPreviewModal'
import TourEditModal from '@/components/tour/modals/TourEditModal'
import CustomerReceiptModal from '@/components/receipt/CustomerReceiptModal'
import TourEnvelopeModal from '@/components/receipt/TourEnvelopeModal'
import { useTourDetailData } from '@/hooks/useTourDetailData'
import { useTourHandlers } from '@/hooks/useTourHandlers'
import { 
  getStatusColor,
  getStatusText,
  getAssignmentStatusColor,
  getAssignmentStatusText,
  tourStatusOptions,
  assignmentStatusOptions,
  openGoogleMaps,
  safeJsonParse
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
  X
} from 'lucide-react'

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
}

type LocalTourHotelBooking = {
  id: string
  reservation_id?: string | null
  status?: string | null
  hotel?: string | null
  room_type?: string | null
  rooms?: number | null
  check_in_date?: string | null
  check_out_date?: string | null
  rn_number?: string | null
  booking_reference?: string | null
}

// 외부 폼 컴포넌트의 엄격한 타입 충돌을 피하기 위한 any 캐스팅 래퍼
const ReservationFormAny = ReservationForm as any
const TicketBookingFormAny = TicketBookingForm as any
const TourHotelBookingFormAny = TourHotelBookingForm as any

export default function TourDetailPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('tours')
  
  const { hasPermission, loading } = useAuth()
  const { openChat } = useFloatingChat()

  // 커스텀 훅으로 데이터와 상태 관리
  const tourData = useTourDetailData()
  const tourHandlers = useTourHandlers()
  
  // 부킹 관련 상태 (로컬 상태로 유지)
  const [ticketBookings, setTicketBookings] = useState<LocalTicketBooking[]>([])
  const [tourHotelBookings, setTourHotelBookings] = useState<LocalTourHotelBooking[]>([])
  const [showTicketBookingForm, setShowTicketBookingForm] = useState<boolean>(false)
  const [showTourHotelBookingForm, setShowTourHotelBookingForm] = useState<boolean>(false)
  const [editingTicketBooking, setEditingTicketBooking] = useState<LocalTicketBooking | null>(null)
  const [editingTourHotelBooking, setEditingTourHotelBooking] = useState<LocalTourHotelBooking | null>(null)
  const [showTicketBookingDetails, setShowTicketBookingDetails] = useState<boolean>(false)
  const [editingReservation, setEditingReservation] = useState<any>(null)
  const [showPickupScheduleModal, setShowPickupScheduleModal] = useState<boolean>(false)
  const [showEmailPreviewModal, setShowEmailPreviewModal] = useState<boolean>(false)
  const [showTourEditModal, setShowTourEditModal] = useState<boolean>(false)
  const [showBatchReceiptModal, setShowBatchReceiptModal] = useState<boolean>(false)
  const [envelopeModalVariant, setEnvelopeModalVariant] = useState<'tip' | 'balance' | null>(null)
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

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100 // 헤더 높이 고려

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i])
        if (section) {
          const offsetTop = section.offsetTop
          if (scrollPosition >= offsetTop) {
            setActiveSection(sections[i])
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // 초기 실행

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  
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
      tourData.setTour(prev => prev ? { ...prev, is_private_tour: tourData.pendingPrivateTourValue } : null)
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
    tourData.setTour(prev => {
      if (!prev) return null
      console.log('로컬 상태 업데이트:', { 이전: prev.tour_status, 새: status })
      return { ...prev, tour_status: status }
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
    tourData.setTour(prev => {
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
      tourData.setTour(prev => prev ? { ...prev, team_type: type } : null)
      
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
      tourData.setTour(prev => prev ? { ...prev, tour_date: date } : null)
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
      tourData.setTour(prev => prev ? { ...prev, tour_start_datetime: datetime } : null)
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
        setTicketBookings(ticketBookingsData || [])
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
    if (!tourData.tour?.id) return

    try {
      const { data: tour, error } = await supabase
        .from('tours')
        .select('guide_fee, assistant_fee')
        .eq('id', tourData.tour.id)
        .single()

      if (error) {
        console.error('투어 수수료 로드 오류:', error)
        return
      }

      if (tour) {
        // 저장된 수수료가 있으면 사용
        const tourData = tour as { 
          guide_fee: number | null; 
          assistant_fee: number | null; 
        }
        if (tourData.guide_fee !== null && tourData.guide_fee !== undefined) {
          setGuideFee(tourData.guide_fee)
          setIsGuideFeeFromTour(true)
        }
        if (tourData.assistant_fee !== null && tourData.assistant_fee !== undefined) {
          setAssistantFee(tourData.assistant_fee)
          setIsAssistantFeeFromTour(true)
        }
        console.log('투어 수수료 로드됨:', tourData)
      }
    } catch (error) {
      console.error('투어 수수료 로드 오류:', error)
    }
  }, [tourData.tour?.id])

  // 가이드비 관리에서 기본값 로드 (팀 타입별)
  const loadGuideCosts = useCallback(async () => {
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
  }, [tourData.tour?.product_id, tourData.teamType, tourData.tour?.team_type, isGuideFeeFromTour, isAssistantFeeFromTour])

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
      const updateData: any = {
        team_type: tourData.teamType,
        guide_fee: guideFee,
        assistant_fee: assistantFee
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

      // 차량 배정
      if (tourData.selectedVehicleId) {
        updateData.tour_car_id = tourData.selectedVehicleId
      }

      const { error } = await (supabase as any)
        .from('tours')
        .update(updateData)
        .eq('id', tourData.tour.id)

      if (error) {
        console.error('팀 구성 및 차량 배정 저장 오류:', error)
        alert(t('detail.saveError'))
        return
      }

      // 상태 업데이트
      setIsGuideFeeFromTour(true)
      setIsAssistantFeeFromTour(true)
      setIsGuideFeeFromDefault(false)
      setIsAssistantFeeFromDefault(false)

      // 투어 데이터 업데이트
      tourData.setTour(prev => prev ? { ...prev, ...updateData } : null)

      console.log('팀 구성 및 차량 배정 저장 완료:', updateData)
      alert(t('detail.saveSuccess'))
    } catch (error) {
      console.error('팀 구성 및 차량 배정 저장 오류:', error)
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
    
    return `${vehicle.vehicle_number || t('detail.noNumber')} - ${vehicle.vehicle_type || t('detail.noType')}`
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
      setEndMileage(startMileageValue) // 종료 마일리지는 시작 마일리지로 초기화

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
    if (tourData.tour?.product_id && tourData.teamType && tourData.tour?.team_type) {
      console.log('팀 타입 로딩 완료, 가이드 수수료 로딩 시작:', {
        teamType: tourData.teamType,
        tourTeamType: tourData.tour.team_type,
        isGuideFeeFromTour,
        isAssistantFeeFromTour
      })
      
      // teamType과 tour.team_type이 일치하는지 확인
      if (tourData.teamType !== tourData.tour.team_type) {
        console.log('⚠️ 팀 타입 불일치 감지, 기본값 로드하지 않음:', {
          localTeamType: tourData.teamType,
          tourTeamType: tourData.tour.team_type
        })
        return
      }
      
      // 저장된 수수료가 없을 때만 기본값 로드
      if (!isGuideFeeFromTour && !isAssistantFeeFromTour) {
        setTimeout(() => {
          loadGuideCosts()
        }, 100)
      } else {
        console.log('저장된 수수료가 있으므로 기본값 로드하지 않음')
      }
    }
  }, [tourData.tour?.product_id, tourData.teamType, tourData.tour?.team_type, loadGuideCosts, isGuideFeeFromTour, isAssistantFeeFromTour])


  const handleAssignReservation = async (reservationId: string) => {
    if (!tourData.tour) return
    const updatedReservationIds = await tourHandlers.handleAssignReservation({
      ...tourData.tour
    }, reservationId)
    if (updatedReservationIds) {
      const reservation = tourData.pendingReservations.find((r: any) => r.id === reservationId)
      if (reservation) {
        tourData.setAssignedReservations([...tourData.assignedReservations, reservation])
        tourData.setPendingReservations(tourData.pendingReservations.filter((r: any) => r.id !== reservationId))
        tourData.setTour(prev => prev ? { ...prev, reservation_ids: updatedReservationIds } : null)
        // 예약 목록 새로고침
        if (tourData.refreshReservations) {
          await tourData.refreshReservations()
        }
      }
    }
  }

  const handleUnassignReservation = async (reservationId: string) => {
    if (!tourData.tour) return
    const updatedReservationIds = await tourHandlers.handleUnassignReservation({
      ...tourData.tour,
      reservation_ids: tourData.tour.reservation_ids || []
    }, reservationId)
    if (updatedReservationIds) {
      const reservation = tourData.assignedReservations.find((r: any) => r.id === reservationId)
      if (reservation) {
        tourData.setPendingReservations([...tourData.pendingReservations, reservation])
        tourData.setAssignedReservations(tourData.assignedReservations.filter((r: any) => r.id !== reservationId))
        tourData.setTour(prev => prev ? { ...prev, reservation_ids: updatedReservationIds } : null)
      }
    }
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
      tourData.setTour(prev => prev ? { ...prev, reservation_ids: updatedReservationIds } : null)
    }
  }

  const handleUnassignAllReservations = async () => {
    if (!tourData.tour) return
    const updatedReservationIds = await tourHandlers.handleUnassignAllReservations(tourData.tour)
    if (updatedReservationIds) {
      tourData.setPendingReservations([...tourData.pendingReservations, ...tourData.assignedReservations])
      tourData.setAssignedReservations([])
      tourData.setTour(prev => prev ? { ...prev, reservation_ids: updatedReservationIds } : null)
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

          const response = await fetch('/api/send-pickup-schedule-notification', {
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

  // 픽업 스케줄 자동 생성 저장 핸들러
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
      status: (reservation.status as 'pending' | 'confirmed' | 'completed' | 'cancelled') || 'pending',
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

  const handleEditTicketBooking = async (booking: LocalTicketBooking) => {
    setEditingTicketBooking(booking)
    setShowTicketBookingForm(true)
    // 부킹 데이터 새로고침
    await loadBookings()
  }

  const handleCloseTicketBookingForm = async () => {
    setShowTicketBookingForm(false)
    setEditingTicketBooking(null)
    // 부킹 데이터 새로고침
    await loadBookings()
  }

  const handleAddTourHotelBooking = async () => {
    setEditingTourHotelBooking(null)
    setShowTourHotelBookingForm(true)
    // 부킹 데이터 새로고침
    await loadBookings()
  }

  const handleEditTourHotelBooking = async (booking: LocalTourHotelBooking) => {
    setEditingTourHotelBooking(booking)
    setShowTourHotelBookingForm(true)
    // 부킹 데이터 새로고침
    await loadBookings()
  }

  const handleCloseTourHotelBookingForm = async () => {
    setShowTourHotelBookingForm(false)
    setEditingTourHotelBooking(null)
    // 부킹 데이터 새로고침
    await loadBookings()
  }

  const handleBookingSubmit = async (booking: LocalTicketBooking | LocalTourHotelBooking) => {
    if (tourData.tour) {
      // 부킹 데이터 새로고침
      await loadBookings()
    }
    console.log('부킹이 저장되었습니다:', booking)
  }

  // 필터링된 입장권 부킹 계산
  // showTicketBookingDetails가 false일 때는 company별로 ea를 합산한 결과만 보여줌
  const filteredTicketBookings = useMemo(() => {
    if (showTicketBookingDetails) {
      // 상세 보기: 모든 부킹을 그대로 표시
      return ticketBookings
    } else {
      // 간단 보기: company별로 ea를 합산
      const companyMap = new Map<string, {
        company: string
        totalEa: number
        bookings: LocalTicketBooking[]
      }>()
      
      ticketBookings.forEach(booking => {
        const company = booking.company || 'Unknown'
        const ea = booking.ea || 0
        
        if (!companyMap.has(company)) {
          companyMap.set(company, {
            company,
            totalEa: 0,
            bookings: []
          })
        }
        
        const companyData = companyMap.get(company)!
        companyData.totalEa += ea
        companyData.bookings.push(booking)
      })
      
      // 합산된 결과를 booking 형태로 변환 (표시용)
      return Array.from(companyMap.values()).map((companyData, index) => ({
        id: `aggregated-${companyData.company}-${index}`,
        company: companyData.company,
        ea: companyData.totalEa,
        status: null,
        reservation_id: null,
        category: null,
        time: null,
        rn_number: null
      } as LocalTicketBooking))
    }
  }, [ticketBookings, showTicketBookingDetails])

  // 로딩 중이거나 권한이 없을 때 로딩 화면 표시
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  // 권한이 없을 때는 리다이렉트 중이므로 빈 화면 표시
  if (!tourData.isStaff) {
    return null
  }

  if (tourData.pageLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* 헤더 스켈레톤 */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-2 sm:px-6 py-2 sm:py-4">
            <div className="flex items-center space-x-4">
              <SkeletonCard className="w-8 h-8" />
              <div className="flex-1">
                <SkeletonCard className="h-6 w-64 mb-2" />
                <div className="flex gap-2">
                  <SkeletonCard className="h-4 w-20" />
                  <SkeletonCard className="h-4 w-24" />
                  <SkeletonCard className="h-4 w-16" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 메인 콘텐츠 스켈레톤 */}
        <div className="px-2 sm:px-6 py-4">
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

  if (!tourData.tour) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('detail.tourNotFound')}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <TourHeader
        tour={tourData.tour}
        product={tourData.product}
        params={{ locale }}
        showTourStatusDropdown={tourData.showTourStatusDropdown}
        showAssignmentStatusDropdown={tourData.showAssignmentStatusDropdown}
              tourStatusOptions={tourStatusOptions}
              assignmentStatusOptions={assignmentStatusOptions}
        getTotalAssignedPeople={tourData.getTotalAssignedPeople}
        getTotalPeopleFiltered={tourData.getTotalPeopleFiltered}
        getTotalPeopleAll={tourData.getTotalPeopleAll}
        onToggleTourStatusDropdown={() => tourData.setShowTourStatusDropdown(!tourData.showTourStatusDropdown)}
        onToggleAssignmentStatusDropdown={() => tourData.setShowAssignmentStatusDropdown(!tourData.showAssignmentStatusDropdown)}
        onUpdateTourStatus={handleTourStatusUpdate}
        onUpdateAssignmentStatus={handleAssignmentStatusUpdate}
              getStatusColor={getStatusColor}
        getStatusText={getStatusText}
        getAssignmentStatusColor={getAssignmentStatusColor}
        getAssignmentStatusText={getAssignmentStatusText}
        onEditClick={() => setShowTourEditModal(true)}
        onPrintReceipts={() => setShowBatchReceiptModal(true)}
        onPrintTipEnvelopes={() => setEnvelopeModalVariant('tip')}
        onPrintBalanceEnvelopes={() => setEnvelopeModalVariant('balance')}
      />

      {/* 영수증 일괄 인쇄 모달 */}
      <CustomerReceiptModal
        isOpen={showBatchReceiptModal}
        onClose={() => setShowBatchReceiptModal(false)}
        reservationId={tourData.tour?.reservation_ids?.[0] || ''}
        reservationIds={(tourData.tour?.reservation_ids || []).filter(Boolean)}
      />

      {/* 투어 봉투 일괄 인쇄 모달 (팁 봉투 / Balance 봉투) */}
      <TourEnvelopeModal
        isOpen={envelopeModalVariant !== null}
        onClose={() => setEnvelopeModalVariant(null)}
        variant={envelopeModalVariant ?? 'tip'}
        reservationIds={(tourData.tour?.reservation_ids || []).filter(Boolean)}
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

      <div className="px-0 py-6 pb-24 lg:pb-6">
        {/* 4열 그리드 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 1열: 기본 정보, 픽업 스케줄, 옵션 관리 */}
          <div className="space-y-6">
            {/* 기본 정보 */}
            <div id="tour-info" className="scroll-mt-20">
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
              getStatusColor={getStatusColor}
              getStatusText={getStatusText}
              getAssignmentStatusColor={getAssignmentStatusColor}
              getAssignmentStatusText={getAssignmentStatusText}
              onUpdateTourStatus={handleTourStatusUpdate}
              onUpdateAssignmentStatus={handleAssignmentStatusUpdate}
              assignedReservations={tourData.assignedReservations}
            />
            </div>

        {/* 날씨 정보 섹션 */}
        <div id="tour-weather" className="scroll-mt-20">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4">
              <TourWeather 
                    tourDate={tourData.tour.tour_date} 
                    {...(tourData.product?.id && { productId: tourData.product.id })}
              />
            </div>
          </div>
        </div>

        {/* 픽업 스케줄 */}
        <div id="pickup-schedule" className="scroll-mt-20">
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
        />
        </div>

        {/* 투어 스케줄 섹션 */}
        <div id="tour-schedule" className="scroll-mt-20">
          <TourSchedule
              tour={tourData.tour}
              expandedSections={tourData.expandedSections}
              onToggleSection={tourData.toggleSection}
              locale="ko"
        />
        </div>

            {/* 옵션 관리 */}
            <div id="option-management" className="scroll-mt-20">
              <OptionManagement reservationIds={tourData.tour?.reservation_ids || []} />
            </div>
          </div>

          {/* 2열: 팀 구성 & 차량 배정, 배정 관리 */}
          <div className="space-y-6">
            {/* 팀 구성 & 차량 배정 통합 */}
            <div id="team-vehicle" className="scroll-mt-20">
              <TeamAndVehicleAssignment
              teamMembers={tourData.teamMembers.map((member: any) => ({
                id: member.email,
                name_ko: member.name_ko,
                nick_name: member.nick_name || null,
                email: member.email,
                position: member.position ?? 'guide',
                is_active: member.is_active ?? true
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
            <div id="assignment-management" className="scroll-mt-20">
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
              onReassignFromOtherTour={() => {}}
              onNavigateToTour={(tourId: string) => {
                router.push(`/${locale}/admin/tours/${tourId}`)
              }}
              onEditPickupTime={handleEditReservationClick}
              onEditPickupHotel={handleEditReservationClick}
              getCustomerName={(customerId: string) => tourData.getCustomerName(customerId) || 'Unknown'}
              getCustomerLanguage={(customerId: string) => tourData.getCustomerLanguage(customerId) ?? 'Unknown'}
              onRefresh={async (updatedPickup) => {
                if (updatedPickup) {
                  tourData.setAssignedReservations((prev: any) =>
                    prev.map((r: any) =>
                      r.id === updatedPickup.reservationId
                        ? { ...r, pickup_time: updatedPickup.pickup_time, pickup_hotel: updatedPickup.pickup_hotel }
                        : r
                    )
                  )
                  tourData.setPendingReservations((prev: any) =>
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
              currentTourId={tourData.tour?.id ?? ''}
              productId={tourData.tour?.product_id ?? null}
              tourDate={tourData.tour?.tour_date ?? null}
              onAutoAssignSuccess={tourData.refreshReservations}
            />
            </div>
          </div>

          {/* 3열: 부킹 관리 */}
          <div className="space-y-6">
            {/* 부킹 관리 */}
            <div id="booking-management" className="scroll-mt-20">
              <BookingManagement
              ticketBookings={ticketBookings}
              tourHotelBookings={tourHotelBookings}
              filteredTicketBookings={filteredTicketBookings}
              showTicketBookingDetails={showTicketBookingDetails}
              loadingStates={tourData.loadingStates}
              connectionStatus={{ bookings: tourData.connectionStatus.bookings, hotelBookings: tourData.connectionStatus.hotelBookings }}
              isStaff={tourData.isStaff}
              onAddTicketBooking={handleAddTicketBooking}
              onAddTourHotelBooking={handleAddTourHotelBooking}
              onEditTicketBooking={handleEditTicketBooking}
              onEditTourHotelBooking={handleEditTourHotelBooking}
              onToggleTicketBookingDetails={() => setShowTicketBookingDetails(!showTicketBookingDetails)}
            />
            </div>

            {/* 투어 채팅방 */}
            <div id="tour-chat" className="scroll-mt-20">
              <TourChat
              tour={tourData.tour}
              user={tourData.user}
              openChat={openChat}
            />
            </div>

            {/* 투어 사진 */}
            <div id="tour-photos" className="scroll-mt-20">
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
          <div className="space-y-6">
            <div id="tour-finance" className="scroll-mt-20">
              <TourFinance
                 tour={tourData.tour}
                 connectionStatus={{ bookings: tourData.connectionStatus.bookings }}
                 userRole="admin"
                 onExpenseUpdated={() => {
                   console.log('Expenses updated')
                 }}
                 onReservationClick={handleOpenReservationById}
               />
            </div>

             {/* 투어 리포트 섹션 */}
            <div id="tour-report" className="scroll-mt-20">
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

      {/* 모바일 플로팅 메뉴 */}
      <div className="lg:hidden fixed bottom-20 right-4 z-50">
        {/* 플로팅 메뉴 버튼 */}
        <button
          onClick={() => setShowFloatingMenu(!showFloatingMenu)}
          className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
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
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        setActiveSection(section.id)
                        setShowFloatingMenu(false)
                      }
                    }}
                    className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-blue-600' : 'text-gray-500'} />
                    <span>{section.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

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
          onSubmit={async (reservationData: any) => {
            try {
              // camelCase를 snake_case로 변환
              const dbReservationData = {
                customer_id: reservationData.customerId,
                product_id: reservationData.productId,
                tour_date: reservationData.tourDate,
                tour_time: reservationData.tourTime || null,
                event_note: reservationData.eventNote,
                pickup_hotel: reservationData.pickUpHotel,
                pickup_time: reservationData.pickUpTime || null,
                adults: reservationData.adults,
                child: reservationData.child,
                infant: reservationData.infant,
                total_people: reservationData.totalPeople,
                channel_id: reservationData.channelId,
                channel_rn: reservationData.channelRN,
                added_by: reservationData.addedBy,
                tour_id: reservationData.tourId || editingReservation.tourId || null,
                status: reservationData.status,
                selected_options: reservationData.selectedOptions,
                selected_option_prices: reservationData.selectedOptionPrices,
                is_private_tour: reservationData.isPrivateTour || false,
                choices: reservationData.choices
              }

              const { error } = await supabase
                .from('reservations')
                .update(dbReservationData)
                .eq('id', editingReservation.id)

              if (error) {
                console.error('Error updating reservation:', error)
                alert('예약 수정 중 오류가 발생했습니다: ' + error.message)
                return
              }

              // 새로운 초이스 시스템: reservation_choices 테이블에 저장
              if (reservationData.choices && reservationData.choices.required && Array.isArray(reservationData.choices.required)) {
                // 기존 reservation_choices 삭제
                await supabase
                  .from('reservation_choices')
                  .delete()
                  .eq('reservation_id', editingReservation.id)

                // option_id가 choice_options 테이블에 존재하는지 검증
                const validChoices = []
                for (const choice of reservationData.choices.required) {
                  if (!choice.option_id) {
                    console.warn('option_id가 없는 choice 건너뛰기:', choice)
                    continue
                  }

                  // choice_options 테이블에서 option_id 존재 여부 확인
                  const { data: optionExists, error: checkError } = await supabase
                    .from('choice_options')
                    .select('id')
                    .eq('id', choice.option_id)
                    .maybeSingle()

                  if (checkError) {
                    console.error('choice_options 확인 오류:', checkError)
                    continue
                  }

                  if (!optionExists) {
                    console.warn(`option_id ${choice.option_id}가 choice_options 테이블에 존재하지 않습니다. 건너뜁니다.`)
                    continue
                  }

                  validChoices.push({
                    reservation_id: editingReservation.id,
                    choice_id: choice.choice_id,
                    option_id: choice.option_id,
                    quantity: choice.quantity || 1,
                    total_price: choice.total_price || 0
                  })
                }

                if (validChoices.length > 0) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const { error: choicesError } = await (supabase as any)
                    .from('reservation_choices')
                    .insert(validChoices)

                  if (choicesError) {
                    console.error('초이스 저장 오류:', choicesError)
                    alert('초이스 저장 중 오류가 발생했습니다: ' + choicesError.message)
                    return
                  } else {
                    console.log('초이스 저장 성공:', validChoices.length, '개')
                  }
                } else {
                  console.warn('유효한 초이스가 없어 저장하지 않습니다.')
                }
              }

              // 예약 목록 새로고침
              await tourData.refreshReservations()
              handleCloseEditModal()
              alert('예약이 성공적으로 수정되었습니다!')
            } catch (error) {
              console.error('Error updating reservation:', error)
              alert('예약 수정 중 오류가 발생했습니다.')
            }
          }}
          onCancel={handleCloseEditModal}
          onRefreshCustomers={async () => {}}
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
              booking={editingTicketBooking || undefined}
            tourId={tourData.tour?.id || ''}
              onSave={(b: any) => handleBookingSubmit(b as unknown as LocalTicketBooking)}
              onCancel={handleCloseTicketBookingForm}
            />
      )}
      </BookingModal>

      {/* 투어 호텔 부킹 폼 모달 */}
      <BookingModal
        isOpen={showTourHotelBookingForm}
        title={editingTourHotelBooking ? (locale === 'ko' ? '투어 호텔 부킹 수정' : 'Edit Tour Hotel Booking') : (locale === 'ko' ? '새 투어 호텔 부킹' : 'New Tour Hotel Booking')}
        onClose={handleCloseTourHotelBookingForm}
      >
        {showTourHotelBookingForm && tourData.tour && (
              <TourHotelBookingFormAny
                booking={editingTourHotelBooking || undefined}
            tourId={tourData.tour?.id || ''}
                onSave={(b: any) => handleBookingSubmit(b as unknown as LocalTourHotelBooking)}
                onCancel={handleCloseTourHotelBookingForm}
              />
        )}
      </BookingModal>

      {/* 픽업 스케줄 자동 생성 모달 */}
      {tourData.tour && (
        <PickupScheduleAutoGenerateModal
          isOpen={showPickupScheduleModal}
          tourDate={tourData.tour.tour_date}
          productId={tourData.product?.id || null}
          assignedReservations={tourData.assignedReservations}
          pickupHotels={tourData.pickupHotels as any}
          onClose={() => setShowPickupScheduleModal(false)}
          onSave={handleSavePickupSchedule}
          getCustomerName={(customerId: string) => tourData.getCustomerName(customerId) || 'Unknown'}
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
    </div>
  )
}