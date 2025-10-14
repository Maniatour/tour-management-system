'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, Hotel, MapPin, Clock, Users, Camera, MessageSquare, FileText, Calculator, ChevronDown, ChevronUp, Calendar, Phone, Mail } from 'lucide-react'
// import ReactCountryFlag from 'react-country-flag'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import TourPhotoUpload from '@/components/TourPhotoUpload'
import { useFloatingChat } from '@/contexts/FloatingChatContext'
import TourExpenseManager from '@/components/TourExpenseManager'
import TourReportSection from '@/components/TourReportSection'
import TourReportForm from '@/components/TourReportForm'
import TourWeather from '@/components/TourWeather'
import TourScheduleSection from '@/components/product/TourScheduleSection'
import { formatCustomerNameEnhanced } from '@/utils/koreanTransliteration'
import { formatTimeWithAMPM } from '@/lib/utils'

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
  phone?: string | null
}

export default function GuideTourDetailPage() {
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const { user, userRole, simulatedUser, isSimulating } = useAuth()
  const { openChat } = useFloatingChat()
  const t = useTranslations('guideTour')
  
  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['tour-info', 'pickup-schedule']))
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [calculatedTourTimes, setCalculatedTourTimes] = useState<{
    startTime: string;
    endTime: string;
    sunriseTime: string;
  } | null>(null)
  
  // 탭별 섹션 매핑
  const tabSections = {
    overview: ['tour-info', 'product-info', 'pickup-schedule', 'guide-info', 'tour-memo'],
    schedule: [],
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
        setError(t('errors.noTourId'))
        return
      }

      // 투어 정보 가져오기
      const { data: tourData, error: tourError } = await supabase
        .from('tours')
        .select('*')
        .eq('id', tourId)
        .single()

      if (tourError || !tourData) {
        setError(t('errors.cannotLoadTour'))
        return
      }

      // 권한 확인 (관리자/매니저는 모든 투어 접근 가능, 투어 가이드는 배정된 투어만)
      if (userRole === 'team_member' && (tourData as TourRow & { tour_guide_id?: string; assistant_id?: string })?.tour_guide_id !== currentUserEmail && (tourData as TourRow & { tour_guide_id?: string; assistant_id?: string })?.assistant_id !== currentUserEmail) {
        setError(t('errors.noAccess'))
        return
      }

      setTour(tourData)

      // 상품 정보 가져오기
      if ((tourData as TourRow & { product_id?: string }).product_id) {
        const { data: productData } = await supabase
          .from('products')
          .select('*')
          .eq('id', (tourData as TourRow & { product_id: string }).product_id)
          .single()
        setProduct(productData)
      }

      // 차량 정보 가져오기
      if ((tourData as TourRow & { tour_car_id?: string }).tour_car_id) {
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('*')
          .eq('id', (tourData as TourRow & { tour_car_id: string }).tour_car_id)
          .single()
        setVehicle(vehicleData)
      }

      // 예약 정보 가져오기 (투어에 배정된 예약만)
      if ((tourData as TourRow & { reservation_ids?: string[] | string }).reservation_ids) {
        const reservationIds = Array.isArray((tourData as TourRow & { reservation_ids: string[] | string }).reservation_ids) 
          ? (tourData as TourRow & { reservation_ids: string[] }).reservation_ids 
          : String((tourData as TourRow & { reservation_ids: string }).reservation_ids).split(',').map(id => id.trim()).filter(id => id)

        if (reservationIds.length > 0) {
          const { data: reservationsData } = await supabase
            .from('reservations')
            .select('*, choices')
            .in('id', reservationIds)

          const reservationsList = (reservationsData || []) as ReservationRow[]
          
          // 픽업 시간으로 정렬
          const sortedReservations = reservationsList.sort((a, b) => {
            const timeA = (a as ReservationRow).pickup_time || '00:00'
            const timeB = (b as ReservationRow).pickup_time || '00:00'
            return timeA.localeCompare(timeB)
          })
          
          setReservations(sortedReservations)

          // 고객 정보 가져오기
          const customerIds = [...new Set(reservationsList.map(r => (r as ReservationRow & { customer_id?: string }).customer_id).filter(Boolean))]
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
            .map(r => (r as ReservationRow & { pickup_hotel?: string }).pickup_hotel)
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


      // 투어 호텔 부킹 정보 가져오기 (cancelled가 아닌 것만)
      const { data: hotelBookingsData } = await supabase
        .from('tour_hotel_bookings')
        .select('*')
        .eq('tour_id', tourId)
        .not('status', 'ilike', 'cancelled')
      setTourHotelBookings(hotelBookingsData || [])

      // 티켓 부킹 정보 가져오기 (confirmed 상태만)
      const { data: ticketBookingsData } = await supabase
        .from('ticket_bookings')
        .select('*')
        .eq('tour_id', tourId)
        .eq('status', 'confirmed')
      setTicketBookings(ticketBookingsData || [])

      // 팀 멤버 정보 가져오기 (가이드와 어시스턴트 이름 표시용)
      const { data: teamData } = await supabase
        .from('team')
        .select('email, name_ko, name_en, phone')
      setTeamMembers(teamData || [])

    } catch (err) {
      console.error('Error loading tour data:', err)
      setError(locale === 'ko' ? '데이터를 불러오는 중 오류가 발생했습니다.' : 'An error occurred while loading data.')
    } finally {
      setLoading(false)
    }
  }, [params.id, currentUserEmail, userRole, t, locale])

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
    if (!tour?.tour_guide_id) return { type: 'none', label: t('guideConfig.unassigned'), color: 'text-gray-500' }
    
    if (tour.assistant_id) {
      // 두 명의 가이드가 있는 경우
      return { type: 'two-guides', label: t('guideConfig.twoGuides'), color: 'text-blue-600' }
    } else {
      // 가이드 1명만 있는 경우 (가이드 + 드라이버)
      return { type: 'guide-driver', label: t('guideConfig.oneGuideDriver'), color: 'text-green-600' }
    }
  }
  
  // 가이드/어시스턴트 이름 가져오기 함수
  const getTeamMemberName = (email: string | null) => {
    if (!email) return t('unassigned')
    
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

  
  // 투어명 가져오기 함수
  const getProductName = () => {
    if (!product) return tour?.product_id || t('noProductInfo')
    
    // 한국어 페이지에서는 name, 영어 페이지에서는 name_en 표시
    if (locale === 'ko') {
      return product.name || product.name_en || product.id
    } else {
      return product.name_en || product.name || product.id
    }
  }
  
  // 가이드 구성 라벨 가져오기 함수
  const getGuideConfigurationLabel = () => {
    if (!tour?.tour_guide_id) {
      return t('noGuideAssigned')
    }
    
    if (tour.assistant_id) {
      // 두 명의 가이드가 있는 경우
      return t('twoGuides')
    } else {
      // 가이드 1명만 있는 경우 (가이드 + 드라이버)
      return t('oneGuideDriver')
    }
  }

  // 날짜 시간 형식 변환 함수
  const formatDateTime = (dateTimeString: string | null) => {
    if (!dateTimeString) return t('tbd')
    
    try {
      const date = new Date(dateTimeString)
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const year = String(date.getFullYear()).slice(-2)
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      
      return `${month}/${day}/${year} ${hours}:${minutes}`
    } catch {
      return dateTimeString
    }
  }

  // MDGCSUNRISE 상품의 일출 시간 기반 투어 시간 계산 함수
  const calculateSunriseTourTimes = useCallback(async (tourDate: string, durationHours: number = 8) => {
    try {
      const { getSunriseSunsetData } = await import('@/lib/weatherApi')
      const data = await getSunriseSunsetData('Grand Canyon South Rim', tourDate)
      
      if (data && data.sunrise) {
        const sunriseTime = data.sunrise
        const [sunriseHours, sunriseMinutes] = sunriseTime.split(':').map(Number)
        
        // 투어 시작 시간: 일출 시간에서 8시간 빼기 (전날 밤)
        const tourStartHours = (sunriseHours - 8 + 24) % 24
        const tourStartMinutes = sunriseMinutes
        
        // 투어 종료 시간: 일출 시간에서 duration 시간 더하기
        const tourEndHours = (sunriseHours + durationHours) % 24
        const tourEndMinutes = sunriseMinutes
        
        // 날짜 계산
        const tourDateObj = new Date(tourDate + 'T00:00:00')
        const startDate = new Date(tourDateObj)
        const endDate = new Date(tourDateObj)
        
        // 시작 시간이 전날이면 날짜를 하루 빼기
        if (sunriseHours - 8 < 0) {
          startDate.setDate(startDate.getDate() - 1)
        }
        
        // 종료 시간이 다음날이면 날짜를 하루 더하기
        if (sunriseHours + durationHours >= 24) {
          endDate.setDate(endDate.getDate() + 1)
        }
        
        return {
          startTime: `${startDate.toISOString().split('T')[0]} ${String(tourStartHours).padStart(2, '0')}:${String(tourStartMinutes).padStart(2, '0')}`,
          endTime: `${endDate.toISOString().split('T')[0]} ${String(tourEndHours).padStart(2, '0')}:${String(tourEndMinutes).padStart(2, '0')}`,
          sunriseTime: sunriseTime
        }
      }
      
      return {
        startTime: `${tourDate} 22:00`,
        endTime: `${tourDate} 06:00`,
        sunriseTime: '06:00'
      }
    } catch (error) {
      console.error(locale === 'ko' ? '일출 투어 시간 계산 실패:' : 'Failed to calculate sunrise tour time:', error)
      return {
        startTime: `${tourDate} 22:00`,
        endTime: `${tourDate} 06:00`,
        sunriseTime: '06:00'
      }
    }
  }, [locale])

  // 투어 시간 계산 (MDGCSUNRISE 상품의 경우 일출 시간 기반)
  useEffect(() => {
    const calcTourTimes = async () => {
      if (tour?.tour_date && product) {
        if (tour.product_id === 'MDGCSUNRISE') {
          // MDGCSUNRISE 상품의 경우 일출 시간 기반으로 계산
          const durationHours = 8 // MDGCSUNRISE는 기본 8시간 투어
          const tourTimes = await calculateSunriseTourTimes(tour.tour_date, durationHours)
          setCalculatedTourTimes(tourTimes)
        } else {
          // 다른 상품의 경우 기본값으로 설정
          setCalculatedTourTimes(null)
        }
      }
    }
    calcTourTimes()
  }, [tour?.tour_date, tour?.product_id, product, calculateSunriseTourTimes])
  
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
  }: { 
    id: string
    title: string
    icon: React.ComponentType<{ className?: string }>
    children: React.ReactNode
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
          <p className="text-gray-600">{t('loadingTourInfo')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{locale === 'ko' ? '오류' : 'Error'}</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => router.push('/${locale}/guide/tours')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {t('backToTourList')}
          </button>
        </div>
      </div>
    )
  }

  if (!tour) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{locale === 'ko' ? '투어를 찾을 수 없습니다' : 'Tour not found'}</h1>
          <button 
            onClick={() => router.push('/${locale}/guide/tours')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {t('backToTourList')}
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
          onClick={() => router.push('/${locale}/guide/tours')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 text-sm sm:text-base"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('backToTourList')}
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
              <span className="text-[10px] font-medium">{t('overview')}</span>
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
              <span className="text-[10px] font-medium">{t('schedule')}</span>
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
              <span className="text-[10px] font-medium">{t('booking')}</span>
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
              <span className="text-[10px] font-medium">{t('photos')}</span>
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
              <span className="text-[10px] font-medium">{t('chat')}</span>
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
              <span className="text-[10px] font-medium">{t('expenses')}</span>
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
              <span className="text-[10px] font-medium">{t('report')}</span>
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
                <h2 className="text-lg font-semibold text-gray-900">{t('tourInfo')}</h2>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                  (tour as TourRow & { assignment_status?: string }).assignment_status === 'confirmed' ? 'bg-green-100 text-green-800' :
                  (tour as TourRow & { assignment_status?: string }).assignment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  (tour as TourRow & { assignment_status?: string }).assignment_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  (tour as TourRow & { assignment_status?: string }).assignment_status === 'recruiting' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {(tour as TourRow & { assignment_status?: string }).assignment_status || t('assignmentStatus')}
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
                👥 {totalPeople}{locale === 'ko' ? t('people') : ' people'}
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-purple-100 text-purple-800">
                🚗 {vehicle?.vehicle_number || t('unassigned')}
              </span>
            </div>
            
            {/* 가이드 정보 - 뱃지 스타일 */}
            <div className="flex flex-wrap gap-2">
              {getTeamMemberPhone(tour.tour_guide_id) ? (
                  <a 
                    href={`tel:${getTeamMemberPhone(tour.tour_guide_id) || ''}`}
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
                    href={`tel:${getTeamMemberPhone(tour.assistant_id) || ''}`}
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
                          {booking.time?.substring(0, 5) || t('timeTbd')} {getCompanyName(booking.company || '')}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                          👥 {booking.ea || 0}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
# {booking.rn_number || (locale === 'ko' ? '번호 없음' : 'No number')}
                        </span>
                </div>
                    )
                  })}
              </div>
            )}
            
                  {/* 출발 - 종료 시간 */}
                  <div className="text-gray-700">
                    {calculatedTourTimes ? (
                      <>
                        {formatDateTime(calculatedTourTimes.startTime)} - {formatDateTime(calculatedTourTimes.endTime)}
                        <div className="text-xs text-gray-500 mt-1">
{locale === 'ko' ? '일출 시간' : 'Sunrise time'}: {calculatedTourTimes.sunriseTime}
                        </div>
                      </>
                    ) : (
                      `${formatDateTime(tour.tour_start_datetime)} - ${formatDateTime(tour.tour_end_datetime)}`
                    )}
                  </div>
                </div>
              </div>
            )}
                </div>
              </div>

        {/* 밤도깨비 투어 특별 정보 - 개요 탭에만 표시 */}
        <div className={`${activeTab === 'overview' ? 'block' : 'hidden'} lg:block`}>
          <TourWeather 
            tourDate={tour.tour_date} 
            productId={(tour as TourRow & { product_id?: string }).product_id} 
          />
        </div>


        {/* 픽업 스케줄 - 오버뷰 탭에 표시 */}
        <div className={`${activeTab === 'overview' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection id="pickup-schedule" title={t('pickupSchedule')} icon={Clock}>
            <div className="space-y-4">
              {(() => {
                // 픽업 호텔별로 그룹화
                const groupedByHotel = reservations
                  .filter(reservation => reservation.pickup_hotel)
                  .reduce((acc, reservation) => {
                    const hotelId = reservation.pickup_hotel
                    if (hotelId && !acc[hotelId]) {
                      acc[hotelId] = []
                    }
                    if (hotelId) {
                      acc[hotelId].push(reservation)
                    }
                    return acc
                  }, {} as Record<string, typeof reservations>)

                return Object.entries(groupedByHotel).map(([hotelId, hotelReservations]) => {
                  const hotel = pickupHotels.find(h => h.id === hotelId)
                  const sortedReservations = hotelReservations.sort((a, b) => {
                    const timeA = a.pickup_time || '00:00'
                    const timeB = b.pickup_time || '00:00'
                    return timeA.localeCompare(timeB)
                  })

                  return (
                    <div key={hotelId} className="space-y-4">
                      {/* 구분선 - 픽업 시간 위에 */}
                      <div className="border-t border-gray-200"></div>
                      
                      {/* 호텔 정보 헤더 - 3줄 구조 */}
                      <div className="space-y-2">
                        {/* 1줄: 픽업 시간 - 더 크게 */}
                        <div className="text-blue-600 font-bold text-lg">
                          {(() => {
                            if (!sortedReservations[0]?.pickup_time) {
                              return `${t('tbd')} ${tour.tour_date}`
                            }
                            
                            const pickupTime = sortedReservations[0].pickup_time.substring(0, 5)
                            const timeHour = parseInt(pickupTime.split(':')[0])
                            
                            // 오후 9시(21:00) 이후면 날짜를 하루 빼기
                            let displayDate = tour.tour_date
                            if (timeHour >= 21) {
                              const date = new Date(tour.tour_date)
                              date.setDate(date.getDate() - 1)
                              displayDate = date.toISOString().split('T')[0]
                            }
                            
                            return `${formatTimeWithAMPM(pickupTime)} ${displayDate}`
                          })()}
                        </div>
                        
                        {/* 2줄: 호텔 정보 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Hotel className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold text-gray-900">
                              {hotel?.hotel || t('noHotelInfo')}
                            </span>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <Users className="w-3 h-3 mr-1" />
                              {sortedReservations.reduce((sum, r) => sum + (r.total_people || 0), 0)}
                            </span>
                          </div>
                          {(hotel?.link || (hotel as PickupHotel & { pin?: string })?.pin) && (
                            <a 
                              href={hotel?.link || `https://www.google.com/maps?q=${(hotel as PickupHotel & { pin?: string })?.pin}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 transition-colors"
                              title={locale === 'ko' ? '지도에서 보기' : 'View on map'}
                            >
                              <MapPin className="w-4 h-4" />
                            </a>
                          )}
                        </div>

                        {/* 3줄: 픽업 위치 정보 */}
                        {hotel?.pick_up_location && (
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-red-500" />
                            <span className="text-xs text-gray-600">{hotel.pick_up_location}</span>
                          </div>
                        )}
                      </div>

                      {/* 예약자 카드 목록 */}
                      <div className="space-y-3">
                        {sortedReservations.map((reservation) => {
                          const customer = getCustomerInfo(reservation.customer_id || '')
                          return (
                            <div key={reservation.id}>
                              <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                                {/* 상단: 국기, 이름, 인원 */}
                                <div className="flex items-center space-x-2 mb-2">
                                  {/* 언어별 국기 아이콘 */}
                                  {(() => {
                                    if (!customer?.language) return null;
                                    
                                    const language = customer.language.toLowerCase();
                                    if (language === 'kr' || language === 'ko' || language === '한국어') {
                                      return <span className="mr-1 text-sm">🇰🇷</span>;
                                    } else if (language === 'en' || language === '영어') {
                                      return <span className="mr-1 text-sm">🇺🇸</span>;
                                    } else if (language === 'jp' || language === '일본어') {
                                      return <span className="mr-1 text-sm">🇯🇵</span>;
                                    } else if (language === 'cn' || language === '중국어') {
                                      return <span className="mr-1 text-sm">🇨🇳</span>;
                                    }
                                    return null;
                                  })()}
                                  <div className="font-medium text-gray-900">
                                    {formatCustomerNameEnhanced(customer, locale)}
                                  </div>
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <Users className="w-3 h-3 mr-1" />
                                    {reservation.total_people || 0}
                                  </span>
                                </div>

                                {/* 중단: choices와 연락처 아이콘 */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm text-gray-600">
                                    {(() => {
                                      const choices = (reservation as ReservationRow & { choices?: unknown }).choices;
                                      if (!choices) return '선택사항 없음';
                                      if (typeof choices === 'string') return choices;
                                      if (typeof choices === 'object' && choices !== null) {
                                        // choices.required 배열에서 선택된 옵션들 추출
                                        const choicesObj = choices as { required?: Array<{ options?: Array<{ is_default?: boolean; name?: string; name_ko?: string }> }>; name?: string; name_ko?: string };
                                        if (choicesObj.required && Array.isArray(choicesObj.required)) {
                                          const selectedOptions = choicesObj.required
                                            .map((item) => {
                                              if (item.options && Array.isArray(item.options)) {
                                                // 기본 선택된 옵션 또는 첫 번째 옵션 선택
                                                const selectedOption = item.options.find((opt) => opt.is_default) || item.options[0];
                                                if (selectedOption) {
                                                  // 로케일에 따라 한국어 또는 영어 표시
                                                  if (locale === 'ko') {
                                                    return selectedOption.name_ko || selectedOption.name;
                                                  } else {
                                                    return selectedOption.name || selectedOption.name_ko;
                                                  }
                                                }
                                                return null;
                                              }
                                              return null;
                                            })
                                            .filter(Boolean)
                                            .join(', ');
                                          return selectedOptions || (locale === 'ko' ? '선택사항 없음' : 'No options selected');
                                        }
                                        // 기타 객체인 경우
                                        return choicesObj.name || choicesObj.name_ko || '선택사항 없음';
                                      }
                                      return String(choices);
                                    })()}
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    {customer?.phone && (
                                      <a 
                                        href={`tel:${customer.phone}`}
                                        className="text-green-600 hover:text-green-700 transition-colors"
                                        title={customer.phone}
                                      >
                                        <Phone className="w-4 h-4" />
                                      </a>
                                    )}
                                    {customer?.email && (
                                      <a 
                                        href={`mailto:${customer.email}`}
                                        className="text-blue-600 hover:text-blue-700 transition-colors"
                                        title={customer.email}
                                      >
                                        <Mail className="w-4 h-4" />
                                      </a>
                                    )}
                                  </div>
                                </div>

                                {/* 하단: event_note */}
                                {(reservation as ReservationRow & { event_note?: string }).event_note && (
                                  <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
                                    {(reservation as ReservationRow & { event_note: string }).event_note}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              })()}
              {reservations.filter(reservation => reservation.pickup_hotel).length === 0 && (
                <p className="text-gray-500 text-center py-4">{t('noPickupSchedule')}</p>
              )}
            </div>
          </AccordionSection>
        </div>

        {/* 투어 스케줄 - 스케줄 탭에만 표시 */}
        {tour.product_id && (
          <div className={`${activeTab === 'schedule' ? 'block' : 'hidden'} lg:block`}>
            <div className="bg-white rounded-lg shadow mb-3 sm:mb-4 p-3 sm:p-4">
              <TourScheduleSection 
                productId={tour.product_id} 
                teamType={tour.team_type as 'guide+driver' | '2guide' | null}
                locale={locale}
              />
            </div>
          </div>
        )}

        {/* 투어 메모 - 개요 탭에만 표시 */}
        {(tour as { tour_info?: string }).tour_info && (
          <div className={`${activeTab === 'overview' ? 'block' : 'hidden'} lg:block`}>
            <AccordionSection id="tour-memo" title={t('tourMemo')} icon={FileText}>
              <p className="text-gray-700 whitespace-pre-wrap">{(tour as unknown as { tour_info: string }).tour_info}</p>
            </AccordionSection>
          </div>
        )}
      </div>

      {/* 추가 섹션들 - 아코디언 형태 */}
      <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">

        {/* 부킹 관리 - 부킹 탭에만 표시 */}
        <div className={`${activeTab === 'bookings' ? 'block' : 'hidden'} lg:block`}>
        <AccordionSection id="bookings" title={t('bookingManagement')} icon={Hotel}>
          {/* 호텔 부킹 */}
          {tourHotelBookings.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-3">{t('hotelBooking')}</h3>
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
                      <p>{t('checkIn')}: {booking.check_in_date}</p>
                      <p>{t('checkOut')}: {booking.check_out_date}</p>
                      <p>{t('roomCount')}: {(booking as { room_count?: number }).room_count || t('noInfo')}</p>
                      {(booking as { notes?: string }).notes && <p className="mt-2">{t('memo')}: {(booking as unknown as { notes: string }).notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 티켓 부킹 */}
          {ticketBookings.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">{t('ticketBooking')}</h3>
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
                          {getCompanyName(booking.company || '')}
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
                        <p>{t('rnNumber')}: {booking.rn_number || t('noInfo')}</p>
                        <p>{t('ea')}: {booking.ea || t('noInfo')}</p>
                        <p>{t('checkInDate')}: {(booking as unknown as { check_in_date?: string }).check_in_date || t('noInfo')}</p>
                        <p>{t('checkInTime')}: {booking.time || t('noInfo')}</p>
                      {(booking as { notes?: string }).notes && <p className="mt-2">{t('memo')}: {(booking as unknown as { notes: string }).notes}</p>}
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>
          )}

          {tourHotelBookings.length === 0 && ticketBookings.length === 0 && (
            <p className="text-gray-500">{t('noBookingInfo')}</p>
          )}
        </AccordionSection>
        </div>

        {/* 투어 사진 - 사진 탭에만 표시 */}
        <div className={`${activeTab === 'photos' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection id="photos" title={t('tourPhotos')} icon={Camera}>
          <TourPhotoUpload tourId={tour.id} uploadedBy={currentUserEmail || ''} />
          </AccordionSection>
        </div>

        {/* 채팅 - 채팅 탭에만 표시 */}
        <div className={`${activeTab === 'chat' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection id="chat" title={t('chat')} icon={MessageSquare}>
            <div className="flex flex-col items-center justify-center py-8">
              <MessageSquare className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{locale === 'ko' ? '투어 채팅방' : 'Tour Chat Room'}</h3>
              <p className="text-sm text-gray-500 mb-4">{locale === 'ko' ? '투어 관련 소통을 위한 채팅방입니다.' : 'Chat room for tour-related communication.'}</p>
              <button
                onClick={() => {
                  if (tour) {
                    openChat({
                      id: `chat_${tour.id}_${Date.now()}`, // 고유한 ID 생성
                      tourId: tour.id,
                      tourDate: tour.tour_date,
                      guideEmail: currentUserEmail || "",
                      tourName: tour.id
                    })
                  }
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
{locale === 'ko' ? '채팅방 플로팅' : 'Open Chat'}
              </button>
            </div>
          </AccordionSection>
        </div>

        {/* 정산 관리 - 정산 탭에만 표시 */}
        <div className={`${activeTab === 'expenses' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection id="expenses" title={t('expenseManagement')} icon={Calculator}>
          <TourExpenseManager tourId={tour.id} tourDate={tour.tour_date} submittedBy={currentUserEmail || ''} />
          </AccordionSection>
        </div>

        {/* 투어 리포트 - 리포트 탭에만 표시 */}
        <div className={`${activeTab === 'report' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection id="report" title={t('tourReport')} icon={FileText}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">{t('reportManagement')}</h3>
              <button 
                onClick={() => setIsReportModalOpen(true)}
                className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title={t('addTourReport')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
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
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{t('addTourReport')}</h3>
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <TourReportForm 
              tourId={tour.id}
              onSuccess={() => {
                setIsReportModalOpen(false)
                // 리포트 목록 새로고침을 위해 TourReportSection이 자동으로 업데이트됨
              }}
              onCancel={() => setIsReportModalOpen(false)}
              locale={locale}
            />
          </div>
        </div>
      )}

    </div>
  )
}

