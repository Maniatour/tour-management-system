'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { ArrowLeft, Car, Hotel, Map, MapPin, Clock, User, Users, Camera, MessageSquare, FileText, Calculator, ChevronDown, ChevronUp, Calendar, Phone, Mail, ExternalLink } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import TourHotelBookingForm from '@/components/TourHotelBookingForm'
import TicketBookingForm from '@/components/TicketBookingForm'
import TourPhotoUpload from '@/components/TourPhotoUpload'
import TourChatRoom from '@/components/TourChatRoom'
import TourExpenseManager from '@/components/TourExpenseManager'
import TourReportSection from '@/components/TourReportSection'

// 타입 정의 (DB 스키마 기반)
type TourRow = Database['public']['Tables']['tours']['Row']
type ReservationRow = Database['public']['Tables']['reservations']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']
type PickupHotel = Database['public']['Tables']['pickup_hotels']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']
type TourHotelBooking = Database['public']['Tables']['tour_hotel_bookings']['Row']
type TicketBooking = Database['public']['Tables']['ticket_bookings']['Row']
type TeamMember = {
  email: string
  name_ko: string | null
  name_en: string | null
}

export default function GuideTourDetailPage() {
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const { user, userRole, simulatedUser, isSimulating } = useAuth()
  
  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUser = isSimulating && simulatedUser ? simulatedUser : user
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email
  
  const [tour, setTour] = useState<TourRow | null>(null)
  const [reservations, setReservations] = useState<ReservationRow[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [product, setProduct] = useState<ProductRow | null>(null)
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [pickupHotels, setPickupHotels] = useState<PickupHotel[]>([])
  const [tourHotelBookings, setTourHotelBookings] = useState<TourHotelBooking[]>([])
  const [ticketBookings, setTicketBookings] = useState<TicketBooking[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // 모바일 최적화를 위한 상태
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'bookings' | 'photos' | 'chat' | 'expenses' | 'report'>('overview')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['tour-info', 'reservations']))
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  
  // 탭별 섹션 매핑
  const tabSections = {
    overview: ['tour-info', 'product-info', 'reservations', 'guide-info', 'tour-memo'],
    schedule: ['pickup-schedule'],
    bookings: ['bookings'],
    photos: ['photos'],
    chat: ['chat'],
    expenses: ['expenses'],
    report: ['report']
  }

  // 투어 데이터 로드
  const loadTourData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const tourId = params.id as string
      if (!tourId) {
        setError('투어 ID가 없습니다.')
        return
      }

      // 투어 정보 가져오기
      const { data: tourData, error: tourError } = await supabase
        .from('tours')
        .select('*')
        .eq('id', tourId)
        .single()

      if (tourError) {
        setError('투어 정보를 불러올 수 없습니다.')
        return
      }

      // 권한 확인 (관리자/매니저는 모든 투어 접근 가능, 투어 가이드는 배정된 투어만)
      if (userRole === 'team_member' && tourData.tour_guide_id !== currentUserEmail && tourData.assistant_id !== currentUserEmail) {
        setError('이 투어에 대한 접근 권한이 없습니다.')
        return
      }

      setTour(tourData)

      // 상품 정보 가져오기
      if (tourData.product_id) {
        const { data: productData } = await supabase
          .from('products')
          .select('*')
          .eq('id', tourData.product_id)
          .single()
        setProduct(productData)
      }

      // 차량 정보 가져오기
      if (tourData.tour_car_id) {
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('*')
          .eq('id', tourData.tour_car_id)
          .single()
        setVehicle(vehicleData)
      }

      // 예약 정보 가져오기 (투어에 배정된 예약만)
      if (tourData.reservation_ids) {
        const reservationIds = Array.isArray(tourData.reservation_ids) 
          ? tourData.reservation_ids 
          : String(tourData.reservation_ids).split(',').map(id => id.trim()).filter(id => id)

        if (reservationIds.length > 0) {
          const { data: reservationsData } = await supabase
            .from('reservations')
            .select('*')
            .in('id', reservationIds)

          const reservationsList = reservationsData || []
          setReservations(reservationsList)

          // 고객 정보 가져오기
          const customerIds = [...new Set(reservationsList.map(r => r.customer_id).filter(Boolean))]
          if (customerIds.length > 0) {
            const { data: customersData } = await supabase
              .from('customers')
              .select('*')
              .in('id', customerIds)
            setCustomers(customersData || [])
      }

      // 픽업 호텔 정보 가져오기 (reservations의 pickup_hotel 정보 사용)
          if (reservationsList.length > 0) {
        // 예약에서 pickup_hotel ID들 수집
        const pickupHotelIds = [...new Set(
              reservationsList
            .map(r => r.pickup_hotel)
            .filter(Boolean)
        )]
        
        if (pickupHotelIds.length > 0) {
          const { data: hotelsData } = await supabase
            .from('pickup_hotels')
            .select('*')
            .in('id', pickupHotelIds)
          setPickupHotels(hotelsData || [])
        }
      }
        }
      }


      // 투어 호텔 부킹 정보 가져오기 (canceled가 아닌 것만)
      const { data: hotelBookingsData } = await supabase
        .from('tour_hotel_bookings')
        .select('*')
        .eq('tour_id', tourId)
        .not('status', 'ilike', 'canceled')
      setTourHotelBookings(hotelBookingsData || [])

      // 티켓 부킹 정보 가져오기 (canceled가 아닌 것만)
      const { data: ticketBookingsData } = await supabase
        .from('ticket_bookings')
        .select('*')
        .eq('tour_id', tourId)
        .not('status', 'ilike', 'canceled')
      setTicketBookings(ticketBookingsData || [])

      // 팀 멤버 정보 가져오기 (가이드와 어시스턴트 이름 표시용)
      const { data: teamData } = await supabase
        .from('team')
        .select('email, name_ko, name_en')
      setTeamMembers(teamData || [])

    } catch (err) {
      console.error('Error loading tour data:', err)
      setError('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [params.id, currentUserEmail])

  useEffect(() => {
    loadTourData()
  }, [loadTourData])

  // 고객 정보 조회 함수
  const getCustomerInfo = (customerId: string) => {
    return customers.find(c => c.id === customerId)
  }

  // 총 인원 계산
  const totalPeople = reservations.reduce((sum, reservation) => sum + (reservation.total_people || 0), 0)
  
  // 아코디언 토글 함수
  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }
  
  // 가이드 구성 타입 판단 함수
  const getGuideConfiguration = () => {
    if (!tour.tour_guide_id) return { type: 'none', label: '가이드 미배정', color: 'text-gray-500' }
    
    if (tour.assistant_id) {
      // 두 명의 가이드가 있는 경우
      return { type: 'two-guides', label: '2명 가이드', color: 'text-blue-600' }
    } else {
      // 가이드 1명만 있는 경우 (가이드 + 드라이버)
      return { type: 'guide-driver', label: '1명 가이드 + 드라이버', color: 'text-green-600' }
    }
  }
  
  // 가이드/어시스턴트 이름 가져오기 함수
  const getTeamMemberName = (email: string | null) => {
    if (!email) return locale === 'ko' ? '미배정' : 'Not Assigned'
    
    const member = teamMembers.find(m => m.email === email)
    if (!member) return email // 팀 멤버 정보가 없으면 이메일 표시
    
    // 한국어 페이지에서는 name_ko, 영어 페이지에서는 name_en 표시
    if (locale === 'ko') {
      return member.name_ko || member.name_en || email
    } else {
      return member.name_en || member.name_ko || email
    }
  }

  // 팀 멤버 전화번호 가져오기 함수
  const getTeamMemberPhone = (email: string | null) => {
    if (!email) return null
    
    const member = teamMembers.find(m => m.email === email)
    return member?.phone || null
  }

  // 예약 choice에서 선택된 옵션 이름 가져오기 함수
  const getChoiceName = (choiceData: any) => {
    if (!choiceData) return null
    
    try {
      // choice가 문자열인 경우 JSON 파싱
      const choice = typeof choiceData === 'string' ? JSON.parse(choiceData) : choiceData
      
      console.log('Choice data:', choice) // 디버깅용 로그
      
      // 방법 1: required 배열에서 선택된 옵션 찾기
      if (choice.required && Array.isArray(choice.required)) {
        for (const item of choice.required) {
          if (item.options && Array.isArray(item.options)) {
            // is_default가 true인 옵션 찾기
            const selectedOption = item.options.find((option: any) => option.is_default)
            if (selectedOption) {
              console.log('Selected option (method 1):', selectedOption) // 디버깅용 로그
              // 로케일에 따라 name 또는 name_ko 반환
              return locale === 'ko' ? selectedOption.name_ko : selectedOption.name
            }
          }
        }
      }
      
      // 방법 2: 직접 선택된 옵션 찾기 (다른 구조일 경우)
      if (choice.selected_option) {
        console.log('Selected option (method 2):', choice.selected_option) // 디버깅용 로그
        return locale === 'ko' ? choice.selected_option.name_ko : choice.selected_option.name
      }
      
      // 방법 3: 첫 번째 옵션 사용 (fallback)
      if (choice.required && Array.isArray(choice.required) && choice.required.length > 0) {
        const firstItem = choice.required[0]
        if (firstItem.options && Array.isArray(firstItem.options) && firstItem.options.length > 0) {
          const firstOption = firstItem.options[0]
          console.log('Using first option (method 3):', firstOption) // 디버깅용 로그
          return locale === 'ko' ? firstOption.name_ko : firstOption.name
        }
      }
      
      console.log('No option found in choice data') // 디버깅용 로그
      return null
    } catch (error) {
      console.error('Error parsing choice data:', error, 'Raw data:', choiceData)
      return null
    }
  }
  
  // 투어명 가져오기 함수
  const getProductName = () => {
    if (!product) return tour.product_id || (locale === 'ko' ? '상품 정보 없음' : 'No Product Info')
    
    // 한국어 페이지에서는 name_ko, 영어 페이지에서는 name_en 표시
    if (locale === 'ko') {
      return product.name_ko || product.name_en || product.id
    } else {
      return product.name_en || product.name_ko || product.id
    }
  }
  
  // 가이드 구성 라벨 가져오기 함수
  const getGuideConfigurationLabel = () => {
    if (!tour.tour_guide_id) {
      return locale === 'ko' ? '가이드 미배정' : 'No Guide Assigned'
    }
    
    if (tour.assistant_id) {
      // 두 명의 가이드가 있는 경우
      return locale === 'ko' ? '2명 가이드' : '2 Guides'
    } else {
      // 가이드 1명만 있는 경우 (가이드 + 드라이버)
      return locale === 'ko' ? '1명 가이드 + 드라이버' : '1 Guide + Driver'
    }
  }

  // 날짜 시간 형식 변환 함수
  const formatDateTime = (dateTimeString: string | null) => {
    if (!dateTimeString) return locale === 'ko' ? '미정' : 'TBD'
    
    try {
      const date = new Date(dateTimeString)
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const year = String(date.getFullYear()).slice(-2)
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      
      return `${month}/${day}/${year} ${hours}:${minutes}`
    } catch (error) {
      return dateTimeString
    }
  }
  
  // 탭 변경 함수
  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab)
    // 해당 탭의 섹션들을 모두 열기
    const sectionsToOpen = tabSections[tab]
    const newExpanded = new Set(expandedSections)
    sectionsToOpen.forEach(sectionId => newExpanded.add(sectionId))
    setExpandedSections(newExpanded)
  }
  
  // 아코디언 섹션 컴포넌트
  const AccordionSection = ({ 
    id, 
    title, 
    icon: Icon, 
    children, 
    defaultExpanded = false 
  }: { 
    id: string
    title: string
    icon: any
    children: React.ReactNode
    defaultExpanded?: boolean
  }) => {
    const isExpanded = expandedSections.has(id)
    
    return (
      <div className="bg-white rounded-lg shadow mb-3 sm:mb-4">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center">
            <Icon className="w-5 h-5 text-gray-400 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        {isExpanded && (
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            {children}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">투어 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">오류</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => router.push('/ko/guide/tours')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            투어 목록으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  if (!tour) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">투어를 찾을 수 없습니다</h1>
          <button 
            onClick={() => router.push('/ko/guide/tours')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            투어 목록으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-2">
      {/* 헤더 - 모바일 최적화 */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/ko/guide/tours')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 text-sm sm:text-base"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          투어 목록으로 돌아가기
        </button>
      </div>

      {/* 모바일 탭 네비게이션 - 앱 스타일 */}
      <div className="lg:hidden mb-4">
        <div className="bg-white rounded-lg shadow p-2">
          <div className="flex space-x-2 overflow-x-auto pb-1">
            <button
              onClick={() => handleTabChange('overview')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
              }`}
            >
              <Clock className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">개요</span>
            </button>
            
            <button
              onClick={() => handleTabChange('schedule')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'schedule'
                  ? 'bg-green-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
              }`}
            >
              <MapPin className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">스케줄</span>
            </button>
            
            <button
              onClick={() => handleTabChange('bookings')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'bookings'
                  ? 'bg-purple-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
              }`}
            >
              <Hotel className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">부킹</span>
            </button>
            
            <button
              onClick={() => handleTabChange('photos')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'photos'
                  ? 'bg-orange-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
              }`}
            >
              <Camera className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">사진</span>
            </button>
            
            <button
              onClick={() => handleTabChange('chat')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'chat'
                  ? 'bg-teal-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
              }`}
            >
              <MessageSquare className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">채팅</span>
            </button>
            
            <button
              onClick={() => handleTabChange('expenses')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'expenses'
                  ? 'bg-yellow-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
              }`}
            >
              <Calculator className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">정산</span>
        </button>
        
            <button
              onClick={() => handleTabChange('report')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'report'
                  ? 'bg-red-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
              }`}
            >
              <FileText className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">리포트</span>
            </button>
          </div>
        </div>
      </div>

      {/* 모바일 최적화된 아코디언 레이아웃 */}
      <div className="space-y-3 sm:space-y-4">
        {/* 투어 기본 정보 - 개요 탭에만 표시 */}
        <div className={`${activeTab === 'overview' ? 'block' : 'hidden'} lg:block`}>
          <div className="bg-white rounded-lg shadow mb-3 sm:mb-4">
            <button
              onClick={() => toggleSection('tour-info')}
              className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <Calendar className="w-5 h-5 text-gray-400 mr-3" />
                <h2 className="text-lg font-semibold text-gray-900">투어 정보</h2>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                  tour.tour_status === 'confirmed' ? 'bg-green-100 text-green-800' :
                  tour.tour_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  tour.tour_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  tour.tour_status === 'recruiting' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {tour.tour_status || (locale === 'ko' ? '상태 없음' : 'No Status')}
                </span>
                {expandedSections.has('tour-info') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>
            {expandedSections.has('tour-info') && (
              <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="space-y-2">
                  {/* 투어 제목 */}
                  <div className="text-lg font-semibold text-gray-900">
                    {getProductName()}
                  </div>
            
            {/* 날짜, 인원, 차량 - 뱃지 스타일 */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-blue-100 text-blue-800">
                📅 {tour.tour_date}
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-green-100 text-green-800">
                👥 {totalPeople}{locale === 'ko' ? '명' : ' people'}
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-purple-100 text-purple-800">
                🚗 {vehicle?.vehicle_number || (locale === 'ko' ? '미배정' : 'Not Assigned')}
              </span>
            </div>
            
            {/* 가이드 정보 - 뱃지 스타일 */}
            <div className="flex flex-wrap gap-2">
              {getTeamMemberPhone(tour.tour_guide_id) ? (
                <a 
                  href={`tel:${getTeamMemberPhone(tour.tour_guide_id)}`}
                  className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors cursor-pointer"
                >
                  👨‍💼 {getTeamMemberName(tour.tour_guide_id)}
                </a>
              ) : (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-orange-100 text-orange-800">
                  👨‍💼 {getTeamMemberName(tour.tour_guide_id)}
                </span>
              )}
              {tour.assistant_id && (
                getTeamMemberPhone(tour.assistant_id) ? (
                  <a 
                    href={`tel:${getTeamMemberPhone(tour.assistant_id)}`}
                    className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-teal-100 text-teal-800 hover:bg-teal-200 transition-colors cursor-pointer"
                  >
                    👨‍💼 {getTeamMemberName(tour.assistant_id)}
                  </a>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-teal-100 text-teal-800">
                    👨‍💼 {getTeamMemberName(tour.assistant_id)}
                  </span>
                )
              )}
              <span className={`inline-flex items-center px-2 py-1 rounded-md text-sm font-medium ${
                getGuideConfiguration().type === 'two-guides' ? 'bg-blue-100 text-blue-800' :
                getGuideConfiguration().type === 'guide-driver' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                👥 {getGuideConfigurationLabel()}
              </span>
            </div>
            
            {/* 티켓 부킹 정보 */}
            {ticketBookings.length > 0 && (
              <div className="space-y-1">
                <hr className="border-gray-200" />
                {ticketBookings
                  .sort((a, b) => {
                    // 체크인 시간순으로 정렬 (초단위 제거)
                    const timeA = a.time?.substring(0, 5) || '00:00'
                    const timeB = b.time?.substring(0, 5) || '00:00'
                    return timeA.localeCompare(timeB)
                  })
                  .map((booking) => {
                    // 회사명 변환 로직
                    const getCompanyName = (company: string) => {
                      const companyLower = company?.toLowerCase() || ''
                      if (companyLower === 'see canyon') return 'Dixies'
                      if (companyLower === 'mei tour' || companyLower === 'ken\'s tour') return 'Ken\'s'
                      return company
                    }
                    
                    return (
                      <div key={booking.id} className="flex items-center space-x-2 text-sm">
                        <span className="text-gray-700">
                          {booking.time?.substring(0, 5) || '시간 미정'} {getCompanyName(booking.company)}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                          👥 {booking.ea || 0}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                          # {booking.rn_number || '번호 없음'}
                        </span>
                </div>
                    )
                  })}
              </div>
            )}
            
                  {/* 출발 - 종료 시간 */}
                  <div className="text-gray-700">
                    {formatDateTime(tour.tour_start_datetime)} - {formatDateTime(tour.tour_end_datetime)}
                  </div>
                </div>
              </div>
            )}
                </div>
              </div>

        {/* 예약 정보 - 개요 탭에만 표시 */}
        <div className={`${activeTab === 'overview' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection id="reservations" title="예약 정보" icon={Users}>
            <div className="space-y-4">
              {reservations.map((reservation) => {
                const customer = getCustomerInfo(reservation.customer_id)
              const hotel = pickupHotels.find(h => h.id === reservation.pickup_hotel)
                return (
                  <div key={reservation.id} className="border border-gray-200 rounded-lg p-4">
                  {/* 첫번째 줄: 고객명, 인원, 상태 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div>
                        <h3 className="font-medium text-gray-900 text-sm sm:text-base">
                          {customer?.name || '정보 없음'}
                      </h3>
                        <p className="text-xs text-gray-500">
                          {getChoiceName(reservation.choices) || `예약 #${reservation.id}`}
                        </p>
                      </div>
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                        👥 {reservation.total_people || 0}
                      </span>
                    </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        reservation.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        reservation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {reservation.status || '상태 없음'}
                      </span>
                    </div>
                  
                  {/* 두번째 줄: 픽업시간과 연락처 아이콘들 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700">
                        {reservation.pickup_time ? 
                          reservation.pickup_time.substring(0, 5) : // 초단위 제거 (HH:MM 형식)
                          '픽업시간 미정'
                        }
                      </span>
                      </div>
                    <div className="flex items-center space-x-2">
                      {customer?.phone && (
                        <a 
                          href={`tel:${customer.phone}`}
                          className="text-green-600 hover:text-green-700 transition-colors"
                          title="전화"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                      {customer?.email && (
                        <a 
                          href={`mailto:${customer.email}`}
                          className="text-blue-600 hover:text-blue-700 transition-colors"
                          title="이메일"
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                      )}
            </div>
          </div>

                  {/* 호텔 정보 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Hotel className="w-4 h-4 text-gray-500" />
                      <div className="text-sm text-gray-700">
                        <div className="font-medium">{hotel?.hotel || '호텔 정보 없음'}</div>
                        {hotel?.pick_up_location && (
                          <div className="text-xs text-gray-500">{hotel.pick_up_location}</div>
                        )}
                      </div>
                    </div>
                    {(hotel?.link || hotel?.pin) && (
                      <a 
                        href={hotel?.link || `https://www.google.com/maps?q=${hotel?.pin}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 transition-colors"
                        title="지도에서 보기"
                      >
                        <MapPin className="w-4 h-4" />
                      </a>
                      )}
                    </div>
                  </div>
                )
              })}
              {reservations.length === 0 && (
                <p className="text-gray-500 text-center py-4">배정된 예약이 없습니다.</p>
              )}
            </div>
        </AccordionSection>
        </div>

        {/* 픽업 스케줄 - 스케줄 탭에만 표시 */}
        <div className={`${activeTab === 'schedule' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection id="pickup-schedule" title="픽업 스케줄" icon={Clock}>
               <div className="space-y-3">
            {reservations
              .filter(reservation => reservation.pickup_hotel) // 픽업 호텔이 있는 예약만
              .sort((a, b) => {
                // 픽업 시간순으로 정렬
                const timeA = a.pickup_time || '00:00'
                const timeB = b.pickup_time || '00:00'
                return timeA.localeCompare(timeB)
              })
              .map((reservation) => {
                const customer = getCustomerInfo(reservation.customer_id)
                const hotel = pickupHotels.find(h => h.id === reservation.pickup_hotel)
                return (
                  <div key={reservation.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    {/* 첫번째 줄: 시간, 호텔명(인원), 지도 아이콘 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="text-blue-600 font-medium text-sm">
                          {reservation.pickup_time ? 
                            reservation.pickup_time.substring(0, 5) : // 초단위 제거 (HH:MM 형식)
                            '미정'
                          }
                        </span>
                        <div className="font-semibold text-gray-900">
                          {hotel?.hotel || '호텔 정보 없음'} ({reservation.total_people || 0}명)
                     </div>
                   </div>
                      {(hotel?.link || hotel?.pin) && (
                        <a 
                          href={hotel?.link || `https://www.google.com/maps?q=${hotel?.pin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 transition-colors"
                          title="지도에서 보기"
                        >
                          <MapPin className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    
                    {/* 두번째 줄: 픽업 위치 */}
                    <div className="flex items-center space-x-2 mb-2">
                      <MapPin className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-gray-600">
                        {hotel?.pick_up_location || '픽업 위치 미정'}
                      </span>
               </div>
                    
                    {/* 세번째 줄: 고객명, 인원, 연락처 */}
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">
                        {customer?.name || '정보 없음'}
             </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-500">
                          {reservation.total_people || 0}인
                        </span>
                        <div className="flex items-center space-x-2">
                          {customer?.phone && (
                            <a 
                              href={`tel:${customer.phone}`}
                              className="text-green-600 hover:text-green-700 transition-colors"
                              title="전화"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                          {customer?.email && (
                            <a 
                              href={`mailto:${customer.email}`}
                              className="text-blue-600 hover:text-blue-700 transition-colors"
                              title="이메일"
                            >
                              <Mail className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                </div>
              </div>
                  </div>
                )
              })}
            {reservations.filter(reservation => reservation.pickup_hotel).length === 0 && (
              <p className="text-gray-500 text-center py-4">픽업 스케줄이 없습니다.</p>
              )}
          </div>
        </AccordionSection>
        </div>


        {/* 투어 메모 - 개요 탭에만 표시 */}
          {tour.tour_info && (
          <div className={`${activeTab === 'overview' ? 'block' : 'hidden'} lg:block`}>
            <AccordionSection id="tour-memo" title="투어 메모" icon={FileText}>
              <p className="text-gray-700 whitespace-pre-wrap">{tour.tour_info}</p>
            </AccordionSection>
            </div>
          )}
      </div>

      {/* 추가 섹션들 - 아코디언 형태 */}
      <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">

        {/* 부킹 관리 - 부킹 탭에만 표시 */}
        <div className={`${activeTab === 'bookings' ? 'block' : 'hidden'} lg:block`}>
        <AccordionSection id="bookings" title="부킹 관리" icon={Hotel}>
          {/* 호텔 부킹 */}
          {tourHotelBookings.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-3">호텔 부킹</h3>
              <div className="space-y-3">
                {tourHotelBookings.map((booking) => (
                  <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900 text-sm sm:text-base">{booking.hotel_name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>체크인: {booking.check_in_date}</p>
                      <p>체크아웃: {booking.check_out_date}</p>
                      <p>객실 수: {booking.room_count}</p>
                      {booking.notes && <p className="mt-2">메모: {booking.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 티켓 부킹 */}
          {ticketBookings.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">티켓 부킹</h3>
              <div className="space-y-3">
                {ticketBookings.map((booking) => {
                  // 회사명 결정 로직
                  const getCompanyName = (company: string) => {
                    const companyLower = company?.toLowerCase() || ''
                    if (companyLower === 'see canyon') return 'Dixies'
                    if (companyLower === 'mei tour' || companyLower === 'ken\'s tour') return 'Ken\'s'
                    return company
                  }
                  
                  return (
                  <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 text-sm sm:text-base">
                          {getCompanyName(booking.company)}
                        </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          booking.status?.toLowerCase() === 'confirmed' ? 'bg-green-100 text-green-800' :
                          booking.status?.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>RN 번호: {booking.rn_number || '정보 없음'}</p>
                        <p>EA: {booking.ea || '정보 없음'}</p>
                        <p>체크인 날짜: {booking.check_in_date || '정보 없음'}</p>
                        <p>체크인 시간: {booking.time || '정보 없음'}</p>
                      {booking.notes && <p className="mt-2">메모: {booking.notes}</p>}
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>
          )}

          {tourHotelBookings.length === 0 && ticketBookings.length === 0 && (
            <p className="text-gray-500">부킹 정보가 없습니다.</p>
          )}
        </AccordionSection>
        </div>

        {/* 투어 사진 - 사진 탭에만 표시 */}
        <div className={`${activeTab === 'photos' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection id="photos" title="투어 사진" icon={Camera}>
          <TourPhotoUpload tourId={tour.id} />
          </AccordionSection>
        </div>

        {/* 채팅 - 채팅 탭에만 표시 */}
        <div className={`${activeTab === 'chat' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection id="chat" title="채팅" icon={MessageSquare}>
          <div style={{ height: '600px' }}>
            <TourChatRoom tourId={tour.id} />
          </div>
          </AccordionSection>
        </div>

        {/* 정산 관리 - 정산 탭에만 표시 */}
        <div className={`${activeTab === 'expenses' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection id="expenses" title="정산 관리" icon={Calculator}>
          <TourExpenseManager tourId={tour.id} />
          </AccordionSection>
        </div>

        {/* 투어 리포트 - 리포트 탭에만 표시 */}
        <div className={`${activeTab === 'report' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection id="report" title="투어 리포트" icon={FileText}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">리포트 관리</h3>
              <button 
                onClick={() => setIsReportModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FileText className="w-4 h-4 mr-2" />
                투어 리포트 추가
              </button>
            </div>
            <TourReportSection tourId={tour.id} />
          </div>
          </AccordionSection>
        </div>
      </div>

      {/* 투어 리포트 추가 모달 */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">투어 리포트 추가</h3>
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    리포트 제목
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="리포트 제목을 입력하세요"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    리포트 내용
                  </label>
                  <textarea
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="리포트 내용을 입력하세요"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      투어 날짜
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      defaultValue={tour.tour_date}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      투어 상태
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option value="completed">완료</option>
                      <option value="in_progress">진행중</option>
                      <option value="cancelled">취소</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsReportModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    리포트 저장
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

