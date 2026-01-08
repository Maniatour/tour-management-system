'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Calendar, Search, RefreshCw, Languages, ChevronDown, Cast } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { translateText, detectLanguage, SupportedLanguage, SUPPORTED_LANGUAGES } from '@/lib/translation'
import { useOptimizedData } from '@/hooks/useOptimizedData'
import { useFloatingChat } from '@/contexts/FloatingChatContext'
import { useAuth } from '@/contexts/AuthContext'
import { formatTimeWithAMPM } from '@/lib/utils'

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
    pickup_hotel_info?: {
      hotel: string
      pick_up_location: string
    }
    customer?: {
      name: string
      email: string
      phone?: string
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
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [tourInfo, setTourInfo] = useState<TourInfo | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'past' | 'upcoming'>('upcoming')

  // 최적화된 채팅방 데이터 로딩
  const { data: chatRoomsData, loading, refetch: refetchChatRooms } = useOptimizedData({
    fetchFn: async () => {
      // 먼저 기본 채팅방 정보만 가져오기
      const { data: chatRoomsData, error: chatRoomsError } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (chatRoomsError) throw chatRoomsError

      if (!chatRoomsData || chatRoomsData.length === 0) {
        return []
      }

      // 각 채팅방에 대해 투어 정보를 별도로 가져오기
      const roomsWithTour = await Promise.all(
        chatRoomsData.map(async (room: ChatRoom) => {
          try {
            const { data: tourData, error: tourError } = await supabase
              .from('tours')
              .select(`
                id,
                product_id,
                tour_date,
                tour_guide_id,
                assistant_id,
                tour_car_id,
                tour_status,
                product:products(
                  name_ko,
                  name_en,
                  description
                )
              `)
              .eq('id', room.tour_id)
              .single()

            if (tourError) {
              console.warn(`Error fetching tour for room ${room.id}:`, tourError)
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

            // 예약 정보 가져오기
            const { data: reservationsData, error: reservationsError } = await supabase
              .from('reservations')
              .select('id, adults, child, infant')
              .eq('tour_id', (tourData as { id: string }).id)

            if (reservationsError) {
              console.warn(`Error fetching reservations for tour ${(tourData as { id: string }).id}:`, reservationsError)
            }

            return {
              ...room,
              tour: {
                ...(tourData as Record<string, unknown>),
                status: (tourData as { tour_status: string }).tour_status,
                reservations: reservationsData || []
              },
              unread_count: 0
            }
          } catch (error) {
            console.warn(`Error processing room ${room.id}:`, error)
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
        })
      )

      // 이제 읽지 않은 메시지 수 계산
      const roomsWithUnreadCount = await Promise.all(
        roomsWithTour.map(async (room) => {
          try {
            const { count } = await supabase
              .from('chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('room_id', room.id)
              .eq('sender_type', 'customer')
              .eq('is_read', false)
            
            return {
              ...room,
              unread_count: count || 0
            }
          } catch (error) {
            console.error(`Error counting unread messages for room ${room.id}:`, error)
            return {
              ...room,
              unread_count: 0
            }
          }
        })
      )

      return roomsWithUnreadCount
    },
    cacheKey: 'chat-rooms',
    cacheTime: 1 * 60 * 1000 // 1분 캐시 (채팅은 자주 변경되므로 짧은 캐시)
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
    }
  }, [])

  // 투어 정보 가져오기 (투어 상세 페이지와 동일한 구조 사용)
  const fetchTourInfo = useCallback(async (tourId: string) => {
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

      // 3단계: 예약 정보 가져오기 (tour_id로 직접 조회)
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select('*')
        .eq('tour_id', tourId)

      if (reservationsError) {
        console.warn('Error fetching reservations:', reservationsError)
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

      // 5.5단계: 픽업 호텔 정보 가져오기
      let pickupHotelsData: Array<{ id: string; hotel: string; pick_up_location: string }> = []
      if (reservationsData && reservationsData.length > 0) {
        const pickupHotelIds = reservationsData
          .map((r: Record<string, unknown>) => r.pickup_hotel as string)
          .filter(Boolean)
          .filter((value, index, self) => self.indexOf(value) === index) as string[]
        
        if (pickupHotelIds.length > 0) {
          const { data: pickupHotels, error: pickupHotelsError } = await supabase
            .from('pickup_hotels')
            .select('*')
            .in('id', pickupHotelIds)
            .eq('is_active', true)

          if (!pickupHotelsError) {
            pickupHotelsData = pickupHotels || []
          }
        }
      }

      // 6단계: 데이터 결합 (투어 상세 페이지와 동일한 구조)
      const combinedReservations = (reservationsData || []).map((reservation: Record<string, unknown>) => {
        const customer = customersData.find((c) => c.id === reservation.customer_id as string)
        const pickupHotel = pickupHotelsData.find((h) => h.id === reservation.pickup_hotel as string)
        return {
          id: reservation.id as string,
          adults: (reservation.adults as number) || 0,
          child: (reservation.child as number) || 0,
          infant: (reservation.infant as number) || 0,
          total_people: ((reservation.adults as number) || 0) + ((reservation.child as number) || 0) + ((reservation.infant as number) || 0),
          status: (reservation.status as string) || 'pending',
          pickup_hotel: reservation.pickup_hotel as string,
          pickup_time: reservation.pickup_time as string,
          pickup_hotel_info: pickupHotel ? {
            hotel: pickupHotel.hotel,
            pick_up_location: pickupHotel.pick_up_location
          } : undefined,
          customer: customer ? {
            name: customer.name,
            email: customer.email,
            phone: customer.phone
          } : undefined
        }
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
          vehicle_category: (vehicleData as Record<string, unknown>).vehicle_category as string,
          driver_name: undefined, // tours 테이블에 car_driver_name 컬럼이 없음
          driver_phone: undefined // vehicles 테이블에 driver_phone 컬럼이 없음
        } : undefined,
        reservations: combinedReservations
      } as TourInfo

      setTourInfo(combinedData)
    } catch (error) {
      console.error('Error fetching tour info:', error)
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

  // 채팅방 선택
  const selectRoom = async (room: ChatRoom) => {
    setSelectedRoom(room)
    await fetchMessages(room.id)
    if (room.tour) {
      await fetchTourInfo(room.tour.id)
    }
    
    // 읽지 않은 메시지를 읽음 처리
    try {
      await (supabase as unknown as { from: (table: string) => { update: (data: unknown) => { eq: (column: string, value: unknown) => { eq: (column: string, value: unknown) => { eq: (column: string, value: unknown) => Promise<unknown> } } } } })
        .from('chat_messages')
        .update({ is_read: true })
        .eq('room_id', room.id)
        .eq('sender_type', 'customer')
        .eq('is_read', false)
      
      // 채팅방 목록 새로고침 (캐시된 데이터 업데이트)
      await refetchChatRooms()
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }

  // 안전한 채팅방 데이터
  const chatRooms = chatRoomsData || []

  // 탭별 필터링된 채팅방 목록
  const filteredRooms = chatRooms
    .filter(room => {
      const matchesSearch = room.room_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (((room.tour as Record<string, unknown>)?.product as Record<string, unknown>)?.name_ko as string)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (((room.tour as Record<string, unknown>)?.product as Record<string, unknown>)?.name as string)?.toLowerCase().includes(searchTerm.toLowerCase())
      
      if (!matchesSearch) return false
      
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
        } else {
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

  const getTotalParticipants = (reservations: Array<{ adults: number; child: number; infant: number }> = []) => {
    return reservations.reduce((total, res) => total + res.adults + res.child + res.infant, 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">채팅방을 불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 왼쪽: 채팅방 목록 - 모바일에서는 숨김/표시 토글 */}
      <div className={`${selectedRoom ? 'hidden lg:flex' : 'flex'} lg:w-80 w-full bg-white/80 backdrop-blur-sm border-r border-gray-200 flex-col shadow-lg`}>
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">투어 채팅</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                읽지않은 메시지 ({filteredRooms.reduce((sum, room) => sum + room.unread_count, 0)})
              </div>
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
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'upcoming'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              예정 ({chatRooms.filter(room => {
                if (!(room.tour as Record<string, unknown>)?.tour_date) return true
                const tourDate = new Date((room.tour as Record<string, unknown>).tour_date as string)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                tourDate.setHours(0, 0, 0, 0)
                return tourDate >= today
              }).length})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'past'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              지난 ({chatRooms.filter(room => {
                if (!(room.tour as Record<string, unknown>)?.tour_date) return false
                const tourDate = new Date((room.tour as Record<string, unknown>).tour_date as string)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                tourDate.setHours(0, 0, 0, 0)
                return tourDate < today
              }).length})
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
          {filteredRooms.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center text-gray-500">
                <MessageCircle size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-sm">
                  {activeTab === 'past' ? '지난 투어가 없습니다' : '예정 투어가 없습니다'}
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
                      {(room.tour as Record<string, unknown>)?.reservations && Array.isArray((room.tour as Record<string, unknown>).reservations) && ((room.tour as Record<string, unknown>).reservations as unknown[]).length > 0 ? (
                        <span className="ml-2 text-gray-400">
                          {getTotalParticipants(((room.tour as Record<string, unknown>).reservations) as Array<{ adults: number; child: number; infant: number }>)}명
                        </span>
                      ) : null}
                    </div>
                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                      {room.room_code}
                    </span>
                  </div>
                </div>
                
                {/* 플로팅 버튼과 읽지 않은 메시지 수 */}
                <div className="flex items-center gap-1 ml-2">
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
              {messages.map((message) => {
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
        {tourInfo ? (
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
                    {tourInfo.reservations?.reduce((sum, r) => sum + r.adults + r.child + r.infant, 0) || 0}명
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">예약</span>
                  <span className="text-gray-900">{tourInfo.reservations?.length || 0}건</span>
                </div>
              </div>
            </div>

            {/* 픽업스케줄 */}
            <div className="bg-blue-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">픽업스케줄</h4>
              <div className="space-y-1 text-xs">
                {(() => {
                  // 픽업 시간과 호텔의 유니크한 조합을 찾기
                  const pickupSchedules = new Map()
                  tourInfo.reservations?.forEach(reservation => {
                    if (reservation.pickup_time && reservation.pickup_hotel_info) {
                      const key = `${reservation.pickup_time}-${reservation.pickup_hotel}`
                      if (!pickupSchedules.has(key)) {
                        pickupSchedules.set(key, {
                          time: reservation.pickup_time,
                          hotel: reservation.pickup_hotel_info.hotel,
                          location: reservation.pickup_hotel_info.pick_up_location
                        })
                      }
                    }
                  })
                  
                  const schedules = Array.from(pickupSchedules.values())
                    .sort((a, b) => {
                      // 시간을 비교하여 정렬 (HH:MM 형식)
                      const timeA = a.time || '00:00'
                      const timeB = b.time || '00:00'
                      return timeA.localeCompare(timeB)
                    })
                  
                  if (schedules.length === 0) {
                    return <div className="text-gray-500 text-center py-2">픽업 정보 없음</div>
                  }
                  
                  return schedules.map((schedule, scheduleIndex) => (
                    <div key={scheduleIndex} className="border-b border-blue-200 pb-2 last:border-b-0">
                      {/* 첫 번째 줄: 시간 | 호텔 */}
                      <div className="flex items-center mb-1">
                        <div className="text-gray-900 font-medium text-sm mr-2">
                          {(() => {
                            const pickupTime = schedule.time ? schedule.time.split(':').slice(0, 2).join(':') : '미정'
                            if (pickupTime === '미정') return pickupTime
                            
                            const timeHour = parseInt(pickupTime.split(':')[0])
                            
                            // 오후 9시(21:00) 이후면 날짜를 하루 빼기
                            let displayDate = tourInfo.tour_date || ''
                            if (timeHour >= 21 && tourInfo.tour_date) {
                              const date = new Date(tourInfo.tour_date)
                              date.setDate(date.getDate() - 1)
                              displayDate = date.toISOString().split('T')[0]
                            }
                            
                            return `${formatTimeWithAMPM(pickupTime)} ${displayDate}`
                          })()}
                        </div>
                        <div className="text-gray-400">|</div>
                        <div className="text-gray-900 font-medium text-sm ml-2">
                          {schedule.hotel}
                        </div>
                      </div>
                      {/* 두 번째 줄: 픽업장소 */}
                      <div className="text-gray-500 text-xs">
                        {schedule.location}
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </div>

            {/* 배정 (예약 데이터) */}
            <div className="bg-green-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">배정</h4>
              <div className="space-y-1 text-xs">
                {tourInfo.reservations?.map((reservation) => (
                  <div 
                    key={reservation.id} 
                    className="flex justify-between items-center py-1 cursor-pointer hover:bg-green-100 rounded px-2"
                    onClick={() => router.push(`/ko/admin/reservations/${reservation.id}`)}
                  >
                    <div className="flex-1">
                      <div className="text-gray-900 font-medium">{reservation.customer?.name || '고객 정보 없음'}</div>
                      <div className="text-gray-500 text-xs">
                        {reservation.pickup_hotel_info?.hotel || '호텔 정보 없음'}
                      </div>
                    </div>
                    <span className="text-gray-500 font-medium">
                      {reservation.total_people}명
                    </span>
                  </div>
                ))}
                {(!tourInfo.reservations || tourInfo.reservations.length === 0) && (
                  <div className="text-gray-500 text-center py-2">예약 없음</div>
                )}
              </div>
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
                    {tourInfo.reservations?.reduce((sum, r) => sum + r.adults + r.child + r.infant, 0) || 0}명
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="text-center text-gray-500">
              <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
              <p>투어 정보를 불러오는 중...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
