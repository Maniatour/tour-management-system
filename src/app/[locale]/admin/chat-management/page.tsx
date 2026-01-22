'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Calendar, Search, RefreshCw, Languages, ChevronDown, Cast, Power, PowerOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { translateText, detectLanguage, SupportedLanguage, SUPPORTED_LANGUAGES } from '@/lib/translation'
import { useOptimizedData } from '@/hooks/useOptimizedData'
import { useFloatingChat } from '@/contexts/FloatingChatContext'
import { useAuth } from '@/contexts/AuthContext'
import { PickupSchedule } from '@/components/tour/PickupSchedule'

interface ChatRoom {
  id: string
  tour_id: string
  room_name: string
  room_code: string
  description?: string
  is_active: boolean
  created_by: string
  created_at: string
  last_message_at?: string
  unread_count: number
  tour?: {
    id: string
    product_id: string
    tour_date: string
    tour_guide_id: string
    assistant_id?: string
    tour_car_id?: string
    status: string
    product?: {
      name_ko?: string
      name_en?: string
      name?: string
      description?: string
    }
    reservations?: Array<{
      id: string
      adults: number
      child: number
      infant: number
    }>
  } | null
}

interface ChatMessage {
  id: string
  room_id: string
  sender_type: 'guide' | 'customer' | 'system' | 'admin'
  sender_name: string
  sender_email?: string
  message: string
  message_type: 'text' | 'image' | 'file' | 'system'
  file_url?: string
  file_name?: string
  file_size?: number
  is_read: boolean
  created_at: string
}

interface TourInfo {
  id: string
  product_id: string
  tour_date: string
  tour_guide_id: string
  assistant_id?: string
  tour_car_id?: string
  tour_status?: string
  total_people?: number
  product?: {
    name_ko?: string
    name_en?: string
    name?: string
    description?: string
  }
  tour_guide?: {
    email: string
    name: string
  }
  assistant?: {
    email: string
    name: string
  }
  reservations?: Array<{
    id: string
    adults: number
    child: number
    infant: number
    status: string
    total_people: number
    pickup_hotel?: string
    pickup_time?: string
    pickup_notification_sent?: boolean
    pickup_hotel_info?: {
      hotel: string
      pick_up_location: string
    }
          customer?: {
            id?: string
            name: string
            email: string
            phone?: string
            language?: string
          }
  }>
  vehicle?: {
    id: string
    vehicle_number: string
    vehicle_category: string
    driver_name?: string
    driver_phone?: string
  }
}

