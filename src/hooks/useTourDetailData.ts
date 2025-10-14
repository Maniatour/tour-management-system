import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { cache, cacheKeys } from '@/lib/cache'
import { 
  calculateAssignedPeople, 
  getPendingReservations,
} from '@/utils/tourUtils'
import { formatCustomerNameEnhanced } from '@/utils/koreanTransliteration'
import { useAuth } from '@/contexts/AuthContext'

// 타입 정의
type TourRow = Database['public']['Tables']['tours']['Row']
type ReservationRow = Database['public']['Tables']['reservations']['Row']
type PickupHotel = Database['public']['Tables']['pickup_hotels']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']
type ProductRow = { id: string; name_ko?: string | null; name_en?: string | null; [k: string]: unknown }
type CustomerRow = { id: string; name?: string | null; email?: string | null; language?: string | null; [k: string]: unknown }
type TeamMember = { email: string; name_ko: string; name_en?: string }

export function useTourDetailData() {
  console.log('useTourDetailData 훅 시작')
  
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const { hasPermission, userRole, user, loading } = useAuth()
  
  console.log('useTourDetailData - 기본 설정:', { params, locale, userRole, user, loading })
  
  // 기본 상태들
  const [tour, setTour] = useState<TourRow | null>(null)
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['team-composition', 'vehicle-assignment', 'pickup-schedule', 'assignment-management']))

  // 데이터 상태들
  const [product, setProduct] = useState<ProductRow | null>(null)
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [reservations, setReservations] = useState<ReservationRow[]>([])
  const [allReservations, setAllReservations] = useState<ReservationRow[]>([])
  const [allTours, setAllTours] = useState<TourRow[]>([])
  const [allProducts, setAllProducts] = useState<ProductRow[]>([])
  const [channels, setChannels] = useState<{ id: string; name: string; favicon_url?: string }[]>([])
  const [assignedReservations, setAssignedReservations] = useState<ReservationRow[]>([])
  const [pendingReservations, setPendingReservations] = useState<ReservationRow[]>([])
  const [otherToursAssignedReservations, setOtherToursAssignedReservations] = useState<(ReservationRow & { assigned_tour_id?: string | null })[]>([])
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
    const fetchTourData = async () => {
      if (!params.id || typeof params.id !== 'string') {
        console.log('투어 ID가 없음:', params.id)
        return
      }

      console.log('투어 데이터 가져오기 시작:', params.id)
      setPageLoading(true)

      try {
        // 투어 기본 정보 가져오기
        const { data: tourData, error: tourError } = await supabase
          .from('tours')
          .select(`
            *,
            products (*)
          `)
          .eq('id', params.id)
          .single()

        if (tourError) {
          console.error('투어 데이터 가져오기 오류:', tourError)
          return
        }

        console.log('투어 데이터 가져오기 성공:', tourData)
        setTour(tourData)
        setIsPrivateTour(tourData.is_private_tour || false)
        setTourNote(tourData.tour_note || '')
        setProduct(tourData.products)

        // 예약 데이터 가져오기 (고객 정보는 별도로 조인)
        const { data: reservationsData, error: reservationsError } = await supabase
          .from('reservations')
          .select('*')
          .eq('product_id', tourData.product_id)
          .eq('tour_date', tourData.tour_date)

        if (reservationsError) {
          console.error('예약 데이터 가져오기 오류:', reservationsError)
        } else {
          console.log('예약 데이터 가져오기 성공:', reservationsData?.length || 0)
          
          // 예약 데이터에 고객 정보 매핑
          if (reservationsData && reservationsData.length > 0) {
            const customerIds = [...new Set(reservationsData.map(r => r.customer_id).filter(Boolean))]
            
            if (customerIds.length > 0) {
              const { data: customersData, error: customersError } = await supabase
                .from('customers')
                .select('*')
                .in('id', customerIds)
              
              if (customersError) {
                console.error('고객 정보 조회 오류:', customersError)
              } else {
                console.log('고객 정보 조회 성공:', customersData?.length || 0)
                
                // 예약 데이터에 고객 정보 매핑
                const reservationsWithCustomers = reservationsData.map(reservation => {
                  const customer = customersData?.find(customer => customer.id === reservation.customer_id)
                  return {
                    ...reservation,
                    customers: customer,
                    // 고객 정보를 직접 매핑
                    customer_name: customer?.name || '정보 없음',
                    customer_email: customer?.email || '',
                    customer_language: customer?.language || 'Unknown'
                  }
                })
                
                setAllReservations(reservationsWithCustomers)
              }
            } else {
              setAllReservations(reservationsData)
            }
          } else {
            setAllReservations(reservationsData || [])
          }
        }

        // 픽업 호텔 데이터 가져오기
        const { data: pickupHotelsData, error: pickupHotelsError } = await supabase
          .from('pickup_hotels')
          .select('*')
          .order('hotel')

        if (pickupHotelsError) {
          console.error('픽업 호텔 데이터 가져오기 오류:', pickupHotelsError)
        } else {
          console.log('픽업 호텔 데이터 가져오기 성공:', pickupHotelsData?.length || 0)
          setPickupHotels(pickupHotelsData || [])
        }

        // 전체 고객 데이터 가져오기 (폼에서 사용)
        const { data: allCustomersData, error: allCustomersError } = await supabase
          .from('customers')
          .select('*')
          .order('name')

        if (allCustomersError) {
          console.error('전체 고객 데이터 가져오기 오류:', allCustomersError)
        } else {
          console.log('전체 고객 데이터 가져오기 성공:', allCustomersData?.length || 0)
          setCustomers(allCustomersData || [])
        }

        // 상품 데이터 가져오기
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .order('name_ko')

        if (productsError) {
          console.error('상품 데이터 가져오기 오류:', productsError)
        } else {
          console.log('상품 데이터 가져오기 성공:', productsData?.length || 0)
          setAllProducts(productsData || [])
        }

        // 채널 데이터 가져오기
        const { data: channelsData, error: channelsError } = await supabase
          .from('channels')
          .select('*')
          .order('name')

        if (channelsError) {
          console.error('채널 데이터 가져오기 오류:', channelsError)
        } else {
        console.log('채널 데이터 가져오기 성공:', channelsData?.length || 0)
        setChannels(channelsData || [])
      }

      // 전체 팀 멤버 목록 가져오기
      console.log('전체 팀 멤버 목록 가져오기 시작')
      const { data: allTeamMembers, error: teamMembersError } = await supabase
        .from('team')
        .select('*')
        .order('name_ko')

      if (teamMembersError) {
        console.error('팀 멤버 목록 가져오기 오류:', teamMembersError)
      } else {
        console.log('팀 멤버 목록 가져오기 성공:', allTeamMembers?.length || 0)
        setTeamMembers(allTeamMembers || [])
      }

      // 팀 구성 정보 가져오기
      if (tourData.tour_guide_id || tourData.assistant_id) {
        console.log('팀 구성 정보 가져오기 시작')
        
        // 가이드 정보 가져오기 (tour_guide_id는 team 테이블의 email 값)
        if (tourData.tour_guide_id) {
          const { data: guideData, error: guideError } = await supabase
            .from('team')
            .select('*')
            .eq('email', tourData.tour_guide_id)
            .single()
          
          if (guideError) {
            console.error('가이드 정보 가져오기 오류:', guideError)
          } else {
            console.log('가이드 정보 가져오기 성공:', guideData)
            // email을 그대로 사용
            setSelectedGuide(guideData.email)
          }
        }
        
        // 어시스턴트/드라이버 정보 가져오기 (assistant_id는 team 테이블의 email 값)
        if (tourData.assistant_id) {
          const { data: assistantData, error: assistantError } = await supabase
            .from('team')
            .select('*')
            .eq('email', tourData.assistant_id)
            .single()
          
          if (assistantError) {
            console.error('어시스턴트 정보 가져오기 오류:', assistantError)
          } else {
            console.log('어시스턴트 정보 가져오기 성공:', assistantData)
            // email을 그대로 사용
            setSelectedAssistant(assistantData.email)
          }
        }
        
        // 팀 타입 설정
        if (tourData.team_type) {
          setTeamType(tourData.team_type as '1guide' | '2guide' | 'guide+driver')
        }
      }

      // 전체 차량 목록 가져오기
      console.log('전체 차량 목록 가져오기 시작')
      try {
        // 먼저 is_active 필터로 시도
        let { data: allVehicles, error: vehiclesError } = await supabase
          .from('vehicles')
          .select('*')
          .eq('is_active', true)
          .order('vehicle_type', { ascending: true })
          .order('vehicle_number', { ascending: true })

        // is_active 필터가 실패하면 전체 차량 가져오기 시도
        if (vehiclesError) {
          console.log('is_active 필터 실패, 전체 차량 가져오기 시도:', vehiclesError.message)
          const { data: allVehiclesFallback, error: vehiclesErrorFallback } = await supabase
            .from('vehicles')
            .select('*')
            .order('vehicle_number', { ascending: true })
          
          if (vehiclesErrorFallback) {
            console.error('차량 목록 가져오기 오류 상세:', {
              message: vehiclesErrorFallback.message,
              details: vehiclesErrorFallback.details,
              hint: vehiclesErrorFallback.hint,
              code: vehiclesErrorFallback.code
            })
            setVehiclesError(vehiclesErrorFallback.message)
          } else {
            console.log('차량 목록 가져오기 성공 (전체):', allVehiclesFallback?.length || 0)
            setVehicles(allVehiclesFallback || [])
            setVehiclesError(null)
          }
        } else {
          console.log('차량 목록 가져오기 성공 (활성만):', allVehicles?.length || 0)
          setVehicles(allVehicles || [])
          setVehiclesError(null)
        }
      } catch (error) {
        console.error('차량 목록 가져오기 중 예외 발생:', error)
        setVehiclesError('차량 목록을 가져오는 중 오류가 발생했습니다.')
      }

      // 차량 배정 정보 가져오기 (tour_car_id는 vehicles 테이블의 id를 참조)
      if (tourData.tour_car_id) {
        console.log('차량 배정 정보 가져오기 시작:', tourData.tour_car_id)
        
        const { data: vehicleData, error: vehicleError } = await supabase
          .from('vehicles')
          .select('*')
          .eq('id', tourData.tour_car_id)
          .single()
        
        if (vehicleError) {
          console.error('차량 정보 가져오기 오류:', vehicleError)
        } else {
          console.log('차량 정보 가져오기 성공:', vehicleData)
          setSelectedVehicleId(tourData.tour_car_id)
          setAssignedVehicle(vehicleData)
        }
      }

      // 예약 분류 계산
        if (reservationsData && tourData) {
          const assignedReservationIds = tourData.reservation_ids || []
          
          // 1. 이 투어에 배정된 예약 (reservation_ids 컬럼의 예약)
          const assignedReservations = reservationsData.filter(r => assignedReservationIds.includes(r.id))
          
          // 2. 다른 투어에 배정된 예약 (tour_date와 product_id가 같고, tour_id가 이 투어가 아닌 예약)
          const otherToursAssignedReservations = reservationsData.filter(r => 
            r.product_id === tourData.product_id && 
            r.tour_date === tourData.tour_date &&
            r.tour_id && 
            r.tour_id !== tourData.id &&
            !assignedReservationIds.includes(r.id)
          )
          
          // 3. 배정 대기 중인 예약 (tour_date와 product_id가 같고, tour_id가 empty 또는 null인 예약)
          const pendingReservations = reservationsData.filter(r => 
            r.product_id === tourData.product_id && 
            r.tour_date === tourData.tour_date &&
            (!r.tour_id || r.tour_id === '') &&
            !assignedReservationIds.includes(r.id)
          )
          
          // 4. 다른 상태의 예약 (tour_date와 product_id가 같고, status가 confirmed 또는 recruiting이 아닌 예약)
          const otherStatusReservations = reservationsData.filter(r => 
            r.product_id === tourData.product_id && 
            r.tour_date === tourData.tour_date &&
            r.status && 
            !['confirmed', 'recruiting'].includes(r.status.toLowerCase()) &&
            !assignedReservationIds.includes(r.id) &&
            !otherToursAssignedReservations.some(ot => ot.id === r.id) &&
            !pendingReservations.some(p => p.id === r.id)
          )
          
          console.log('예약 분류 계산:', {
            assigned: assignedReservations.length,
            otherToursAssigned: otherToursAssignedReservations.length,
            pending: pendingReservations.length,
            otherStatus: otherStatusReservations.length
          })
          
          setAssignedReservations(assignedReservations)
          setPendingReservations(pendingReservations)
          setOtherToursAssignedReservations(otherToursAssignedReservations)
          setOtherStatusReservations(otherStatusReservations)
        }

      } catch (error) {
        console.error('투어 데이터 가져오기 중 오류:', error)
      } finally {
        setPageLoading(false)
        console.log('투어 데이터 가져오기 완료')
      }
    }

    fetchTourData()
  }, [params.id])

  // 권한이 없을 때 리다이렉트
  useEffect(() => {
    if (!loading && !isStaff) {
      console.log('권한 없음, 리다이렉트:', { loading, isStaff, userRole, user: user?.email })
      router.push(`/${params.locale}/admin`)
    }
  }, [loading, isStaff, router, params.locale, userRole, user])

  // 계산된 값들
  const getTotalAssignedPeople = useMemo(() => {
    if (!tour || !allReservations || allReservations.length === 0) return 0
    return calculateAssignedPeople(tour as any, allReservations as any)
  }, [tour, allReservations])

  const getTotalPeopleFiltered = useMemo(() => {
    if (!tour || !allReservations || allReservations.length === 0) return 0
    return allReservations
      .filter((r) => r.product_id === tour.product_id && r.tour_date === tour.tour_date)
      .filter((r) => {
        const s = (r.status || '').toString().toLowerCase()
        return s === 'confirmed' || s === 'recruiting'
      })
      .reduce((sum: number, r) => sum + (r.total_people || 0), 0)
  }, [tour, allReservations])

  const getTotalPeopleAll = useMemo(() => {
    if (!tour || !allReservations || allReservations.length === 0) return 0
    return allReservations
      .filter((r) => r.product_id === tour.product_id && r.tour_date === tour.tour_date)
      .reduce((sum: number, r) => sum + (r.total_people || 0), 0)
  }, [tour, allReservations])

  // 유틸리티 함수들
  const getCustomerName = (customerId: string) => {
    // 먼저 예약 데이터에서 직접 고객 이름 찾기
    const reservation = allReservations.find((r) => r.customer_id === customerId)
    if (reservation && reservation.customer_name) {
      return reservation.customer_name
    }
    
    // 예약 데이터에 없으면 customers 배열에서 찾기
    const customer = customers.find((c) => c.id === customerId)
    return customer ? formatCustomerNameEnhanced(customer, locale) : '정보 없음'
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
    const hotel = pickupHotels.find((h) => h.id === pickupHotelId)
    return hotel ? hotel.hotel : pickupHotelId || '픽업 호텔 미지정'
  }

  const getChannelInfo = (channelId: string) => {
    const channel = channels.find((c) => c.id === channelId)
    return channel || null
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

  const getTeamMemberName = (email: string) => {
    if (!email) return '직원 미선택'
    
    const member = teamMembers.find((member) => member.email === email)
    if (!member) {
      return email
    }
    
    const locale = window.location.pathname.split('/')[1] || 'ko'
    if (locale === 'ko') {
      return member.name_ko || member.name_en || email
    } else {
      return member.name_en || member.name_ko || email
    }
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
    pendingReservations,
    setPendingReservations,
    otherToursAssignedReservations,
    setOtherToursAssignedReservations,
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
    getTotalPeopleFiltered,
    getTotalPeopleAll,
    getCustomerName,
    getCustomerLanguage,
    getPickupHotelName,
    getPickupHotelNameOnly,
    getChannelInfo,
    getCountryCode,
    getTeamMemberName,

    // 파라미터
    params,
    locale
  }
}
