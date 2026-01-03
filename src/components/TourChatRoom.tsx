'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Image as ImageIcon, Copy, Share2, Calendar, Megaphone, Trash2, ChevronDown, ChevronUp, MapPin, Camera, ExternalLink, Users, Play, Phone, User, X, Menu } from 'lucide-react'
import { useVoiceCall } from '@/hooks/useVoiceCall'
import VoiceCallModal from './VoiceCallModal'
import PickupHotelPhotoGallery from './PickupHotelPhotoGallery'
import ReactCountryFlag from 'react-country-flag'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ChatRoomShareModal from './ChatRoomShareModal'
import PickupScheduleModal from './PickupScheduleModal'
import TourPhotoGallery from './TourPhotoGallery'
import { translateText, detectLanguage, SupportedLanguage, SUPPORTED_LANGUAGES } from '@/lib/translation'
import { formatTimeWithAMPM } from '@/lib/utils'

interface ChatMessage {
  id: string
  room_id: string
  sender_type: 'guide' | 'customer' | 'system'
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

interface ChatRoom {
  id: string
  tour_id: string
  room_name: string
  room_code: string
  description?: string
  is_active: boolean
  created_by: string
  created_at: string
}

interface ChatAnnouncement {
  id: string
  title: string
  content: string
  language: string
  is_active: boolean
  created_at: string
}

interface ChatBan {
  id: string
  room_id: string
  client_id?: string
  customer_name?: string
  banned_until?: string
}

interface Tour {
  id: string
  product_id: string
  tour_date: string
  reservation_ids: string[]
}

interface Reservation {
  id: string
  pickup_hotel: string
  pickup_time: string
  total_people: number
  customer_id: string
  status: string
}

interface Customer {
  id: string
  name: string
}

interface PickupHotel {
  id: string
  hotel: string
  pick_up_location: string
  media?: string[]
  link?: string
  youtube_link?: string
}

interface SupabaseInsertBuilder {
  insert: (values: {
    room_id: string;
    sender_type: 'guide' | 'customer';
    sender_name: string;
    sender_email?: string;
    message: string;
    message_type: 'text';
  }) => {
    select: () => {
      single: () => Promise<{ data: ChatMessage | null; error: Error | null }>;
    };
  };
}

interface SupabaseUpdateBuilder {
  update: (values: { is_active: boolean }) => {
    eq: (column: string, value: string) => Promise<{ error: Error | null }>;
  };
}

interface TourChatRoomProps {
  tourId: string
  guideEmail: string
  isPublicView?: boolean
  roomCode?: string
  tourDate?: string
  customerName?: string
  customerLanguage?: SupportedLanguage
  externalMobileMenuOpen?: boolean
  onExternalMobileMenuToggle?: () => void
  // isModalView?: boolean // 사용되지 않음
}

export default function TourChatRoom({ 
  tourId, 
  guideEmail, 
  isPublicView = false, 
  roomCode,
  tourDate,
  customerName,
  customerLanguage = 'en',
  externalMobileMenuOpen,
  onExternalMobileMenuToggle
  // isModalView = false // 사용되지 않음
}: TourChatRoomProps) {
  const router = useRouter()
  
  // customerLanguage prop을 사용하여 locale 결정 (next-intl 컨텍스트가 없을 수 있으므로)
  const locale: 'ko' | 'en' = customerLanguage === 'ko' ? 'ko' : 'en'
  
  // 고객용 채팅에서 초기 props 디버깅
  if (isPublicView) {
    console.log('=== TourChatRoom 초기 props 디버깅 ===')
    console.log('tourId:', tourId)
    console.log('guideEmail:', guideEmail)
    console.log('isPublicView:', isPublicView)
    console.log('customerLanguage:', customerLanguage)
    console.log('=====================================')
  }
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(customerLanguage)
  
  // customerLanguage prop이 변경되면 selectedLanguage도 업데이트
  useEffect(() => {
    setSelectedLanguage(customerLanguage)
  }, [customerLanguage])
  
  // const [participantCount, setParticipantCount] = useState(0) // 사용되지 않음
  const [showShareModal, setShowShareModal] = useState(false)
  const [showPickupScheduleModal, setShowPickupScheduleModal] = useState(false)
  const [showPickupScheduleInline, setShowPickupScheduleInline] = useState(false)
  const [showPhotoGallery, setShowPhotoGallery] = useState(false)
  const [showPickupHotelPhotoGallery, setShowPickupHotelPhotoGallery] = useState(false)
  const [selectedPickupHotel, setSelectedPickupHotel] = useState<{name: string, mediaUrls: string[]} | null>(null)
  const [pickupSchedule, setPickupSchedule] = useState<Array<{
    time: string
    date: string
    hotel: string
    location: string
    people: number
  }>>([])
  const [showTeamInfo, setShowTeamInfo] = useState(false)
  const [teamInfo, setTeamInfo] = useState<{
    guide?: { name_ko?: string; name_en?: string; phone?: string }
    assistant?: { name_ko?: string; name_en?: string; phone?: string }
    driver?: { name?: string; phone?: string }
  }>({})
  const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(true)
  // 외부에서 제어하는 경우 externalMobileMenuOpen 사용, 아니면 내부 상태 사용
  const isMobileMenuOpen = externalMobileMenuOpen !== undefined ? externalMobileMenuOpen : internalMobileMenuOpen
  const handleMobileMenuToggle = () => {
    if (onExternalMobileMenuToggle) {
      onExternalMobileMenuToggle()
    } else {
      setInternalMobileMenuOpen(!internalMobileMenuOpen)
    }
  }
  
  // Generate or read client_id for soft-ban
  const getClientId = () => {
    if (typeof window === 'undefined') return 'unknown'
    const key = 'tour_chat_client_id'
    let id = localStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(key, id)
    }
    return id
  }

  const clientId = getClientId()

  // 언어 타입 변환 함수
  const convertToSupportedLanguage = (lang: string): 'ko' | 'en' => {
    return lang === 'ko' ? 'ko' : 'en'
  }

  const checkBanned = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_bans')
        .select('id, banned_until')
        .eq('room_id', roomId)
        .or(`client_id.eq.${clientId},customer_name.eq.${customerName || ''}`)
        .limit(1)
      
      // 테이블이 존재하지 않거나 오류가 발생하면 차단하지 않음
      if (error) {
        console.warn('Chat bans table not available or error occurred:', error)
        return false
      }
      
