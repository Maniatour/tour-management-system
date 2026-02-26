import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { calculateAssignedPeople } from '@/utils/tourUtils'
import { useAuth } from '@/contexts/AuthContext'

// 타입 정의
type TourRow = Database['public']['Tables']['tours']['Row']
type ReservationRow = Database['public']['Tables']['reservations']['Row']
type PickupHotel = Database['public']['Tables']['pickup_hotels']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']
type ProductRow = { id: string; name_ko?: string | null; name_en?: string | null; [k: string]: unknown }
type CustomerRow = { id: string; name?: string | null; email?: string | null; language?: string | null; [k: string]: unknown }
/** team 테이블의 email, name_ko, name_en, display_name (가이드/어시스턴트 표시명 참조용) */
type TeamMember = { email: string; name_ko: string; name_en?: string | null; display_name?: string | null }

// 확장된 예약 타입 (고객 정보 포함)
type ExtendedReservationRow = ReservationRow & {
  customers?: CustomerRow | null
  customer_name?: string
  customer_email?: string
  customer_language?: string
  assigned_tour_id?: string | null
}

export function useTourDetailData() {
  console.log('useTourDetailData 훅 시작')
  
  const params = useParams()
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['team-composition', 'vehicle-assignment', 'team-vehicle-assignment', 'pickup-schedule', 'assignment-management']))

  // 데이터 상태들
  const [product, setProduct] = useState<ProductRow | null>(null)
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [reservations, setReservations] = useState<ReservationRow[]>([])
  const [allReservations, setAllReservations] = useState<ExtendedReservationRow[]>([])
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

        if (!tourData) {
          console.error('투어 데이터가 없습니다.')
          return
        }

        console.log('투어 데이터 가져오기 성공:', tourData)
        setTour(tourData as TourRow)
        setIsPrivateTour((tourData as TourRow).is_private_tour || false)
        setTourNote((tourData as TourRow).tour_note || '')
        setProduct((tourData as any).products as ProductRow | null)

        // 예약 데이터 가져오기 함수 (재사용 가능하도록 분리)
        const fetchReservations = async () => {
          if (!tourData) return null
          
          const tour = tourData as TourRow
          if (!tour.product_id || !tour.tour_date) {
            console.error('투어 product_id 또는 tour_date가 없습니다.')
            return null
          }
          const { data: reservationsData, error: reservationsError } = await supabase
            .from('reservations')
            .select('*')
            .eq('product_id', tour.product_id)
            .eq('tour_date', tour.tour_date)

          if (reservationsError) {
            console.error('예약 데이터 가져오기 오류:', reservationsError)
            return null
          }
          
          console.log('예약 데이터 가져오기 성공:', reservationsData?.length || 0)
          
          // 예약 데이터에 고객 정보 매핑
          const reservations = (reservationsData || []) as ReservationRow[]
          if (reservations && reservations.length > 0) {
            const customerIds = [...new Set(reservations.map(r => r.customer_id).filter(Boolean) as string[])]
            
            if (customerIds.length > 0) {
              const { data: customersData, error: customersError } = await supabase
                .from('customers')
                .select('*')
                .in('id', customerIds)
              
              if (customersError) {
                console.error('고객 정보 조회 오류:', customersError)
                const extendedReservations = reservations.map(r => ({ ...r } as ExtendedReservationRow))
                setAllReservations(extendedReservations)
                return extendedReservations
              }
              
              console.log('고객 정보 조회 성공:', customersData?.length || 0)
              
              // 예약 데이터에 고객 정보 매핑
              const customers = (customersData || []) as CustomerRow[]
              const reservationsWithCustomers: ExtendedReservationRow[] = reservations.map(reservation => {
                const customer = customers.find(c => c.id === reservation.customer_id)
                
                return {
                  ...reservation,
                  customers: customer || null,
                  // 고객 정보를 직접 매핑 (customer.name은 NOT NULL이므로 항상 존재)
                  customer_name: customer?.name || '정보 없음',
                  customer_email: customer?.email || '',
                  customer_language: customer?.language || 'Unknown'
                } as ExtendedReservationRow
              })
              
              setAllReservations(reservationsWithCustomers)
              return reservationsWithCustomers
            } else {
              const extendedReservations = reservations.map(r => ({ ...r } as ExtendedReservationRow))
              setAllReservations(extendedReservations)
              return extendedReservations
            }
          } else {
            setAllReservations([])
            return []
          }
        }
        
        const reservationsData = await fetchReservations()

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

        // 전체 고객 데이터 가져오기 (폼에서 사용) - 페이지네이션 사용
        console.log('전체 고객 데이터 가져오기 시작 (페이지네이션)')
        let allCustomersData: CustomerRow[] = []
        let hasMore = true
        let page = 0
        const pageSize = 1000

        while (hasMore) {
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
            console.log(`고객 데이터 페이지 ${page} 로드됨: ${data.length}명`)
          } else {
            hasMore = false
          }
        }

        console.log('전체 고객 데이터 가져오기 성공:', allCustomersData.length, '명')
        setCustomers(allCustomersData)

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

      // 전체 팀 멤버 목록 가져오기 (team 테이블의 name_ko, name_en 참조)
      console.log('전체 팀 멤버 목록 가져오기 시작')
      const { data: allTeamMembers, error: teamMembersError } = await supabase
        .from('team')
        .select('email, name_ko, name_en, display_name')
        .order('name_ko')

      if (teamMembersError) {
        console.error('팀 멤버 목록 가져오기 오류:', teamMembersError)
      } else {
        console.log('팀 멤버 목록 가져오기 성공:', allTeamMembers?.length || 0)
        setTeamMembers((allTeamMembers || []) as TeamMember[])
      }

      // 팀 구성 정보 가져오기
      const tour = tourData as TourRow
      if (tour.tour_guide_id || tour.assistant_id) {
        console.log('팀 구성 정보 가져오기 시작')
        
        // 가이드 정보 가져오기 (tour_guide_id는 team 테이블의 email, name_ko, name_en 참조)
        if (tour.tour_guide_id) {
          const { data: guideData, error: guideError } = await supabase
            .from('team')
            .select('email, name_ko, name_en, display_name')
            .eq('email', tour.tour_guide_id)
            .maybeSingle()
          
          if (guideError) {
            // PGRST116 에러는 결과가 없을 때 발생하는 정상적인 경우
            if (guideError.code !== 'PGRST116') {
              console.error('가이드 정보 가져오기 오류:', {
                message: guideError.message,
                code: guideError.code,
                details: guideError.details
              })
            }
            // 가이드 정보를 찾을 수 없더라도 tour_guide_id 값은 유지
            setSelectedGuide(tour.tour_guide_id || '')
          } else if (guideData) {
            console.log('가이드 정보 가져오기 성공:', guideData)
            // email을 그대로 사용
            const guide = guideData as TeamMember
            setSelectedGuide(guide.email || tour.tour_guide_id || '')
          } else {
            // 데이터가 없는 경우에도 tour_guide_id 값은 유지
            setSelectedGuide(tour.tour_guide_id || '')
          }
        }
        
        // 어시스턴트/드라이버 정보 가져오기 (assistant_id는 team 테이블의 email, name_ko, name_en 참조)
        if (tour.assistant_id) {
          const { data: assistantData, error: assistantError } = await supabase
            .from('team')
            .select('email, name_ko, name_en, display_name')
            .eq('email', tour.assistant_id)
            .maybeSingle()
          
          if (assistantError) {
            // PGRST116 에러는 결과가 없을 때 발생하는 정상적인 경우
            if (assistantError.code !== 'PGRST116') {
              console.error('어시스턴트 정보 가져오기 오류:', {
                message: assistantError.message,
                code: assistantError.code,
                details: assistantError.details
              })
            }
            // 어시스턴트 정보를 찾을 수 없더라도 assistant_id 값은 유지
            setSelectedAssistant(tour.assistant_id || '')
          } else if (assistantData) {
            console.log('어시스턴트 정보 가져오기 성공:', assistantData)
            // email을 그대로 사용
            const assistant = assistantData as TeamMember
            setSelectedAssistant(assistant.email || tour.assistant_id || '')
          } else {
            // 데이터가 없는 경우에도 assistant_id 값은 유지
            setSelectedAssistant(tour.assistant_id || '')
          }
        }
        
        // 팀 타입 설정
        if (tour.team_type) {
          setTeamType(tour.team_type as '1guide' | '2guide' | 'guide+driver')
        }
      }

      // 전체 차량 목록 가져오기
      console.log('전체 차량 목록 가져오기 시작')
      try {
        // 먼저 status 필터로 시도 (운행 가능한 차량만)
        let { data: allVehicles, error: vehiclesError } = await supabase
          .from('vehicles')
          .select('*')
          .eq('status', '운행 가능')
          .order('vehicle_type', { ascending: true })
          .order('vehicle_number', { ascending: true })

        // status 필터가 실패하면 전체 차량 가져오기 시도
        if (vehiclesError) {
          console.log('status 필터 실패, 전체 차량 가져오기 시도:', vehiclesError.message)
          console.log('차량 목록 오류 상세:', {
            message: vehiclesError.message,
            details: vehiclesError.details,
            hint: vehiclesError.hint,
            code: vehiclesError.code
          })
          console.log('차량 목록 오류 전체 객체:', JSON.stringify(vehiclesError, null, 2))
          console.log('차량 목록 오류 타입:', typeof vehiclesError)
          console.log('차량 목록 오류 키들:', Object.keys(vehiclesError))
          
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
            console.log('차량 목록 Fallback 오류 전체 객체:', JSON.stringify(vehiclesErrorFallback, null, 2))
            setVehiclesError(vehiclesErrorFallback.message || '차량 목록을 불러올 수 없습니다.')
            setVehicles([]) // 빈 배열로 초기화
          } else {
            console.log('차량 목록 가져오기 성공 (전체):', allVehiclesFallback?.length || 0)
            setVehicles(allVehiclesFallback || [])
            setVehiclesError('')
          }
        } else {
          console.log('차량 목록 가져오기 성공 (활성만):', allVehicles?.length || 0)
          setVehicles(allVehicles || [])
          setVehiclesError('')
        }
      } catch (error: unknown) {
        console.error('차량 목록 가져오기 중 예외 발생:', error)
        const err = error as Error
        console.log('차량 목록 예외 상세:', {
          message: err.message,
          stack: err.stack,
          name: err.name
        })
        setVehiclesError('차량 목록을 가져오는 중 오류가 발생했습니다.')
        setVehicles([]) // 빈 배열로 초기화
      }

      // 차량 배정 정보 가져오기 (tour_car_id는 vehicles 테이블의 id를 참조)
      if (tour.tour_car_id) {
        console.log('차량 배정 정보 가져오기 시작:', {
          tourCarId: tour.tour_car_id,
          tourCarIdType: typeof tour.tour_car_id,
          tourCarIdLength: tour.tour_car_id?.length,
          tourCarIdValue: tour.tour_car_id
        })
        
        try {
          console.log('Supabase 쿼리 시작 - vehicles 테이블 조회 (단일 차량)')
          
          const tour = tourData as TourRow
          // tour_car_id 유효성 검사
          if (!tour.tour_car_id || tour.tour_car_id.trim() === '') {
            console.log('차량 ID가 비어있거나 유효하지 않음:', tour.tour_car_id)
            setSelectedVehicleId('')
            setAssignedVehicle(null)
            return
          }
          
          const { data: vehicleData, error: vehicleError } = await supabase
            .from('vehicles')
            .select('*')
            .eq('id', tour.tour_car_id)
            .maybeSingle()
          
          if (vehicleError) {
            // PGRST116 에러는 결과가 없을 때 발생하는 정상적인 경우이므로 조용히 처리
            if (vehicleError.code !== 'PGRST116') {
              console.error('차량 정보 가져오기 오류:', vehicleError)
              console.log('차량 오류 상세:', {
                message: vehicleError.message,
                details: vehicleError.details,
                hint: vehicleError.hint,
                code: vehicleError.code
              })
            }
            
            // 차량을 찾을 수 없는 경우 상태 초기화
            setSelectedVehicleId('')
            setAssignedVehicle(null)
          } else if (vehicleData) {
            console.log('차량 정보 가져오기 성공:', vehicleData)
            setSelectedVehicleId(tour.tour_car_id || '')
            setAssignedVehicle(vehicleData)
          } else {
            // 차량 데이터가 null인 경우
            setSelectedVehicleId('')
            setAssignedVehicle(null)
          }
        } catch (vehicleFetchError: unknown) {
          console.error('차량 정보 가져오기 중 예외 발생:', vehicleFetchError)
          const error = vehicleFetchError as Error
          console.log('차량 예외 상세:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          })
          
          // 예외 발생 시 상태 초기화
          setSelectedVehicleId('')
          setAssignedVehicle(null)
        }
      } else {
        console.log('차량 배정 정보 없음 - tour_car_id가 비어있음')
      }

      // 예약 분류 계산 (고객 데이터 로딩 완료 후)
        if (reservationsData && tourData && allCustomersData.length > 0) {
          const tour = tourData as TourRow
          const assignedReservationIds = (tour.reservation_ids || []) as string[]
          
          console.log('📊 투어 배정 정보 확인:', {
            tourId: tour.id,
            reservation_ids: assignedReservationIds,
            reservation_ids_count: assignedReservationIds.length,
            allReservationsCount: reservationsData.length
          })
          
          // 1. 이 투어에 배정된 예약 (reservation_ids 컬럼의 예약)
          // reservation_ids에 있는 예약만 직접 조회
          let assignedReservations: ExtendedReservationRow[] = []
          if (assignedReservationIds.length > 0) {
            const { data: assignedReservationsData, error: assignedError } = await supabase
              .from('reservations')
              .select('*, pickup_notification_sent')
              .in('id', assignedReservationIds)
            
            if (assignedError) {
              console.error('배정된 예약 조회 오류:', assignedError)
            } else {
              console.log('배정된 예약 조회 성공:', assignedReservationsData?.length || 0)
              assignedReservations = (assignedReservationsData || []) as ExtendedReservationRow[]
              
              // 배정된 예약들에도 고객 정보 매핑
              if (assignedReservations.length > 0) {
                const customerIds = [...new Set(assignedReservations.map(r => r.customer_id).filter(Boolean) as string[])]
                
                if (customerIds.length > 0) {
                  const { data: assignedCustomersData, error: assignedCustomersError } = await supabase
                    .from('customers')
                    .select('*')
                    .in('id', customerIds)
                  
                  if (assignedCustomersError) {
                    console.error('배정된 예약의 고객 정보 조회 오류:', assignedCustomersError)
                  } else {
                    console.log('배정된 예약의 고객 정보 조회 성공:', assignedCustomersData?.length || 0)
                    
                    // 배정된 예약 데이터에 고객 정보 매핑
                    const assignedCustomers = (assignedCustomersData || []) as CustomerRow[]
                    assignedReservations = assignedReservations.map(reservation => {
                      const customer = assignedCustomers.find(c => c.id === reservation.customer_id)
                      
                      return {
                        ...reservation,
                        customers: customer || null,
                        // 고객 정보를 직접 매핑 (customer.name은 NOT NULL이므로 항상 존재)
                        customer_name: customer?.name || '정보 없음',
                        customer_email: customer?.email || '',
                        customer_language: customer?.language || 'Unknown'
                      } as ExtendedReservationRow
                    })
                  }
                }
              }
            }
          }
          
          // 같은 tour_date와 product_id를 가진 모든 투어들의 reservation_ids 수집
          if (!tour.product_id || !tour.tour_date) {
            console.error('투어 product_id 또는 tour_date가 없습니다.')
            return
          }
          const { data: allSameDateProductTours, error: allToursError } = await supabase
            .from('tours')
            .select('id, reservation_ids')
            .eq('product_id', tour.product_id)
            .eq('tour_date', tour.tour_date)

          if (allToursError) {
            console.error('❌ Error loading all tours with same date/product:', allToursError)
          }

          // 모든 투어의 reservation_ids를 수집 (Set으로 중복 제거)
          const allAssignedReservationIdsSet = new Set<string>()
          const reservationToTourMap = new Map<string, string>()
          
          const tours = (allSameDateProductTours || []) as Array<{ id: string; reservation_ids?: unknown }>
          setSameDayTourIds(tours.map(t => t.id))
          if (tours.length > 0) {
            tours.forEach(t => {
              const tourRow = t as TourRow
              if (tourRow.reservation_ids && Array.isArray(tourRow.reservation_ids)) {
                tourRow.reservation_ids.forEach((id: unknown) => {
                  const reservationId = String(id).trim()
                  if (reservationId) {
                    allAssignedReservationIdsSet.add(reservationId)
                    reservationToTourMap.set(reservationId, tourRow.id)
                  }
                })
              }
            })
          }

          // 같은 tour_date와 product_id를 가진 모든 예약 조회
          const { data: allSameDateProductReservations, error: allReservationsError } = await supabase
            .from('reservations')
            .select('*')
            .eq('product_id', tour.product_id)
            .eq('tour_date', tour.tour_date)

          if (allReservationsError) {
            console.error('❌ Error loading all reservations with same date/product:', allReservationsError)
          }

          const allSameDateProductReservationsList = (allSameDateProductReservations || []) as ReservationRow[]

          // 2. 다른 투어에 배정된 예약 (같은 상품/날짜의 다른 투어들의 reservation_ids에 있는 예약들)
          // 단, 현재 투어의 reservation_ids에 있는 예약은 제외
          const otherToursAssignedReservations = await (async () => {
            try {
              // 같은 상품/날짜의 다른 투어들 조회
              if (!tour.product_id || !tour.tour_date) {
                return []
              }
              const { data: otherTours, error: toursError } = await supabase
                .from('tours')
                .select('id, reservation_ids')
                .eq('product_id', tour.product_id)
                .eq('tour_date', tour.tour_date)
                .neq('id', tour.id)

              if (toursError) {
                console.error('❌ Error loading other tours:', toursError)
                return []
              }

              if (!otherTours || otherTours.length === 0) {
                console.log('📊 No other tours found with same product_id and tour_date')
                return []
              }

              // 예약 ID를 투어 ID에 매핑 (예약이 어느 투어에 속하는지 추적)
              const otherReservationIdsSet = new Set<string>()
              
              const otherToursList = (otherTours || []) as Array<{ id: string; reservation_ids?: unknown }>
              otherToursList.forEach(t => {
                const tourRow = t as TourRow
                if (tourRow.reservation_ids && Array.isArray(tourRow.reservation_ids)) {
                  tourRow.reservation_ids.forEach((id: unknown) => {
                    const reservationId = String(id).trim()
                    if (reservationId) {
                      otherReservationIdsSet.add(reservationId)
                      reservationToTourMap.set(reservationId, tourRow.id)
                    }
                  })
                }
              })

              const otherReservationIds = Array.from(otherReservationIdsSet)
              console.log('📊 Other tours reservation IDs:', otherReservationIds)

              if (otherReservationIds.length === 0) {
                console.log('📊 No reservations to show after filtering')
                return []
              }

              // 해당 예약들을 직접 조회
              const { data: otherReservationsData, error: otherReservationsError } = await supabase
                .from('reservations')
                .select('*')
                .in('id', otherReservationIds)

              if (otherReservationsError) {
                console.error('❌ Error loading other tours reservations:', otherReservationsError)
                return []
              }

              let filteredReservations: ExtendedReservationRow[] = (otherReservationsData || []) as ReservationRow[]
              
              // 고객 정보 매핑 및 assigned_tour_id 설정
              if (filteredReservations.length > 0) {
                const customerIds = [...new Set(filteredReservations.map(r => r.customer_id).filter(Boolean) as string[])]
                
                if (customerIds.length > 0) {
                  const { data: otherCustomersData, error: otherCustomersError } = await supabase
                    .from('customers')
                    .select('*')
                    .in('id', customerIds)
                  
                  if (otherCustomersError) {
                    console.error('다른 투어 예약의 고객 정보 조회 오류:', otherCustomersError)
                  } else {
                    const otherCustomers = (otherCustomersData || []) as CustomerRow[]
                    filteredReservations = filteredReservations.map(reservation => {
                      const customer = otherCustomers.find(c => c.id === reservation.customer_id)
                      const assignedTourId = reservationToTourMap.get(reservation.id) || null
                      
                      return {
                        ...reservation,
                        customers: customer || null,
                        customer_name: customer?.name || '정보 없음',
                        customer_email: customer?.email || '',
                        customer_language: customer?.language || 'Unknown',
                        assigned_tour_id: assignedTourId
                      } as ExtendedReservationRow
                    })
                  }
                } else {
                  filteredReservations = filteredReservations.map(reservation => {
                    const assignedTourId = reservationToTourMap.get(reservation.id) || null
                    return {
                      ...reservation,
                      assigned_tour_id: assignedTourId
                    } as ExtendedReservationRow
                  })
                }
              }

              console.log('📊 Other tours assigned reservations found:', filteredReservations.length)
              return filteredReservations
            } catch (error) {
              console.error('❌ Error processing other tours reservations:', error)
              return []
            }
          })()

          // 3. 배정 대기 중인 예약
          // 같은 tour_date와 product_id를 가진 모든 예약 중에서
          // 어느 투어의 reservation_ids에도 포함되지 않고
          // status가 confirmed 또는 recruiting인 예약
          let pendingReservations = allSameDateProductReservationsList.filter(r => {
            const reservationId = String(r.id).trim()
            const isInAnyTour = allAssignedReservationIdsSet.has(reservationId)
            const status = r.status ? String(r.status).toLowerCase().trim() : ''
            const isConfirmedOrRecruiting = status === 'confirmed' || status === 'recruiting'
            
            return !isInAnyTour && isConfirmedOrRecruiting
          })
          
          // pendingReservations에 고객 정보 매핑
          let pendingReservationsTyped: ExtendedReservationRow[] = pendingReservations as ExtendedReservationRow[]
          if (pendingReservationsTyped.length > 0) {
            const customerIds = [...new Set(pendingReservationsTyped.map(r => r.customer_id).filter(Boolean) as string[])]
            
            if (customerIds.length > 0) {
              const { data: pendingCustomersData, error: pendingCustomersError } = await supabase
                .from('customers')
                .select('*')
                .in('id', customerIds)
              
              if (!pendingCustomersError && pendingCustomersData) {
                const pendingCustomers = pendingCustomersData as CustomerRow[]
                pendingReservationsTyped = pendingReservationsTyped.map(reservation => {
                  const customer = pendingCustomers.find(c => c.id === reservation.customer_id)
                  return {
                    ...reservation,
                    customers: customer || null,
                    customer_name: customer?.name || '정보 없음',
                    customer_email: customer?.email || '',
                    customer_language: customer?.language || 'Unknown'
                  } as ExtendedReservationRow
                })
              }
            }
          }
          pendingReservations = pendingReservationsTyped
          
          // 4. 다른 상태의 예약
          // 같은 tour_date와 product_id를 가진 모든 예약 중에서
          // status가 confirmed 또는 recruiting이 아닌 예약
          // 투어의 상태와 상관없이, 배정 여부와 상관없이 모든 예약 포함
          let otherStatusReservations = allSameDateProductReservationsList.filter(r => {
            const status = r.status ? String(r.status).toLowerCase().trim() : ''
            const isConfirmedOrRecruiting = status === 'confirmed' || status === 'recruiting'
            
            // confirmed 또는 recruiting이 아닌 예약만 포함
            return !isConfirmedOrRecruiting
          })

          // otherStatusReservations에 고객 정보 매핑
          if (otherStatusReservations.length > 0) {
            const customerIds = [...new Set(otherStatusReservations.map(r => r.customer_id).filter(Boolean))]
            
            if (customerIds.length > 0) {
              const { data: otherStatusCustomersData, error: otherStatusCustomersError } = await supabase
                .from('customers')
                .select('*')
                .in('id', customerIds)
              
              if (!otherStatusCustomersError && otherStatusCustomersData) {
                const otherStatusCustomers = otherStatusCustomersData as CustomerRow[]
                otherStatusReservations = otherStatusReservations.map(reservation => {
                  const customer = otherStatusCustomers.find(c => c.id === reservation.customer_id)
                  return {
                    ...reservation,
                    customers: customer || null,
                    customer_name: customer?.name || '정보 없음',
                    customer_email: customer?.email || '',
                    customer_language: customer?.language || 'Unknown'
                  } as ExtendedReservationRow
                })
              }
            }
          }

          // cancelled 상태 확인 함수
          const isCancelled = (status: string | null | undefined): boolean => {
            if (!status) return false
            const normalizedStatus = String(status).toLowerCase().trim()
            return normalizedStatus === 'cancelled' || normalizedStatus === 'canceled' || normalizedStatus.includes('cancel')
          }

          // assignedReservations에서 cancelled 상태 제외
          const activeAssignedReservations = assignedReservations.filter(r => !isCancelled(r.status))

          // otherToursAssignedReservations에서도 cancelled 상태 제외
          const activeOtherToursAssignedReservations = otherToursAssignedReservations.filter(r => !isCancelled(r.status))

          const allOtherStatusReservations = otherStatusReservations
          
          console.log('📊 Other status reservations:', allOtherStatusReservations.map(r => {
            const ext = r as ExtendedReservationRow
            return {
              id: ext.id,
              customer_id: ext.customer_id,
              customer_name: ext.customer_name,
              status: ext.status
            }
          }))
          
          console.log('예약 분류 계산:', {
            assigned: activeAssignedReservations.length,
            otherToursAssigned: activeOtherToursAssignedReservations.length,
            pending: pendingReservations.length,
            otherStatus: allOtherStatusReservations.length
          })
          
          // 고객 이름이 "정보 없음"인 예약들 디버깅
          const assignedWithNoName = assignedReservations.filter(r => (r as ExtendedReservationRow).customer_name === '정보 없음')
          const pendingWithNoName = pendingReservations.filter(r => (r as ExtendedReservationRow).customer_name === '정보 없음')
          const otherToursWithNoName = otherToursAssignedReservations.filter(r => (r as ExtendedReservationRow).customer_name === '정보 없음')
          
          if (assignedWithNoName.length > 0) {
            console.log('⚠️ 배정된 예약 중 고객 이름이 없는 예약들:', assignedWithNoName.map(r => {
              const ext = r as ExtendedReservationRow
              return {
                id: ext.id,
                customer_id: ext.customer_id,
                customer_name: ext.customer_name
              }
            }))
          }
          
          if (pendingWithNoName.length > 0) {
            console.log('⚠️ 대기 중인 예약 중 고객 이름이 없는 예약들:', pendingWithNoName.map(r => {
              const ext = r as ExtendedReservationRow
              return {
                id: ext.id,
                customer_id: ext.customer_id,
                customer_name: ext.customer_name
              }
            }))
          }
          
          if (otherToursWithNoName.length > 0) {
            console.log('⚠️ 다른 투어 예약 중 고객 이름이 없는 예약들:', otherToursWithNoName.map(r => {
              const ext = r as ExtendedReservationRow
              return {
                id: ext.id,
                customer_id: ext.customer_id,
                customer_name: ext.customer_name
              }
            }))
          }
          
          setAssignedReservations(activeAssignedReservations)
          setPendingReservations(pendingReservations)
          setOtherToursAssignedReservations(activeOtherToursAssignedReservations)
          setOtherStatusReservations(allOtherStatusReservations)
        } else if (reservationsData && tourData) {
          // 고객 데이터가 아직 로드되지 않은 경우 기본 예약 분류만 수행
          console.log('⚠️ 고객 데이터가 아직 로드되지 않음, 기본 예약 분류만 수행')
          const tour = tourData as TourRow
          const assignedReservationIds = (tour.reservation_ids || []) as string[]
          
          // 같은 tour_date와 product_id를 가진 모든 투어들의 reservation_ids 수집
          if (!tour.product_id || !tour.tour_date) {
            console.error('투어 product_id 또는 tour_date가 없습니다.')
            return
          }
          const { data: allSameDateProductTours } = await supabase
            .from('tours')
            .select('id, reservation_ids')
            .eq('product_id', tour.product_id)
            .eq('tour_date', tour.tour_date)

          // 모든 투어의 reservation_ids를 수집
          const allAssignedReservationIdsSet = new Set<string>()
          const tours = (allSameDateProductTours || []) as Array<{ id: string; reservation_ids?: unknown }>
          setSameDayTourIds(tours.map(t => t.id))
          if (tours.length > 0) {
            tours.forEach(t => {
              const tourRow = t as TourRow
              if (tourRow.reservation_ids && Array.isArray(tourRow.reservation_ids)) {
                tourRow.reservation_ids.forEach((id: unknown) => {
                  const reservationId = String(id).trim()
                  if (reservationId) {
                    allAssignedReservationIdsSet.add(reservationId)
                  }
                })
              }
            })
          }

          // 같은 tour_date와 product_id를 가진 모든 예약 조회
          const { data: allSameDateProductReservations } = await supabase
            .from('reservations')
            .select('*')
            .eq('product_id', tour.product_id)
            .eq('tour_date', tour.tour_date)

          const allSameDateProductReservationsList = (allSameDateProductReservations || []) as ReservationRow[]
          
          // cancelled 상태 확인 함수
          const isCancelled = (status: string | null | undefined): boolean => {
            if (!status) return false
            const normalizedStatus = String(status).toLowerCase().trim()
            return normalizedStatus === 'cancelled' || normalizedStatus === 'canceled' || normalizedStatus.includes('cancel')
          }
          
          // 1. 이 투어에 배정된 예약
          const allAssignedReservations = allSameDateProductReservationsList.filter(r => 
            assignedReservationIds.includes(r.id)
          )
          const activeAssignedReservations = allAssignedReservations.filter(r => !isCancelled(r.status))
          
          // 3. 배정 대기 중인 예약
          const pendingReservations = allSameDateProductReservationsList.filter(r => {
            const reservationId = String(r.id).trim()
            const isInAnyTour = allAssignedReservationIdsSet.has(reservationId)
            const status = r.status ? String(r.status).toLowerCase().trim() : ''
            const isConfirmedOrRecruiting = status === 'confirmed' || status === 'recruiting'
            
            return !isInAnyTour && isConfirmedOrRecruiting
          })
          
          // 4. 다른 상태의 예약
          // 같은 tour_date와 product_id를 가진 모든 예약 중에서
          // status가 confirmed 또는 recruiting이 아닌 예약
          // 투어의 상태와 상관없이, 배정 여부와 상관없이 모든 예약 포함
          const otherStatusReservations = allSameDateProductReservationsList.filter(r => {
            const status = r.status ? String(r.status).toLowerCase().trim() : ''
            const isConfirmedOrRecruiting = status === 'confirmed' || status === 'recruiting'
            
            // confirmed 또는 recruiting이 아닌 예약만 포함
            return !isConfirmedOrRecruiting
          })
          
          setAssignedReservations(activeAssignedReservations as ExtendedReservationRow[])
          setPendingReservations(pendingReservations as ExtendedReservationRow[])
          setOtherToursAssignedReservations([])
          setOtherStatusReservations(otherStatusReservations as ExtendedReservationRow[])
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

  // 권한 체크는 AdminAuthGuard에서 처리하므로 여기서는 리다이렉트하지 않음
  // AdminAuthGuard가 이미 권한 없는 사용자를 홈으로 리다이렉트함

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
    console.log('🔍 getCustomerName called for customerId:', customerId)
    console.log('📊 Total customers loaded:', customers.length)
    
    if (!customerId) {
      console.log('❌ Customer ID is empty or null')
      return '정보 없음'
    }
    
    // 먼저 예약 데이터에서 직접 고객 이름 찾기
    const reservation = allReservations.find((r) => r.customer_id === customerId) as ExtendedReservationRow | undefined
    if (reservation && reservation.customer_name && reservation.customer_name !== '정보 없음') {
      console.log('✅ Found customer name from reservation:', reservation.customer_name)
      return reservation.customer_name
    }
    
    // 예약 데이터에 없으면 customers 배열에서 찾기
    const customer = customers.find((c) => c.id === customerId)
    if (customer) {
      console.log('✅ Found customer from customers array:', customer.name)
      
      // customer.name은 NOT NULL이므로 항상 존재함
      return customer.name
    }
    
    // 고객을 찾지 못한 경우 디버깅 정보 출력
    console.log('❌ Customer not found for ID:', customerId)
    console.log('🔍 Available customer IDs (first 10):', customers.slice(0, 10).map(c => c.id))
    console.log('🔍 Searching for similar IDs...')
    
    // 비슷한 ID가 있는지 확인
    const similarCustomers = customers.filter(c => 
      c.id.toLowerCase().includes(customerId.toLowerCase()) ||
      customerId.toLowerCase().includes(c.id.toLowerCase())
    )
    
    if (similarCustomers.length > 0) {
      console.log('🔍 Similar customer IDs found:', similarCustomers.map(c => c.id))
    }
    
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

  const getTeamMemberName = (email: string) => {
    if (!email) return '직원 미선택'
    const member = teamMembers.find((member) => member.email === email)
    if (!member) return email
    // 고객 언어 무관 team.display_name 사용
    return (member.display_name && member.display_name.trim()) || member.name_ko || member.name_en || email
  }

  /** team 테이블의 display_name 사용 (고객 언어 무관 통일 표시, 봉투 인쇄 등) */
  const getTeamMemberNameForLocale = (email: string, _lang: 'ko' | 'en') => {
    if (!email) return ''
    const member = teamMembers.find((m) => m.email === email)
    if (!member) return email
    return (member.display_name && member.display_name.trim()) || member.name_ko || member.name_en || email
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
    sameDayTourIds,
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
        const assignedReservationIds = (tour.reservation_ids || []) as string[]

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
          if (toursList.length > 0) {
            toursList.forEach(t => {
              const tourRow = t as TourRow
              if (tourRow.reservation_ids && Array.isArray(tourRow.reservation_ids)) {
                tourRow.reservation_ids.forEach((id: unknown) => {
                  const reservationId = String(id).trim()
                  if (reservationId) {
                    allAssignedReservationIdsSet.add(reservationId)
                    reservationToTourMap.set(reservationId, tourRow.id)
                  }
                })
              }
            })
          }

          let assignedReservations: ExtendedReservationRow[] = []
          if (assignedReservationIds.length > 0) {
            assignedReservations = reservationsList.filter(r =>
              assignedReservationIds.includes(r.id)
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
                if (tourRow.reservation_ids && Array.isArray(tourRow.reservation_ids)) {
                  tourRow.reservation_ids.forEach((id: unknown) => {
                    const reservationId = String(id).trim()
                    if (reservationId) {
                      otherReservationIdsSet.add(reservationId)
                      reservationToTourMap.set(reservationId, tourRow.id)
                    }
                  })
                }
              })
              const otherReservationIds = Array.from(otherReservationIdsSet)
              if (otherReservationIds.length === 0) return []

              const filteredReservations = reservationsList.filter(r =>
                otherReservationIds.includes(r.id) && !assignedReservationIds.includes(r.id)
              )
              return filteredReservations.map(reservation => ({
                ...reservation,
                assigned_tour_id: reservationToTourMap.get(reservation.id) || null
              }))
            } catch (error) {
              console.error('❌ Error processing other tours reservations:', error)
              return []
            }
          })()

          const pendingReservations = reservationsList.filter(r => {
            const reservationId = String(r.id).trim()
            const isInAnyTour = allAssignedReservationIdsSet.has(reservationId)
            const status = r.status ? String(r.status).toLowerCase().trim() : ''
            const isConfirmedOrRecruiting = status === 'confirmed' || status === 'recruiting'
            return !isInAnyTour && isConfirmedOrRecruiting
          })

          const otherStatusReservations = reservationsList.filter(r => {
            const status = r.status ? String(r.status).toLowerCase().trim() : ''
            const isConfirmedOrRecruiting = status === 'confirmed' || status === 'recruiting'
            return !isConfirmedOrRecruiting
          })

          const isCancelled = (status: string | null | undefined): boolean => {
            if (!status) return false
            const normalizedStatus = String(status).toLowerCase().trim()
            return normalizedStatus === 'cancelled' || normalizedStatus === 'canceled' || normalizedStatus.includes('cancel')
          }

          const activeAssignedReservations = assignedReservations.filter(r => !isCancelled(r.status))
          const activeOtherToursAssignedReservations = otherToursAssignedReservations.filter(r => !isCancelled(r.status))

          setAssignedReservations(activeAssignedReservations)
          setPendingReservations(pendingReservations)
          setOtherToursAssignedReservations(activeOtherToursAssignedReservations)
          setOtherStatusReservations(otherStatusReservations)
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
