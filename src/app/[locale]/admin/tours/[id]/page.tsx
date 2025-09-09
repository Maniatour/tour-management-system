'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Edit, Trash2, Copy, Plus, X, Check, Car, Settings, Hotel, Map, MapPin, Clock, User, Users } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import ReservationForm from '@/components/reservation/ReservationForm'
import VehicleAssignmentModal from '@/components/VehicleAssignmentModal'
import TicketBookingForm from '@/components/booking/TicketBookingForm'
import TourHotelBookingForm from '@/components/booking/TourHotelBookingForm'

type Tour = Database['public']['Tables']['tours']['Row']
type Product = Database['public']['Tables']['products']['Row']
type Customer = Database['public']['Tables']['customers']['Row']
type Reservation = Database['public']['Tables']['reservations']['Row']
type Team = Database['public']['Tables']['team']['Row']
type TicketBooking = Database['public']['Tables']['ticket_bookings']['Row']
type TourHotelBooking = Database['public']['Tables']['tour_hotel_bookings']['Row']

export default function TourDetailPage() {
  const params = useParams()
  const router = useRouter()
  
  const [tour, setTour] = useState<Tour | null>(null)
  const [isPrivateTour, setIsPrivateTour] = useState<boolean>(false)
  const [showPrivateTourModal, setShowPrivateTourModal] = useState(false)
  const [pendingPrivateTourValue, setPendingPrivateTourValue] = useState<boolean>(false)

  // 단독투어 상태 업데이트 함수
  const updatePrivateTourStatus = async (newValue: boolean) => {
    if (!tour) return

    try {
      const { error } = await supabase
        .from('tours')
        .update({ is_private_tour: newValue })
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
  const [product, setProduct] = useState<Product | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [assignedReservations, setAssignedReservations] = useState<Reservation[]>([])
  const [pendingReservations, setPendingReservations] = useState<Reservation[]>([])
  const [pickupHotels, setPickupHotels] = useState<Database['public']['Tables']['pickup_hotels']['Row'][]>([])
  const [pickupTimeValue, setPickupTimeValue] = useState<string>('')
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [teamMembers, setTeamMembers] = useState<Team[]>([])
  const [teamType, setTeamType] = useState<'1guide' | '2guide' | 'guide+driver'>('1guide')
  const [selectedGuide, setSelectedGuide] = useState<string>('')
  const [selectedAssistant, setSelectedAssistant] = useState<string>('')
  const [tourNote, setTourNote] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [showVehicleAssignment, setShowVehicleAssignment] = useState(false)
  const [assignedVehicle, setAssignedVehicle] = useState<Database['public']['Tables']['vehicles']['Row'] | null>(null)
  const [vehicles, setVehicles] = useState<Database['public']['Tables']['vehicles']['Row'][]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('')
  
  // 부킹 관련 상태
  const [ticketBookings, setTicketBookings] = useState<TicketBooking[]>([])
  const [tourHotelBookings, setTourHotelBookings] = useState<TourHotelBooking[]>([])
  const [showTicketBookingForm, setShowTicketBookingForm] = useState(false)
  const [showTourHotelBookingForm, setShowTourHotelBookingForm] = useState(false)
  const [editingTicketBooking, setEditingTicketBooking] = useState<TicketBooking | null>(null)
  const [editingTourHotelBooking, setEditingTourHotelBooking] = useState<TourHotelBooking | null>(null)
  const [showTicketBookingDetails, setShowTicketBookingDetails] = useState(false)

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
        setTicketBookings(ticketBookingsData || [])
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
        setTourHotelBookings(tourHotelBookingsData || [])
      }
    } catch (error) {
      console.error('부킹 데이터 조회 오류:', error)
    }
  }, [])

  const fetchTourData = useCallback(async (tourId: string) => {
    try {
      setLoading(true)
      
      // 투어 데이터 가져오기
      const { data: tourData, error: tourError } = await supabase
        .from('tours')
        .select('*')
        .eq('id', tourId)
        .single()

      if (tourError) {
        console.error('Error fetching tour:', tourError)
        return
      }

      if (tourData) {
        console.log('Tour data:', tourData)
        // Supabase의 TRUE/FALSE를 JavaScript의 true/false로 변환
        const processedTourData = {
          ...tourData,
          is_private_tour: tourData.is_private_tour === 'TRUE' || tourData.is_private_tour === true
        }
        setTour(processedTourData)
        setIsPrivateTour(processedTourData.is_private_tour)
        
        // 기존 팀 구성 정보 설정 (email 기반)
        if (tourData.tour_guide_id) {
          setSelectedGuide(tourData.tour_guide_id)
        }
        if (tourData.assistant_id) {
          setSelectedAssistant(tourData.assistant_id)
        }
        if (tourData.team_type) {
          setTeamType(tourData.team_type as '1guide' | '2guide' | 'guide+driver')
        }
        if (tourData.tour_note) {
          setTourNote(tourData.tour_note)
        }

        // 상품 정보 가져오기
        if (tourData.product_id) {
          const { data: productData } = await supabase
            .from('products')
            .select('*')
            .eq('id', tourData.product_id)
            .single()
          setProduct(productData)

          // 특정 투어가 아닌 경우 1가이드로 강제 설정
          if (productData && !['MDGC1D', 'MDGCSUNRISE'].includes(productData.id)) {
            if (tourData.team_type && tourData.team_type !== '1guide') {
              // 데이터베이스에서 1가이드로 업데이트
              const { error } = await supabase
                .from('tours')
                .update({ 
                  team_type: '1guide',
                  assistant_id: null 
                })
                .eq('id', tourId)
              
              if (error) {
                console.error('Error updating team type to 1guide:', error)
              } else {
                console.log('Team type updated to 1guide for non-special tour')
              }
            }
            setTeamType('1guide')
          }

          // 같은 상품 ID의 예약들을 가져오기
          console.log('Fetching reservations for:', {
            product_id: tourData.product_id,
            tour_date: tourData.tour_date
          })
          
          const { data: allReservations, error: reservationError } = await supabase
            .from('reservations')
            .select('*')
            .eq('product_id', tourData.product_id)
            .eq('tour_date', tourData.tour_date)

          console.log('Reservations query result:', { allReservations, reservationError })
          console.log('Sample reservation IDs:', allReservations?.map(r => ({ 
            id: r.id, 
            type: typeof r.id, 
            pickup_time: r.pickup_time,
            tour_date: r.tour_date,
            product_id: r.product_id
          })))
          console.log('Total reservations found:', allReservations?.length || 0)

          if (reservationError) {
            console.error('Error fetching reservations:', reservationError)
          }

          const reservations = allReservations || []
          setReservations(reservations)

          // 고객 정보 가져오기
          const customerIds = reservations.map(r => r.customer_id).filter(Boolean)
          if (customerIds.length > 0) {
            const { data: customerData } = await supabase
              .from('customers')
              .select('*')
              .in('id', customerIds)
            
            if (customerData) {
              setCustomers(customerData)
            }
          }

          // 픽업 호텔 정보 가져오기
          const { data: pickupHotelsData } = await supabase
            .from('pickup_hotels')
            .select('*')
          
          if (pickupHotelsData) {
            setPickupHotels(pickupHotelsData)
          }

          // 팀 멤버 정보 가져오기 (Tour Guide, is_active = true)
          const { data: teamData } = await supabase
            .from('team')
            .select('*')
            .eq('position', 'Tour Guide')
            .eq('is_active', true)
          
          if (teamData) {
            setTeamMembers(teamData)
          }

          // 이미 이 투어에 배정된 예약들
          const assignedReservations = reservations.filter(r => 
            tourData.reservation_ids && tourData.reservation_ids.includes(r.id)
          )
          console.log('Assigned reservations:', assignedReservations.length, assignedReservations.map(r => r.id))
          console.log('Reservation statuses:', assignedReservations.map(r => ({ id: r.id, status: r.status })))
          setAssignedReservations(assignedReservations)

          // 배정 대기중인 예약들 (다른 투어에 배정되지 않은 예약들)
          const { data: allTours } = await supabase
            .from('tours')
            .select('reservation_ids')
            .eq('product_id', tourData.product_id)
            .eq('tour_date', tourData.tour_date)
            .neq('id', tourId)

          console.log('Other tours for same product/date:', allTours?.length || 0)

          const assignedReservationIds = new Set()
          allTours?.forEach(tour => {
            if (tour.reservation_ids) {
              tour.reservation_ids.forEach((id: string) => assignedReservationIds.add(id))
            }
          })

          console.log('Reservation IDs assigned to other tours:', Array.from(assignedReservationIds))

          const pendingReservations = reservations.filter(r => 
            !assignedReservationIds.has(r.id) && !tourData.reservation_ids?.includes(r.id)
          )
          console.log('Pending reservations:', pendingReservations.length, pendingReservations.map(r => r.id))
          console.log('Pending reservation statuses:', pendingReservations.map(r => ({ id: r.id, status: r.status })))
          setPendingReservations(pendingReservations)
        }

        // 배정된 차량 정보 가져오기
        if (tourData.tour_car_id) {
          const { data: vehicleData } = await supabase
            .from('vehicles')
            .select('*')
            .eq('id', tourData.tour_car_id)
            .single()

          if (vehicleData) {
            setAssignedVehicle(vehicleData)
            setSelectedVehicleId(tourData.tour_car_id)
          }
        }

        // 차량 목록은 tour가 설정된 후 useEffect에서 가져옴
        
        // 부킹 데이터 가져오기
        await fetchBookings(tourId)
      }
    } catch (error) {
      console.error('Error fetching tour data:', error)
    } finally {
      setLoading(false)
    }
  }, [fetchBookings])

  useEffect(() => {
    const tourId = params.id as string
    if (tourId) {
      fetchTourData(tourId)
    }
  }, [params.id, fetchTourData])

  const fetchVehicles = useCallback(async () => {
    try {
      if (!tour) return

      // 같은 날짜의 다른 투어들에서 이미 배정된 차량 ID들을 가져오기
      const { data: assignedVehicles, error: assignedError } = await supabase
        .from('tours')
        .select('tour_car_id')
        .eq('tour_date', tour.tour_date)
        .not('id', 'eq', tour.id)
        .not('tour_car_id', 'is', null)

      if (assignedError) throw assignedError

      const assignedVehicleIds = assignedVehicles?.map(t => t.tour_car_id).filter(Boolean) || []

      // 사용 가능한 차량들만 가져오기
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .or(`and(vehicle_category.eq.company,vehicle_status.eq.운행 가능),and(vehicle_category.eq.rental,rental_status.neq.returned)`)
        .not('id', 'in', `(${assignedVehicleIds.join(',')})`)
        .order('vehicle_category', { ascending: true })
        .order('vehicle_number', { ascending: true })

      if (error) throw error
      
      // 렌터카의 경우 렌탈 기간에 투어 날짜가 포함되는지 확인
      const availableVehicles = (data || []).filter(vehicle => {
        if (vehicle.vehicle_category === 'company' || !vehicle.vehicle_category) {
          return true // 회사차는 항상 사용 가능
        }
        
        if (vehicle.vehicle_category === 'rental') {
          // 렌터카의 경우 렌탈 기간 확인
          if (!vehicle.rental_start_date || !vehicle.rental_end_date) {
            return false // 렌탈 기간이 설정되지 않은 렌터카는 제외
          }
          
          const tourDate = new Date(tour.tour_date)
          const rentalStartDate = new Date(vehicle.rental_start_date)
          const rentalEndDate = new Date(vehicle.rental_end_date)
          
          // 투어 날짜가 렌탈 기간에 포함되는지 확인
          return tourDate >= rentalStartDate && tourDate <= rentalEndDate
        }
        
        return true
      })
      
      setVehicles(availableVehicles)
    } catch (error) {
      console.error('차량 목록을 불러오는 중 오류가 발생했습니다:', error)
    }
  }, [tour])

  // tour가 설정되면 사용 가능한 차량 목록 가져오기
  useEffect(() => {
    if (tour) {
      fetchVehicles()
    }
  }, [tour, fetchVehicles])

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
      const { error } = await supabase
        .from('tours')
        .update({
          tour_car_id: vehicleId || null
        })
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
      const currentReservationIds = tour.reservation_ids || []
      const updatedReservationIds = [...currentReservationIds, reservationId]

      const { error } = await supabase
        .from('tours')
        .update({ reservation_ids: updatedReservationIds })
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
      const currentReservationIds = tour.reservation_ids || []
      const updatedReservationIds = currentReservationIds.filter((id: string) => id !== reservationId)

      const { error } = await supabase
        .from('tours')
        .update({ reservation_ids: updatedReservationIds })
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
    const hotel = pickupHotels.find(h => h.id === pickupHotelId)
    if (hotel) {
      return `${hotel.hotel} - ${hotel.pick_up_location}`
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

  const getTotalAssignedPeople = () => {
    return assignedReservations.reduce((total, reservation) => {
      return total + (reservation.total_people || 0)
    }, 0)
  }

  const getTotalPeople = () => {
    return reservations.reduce((total, reservation) => {
      return total + (reservation.total_people || 0)
    }, 0)
  }

  const handleAssignAllReservations = async () => {
    if (!tour || pendingReservations.length === 0) return

    try {
      const currentReservationIds = tour.reservation_ids || []
      const newReservationIds = pendingReservations.map(r => r.id)
      const updatedReservationIds = [...currentReservationIds, ...newReservationIds]

      const { error } = await supabase
        .from('tours')
        .update({ reservation_ids: updatedReservationIds })
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
      const { error } = await supabase
        .from('tours')
        .update({ reservation_ids: [] })
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

  const handleEditPickupTime = (reservation: Reservation) => {
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
      
      const { error } = await supabase
        .from('reservations')
        .update({ pickup_time: timeValue })
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
    // 특정 투어가 아닌 경우 1가이드로 강제 설정
    if (product && !['MDGC1D', 'MDGCSUNRISE'].includes(product.id) && type !== '1guide') {
      console.log('This tour only supports 1guide team type')
      return
    }
    
    setTeamType(type)
    setSelectedGuide('')
    setSelectedAssistant('')
    
    if (tour) {
      try {
        const updateData: { team_type: string; assistant_id?: string | null } = { team_type: type }
        if (type === '1guide') {
          updateData.assistant_id = null
        }
        
        const { error } = await supabase
          .from('tours')
          .update(updateData)
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
        
        const { error } = await supabase
          .from('tours')
          .update(updateData)
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
        const { error } = await supabase
          .from('tours')
          .update({ assistant_id: assistantEmail })
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
    return member ? member.name_ko : '직원 미선택'
  }

  const handleTourNoteChange = async (note: string) => {
    setTourNote(note)
    if (tour) {
      try {
        const { error } = await supabase
          .from('tours')
          .update({ tour_note: note })
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
  const handleEditReservationClick = (reservation: Reservation) => {
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

  const handleEditTicketBooking = (booking: TicketBooking) => {
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

  const handleEditTourHotelBooking = (booking: TourHotelBooking) => {
    setEditingTourHotelBooking(booking)
    setShowTourHotelBookingForm(true)
  }

  const handleCloseTourHotelBookingForm = () => {
    setShowTourHotelBookingForm(false)
    setEditingTourHotelBooking(null)
  }

  const handleBookingSubmit = async (booking: TicketBooking | TourHotelBooking) => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'inProgress': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'delayed': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
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
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">로딩 중...</div>
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
        <div className="px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push(`/${params.locale}/admin/tours`)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} />
          </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {product?.name || '투어 상세'}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                  <span>투어 ID: {tour.id}</span>
                  <span>|</span>
                  <span>날짜: {tour.tour_date ? new Date(tour.tour_date + 'T00:00:00').toLocaleDateString('ko-KR', {timeZone: 'America/Los_Angeles'}) : ''}</span>
                  <span>|</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tour.tour_status)}`}>
                    {getStatusText(tour.tour_status)}
                  </span>
        </div>
              </div>
        </div>
            <div className="flex items-center space-x-6">
              {/* 총 배정 인원 표시 */}
              <div className="text-center bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
                <div className="text-3xl font-bold text-blue-600">
                  {getTotalAssignedPeople()} / {getTotalPeople()}명
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {assignedReservations.length} / {reservations.length}건 예약
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
                <h2 className="text-md font-semibold text-gray-900 mb-3">기본 정보</h2>
                <div className="space-y-2">
            <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">투어명:</span>
                    <span className="font-medium text-sm">{product?.name || '-'}</span>
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
                    <span className="text-gray-600 text-sm">단독투어:</span>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isPrivateTour}
                        onChange={(e) => {
                          // 모달에 보여줄 새로운 값 설정 (체크박스의 반대 값)
                          setPendingPrivateTourValue(!isPrivateTour)
                          setShowPrivateTourModal(true)
                        }}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm font-medium text-gray-900">
                        {isPrivateTour ? '단독투어' : '일반투어'}
                      </span>
                    </label>
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

            {/* 픽업 스케줄 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-md font-semibold text-gray-900">픽업 스케줄</h2>
                  <button className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                    자동생성
                  </button>
            </div>
                <div className="space-y-2">
                  {assignedReservations.length > 0 ? (
                    (() => {
                      // 호텔별로 그룹화
                      const groupedByHotel = assignedReservations.reduce((acc, reservation) => {
                        const hotelName = getPickupHotelNameOnly(reservation.pickup_hotel)
                        if (!acc[hotelName]) {
                          acc[hotelName] = []
                        }
                        acc[hotelName].push(reservation)
                        return acc
                      }, {} as Record<string, Reservation[]>)

                      return Object.entries(groupedByHotel).map(([hotelName, reservations]) => {
                        const totalPeople = (reservations as Reservation[]).reduce((sum, res) => sum + (res.total_people || 0), 0)
                        const hotelInfo = pickupHotels.find(h => h.hotel === hotelName)
                        
                        // 가장 빠른 픽업 시간 찾기
                        const pickupTimes = (reservations as Reservation[]).map(r => r.pickup_time).filter(Boolean)
                        const earliestTime = pickupTimes.length > 0 ? 
                          pickupTimes.sort()[0].substring(0, 5) : '08:00'
                        
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
                                  onClick={() => openGoogleMaps(hotelInfo.link)}
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
                              {(reservations as Reservation[]).map((reservation) => (
                                <div key={reservation.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                  <div className="text-xs text-gray-600">
                                    {getCustomerName(reservation.customer_id)}
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
                <h2 className="text-md font-semibold text-gray-900 mb-3">팀 구성</h2>
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
                    {/* 2가이드와 가이드+드라이버는 특정 투어에서만 사용 가능 */}
                    {product && ['MDGC1D', 'MDGCSUNRISE'].includes(product.id) && (
                      <>
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
                      </>
                    )}
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
                            {member.name_ko}
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
                                {member.name_ko}
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
                <h2 className="text-md font-semibold text-gray-900 mb-3">차량 배정</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">차량 선택:</span>
                    <select
                      value={selectedVehicleId}
                      onChange={(e) => handleVehicleSelect(e.target.value)}
                      className="text-xs border rounded px-2 py-1 min-w-48"
                    >
                      <option value="">차량을 선택하세요</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.vehicle_category === 'company' 
                            ? `${vehicle.vehicle_number} - ${vehicle.vehicle_type} (${vehicle.capacity}인승)`
                            : `${vehicle.rental_company} - ${vehicle.vehicle_type} (${vehicle.capacity}인승) - ${vehicle.rental_start_date} ~ ${vehicle.rental_end_date}`
                          }
                        </option>
                      ))}
                    </select>
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
                
                {/* 배정된 예약 */}
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">배정된 예약 ({assignedReservations.length})</h3>
                  <div className="space-y-2">
                    {assignedReservations.map((reservation) => (
                      <div 
                        key={reservation.id} 
                        className="p-3 bg-blue-50 rounded-lg border cursor-pointer hover:bg-blue-100 transition-colors"
                        onClick={() => handleEditReservationClick(reservation)}
                      >
                        {/* 첫 번째 줄: 국기 | 이름 인원 */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {/* 언어 국기 아이콘 */}
                            <ReactCountryFlag
                              countryCode={getCountryCode(getCustomerLanguage(reservation.customer_id))}
                              svg
                              style={{
                                width: '16px',
                                height: '12px'
                              }}
                            />
                            {/* 고객 이름 */}
                            <span className="font-medium text-sm">{getCustomerName(reservation.customer_id)}</span>
                            {/* 총인원 */}
                            <span className="text-xs text-gray-600">
                              {reservation.total_people || 0}명
                            </span>
                            {/* 예약 상태 */}
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              reservation.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                              reservation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              reservation.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              reservation.status === 'recruiting' ? 'bg-blue-100 text-blue-800' :
                              reservation.status === 'completed' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {reservation.status === 'confirmed' ? '확정' :
                               reservation.status === 'pending' ? '대기' :
                               reservation.status === 'cancelled' ? '취소' :
                               reservation.status === 'recruiting' ? '모집중' :
                               reservation.status === 'completed' ? '완료' :
                               reservation.status || '미정'}
                            </span>
                          </div>
                          <button 
                            onClick={() => handleUnassignReservation(reservation.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        
                        {/* 두 번째 줄: 픽업시간 | 픽업 호텔 */}
            <div className="flex items-center justify-between">
                          {/* 픽업 시간 */}
                          <div className="flex items-center space-x-1">
                            <Clock size={10} className="text-gray-400" />
                            <span className="text-xs text-gray-600">
                              {reservation.pickup_time ? reservation.pickup_time.substring(0, 5) : '08:00'}
                            </span>
                            <button
                              onClick={() => handleEditPickupTime(reservation)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Edit size={10} />
                            </button>
            </div>
                          
                          {/* 픽업 호텔 이름 */}
                          <span className="text-xs text-gray-500 text-right flex-1 ml-2">
                            {getPickupHotelName(reservation.pickup_hotel)}
                          </span>
          </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 배정 대기중인 예약 */}
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">배정 대기중인 예약 ({pendingReservations.length})</h3>
                  <div className="space-y-2">
                    {pendingReservations.map((reservation) => (
                      <div 
                        key={reservation.id} 
                        className="p-3 bg-gray-50 rounded-lg border cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleEditReservationClick(reservation)}
                      >
                        {/* 첫 번째 줄: 국기 | 이름 인원 */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {/* 언어 국기 아이콘 */}
                            <ReactCountryFlag
                              countryCode={getCountryCode(getCustomerLanguage(reservation.customer_id))}
                              svg
                              style={{
                                width: '16px',
                                height: '12px'
                              }}
                            />
                            {/* 고객 이름 */}
                            <span className="font-medium text-sm">{getCustomerName(reservation.customer_id)}</span>
                            {/* 총인원 */}
                            <span className="text-xs text-gray-600">
                              {reservation.total_people || 0}명
                            </span>
                            {/* 예약 상태 */}
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              reservation.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                              reservation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              reservation.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              reservation.status === 'recruiting' ? 'bg-blue-100 text-blue-800' :
                              reservation.status === 'completed' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {reservation.status === 'confirmed' ? '확정' :
                               reservation.status === 'pending' ? '대기' :
                               reservation.status === 'cancelled' ? '취소' :
                               reservation.status === 'recruiting' ? '모집중' :
                               reservation.status === 'completed' ? '완료' :
                               reservation.status || '미정'}
                            </span>
                          </div>
                          <button 
                            onClick={() => handleAssignReservation(reservation.id)}
                            className="text-green-600 hover:text-green-800"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                        
                        {/* 두 번째 줄: 픽업시간 | 픽업 호텔 */}
            <div className="flex items-center justify-between">
                          {/* 픽업 시간 */}
                          <div className="flex items-center space-x-1">
                            <Clock size={10} className="text-gray-400" />
                            <span className="text-xs text-gray-600">
                              {reservation.pickup_time ? reservation.pickup_time.substring(0, 5) : '08:00'}
                            </span>
                            <button
                              onClick={() => handleEditPickupTime(reservation)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Edit size={10} />
                            </button>
            </div>
                          
                          {/* 픽업 호텔 이름 */}
                          <span className="text-xs text-gray-500 text-right flex-1 ml-2">
                            {getPickupHotelName(reservation.pickup_hotel)}
                          </span>
          </div>
        </div>
                    ))}
      </div>
    </div>

                {/* 요약 */}
                <div className="p-2 bg-gray-100 rounded text-xs text-gray-600">
                  총 예약: {reservations.length}건 | 배정: {assignedReservations.length}건 | 대기: {pendingReservations.length}건
            </div>
          </div>
        </div>
      </div>

          {/* 3열: 부킹 관리 */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-md font-semibold text-gray-900">부킹 관리</h2>
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
                            className="p-2 border rounded cursor-pointer hover:bg-gray-50 transition-colors"
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
                            className="border rounded p-3 cursor-pointer hover:bg-gray-50"
                            onClick={() => handleEditTourHotelBooking(booking)}
                          >
                            <div className="flex items-center space-x-2 mb-1">
                              <Hotel className="h-3 w-3 text-blue-600" />
                              <span className="font-medium text-xs">호텔 부킹</span>
                            </div>
                            <div className="text-xs text-gray-600">
                              <div>체크인: {booking.check_in_date}</div>
                              <div>체크아웃: {booking.check_out_date}</div>
                              <div>예약번호: {booking.booking_reference || 'N/A'}</div>
                              <div className="flex items-center space-x-2">
                                <span>상태:</span>
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
          </div>

          {/* 4열: 정산 관리 */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4">
                <h2 className="text-md font-semibold text-gray-900 mb-3">정산 관리</h2>
                
                {/* 수익, 지출, 정산 */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 bg-green-50 rounded">
                    <div className="text-lg font-bold text-green-600">$0</div>
                    <div className="text-xs text-gray-600">총 수입</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded">
                    <div className="text-lg font-bold text-red-600">$665.5</div>
                    <div className="text-xs text-gray-600">총 지출</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-lg font-bold text-gray-600">$-665.5</div>
                    <div className="text-xs text-gray-600">순이익</div>
                  </div>
                </div>

                {/* 지출 카테고리별 요약 */}
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">지출 카테고리별 요약</h3>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center p-2 bg-gray-50 rounded text-xs">
                      <span className="font-medium">antelope_booking</span>
                      <span className="text-gray-600">$250 (1건, 앤텔로프 캐년 투어 예약, 2024-01-15, 미상환)</span>
            </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 rounded text-xs">
                      <span className="font-medium">hotel_booking</span>
                      <span className="text-gray-600">$180 (1건, 투어 호텔 예약, 2024-01-14, 상환완료)</span>
            </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 rounded text-xs">
                      <span className="font-medium">연료비</span>
                      <span className="text-gray-600">$85.5 (1건, Shell Station 연료비, 2024-01-13, 미상환)</span>
            </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 rounded text-xs">
                      <span className="font-medium">가이드비</span>
                      <span className="text-gray-600">$150 (1건, 가이드 비용, 2024-01-12, 미상환)</span>
            </div>
            </div>
            </div>

                {/* 지출 관리 */}
            <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">지출 관리</h3>
                    <button className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center space-x-1">
                      <Plus size={10} />
                      <span>추가</span>
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    투어 운영 지출 | 총 지출: $665.5 | 미상환: $485.5 | 상환완료: $180
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center p-2 border rounded text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-red-600">미상환</span>
                        <span>antelope_booking</span>
                      </div>
                      <div className="text-gray-600">앤텔로프 캐년 투어 예약, 2024-01-15 - $250</div>
                    </div>
                    <div className="flex justify-between items-center p-2 border rounded text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-green-600">상환완료</span>
                        <span>hotel_booking</span>
                      </div>
                      <div className="text-gray-600">투어 호텔 예약, 2024-01-14 - $180</div>
                    </div>
                    <div className="flex justify-between items-center p-2 border rounded text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-red-600">미상환</span>
                        <span>연료비</span>
                      </div>
                      <div className="text-gray-600">Shell Station 연료비, 2024-01-13 - $85.5 (엔텔로프 투어 차량)</div>
                    </div>
                    <div className="flex justify-between items-center p-2 border rounded text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-red-600">미상환</span>
                        <span>가이드비</span>
                      </div>
                      <div className="text-gray-600">가이드 비용, 2024-01-12 - $150</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
                  countryCode={getCountryCode(getCustomerLanguage(selectedReservation.customer_id))}
                  svg
                  style={{ width: '16px', height: '12px' }}
                />
                <span className="font-medium text-sm">{getCustomerName(selectedReservation.customer_id)}</span>
                <span className="text-xs text-gray-600">
                  {selectedReservation.adults + selectedReservation.child}명
                </span>
            </div>
              <div className="text-xs text-gray-500 mb-4">
                {getPickupHotelName(selectedReservation.pickup_hotel)}
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
        <ReservationForm
          reservation={editingReservation}
          customers={customers}
          products={product ? [product] : []}
          channels={[]}
          productOptions={[]}
          optionChoices={[]}
          options={[]}
          pickupHotels={pickupHotels}
          coupons={[]}
          onSubmit={async (reservationData) => {
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
              <TicketBookingForm
                booking={editingTicketBooking}
                tourId={tour.id}
                onSave={handleBookingSubmit}
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
              <TourHotelBookingForm
                booking={editingTourHotelBooking}
                tourId={tour.id}
                onSave={handleBookingSubmit}
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