      if (!data || data.length === 0) return false
      const banData = data[0] as ChatBan
      const bannedUntil = banData.banned_until ? new Date(banData.banned_until) : null
      if (!bannedUntil) return true
      return bannedUntil.getTime() > Date.now()
    } catch (error) {
      console.warn('Error checking ban status:', error)
      return false
    }
  }
  
  const [translatedMessages, setTranslatedMessages] = useState<{ [key: string]: string }>({})
  const [translating, setTranslating] = useState<{ [key: string]: boolean }>({})
  
  // 공지사항 (모달용)
  const [announcements, setAnnouncements] = useState<ChatAnnouncement[]>([])
  const [isAnnouncementsOpen, setIsAnnouncementsOpen] = useState(false)
  const [togglingActive, setTogglingActive] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // 음성 통화
  const userId = isPublicView ? (customerName || 'customer') : (guideEmail || 'guide')
  const userName = isPublicView ? (customerName || '고객') : '가이드'
  
  const {
    callStatus,
    isMuted,
    callDuration,
    incomingOffer,
    callerName,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute
  } = useVoiceCall({
    roomId: room?.id || '',
    userId: userId,
    userName: userName,
    isPublicView: isPublicView
  })
  
  // 들어오는 통화 처리
  useEffect(() => {
    if (callStatus === 'ringing' && incomingOffer) {
      // 통화 수락 대기 상태
    }
  }, [callStatus, incomingOffer])
  // const fileInputRef = useRef<HTMLInputElement>(null) // 사용되지 않음

  // 사용자별 채팅 색상 팔레트 (현재 사용되지 않음)
  // const chatColors = [
  //   'bg-blue-100 text-blue-900 border-blue-200',
  //   'bg-green-100 text-green-900 border-green-200',
  //   'bg-purple-100 text-purple-900 border-purple-200',
  //   'bg-pink-100 text-pink-900 border-pink-200',
  //   'bg-yellow-100 text-yellow-900 border-yellow-200',
  //   'bg-indigo-100 text-indigo-900 border-indigo-200',
  //   'bg-red-100 text-red-900 border-red-200',
  //   'bg-teal-100 text-teal-900 border-teal-200',
  //   'bg-orange-100 text-orange-900 border-orange-200',
  //   'bg-cyan-100 text-cyan-900 border-cyan-200'
  // ]

  // 사용자별 색상 할당 함수 (현재 사용되지 않음)
  // const getUserColor = (senderName: string) => {
  //   if (senderName === '가이드' || senderName === 'Guide') {
  //     return 'bg-blue-600 text-white border-blue-700'
  //   }
  //   
  //   // 고객 이름을 기반으로 일관된 색상 할당
  //   let hash = 0
  //   for (let i = 0; i < senderName.length; i++) {
  //     hash = senderName.charCodeAt(i) + ((hash << 5) - hash)
  //   }
  //   const colorIndex = Math.abs(hash) % chatColors.length
  //   return chatColors[colorIndex]
  // }

  // 픽업 스케줄 로드
  const loadPickupSchedule = async () => {
    try {
      if (!tourId) {
        console.log('No tourId provided for pickup schedule')
        return
      }

      console.log('Loading pickup schedule for tourId:', tourId)

      // 투어 정보 가져오기 (배정된 예약 포함)
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .select('product_id, tour_date, reservation_ids')
        .eq('id', tourId)
        .single()

      if (tourError || !tour) {
        console.error('Error loading tour for pickup schedule:', tourError)
        return
      }

      const tourData = tour as Tour
      console.log('Tour data for pickup schedule:', tourData)

      // 투어에 배정된 예약이 있는지 확인
      if (!tourData.reservation_ids || tourData.reservation_ids.length === 0) {
        console.log('No reservations assigned to this tour')
        setPickupSchedule([])
        return
      }

      // 투어에 배정된 예약 정보만 조회
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select(`
          id,
          pickup_hotel,
          pickup_time,
          total_people,
          customer_id,
          status
        `)
        .in('id', tourData.reservation_ids)
        .not('pickup_hotel', 'is', null)
        .not('pickup_time', 'is', null)

      if (reservationsError) {
        console.error('Error loading reservations for pickup schedule:', reservationsError)
        return
      }

      const reservationsData = reservations as Reservation[]
      console.log('Found reservations assigned to tour:', reservationsData?.length || 0, 'out of', tourData.reservation_ids?.length || 0, 'assigned reservation IDs')
      console.log('Assigned reservation IDs:', tourData.reservation_ids)
      console.log('Found reservation data:', reservationsData)
      
      // 고객용 채팅에서 디버깅 정보 추가
      if (isPublicView) {
        console.log('=== 고객용 채팅 픽업 스케줄 디버깅 ===')
        console.log('투어 ID:', tourId)
        console.log('투어 데이터:', tourData)
        console.log('예약 데이터:', reservationsData)
        console.log('예약 개수:', reservationsData?.length || 0)
        console.log('배정된 예약 ID들:', tourData.reservation_ids)
        console.log('=====================================')
      }

      // 고객 정보 별도로 가져오기
      let customersData: Customer[] = []
      if (reservationsData && reservationsData.length > 0) {
        const customerIds = reservationsData.map((r: Reservation) => r.customer_id).filter(Boolean)
        if (customerIds.length > 0) {
          const { data: customers, error: customersError } = await supabase
            .from('customers')
            .select('id, name')
            .in('id', customerIds)
          
          if (customersError) {
            console.error('Error loading customers:', customersError)
          } else {
            customersData = customers as Customer[] || []
          }
        }
      }

      // 예약 데이터에 고객 정보 병합
      const reservationsWithCustomers = reservationsData?.map((reservation: Reservation) => ({
        ...reservation,
        customers: customersData.find((customer: Customer) => customer.id === reservation.customer_id)
      })) || []

      console.log('Reservations for pickup schedule:', reservationsWithCustomers)

      // 픽업 호텔 정보 별도로 가져오기
      const pickupHotelIds = [...new Set(reservationsWithCustomers.map((r: Reservation & { customers?: Customer }) => r.pickup_hotel).filter(Boolean))]
      console.log('Pickup hotel IDs:', pickupHotelIds)
      
      let pickupHotels: PickupHotel[] = []
      
      if (pickupHotelIds.length > 0) {
        const { data: hotelsData, error: hotelsError } = await supabase
          .from('pickup_hotels')
          .select('id, hotel, pick_up_location')
          .in('id', pickupHotelIds)
          .eq('is_active', true)
        
        if (hotelsError) {
          console.error('Error loading pickup hotels:', hotelsError)
        } else {
          pickupHotels = hotelsData as PickupHotel[] || []
          console.log('Pickup hotels data:', pickupHotels)
        }
      }

      // 픽업 스케줄 데이터 생성 (호텔별로 그룹화)
      const groupedByHotel = reservationsWithCustomers.reduce((acc: Record<string, {
        time: string;
        date: string;
        hotel: string;
        location: string;
        people: number;
        customers: Array<{ name: string; people: number }>;
      }>, reservation: Reservation & { customers?: Customer }) => {
        const hotel = pickupHotels.find(h => h.id === reservation.pickup_hotel)
        if (!hotel) {
          // 호텔 정보가 없으면 기본값 사용
          console.log('No hotel found for reservation:', reservation.id, 'hotel ID:', reservation.pickup_hotel)
          const hotelKey = `unknown-${reservation.pickup_hotel}`
          if (!acc[hotelKey]) {
            const pickupTime = reservation.pickup_time ? reservation.pickup_time.substring(0, 5) : ''
            const timeHour = pickupTime ? parseInt(pickupTime.split(':')[0]) : 0
            
            // 오후 9시(21:00) 이후면 날짜를 하루 빼기
            let displayDate = tourDate || ''
            if (timeHour >= 21 && tourDate) {
              const date = new Date(tourDate)
              date.setDate(date.getDate() - 1)
              displayDate = date.toISOString().split('T')[0]
            }
            
            acc[hotelKey] = {
              time: formatTimeWithAMPM(pickupTime),
              date: displayDate,
              hotel: `호텔 ID: ${reservation.pickup_hotel}`,
              location: '위치 미상',
              people: 0,
              customers: []
            }
          }
          acc[hotelKey].people += reservation.total_people || 0
          acc[hotelKey].customers.push({
            name: reservation.customers?.name || 'Unknown Customer',
            people: reservation.total_people || 0
          })
          return acc
        }
        
        const hotelKey = `${hotel.hotel}-${hotel.pick_up_location}`
        if (!acc[hotelKey]) {
          const pickupTime = reservation.pickup_time ? reservation.pickup_time.substring(0, 5) : ''
          const timeHour = pickupTime ? parseInt(pickupTime.split(':')[0]) : 0
          
          // 오후 9시(21:00) 이후면 날짜를 하루 빼기
          let displayDate = tourDate || ''
          if (timeHour >= 21 && tourDate) {
            const date = new Date(tourDate)
            date.setDate(date.getDate() - 1)
            displayDate = date.toISOString().split('T')[0]
          }
          
          acc[hotelKey] = {
            time: formatTimeWithAMPM(pickupTime),
            date: displayDate,
            hotel: hotel.hotel || '',
            location: hotel.pick_up_location || '',
            people: 0,
            customers: []
          }
        }
        acc[hotelKey].people += reservation.total_people || 0
        acc[hotelKey].customers.push({
          name: reservation.customers?.name || 'Unknown Customer',
          people: reservation.total_people || 0
        })
        return acc
      }, {} as Record<string, {
        time: string;
        date: string;
        hotel: string;
        location: string;
        people: number;
        customers: Array<{ name: string; people: number }>;
      }>)

      const schedule = Object.values(groupedByHotel)
        .sort((a, b) => a.time.localeCompare(b.time)) as Array<{
          time: string;
          date: string;
          hotel: string;
          location: string;
          people: number;
        }>

      console.log('Generated pickup schedule:', schedule)
      console.log('Final pickup schedule array length:', schedule.length)
      
      // 고객용 채팅에서 최종 픽업 스케줄 디버깅
      if (isPublicView) {
        console.log('=== 고객용 채팅 최종 픽업 스케줄 ===')
        console.log('생성된 스케줄:', schedule)
        console.log('스케줄 개수:', schedule.length)
        console.log('호텔별 그룹화 데이터:', groupedByHotel)
        console.log('=====================================')
      }
      
      setPickupSchedule(schedule)
      
      // 디버깅을 위한 추가 정보
      if (schedule.length === 0) {
        console.log('No pickup schedule generated. Debug info:')
        console.log('- Reservations:', reservationsWithCustomers.length)
        console.log('- Pickup hotels:', pickupHotels.length)
        console.log('- Customers:', customersData.length)
        console.log('- Grouped by hotel:', Object.keys(groupedByHotel))
      }
    } catch (error) {
      console.error('Error loading pickup schedule:', error)
      
      // 고객용 채팅에서 오류 디버깅
      if (isPublicView) {
        console.log('=== 고객용 채팅 픽업 스케줄 오류 ===')
        console.log('오류 내용:', error)
        console.log('투어 ID:', tourId)
        console.log('=====================================')
      }
      
      // 오류가 발생해도 빈 배열로 설정하여 무한 로딩 방지
      setPickupSchedule([])
    }
  }

  // 팀 정보 로드 (가이드, 어시스턴트, 드라이버)
  const loadTeamInfo = useCallback(async () => {
    try {
      if (!tourId) return

      // 투어 정보 가져오기
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .select('tour_guide_id, assistant_id, tour_car_id')
        .eq('id', tourId)
        .single()

      if (tourError || !tour) {
        console.error('Error loading tour for team info:', tourError)
        return
      }

      const teamData: {
        guide?: { name_ko?: string; name_en?: string; phone?: string }
        assistant?: { name_ko?: string; name_en?: string; phone?: string }
        driver?: { name?: string; phone?: string }
      } = {}

      // 가이드 정보 가져오기
      if (tour.tour_guide_id) {
        const { data: guideData } = await supabase
          .from('team')
          .select('name_ko, name_en, phone')
          .eq('email', tour.tour_guide_id)
          .maybeSingle()

        if (guideData) {
          teamData.guide = {
            name_ko: guideData.name_ko || undefined,
            name_en: guideData.name_en || undefined,
            phone: guideData.phone || undefined
          }
        }
      }

      // 어시스턴트 정보 가져오기
      if (tour.assistant_id) {
        const { data: assistantData } = await supabase
          .from('team')
          .select('name_ko, name_en, phone')
          .eq('email', tour.assistant_id)
          .maybeSingle()

        if (assistantData) {
          teamData.assistant = {
            name_ko: assistantData.name_ko || undefined,
            name_en: assistantData.name_en || undefined,
            phone: assistantData.phone || undefined
          }
        }
      }

      // 드라이버 정보 가져오기 (차량 정보에서)
      if (tour.tour_car_id) {
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('driver_name, driver_phone')
          .eq('id', tour.tour_car_id)
          .maybeSingle()

        if (vehicleData) {
          teamData.driver = {
            name: vehicleData.driver_name || undefined,
            phone: vehicleData.driver_phone || undefined
          }
        }
      }

      setTeamInfo(teamData)
    } catch (error) {
      console.error('Error loading team info:', error)
    }
  }, [tourId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const getLanguageDisplayName = (langCode: SupportedLanguage) => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === langCode)
    return lang ? lang.name : langCode.toUpperCase()
  }

  // 언어 전환 함수 (AdminSidebarAndHeader와 동일한 방식)
  const handleLanguageToggle = () => {
    const newLanguage = selectedLanguage === 'ko' ? 'en' : 'ko'
    setSelectedLanguage(newLanguage)
    setTranslatedMessages({}) // 기존 번역 초기화
  }

  // 언어 플래그 함수
  const getLanguageFlag = () => {
    return selectedLanguage === 'ko' ? 'KR' : 'US'
  }

  // 투어 상세 페이지로 이동
  const goToTourDetail = () => {
    if (tourId) {
      router.push(`/${locale}/admin/tours/${tourId}`)
    }
  }

  const loadMessages = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
      scrollToBottom()
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const loadRoomByCode = async (code: string) => {
    console.log('loadRoomByCode called with code:', code)
    if (!code) {
      console.log('No room code provided, setting loading to false')
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      const { data: rooms, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('room_code', code)
        .eq('is_active', true)
        .limit(1)

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      console.log('Found rooms:', rooms)
      const room = rooms?.[0] as ChatRoom | undefined
      setRoom(room || null)
      if (room) {
        console.log('Room found, loading messages...')
        // soft-ban check on mount (오류가 발생해도 계속 진행)
        try {
          const banned = await checkBanned(room.id)
          if (banned) {
            console.log('User is banned')
            setRoom({ ...room, is_active: false })
          }
        } catch (banError) {
          console.warn('Ban check failed, continuing:', banError)
        }
        await loadMessages(room.id)
        console.log('Messages loaded successfully')
        
        // 고객용 채팅에서 픽업 스케줄 및 팀 정보 로드
        if (isPublicView && room.tour_id) {
          console.log('Loading pickup schedule for public view, tourId:', room.tour_id)
          loadPickupSchedule()
          loadTeamInfo()
        }
      } else {
        console.log('No room found for code:', code)
      }
    } catch (error) {
      console.error('Error loading room by code:', error)
    } finally {
      console.log('Setting loading to false')
      setLoading(false)
    }
  }

  const loadRoom = async () => {
    try {
      // 기존 채팅방 찾기 (데이터베이스 트리거에 의해 자동 생성됨)
      const { data: existingRooms, error: findError } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('tour_id', tourId)
        .eq('is_active', true)
        .limit(1)

      if (findError) throw findError

      const existingRoom = existingRooms?.[0] as ChatRoom | undefined

      if (existingRoom) {
        setRoom(existingRoom)
        await loadMessages(existingRoom.id)
        await loadAnnouncements(existingRoom.id)
        // 픽업 스케줄은 별도로 로드 (await 제거)
        loadPickupSchedule()
      } else {
        console.warn('Chat room not found. Please wait a moment after the tour is created.')
        setRoom(null)
        // room이 없어도 픽업 스케줄은 로드할 수 있음
        loadPickupSchedule()
      }
    } catch (error) {
      console.error('Error loading room:', error)
    } finally {
      setLoading(false)
    }
  }

  // 채팅방 로드 또는 생성 - 한 번만 실행
  useEffect(() => {
    console.log('useEffect triggered - isPublicView:', isPublicView, 'roomCode:', roomCode)
    
    const initializeChat = async () => {
      if (isPublicView && roomCode) {
        console.log('Loading room by code for public view')
        await loadRoomByCode(roomCode)
      } else if (!isPublicView) {
        console.log('Loading room for admin view')
        await loadRoom()
      } else if (isPublicView && !roomCode) {
        console.log('Public view without room code, setting loading to false')
        setLoading(false)
      }
    }

    initializeChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 의존성 배열을 비워서 한 번만 실행

  // 실시간 메시지 구독
  useEffect(() => {
    if (!room) return

    const channel = supabase
      .channel(`chat_${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${room.id}`
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: { new: any }) => {
          const newMessage = payload.new as ChatMessage
          setMessages(prev => [...prev, newMessage])
      scrollToBottom()
    }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
  }
  }, [room])

  // 공지사항 로드 (모달 전용)
  const loadAnnouncements = async (roomId: string) => {
    try {
      const { data: roomAnnouncements } = await supabase
        .from('chat_room_announcements')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      const { data: tourAnnouncements } = await supabase
        .from('tour_announcements')
        .select('*')
        .eq('tour_id', tourId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      const merged = [
        ...(roomAnnouncements || []),
        ...(tourAnnouncements || [])
      ] as ChatAnnouncement[]

      setAnnouncements(merged)
    } catch (error) {
      console.error('Error loading announcements:', error)
    }
  }

  // 메시지 삭제 함수
  const deleteMessage = async (messageId: string) => {
    if (!room) return

    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId)

      if (error) throw error

      // UI에서 메시지 제거
      setMessages(prev => prev.filter(msg => msg.id !== messageId))
    } catch (error) {
      console.error('Error deleting message:', error)
      alert('메시지 삭제에 실패했습니다.')
    }
  }

  // 메시지 삭제 가능 여부 확인 (1분 이내)
  const canDeleteMessage = (message: ChatMessage) => {
    const messageTime = new Date(message.created_at).getTime()
    const currentTime = Date.now()
    const oneMinute = 60 * 1000 // 1분을 밀리초로
    
    return (currentTime - messageTime) < oneMinute
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !room || sending) return
    // block banned customers
    if (await checkBanned(room.id)) {
      alert('You are blocked from this chat room.')
      return
    }

    const messageText = newMessage.trim()
    setSending(true)
    
    // 즉시 UI에 메시지 표시 (낙관적 업데이트)
    const tempMessage: ChatMessage = {
      id: `temp_${Date.now()}`,
      room_id: room.id,
      sender_type: isPublicView ? 'customer' : 'guide',
      sender_name: isPublicView ? (customerName || '고객') : '가이드',
      sender_email: isPublicView ? undefined : guideEmail,
      message: messageText,
      message_type: 'text',
      is_read: false,
      created_at: new Date().toISOString()
    }
    
    setMessages(prev => [...prev, tempMessage])
    setNewMessage('')
    scrollToBottom()

    try {
      const { data, error } = await (supabase
        .from('chat_messages') as unknown as SupabaseInsertBuilder)
        .insert({
          room_id: room.id,
          sender_type: isPublicView ? 'customer' : 'guide',
          sender_name: isPublicView ? (customerName || '고객') : '가이드',
          sender_email: isPublicView ? undefined : guideEmail,
          message: messageText,
          message_type: 'text'
        })
        .select()
        .single()

      if (error) throw error
      
      // 실제 메시지로 교체
      if (data) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempMessage.id ? data : msg
          )
        )
        
        // 가이드가 메시지를 보낸 경우 푸시 알림 전송
        if (!isPublicView && room.id) {
          try {
            await fetch('/api/push-notification/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                roomId: room.id,
                message: messageText,
                senderName: '가이드'
              })
            })
          } catch (pushError) {
            console.error('Error sending push notification:', pushError)
            // 푸시 알림 실패는 메시지 전송에 영향을 주지 않음
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('An error occurred while sending the message.')
      
      // 실패 시 임시 메시지 제거
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id))
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const copyRoomLink = () => {
    if (!room) return
    const link = `https://www.kovegas.com/chat/${room.room_code}`
    navigator.clipboard.writeText(link)
    alert('Chat room link has been copied to clipboard.')
  }

  const shareRoomLink = () => {
    if (!room) return
    setShowShareModal(true)
  }

  const toggleRoomActive = async () => {
    if (!room || togglingActive) return
    try {
      setTogglingActive(true)
      const next = !room.is_active
      const { error } = await (supabase
        .from('chat_rooms') as unknown as SupabaseUpdateBuilder)
        .update({ is_active: next })
        .eq('id', room.id)
      if (error) {
        console.error('Failed to toggle chat room active:', error)
        alert('채팅방 상태 변경에 실패했습니다.')
        return
      }
      setRoom({ ...room, is_active: next })
    } finally {
      setTogglingActive(false)
    }
  }

  const formatTime = (dateString: string) => {
    const formattedTime = new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    return `${formattedTime} (PST)`
  }

  // 메시지가 번역이 필요한지 확인
  const needsTranslation = useCallback((message: ChatMessage) => {
    if (message.sender_type === 'guide') {
      const messageLanguage = detectLanguage(message.message)
      return messageLanguage !== selectedLanguage
    }
    return false
  }, [selectedLanguage])

  // 언어 설정이 변경될 때 기존 메시지들 다시 번역
  useEffect(() => {
    if (!room) return

    const translateExistingMessages = async () => {
      console.log('Translating existing messages for language:', selectedLanguage)
      const guideMessages = messages.filter(msg => 
        msg.sender_type === 'guide' && 
        !msg.message.startsWith('[EN] ') &&
        needsTranslation(msg)
      )
      
      console.log('Found guide messages to translate:', guideMessages.length)

      for (const message of guideMessages) {
        if (translating[message.id]) continue

        console.log('Translating message:', message.message)
        setTranslating(prev => ({ ...prev, [message.id]: true }))
        try {
          const result = await translateText(message.message, detectLanguage(message.message), selectedLanguage)
          console.log('Translation result:', result)
      setTranslatedMessages(prev => ({
        ...prev,
            [message.id]: result.translatedText
      }))
    } catch (error) {
          console.error('Translation error for existing message:', error)
    } finally {
          setTranslating(prev => ({ ...prev, [message.id]: false }))
        }
      }
    }

    translateExistingMessages()
  }, [selectedLanguage, messages, room, needsTranslation, translating])

  // 가이드 메시지 자동 번역 함수 (현재 사용되지 않음)
  // const translateGuideMessage = async (message: ChatMessage) => {
  //   if (message.sender_type !== 'guide') return null
  //   
  //   try {
  //     const messageLanguage = detectLanguage(message.message)
  //     if (messageLanguage === selectedLanguage) return null
  //     
  //     const result = await translateText(message.message, messageLanguage, selectedLanguage)
  //     return result.translatedText
  //   } catch (error) {
  //     console.error('Auto translation error:', error)
  //     return null
  //   }
  // }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading chat room...</div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chat room not found.</div>
      </div>
    )
  }

  return (
    <div 
      className="flex flex-col h-full overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50"
      style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
    >
      {/* 채팅방 헤더 */}
        <div className="px-2 lg:px-3 border-b bg-white bg-opacity-90 backdrop-blur-sm shadow-sm relative">
          {!isPublicView && (
          <div className="mb-1">
            <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 lg:space-x-3 flex-1 min-w-0">
              </div>
            </div>
          </div>
        )}
        

        {/* 버튼 영역 */}
        <div className="mt-1 flex items-center gap-1 lg:gap-2 justify-between">
          {/* 데스크톱: 왼쪽 버튼 그룹 */}
          <div className="hidden lg:flex items-center gap-1 lg:gap-2 flex-wrap">
            {/* 방 활성/비활성 스위치 - 가장 왼쪽, 관리자 전용 */}
            {!isPublicView && (
              <button
                onClick={toggleRoomActive}
                disabled={togglingActive}
                className="flex items-center focus:outline-none"
                title={room.is_active ? '비활성화' : '활성화'}
                aria-label={room.is_active ? '비활성화' : '활성화'}
              >
                <span
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${room.is_active ? 'bg-green-500' : 'bg-gray-300'} ${togglingActive ? 'opacity-60' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${room.is_active ? 'translate-x-4' : 'translate-x-1'}`}
                  />
                </span>
              </button>
            )}
            <button
              onClick={() => setIsAnnouncementsOpen(true)}
              className="px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs bg-amber-100 text-amber-800 rounded border border-amber-200 hover:bg-amber-200 flex items-center justify-center"
              title={selectedLanguage === 'ko' ? '공지사항' : 'Announcements'}
              aria-label={selectedLanguage === 'ko' ? '공지사항' : 'Announcements'}
            >
              <Megaphone size={12} className="lg:w-3.5 lg:h-3.5" />
            </button>
              <button
                onClick={() => setShowPickupScheduleModal(true)}
                className="px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs bg-blue-100 text-blue-800 rounded border border-blue-200 hover:bg-blue-200 flex items-center justify-center"
                title={selectedLanguage === 'ko' ? '픽업 스케줄' : 'Pickup Schedule'}
                aria-label={selectedLanguage === 'ko' ? '픽업 스케줄' : 'Pickup Schedule'}
              >
                <Calendar size={12} className="lg:w-3.5 lg:h-3.5" />
              </button>
            {/* 투어 상세 페이지 이동 버튼 - 팀원 전용 */}
            {!isPublicView && (
              <button
                onClick={goToTourDetail}
                className="px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs bg-purple-100 text-purple-800 rounded border border-purple-200 hover:bg-purple-200 flex items-center justify-center"
                title={selectedLanguage === 'ko' ? '투어 상세 페이지' : 'Tour Details'}
                aria-label={selectedLanguage === 'ko' ? '투어 상세 페이지' : 'Tour Details'}
              >
                <ExternalLink size={12} className="lg:w-3.5 lg:h-3.5" />
              </button>
            )}
            {isPublicView && (
              <>
                <button
                  onClick={() => setShowPhotoGallery(true)}
                  className="px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs bg-violet-100 text-violet-800 rounded border border-violet-200 hover:bg-violet-200 flex items-center justify-center"
                  title={selectedLanguage === 'ko' ? '투어 사진' : 'Tour Photos'}
                  aria-label={selectedLanguage === 'ko' ? '투어 사진' : 'Tour Photos'}
                >
                  <ImageIcon size={12} className="lg:w-3.5 lg:h-3.5" />
                </button>
                <button
                  onClick={() => setShowTeamInfo(true)}
                  className="px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs bg-indigo-100 text-indigo-800 rounded border border-indigo-200 hover:bg-indigo-200 flex items-center justify-center"
                  title={selectedLanguage === 'ko' ? '가이드 정보' : 'Guide Info'}
                  aria-label={selectedLanguage === 'ko' ? '가이드 정보' : 'Guide Info'}
                >
                  <Users size={12} className="lg:w-3.5 lg:h-3.5" />
                </button>
              </>
            )}
            
            {/* 음성 통화 버튼 */}
            <button
              onClick={startCall}
              disabled={!room || callStatus !== 'idle'}
              className={`px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs rounded border flex items-center justify-center ${
                callStatus === 'connected'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : callStatus !== 'idle'
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
              }`}
              title={selectedLanguage === 'ko' ? '음성 통화' : 'Voice Call'}
              aria-label={selectedLanguage === 'ko' ? '음성 통화' : 'Voice Call'}
            >
              <Phone size={12} className="lg:w-3.5 lg:h-3.5" />
            </button>
          </div>

          {/* 모바일: 접었다 폈다 할 수 있는 메뉴 */}
          <div className={`lg:hidden absolute top-full left-0 right-0 bg-white border-b shadow-md z-10 p-3 space-y-2`}>
            {/* 활성화 버튼, 공지사항, 픽업스케줄 - collapse 시 숨김 */}
            {isMobileMenuOpen && (
              <>
                {/* 활성화 버튼 (관리자용) */}
                {!isPublicView && (
                  <div>
                    <button
                      onClick={toggleRoomActive}
                      disabled={togglingActive}
                      className="flex items-center gap-2 px-3 py-2 focus:outline-none w-full"
                      title={room.is_active ? (selectedLanguage === 'ko' ? '비활성화' : 'Deactivate') : (selectedLanguage === 'ko' ? '활성화' : 'Activate')}
                    >
                      <span
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${room.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${room.is_active ? 'translate-x-4' : 'translate-x-1'}`}
                        />
                      </span>
                      <span className="text-[10px] text-gray-600">{selectedLanguage === 'ko' ? '활성화' : 'Active'}</span>
                    </button>
                  </div>
                )}
                
                {/* 공지사항, 픽업스케줄: 2열 그리드 */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setIsAnnouncementsOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg border border-amber-200 hover:bg-amber-200 transition-colors"
                    title={selectedLanguage === 'ko' ? '공지사항' : 'Announcements'}
                  >
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <Megaphone size={20} />
                    </div>
                    <span className="text-[10px] font-medium">{selectedLanguage === 'ko' ? '공지사항' : 'Announcements'}</span>
                  </button>
                  <button
                    onClick={() => setShowPickupScheduleModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-800 rounded-lg border border-blue-200 hover:bg-blue-200 transition-colors"
                    title={selectedLanguage === 'ko' ? '픽업 스케줄' : 'Pickup Schedule'}
                  >
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <Calendar size={20} />
                    </div>
                    <span className="text-[10px] font-medium">{selectedLanguage === 'ko' ? '픽업 스케줄' : 'Pickup Schedule'}</span>
                  </button>
                </div>
                
                {/* 투어 사진, 가이드 정보: 2열 그리드 (고객용) */}
                {isPublicView && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowPhotoGallery(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-violet-100 text-violet-800 rounded-lg border border-violet-200 hover:bg-violet-200 transition-colors"
                      title={selectedLanguage === 'ko' ? '투어 사진' : 'Tour Photos'}
                    >
                      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                        <ImageIcon size={20} />
                      </div>
                      <span className="text-[10px] font-medium">{selectedLanguage === 'ko' ? '투어 사진' : 'Tour Photos'}</span>
                    </button>
                    <button
                      onClick={() => setShowTeamInfo(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-indigo-100 text-indigo-800 rounded-lg border border-indigo-200 hover:bg-indigo-200 transition-colors"
                      title={selectedLanguage === 'ko' ? '가이드 정보' : 'Guide Info'}
                    >
                      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                        <Users size={20} />
                      </div>
                      <span className="text-[10px] font-medium">{selectedLanguage === 'ko' ? '가이드 정보' : 'Guide Info'}</span>
                    </button>
                  </div>
                )}
              </>
            )}
            
            {/* 복사, 공유, 접기: 3열 그리드 - 항상 표시 */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={copyRoomLink}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                title={selectedLanguage === 'ko' ? '링크 복사' : 'Copy Link'}
              >
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <Copy size={20} />
                </div>
                <span className="text-[10px] font-medium">{selectedLanguage === 'ko' ? '복사' : 'Copy'}</span>
              </button>
              <button
                onClick={shareRoomLink}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                title={selectedLanguage === 'ko' ? '공유' : 'Share'}
              >
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <Share2 size={20} />
                </div>
                <span className="text-[10px] font-medium">{selectedLanguage === 'ko' ? '공유' : 'Share'}</span>
              </button>
              {/* 접기/펼치기 버튼 */}
              <button
                onClick={handleMobileMenuToggle}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                title={isMobileMenuOpen ? (selectedLanguage === 'ko' ? '접기' : 'Collapse') : (selectedLanguage === 'ko' ? '펼치기' : 'Expand')}
              >
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  {isMobileMenuOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                <span className="text-[10px] font-medium">{isMobileMenuOpen ? (selectedLanguage === 'ko' ? '접기' : 'Collapse') : (selectedLanguage === 'ko' ? '펼치기' : 'Expand')}</span>
              </button>
            </div>
          </div>

          {/* 데스크톱: 오른쪽 버튼 그룹 */}
          <div className="hidden lg:flex items-center space-x-1 lg:space-x-2">
            <button
              onClick={copyRoomLink}
              className="p-1.5 lg:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
              title={selectedLanguage === 'ko' ? '링크 복사' : 'Copy Link'}
              aria-label={selectedLanguage === 'ko' ? '링크 복사' : 'Copy Link'}
            >
              <Copy size={14} className="lg:w-4 lg:h-4" />
            </button>
            <button
              onClick={shareRoomLink}
              className="p-1.5 lg:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
              title={selectedLanguage === 'ko' ? '공유' : 'Share'}
              aria-label={selectedLanguage === 'ko' ? '공유' : 'Share'}
            >
              <Share2 size={14} className="lg:w-4 lg:h-4" />
            </button>
            {/* 언어 전환 버튼 */}
            <button
              onClick={handleLanguageToggle}
              className="p-1.5 lg:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
              title={selectedLanguage === 'ko' ? 'Switch to English' : '한국어로 전환'}
            >
              {(() => {
                try {
                  const flagCountry = getLanguageFlag()
                  if (flagCountry) {
                    return (
                      <ReactCountryFlag
                        countryCode={flagCountry}
                        svg
                        style={{
                          width: '16px',
                          height: '12px',
                          borderRadius: '2px'
                        }}
                      />
                    )
                  }
                  return null
                } catch (error) {
                  console.error('Country flag rendering error:', error)
                  return null
                }
              })()}
            </button>
          </div>
        </div>
        </div>


      {/* 메시지 목록 */}
      <div 
        className="flex-1 overflow-y-auto p-2 lg:p-4 space-y-2 lg:space-y-3 min-h-0 bg-gradient-to-b from-transparent to-blue-50 bg-opacity-20"
        style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
      >
        {messages.map((message) => {
          const needsTrans = needsTranslation(message)
          const hasTranslation = translatedMessages[message.id]
          // const isTranslating = translating[message.id] // 사용되지 않음
          
          return (
            <div
              key={message.id}
              className={`flex ${message.sender_type === 'guide' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-3 lg:px-4 py-2 rounded-lg border shadow-sm ${
                  message.sender_type === 'system'
                    ? 'bg-gray-200 bg-opacity-80 backdrop-blur-sm text-gray-700 text-center'
                    : message.sender_type === 'guide'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-600'
                    : 'bg-white bg-opacity-90 backdrop-blur-sm text-gray-900 border-gray-200'
                }`}
              >
                {message.sender_type !== 'system' && (
                  <div className="text-xs font-medium mb-1">
                    {message.sender_name}
                  </div>
                )}
                
                {/* 메시지 내용 */}
                <div className="text-sm" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
                  {message.message.startsWith('[EN] ') ? (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">번역된 메시지:</div>
                      <div>{message.message.replace('[EN] ', '')}</div>
                    </div>
                  ) : (
                    <div>
                {/* 원본 메시지 */}
                      <div>{message.message}</div>
                      
                      {/* 가이드 메시지 자동 번역 (고객용/관리자용) */}
                      {message.sender_type === 'guide' && needsTrans && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          {hasTranslation ? (
                            <div className="text-xs text-white">
                              <span className="font-medium">{getLanguageDisplayName(selectedLanguage)}:</span> {hasTranslation}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">
                              {getLanguageDisplayName(selectedLanguage)}으로 번역 사용 가능
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs opacity-70">
                  {formatTime(message.created_at)}
                  </div>
                  
                  {/* 삭제 버튼 (자신이 보낸 메시지이고 1분 이내) */}
                  {((isPublicView && message.sender_type === 'customer') || 
                    (!isPublicView && message.sender_type === 'guide')) && 
                   canDeleteMessage(message) && (
                    <button
                      onClick={() => {
                        if (confirm('메시지를 삭제하시겠습니까?')) {
                          deleteMessage(message.id)
                        }
                      }}
                      className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="메시지 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 메시지 입력 */}
      {room.is_active && (
        <div className={`${isPublicView ? 'p-2 lg:p-4' : 'p-2 lg:p-4 border-t bg-white bg-opacity-90 backdrop-blur-sm shadow-lg'} flex-shrink-0`}>
          <div className="flex items-center space-x-2 w-full">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base"
              disabled={sending}
            />
            
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="flex-shrink-0 px-3 lg:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 lg:space-x-2 text-sm lg:text-base"
            >
              <Send size={14} className="lg:w-4 lg:h-4" />
              <span className="hidden lg:inline">{sending ? 'Sending...' : 'Send'}</span>
              <span className="lg:hidden">{sending ? '...' : 'Send'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 공유 모달 (관리자/고객 공통) */}
      {room && (
        <ChatRoomShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          roomCode={room.room_code}
          roomName={room.room_name}
          tourDate={tourDate}
          isPublicView={isPublicView}
          language={selectedLanguage as 'en' | 'ko'}
        />
      )}

      {/* 음성 통화 모달 */}
      <VoiceCallModal
        isOpen={callStatus !== 'idle'}
        callStatus={callStatus}
        callerName={callerName}
        callDuration={callDuration}
        isMuted={isMuted}
        onAccept={callStatus === 'ringing' ? acceptCall : undefined}
        onReject={rejectCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
        language={selectedLanguage as 'ko' | 'en'}
      />

      {/* 공지사항 모달 */}
      {!isPublicView && (
        <div className={`${isAnnouncementsOpen ? 'fixed' : 'hidden'} inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4`}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h4 className="text-lg font-semibold text-gray-900">{selectedLanguage === 'ko' ? '공지사항' : 'Announcements'}</h4>
              <button onClick={() => setIsAnnouncementsOpen(false)} className="px-2 py-1 rounded hover:bg-gray-100">{selectedLanguage === 'ko' ? '닫기' : 'Close'}</button>
            </div>
            <div className="p-4 space-y-3">
              {announcements.length === 0 ? (
                <div className="text-sm text-gray-500">{selectedLanguage === 'ko' ? '등록된 공지사항이 없습니다.' : 'No announcements available.'}</div>
              ) : (
                announcements.map((a) => (
                  <div key={a.id} className="border rounded-lg p-3">
                    <div className="text-sm font-medium text-gray-900 mb-1">{a.title}</div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{a.content}</div>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t text-right">
              <button onClick={() => setIsAnnouncementsOpen(false)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{selectedLanguage === 'ko' ? '닫기' : 'Close'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 픽업 스케줄 모달 */}
      <PickupScheduleModal
        isOpen={showPickupScheduleModal}
        onClose={() => setShowPickupScheduleModal(false)}
        pickupSchedule={pickupSchedule}
        language={convertToSupportedLanguage(locale)}
        onPhotoClick={(hotelName, mediaUrls) => {
          setSelectedPickupHotel({name: hotelName, mediaUrls})
          setShowPickupHotelPhotoGallery(true)
        }}
      />

      {/* 투어 사진 갤러리 */}
      <TourPhotoGallery
        isOpen={showPhotoGallery}
        onClose={() => setShowPhotoGallery(false)}
        tourId={tourId || ''}
        language={convertToSupportedLanguage(locale)}
        allowUpload={isPublicView} // 고객용일 때만 업로드 허용
        uploadedBy={isPublicView ? customerName : undefined}
      />

      {/* 팀 정보 모달 (고객용) */}
      {isPublicView && (
        <div className={`${showTeamInfo ? 'fixed' : 'hidden'} inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4`}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h4 className="text-lg font-semibold text-gray-900">
                {selectedLanguage === 'ko' ? '가이드 정보' : 'Guide Information'}
              </h4>
              <button 
                onClick={() => setShowTeamInfo(false)} 
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* 가이드 정보 */}
              {teamInfo.guide && (
                <div className="border rounded-lg p-3 bg-orange-50">
                  <div className="flex items-center mb-2">
                    <User className="w-4 h-4 mr-2 text-orange-600" />
                    <h5 className="font-medium text-gray-900">
                      {selectedLanguage === 'ko' ? '가이드' : 'Guide'}
                    </h5>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {selectedLanguage === 'ko' 
                      ? (teamInfo.guide.name_ko || teamInfo.guide.name_en || 'N/A')
                      : (teamInfo.guide.name_en || teamInfo.guide.name_ko || 'N/A')
                    }
                  </p>
                  {teamInfo.guide.phone && (
                    <a 
                      href={`tel:${teamInfo.guide.phone}`}
                      className="text-sm text-gray-600 flex items-center hover:text-blue-600 transition-colors"
                    >
                      <Phone className="w-3 h-3 mr-1" />
                      {teamInfo.guide.phone}
                    </a>
                  )}
                </div>
              )}

              {/* 어시스턴트 정보 */}
              {teamInfo.assistant && (
                <div className="border rounded-lg p-3 bg-teal-50">
                  <div className="flex items-center mb-2">
                    <User className="w-4 h-4 mr-2 text-teal-600" />
                    <h5 className="font-medium text-gray-900">
                      {selectedLanguage === 'ko' ? '어시스턴트' : 'Assistant'}
                    </h5>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {selectedLanguage === 'ko' 
                      ? (teamInfo.assistant.name_ko || teamInfo.assistant.name_en || 'N/A')
                      : (teamInfo.assistant.name_en || teamInfo.assistant.name_ko || 'N/A')
                    }
                  </p>
                  {teamInfo.assistant.phone && (
                    <a 
                      href={`tel:${teamInfo.assistant.phone}`}
                      className="text-sm text-gray-600 flex items-center hover:text-blue-600 transition-colors"
                    >
                      <Phone className="w-3 h-3 mr-1" />
                      {teamInfo.assistant.phone}
                    </a>
                  )}
                </div>
              )}

              {/* 드라이버 정보 */}
              {teamInfo.driver && (
                <div className="border rounded-lg p-3 bg-green-50">
                  <div className="flex items-center mb-2">
                    <User className="w-4 h-4 mr-2 text-green-600" />
                    <h5 className="font-medium text-gray-900">
                      {selectedLanguage === 'ko' ? '드라이버' : 'Driver'}
                    </h5>
                  </div>
                  {teamInfo.driver.name && (
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      {teamInfo.driver.name}
                    </p>
                  )}
                  {teamInfo.driver.phone && (
                    <a 
                      href={`tel:${teamInfo.driver.phone}`}
                      className="text-sm text-gray-600 flex items-center hover:text-blue-600 transition-colors"
                    >
                      <Phone className="w-3 h-3 mr-1" />
                      {teamInfo.driver.phone}
                    </a>
                  )}
                </div>
              )}

              {/* 정보가 없을 때 */}
              {!teamInfo.guide && !teamInfo.assistant && !teamInfo.driver && (
                <div className="text-center py-8 text-gray-500">
                  {selectedLanguage === 'ko' 
                    ? '팀 정보가 아직 등록되지 않았습니다.' 
                    : 'Team information is not yet available.'
                  }
                </div>
              )}
            </div>
            <div className="p-3 border-t text-right">
              <button 
                onClick={() => setShowTeamInfo(false)} 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {selectedLanguage === 'ko' ? '닫기' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 픽업 호텔 사진 갤러리 */}
      {selectedPickupHotel && (
        <PickupHotelPhotoGallery
          isOpen={showPickupHotelPhotoGallery}
          onClose={() => {
            setShowPickupHotelPhotoGallery(false)
            setSelectedPickupHotel(null)
          }}
          hotelName={selectedPickupHotel.name}
          mediaUrls={selectedPickupHotel.mediaUrls}
          language={convertToSupportedLanguage(locale)}
        />
      )}
    </div>
  )
}

// 픽업 스케줄 아코디언 컴포넌트
function PickupScheduleAccordion({ 
  schedule, 
  onPhotoClick 
}: { 
  schedule: {
    time: string;
    date: string;
    hotel: string;
    location: string;
    people: number;
    customers?: Array<{ name: string; people: number }>;
  }
  onPhotoClick: (hotelName: string, mediaUrls: string[]) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [hotelMediaUrls, setHotelMediaUrls] = useState<string[]>([])
  const [googleMapsLink, setGoogleMapsLink] = useState<string | null>(null)
  const [youtubeLink, setYoutubeLink] = useState<string | null>(null)

  // 픽업 호텔 미디어 데이터, 구글맵 링크, 유튜브 링크 가져오기
  useEffect(() => {
    const fetchHotelData = async () => {
      try {
        const { data: hotelData, error } = await supabase
          .from('pickup_hotels')
          .select('media, link, youtube_link')
          .eq('hotel', schedule.hotel)
          .eq('pick_up_location', schedule.location)
          .single()

        if (error) {
          console.error('Error fetching hotel data:', error)
          return
        }

        const hotel = hotelData as PickupHotel
        if (hotel?.media) {
          setHotelMediaUrls(hotel.media)
        }
        
        if (hotel?.link) {
          setGoogleMapsLink(hotel.link)
        }

        if (hotel?.youtube_link) {
          setYoutubeLink(hotel.youtube_link)
        }
      } catch (error) {
        console.error('Error fetching hotel data:', error)
      }
    }

    fetchHotelData()
  }, [schedule.hotel, schedule.location])

  const handlePhotoClick = () => {
    onPhotoClick(schedule.hotel, hotelMediaUrls)
  }

  const handleMapClick = () => {
    if (googleMapsLink) {
      window.open(googleMapsLink, '_blank')
    } else {
      console.log('No Google Maps link available for:', schedule.hotel, schedule.location)
    }
  }

  const handleYoutubeClick = () => {
    if (youtubeLink) {
      window.open(youtubeLink, '_blank')
    } else {
      console.log('No YouTube link available for:', schedule.hotel, schedule.location)
    }
  }

  return (
    <div className="bg-white border border-blue-200 rounded-lg overflow-hidden">
      {/* 아코디언 헤더 */}
      <div 
        className="p-2 flex items-center justify-between cursor-pointer hover:bg-blue-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
          <div className="flex items-center space-x-2 flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-blue-900 text-xs">{schedule.time} {schedule.date}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-700 text-xs">{schedule.hotel}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <Users className="h-3 w-3 text-blue-600" />
              <span className="text-blue-600 font-medium text-xs">{schedule.people}</span>
            </div>
            {isExpanded ? 
              <ChevronUp className="h-4 w-4 text-gray-500" /> : 
              <ChevronDown className="h-4 w-4 text-gray-500" />
            }
          </div>
      </div>

      {/* 아코디언 컨텐츠 */}
      {isExpanded && (
        <div className="border-t border-blue-100 p-3 bg-blue-25">
          <div className="flex items-center justify-between">
            {/* 위치 정보 */}
            <div className="flex items-center space-x-1">
              <span className="text-gray-500 text-xs">📍</span>
              <span className="text-gray-700 text-xs">{schedule.location}</span>
            </div>

            {/* 액션 버튼들 */}
            <div className="flex items-center space-x-2">
              {/* 사진 버튼 */}
              <button 
                onClick={handlePhotoClick}
                className="flex items-center justify-center p-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                title="Photos"
              >
                <Camera className="h-4 w-4 text-gray-600" />
              </button>

              {/* 맵 버튼 */}
              <button 
                className="flex items-center justify-center p-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  handleMapClick()
                }}
                title="Open in Google Maps"
              >
                <MapPin className="h-4 w-4 text-gray-600" />
              </button>

              {/* 유튜브 버튼 */}
              {youtubeLink && (
                <button 
                  className="flex items-center justify-center p-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleYoutubeClick()
                  }}
                  title="Watch Video"
                >
                  <Play className="h-4 w-4 text-gray-600" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}