/* @ts-nocheck */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
  console.log('TourDetailPage 렌더링 시작')
  const router = useRouter()
  
  const { hasPermission, loading } = useAuth()
  const { openChat } = useFloatingChat()

  console.log('Auth 상태:', { hasPermission, loading })

  // 커스텀 훅으로 데이터와 상태 관리
  console.log('useTourDetailData 호출 시작')
  const tourData = useTourDetailData()
  console.log('useTourDetailData 완료:', { 
    tour: tourData.tour, 
    pageLoading: tourData.pageLoading,
    isStaff: tourData.isStaff 
  })
  
  console.log('useTourHandlers 호출 시작')
  const tourHandlers = useTourHandlers()
  console.log('useTourHandlers 완료')
  
  // 부킹 관련 상태 (로컬 상태로 유지)
  const [ticketBookings, setTicketBookings] = useState<LocalTicketBooking[]>([])
  const [tourHotelBookings, setTourHotelBookings] = useState<LocalTourHotelBooking[]>([])
  const [showTicketBookingForm, setShowTicketBookingForm] = useState<boolean>(false)
  const [showTourHotelBookingForm, setShowTourHotelBookingForm] = useState<boolean>(false)
  const [editingTicketBooking, setEditingTicketBooking] = useState<LocalTicketBooking | null>(null)
  const [editingTourHotelBooking, setEditingTourHotelBooking] = useState<LocalTourHotelBooking | null>(null)
  const [showTicketBookingDetails, setShowTicketBookingDetails] = useState<boolean>(false)
  const [editingReservation, setEditingReservation] = useState<any>(null)
  
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

  const handleTourStatusUpdate = (status: string) => {
    if (!tourData.tour) return
    tourHandlers.updateTourStatus(tourData.tour, status, tourData.isStaff)
    tourData.setTour(prev => prev ? { ...prev, tour_status: status } : null)
    tourData.setShowTourStatusDropdown(false)
  }

  const handleAssignmentStatusUpdate = (status: string) => {
    if (!tourData.tour) return
    tourHandlers.updateAssignmentStatus(tourData.tour, status, tourData.isStaff)
    tourData.setTour(prev => prev ? { ...prev, assignment_status: status } : null)
    tourData.setShowAssignmentStatusDropdown(false)
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
        alert('저장 중 오류가 발생했습니다.')
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
      alert('저장되었습니다.')
    } catch (error) {
      console.error('팀 구성 및 차량 배정 저장 오류:', error)
      alert('저장 중 오류가 발생했습니다.')
    }
  }




  // 차량 이름 가져오기 함수
  const getVehicleName = (vehicleId: string) => {
    if (!vehicleId) return '차량 미선택'
    
    const vehicle = tourData.vehicles.find((v) => v.id === vehicleId)
    if (!vehicle) {
      return vehicleId
    }
    
    return `${vehicle.vehicle_number || '번호 없음'} - ${vehicle.vehicle_type || '타입 없음'}`
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

  // 예약 편집 모달 열기
  const handleEditReservationClick = async (reservation: any) => {
    if (!tourData.isStaff) return
    setEditingReservation(reservation)
  }

  // 예약 편집 모달 닫기
  const handleCloseEditModal = async () => {
    setEditingReservation(null)
  }

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
  const filteredTicketBookings = showTicketBookingDetails 
    ? ticketBookings 
    : ticketBookings.filter(booking => booking.status?.toLowerCase() === 'confirmed')

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
        <div className="text-gray-500">투어를 찾을 수 없습니다.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <TourHeader
        tour={tourData.tour}
        product={tourData.product}
        params={{ locale: 'ko' }}
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
        getAssignmentStatusColor={() => getAssignmentStatusColor(tourData.tour)}
        getAssignmentStatusText={() => getAssignmentStatusText(tourData.tour)}
      />

      <div className="px-0 py-6">
        {/* 4열 그리드 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 1열: 기본 정보, 픽업 스케줄, 옵션 관리 */}
          <div className="space-y-6">
            {/* 기본 정보 */}
            <TourInfo
              tour={tourData.tour}
              product={tourData.product}
              tourNote={tourData.tourNote}
              isPrivateTour={tourData.isPrivateTour}
              connectionStatus={{ tours: tourData.connectionStatus.tours }}
              onTourNoteChange={handleTourNoteChange}
              onPrivateTourToggle={handlePrivateTourToggle}
              getStatusColor={getStatusColor}
              getStatusText={getStatusText}
            />

        {/* 날씨 정보 섹션 */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4">
            <TourWeather 
                  tourDate={tourData.tour.tour_date} 
                  {...(tourData.product?.id && { productId: tourData.product.id })}
            />
          </div>
        </div>

        {/* 픽업 스케줄 */}
        <PickupSchedule
              assignedReservations={tourData.assignedReservations}
              pickupHotels={tourData.pickupHotels}
              expandedSections={tourData.expandedSections}
              connectionStatus={{ reservations: tourData.connectionStatus.reservations }}
              onToggleSection={tourData.toggleSection}
          onAutoGenerate={() => {
            // 자동생성 로직
          }}
              getPickupHotelNameOnly={tourData.getPickupHotelNameOnly}
              getCustomerName={(customerId: string) => tourData.getCustomerName(customerId) || 'Unknown'}
          openGoogleMaps={openGoogleMaps}
        />

        {/* 투어 스케줄 섹션 */}
        <TourSchedule
              tour={tourData.tour}
              expandedSections={tourData.expandedSections}
              onToggleSection={tourData.toggleSection}
              locale="ko"
        />

            {/* 옵션 관리 */}
            <OptionManagement reservationIds={tourData.tour?.reservation_ids || []} />
          </div>

          {/* 2열: 팀 구성 & 차량 배정, 배정 관리 */}
          <div className="space-y-6">
            {/* 팀 구성 & 차량 배정 통합 */}
            <TeamAndVehicleAssignment
              teamMembers={tourData.teamMembers.map(member => ({
                id: member.email, // email을 id로 사용
                name_ko: member.name_ko,
                email: member.email,
                position: 'guide', // 기본값 설정
                is_active: true // 기본값 설정
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

            {/* 배정 관리 */}
            <AssignmentManagement
              assignedReservations={tourData.assignedReservations}
              pendingReservations={tourData.pendingReservations}
              otherToursAssignedReservations={tourData.otherToursAssignedReservations}
              otherStatusReservations={tourData.otherStatusReservations}
              expandedSections={tourData.expandedSections}
              loadingStates={tourData.loadingStates}
              isStaff={tourData.isStaff}
              onToggleSection={tourData.toggleSection}
              onAssignAllReservations={handleAssignAllReservations}
              onUnassignAllReservations={handleUnassignAllReservations}
              onEditReservationClick={handleEditReservationClick}
              onUnassignReservation={handleUnassignReservation}
              onReassignFromOtherTour={() => {}}
              onNavigateToTour={(tourId: string) => {
                router.push(`/admin/tours/${tourId}`)
              }}
              onEditPickupTime={handleEditReservationClick}
              onEditPickupHotel={handleEditReservationClick}
              getCustomerName={(customerId: string) => tourData.getCustomerName(customerId) || 'Unknown'}
              getCustomerLanguage={(customerId: string) => tourData.getCustomerLanguage(customerId) ?? 'Unknown'}
              getChannelInfo={getChannelInfo}
              safeJsonParse={safeJsonParse}
              pickupHotels={tourData.pickupHotels}
            />
          </div>

          {/* 3열: 부킹 관리 */}
          <div className="space-y-6">
            {/* 부킹 관리 */}
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

            {/* 투어 채팅방 */}
            <TourChat
              tour={tourData.tour}
              user={tourData.user}
              openChat={openChat}
            />

            {/* 투어 사진 */}
            <TourPhotos
              tour={tourData.tour}
              onPhotosUpdated={() => {
                console.log('Photos updated')
              }}
            />
          </div>

        {/* 4열: 정산 관리 (재무 권한 보유자만) */}
        {hasPermission && hasPermission('canViewFinance') && (
          <div className="space-y-6">
            <TourFinance
                 tour={tourData.tour}
                 connectionStatus={{ bookings: tourData.connectionStatus.bookings }}
                 userRole="admin"
               onExpenseUpdated={() => {
                 console.log('Expenses updated')
               }}
             />

             {/* 투어 리포트 섹션 */}
            <TourReport
                tour={tourData.tour}
                product={tourData.product}
                connectionStatus={{ bookings: tourData.connectionStatus.bookings }}
                isStaff={tourData.isStaff}
                userRole="admin"
            />
          </div>
        )}
        </div>
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
          productOptions={[]}
          optionChoices={[]}
          options={[]}
          pickupHotels={tourData.pickupHotels}
          coupons={[]}
          onSubmit={async (reservationData: any) => {
            console.log('Reservation updated:', reservationData)
            handleCloseEditModal()
          }}
          onCancel={handleCloseEditModal}
          onRefreshCustomers={async () => {}}
          onDelete={async () => {
            console.log('Reservation deleted')
            handleCloseEditModal()
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
        title={editingTicketBooking ? '입장권 부킹 수정' : '입장권 부킹 추가'}
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
        title={editingTourHotelBooking ? '투어 호텔 부킹 수정' : '투어 호텔 부킹 추가'}
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
    </div>
  )
}