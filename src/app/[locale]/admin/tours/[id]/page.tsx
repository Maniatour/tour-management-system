/* @ts-nocheck */
/* eslint-disable */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Edit, Trash2, Copy, Plus, X, Check, Car, Settings, Hotel, Map, MapPin, Clock, User, Users, Eye } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { cache, cacheKeys } from '@/lib/cache'
import { 
  calculateAssignedPeople, 
  calculateTotalPeopleForSameProductDate, 
  calculateUnassignedPeople,
  getPendingReservations
} from '@/utils/tourUtils'
import ReservationForm from '@/components/reservation/ReservationForm'
import VehicleAssignmentModal from '@/components/VehicleAssignmentModal'
import TicketBookingForm from '@/components/booking/TicketBookingForm'
import TourHotelBookingForm from '@/components/booking/TourHotelBookingForm'
import TourPhotoUpload from '@/components/TourPhotoUpload'
import TourChatRoom from '@/components/TourChatRoom'
import TourExpenseManager from '@/components/TourExpenseManager'
import TourReportSection from '@/components/TourReportSection'
import TourWeather from '@/components/TourWeather'
import TourSunriseTime from '@/components/TourSunriseTime'
import TourScheduleSection from '@/components/product/TourScheduleSection'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

// 타입 정의 (DB 스키마 기반)
type TourRow = Database['public']['Tables']['tours']['Row']
type TourUpdate = Database['public']['Tables']['tours']['Update']
type ReservationRow = Database['public']['Tables']['reservations']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']
type PickupHotel = Database['public']['Tables']['pickup_hotels']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']

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
  const params = useParams()
  const router = useRouter()
  const { hasPermission, userRole } = useAuth()
  const isStaff = hasPermission('canManageReservations') || hasPermission('canManageTours') || (userRole === 'admin' || userRole === 'manager')
  
  const [tour, setTour] = useState<TourRow | null>(null)
  const [isPrivateTour, setIsPrivateTour] = useState<boolean>(false)
  const [showPrivateTourModal, setShowPrivateTourModal] = useState(false)
  const [pendingPrivateTourValue, setPendingPrivateTourValue] = useState<boolean>(false)
  const [connectionStatus, setConnectionStatus] = useState<{[key: string]: boolean}>({})
  const [productOptions, setProductOptions] = useState<{[productId: string]: {[optionId: string]: {id: string, name: string}}}>({})

  // 연결 상태 라벨 컴포넌트
  const ConnectionStatusLabel = ({ status, section }: { status: boolean, section: string }) => (
    <span 
      className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
        status 
          ? 'bg-green-100 text-green-800' 
          : 'bg-red-100 text-red-800'
      }`}
      title={status ? `${section} 데이터베이스 연결됨` : `${section} 데이터베이스 연결 실패`}
    >
      {status ? '✓' : '✗'}
    </span>
  )

  // 스켈레톤 UI 컴포넌트
  const SkeletonCard = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
  )

  const SkeletonText = ({ lines = 1, className = "" }: { lines?: number, className?: string }) => (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonCard key={i} className="h-4 mb-2" />
      ))}
    </div>
  )

  // 상품 옵션 정보 로드 함수
  const loadProductOptions = useCallback(async (productId: string) => {
    if (!productId) return
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Loading product options for productId:', productId)
    }
    
    try {
      const { data, error } = await supabase
        .from('product_options')
        .select('id, name')
        .eq('product_id', productId)
        .eq('is_required', true)
      
      if (error) {
        console.error('상품 옵션 로드 오류:', error)
        return
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Product options data loaded:', data)
      }
      
      const optionsMap: {[optionId: string]: {id: string, name: string}} = {}
      data?.forEach((option: any) => {
        optionsMap[option.id] = {
          id: option.id,
          name: option.name
        }
      })
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Options map created:', optionsMap)
      }
      
      // 캐시에 저장
      const productOptionsCacheKey = cacheKeys.productOptions(productId)
      cache.set(productOptionsCacheKey, optionsMap, 15 * 60 * 1000) // 15분 캐시
      
      setProductOptions(prev => ({
        ...prev,
        [productId]: optionsMap
      }))
    } catch (error) {
      console.error('상품 옵션 로드 오류:', error)
    }
  }, [])

  // 옵션 이름 가져오기 함수
  const getOptionName = (optionId: string, productId: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('getOptionName called:', { optionId, productId, productOptionsKeys: Object.keys(productOptions) })
    }
    
    const productOptionsData = productOptions[productId]
    if (!productOptionsData || !productOptionsData[optionId]) {
      // 옵션 데이터가 없으면 해당 상품의 옵션을 로드 시도
      if (productId && !productOptionsData) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Loading product options for:', productId)
        }
        loadProductOptions(productId)
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('Option not found, returning ID:', optionId, 'Available options:', productOptionsData ? Object.keys(productOptionsData) : 'No data')
      }
      return optionId // 옵션 이름을 찾을 수 없으면 ID 반환
    }
    
    const option = productOptionsData[optionId]
    const result = option.name || optionId
    if (process.env.NODE_ENV === 'development') {
      console.log('Option found:', { optionId, result, option })
    }
    return result
  }

  // 옵션 배지 색상 배열
  const optionBadgeColors = [
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-purple-100 text-purple-800',
    'bg-pink-100 text-pink-800',
    'bg-indigo-100 text-indigo-800',
    'bg-yellow-100 text-yellow-800',
    'bg-red-100 text-red-800',
    'bg-orange-100 text-orange-800',
    'bg-teal-100 text-teal-800',
    'bg-cyan-100 text-cyan-800',
    'bg-lime-100 text-lime-800',
    'bg-amber-100 text-amber-800',
    'bg-emerald-100 text-emerald-800',
    'bg-violet-100 text-violet-800',
    'bg-rose-100 text-rose-800'
  ]

  // 옵션 ID를 기반으로 색상 선택하는 함수
  const getOptionBadgeColor = (optionId: string) => {
    // 옵션 ID의 해시값을 계산하여 색상 인덱스 결정
    let hash = 0
    for (let i = 0; i < optionId.length; i++) {
      const char = optionId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 32비트 정수로 변환
    }
    const colorIndex = Math.abs(hash) % optionBadgeColors.length
    return optionBadgeColors[colorIndex]
  }

  // 데이터베이스 연결 상태 확인 함수
  const checkConnectionStatus = async () => {
    const status: {[key: string]: boolean} = {}
    
    try {
      // 투어 데이터 확인
      const { error: tourError } = await supabase
        .from('tours')
        .select('id')
        .limit(1)
      status.tours = !tourError
    } catch {
      status.tours = false
    }

    try {
      // 예약 데이터 확인
      const { error: reservationError } = await supabase
        .from('reservations')
        .select('id')
        .limit(1)
      status.reservations = !reservationError
    } catch {
      status.reservations = false
    }

    try {
      // 팀 멤버 데이터 확인
      const { error: teamError } = await supabase
        .from('team')
        .select('email')
        .limit(1)
      status.team = !teamError
    } catch {
      status.team = false
    }

    try {
      // 부킹 데이터 확인
      const { error: bookingError } = await supabase
        .from('ticket_bookings')
        .select('id')
        .limit(1)
      status.bookings = !bookingError
    } catch {
      status.bookings = false
    }

    try {
      // 호텔 부킹 데이터 확인
      const { error: hotelBookingError } = await supabase
        .from('tour_hotel_bookings')
        .select('id')
        .limit(1)
      status.hotelBookings = !hotelBookingError
    } catch {
      status.hotelBookings = false
    }

    try {
      // 차량 데이터 확인
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .select('id')
        .limit(1)
      status.vehicles = !vehicleError
    } catch {
      status.vehicles = false
    }

    setConnectionStatus(status)
  }

  // 단독투어 상태 업데이트 함수
  const updatePrivateTourStatus = async (newValue: boolean) => {
    if (!tour) return

    try {
        const updateData: Database['public']['Tables']['tours']['Update'] = { is_private_tour: newValue }
        const { error } = await (supabase as any)
          .from('tours')
          .update(updateData)
          .eq('id', tour.id)

      if (error) {
        console.error('Error updating private tour status:', error)
        alert('단독투어 상태 업데이트 중 오류가 발생했습니다.')
        return false
      }

      // 성공 시 로컬 상태 업데이트
      setIsPrivateTour(newValue)
      setTour({ ...tour, is_private_tour: newValue })
      return true
    } catch (error) {
      console.error('Error updating private tour status:', error)
      alert('단독투어 상태 업데이트 중 오류가 발생했습니다.')
      return false
    }
  }
  type ProductRow = { id: string; name_ko?: string | null; name_en?: string | null; [k: string]: unknown }
  const [product, setProduct] = useState<ProductRow | null>(null)
  type CustomerRow = { id: string; name?: string | null; email?: string | null; language?: string | null; [k: string]: unknown }
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [reservations, setReservations] = useState<ReservationRow[]>([])
  const [allReservations, setAllReservations] = useState<ReservationRow[]>([])
  const [allTours, setAllTours] = useState<TourRow[]>([])
  const [allProducts, setAllProducts] = useState<ProductRow[]>([])
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([])
  const [assignedReservations, setAssignedReservations] = useState<ReservationRow[]>([])
  const [pendingReservations, setPendingReservations] = useState<ReservationRow[]>([])
  const [otherToursAssignedReservations, setOtherToursAssignedReservations] = useState<(ReservationRow & { assigned_tour_id?: string | null })[]>([])
  const [inactiveReservations, setInactiveReservations] = useState<ReservationRow[]>([])
  const [pickupHotels, setPickupHotels] = useState<PickupHotel[]>([])
  const [pickupTimeValue, setPickupTimeValue] = useState<string>('')
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<ReservationRow | null>(null)
  type TeamMember = { email: string; name_ko: string; name_en?: string }
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamType, setTeamType] = useState<'1guide' | '2guide' | 'guide+driver'>('1guide')
  const [selectedGuide, setSelectedGuide] = useState<string>('')
  const [selectedAssistant, setSelectedAssistant] = useState<string>('')
  const [tourNote, setTourNote] = useState<string>('')
  const [loading, setLoading] = useState(true)
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
  
  // 부킹 관련 상태
  const [ticketBookings, setTicketBookings] = useState<LocalTicketBooking[]>([])
  const [tourHotelBookings, setTourHotelBookings] = useState<LocalTourHotelBooking[]>([])
  const [showTicketBookingForm, setShowTicketBookingForm] = useState<boolean>(false)
  const [showTourHotelBookingForm, setShowTourHotelBookingForm] = useState<boolean>(false)
  const [editingTicketBooking, setEditingTicketBooking] = useState<LocalTicketBooking | null>(null)
  const [editingTourHotelBooking, setEditingTourHotelBooking] = useState<LocalTourHotelBooking | null>(null)
  const [showTicketBookingDetails, setShowTicketBookingDetails] = useState<boolean>(false)

  const fetchBookings = useCallback(async (tourId: string) => {
    try {
      // 입장권 부킹 조회
      const { data: ticketBookingsData, error: ticketError } = await supabase
        .from('ticket_bookings')
        .select('*')
        .eq('tour_id', tourId)
        .order('check_in_date', { ascending: false })

      if (ticketError) {
        console.error('입장권 부킹 조회 오류:', ticketError)
      } else {
        setTicketBookings((ticketBookingsData as unknown as LocalTicketBooking[]) || [])
      }

      // 투어 호텔 부킹 조회
      const { data: tourHotelBookingsData, error: tourHotelError } = await supabase
        .from('tour_hotel_bookings')
        .select('*')
        .eq('tour_id', tourId)
        .order('check_in_date', { ascending: false })

      if (tourHotelError) {
        console.error('투어 호텔 부킹 조회 오류:', tourHotelError)
      } else {
        setTourHotelBookings((tourHotelBookingsData as unknown as LocalTourHotelBooking[]) || [])
      }
    } catch (error) {
      console.error('부킹 데이터 조회 오류:', error)
    }
  }, [])

  // 같은 날 같은 상품의 다른 투어에 배정된 예약들을 조회하여 표시
  const fetchOtherToursAssignedReservations = useCallback(async (targetTour: any) => {
    try {
      if (!targetTour || !targetTour.product_id || !targetTour.tour_date) return

      // 1) 같은 상품/날짜의 모든 투어 가져오기
      const { data: siblingTours, error: toursError } = await (supabase as any)
        .from('tours')
        .select('id, reservation_ids, product_id, tour_date')
        .eq('product_id', targetTour.product_id)
        .eq('tour_date', targetTour.tour_date)

      if (toursError) {
        console.error('Error fetching sibling tours:', toursError)
        return
      }

      // 2) 다른 투어들에서 배정된 예약 ID 수집 (현재 투어 제외)
      const assignedIds = new Set<string>()
      for (const t of (siblingTours as any[]) || []) {
        if (!t || t.id === targetTour.id) continue
        const ids = Array.isArray((t as any).reservation_ids) ? (t as any).reservation_ids : []
        for (const rid of ids) {
          if (rid) assignedIds.add(String(rid))
        }
      }

      if (assignedIds.size === 0) {
        setOtherToursAssignedReservations([])
        return
      }

      // 3) 해당 예약들을 reservations에서 조회 (상태 제한 없음)
      const idList = Array.from(assignedIds)
      const { data: resvData, error: resvError } = await (supabase as any)
        .from('reservations')
        .select('*')
        .in('id', idList)

      if (resvError) {
        console.error('Error fetching reservations by ids:', resvError)
        return
      }

      // 현재 투어에 배정된 예약은 제외하고, 상태는 recruiting/confirmed만 표시 (대소문자 무시)
      const currentTourReservationIds: string[] = Array.isArray((targetTour as any)?.reservation_ids)
        ? ((targetTour as any).reservation_ids as any[]).map((v: any) => String(v))
        : []

      const filtered = ((resvData as any[]) || [])
        .filter((r: any) => {
          const s = String(r?.status || '').toLowerCase()
          return s === 'recruiting' || s === 'confirmed'
        })
        .filter((r: any) => r?.product_id === targetTour.product_id && r?.tour_date === targetTour.tour_date)
        .filter((r: any) => !currentTourReservationIds.includes(String(r?.id)))

      setOtherToursAssignedReservations(filtered)
    } catch (error) {
      console.error('다른 투어 배정 예약 조회 오류:', error)
    }
  }, [])

  const fetchTourData = useCallback(async (tourId: string) => {
    try {
      setLoading(true)
      setLoadingStates(prev => ({ ...prev, tour: true }))
      
      // 1단계: 핵심 투어 데이터만 먼저 로드 (캐시 확인)
      let tourData = cache.get(cacheKeys.tour(tourId))
      if (!tourData) {
        const { data, error: tourError } = await supabase
        .from('tours')
        .select('*')
        .eq('id', tourId)
        .single()

      if (tourError) {
        console.error('Error fetching tour:', tourError)
        return
      }

        tourData = data
      if (tourData) {
          cache.set(cacheKeys.tour(tourId), tourData, 10 * 60 * 1000) // 10분 캐시
        }
      }

      if (tourData) {
        if (process.env.NODE_ENV === 'development') {
        console.log('Tour data:', tourData)
        }
        const td = tourData as any
        const processedTourData: TourRow = {
          ...(td as TourRow),
          is_private_tour: (td?.is_private_tour === 'TRUE' || td?.is_private_tour === true) as any
        }
        
        // 기본 투어 정보 즉시 설정
        setTour(processedTourData)
        setIsPrivateTour(!!processedTourData.is_private_tour)
        setLoadingStates(prev => ({ ...prev, tour: false }))
        
        // 팀 구성 정보 설정
        if (td?.tour_guide_id) {
          setSelectedGuide(td.tour_guide_id as string)
          if (process.env.NODE_ENV === 'development') {
            console.log('Setting selected guide:', td.tour_guide_id)
          }
        }
        if (td?.assistant_id) {
          setSelectedAssistant(td.assistant_id as string)
          if (process.env.NODE_ENV === 'development') {
            console.log('Setting selected assistant:', td.assistant_id)
          }
        }
        if (td?.team_type) {
          setTeamType(td.team_type as '1guide' | '2guide' | 'guide+driver')
          if (process.env.NODE_ENV === 'development') {
            console.log('Setting team type:', td.team_type)
          }
        }
        if (td?.tour_note) setTourNote(td.tour_note as string)

        // 2단계: 병렬로 핵심 데이터 로드 (상품, 예약, 고객)
        setLoadingStates(prev => ({ ...prev, reservations: true }))
        const coreDataPromises = []
        
        // 상품 정보 (캐시 확인)
        if (td?.product_id) {
          const productCacheKey = cacheKeys.product(td.product_id)
          let productData = cache.get(productCacheKey)
          
          if (productData) {
            setProduct(productData as ProductRow)
            coreDataPromises.push(Promise.resolve(productData))
          } else {
            coreDataPromises.push(
              supabase
            .from('products')
            .select('*')
                .eq('id', td.product_id)
            .single()
                .then(({ data: productData }) => {
                  if (productData) {
                    cache.set(productCacheKey, productData, 15 * 60 * 1000) // 15분 캐시
                  }
          setProduct(productData)
                  return productData
                })
            )
          }
          
          // 예약 데이터 (캐시 확인)
          const reservationsCacheKey = cacheKeys.reservations(td.product_id, td.tour_date)
          let reservationsData = cache.get(reservationsCacheKey)
          
          if (reservationsData) {
            const reservations = (reservationsData as ReservationRow[]) || []
            setReservations(reservations)
            setAllReservations(reservations)
            
            const inactive = reservations.filter((r: any) => {
              const s = (r.status || '').toString().toLowerCase()
              return s !== 'confirmed' && s !== 'recruiting'
            })
            setInactiveReservations(inactive)
            
            coreDataPromises.push(Promise.resolve(reservations))
          } else {
            coreDataPromises.push(
              supabase
            .from('reservations')
            .select('*')
                .eq('product_id', td.product_id)
                .eq('tour_date', td.tour_date)
                .then(({ data: allReservations, error: reservationError }) => {
          if (reservationError) {
            console.error('Error fetching reservations:', reservationError)
                    return []
          }

                  const reservations = allReservations || []
                  cache.set(reservationsCacheKey, reservations, 5 * 60 * 1000) // 5분 캐시
                  
          setReservations(reservations)
                  setAllReservations(reservations)
                  
                  // 비활성 예약들
                  const inactive = reservations.filter((r: any) => {
            const s = (r.status || '').toString().toLowerCase()
            return s !== 'confirmed' && s !== 'recruiting'
          })
          setInactiveReservations(inactive)
                  
                  return reservations
                })
            )
        }
        
          // 같은 상품/날짜의 모든 투어
          coreDataPromises.push(
            supabase
          .from('tours')
          .select('*')
              .eq('product_id', td.product_id)
              .eq('tour_date', td.tour_date)
              .then(({ data: allToursData, error: toursError }) => {
        if (toursError) {
          console.error('Error fetching all tours:', toursError)
                  return []
                }
          setAllTours(allToursData || [])
                return allToursData || []
              })
          )
        }

        // 핵심 데이터 병렬 로드 완료 대기
        const coreResults = await Promise.all(coreDataPromises)
        const reservations = (coreResults[1] as ReservationRow[]) || []
        setLoadingStates(prev => ({ ...prev, reservations: false }))
        
        // 3단계: 고객 정보 로드 (예약이 있는 경우에만, 캐시 확인)
        if (reservations.length > 0) {
          setLoadingStates(prev => ({ ...prev, customers: true }))
        const customerIds = reservations.map(r => (r as any).customer_id).filter(Boolean) as string[]
        if (customerIds.length > 0) {
            const customersCacheKey = cacheKeys.customers(customerIds)
            let customerData = cache.get(customersCacheKey)
            
            if (customerData) {
              setCustomers(customerData as CustomerRow[])
            } else {
              const { data } = await supabase
            .from('customers')
            .select('*')
            .in('id', customerIds)
          
              if (data) {
                cache.set(customersCacheKey, data, 10 * 60 * 1000) // 10분 캐시
                setCustomers(data as CustomerRow[])
              }
            }
          }
          setLoadingStates(prev => ({ ...prev, customers: false }))
        }

        // 4단계: 배정된 예약들 처리
        if (reservations.length > 0) {
        const assignedReservations = reservations.filter(r => 
          (td?.reservation_ids as string[] | null)?.includes((r as any).id) &&
          ((r as any).status?.toLowerCase() === 'recruiting' || (r as any).status?.toLowerCase() === 'confirmed')
        ) as ReservationRow[]
          
        setAssignedReservations(assignedReservations)

          const pendingReservations = getPendingReservations(td as any, reservations as any)
        setPendingReservations(pendingReservations as any)
      }

        // 5단계: 배정된 차량 정보 (있는 경우에만)
        if (td?.tour_car_id) {
          const { data: vehicleData } = await supabase
            .from('vehicles')
            .select('*')
            .eq('id', td.tour_car_id)
            .single()

          if (vehicleData) {
            setAssignedVehicle(vehicleData)
            setSelectedVehicleId(td.tour_car_id)
            if (process.env.NODE_ENV === 'development') {
              console.log('Assigned vehicle loaded:', vehicleData)
            }
          }
        }

        // 6단계: 팀 멤버 데이터 로드 (팀 구성 표시를 위해 필요)
        const teamCacheKey = cacheKeys.team()
        let teamData = cache.get(teamCacheKey)
        
        if (teamData) {
          setTeamMembers(teamData as TeamMember[])
        } else {
          try {
            const { data } = await supabase
              .from('team')
              .select('email, name_ko, name_en')
              .eq('position', 'Tour Guide')
              .eq('is_active', true)
            
            if (data) {
              const team = (data as TeamMember[]) || []
              cache.set(teamCacheKey, team, 15 * 60 * 1000) // 15분 캐시
              setTeamMembers(team)
              if (process.env.NODE_ENV === 'development') {
                console.log('Team members loaded:', team.length, 'members')
              }
            }
          } catch (error) {
            console.error('Error loading team members:', error)
          }
        }

        // 7단계: 상품 옵션 데이터 로드 (배정 관리에서 옵션 이름 표시를 위해 필요)
        if (td?.product_id) {
          const productOptionsCacheKey = cacheKeys.productOptions(td.product_id)
          let productOptionsData = cache.get(productOptionsCacheKey)
          
          if (productOptionsData) {
            setProductOptions(prev => ({
              ...prev,
              [td.product_id]: productOptionsData
            }))
            if (process.env.NODE_ENV === 'development') {
              console.log('Product options loaded from cache for:', td.product_id)
            }
          } else {
            try {
              const { data, error } = await supabase
                .from('product_options')
                .select('id, name')
                .eq('product_id', td.product_id)
                .eq('is_required', true)
              
              if (error) {
                console.error('상품 옵션 로드 오류:', error)
              } else if (data) {
                const optionsMap: {[optionId: string]: {id: string, name: string}} = {}
                data.forEach((option: any) => {
                  optionsMap[option.id] = {
                    id: option.id,
                    name: option.name
                  }
                })
                
                cache.set(productOptionsCacheKey, optionsMap, 15 * 60 * 1000) // 15분 캐시
                setProductOptions(prev => ({
                  ...prev,
                  [td.product_id]: optionsMap
                }))
                
                if (process.env.NODE_ENV === 'development') {
                  console.log('Product options loaded from DB for:', td.product_id, 'Options:', optionsMap)
                }
              }
            } catch (error) {
              console.error('Error loading product options:', error)
            }
          }
        }

        // 8단계: 픽업 호텔 데이터 로드 (배정 관리에서 호텔 정보 표시를 위해 필요)
        const hotelsCacheKey = cacheKeys.pickupHotels()
        let hotelsData = cache.get(hotelsCacheKey) as PickupHotel[] | null
        
        if (hotelsData) {
          setPickupHotels(hotelsData)
          if (process.env.NODE_ENV === 'development') {
            console.log('Pickup hotels loaded from cache:', hotelsData.length, 'hotels')
          }
        } else {
          try {
            const { data, error } = await supabase
              .from('pickup_hotels')
              .select('*')
            
            if (error) {
              console.error('Error loading pickup hotels:', error)
            } else if (data) {
              const hotels = (data as PickupHotel[]) || []
              cache.set(hotelsCacheKey, hotels, 30 * 60 * 1000) // 30분 캐시
              setPickupHotels(hotels)
              if (process.env.NODE_ENV === 'development') {
                console.log('Pickup hotels loaded from DB:', hotels.length, 'hotels')
              }
            }
          } catch (error) {
            console.error('Error loading pickup hotels:', error)
          }
        }

        // 9단계: 부킹 데이터 (백그라운드에서 로드)
        setLoadingStates(prev => ({ ...prev, bookings: true }))
        fetchBookings(tourId).finally(() => {
          setLoadingStates(prev => ({ ...prev, bookings: false }))
        }).catch(console.error)
      }
    } catch (error) {
      console.error('Error fetching tour data:', error)
    } finally {
      setLoading(false)
    }
  }, [fetchBookings])

  // tour, allReservations, allTours가 모두 설정된 후 다른 투어에 배정된 예약들 가져오기
  useEffect(() => {
    if (tour && allReservations && allReservations.length > 0 && allTours && allTours.length > 0) {
      fetchOtherToursAssignedReservations(tour)
    }
  }, [tour, allReservations, allTours, fetchOtherToursAssignedReservations])

  useEffect(() => {
    const tourId = params.id as string
    if (tourId) {
      fetchTourData(tourId)
    }
    checkConnectionStatus()
  }, [params.id])

  // 투어가 로드되면 상품 옵션도 로드 (지연 로딩)
  useEffect(() => {
    if (tour?.product_id) {
      // 상품 옵션은 필요할 때만 로드
      loadProductOptions(tour.product_id)
    }
  }, [tour?.product_id, loadProductOptions])

  // 지연 로딩: 모달이 열릴 때만 전체 데이터 로드
  const loadModalData = useCallback(async () => {
    if (allProducts.length > 0 && channels.length > 0 && teamMembers.length > 0) {
      return // 이미 로드됨
    }

    try {
      setLoadingStates(prev => ({ ...prev, modal: true }))
      const promises = []
      
      // 전체 상품 목록 (모달용, 캐시 확인)
      if (allProducts.length === 0) {
        const productsCacheKey = cacheKeys.products()
        let productsData = cache.get(productsCacheKey)
        
        if (productsData) {
          setAllProducts(productsData as ProductRow[])
          promises.push(Promise.resolve(productsData))
        } else {
          promises.push(
            supabase
              .from('products')
              .select('*')
              .order('name')
              .then(({ data }) => {
                const products = data || []
                cache.set(productsCacheKey, products, 30 * 60 * 1000) // 30분 캐시
                setAllProducts(products)
                return products
              })
          )
        }
      }

      // 채널 목록 (모달용, 캐시 확인)
      if (channels.length === 0) {
        const channelsCacheKey = cacheKeys.channels()
        let channelsData = cache.get(channelsCacheKey)
        
        if (channelsData) {
          setChannels(channelsData as any[])
          promises.push(Promise.resolve(channelsData))
        } else {
          promises.push(
            supabase
              .from('channels')
              .select('*')
              .order('name')
              .then(({ data }) => {
                const channels = (data as any[]) || []
                cache.set(channelsCacheKey, channels, 30 * 60 * 1000) // 30분 캐시
                setChannels(channels)
                return channels
              })
          )
        }
      }

      // 팀 멤버 정보 (모달용, 캐시 확인)
      if (teamMembers.length === 0) {
        const teamCacheKey = cacheKeys.team()
        let teamData = cache.get(teamCacheKey)
        
        if (teamData) {
          setTeamMembers(teamData as TeamMember[])
          promises.push(Promise.resolve(teamData))
        } else {
          promises.push(
            supabase
              .from('team')
              .select('email, name_ko, name_en')
              .eq('position', 'Tour Guide')
              .eq('is_active', true)
              .then(({ data }) => {
                const team = (data as TeamMember[]) || []
                cache.set(teamCacheKey, team, 15 * 60 * 1000) // 15분 캐시
                setTeamMembers(team)
                return team
              })
          )
        }
      }

      // 픽업 호텔 정보 (모달용, 캐시 확인)
      if (pickupHotels.length === 0) {
        const hotelsCacheKey = cacheKeys.pickupHotels()
        let hotelsData = cache.get(hotelsCacheKey)
        
        if (hotelsData) {
          setPickupHotels(hotelsData as PickupHotel[])
          promises.push(Promise.resolve(hotelsData))
        } else {
          promises.push(
            supabase
              .from('pickup_hotels')
              .select('*')
              .then(({ data }) => {
                const hotels = (data as PickupHotel[]) || []
                cache.set(hotelsCacheKey, hotels, 30 * 60 * 1000) // 30분 캐시
                setPickupHotels(hotels)
                return hotels
              })
          )
        }
      }

      await Promise.all(promises)
    } catch (error) {
      console.error('Error loading modal data:', error)
    } finally {
      setLoadingStates(prev => ({ ...prev, modal: false }))
    }
  }, [allProducts.length, channels.length, teamMembers.length, pickupHotels.length])

  const fetchVehicles = useCallback(async () => {
    try {
      if (!tour) return

      setVehiclesLoading(true)
      setVehiclesError('')

      // 같은 날짜의 다른 투어들에서 이미 배정된 차량 ID들을 가져오기
      const { data: assignedVehicles, error: assignedError } = await (supabase as any)
        .from('tours')
        .select('tour_car_id')
        .eq('tour_date', (tour as any).tour_date)
        .not('id', 'eq', tour.id)
        .not('tour_car_id', 'is', null)

      if (assignedError) throw assignedError

      const assignedVehicleIds = (assignedVehicles as any[])?.map((t: any) => t?.tour_car_id).filter(Boolean) || []

      // 사용 가능한 차량들만 가져오기
      let query = (supabase as any)
        .from('vehicles')
        .select('*')
        .order('vehicle_category', { ascending: true })
        .order('vehicle_number', { ascending: true })

      // 배정된 차량이 있는 경우에만 제외 조건 추가
      if (assignedVehicleIds.length > 0) {
        query = query.not('id', 'in', `(${assignedVehicleIds.join(',')})`)
      }

      const { data, error } = await query

      if (error) throw error
      
      // 렌터카의 경우 렌탈 기간에 투어 날짜가 포함되는지 확인
      const availableVehicles = ((data as any[]) || []).filter((vehicle: any) => {
        if (vehicle?.vehicle_category === 'company' || !vehicle?.vehicle_category) {
          return true // 회사차는 항상 사용 가능
        }
        
        if (vehicle?.vehicle_category === 'rental') {
          // 렌터카의 경우 렌탈 기간 확인
          if (!vehicle?.rental_start_date || !vehicle?.rental_end_date) {
            return false // 렌탈 기간이 설정되지 않은 렌터카는 제외
          }
          
          const tourDate = new Date((tour as any).tour_date || '1970-01-01')
          const rentalStartDate = new Date(vehicle?.rental_start_date)
          const rentalEndDate = new Date(vehicle?.rental_end_date)
          
          // 투어 날짜가 렌탈 기간에 포함되는지 확인
          return tourDate >= rentalStartDate && tourDate <= rentalEndDate
        }
        
        return true
      })
      
      setVehicles(availableVehicles)
    } catch (error) {
      console.error('차량 목록을 불러오는 중 오류가 발생했습니다:', error)
      setVehiclesError(error instanceof Error ? error.message : '차량 데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setVehiclesLoading(false)
    }
  }, [tour])

  // tour가 설정되면 사용 가능한 차량 목록 가져오기
  useEffect(() => {
    if (tour) {
      fetchVehicles()
    }
  }, [tour])

  const handleVehicleAssignmentComplete = () => {
    // 차량 배정 완료 후 데이터 새로고침
    if (tour) {
      fetchTourData(tour.id)
    }
  }

  const handleVehicleSelect = async (vehicleId: string) => {
    if (!tour) return

    try {
      setSelectedVehicleId(vehicleId)
      
      // 투어에 차량 배정 업데이트
      const { error } = await (supabase as any)
        .from('tours')
        .update({ tour_car_id: vehicleId || null } as Database['public']['Tables']['tours']['Update'])
        .eq('id', tour.id)

      if (error) throw error

      // 배정된 차량 정보 업데이트
      if (vehicleId) {
        const selectedVehicle = vehicles.find(v => v.id === vehicleId)
        setAssignedVehicle(selectedVehicle || null)
      } else {
        setAssignedVehicle(null)
      }

      console.log('차량 배정이 업데이트되었습니다:', vehicleId)
    } catch (error) {
      console.error('차량 배정 중 오류가 발생했습니다:', error)
      alert('차량 배정 중 오류가 발생했습니다.')
    }
  }

  const handleAssignReservation = async (reservationId: string) => {
    if (!tour) return

    try {
      const currentReservationIds = (tour as any).reservation_ids || []
      const updatedReservationIds = [...currentReservationIds, reservationId]

      const { error } = await (supabase as any)
        .from('tours')
        .update({ reservation_ids: updatedReservationIds } as Database['public']['Tables']['tours']['Update'])
        .eq('id', tour.id)

      if (error) {
        console.error('Error assigning reservation:', error)
        return
      }

      // 로컬 상태 업데이트
      const reservation = pendingReservations.find(r => r.id === reservationId)
      if (reservation) {
        setAssignedReservations([...assignedReservations, reservation])
        setPendingReservations(pendingReservations.filter(r => r.id !== reservationId))
        
        // 투어 상태 업데이트
        setTour({ ...tour, reservation_ids: updatedReservationIds })
      }
    } catch (error) {
      console.error('Error assigning reservation:', error)
    }
  }

  const handleUnassignReservation = async (reservationId: string) => {
    if (!tour) return

    try {
      const currentReservationIds = (tour as any).reservation_ids || []
      const updatedReservationIds = currentReservationIds.filter((id: string) => id !== reservationId)

      const { error } = await (supabase as any)
        .from('tours')
        .update({ reservation_ids: updatedReservationIds } as Database['public']['Tables']['tours']['Update'])
        .eq('id', tour.id)

      if (error) {
        console.error('Error unassigning reservation:', error)
        return
      }

      // 로컬 상태 업데이트
      const reservation = assignedReservations.find(r => r.id === reservationId)
      if (reservation) {
        setPendingReservations([...pendingReservations, reservation])
        setAssignedReservations(assignedReservations.filter(r => r.id !== reservationId))
        
        // 투어 상태 업데이트
        setTour({ ...tour, reservation_ids: updatedReservationIds })
      }
    } catch (error) {
      console.error('Error unassigning reservation:', error)
    }
  }

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId)
    return customer ? customer.name : 'Unknown Customer'
  }

  const getCustomerLanguage = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId)
    return customer ? customer.language : 'Unknown'
  }

  const getPickupHotelName = (pickupHotelId: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('getPickupHotelName called:', { pickupHotelId, pickupHotelsCount: pickupHotels.length })
    }
    
    const hotel = pickupHotels.find(h => h.id === pickupHotelId)
    if (hotel) {
      const result = `${hotel.hotel} - ${hotel.pick_up_location}`
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
    const hotel = pickupHotels.find(h => h.id === pickupHotelId)
    return hotel ? hotel.hotel : pickupHotelId || '픽업 호텔 미지정'
  }

  const getCountryCode = (language: string) => {
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

  const getTotalAssignedPeople = useMemo(() => {
    if (!tour || !allReservations || allReservations.length === 0) return 0
    return calculateAssignedPeople(tour as any, allReservations as any)
  }, [tour, allReservations])

  // 필터(confirmed/recruiting) 합계
  const getTotalPeopleFiltered = useMemo(() => {
    if (!tour || !allReservations || allReservations.length === 0) return 0
    return allReservations
      .filter((r: any) => r.product_id === tour.product_id && r.tour_date === tour.tour_date)
      .filter((r: any) => {
        const s = (r.status || '').toString().toLowerCase()
        return s === 'confirmed' || s === 'recruiting'
      })
      .reduce((sum: number, r: any) => sum + (r.total_people || 0), 0)
  }, [tour, allReservations])

  // 전체 합계 (상태 무관)
  const getTotalPeopleAll = useMemo(() => {
    if (!tour || !allReservations || allReservations.length === 0) return 0
    return allReservations
      .filter((r: any) => r.product_id === tour.product_id && r.tour_date === tour.tour_date)
      .reduce((sum: number, r: any) => sum + (r.total_people || 0), 0)
  }, [tour, allReservations])

  const handleAssignAllReservations = async () => {
    if (!tour || pendingReservations.length === 0) return

    try {
      const currentReservationIds = (tour as any).reservation_ids || []
      const newReservationIds = pendingReservations.map(r => r.id)
      const updatedReservationIds = [...currentReservationIds, ...newReservationIds]

      const { error } = await (supabase as any)
        .from('tours')
        .update({ reservation_ids: updatedReservationIds } as Database['public']['Tables']['tours']['Update'])
        .eq('id', tour.id)

      if (error) {
        console.error('Error assigning all reservations:', error)
        return
      }

      // 로컬 상태 업데이트
      setAssignedReservations([...assignedReservations, ...pendingReservations])
      setPendingReservations([])
      setTour({ ...tour, reservation_ids: updatedReservationIds })
    } catch (error) {
      console.error('Error assigning all reservations:', error)
    }
  }

  const handleUnassignAllReservations = async () => {
    if (!tour || assignedReservations.length === 0) return

    try {
      const { error } = await (supabase as any)
        .from('tours')
        .update({ reservation_ids: [] } as Database['public']['Tables']['tours']['Update'])
        .eq('id', tour.id)

      if (error) {
        console.error('Error unassigning all reservations:', error)
        return
      }

      // 로컬 상태 업데이트
      setPendingReservations([...pendingReservations, ...assignedReservations])
      setAssignedReservations([])
      setTour({ ...tour, reservation_ids: [] })
    } catch (error) {
      console.error('Error unassigning all reservations:', error)
    }
  }

  // 다른 투어에서 고객을 빼고 현재 투어로 재배정
  const handleReassignFromOtherTour = async (reservationId: string, fromTourId: string) => {
    if (!tour) return

    try {
      // 1. 다른 투어에서 해당 예약 제거
      const { data: fromTour, error: fromTourError } = await supabase
        .from('tours')
        .select('reservation_ids')
        .eq('id', fromTourId)
        .single()

      if (fromTourError) {
        console.error('Error fetching from tour:', fromTourError)
        return
      }

      const updatedFromTourReservations = ((fromTour as any).reservation_ids || []).filter((id: string) => id !== reservationId)
      
      const { error: removeError } = await (supabase as any)
        .from('tours')
        .update({ reservation_ids: updatedFromTourReservations } as Database['public']['Tables']['tours']['Update'])
        .eq('id', fromTourId)

      if (removeError) {
        console.error('Error removing reservation from other tour:', removeError)
        return
      }

      // 2. 현재 투어에 해당 예약 추가
      const currentReservationIds = (tour as any).reservation_ids || []
      const updatedCurrentTourReservations = [...currentReservationIds, reservationId]

      const { error: addError } = await (supabase as any)
        .from('tours')
        .update({ reservation_ids: updatedCurrentTourReservations } as Database['public']['Tables']['tours']['Update'])
        .eq('id', tour.id)

      if (addError) {
        console.error('Error adding reservation to current tour:', addError)
        return
      }

      // 3. 로컬 상태 업데이트
      const reservation = otherToursAssignedReservations.find(r => r.id === reservationId)
      if (reservation) {
        // 다른 투어 배정 목록에서 제거
        setOtherToursAssignedReservations(prev => 
          prev.filter(r => r.id !== reservationId)
        )
        
        // 현재 투어 배정 목록에 추가
        setAssignedReservations(prev => [...prev, reservation])
        
        // 투어 상태 업데이트
        setTour({ ...tour, reservation_ids: updatedCurrentTourReservations })
      }

      console.log(`예약 ${reservationId}를 투어 ${fromTourId}에서 투어 ${tour.id}로 재배정했습니다.`)
    } catch (error) {
      console.error('Error reassigning reservation:', error)
    }
  }

  const handleEditPickupTime = (reservation: any) => {
    setSelectedReservation(reservation)
    // Convert database time format (HH:MM:SS) to input format (HH:MM)
    const timeValue = reservation.pickup_time ? reservation.pickup_time.substring(0, 5) : '08:00'
    setPickupTimeValue(timeValue)
    setShowTimeModal(true)
  }

  const handleSavePickupTime = async () => {
    if (!selectedReservation) return

    try {
      // Convert time string to proper format for database
      const timeValue = pickupTimeValue ? `${pickupTimeValue}:00` : null
      
      const { error } = await (supabase as any)
        .from('reservations')
        .update({ pickup_time: timeValue } as Database['public']['Tables']['reservations']['Update'])
        .eq('id', selectedReservation.id)

      if (error) {
        console.error('Error updating pickup time:', error)
        return
      }

      // Update local state
      setAssignedReservations(prev => 
        prev.map(res => 
          res.id === selectedReservation.id 
            ? { ...res, pickup_time: pickupTimeValue }
            : res
        )
      )
      setPendingReservations(prev => 
        prev.map(res => 
          res.id === selectedReservation.id 
            ? { ...res, pickup_time: pickupTimeValue }
            : res
        )
      )

      setShowTimeModal(false)
      setSelectedReservation(null)
      setPickupTimeValue('')
    } catch (error) {
      console.error('Error saving pickup time:', error)
    }
  }

  const handleCancelEditPickupTime = () => {
    setShowTimeModal(false)
    setSelectedReservation(null)
    setPickupTimeValue('')
  }

  const openGoogleMaps = (link: string) => {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer')
    }
  }

  const handleTeamTypeChange = async (type: '1guide' | '2guide' | 'guide+driver') => {
    // 모든 투어에서 모든 팀 타입 선택 가능
    
    setTeamType(type)
    setSelectedGuide('')
    setSelectedAssistant('')
    
    if (tour) {
      try {
        const updateData: { team_type: string; assistant_id?: string | null } = { team_type: type }
        if (type === '1guide') {
          updateData.assistant_id = null
        }
        
        const { error } = await (supabase as any)
          .from('tours')
          .update(updateData as Database['public']['Tables']['tours']['Update'])
          .eq('id', tour.id)

        if (error) {
          console.error('Error updating team type:', error)
        } else {
          console.log('Team type updated successfully:', type)
        }
      } catch (error) {
        console.error('Error updating team type:', error)
      }
    }
  }

  const handleGuideSelect = async (guideEmail: string) => {
    setSelectedGuide(guideEmail)
    if (tour) {
      try {
        const updateData: { tour_guide_id: string; assistant_id?: string | null } = { tour_guide_id: guideEmail }
        if (teamType === '1guide') {
          updateData.assistant_id = null
        }
        
        const { error } = await (supabase as any)
          .from('tours')
          .update(updateData as Database['public']['Tables']['tours']['Update'])
          .eq('id', tour.id)

        if (error) {
          console.error('Error updating guide:', error)
        }
      } catch (error) {
        console.error('Error updating guide:', error)
      }
    }
  }

  const handleAssistantSelect = async (assistantEmail: string) => {
    setSelectedAssistant(assistantEmail)
    if (tour) {
      try {
        const { error } = await (supabase as any)
          .from('tours')
          .update({ assistant_id: assistantEmail } as Database['public']['Tables']['tours']['Update'])
          .eq('id', tour.id)

        if (error) {
          console.error('Error updating assistant:', error)
        }
      } catch (error) {
        console.error('Error updating assistant:', error)
      }
    }
  }

  const getTeamMemberName = (email: string) => {
    const member = teamMembers.find(member => member.email === email)
    return member ? (member.name_ko || member.name_en || email) : '직원 미선택'
  }

  const handleTourNoteChange = async (note: string) => {
    setTourNote(note)
    if (tour) {
      try {
        const { error } = await (supabase as any)
          .from('tours')
          .update({ tour_note: note } as Database['public']['Tables']['tours']['Update'])
          .eq('id', tour.id)

        if (error) {
          console.error('Error updating tour note:', error)
        }
      } catch (error) {
        console.error('Error updating tour note:', error)
      }
    }
  }

  // 예약 편집 모달 열기
  const handleEditReservationClick = async (reservation: any) => {
    if (!isStaff) return
    
    // 모달 데이터 로드 (필요한 경우에만)
    await loadModalData()
    setEditingReservation(reservation)
  }

  // 예약 편집 모달 닫기
  const handleCloseEditModal = async () => {
    setEditingReservation(null)
  }

  // 부킹 관련 핸들러들
  const handleAddTicketBooking = () => {
    setEditingTicketBooking(null)
    setShowTicketBookingForm(true)
  }

  const handleEditTicketBooking = (booking: LocalTicketBooking) => {
    setEditingTicketBooking(booking)
    setShowTicketBookingForm(true)
  }

  const handleCloseTicketBookingForm = () => {
    setShowTicketBookingForm(false)
    setEditingTicketBooking(null)
  }

  const handleAddTourHotelBooking = () => {
    setEditingTourHotelBooking(null)
    setShowTourHotelBookingForm(true)
  }

  const handleEditTourHotelBooking = (booking: LocalTourHotelBooking) => {
    setEditingTourHotelBooking(booking)
    setShowTourHotelBookingForm(true)
  }

  const handleCloseTourHotelBookingForm = () => {
    setShowTourHotelBookingForm(false)
    setEditingTourHotelBooking(null)
  }

  const handleBookingSubmit = async (booking: LocalTicketBooking | LocalTourHotelBooking) => {
    // 부킹 제출 후 데이터 새로고침
    if (tour) {
      await fetchBookings(tour.id)
    }
    console.log('부킹이 저장되었습니다:', booking)
  }

  // 필터링된 입장권 부킹 계산
  const filteredTicketBookings = showTicketBookingDetails 
    ? ticketBookings 
    : ticketBookings.filter(booking => booking.status?.toLowerCase() === 'confirmed')

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'inProgress': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'delayed': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string | null) => {
    switch (status) {
      case 'scheduled': return '예정'
      case 'inProgress': return '진행중'
      case 'completed': return '완료'
      case 'cancelled': return '취소'
      case 'delayed': return '지연'
      default: return '미정'
    }
  }

  if (loading) {
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

  if (!tour) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">투어를 찾을 수 없습니다.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-2 sm:px-6 py-2 sm:py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push(`/${params.locale}/admin/tours`)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} />
          </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">
                    {product?.name_ko || '투어 상세'}
                  </h1>
                  {/* 일출 시간 표시 (투어 날짜 기반) */}
                  <TourSunriseTime tourDate={tour.tour_date} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600 mt-1">
                  <span>투어 ID: {tour.id}</span>
                  <span className="hidden sm:inline">|</span>
                  <span>날짜: {tour.tour_date ? new Date(tour.tour_date + 'T00:00:00').toLocaleDateString('ko-KR', {timeZone: 'America/Los_Angeles'}) : ''}</span>
                  <span className="hidden sm:inline">|</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tour.tour_status)}`}>
                    {getStatusText(tour.tour_status)}
                  </span>
        </div>
              </div>
        </div>
            {/* 모바일 요약/액션 (아이콘) */}
            <div className="flex sm:hidden items-center justify-between w-full mt-1">
              <div className="bg-blue-50 rounded px-2 py-1 border border-blue-200 text-blue-700 text-xs font-semibold">
                {getTotalAssignedPeople} / {getTotalPeopleFiltered} ({Math.max(getTotalPeopleAll - getTotalPeopleFiltered, 0)})
              </div>
              <div className="flex items-center space-x-1">
                <button className="p-1.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  <Copy size={16} />
                </button>
                <button className="p-1.5 text-red-700 bg-red-100 rounded-lg hover:bg-red-200">
                  <Trash2 size={16} />
                </button>
                <button className="p-1.5 text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200">
                  <Edit size={16} />
                </button>
              </div>
            </div>

            {/* 데스크톱 요약/액션 */}
            <div className="hidden sm:flex items-center space-x-6">
              {/* 총 배정 인원 표시 */}
              <div className="text-center bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
                <div className="text-3xl font-bold text-blue-600">
                  {getTotalAssignedPeople}명 / {getTotalPeopleFiltered}명 ({Math.max(getTotalPeopleAll - getTotalPeopleFiltered, 0)}명)
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  이 투어 배정 / 해당일 같은 상품의 Recruiting·Confirmed 합계 (상태무관 차이)
                </div>
              </div>
              <div className="flex space-x-2">
                <button className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center space-x-2">
                  <Copy size={16} />
                  <span>복사</span>
                </button>
                <button className="px-4 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200 flex items-center space-x-2">
                  <Trash2 size={16} />
                  <span>삭제</span>
                </button>
                <button className="px-4 py-2 text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 flex items-center space-x-2">
                  <Edit size={16} />
                  <span>편집</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-0 py-6">
        {/* 4열 그리드 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 1열: 기본 정보, 픽업 스케줄, 옵션 관리 */}
          <div className="space-y-6">
        {/* 기본 정보 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4">
                <h2 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                  기본 정보
                  <ConnectionStatusLabel status={connectionStatus.tours} section="투어" />
                </h2>
                <div className="space-y-2">
            <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">투어명:</span>
                    <span className="font-medium text-sm">{product?.name_ko || '-'}</span>
            </div>
            <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">투어 날짜:</span>
                    <span className="font-medium text-sm">{tour.tour_date ? new Date(tour.tour_date + 'T00:00:00').toLocaleDateString('ko-KR', {timeZone: 'America/Los_Angeles'}) : ''}</span>
            </div>
            <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">투어 시간:</span>
                    <span className="font-medium text-sm">
                      {tour.tour_start_datetime ? new Date(tour.tour_start_datetime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '08:00'}
              </span>
            </div>
            <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">상태:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tour.tour_status)}`}>
                      {getStatusText(tour.tour_status)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">투어 유형:</span>
                    <button
                      onClick={() => {
                        // 모달에 보여줄 새로운 값 설정 (버튼의 반대 값)
                        setPendingPrivateTourValue(!isPrivateTour)
                        setShowPrivateTourModal(true)
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                        isPrivateTour
                          ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
                      }`}
                    >
                      {isPrivateTour ? '단독투어' : '일반투어'}
                    </button>
                  </div>
                </div>
                
                {/* 투어 노트 */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    투어 노트
                  </label>
                  <textarea
                    value={tourNote}
                    onChange={(e) => handleTourNoteChange(e.target.value)}
                    placeholder="투어 관련 특이사항이나 메모를 입력하세요..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
            </div>
          </div>
        </div>

        {/* 날씨 정보 섹션 */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4">
            <TourWeather 
              tourDate={tour.tour_date} 
              productId={product?.id} 
            />
          </div>
        </div>

        {/* 투어 스케줄 섹션 */}
        {tour.product_id && (
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <TourScheduleSection 
              productId={tour.product_id} 
              teamType={tour.team_type as 'guide+driver' | '2guide' | null}
              locale="ko"
            />
          </div>
        )}

            {/* 픽업 스케줄 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-md font-semibold text-gray-900 flex items-center">
                    픽업 스케줄
                    <ConnectionStatusLabel status={connectionStatus.reservations} section="예약" />
                  </h2>
                  <button className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                    자동생성
                  </button>
            </div>
                <div className="space-y-2">
                  {assignedReservations.length > 0 ? (
                    (() => {
                      // 호텔별로 그룹화
                      const groupedByHotel = assignedReservations.reduce((acc, reservation) => {
                        const hotelName = getPickupHotelNameOnly(reservation.pickup_hotel || '')
                        if (!acc[hotelName]) {
                          acc[hotelName] = []
                        }
                        acc[hotelName].push(reservation)
                        return acc
                      }, {} as Record<string, any[]>)

                      return Object.entries(groupedByHotel).map(([hotelName, reservations]) => {
                        const totalPeople = reservations.reduce((sum: number, res: any) => sum + (res.total_people || 0), 0)
                        const hotelInfo = pickupHotels.find(h => h.hotel === hotelName)
                        
                        // 가장 빠른 픽업 시간 찾기
                        const pickupTimes = reservations.map(r => r.pickup_time).filter(Boolean)
                        const earliestTime = pickupTimes.length > 0 ? 
                          (pickupTimes.sort()[0] || '').substring(0, 5) : '08:00'
                        
                        return (
                          <div key={hotelName} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-blue-600">{earliestTime}</span>
                                <span className="text-gray-300">|</span>
                                <span className="font-medium text-sm">{hotelName} ({totalPeople}명)</span>
            </div>
                              {hotelInfo?.link && (
                                <button
                                  onClick={() => openGoogleMaps(hotelInfo.link || '')}
                                  className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                                  title="구글 맵에서 보기"
                                >
                                  <Map size={16} />
                                </button>
                              )}
            </div>
                            {hotelInfo && (
                              <div className="text-xs text-gray-500 mb-2">
                                {hotelInfo.pick_up_location}
                              </div>
                            )}
                            <div className="space-y-1">
                              {reservations.map((reservation: any) => (
                                <div key={reservation.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                  <div className="text-xs text-gray-600">
                                    {getCustomerName(reservation.customer_id || '')}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {reservation.total_people || 0}인
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })
                    })()
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">배정된 예약이 없습니다.</p>
                      <p className="text-xs">예약을 배정하면 픽업 스케줄이 표시됩니다.</p>
                    </div>
                  )}
                </div>
          </div>
        </div>

            {/* 옵션 관리 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4">
                <h2 className="text-md font-semibold text-gray-900 mb-3">옵션 관리</h2>
                <div className="text-center py-6 text-gray-500">
                  <Settings className="h-8 w-8 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">등록된 옵션이 없습니다.</p>
                  <p className="text-xs">배정된 고객이 옵션을 추가하면 여기에 표시됩니다.</p>
            </div>
            </div>
          </div>


          </div>

          {/* 2열: 팀 구성, 배정 관리 */}
          <div className="space-y-6">
            {/* 팀 구성 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4">
                <h2 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                  팀 구성
                  <ConnectionStatusLabel status={connectionStatus.team} section="팀" />
                </h2>
          <div className="space-y-3">
                  {/* 팀 타입 선택 */}
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handleTeamTypeChange('1guide')}
                      className={`px-2 py-1 text-xs rounded flex items-center space-x-1 ${
                        teamType === '1guide' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <User size={12} />
                      <span>1가이드</span>
                    </button>
                    
                    {/* 2가이드 버튼 */}
                    <button 
                      onClick={() => handleTeamTypeChange('2guide')}
                      className={`px-2 py-1 text-xs rounded flex items-center space-x-1 ${
                        teamType === '2guide' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Users size={12} />
                      <span>2가이드</span>
                    </button>
                    
                    {/* 가이드+드라이버 버튼 */}
                    <button 
                      onClick={() => handleTeamTypeChange('guide+driver')}
                      className={`px-2 py-1 text-xs rounded flex items-center space-x-1 ${
                        teamType === 'guide+driver' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Car size={12} />
                      <span>가이드+드라이버</span>
                    </button>
            </div>

                  {/* 가이드 선택 */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">가이드:</span>
                      <select
                        value={selectedGuide}
                        onChange={(e) => handleGuideSelect(e.target.value)}
                        className="text-xs border rounded px-2 py-1 min-w-32"
                      >
                        <option value="">가이드 선택</option>
                        {teamMembers.map(member => (
                          <option key={member.email} value={member.email}>
                            {member.name_ko || member.name_en || member.email}
                          </option>
                        ))}
                      </select>
            </div>

                    {/* 2가이드 또는 가이드+드라이버일 때 어시스턴트 선택 */}
                    {(teamType === '2guide' || teamType === 'guide+driver') && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 text-sm">
                          {teamType === '2guide' ? '2차 가이드:' : '드라이버:'}
                        </span>
                        <select
                          value={selectedAssistant}
                          onChange={(e) => handleAssistantSelect(e.target.value)}
                          className="text-xs border rounded px-2 py-1 min-w-32"
                        >
                          <option value="">선택</option>
                          {teamMembers
                            .filter(member => member.email !== selectedGuide)
                            .map(member => (
                              <option key={member.email} value={member.email}>
                                {member.name_ko || member.name_en || member.email}
                              </option>
                            ))
                          }
                        </select>
            </div>
                    )}
            </div>

                  {/* 현재 배정된 팀원 표시 */}
                  {(selectedGuide || selectedAssistant) && (
                    <div className="p-2 bg-gray-50 rounded text-xs">
                      <div className="font-medium text-gray-700 mb-1">현재 배정된 팀원:</div>
                      {selectedGuide && (
                        <div className="text-gray-600">가이드: {getTeamMemberName(selectedGuide)}</div>
                      )}
                      {selectedAssistant && (
                        <div className="text-gray-600">
                          {teamType === '2guide' ? '2차 가이드' : '드라이버'}: {getTeamMemberName(selectedAssistant)}
          </div>
                      )}
                    </div>
                  )}
                </div>
        </div>
      </div>

            {/* 차량 배정 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4">
                <h2 className="text-md font-semibold text-gray-900 mb-3">
                  차량 배정
                  <ConnectionStatusLabel status={connectionStatus.vehicles} section="차량" />
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">차량 선택:</span>
                    {vehiclesLoading ? (
                      <div className="text-xs text-gray-500 flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></div>
                        <span>Loading vehicle data...</span>
                      </div>
                    ) : vehiclesError ? (
                      <div className="text-xs text-red-500 flex items-center space-x-2">
                        <span>❌</span>
                        <span>{vehiclesError}</span>
                        <button 
                          onClick={() => fetchVehicles()}
                          className="text-blue-500 hover:text-blue-700 underline"
                        >
                          다시 시도
                        </button>
                      </div>
                    ) : (
                      <select
                        value={selectedVehicleId}
                        onChange={(e) => handleVehicleSelect(e.target.value)}
                        className="text-xs border rounded px-2 py-1 min-w-48"
                        disabled={vehiclesLoading}
                      >
                        <option value="">
                          {vehicles.length === 0 
                            ? "사용 가능한 차량이 없습니다" 
                            : `차량을 선택하세요 (${vehicles.length}대 사용 가능)`
                          }
                        </option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.vehicle_category === 'company' 
                              ? `${vehicle.vehicle_number} - ${vehicle.vehicle_type} (${vehicle.capacity}인승)`
                              : `${vehicle.rental_company} - ${vehicle.vehicle_type} (${vehicle.capacity}인승) - ${vehicle.rental_start_date} ~ ${vehicle.rental_end_date}`
                            }
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* 현재 배정된 차량 정보 표시 */}
                  {assignedVehicle && (
                    <div className="p-2 bg-blue-50 rounded text-xs">
                      <div className="font-medium text-blue-700 mb-1">현재 배정된 차량:</div>
                      <div className="text-blue-600">
                        {assignedVehicle.vehicle_category === 'company' 
                          ? `${assignedVehicle.vehicle_number} - ${assignedVehicle.vehicle_type} (${assignedVehicle.capacity}인승)`
                          : `${assignedVehicle.rental_company} - ${assignedVehicle.vehicle_type} (${assignedVehicle.capacity}인승)`
                        }
                      </div>
                    </div>
                  )}

                  {/* 차량 데이터 상태 정보 */}
                  {!vehiclesLoading && !vehiclesError && (
                    <div className="text-xs text-gray-500">
                      {vehicles.length === 0 ? (
                        <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                          <div className="font-medium text-yellow-700 mb-1">⚠️ 사용 가능한 차량이 없습니다</div>
                          <div className="text-yellow-600">
                            • 같은 날짜의 다른 투어에서 이미 배정된 차량들이 있습니다<br/>
                            • 렌터카의 경우 투어 날짜가 렌탈 기간에 포함되지 않을 수 있습니다<br/>
                            • 차량 데이터를 새로고침하려면 페이지를 다시 로드해주세요
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-600">
                          총 {vehicles.length}대의 차량이 사용 가능합니다
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 배정 관리 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-md font-semibold text-gray-900">배정 관리</h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleAssignAllReservations}
                      disabled={pendingReservations.length === 0}
                      className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-1"
                    >
                      <Check size={12} />
                      <span>모두 배정</span>
                    </button>
                    <button
                      onClick={handleUnassignAllReservations}
                      disabled={assignedReservations.length === 0}
                      className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-1"
                    >
                      <X size={12} />
                      <span>모두 배정 취소</span>
                    </button>
                  </div>
                </div>
                
                {/* 1. 이 투어에 배정된 예약 */}
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    1. 이 투어에 배정된 예약 ({assignedReservations.length})
                    {loadingStates.reservations && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    )}
                  </h3>
                  <div className="space-y-2">
                    {assignedReservations.map((reservation) => (
                      <div 
                        key={reservation.id} 
                        className={`p-3 rounded-lg border ${isStaff ? 'bg-white hover:bg-gray-50 cursor-pointer' : 'bg-gray-50 cursor-not-allowed'}`}
                        onClick={() => handleEditReservationClick(reservation)}
                      >
                        {/* 상단: 국기/이름 | 총인원/상태 */}
                        <div className="flex items-center justify-between mb-2">
                          {/* 왼쪽 상단: 국기, 이름 */}
                          <div className="flex items-center space-x-2">
                            <ReactCountryFlag
                              countryCode={getCountryCode(getCustomerLanguage(reservation.customer_id || '') || '')}
                              svg
                              style={{
                                width: '20px',
                                height: '15px'
                              }}
                            />
                            <span className="font-medium text-sm">{getCustomerName(reservation.customer_id || '')}</span>
                          </div>
                          
                          {/* 오른쪽 상단: 총인원, 상태 */}
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-700">
                              {reservation.total_people || 0}명
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              reservation.status?.toLowerCase() === 'confirmed' ? 'bg-green-100 text-green-800' :
                              reservation.status?.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              reservation.status?.toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-800' :
                              reservation.status?.toLowerCase() === 'recruiting' ? 'bg-blue-100 text-blue-800' :
                              reservation.status?.toLowerCase() === 'completed' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {reservation.status?.toLowerCase() === 'confirmed' ? '확정' :
                               reservation.status?.toLowerCase() === 'pending' ? '대기' :
                               reservation.status?.toLowerCase() === 'cancelled' ? '취소' :
                               reservation.status?.toLowerCase() === 'recruiting' ? '모집중' :
                               reservation.status?.toLowerCase() === 'completed' ? '완료' :
                               reservation.status || '미정'}
                            </span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUnassignReservation(reservation.id)
                              }}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                        
                        {/* 중단: 필수 선택 옵션 */}
                        <div className="mb-2">
                          {reservation.selected_options && Object.entries(reservation.selected_options).some(([optionId, choices]) => choices && Array.isArray(choices) && (choices as any[]).length > 0) ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(reservation.selected_options)
                                .filter(([optionId, choices]) => choices && Array.isArray(choices) && (choices as any[]).length > 0)
                                .map(([optionId, choices]) => {
                                  if (process.env.NODE_ENV === 'development') {
                                    console.log('Rendering assigned reservation option:', { optionId, choices, productId: tour?.product_id })
                                  }
                                  return (
                                    <span key={optionId} className={`text-xs px-2 py-1 rounded ${getOptionBadgeColor(optionId)}`}>
                                    {getOptionName(optionId, tour?.product_id || '')}
                                  </span>
                                  )
                                })}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">선택된 옵션 없음</span>
                          )}
                        </div>
                        
                        {/* 하단: 픽업 시간 | 픽업 정보 */}
                        <div className="flex items-center justify-between">
                          {/* 왼쪽 하단: 픽업 시간 */}
                          <div className="flex items-center space-x-1">
                            <Clock size={12} className="text-gray-400" />
                            <span className="text-sm text-gray-700">
                              {reservation.pickup_time ? reservation.pickup_time.substring(0, 5) : '08:00'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditPickupTime(reservation)
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Edit size={12} />
                            </button>
                          </div>
                          
                          {/* 오른쪽 하단: 픽업 정보 */}
                          <span className="text-sm text-gray-600 text-right">
                            {getPickupHotelName(reservation.pickup_hotel || '')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. 다른 투어에 배정된 예약 */}
                {otherToursAssignedReservations.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <span className="text-orange-600">2. 다른 투어에 배정된 예약 ({otherToursAssignedReservations.length})</span>
                      <span className="ml-2 text-xs text-gray-500">같은 날 같은 투어명</span>
                    </h3>
                    <div className="space-y-2">
                      {otherToursAssignedReservations.map((reservation) => (
                        <div 
                          key={reservation.id} 
                          className={`p-3 rounded-lg border ${isStaff ? 'bg-white hover:bg-gray-50 cursor-pointer' : 'bg-gray-50 cursor-not-allowed'}`}
                          onClick={() => handleEditReservationClick(reservation)}
                        >
                          {/* 상단: 국기/이름 | 총인원/상태 */}
                          <div className="flex items-center justify-between mb-2">
                            {/* 왼쪽 상단: 국기, 이름 */}
                            <div className="flex items-center space-x-2">
                              <ReactCountryFlag
                                countryCode={getCountryCode(getCustomerLanguage(reservation.customer_id || '') || '')}
                                svg
                                style={{
                                  width: '20px',
                                  height: '15px'
                                }}
                              />
                              <span className="font-medium text-sm">{getCustomerName(reservation.customer_id || '')}</span>
                            </div>
                            
                            {/* 오른쪽 상단: 총인원, 상태 */}
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-700">
                                {reservation.total_people || 0}명
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                reservation.status?.toLowerCase() === 'confirmed' ? 'bg-green-100 text-green-800' :
                                reservation.status?.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                reservation.status?.toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-800' :
                                reservation.status?.toLowerCase() === 'recruiting' ? 'bg-blue-100 text-blue-800' :
                                reservation.status?.toLowerCase() === 'completed' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {reservation.status?.toLowerCase() === 'confirmed' ? '확정' :
                                 reservation.status?.toLowerCase() === 'pending' ? '대기' :
                                 reservation.status?.toLowerCase() === 'cancelled' ? '취소' :
                                 reservation.status?.toLowerCase() === 'recruiting' ? '모집중' :
                                 reservation.status?.toLowerCase() === 'completed' ? '완료' :
                                 reservation.status || '미정'}
                              </span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleReassignFromOtherTour(reservation.id as string, (reservation as any).assigned_tour_id as string)
                                }}
                                className="text-orange-600 hover:text-orange-800 flex items-center space-x-1"
                                title="이 투어로 재배정"
                              >
                                <ArrowLeft size={14} />
                                <span className="text-xs">재배정</span>
                              </button>
                            </div>
                          </div>
                          
                          {/* 중단: 필수 선택 옵션 */}
                          <div className="mb-2">
                            {reservation.selected_options && Object.entries(reservation.selected_options).some(([optionId, choices]) => choices && Array.isArray(choices) && (choices as any[]).length > 0) ? (
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(reservation.selected_options)
                                  .filter(([optionId, choices]) => choices && Array.isArray(choices) && (choices as any[]).length > 0)
                                  .map(([optionId, choices]) => (
                                    <span key={optionId} className={`text-xs px-2 py-1 rounded ${getOptionBadgeColor(optionId)}`}>
                                      {getOptionName(optionId, (reservation as any).product_id || '')}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">선택된 옵션 없음</span>
                            )}
                          </div>
                          
                          {/* 하단: 픽업 시간 | 픽업 정보 */}
                          <div className="flex items-center justify-between">
                            {/* 왼쪽 하단: 픽업 시간 */}
                            <div className="flex items-center space-x-1">
                              <Clock size={12} className="text-gray-400" />
                              <span className="text-sm text-gray-700">
                                {reservation.pickup_time ? reservation.pickup_time.substring(0, 5) : '08:00'}
                              </span>
                            </div>
                            
                            {/* 오른쪽 하단: 픽업 정보 */}
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-600">
                                {getPickupHotelName(reservation.pickup_hotel || '')}
                              </span>
                              <span className="text-xs text-orange-600 font-medium">
                                투어: {reservation.assigned_tour_id}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. 어느 투어에도 배정되지 않은 예약 */}
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">3. 어느 투어에도 배정되지 않은 예약 ({pendingReservations.length})</h3>
                  <div className="space-y-2">
                    {pendingReservations.map((reservation) => (
                      <div 
                        key={reservation.id} 
                        className={`p-3 rounded-lg border ${isStaff ? 'bg-white hover:bg-gray-50 cursor-pointer' : 'bg-gray-50 cursor-not-allowed'}`}
                        onClick={() => handleEditReservationClick(reservation)}
                      >
                        {/* 상단: 국기/이름 | 총인원/상태 */}
                        <div className="flex items-center justify-between mb-2">
                          {/* 왼쪽 상단: 국기, 이름 */}
                          <div className="flex items-center space-x-2">
                            <ReactCountryFlag
                              countryCode={getCountryCode(getCustomerLanguage(reservation.customer_id || '') || '')}
                              svg
                              style={{
                                width: '20px',
                                height: '15px'
                              }}
                            />
                            <span className="font-medium text-sm">{getCustomerName(reservation.customer_id || '')}</span>
                          </div>
                          
                          {/* 오른쪽 상단: 총인원, 상태 */}
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-700">
                              {reservation.total_people || 0}명
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              reservation.status?.toLowerCase() === 'confirmed' ? 'bg-green-100 text-green-800' :
                              reservation.status?.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              reservation.status?.toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-800' :
                              reservation.status?.toLowerCase() === 'recruiting' ? 'bg-blue-100 text-blue-800' :
                              reservation.status?.toLowerCase() === 'completed' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {reservation.status?.toLowerCase() === 'confirmed' ? '확정' :
                               reservation.status?.toLowerCase() === 'pending' ? '대기' :
                               reservation.status?.toLowerCase() === 'cancelled' ? '취소' :
                               reservation.status?.toLowerCase() === 'recruiting' ? '모집중' :
                               reservation.status?.toLowerCase() === 'completed' ? '완료' :
                               reservation.status || '미정'}
                            </span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAssignReservation(reservation.id)
                              }}
                              className="text-green-600 hover:text-green-800"
                            >
                              <Check size={14} />
                            </button>
                          </div>
                        </div>
                        
                        {/* 중단: 필수 선택 옵션 */}
                        <div className="mb-2">
                          {reservation.selected_options && Object.entries(reservation.selected_options).some(([optionId, choices]) => choices && Array.isArray(choices) && (choices as any[]).length > 0) ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(reservation.selected_options)
                                .filter(([optionId, choices]) => choices && Array.isArray(choices) && (choices as any[]).length > 0)
                                .map(([optionId, choices]) => (
                                  <span key={optionId} className={`text-xs px-2 py-1 rounded ${getOptionBadgeColor(optionId)}`}>
                                    {getOptionName(optionId, (reservation as any).product_id || '')}
                                  </span>
                                ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">선택된 옵션 없음</span>
                          )}
                        </div>
                        
                        {/* 하단: 픽업 시간 | 픽업 정보 */}
                        <div className="flex items-center justify-between">
                          {/* 왼쪽 하단: 픽업 시간 */}
                          <div className="flex items-center space-x-1">
                            <Clock size={12} className="text-gray-400" />
                            <span className="text-sm text-gray-700">
                              {reservation.pickup_time ? reservation.pickup_time.substring(0, 5) : '08:00'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditPickupTime(reservation)
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Edit size={12} />
                            </button>
                          </div>
                          
                          {/* 오른쪽 하단: 픽업 정보 */}
                          <span className="text-sm text-gray-600 text-right">
                            {getPickupHotelName(reservation.pickup_hotel || '')}
                          </span>
                        </div>
                      </div>
                    ))}
      </div>
    </div>

                {/* 4. 취소/기타 상태 예약 (recruiting/confirmed 이외) */}
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">4. 취소/기타 상태 예약 ({inactiveReservations.length})</h3>
                  <div className="space-y-2">
                    {inactiveReservations.map((reservation) => (
                      <div 
                        key={reservation.id} 
                        className={`p-3 rounded-lg border ${isStaff ? 'bg-white hover:bg-gray-50 cursor-pointer' : 'bg-gray-50 cursor-not-allowed'}`}
                        onClick={() => handleEditReservationClick(reservation)}
                      >
                        {/* 상단: 국기/이름 | 총인원/상태 */}
                        <div className="flex items-center justify-between mb-2">
                          {/* 왼쪽 상단: 국기, 이름 */}
                          <div className="flex items-center space-x-2">
                            <ReactCountryFlag
                              countryCode={getCountryCode(getCustomerLanguage(reservation.customer_id || '') || '')}
                              svg
                              style={{
                                width: '20px',
                                height: '15px'
                              }}
                            />
                            <span className="font-medium text-sm">{getCustomerName(reservation.customer_id || '')}</span>
                          </div>
                          
                          {/* 오른쪽 상단: 총인원, 상태 */}
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-700">
                              {reservation.total_people || 0}명
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              reservation.status?.toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-800' :
                              reservation.status?.toLowerCase() === 'completed' ? 'bg-purple-100 text-purple-800' :
                              reservation.status?.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {reservation.status || '미정'}
                            </span>
                            {reservation.tour_id && (
                              <span className="text-xs text-gray-500">배정 투어: {reservation.tour_id}</span>
                            )}
                          </div>
                        </div>
                        
                        {/* 중단: 필수 선택 옵션 */}
                        <div className="mb-2">
                          {reservation.selected_options && Object.entries(reservation.selected_options).some(([optionId, choices]) => choices && Array.isArray(choices) && (choices as any[]).length > 0) ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(reservation.selected_options)
                                .filter(([optionId, choices]) => choices && Array.isArray(choices) && (choices as any[]).length > 0)
                                .map(([optionId, choices]) => (
                                  <span key={optionId} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    {getOptionName(optionId, (reservation as any).product_id || '')}
                                  </span>
                                ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">선택된 옵션 없음</span>
                          )}
                        </div>
                        
                        {/* 하단: 픽업 시간 | 픽업 정보 */}
                        <div className="flex items-center justify-between">
                          {/* 왼쪽 하단: 픽업 시간 */}
                          <div className="flex items-center space-x-1">
                            <Clock size={12} className="text-gray-400" />
                            <span className="text-sm text-gray-700">
                              {reservation.pickup_time ? reservation.pickup_time.substring(0, 5) : '08:00'}
                            </span>
                          </div>
                          
                          {/* 오른쪽 하단: 픽업 정보 */}
                          <span className="text-sm text-gray-600 text-right">
                            {getPickupHotelName(reservation.pickup_hotel || '')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 요약 */}
                <div className="p-2 bg-gray-100 rounded text-xs text-gray-600">
                  총 예약: {reservations.length}건 | 배정: {assignedReservations.length}건 | 대기: {pendingReservations.length}건
                  {otherToursAssignedReservations.length > 0 && (
                    <span className="ml-2 text-orange-600">
                      | 다른 투어 배정: {otherToursAssignedReservations.length}건
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3열: 부킹 관리 */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-md font-semibold text-gray-900 flex items-center">
                    부킹 관리
                    <ConnectionStatusLabel status={connectionStatus.bookings && connectionStatus.hotelBookings} section="부킹" />
                    {loadingStates.bookings && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 ml-2"></div>
                    )}
                  </h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleAddTicketBooking}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center space-x-1"
                    >
                      <Plus size={12} />
                      <span>입장권</span>
                    </button>
                    <button
                      onClick={handleAddTourHotelBooking}
                      className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 flex items-center space-x-1"
                    >
                      <Plus size={12} />
                      <span>호텔</span>
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {/* 입장권 부킹 목록 */}
                  {ticketBookings.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-700">
                          입장권 부킹 ({filteredTicketBookings.length})
                          {!showTicketBookingDetails && ticketBookings.length > filteredTicketBookings.length && 
                            ` / 전체 ${ticketBookings.length}`
                          }
                        </h3>
                        <button
                          onClick={() => setShowTicketBookingDetails(!showTicketBookingDetails)}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                        >
                          {showTicketBookingDetails ? '간단히 보기' : '상세 보기'}
                        </button>
                      </div>
                      <div className="space-y-1">
                        {filteredTicketBookings.map((booking) => (
                          <div 
                            key={booking.id} 
                            className={`p-2 border rounded cursor-pointer hover:bg-gray-50 transition-colors ${isStaff ? '' : 'cursor-not-allowed'}`}
                            onClick={() => handleEditTicketBooking(booking)}
                          >
                            {/* 첫 번째 줄: company와 status */}
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">🎫</span>
                                <span className="font-medium text-sm text-gray-900 truncate">
                                  {booking.company || 'N/A'}
                                </span>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                booking.status?.toLowerCase() === 'confirmed' ? 'bg-green-100 text-green-800' :
                                booking.status?.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                booking.status?.toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-800' :
                                booking.status?.toLowerCase() === 'completed' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {booking.status?.toLowerCase() === 'confirmed' ? 'Confirm' :
                                 booking.status?.toLowerCase() === 'pending' ? 'Pending' :
                                 booking.status?.toLowerCase() === 'cancelled' ? 'Cancelled' :
                                 booking.status?.toLowerCase() === 'completed' ? 'Completed' :
                                 booking.status || 'Unknown'}
                              </span>
                            </div>
                            
                            {/* 두 번째 줄: 카테고리, 시간, 인원, RN# */}
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <span className="font-medium text-gray-700">
                                {booking.category || 'N/A'}
                              </span>
                              <span>
                                {booking.time ? booking.time.substring(0, 5) : 'N/A'}
                              </span>
                              <span>
                                {booking.ea || 0}명
                              </span>
                              {booking.rn_number && (
                                <span>
                                  #{booking.rn_number}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 투어 호텔 부킹 목록 */}
                  {tourHotelBookings.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">투어 호텔 부킹 ({tourHotelBookings.length})</h3>
                      <div className="space-y-2">
                        {tourHotelBookings.map((booking) => (
                          <div 
                            key={booking.id} 
                            className={`border rounded p-3 cursor-pointer hover:bg-gray-50 ${isStaff ? '' : 'cursor-not-allowed'}`}
                            onClick={() => handleEditTourHotelBooking(booking)}
                          >
                            {/* 호텔 부킹 제목과 예약번호 */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <Hotel className="h-3 w-3 text-blue-600" />
                                <span className="font-medium text-sm">
                                  {booking.hotel} ({booking.room_type}, {booking.rooms}개)
                                </span>
                              </div>
                              <span className="text-xs text-gray-500 font-mono">
                                {booking.rn_number || booking.booking_reference || 'N/A'}
                              </span>
                            </div>
                            
                            <div className="text-xs text-gray-600">
                              {/* 체크인/체크아웃 같은 줄에 배치 */}
                              <div className="flex items-center space-x-4 mb-2">
                                <div className="flex items-center space-x-1">
                                  <span className="text-gray-500">체크인:</span>
                                  <span className="font-medium">{booking.check_in_date}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <span className="text-gray-500">체크아웃:</span>
                                  <span className="font-medium">{booking.check_out_date}</span>
                                </div>
                              </div>
                              
                              {/* 상태 */}
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-500">상태:</span>
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  booking.status?.toLowerCase() === 'confirmed' ? 'bg-green-100 text-green-800' :
                                  booking.status?.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  booking.status?.toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-800' :
                                  booking.status?.toLowerCase() === 'completed' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {booking.status?.toLowerCase() === 'confirmed' ? '확정' :
                                   booking.status?.toLowerCase() === 'pending' ? '대기' :
                                   booking.status?.toLowerCase() === 'cancelled' ? '취소' :
                                   booking.status?.toLowerCase() === 'completed' ? '완료' :
                                   booking.status || '미정'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 부킹이 없는 경우 */}
                  {ticketBookings.length === 0 && tourHotelBookings.length === 0 && (
                    <div className="text-center py-6 text-gray-500">
                      <Hotel className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">등록된 부킹이 없습니다.</p>
                      <p className="text-xs">위 버튼을 클릭하여 부킹을 추가하세요.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 투어 채팅방 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">채팅</h3>
                </div>
                <div id="announcements" />
                <div id="pickup-schedule" />
                <div id="options" />
                <TourChatRoom
                  tourId={tour.id}
                  guideEmail="guide@tour.com" // 실제로는 현재 로그인한 가이드의 이메일
                  tourDate={tour.tour_date}
                />
              </div>
            </div>

            {/* 투어 사진 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4" id="tour-photos">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">투어 사진</h3>
                </div>
                <TourPhotoUpload
                  tourId={tour.id}
                  uploadedBy="guide@tour.com" // 실제로는 현재 로그인한 가이드의 이메일
                  onPhotosUpdated={() => {
                    // 사진 업데이트 시 필요한 로직
                    console.log('Photos updated')
                  }}
                />
              </div>
            </div>
          </div>

          {/* 4열: 정산 관리 (재무 권한 보유자만) */}
          {hasPermission && hasPermission('canViewFinance') && (
          <div className="space-y-6">
             <div className="bg-white rounded-lg shadow-sm border">
               <div className="p-4">
                 <h2 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                   정산 관리
                   <ConnectionStatusLabel status={connectionStatus.bookings} section="정산" />
                 </h2>
                 
                 {/* 투어 지출 관리 */}
                 <TourExpenseManager
                   tourId={tour.id}
                   tourDate={tour.tour_date}
                   productId={tour.product_id}
                   submittedBy={userRole === 'admin' ? 'admin@tour.com' : 'guide@tour.com'}
                   onExpenseUpdated={() => {
                     // 지출 업데이트 시 필요한 로직
                     console.log('Expenses updated')
                   }}
                 />
               </div>
             </div>

             {/* 투어 리포트 섹션 */}
             <div className="bg-white rounded-lg shadow-sm border">
               <div className="p-4">
                 <div className="flex items-center justify-between mb-3">
                   <h2 className="text-md font-semibold text-gray-900 flex items-center">
                     투어 리포트
                     <ConnectionStatusLabel status={connectionStatus.bookings} section="리포트" />
                   </h2>
                   <div className="flex gap-2">
                     <Button
                       size="sm"
                       variant="outline"
                       onClick={() => {
                         // 투어 리포트 작성 모드로 전환
                         const reportSection = document.querySelector('[data-tour-report-section]')
                         if (reportSection) {
                           const createButton = reportSection.querySelector('[data-create-report]') as HTMLButtonElement
                           if (createButton) createButton.click()
                         }
                       }}
                       className="flex items-center gap-1"
                     >
                       <Plus className="w-4 h-4" />
                       <span className="hidden sm:inline">작성</span>
                     </Button>
                     <Button
                       size="sm"
                       variant="outline"
                       onClick={() => {
                         // 투어 리포트 목록 모드로 전환
                         const reportSection = document.querySelector('[data-tour-report-section]')
                         if (reportSection) {
                           const viewButton = reportSection.querySelector('[data-view-reports]') as HTMLButtonElement
                           if (viewButton) viewButton.click()
                         }
                       }}
                       className="flex items-center gap-1"
                     >
                       <Eye className="w-4 h-4" />
                       <span className="hidden sm:inline">목록</span>
                     </Button>
                   </div>
                 </div>
                 <div data-tour-report-section>
                   <TourReportSection
                     tourId={tour.id}
                     tourName={product?.name_ko || ''}
                     tourDate={tour.tour_date}
                     canCreateReport={isStaff}
                     canEditReport={isStaff}
                     canDeleteReport={userRole === 'admin'}
                     showHeader={false}
                   />
                 </div>
               </div>
             </div>
          </div>
          )}
        </div>
      </div>

      {/* 픽업시간 수정 모달 */}
      {showTimeModal && selectedReservation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">픽업시간 수정</h3>
              <button
                onClick={handleCancelEditPickupTime}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4">
                <div className="flex items-center space-x-2 mb-2">
                <ReactCountryFlag
                  countryCode={getCountryCode(getCustomerLanguage(selectedReservation.customer_id || '') || '')}
                  svg
                  style={{ width: '16px', height: '12px' }}
                />
                <span className="font-medium text-sm">{getCustomerName(selectedReservation.customer_id || '')}</span>
                <span className="text-xs text-gray-600">
                  {(selectedReservation.adults || 0) + (selectedReservation.child || 0)}명
                </span>
            </div>
              <div className="text-xs text-gray-500 mb-4">
                {getPickupHotelName(selectedReservation.pickup_hotel || '')}
            </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                픽업시간
              </label>
              <input
                type="time"
                value={pickupTimeValue}
                onChange={(e) => setPickupTimeValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex space-x-3">
            <button
                onClick={handleSavePickupTime}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
                저장
            </button>
            <button
                onClick={handleCancelEditPickupTime}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
                취소
            </button>
          </div>
      </div>
      </div>
      )}

      {/* 예약 편집 모달 */}
      {editingReservation && (
        <ReservationFormAny
          reservation={editingReservation}
          customers={customers}
          products={allProducts}
          channels={channels}
          productOptions={[]}
          optionChoices={[]}
          options={[]}
          pickupHotels={pickupHotels}
          coupons={[]}
          onSubmit={async (reservationData: any) => {
            // 예약 수정 로직 (필요시 구현)
            console.log('Reservation updated:', reservationData)
            handleCloseEditModal()
          }}
          onCancel={handleCloseEditModal}
          onRefreshCustomers={async () => {}}
          onDelete={async () => {
            // 예약 삭제 로직 (필요시 구현)
            console.log('Reservation deleted')
            handleCloseEditModal()
          }}
        />
      )}

      {/* 차량 배정 모달 */}
      {showVehicleAssignment && tour && (
        <VehicleAssignmentModal
          tourId={tour.id}
          tourDate={tour.tour_date || ''}
          onClose={() => setShowVehicleAssignment(false)}
          onAssignmentComplete={handleVehicleAssignmentComplete}
        />
      )}

      {/* 입장권 부킹 폼 모달 */}
      {showTicketBookingForm && tour && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingTicketBooking ? '입장권 부킹 수정' : '입장권 부킹 추가'}
                </h3>
                <button
                  onClick={handleCloseTicketBookingForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
              <TicketBookingFormAny
                booking={editingTicketBooking || undefined}
                tourId={tour.id}
                onSave={(b: any) => handleBookingSubmit(b as unknown as LocalTicketBooking)}
                onCancel={handleCloseTicketBookingForm}
              />
            </div>
          </div>
        </div>
      )}

      {/* 투어 호텔 부킹 폼 모달 */}
      {showTourHotelBookingForm && tour && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingTourHotelBooking ? '투어 호텔 부킹 수정' : '투어 호텔 부킹 추가'}
                </h3>
                <button
                  onClick={handleCloseTourHotelBookingForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
              <TourHotelBookingFormAny
                booking={editingTourHotelBooking || undefined}
                tourId={tour.id}
                onSave={(b: any) => handleBookingSubmit(b as unknown as LocalTourHotelBooking)}
                onCancel={handleCloseTourHotelBookingForm}
              />
            </div>
          </div>
        </div>
      )}

      {/* 단독투어 상태 변경 확인 모달 */}
      {showPrivateTourModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  단독투어 상태 변경
                </h3>
                <button
                  onClick={() => setShowPrivateTourModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  이 투어를 <span className="font-semibold text-blue-600">
                    {pendingPrivateTourValue ? '단독투어' : '일반투어'}
                  </span>로 변경하시겠습니까?
                </p>
                
                {pendingPrivateTourValue && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-blue-800">단독투어 안내</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          단독투어로 설정하면 이 투어는 개별 고객을 위한 전용 투어가 됩니다.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {!pendingPrivateTourValue && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-gray-800">일반투어 안내</h4>
                        <p className="text-sm text-gray-700 mt-1">
                          일반투어로 설정하면 여러 고객이 함께 참여할 수 있는 공용 투어가 됩니다.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowPrivateTourModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  취소
                </button>
                <button
                  onClick={async () => {
                    const success = await updatePrivateTourStatus(pendingPrivateTourValue)
                    if (success) {
                      setShowPrivateTourModal(false)
                    }
                  }}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    pendingPrivateTourValue
                      ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                      : 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500'
                  }`}
                >
                  {pendingPrivateTourValue ? '단독투어로 변경' : '일반투어로 변경'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