export default function ChatManagementPage() {
  const router = useRouter()
  const { openChat } = useFloatingChat()
  const { user } = useAuth()
  
  // 페이지 스크롤 방지
  useEffect(() => {
    // body와 html의 overflow를 hidden으로 설정
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    
    return () => {
      // 컴포넌트 언마운트 시 원래대로 복원
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [])
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [tourInfo, setTourInfo] = useState<TourInfo | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'inactive'>('upcoming')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['pickup-schedule']))
  const [pickupHotels, setPickupHotels] = useState<Array<{ id: string; hotel: string; pick_up_location?: string; google_maps_link?: string; link?: string }>>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingTourInfo, setLoadingTourInfo] = useState(false)
  const [inactiveRoomsData, setInactiveRoomsData] = useState<ChatRoom[]>([])
  const [loadingInactiveRooms, setLoadingInactiveRooms] = useState(false)

  // 비활성화된 채팅방 로딩 함수
  const fetchInactiveRooms = useCallback(async () => {
    if (inactiveRoomsData.length > 0) {
      // 이미 로드된 경우 스킵
      return
    }
    
    setLoadingInactiveRooms(true)
    try {
      // 비활성화된 채팅방만 가져오기
      const { data: inactiveRooms, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('is_active', false)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      if (!inactiveRooms || inactiveRooms.length === 0) {
        setInactiveRoomsData([])
        setLoadingInactiveRooms(false)
        return
      }

      // 투어 정보 가져오기 (활성화된 채팅방과 동일한 로직, 간소화 버전)
      const tourIds = (inactiveRooms as ChatRoom[]).map(room => room.tour_id).filter(Boolean) as string[]
      const tourMap = new Map<string, any>()
      
      if (tourIds.length > 0) {
        const TOUR_BATCH_SIZE = 50
        for (let i = 0; i < tourIds.length; i += TOUR_BATCH_SIZE) {
          const batchIds = tourIds.slice(i, i + TOUR_BATCH_SIZE)
          const { data: toursData, error: toursError } = await supabase
            .from('tours')
            .select(`
              id,
              product_id,
              tour_date,
              tour_guide_id,
              assistant_id,
              tour_car_id,
              tour_status,
              reservation_ids,
              product:products(
                name_ko,
                name_en,
                description
              )
            `)
            .in('id', batchIds)
          
          if (!toursError && toursData) {
            toursData.forEach((tour: any) => {
              tourMap.set(tour.id, tour)
            })
          }
        }
      }

      // 예약 정보 가져오기 (간단한 버전)
      const allReservationIds = new Set<string>()
      tourMap.forEach((tour: any) => {
        if (tour.reservation_ids) {
          const ids = Array.isArray(tour.reservation_ids) 
            ? tour.reservation_ids 
            : String(tour.reservation_ids).split(',').map((id: string) => id.trim()).filter((id: string) => id)
          ids.forEach((id: string) => allReservationIds.add(id))
        }
      })

      const reservationsMap = new Map<string, any>()
      if (allReservationIds.size > 0) {
        const reservationIdsArray = Array.from(allReservationIds)
        const RESERVATION_BATCH_SIZE = 50
        for (let i = 0; i < reservationIdsArray.length; i += RESERVATION_BATCH_SIZE) {
          const batchIds = reservationIdsArray.slice(i, i + RESERVATION_BATCH_SIZE)
          const { data: reservationsData } = await supabase
            .from('reservations')
            .select('id, adults, child, infant, total_people, status, pickup_hotel, pickup_time, customer_id')
            .in('id', batchIds)
            .neq('status', 'cancelled')
          
          if (reservationsData) {
            reservationsData.forEach((reservation: any) => {
              reservationsMap.set(reservation.id, reservation)
            })
          }
        }
      }

      // 픽업 호텔 정보 가져오기
      const pickupHotelsMap = new Map<string, any>()
      try {
        const { data: allHotelsData } = await supabase
          .from('pickup_hotels')
          .select('id, hotel, pick_up_location, address, link')
          .order('hotel')
        
        if (allHotelsData) {
          allHotelsData.forEach((hotel: any) => {
            if (hotel && hotel.id) {
              const trimmedId = String(hotel.id).trim()
              pickupHotelsMap.set(trimmedId, {
                ...hotel,
                id: trimmedId
              })
            }
          })
        }
      } catch (error) {
        console.error('[ChatManagement] 비활성화 채팅방 - 픽업 호텔 데이터 가져오기 예외:', error)
      }

      // 고객 정보 가져오기
      const customerIds = new Set<string>()
      reservationsMap.forEach((reservation: any) => {
        if (reservation.customer_id) {
          customerIds.add(reservation.customer_id)
        }
      })
      const customersMap = new Map<string, any>()
      if (customerIds.size > 0) {
        const customerIdsArray = Array.from(customerIds)
        const CUSTOMER_BATCH_SIZE = 50
        for (let i = 0; i < customerIdsArray.length; i += CUSTOMER_BATCH_SIZE) {
          const batchIds = customerIdsArray.slice(i, i + CUSTOMER_BATCH_SIZE)
          const { data: customersData } = await supabase
            .from('customers')
            .select('*')
            .in('id', batchIds)
          
          if (customersData) {
            customersData.forEach((customer: any) => {
              customersMap.set(customer.id, customer)
            })
          }
        }
      }

      // 안읽은 메시지 수 계산
      const roomIds = (inactiveRooms as ChatRoom[]).map(room => room.id)
      const unreadCountMap = new Map<string, number>()
      if (roomIds.length > 0) {
        const BATCH_SIZE = 50
        for (let i = 0; i < roomIds.length; i += BATCH_SIZE) {
          const batchIds = roomIds.slice(i, i + BATCH_SIZE)
          const { data: unreadMessages } = await supabase
            .from('chat_messages')
            .select('room_id')
            .in('room_id', batchIds)
            .eq('sender_type', 'customer')
            .eq('is_read', false)
          
          if (unreadMessages) {
            unreadMessages.forEach((msg: { room_id: string }) => {
              const currentCount = unreadCountMap.get(msg.room_id) || 0
              unreadCountMap.set(msg.room_id, currentCount + 1)
            })
          }
        }
      }

      // 채팅방에 투어 정보 매핑
      const roomsWithTour = inactiveRooms.map((room: ChatRoom) => {
        const tourData = tourMap.get(room.tour_id)
        if (!tourData) {
          return {
            ...room,
            tour: {
              id: room.tour_id,
              status: null,
              reservations: []
            },
            unread_count: unreadCountMap.get(room.id) || 0
          }
        }

        const assignedReservationIds = tourData.reservation_ids || []
        const tourReservationIds = Array.isArray(assignedReservationIds)
          ? assignedReservationIds.map((id: any) => String(id).trim()).filter((id: string) => id)
          : String(assignedReservationIds).split(',').map((id: string) => id.trim()).filter((id: string) => id)

        const reservations = tourReservationIds
          .map((reservationId: string) => {
            const reservation = reservationsMap.get(reservationId)
            if (!reservation) return null

            const pickupHotelId = reservation.pickup_hotel
            const trimmedHotelId = (pickupHotelId && typeof pickupHotelId === 'string' && pickupHotelId.trim() !== '') 
              ? pickupHotelId.trim() 
              : null
            
            let hotel = null
            if (trimmedHotelId) {
              hotel = pickupHotelsMap.get(trimmedHotelId)
              if (!hotel) {
                for (const [hotelId, hotelData] of pickupHotelsMap.entries()) {
                  if (String(hotelId).trim().toLowerCase() === trimmedHotelId.toLowerCase()) {
                    hotel = hotelData
                    break
                  }
                }
              }
            }
            
            const customer = reservation.customer_id ? customersMap.get(reservation.customer_id) : null
            const totalPeople = reservation.total_people 
              ? Number(reservation.total_people)
              : ((Number(reservation.adults) || 0) + (Number(reservation.child) || 0) + (Number(reservation.infant) || 0))

            return {
              id: reservation.id,
              adults: Number(reservation.adults) || 0,
              child: Number(reservation.child) || 0,
              infant: Number(reservation.infant) || 0,
              total_people: totalPeople,
              status: reservation.status || 'pending',
              pickup_hotel: trimmedHotelId || undefined,
              pickup_time: reservation.pickup_time ? String(reservation.pickup_time).trim() : undefined,
              pickup_hotel_info: hotel ? {
                hotel: hotel.hotel,
                pick_up_location: hotel.pick_up_location
              } : undefined,
            customer: customer ? {
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              language: customer.language
            } : undefined
            }
          })
          .filter(Boolean)

        const totalPeople = reservations.reduce((sum, r) => sum + (r?.total_people || 0), 0)

        return {
          ...room,
          tour: {
            id: tourData.id,
            product_id: tourData.product_id,
            tour_date: tourData.tour_date,
            tour_guide_id: tourData.tour_guide_id,
            assistant_id: tourData.assistant_id,
            tour_car_id: tourData.tour_car_id,
            status: tourData.tour_status || 'pending',
            total_people: totalPeople,
            product: tourData.product,
            reservations: reservations
          },
          unread_count: unreadCountMap.get(room.id) || 0
        }
      })

      setInactiveRoomsData(roomsWithTour as ChatRoom[])
    } catch (error) {
      console.error('[ChatManagement] 비활성화 채팅방 로딩 오류:', error)
      setInactiveRoomsData([])
    } finally {
      setLoadingInactiveRooms(false)
    }
  }, [inactiveRoomsData.length])

  // 비활성화 탭 클릭 시 채팅방 로딩
  useEffect(() => {
    if (activeTab === 'inactive') {
      fetchInactiveRooms()
    }
  }, [activeTab, fetchInactiveRooms])

  // 최적화된 채팅방 데이터 로딩 (활성화된 채팅방만 - 예정/지난 탭용)
  const { data: chatRoomsData, loading, refetch: refetchChatRooms, invalidateCache } = useOptimizedData({
    fetchFn: async () => {
      // 활성화된 채팅방만 가져오기 (예정/지난 탭용)
      const { data: chatRoomsData, error: chatRoomsError } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      
      // 투어 정보를 가져온 후 tour_date 기준으로 비활성화하므로 여기서는 스킵

      if (chatRoomsError) throw chatRoomsError

      if (!chatRoomsData || chatRoomsData.length === 0) {
        return []
      }

      // 모든 투어 ID 수집
      const tourIds = (chatRoomsData as ChatRoom[]).map(room => room.tour_id).filter(Boolean) as string[]
      
      // 단일 쿼리로 모든 투어 정보 가져오기 (배치 처리)
      const tourMap = new Map<string, any>()
      const productIds = new Set<string>()
      
      if (tourIds.length > 0) {
        const TOUR_BATCH_SIZE = 50
        for (let i = 0; i < tourIds.length; i += TOUR_BATCH_SIZE) {
          const batchIds = tourIds.slice(i, i + TOUR_BATCH_SIZE)
          
          try {
            const { data: toursData, error: toursError } = await supabase
              .from('tours')
              .select(`
                id,
                product_id,
                tour_date,
                tour_guide_id,
                assistant_id,
                tour_car_id,
                tour_status,
                reservation_ids,
                product:products(
                  name_ko,
                  name_en,
                  description
                )
              `)
              .in('id', batchIds)

            if (toursError) {
              console.warn(`Error fetching tours (batch ${Math.floor(i / TOUR_BATCH_SIZE) + 1}):`, toursError)
              continue
            }

            if (toursData) {
              toursData.forEach((tour: any) => {
                tourMap.set(tour.id, tour)
                if (tour.product_id) {
                  productIds.add(tour.product_id)
                }
              })
            }
          } catch (error) {
            console.warn(`Error processing tours batch ${Math.floor(i / TOUR_BATCH_SIZE) + 1}:`, error)
            continue
          }
        }
      }

      // tour_date 기준으로 14일이 지난 채팅방 자동 비활성화
      try {
        if (chatRoomsData && chatRoomsData.length > 0 && tourMap.size > 0) {
          // 현재 라스베가스 날짜를 기준으로 14일 전 날짜 계산
          const now = new Date()
          const lasVegasNow = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
          
          // 14일 전 날짜 계산 (YYYY-MM-DD 형식)
          const fourteenDaysAgo = new Date(lasVegasNow)
          fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
          const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split('T')[0] // YYYY-MM-DD 형식
          
          const roomsToDeactivate = chatRoomsData.filter((room: any) => {
            if (!room.is_active) return false // 이미 비활성화된 것은 제외
            
            const tourData = tourMap.get(room.tour_id)
            if (!tourData || !tourData.tour_date) return false // 투어 정보가 없거나 tour_date가 없으면 제외
            
            // tour_date는 YYYY-MM-DD 형식이므로 직접 문자열 비교
            const tourDateStr = tourData.tour_date
            
            // tour_date가 14일 전 날짜보다 이전이면 비활성화 대상
            return tourDateStr < fourteenDaysAgoStr
          })
          
          if (roomsToDeactivate.length > 0) {
            const roomIdsToDeactivate = roomsToDeactivate.map((room: any) => room.id)
            
            try {
              const updateQuery = (supabase.from('chat_rooms') as any).update({ is_active: false } as any)
              const { error: updateError } = await updateQuery.in('id', roomIdsToDeactivate)
              
              if (updateError) {
                console.warn('[ChatManagement] 채팅방 비활성화 중 오류:', updateError)
              } else {
                // 비활성화된 채팅방의 is_active 상태 업데이트
                chatRoomsData.forEach((room: any) => {
                  if (roomIdsToDeactivate.includes(room.id)) {
                    room.is_active = false
                  }
                })
                
                console.log(`[ChatManagement] ${roomsToDeactivate.length}개의 채팅방이 자동으로 비활성화되었습니다. (tour_date 기준 14일 경과)`)
              }
            } catch (updateError) {
              console.warn('[ChatManagement] 채팅방 비활성화 중 예외:', updateError)
              // 에러가 발생해도 계속 진행
            }
          }
        }
      } catch (error) {
        console.warn('[ChatManagement] 채팅방 자동 비활성화 로직 실행 중 오류:', error)
        // 에러가 발생해도 계속 진행
      }

      // 모든 투어의 reservation_ids 수집
      const allReservationIds = new Set<string>()
      tourMap.forEach((tour: any) => {
        if (tour.reservation_ids) {
          // reservation_ids가 배열인지 문자열인지 확인
          const ids = Array.isArray(tour.reservation_ids) 
            ? tour.reservation_ids 
            : String(tour.reservation_ids).split(',').map((id: string) => id.trim()).filter((id: string) => id)
          ids.forEach((id: string) => allReservationIds.add(id))
        }
      })

      // 예약 정보 배치로 가져오기 (reservation_ids 사용)
      const reservationsMap = new Map<string, any>()
      const reservationIdsArray = Array.from(allReservationIds)
      
      if (reservationIdsArray.length > 0) {
        const RESERVATION_BATCH_SIZE = 50
        for (let i = 0; i < reservationIdsArray.length; i += RESERVATION_BATCH_SIZE) {
          const batchIds = reservationIdsArray.slice(i, i + RESERVATION_BATCH_SIZE)
          
          try {
            const { data: reservationsData, error: reservationsError } = await supabase
              .from('reservations')
              .select(`
                id,
                tour_id,
                adults,
                child,
                infant,
                total_people,
                pickup_hotel,
                pickup_time,
                status,
                customer_id
              `)
              .in('id', batchIds)
              .neq('status', 'cancelled') // 취소된 예약 제외

            if (reservationsError) {
              console.warn(`Error fetching reservations (batch ${Math.floor(i / RESERVATION_BATCH_SIZE) + 1}):`, reservationsError)
              continue
            }

            if (reservationsData) {
              reservationsData.forEach((reservation: any) => {
                reservationsMap.set(reservation.id, reservation)
              })
            }
          } catch (error) {
            console.warn(`Error processing reservations batch ${Math.floor(i / RESERVATION_BATCH_SIZE) + 1}:`, error)
            continue
          }
        }
      }

      // 픽업 호텔 정보 가져오기 (투어 상세 페이지와 동일하게 모든 호텔을 한 번에 조회)
      const pickupHotelsMap = new Map<string, any>()
      try {
        // 투어 상세 페이지와 동일한 방식: 모든 호텔을 한 번에 가져오기
        // pickup_hotels 테이블에는 'link' 컬럼이 있음 (google_maps_link 아님)
        const { data: allHotelsData, error: hotelsError } = await supabase
          .from('pickup_hotels')
          .select('id, hotel, pick_up_location, address, link')
          .order('hotel')

        if (hotelsError) {
          console.error('[ChatManagement] 픽업 호텔 데이터 가져오기 오류:', hotelsError)
        } else if (allHotelsData && allHotelsData.length > 0) {
          // 모든 호텔을 Map에 저장 (ID를 trim하여 저장)
          allHotelsData.forEach((hotel: any) => {
            if (hotel && hotel.id) {
              const trimmedId = String(hotel.id).trim()
              pickupHotelsMap.set(trimmedId, {
                ...hotel,
                id: trimmedId
              })
            }
          })
          console.log('[ChatManagement] 픽업 호텔 데이터 가져오기 성공:', {
            totalHotels: allHotelsData.length,
            mapSize: pickupHotelsMap.size
          })
        }
      } catch (error) {
        console.error('[ChatManagement] 픽업 호텔 데이터 가져오기 예외:', error)
      }

      // 고객 정보 가져오기
      const customerIds = new Set<string>()
      reservationsMap.forEach((reservation: any) => {
        if (reservation.customer_id) {
          customerIds.add(reservation.customer_id)
        }
      })

      const customersMap = new Map<string, any>()
      if (customerIds.size > 0) {
        const customerIdsArray = Array.from(customerIds)
        const CUSTOMER_BATCH_SIZE = 50
        
        for (let i = 0; i < customerIdsArray.length; i += CUSTOMER_BATCH_SIZE) {
          const batchIds = customerIdsArray.slice(i, i + CUSTOMER_BATCH_SIZE)
          
          try {
            const { data: customersData, error: customersError } = await supabase
              .from('customers')
              .select('id, name, email, phone')
              .in('id', batchIds)

            if (customersError) {
              console.warn(`Error fetching customers (batch ${Math.floor(i / CUSTOMER_BATCH_SIZE) + 1}):`, customersError)
              continue
            }

            if (customersData) {
              customersData.forEach((customer: any) => {
                customersMap.set(customer.id, customer)
              })
            }
          } catch (error) {
            console.warn(`Error processing customers batch ${Math.floor(i / CUSTOMER_BATCH_SIZE) + 1}:`, error)
            continue
          }
        }
      }

      // 채팅방에 투어 정보 매핑 (투어 상세 페이지와 동일한 방식)
      const roomsWithTour = chatRoomsData.map((room: ChatRoom) => {
        const tourData = tourMap.get(room.tour_id)

        if (!tourData) {
          return {
            ...room,
            tour: {
              id: room.tour_id,
              status: null,
              reservations: []
            },
            unread_count: 0
          }
        }

        // 투어의 reservation_ids를 사용하여 배정된 예약만 가져오기 (투어 상세 페이지와 동일한 방식)
        const assignedReservationIds = tourData.reservation_ids || []
        const tourReservationIds = Array.isArray(assignedReservationIds)
          ? assignedReservationIds.map((id: any) => String(id).trim()).filter((id: string) => id)
          : String(assignedReservationIds).split(',').map((id: string) => id.trim()).filter((id: string) => id)

        // 배정된 예약 정보 가져오기 (호텔 정보 포함)
        const reservations = tourReservationIds
          .map((reservationId: string) => {
            const reservation = reservationsMap.get(reservationId)
            if (!reservation) {
              console.debug(`[ChatManagement] 예약을 찾을 수 없음:`, {
                reservationId,
                availableReservationIds: Array.from(reservationsMap.keys())
              })
              return null
            }

            // pickup_hotel 값이 유효한 경우에만 호텔 정보 찾기
            const pickupHotelId = reservation.pickup_hotel
            const trimmedHotelId = (pickupHotelId && typeof pickupHotelId === 'string' && pickupHotelId.trim() !== '') 
              ? pickupHotelId.trim() 
              : null
            
            // 호텔 정보 찾기
            let hotel = null
            if (trimmedHotelId) {
              // 정확한 ID 매칭 시도
              hotel = pickupHotelsMap.get(trimmedHotelId)
              
              // 정확한 매칭이 실패하면 대소문자 무시하고 찾기
              if (!hotel) {
                for (const [hotelId, hotelData] of pickupHotelsMap.entries()) {
                  if (String(hotelId).trim().toLowerCase() === trimmedHotelId.toLowerCase()) {
                    hotel = hotelData
                    console.log(`[ChatManagement] 대소문자 무시 매칭 성공:`, {
                      requested: trimmedHotelId,
                      found: hotelId
                    })
                    break
                  }
                }
              }
            }
            
            // 디버깅: 호텔 정보를 찾지 못한 경우
            if (trimmedHotelId && !hotel) {
              const availableHotelIds = Array.from(pickupHotelsMap.keys())
              const isInAvailableIds = availableHotelIds.includes(trimmedHotelId)
              const caseInsensitiveMatch = availableHotelIds.find(id => String(id).trim().toLowerCase() === trimmedHotelId.toLowerCase())
              
              // 실제로 해당 ID가 있는지 확인
              const exactMatch = availableHotelIds.find(id => String(id).trim() === trimmedHotelId)
              const similarMatches = availableHotelIds.filter(id => String(id).trim().includes(trimmedHotelId) || trimmedHotelId.includes(String(id).trim()))
              
              console.warn(`[ChatManagement] 호텔 정보를 찾을 수 없음:`, {
                reservationId: reservation.id,
                pickupHotelId: trimmedHotelId,
                reservationPickupHotel: reservation.pickup_hotel,
                pickupHotelsMapSize: pickupHotelsMap.size,
                isInAvailableIds,
                exactMatch: exactMatch || null,
                caseInsensitiveMatch: caseInsensitiveMatch || null,
                similarMatches: similarMatches.slice(0, 5),
                first10AvailableIds: availableHotelIds.slice(0, 10),
                requestedHotelIdType: typeof trimmedHotelId,
                requestedHotelIdLength: trimmedHotelId.length,
                requestedHotelIdChars: trimmedHotelId.split('').map(c => `${c}(${c.charCodeAt(0)})`).join(' ')
              })
            }
            
            const customer = reservation.customer_id ? customersMap.get(reservation.customer_id) : null

            // 인원 계산 (투어 상세 페이지와 동일한 방식)
            const totalPeople = reservation.total_people 
              ? Number(reservation.total_people)
              : ((Number(reservation.adults) || 0) + (Number(reservation.child) || 0) + (Number(reservation.infant) || 0))

            return {
              id: reservation.id,
              adults: Number(reservation.adults) || 0,
              child: Number(reservation.child) || 0,
              infant: Number(reservation.infant) || 0,
              total_people: totalPeople,
              status: reservation.status,
              pickup_hotel: trimmedHotelId || undefined,
              pickup_time: (reservation.pickup_time && typeof reservation.pickup_time === 'string') ? reservation.pickup_time.trim() : undefined,
              pickup_hotel_info: hotel ? {
                hotel: hotel.hotel,
                pick_up_location: hotel.pick_up_location,
                address: hotel.address,
                link: hotel.link
              } : undefined,
            customer: customer ? {
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              language: customer.language
            } : undefined
            }
          })
          .filter((r: any) => r !== null)

        // 총 인원 계산 (배정된 예약의 total_people 합계)
        const totalPeople = reservations.reduce((sum: number, r: any) => sum + (r.total_people || 0), 0)

        return {
          ...room,
          tour: {
            ...(tourData as Record<string, unknown>),
            status: (tourData as { tour_status: string }).tour_status,
            reservations: reservations,
            total_people: totalPeople // 총 인원 추가
          },
          unread_count: 0
        }
      })

      // 이제 읽지 않은 메시지 수 계산 - 배치 처리로 최적화
      const roomIds = roomsWithTour.map(room => room.id)
      
      // 채팅방이 없으면 빈 배열 반환
      if (roomIds.length === 0) {
        return roomsWithTour.map(room => ({
          ...room,
          unread_count: 0
        }))
      }
      
      // URL 길이 제한을 피하기 위해 배치로 나누어 조회
      const BATCH_SIZE = 50 // 한 번에 50개씩 처리
      const unreadCountMap = new Map<string, number>()
      
      // 배치로 나눠서 조회
      for (let i = 0; i < roomIds.length; i += BATCH_SIZE) {
        const batchIds = roomIds.slice(i, i + BATCH_SIZE)
        
        try {
          const { data: unreadMessages, error: unreadError } = await supabase
            .from('chat_messages')
            .select('room_id')
            .in('room_id', batchIds)
            .eq('sender_type', 'customer')
            .eq('is_read', false)
          
          // 에러 처리
          if (unreadError) {
            // 에러 객체가 비어있지 않은 경우에만 로깅
            if (unreadError.message || unreadError.code || unreadError.details || unreadError.hint) {
              console.error(`Error fetching unread messages (batch ${Math.floor(i / BATCH_SIZE) + 1}):`, {
                message: unreadError.message,
                code: unreadError.code,
                details: unreadError.details,
                hint: unreadError.hint,
                batchSize: batchIds.length
              })
            }
            // 에러가 발생해도 다음 배치는 계속 처리
            continue
          }
          
          // 채팅방별로 안읽은 메시지 수 계산
          if (unreadMessages && Array.isArray(unreadMessages)) {
            unreadMessages.forEach((msg: { room_id: string }) => {
              const currentCount = unreadCountMap.get(msg.room_id) || 0
              unreadCountMap.set(msg.room_id, currentCount + 1)
            })
          }
        } catch (error) {
          console.error(`Error processing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error)
          // 에러가 발생해도 다음 배치는 계속 처리
          continue
        }
      }
      
      // 각 채팅방에 안읽은 메시지 수 추가
      const roomsWithUnreadCount = roomsWithTour.map(room => ({
        ...room,
        unread_count: unreadCountMap.get(room.id) || 0
      }))

      return roomsWithUnreadCount
    },
    cacheKey: 'chat-rooms',
    cacheTime: 30 * 1000 // 30초 캐시 (투어 정보가 자주 변경되므로 짧은 캐시)
  })
  
  // 번역 관련 상태
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('ko')
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [translatedMessages, setTranslatedMessages] = useState<{ [key: string]: string }>({})
  const [translating, setTranslating] = useState<{ [key: string]: boolean }>({})

  // 상태 초기화 함수 (로딩 상태 제외)
  const resetState = useCallback(() => {
    setSelectedRoom(null)
    setMessages([])
    setNewMessage('')
    setSending(false)
    setSearchTerm('')
    setFilterStatus('all')
    setTourInfo(null)
    setRefreshing(false)
    setActiveTab('upcoming')
    setSelectedLanguage('ko')
    setShowLanguageDropdown(false)
    setTranslatedMessages({})
    setTranslating({})
  }, [])

  // 컴포넌트 마운트 시 한 번만 실행
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  // 페이지 포커스 시 및 주기적으로 투어 정보 새로고침 (백그라운드에서 조용히)
  useEffect(() => {
    let isRefreshing = false

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isRefreshing) {
        // 페이지가 다시 보일 때만 새로고침
        isRefreshing = true
        invalidateCache()
        refetchChatRooms().finally(() => {
          isRefreshing = false
        })
      }
    }

    // 60초마다 자동 새로고침 (투어 정보 최신화) - 간격을 늘려서 로딩 화면이 자주 나타나지 않도록
    const intervalId = setInterval(() => {
      if (!isRefreshing && !loading) {
        isRefreshing = true
        invalidateCache()
        refetchChatRooms().finally(() => {
          isRefreshing = false
        })
      }
    }, 60 * 1000) // 30초에서 60초로 변경

    // 페이지 포커스 시 새로고침
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refetchChatRooms, invalidateCache, loading])

  // 비활성화 탭 클릭 시 채팅방 로딩
  useEffect(() => {
    if (activeTab === 'inactive') {
      fetchInactiveRooms()
    }
  }, [activeTab, fetchInactiveRooms])

  // 번역 관련 함수들
  const needsTranslation = useCallback((message: ChatMessage) => {
    return message.sender_type === 'guide' && 
           !message.message.startsWith('[EN] ') &&
           selectedLanguage !== 'ko'
  }, [selectedLanguage])

  const getLanguageDisplayName = (langCode: SupportedLanguage) => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === langCode)
    return lang ? lang.name : langCode.toUpperCase()
  }

  // 기존 메시지 번역
  const translateExistingMessages = useCallback(async () => {
    const guideMessages = messages.filter(msg => 
      msg.sender_type === 'guide' && 
      !msg.message.startsWith('[EN] ') &&
      needsTranslation(msg)
    )
    
    console.log('Translating existing messages for language:', selectedLanguage)
    console.log('Found guide messages to translate:', guideMessages.length)
    
    for (const message of guideMessages) {
      if (translating[message.id]) continue
      
      setTranslating(prev => ({ ...prev, [message.id]: true }))
      try {
        const result = await translateText(message.message, detectLanguage(message.message), selectedLanguage)
        setTranslatedMessages(prev => ({
          ...prev,
          [message.id]: result.translatedText
        }))
      } catch (error) {
        console.error('Translation error:', error)
      } finally {
        setTranslating(prev => ({ ...prev, [message.id]: false }))
      }
    }
  }, [messages, selectedLanguage, translating, needsTranslation])

  // 언어 변경 시 기존 메시지 번역
  useEffect(() => {
    if (messages.length > 0) {
      translateExistingMessages()
    }
  }, [selectedLanguage, messages, translateExistingMessages])

  // 언어 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showLanguageDropdown) {
        const target = event.target as Element
        if (!target.closest('.language-dropdown')) {
          setShowLanguageDropdown(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showLanguageDropdown])

  // 새로고침 함수
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refetchChatRooms()
      if (selectedRoom) {
        await fetchMessages(selectedRoom.id)
      }
    } catch (error) {
      console.error('새로고침 중 오류:', error)
    } finally {
      setRefreshing(false)
    }
  }

  // 채팅방 목록 가져오기

  // 선택된 채팅방의 메시지 가져오기
  const fetchMessages = useCallback(async (roomId: string) => {
    setLoadingMessages(true)
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  // 투어 정보 가져오기 (투어 상세 페이지와 동일한 구조 사용)
  const fetchTourInfo = useCallback(async (tourId: string) => {
    setLoadingTourInfo(true)
    try {
      // 1단계: 투어 기본 정보 가져오기
      const { data: tourData, error: tourError } = await supabase
        .from('tours')
        .select('*')
        .eq('id', tourId)
        .single()

      if (tourError) throw tourError

      // 2단계: 상품 정보 가져오기
      let productData = null
      if ((tourData as { product_id?: string }).product_id) {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', (tourData as { product_id: string }).product_id)
          .single()

        if (!productError) {
          productData = product
        }
      }

      // 2.5단계: 가이드와 어시스턴트 정보 가져오기 (team 테이블에서 name_ko 조회)
      let tourGuideData = null
      let assistantData = null

      if ((tourData as { tour_guide_id?: string }).tour_guide_id) {
        try {
          // 먼저 직접 조회 시도 (더 안전한 방식)
          const { data: directGuide, error: directError } = await supabase
            .from('team')
            .select('email, name_ko')
            .eq('email', (tourData as { tour_guide_id: string }).tour_guide_id)
            .single()

          if (!directError && directGuide) {
            tourGuideData = {
              email: (directGuide as { email: string }).email,
              name: (directGuide as { name_ko?: string; email: string }).name_ko || (directGuide as { email: string }).email
            }
          } else {
            // 직접 조회 실패 시 RPC 함수 시도 (fallback)
            console.log('Direct query failed, trying RPC function...', directError)
            
            const { data: guideData, error: guideError } = await supabase
              .from('team')
              .select('email, name_ko')
              .eq('email', (tourData as { tour_guide_id: string }).tour_guide_id)
              .single()

            if (!guideError && guideData) {
              tourGuideData = {
                email: (guideData as { email: string }).email,
                name: (guideData as { name_ko?: string; email: string }).name_ko || (guideData as { email: string }).email
              }
            } else {
              console.error('Both direct query and RPC failed:', { directError, guideError })
              // team 테이블에서 찾을 수 없는 경우 이메일을 이름으로 사용
              tourGuideData = {
                email: (tourData as { tour_guide_id: string }).tour_guide_id,
                name: (tourData as { tour_guide_id: string }).tour_guide_id
              }
            }
          }
        } catch (error) {
          console.error('Error fetching guide info:', error)
          // 오류 발생 시 이메일을 이름으로 사용
          tourGuideData = {
            email: (tourData as { tour_guide_id: string }).tour_guide_id,
            name: (tourData as { tour_guide_id: string }).tour_guide_id
          }
        }
      }

      if ((tourData as { assistant_id?: string }).assistant_id) {
        try {
          // 먼저 직접 조회 시도 (더 안전한 방식)
          const { data: directAssistant, error: directError } = await supabase
            .from('team')
            .select('email, name_ko')
            .eq('email', (tourData as { assistant_id: string }).assistant_id)
            .single()

          if (!directError && directAssistant) {
            assistantData = {
              email: (directAssistant as { email: string }).email,
              name: (directAssistant as { name_ko?: string; email: string }).name_ko || (directAssistant as { email: string }).email
            }
          } else {
            // 직접 조회 실패 시 RPC 함수 시도 (fallback)
            console.log('Direct query failed, trying RPC function...', directError)
            
            const { data: assistantRpcData, error: assistantError } = await supabase
              .from('team')
              .select('email, name_ko')
              .eq('email', (tourData as { assistant_id: string }).assistant_id)
              .single()

            if (!assistantError && assistantRpcData) {
              assistantData = {
                email: (assistantRpcData as { email: string }).email,
                name: (assistantRpcData as { name_ko?: string; email: string }).name_ko || (assistantRpcData as { email: string }).email
              }
            } else {
              console.error('Both direct query and RPC failed:', { directError, assistantError })
              // team 테이블에서 찾을 수 없는 경우 이메일을 이름으로 사용
              assistantData = {
                email: (tourData as { assistant_id: string }).assistant_id,
                name: (tourData as { assistant_id: string }).assistant_id
              }
            }
          }
        } catch (error) {
          console.error('Error fetching assistant info:', error)
          // 오류 발생 시 이메일을 이름으로 사용
          assistantData = {
            email: (tourData as { assistant_id: string }).assistant_id,
            name: (tourData as { assistant_id: string }).assistant_id
          }
        }
      }

      // 3단계: 예약 정보 가져오기 (reservation_ids 사용 - 투어 상세 페이지와 동일)
      const assignedReservationIds = (tourData as { reservation_ids?: string[] | string }).reservation_ids || []
      const reservationIdsArray = Array.isArray(assignedReservationIds)
        ? assignedReservationIds.map((id: any) => String(id).trim()).filter((id: string) => id)
        : String(assignedReservationIds).split(',').map((id: string) => id.trim()).filter((id: string) => id)

      let reservationsData: Array<Record<string, unknown>> = []
      if (reservationIdsArray.length > 0) {
        const { data: assignedReservations, error: reservationsError } = await supabase
          .from('reservations')
          .select('*, pickup_notification_sent')
          .in('id', reservationIdsArray)
        
        if (reservationsError) {
          console.warn('Error fetching assigned reservations:', reservationsError)
        } else {
          reservationsData = (assignedReservations || []) as Array<Record<string, unknown>>
        }
        
        console.log('[ChatManagement] fetchTourInfo - 예약 데이터 조회:', {
          requestedIds: reservationIdsArray.length,
          foundReservations: reservationsData.length,
          sampleReservation: reservationsData[0] ? {
            id: reservationsData[0].id,
            pickup_hotel: reservationsData[0].pickup_hotel,
            pickup_time: reservationsData[0].pickup_time,
            customer_id: reservationsData[0].customer_id
          } : null
        })
      }

      // 4단계: 고객 정보 가져오기 (예약이 있는 경우에만)
      let customersData: Array<{ id: string; name: string; email: string; phone?: string }> = []
      if (reservationsData && reservationsData.length > 0) {
        const customerIds = reservationsData.map((r: Record<string, unknown>) => r.customer_id as string).filter(Boolean) as string[]
        if (customerIds.length > 0) {
          const { data: customers, error: customersError } = await supabase
            .from('customers')
            .select('*')
            .in('id', customerIds)

          if (!customersError) {
            customersData = customers || []
          }
        }
      }

      // 5단계: 차량 정보 가져오기
      let vehicleData = null
      if ((tourData as { tour_car_id?: string }).tour_car_id) {
        const { data: vehicle, error: vehicleError } = await supabase
          .from('vehicles')
          .select('*')
          .eq('id', (tourData as { tour_car_id: string }).tour_car_id)
          .maybeSingle()

        // PGRST116 에러는 결과가 없을 때 발생하는 정상적인 경우
        if (!vehicleError || vehicleError.code === 'PGRST116') {
          vehicleData = vehicle
        }
      }

      // 5.5단계: 픽업 호텔 정보 가져오기 (PickupSchedule 컴포넌트용)
      // 투어 상세 페이지와 동일한 방식: 모든 호텔을 한 번에 가져오기
      let pickupHotelsData: Array<{ id: string; hotel: string; pick_up_location?: string; google_maps_link?: string; link?: string }> = []
      try {
        // pickup_hotels 테이블에는 'link' 컬럼이 있음 (google_maps_link 아님)
        const { data: allHotelsData, error: pickupHotelsError } = await supabase
          .from('pickup_hotels')
          .select('id, hotel, pick_up_location, link')
          .order('hotel')

        if (pickupHotelsError) {
          console.error('[ChatManagement] fetchTourInfo - 픽업 호텔 데이터 가져오기 오류:', pickupHotelsError)
        } else if (allHotelsData && allHotelsData.length > 0) {
          // ID를 trim하여 저장하고, link를 google_maps_link로 매핑 (PickupSchedule 컴포넌트 호환성)
          pickupHotelsData = allHotelsData.map((h: any) => ({
            ...h,
            id: String(h.id).trim(),
            google_maps_link: h.link || undefined // link를 google_maps_link로 매핑
          }))
          setPickupHotels(pickupHotelsData)
          
          console.log('[ChatManagement] fetchTourInfo - 픽업 호텔 정보 조회 완료:', {
            totalHotels: pickupHotelsData.length,
            hotelIds: pickupHotelsData.slice(0, 10).map((h: any) => h.id) // 처음 10개만 표시
          })
        }
      } catch (error) {
        console.error('[ChatManagement] fetchTourInfo - 픽업 호텔 데이터 가져오기 예외:', error)
      }

      // 6단계: 데이터 결합 (투어 상세 페이지와 동일한 구조)
      const combinedReservations = (reservationsData || []).map((reservation: Record<string, unknown>) => {
        const customer = customersData.find((c) => c.id === reservation.customer_id as string)
        
        // pickup_hotel 값이 유효한 경우에만 호텔 정보 찾기
        const pickupHotelId = reservation.pickup_hotel
        const trimmedHotelId = (pickupHotelId && typeof pickupHotelId === 'string' && pickupHotelId.trim() !== '') 
          ? pickupHotelId.trim() 
          : null
        
        // 호텔 정보 찾기
        let pickupHotel = null
        if (trimmedHotelId) {
          // 정확한 ID 매칭 시도 (trim된 ID로 비교)
          pickupHotel = pickupHotelsData.find((h) => String(h.id).trim() === trimmedHotelId)
          
          // 정확한 매칭이 실패하면 대소문자 무시하고 찾기
          if (!pickupHotel) {
            pickupHotel = pickupHotelsData.find((h) => String(h.id).trim().toLowerCase() === trimmedHotelId.toLowerCase())
            if (pickupHotel) {
              console.log(`[ChatManagement] fetchTourInfo - 대소문자 무시 매칭 성공:`, {
                requested: trimmedHotelId,
                found: pickupHotel.id
              })
            }
          }
        }
        
        // 디버깅: 호텔 정보를 찾지 못한 경우
        if (trimmedHotelId && !pickupHotel) {
          const availableHotelIds = pickupHotelsData.map((h: any) => String(h.id).trim())
          const isInAvailableIds = availableHotelIds.includes(trimmedHotelId)
          const exactMatch = availableHotelIds.find((id: string) => id === trimmedHotelId)
          const caseInsensitiveMatch = availableHotelIds.find((id: string) => id.toLowerCase() === trimmedHotelId.toLowerCase())
          const similarMatches = availableHotelIds.filter((id: string) => id.includes(trimmedHotelId) || trimmedHotelId.includes(id))
          
          console.warn(`[ChatManagement] fetchTourInfo - 호텔 정보를 찾을 수 없음:`, {
            reservationId: reservation.id,
            pickupHotelId: trimmedHotelId,
            reservationPickupHotel: reservation.pickup_hotel,
            pickupHotelsDataCount: pickupHotelsData.length,
            isInAvailableIds,
            exactMatch: exactMatch || null,
            caseInsensitiveMatch: caseInsensitiveMatch || null,
            similarMatches: similarMatches.slice(0, 5),
            first10AvailableIds: availableHotelIds.slice(0, 10),
            requestedHotelIdType: typeof trimmedHotelId,
            requestedHotelIdLength: trimmedHotelId.length,
            requestedHotelIdChars: trimmedHotelId.split('').map(c => `${c}(${c.charCodeAt(0)})`).join(' ')
          })
        }
        
        const result = {
          id: reservation.id as string,
          adults: (reservation.adults as number) || 0,
          child: (reservation.child as number) || 0,
          infant: (reservation.infant as number) || 0,
          total_people: (reservation.total_people as number) || ((reservation.adults as number) || 0) + ((reservation.child as number) || 0) + ((reservation.infant as number) || 0),
          status: (reservation.status as string) || 'pending',
          pickup_hotel: trimmedHotelId || undefined,
          pickup_time: (reservation.pickup_time && typeof reservation.pickup_time === 'string') ? reservation.pickup_time.trim() : undefined,
          pickup_notification_sent: reservation.pickup_notification_sent as boolean || false,
          pickup_hotel_info: pickupHotel ? {
            hotel: pickupHotel.hotel,
            pick_up_location: pickupHotel.pick_up_location
          } : undefined,
            customer: customer ? {
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              language: (customer as any).language
            } : undefined
        }
        
        // 디버깅: 호텔 정보가 없는 경우
        if (trimmedHotelId && !pickupHotel) {
          console.warn(`[ChatManagement] fetchTourInfo - 호텔 정보 매핑 실패:`, {
            reservationId: result.id,
            pickupHotelId: trimmedHotelId,
            hasPickupHotelsData: pickupHotelsData.length > 0,
            availableHotelIds: pickupHotelsData.map((h: any) => h.id)
          })
        }
        
        return result
      })

      const combinedData: TourInfo = {
        ...(tourData as Record<string, unknown>),
        id: (tourData as Record<string, unknown>)?.id as string || '',
        product_id: (tourData as Record<string, unknown>)?.product_id as string || '',
        tour_date: (tourData as Record<string, unknown>)?.tour_date as string || '',
        tour_guide_id: (tourData as Record<string, unknown>)?.tour_guide_id as string || '',
        product: productData ? {
          name_ko: (productData as Record<string, unknown>).name_ko as string,
          name_en: (productData as Record<string, unknown>).name_en as string,
          name: (productData as Record<string, unknown>).name as string,
          description: (productData as Record<string, unknown>).description as string
        } : undefined,
        tour_guide: tourGuideData || undefined,
        assistant: assistantData || undefined,
        vehicle: vehicleData ? {
          id: (vehicleData as Record<string, unknown>).id as string,
          vehicle_number: (vehicleData as Record<string, unknown>).vehicle_number as string,
          vehicle_category: (vehicleData as Record<string, unknown>).vehicle_category as string
          // driver_name과 driver_phone은 optional이므로 생략 가능
        } : undefined,
        reservations: combinedReservations
      } as TourInfo

      setTourInfo(combinedData)
    } catch (error) {
      console.error('Error fetching tour info:', error)
    } finally {
      setLoadingTourInfo(false)
    }
  }, [])

  // 메시지 전송
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom || sending) return

    const messageText = newMessage.trim()
    setSending(true)
    
    // 즉시 UI에 메시지 표시 (낙관적 업데이트)
    const tempMessage: ChatMessage = {
      id: `temp_${Date.now()}`,
      room_id: selectedRoom.id,
      sender_type: 'admin',
      sender_name: '관리자',
      sender_email: 'admin@kovegas.com',
      message: messageText,
      message_type: 'text',
      is_read: false,
      created_at: new Date().toISOString()
    }
    
    setMessages(prev => [...prev, tempMessage])
    setNewMessage('')

    try {
      const { data, error } = await (supabase as unknown as { from: (table: string) => { insert: (data: unknown) => { select: () => { single: () => Promise<{ data: unknown; error: unknown }> } } } })
        .from('chat_messages')
        .insert({
          room_id: selectedRoom.id,
          sender_type: 'admin',
          sender_name: '관리자',
          sender_email: 'admin@kovegas.com',
          message: messageText,
          message_type: 'text'
        })
        .select()
        .single()

      if (error) throw error
      
      // 실제 메시지로 교체
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempMessage.id ? (data as ChatMessage) : msg
        )
      )
    } catch (error) {
      console.error('Error sending message:', error)
      alert('메시지 전송 중 오류가 발생했습니다.')
      
      // 실패 시 임시 메시지 제거
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id))
    } finally {
      setSending(false)
    }
  }

  // 채팅방 활성화/비활성화 토글
  const toggleRoomActive = async (roomId: string, currentStatus: boolean, event: React.MouseEvent) => {
    event.stopPropagation() // 채팅방 선택 이벤트 방지
    
    try {
      const updateQuery = (supabase.from('chat_rooms') as any).update({ is_active: !currentStatus })
      const { error } = await updateQuery.eq('id', roomId)
      
      if (error) throw error
      
      // 채팅방 목록 새로고침
      await refetchChatRooms()
      
      // 현재 선택된 채팅방이면 상태 업데이트
      if (selectedRoom?.id === roomId) {
        setSelectedRoom({ ...selectedRoom, is_active: !currentStatus } as ChatRoom)
      }
    } catch (error) {
      console.error('Error toggling room active status:', error)
      alert('채팅방 상태 변경 중 오류가 발생했습니다.')
    }
  }

  // 지난 투어 채팅방 일괄 비활성화
  const deactivatePastRooms = async () => {
    // 현재 라스베가스 날짜 기준으로 오늘 이전의 투어 채팅방 찾기
    const now = new Date()
    const lasVegasNow = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
    const todayStr = lasVegasNow.toISOString().split('T')[0] // YYYY-MM-DD 형식

    // 지난 탭에 표시되는 채팅방들 찾기
    const pastRooms = chatRooms.filter(room => {
      if (!room.is_active) return false // 이미 비활성화된 것은 제외
      if (!(room.tour as Record<string, unknown>)?.tour_date) return false
      const tourDateStr = (room.tour as Record<string, unknown>).tour_date as string
      return tourDateStr < todayStr
    })

    if (pastRooms.length === 0) {
      alert('비활성화할 지난 투어 채팅방이 없습니다.')
      return
    }

    if (!confirm(`지난 투어 채팅방 ${pastRooms.length}개를 비활성화하시겠습니까?`)) {
      return
    }

    try {
      const roomIds = pastRooms.map(room => room.id)

      // 해당 채팅방들을 비활성화
      const { error: updateError } = await supabase
        .from('chat_rooms')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('id', roomIds)

      if (updateError) throw updateError

      alert(`${pastRooms.length}개의 지난 투어 채팅방이 비활성화되었습니다.`)
      
      // 채팅방 목록 새로고침
      await refetchChatRooms()
      if (activeTab === 'inactive') {
        setInactiveRoomsData([]) // 비활성화 탭 데이터 초기화하여 다시 로드
        await fetchInactiveRooms()
      }
    } catch (error) {
      console.error('Error deactivating past rooms:', error)
      alert('채팅방 비활성화 중 오류가 발생했습니다.')
    }
  }

  // 채팅방 선택 (비동기, 블로킹하지 않음)
  const selectRoom = (room: ChatRoom) => {
    // 즉시 채팅방 선택 (UI 반응성 향상)
    setSelectedRoom(room)
    setMessages([]) // 이전 메시지 초기화
    setTourInfo(null) // 이전 투어 정보 초기화
    
    // 메시지와 투어 정보를 병렬로 로딩 (비동기, 블로킹하지 않음)
    // await를 사용하지 않고 Promise만 사용하여 즉시 반환
    Promise.all([
      // 메시지 로딩
      fetchMessages(room.id).catch(error => {
        console.error('Error loading messages:', error)
      }),
      // 투어 정보 로딩 (room.tour가 있으면)
      room.tour ? fetchTourInfo(room.tour.id).catch(error => {
        console.error('Error loading tour info:', error)
      }) : Promise.resolve()
    ]).then(() => {
      // 읽지 않은 메시지를 읽음 처리 (비동기, 블로킹하지 않음)
      (supabase as unknown as { from: (table: string) => { update: (data: unknown) => { eq: (column: string, value: unknown) => { eq: (column: string, value: unknown) => { eq: (column: string, value: unknown) => Promise<unknown> } } } } })
        .from('chat_messages')
        .update({ is_read: true })
        .eq('room_id', room.id)
        .eq('sender_type', 'customer')
        .eq('is_read', false)
        .then(() => {
          // 채팅방 목록 새로고침 (비동기, 블로킹하지 않음)
          refetchChatRooms().catch(error => {
            console.error('Error refreshing chat rooms:', error)
          })
        })
        .catch(error => {
          console.error('Error marking messages as read:', error)
        })
    }).catch(error => {
      console.error('Error loading room data:', error)
    })
  }

  // 안전한 채팅방 데이터 (탭에 따라 다른 데이터 소스 사용)
  const chatRooms = activeTab === 'inactive' ? inactiveRoomsData : (chatRoomsData || [])

  // 탭별 필터링된 채팅방 목록
  const filteredRooms = chatRooms
    .filter(room => {
      const matchesSearch = room.room_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (((room.tour as Record<string, unknown>)?.product as Record<string, unknown>)?.name_ko as string)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (((room.tour as Record<string, unknown>)?.product as Record<string, unknown>)?.name as string)?.toLowerCase().includes(searchTerm.toLowerCase())
      
      if (!matchesSearch) return false
      
      // 비활성화 탭: is_active가 false인 채팅방만 (이미 inactiveRoomsData에서 필터링됨)
      if (activeTab === 'inactive') {
        return true // inactiveRoomsData는 이미 비활성화된 것만 포함
      }
      
      // 예정/지난 탭: is_active가 true인 채팅방만 (이미 chatRoomsData에서 필터링됨)
      // chatRoomsData는 이미 활성화된 것만 포함하므로 추가 필터링 불필요
      
      // 탭별 필터링 (라스베가스 현지 시간 기준)
      if ((room.tour as Record<string, unknown>)?.tour_date) {
        // 투어 날짜는 YYYY-MM-DD 형식이므로 직접 비교
        const tourDateStr = (room.tour as Record<string, unknown>).tour_date as string
        
        // 현재 라스베가스 날짜를 YYYY-MM-DD 형식으로 가져오기
        const now = new Date()
        const lasVegasNow = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
        const todayStr = lasVegasNow.toISOString().split('T')[0] // YYYY-MM-DD 형식
        
        if (activeTab === 'past') {
          return tourDateStr < todayStr
        } else if (activeTab === 'upcoming') {
          return tourDateStr >= todayStr
        }
      }
      
      // 투어 날짜가 없는 경우 upcoming 탭에만 표시
      return activeTab === 'upcoming'
    })
    .sort((a, b) => {
      // 1. 읽지 않은 메시지가 있는 채팅방을 맨 위로
      if (a.unread_count > 0 && b.unread_count === 0) return -1
      if (a.unread_count === 0 && b.unread_count > 0) return 1
      
      // 2. 읽지 않은 메시지 수가 같다면, 읽지 않은 메시지 수가 많은 순으로
      if (a.unread_count !== b.unread_count) {
        return b.unread_count - a.unread_count
      }
      
      // 3. 투어 날짜 기준으로 정렬
      const dateA = (a.tour as Record<string, unknown>)?.tour_date ? new Date((a.tour as Record<string, unknown>).tour_date as string) : new Date('9999-12-31')
      const dateB = (b.tour as Record<string, unknown>)?.tour_date ? new Date((b.tour as Record<string, unknown>).tour_date as string) : new Date('9999-12-31')
      
      if (activeTab === 'past') {
        // 지난 투어는 최근 날짜순
        return dateB.getTime() - dateA.getTime()
      } else if (activeTab === 'inactive') {
        // 비활성화된 채팅방은 최근 생성일순
        const createdA = new Date(a.created_at).getTime()
        const createdB = new Date(b.created_at).getTime()
        return createdB - createdA
      } else {
        // 진행 예정 투어는 가까운 날짜순
        return dateA.getTime() - dateB.getTime()
      }
    })

  // 실시간 메시지 구독
  useEffect(() => {
    if (!selectedRoom) return

    const channel = supabase
      .channel(`chat_${selectedRoom.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${selectedRoom.id}`
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage
          setMessages(prev => [...prev, newMessage])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedRoom])


  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      // 상태 초기화 (로딩 상태 제외)
      resetState()
    }
  }, [resetState])

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (dateString: string) => {
    // DATE 타입은 YYYY-MM-DD 형식이므로 직접 파싱
    const [year, month, day] = dateString.split('-').map(Number)
    
    // 라스베가스 시간대로 날짜 생성 (시간은 00:00:00으로 설정)
    const lasVegasDate = new Date(year, month - 1, day)
    
    return lasVegasDate.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Los_Angeles'
    })
  }

  const formatTourDate = (dateString: string) => {
    // DATE 타입은 YYYY-MM-DD 형식이므로 직접 파싱
    const [year, month, day] = dateString.split('-').map(Number)
    
    // 라스베가스 시간대로 날짜 생성 (시간은 00:00:00으로 설정)
    const lasVegasDate = new Date(year, month - 1, day)
    
    return lasVegasDate.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
      timeZone: 'America/Los_Angeles'
    })
  }

  const getTourStatus = (status: string) => {
    // 상태값을 그대로 표시하고 색상만 설정
    const getStatusColor = (status: string) => {
      switch (status?.toLowerCase()) {
        case 'confirmed':
        case '확정':
          return 'bg-green-100 text-green-800'
        case 'pending':
        case '대기':
          return 'bg-yellow-100 text-yellow-800'
        case 'cancelled':
        case '취소':
          return 'bg-red-100 text-red-800'
        case 'completed':
        case '완료':
          return 'bg-blue-100 text-blue-800'
        default:
          return 'bg-gray-100 text-gray-800'
      }
    }
    
    return { 
      text: status || '미정', 
      color: getStatusColor(status) 
    }
  }


  // 초기 로딩만 전체 페이지 블로킹 (채팅방 목록이 없을 때만)
  if (loading && !chatRoomsData) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px-12px-50px)]">
        <div className="text-center">
          <div className="text-gray-500 mb-2">채팅방 목록을 불러오는 중...</div>
          <div className="text-xs text-gray-400">잠시만 기다려주세요</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px-12px-50px)] -mx-1 sm:-mx-2 lg:-mx-3 -mb-6 overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50" style={{ maxHeight: 'calc(100vh - 64px - 12px - 50px)' }}>
      {/* 왼쪽: 채팅방 목록 - 모바일에서는 숨김/표시 토글 */}
      <div className={`${selectedRoom ? 'hidden lg:flex' : 'flex'} lg:w-96 w-full bg-white/80 backdrop-blur-sm border-r border-gray-200 flex-col shadow-lg`}>
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">투어 채팅</h1>
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-sm text-gray-500">
                읽지않은 메시지 ({filteredRooms.reduce((sum, room) => sum + room.unread_count, 0)})
              </div>
              <button
                onClick={deactivatePastRooms}
                className="flex items-center justify-center px-2 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                title="지난 투어 채팅방 일괄 비활성화"
              >
                <PowerOff size={14} className="mr-1" />
                <span className="hidden sm:inline">지난 투어 비활성화</span>
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={refreshing ? '새로고침 중...' : '새로고침'}
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          
          {/* 탭 메뉴 */}
          <div className="flex space-x-1 mb-4">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`flex-1 px-2 py-2 text-xs font-medium rounded-lg transition-colors ${
                activeTab === 'upcoming'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              예정 ({chatRooms.filter(room => {
                if (!room.is_active) return false
                if (!(room.tour as Record<string, unknown>)?.tour_date) return true
                const tourDateStr = (room.tour as Record<string, unknown>).tour_date as string
                const now = new Date()
                const lasVegasNow = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
                const todayStr = lasVegasNow.toISOString().split('T')[0]
                return tourDateStr >= todayStr
              }).length})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`flex-1 px-2 py-2 text-xs font-medium rounded-lg transition-colors ${
                activeTab === 'past'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              지난 ({chatRooms.filter(room => {
                if (!room.is_active) return false
                if (!(room.tour as Record<string, unknown>)?.tour_date) return false
                const tourDateStr = (room.tour as Record<string, unknown>).tour_date as string
                const now = new Date()
                const lasVegasNow = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
                const todayStr = lasVegasNow.toISOString().split('T')[0]
                return tourDateStr < todayStr
              }).length})
            </button>
            <button
              onClick={() => setActiveTab('inactive')}
              className={`flex-1 px-2 py-2 text-xs font-medium rounded-lg transition-colors ${
                activeTab === 'inactive'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              비활성화 ({activeTab === 'inactive' ? inactiveRoomsData.length : '...'})
            </button>
          </div>
          
          {/* 검색 및 필터 */}
          <div className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="채팅방 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체</option>
              <option value="active">확정된 투어</option>
              <option value="pending">대기중인 투어</option>
            </select>
          </div>
        </div>

        {/* 채팅방 목록 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'inactive' && loadingInactiveRooms ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center text-gray-500">
                <div className="text-sm">비활성화된 채팅방을 불러오는 중...</div>
              </div>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center text-gray-500">
                <MessageCircle size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-sm">
                  {activeTab === 'past' ? '지난 투어가 없습니다' : 
                   activeTab === 'inactive' ? '비활성화된 채팅방이 없습니다' : 
                   '예정 투어가 없습니다'}
                </p>
              </div>
            </div>
          ) : (
            filteredRooms.map((room) => (
            <div
              key={room.id}
              className={`p-2 border-b overflow-hidden border-gray-100 transition-colors ${
                selectedRoom?.id === room.id 
                  ? 'bg-blue-50 border-l-2 border-l-blue-500' 
                  : room.unread_count > 0 
                    ? 'bg-yellow-50 border-l-2 border-l-yellow-400' 
                    : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div 
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => selectRoom(room as unknown as ChatRoom)}
                >
                  {/* 상품 이름과 상태 */}
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className={`text-xs truncate ${
                      room.unread_count > 0 
                        ? 'font-bold text-gray-900' 
                        : 'font-medium text-gray-900'
                    }`}>
                      {String(((room.tour as Record<string, unknown>)?.product as Record<string, unknown>)?.name_ko || ((room.tour as Record<string, unknown>)?.product as Record<string, unknown>)?.name || room.room_name)}
                      {room.unread_count > 0 && ' • 새 메시지'}
                    </h3>
                    {(room.tour as Record<string, unknown>)?.status ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTourStatus((room.tour as Record<string, unknown>).status as string).color}`}>
                        {String((room.tour as Record<string, unknown>).status)}
                      </span>
                    ) : null}
                  </div>
                  
                  {/* 투어 날짜, 인원 정보, 방 코드 */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center">
                      <Calendar size={10} className="mr-1" />
                      <span className="truncate">
                        {(room.tour as Record<string, unknown>)?.tour_date ? formatTourDate(String((room.tour as Record<string, unknown>).tour_date)) : '날짜미정'}
                      </span>
                      {(room.tour as Record<string, unknown>)?.total_people ? (
                        <span className="ml-2 text-gray-400">
                          {(room.tour as Record<string, unknown>).total_people as number}명
                        </span>
                      ) : (room.tour as Record<string, unknown>)?.reservations && Array.isArray((room.tour as Record<string, unknown>).reservations) && ((room.tour as Record<string, unknown>).reservations as unknown[]).length > 0 ? (
                        <span className="ml-2 text-gray-400">
                          {((room.tour as Record<string, unknown>).reservations as Array<{ total_people?: number }>).reduce((sum, r) => sum + (r.total_people || 0), 0)}명
                        </span>
                      ) : null}
                    </div>
                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                      {room.room_code}
                    </span>
                  </div>
                </div>
                
                {/* 활성화/비활성화 토글, 플로팅 버튼과 읽지 않은 메시지 수 */}
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={(e) => toggleRoomActive(room.id, room.is_active, e)}
                    className={`p-1 rounded transition-colors ${
                      room.is_active
                        ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                    }`}
                    title={room.is_active ? '비활성화' : '활성화'}
                  >
                    {room.is_active ? <Power size={14} /> : <PowerOff size={14} />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if ((room.tour as Record<string, unknown>)?.tour_date) {
                        openChat({
                          id: `chat_mgmt_${room.id}_${Date.now()}`,
                          tourId: room.tour_id,
                          tourDate: (room.tour as Record<string, unknown>).tour_date as string,
                          guideEmail: user?.email || "admin@tour.com",
                          tourName: room.id
                        })
                      }
                    }}
                    className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="플로팅 채팅방 열기"
                  >
                    <Cast size={14} />
                  </button>
                  {room.unread_count > 0 && (
                    <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                      {room.unread_count}
                    </div>
                  )}
                </div>
              </div>
            </div>
            ))
          )}
        </div>
      </div>

      {/* 가운데: 채팅창 - 모바일에서는 전체 화면 */}
      <div className={`${selectedRoom ? 'flex' : 'hidden lg:flex'} flex-1 flex-col`}>
        {selectedRoom ? (
          <>
            {/* 채팅 헤더 */}
            <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  {/* 모바일에서 뒤로가기 버튼 추가 */}
                  <div className="flex items-center space-x-2 mb-2 lg:hidden">
                    <button
                      onClick={() => setSelectedRoom(null)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                      title="채팅방 목록으로 돌아가기"
                    >
                      ←
                    </button>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 truncate">
                    {(((selectedRoom.tour as Record<string, unknown>)?.product as Record<string, unknown>)?.name_ko as string) || (((selectedRoom.tour as Record<string, unknown>)?.product as Record<string, unknown>)?.name as string) || selectedRoom.room_name}
                  </h2>
                  <p className="text-sm text-gray-500 truncate">
                    {(selectedRoom.tour as Record<string, unknown>)?.tour_date ? formatDate((selectedRoom.tour as Record<string, unknown>).tour_date as string) : '날짜 미정'}
                  </p>
                </div>
                <div className="flex items-center space-x-2 lg:space-x-4">
                  <div className="text-sm text-gray-500 hidden lg:block">
                    방 코드: {selectedRoom.room_code}
                  </div>
                  
                  {/* 언어 선택 */}
                  <div className="flex items-center space-x-1 lg:space-x-2">
                    <div className="relative language-dropdown">
                      <button
                        onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                        className="flex items-center space-x-1 lg:space-x-2 px-2 lg:px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <span className="text-lg">
                          {selectedLanguage === 'ko' ? '🇰🇷' : '🇺🇸'}
                        </span>
                        <span className="text-sm font-medium hidden lg:inline">
                          {selectedLanguage === 'ko' ? '한국어' : 'English'}
                        </span>
                        <ChevronDown size={16} className="text-gray-500" />
                      </button>
                      
                      {showLanguageDropdown && (
                        <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                setSelectedLanguage('ko')
                                setShowLanguageDropdown(false)
                              }}
                              className={`w-full flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 ${
                                selectedLanguage === 'ko' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                              }`}
                            >
                              <span className="text-base">🇰🇷</span>
                              <span className="truncate">한국어</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedLanguage('en')
                                setShowLanguageDropdown(false)
                              }}
                              className={`w-full flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 ${
                                selectedLanguage === 'en' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                              }`}
                            >
                              <span className="text-base">🇺🇸</span>
                              <span className="truncate">English</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* 번역 버튼 */}
                    <button
                      onClick={translateExistingMessages}
                      className="px-2 lg:px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-1 text-sm"
                      title="모든 가이드 메시지 번역"
                    >
                      <Languages size={16} />
                      <span className="hidden lg:inline">번역</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto p-2 lg:p-4 space-y-3 lg:space-y-4 bg-gradient-to-b from-transparent to-blue-50/30">
              {loadingMessages && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-gray-500">메시지를 불러오는 중...</div>
                </div>
              )}
              {!loadingMessages && messages.length === 0 && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-gray-500">메시지가 없습니다.</div>
                </div>
              )}
              {!loadingMessages && messages.map((message) => {
                const hasTranslation = translatedMessages[message.id]
                const isTranslating = translating[message.id]
                const needsTrans = needsTranslation(message)
                
                return (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-3 lg:px-4 py-2 rounded-lg shadow-sm ${
                        message.sender_type === 'admin'
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                          : message.sender_type === 'system'
                          ? 'bg-gray-200/80 backdrop-blur-sm text-gray-700 text-center'
                          : 'bg-white/90 backdrop-blur-sm text-gray-900 border border-gray-200/50'
                      }`}
                    >
                      {message.sender_type !== 'system' && (
                        <div className="text-xs font-medium mb-1">
                          {message.sender_name}
                        </div>
                      )}
                      
                      {/* 원본 메시지 */}
                      <div className="text-sm">{message.message}</div>
                      
                      {/* 번역된 메시지 */}
                      {needsTrans && (
                        <div className="mt-2">
                          {isTranslating ? (
                            <div className="text-xs text-gray-500 italic">
                              번역 중...
                            </div>
                          ) : hasTranslation ? (
                            <div className="text-xs text-white">
                              <span className="font-medium">{getLanguageDisplayName(selectedLanguage)}:</span> {hasTranslation}
                            </div>
                          ) : (
                            <button
                              onClick={async () => {
                                setTranslating(prev => ({ ...prev, [message.id]: true }))
                                try {
                                  const result = await translateText(message.message, detectLanguage(message.message), selectedLanguage)
                                  setTranslatedMessages(prev => ({
                                    ...prev,
                                    [message.id]: result.translatedText
                                  }))
                                } catch (error) {
                                  console.error('Translation error:', error)
                                } finally {
                                  setTranslating(prev => ({ ...prev, [message.id]: false }))
                                }
                              }}
                              className="text-xs text-blue-300 hover:text-blue-200 underline"
                            >
                              번역하기
                            </button>
                          )}
                        </div>
                      )}
                      
                      <div className="text-xs mt-1 opacity-70">
                        {formatTime(message.created_at)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 메시지 입력 */}
            <div className="bg-white/90 backdrop-blur-sm border-t border-gray-200 p-2 lg:p-4 flex-shrink-0 shadow-lg">
              <div className="flex items-center space-x-2 w-full">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm lg:text-base"
                  disabled={sending}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="flex-shrink-0 px-3 lg:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base"
                >
                  <span className="hidden lg:inline">{sending ? '전송 중...' : '전송'}</span>
                  <span className="lg:hidden">{sending ? '...' : '전송'}</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <MessageCircle size={48} className="mx-auto mb-4 text-gray-300" />
              <p>채팅방을 선택해주세요</p>
            </div>
          </div>
        )}
      </div>

       {/* 오른쪽: 투어 정보 - 모바일에서는 숨김 */}
       <div className="hidden lg:block lg:w-[28rem] bg-white/80 backdrop-blur-sm border-l border-gray-200 overflow-y-auto shadow-lg">
        {loadingTourInfo ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-gray-500 mb-2">투어 정보를 불러오는 중...</div>
              <div className="text-xs text-gray-400">잠시만 기다려주세요</div>
            </div>
          </div>
        ) : tourInfo ? (
          <div className="p-4 space-y-4">
            {/* 헤더 */}
            <div className="border-b border-gray-200 pb-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">투어 정보</h3>
                <button
                  onClick={() => router.push(`/ko/admin/tours/${tourInfo.id}`)}
                  className="px-3 py-1 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors"
                >
                  상세보기
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTourStatus(tourInfo.tour_status || '').color}`}>
                  {tourInfo.tour_status || '미정'}
                </span>
                <span className="text-sm text-gray-500">{formatTourDate(tourInfo.tour_date)}</span>
              </div>
            </div>

            {/* 투어 기본정보 */}
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">투어 기본정보</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">투어 ID</span>
                  <span className="text-gray-900 font-mono text-xs">{tourInfo.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">상품</span>
                  <span className="text-gray-900 font-medium">{tourInfo.product?.name_ko || tourInfo.product?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">인원</span>
                  <span className="text-gray-900">
                    {tourInfo.total_people || tourInfo.reservations?.reduce((sum, r) => sum + (r.total_people || 0), 0) || 0}명
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">예약</span>
                  <span className="text-gray-900">{tourInfo.reservations?.length || 0}건</span>
                </div>
              </div>
            </div>

            {/* 픽업스케줄 - 투어 상세 페이지 컴포넌트 사용 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <PickupSchedule
                assignedReservations={tourInfo.reservations?.map((res: any) => {
                  // customer_id는 customer 객체에서 가져오거나 reservation의 customer_id 사용
                  const customerId = res.customer?.id || null
                  
                  return {
                    id: res.id,
                    customer_id: customerId,
                    pickup_hotel: res.pickup_hotel || null,
                    pickup_time: res.pickup_time || null,
                    adults: res.adults || 0,
                    children: res.child || 0,
                    infants: res.infant || 0,
                    tour_date: tourInfo.tour_date || null,
                    pickup_notification_sent: res.pickup_notification_sent || false
                  }
                }) || []}
                pickupHotels={pickupHotels}
                expandedSections={expandedSections}
                connectionStatus={{ reservations: true }}
                onToggleSection={(sectionId: string) => {
                  setExpandedSections(prev => {
                    const newSet = new Set(prev)
                    if (newSet.has(sectionId)) {
                      newSet.delete(sectionId)
                    } else {
                      newSet.add(sectionId)
                    }
                    return newSet
                  })
                }}
                onAutoGenerate={() => {
                  router.push(`/ko/admin/tours/${tourInfo.id}#pickup-schedule`)
                }}
                onPreviewEmail={() => {
                  router.push(`/ko/admin/tours/${tourInfo.id}#pickup-schedule`)
                }}
                getPickupHotelNameOnly={(hotelId: string) => {
                  const hotel = pickupHotels.find(h => h.id === hotelId)
                  return hotel?.hotel || '호텔 정보 없음'
                }}
                getCustomerName={(customerId: string) => {
                  const reservation = tourInfo.reservations?.find((r: any) => r.customer?.id === customerId)
                  return reservation?.customer?.name || '고객 정보 없음'
                }}
                getCustomerLanguage={(customerId: string) => {
                  const reservation = tourInfo.reservations?.find((r: any) => r.customer?.id === customerId)
                  return reservation?.customer?.language || ''
                }}
                openGoogleMaps={(link: string) => {
                  window.open(link, '_blank')
                }}
              />
            </div>

            {/* 팀구성 (가이드, 어시스턴트, 차량) */}
            <div className="bg-purple-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">팀구성</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">가이드</span>
                  <span className="text-gray-900">{tourInfo.tour_guide?.name || '미배정'}</span>
                </div>
                {tourInfo.assistant && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">어시스턴트</span>
                    <span className="text-gray-900">{tourInfo.assistant.name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">차량</span>
                  <span className="text-gray-900">
                    {tourInfo.vehicle?.vehicle_category} ({tourInfo.vehicle?.vehicle_number})
                  </span>
                </div>
              </div>
            </div>

            {/* 비용 요약 */}
            <div className="bg-yellow-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">비용 요약</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">예약 건수</span>
                  <span className="text-gray-900 font-medium">
                    {tourInfo.reservations?.length || 0}건
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">총 인원</span>
                  <span className="text-gray-900 font-medium">
                    {tourInfo.total_people || tourInfo.reservations?.reduce((sum, r) => sum + (r.total_people || 0), 0) || 0}명
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="text-center text-gray-500">
              <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-sm">채팅방을 선택하면 투어 정보가 표시됩니다</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
