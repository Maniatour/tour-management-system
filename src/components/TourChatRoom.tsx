'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Image as ImageIcon, Copy, Share2, Calendar, Megaphone, Trash2, ChevronDown, ChevronUp, MapPin, Camera, ExternalLink, Users, Play, Phone, User, X, Menu, UserCircle, Smile, Bell, BellOff } from 'lucide-react'
import { useVoiceCall } from '@/hooks/useVoiceCall'
import VoiceCallModal from './VoiceCallModal'
import VoiceCallUserSelector from './VoiceCallUserSelector'
import AvatarSelector from './AvatarSelector'
import PickupHotelPhotoGallery from './PickupHotelPhotoGallery'
import ReactCountryFlag from 'react-country-flag'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ChatRoomShareModal from './ChatRoomShareModal'
import PickupScheduleModal from './PickupScheduleModal'
import TourPhotoGallery from './TourPhotoGallery'
import { translateText, detectLanguage, SupportedLanguage, SUPPORTED_LANGUAGES } from '@/lib/translation'
import { formatTimeWithAMPM } from '@/lib/utils'
import { usePushNotification } from '@/hooks/usePushNotification'

interface ChatMessage {
  id: string
  room_id: string
  sender_type: 'guide' | 'customer' | 'system'
  sender_name: string
  sender_email?: string
  sender_avatar?: string
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
  
  // 채팅방 참여자 목록 (관리자/가이드/드라이버/어시스턴트만 볼 수 있음)
  const [onlineParticipants, setOnlineParticipants] = useState<Map<string, {
    id: string
    name: string
    type: 'guide' | 'customer'
    email?: string
    lastSeen: Date
  }>>(new Map())
  const [showParticipantsList, setShowParticipantsList] = useState(false)
  const presenceChannelRef = useRef<any>(null)
  
  // 고객용 아바타 선택
  const [selectedAvatar, setSelectedAvatar] = useState<string>('')
  const [showAvatarSelector, setShowAvatarSelector] = useState(false)
  const [usedAvatars, setUsedAvatars] = useState<Set<string>>(new Set())
  
  // 푸시 알림 훅 (고객용)
  const {
    isSupported: isPushSupported,
    isSubscribed: isPushSubscribed,
    isLoading: isPushLoading,
    subscribe: subscribeToPush,
    unsubscribe: unsubscribeFromPush
  } = usePushNotification(room?.id, undefined, selectedLanguage)
  
  // 이미지 업로드
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [showLocationShareModal, setShowLocationShareModal] = useState(false)
  const [pendingLocation, setPendingLocation] = useState<{
    latitude: number
    longitude: number
    googleMapsLink: string
    naverMapsLink: string
  } | null>(null)
  
  // localStorage에서 아바타 불러오기
  useEffect(() => {
    if (isPublicView && typeof window !== 'undefined') {
      const savedAvatar = localStorage.getItem(`chat_avatar_${roomCode || 'default'}`)
      if (savedAvatar) {
        setSelectedAvatar(savedAvatar)
      } else {
        // 기본 아바타 설정
        const defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=happy'
        setSelectedAvatar(defaultAvatar)
        localStorage.setItem(`chat_avatar_${roomCode || 'default'}`, defaultAvatar)
      }
    }
  }, [isPublicView, roomCode])
  
  // 다른 고객들이 사용 중인 아바타 추적
  useEffect(() => {
    if (isPublicView && messages.length > 0) {
      const used = new Set<string>()
      messages.forEach(msg => {
        if (msg.sender_type === 'customer' && msg.sender_name !== (customerName || '고객')) {
          const avatar = (msg as any).sender_avatar
          if (avatar) {
            used.add(avatar)
          }
        }
      })
      setUsedAvatars(used)
    }
  }, [messages, isPublicView, customerName])

  // 메시지 로드 후 스크롤을 맨 아래로 이동
  useEffect(() => {
    if (!loading && messages.length > 0) {
      // 초기 로딩 완료 시 즉시 스크롤 (애니메이션 없이)
      setTimeout(() => {
        scrollToBottom(true)
      }, 50)
    }
  }, [loading, messages.length])

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
  const [showCallUserSelector, setShowCallUserSelector] = useState(false)
  const [selectedCallTarget, setSelectedCallTarget] = useState<{id: string, name: string} | null>(null)
  
  // 메시지에서 통화 가능한 사용자 목록 추출
  const availableCallUsers = React.useMemo(() => {
    const userMap = new Map<string, { id: string; name: string; type: 'guide' | 'customer'; email?: string }>()
    
    messages.forEach(message => {
      if (message.sender_type === 'system') return
      
      // 현재 사용자와 다른 타입의 사용자만 추가
      const isCurrentUser = isPublicView 
        ? message.sender_type === 'customer' && message.sender_name === (customerName || '고객')
        : message.sender_type === 'guide' && message.sender_email === guideEmail
      
      if (!isCurrentUser) {
        const userKey = message.sender_email || message.sender_name
        if (!userMap.has(userKey)) {
          userMap.set(userKey, {
            id: userKey,
            name: message.sender_name,
            type: message.sender_type,
            email: message.sender_email
          })
        }
      }
    })
    
    return Array.from(userMap.values())
  }, [messages, isPublicView, customerName, guideEmail])
  
  const {
    callStatus,
    callError,
    isMuted,
    callDuration,
    incomingOffer,
    callerName,
    startCall: startCallInternal,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute
  } = useVoiceCall({
    roomId: room?.id || '',
    userId: userId,
    userName: userName,
    isPublicView: isPublicView,
    targetUserId: selectedCallTarget?.id,
    targetUserName: selectedCallTarget?.name
  })
  
  // 통화 시작 (사용자 선택 후)
  const handleStartCall = async () => {
    if (availableCallUsers.length === 0) {
      alert(selectedLanguage === 'ko' ? '통화할 수 있는 사용자가 없습니다.' : 'No users available to call.')
      return
    }
    
    // 사용자가 1명이면 바로 통화, 여러 명이면 선택 UI 표시
    if (availableCallUsers.length === 1) {
      const user = availableCallUsers[0]
      setSelectedCallTarget({ id: user.id, name: user.name })
      // targetUserId를 직접 파라미터로 전달
      try {
        await startCallInternal(user.id, user.name)
      } catch (error: any) {
        alert(error.message || (selectedLanguage === 'ko' ? '통화를 시작할 수 없습니다.' : 'Failed to start call.'))
      }
    } else {
      setShowCallUserSelector(true)
    }
  }
  
  // 사용자 선택 후 통화 시작
  const handleSelectUserAndCall = async (userId: string, userName: string) => {
    setSelectedCallTarget({ id: userId, name: userName })
    // targetUserId를 직접 파라미터로 전달
    try {
      await startCallInternal(userId, userName)
    } catch (error: any) {
      alert(error.message || (selectedLanguage === 'ko' ? '통화를 시작할 수 없습니다.' : 'Failed to start call.'))
    }
  }
  
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

  // chat_participants 테이블에서 참여자 목록 로드
  const loadChatParticipants = useCallback(async (roomId: string) => {
    try {
      const { data: participants, error } = await supabase
        .from('chat_participants')
        .select('participant_id, participant_name, participant_type, is_active')
        .eq('room_id', roomId)
        .eq('is_active', true)

      if (error) {
        console.error('Error loading chat participants:', error)
        return
      }

      if (!participants || participants.length === 0) {
        return
      }

      // 참여자 목록을 Map에 추가 (Presence와 병합)
      // chat_participants의 모든 참여자를 기본으로 설정하고, Presence 정보로 업데이트
      setOnlineParticipants(prev => {
        const updated = new Map<string, {
          id: string
          name: string
          type: 'guide' | 'customer'
          email?: string
          lastSeen: Date
        }>()
        
        // 먼저 chat_participants의 모든 참여자를 추가
        participants.forEach(participant => {
          const key = participant.participant_id
          updated.set(key, {
            id: key,
            name: participant.participant_name || key,
            type: participant.participant_type === 'customer' ? 'customer' : 'guide',
            email: participant.participant_type === 'guide' ? key : undefined,
            lastSeen: new Date()
          })
        })
        
        // 기존 Presence 정보가 있으면 유지 (온라인 상태 표시를 위해)
        prev.forEach((value, key) => {
          if (updated.has(key)) {
            // chat_participants에 있는 참여자는 Presence 정보로 업데이트
            const existing = updated.get(key)!
            updated.set(key, {
              ...existing,
              lastSeen: value.lastSeen
            })
          } else {
            // chat_participants에 없지만 Presence에 있는 참여자도 추가 (메시지를 보낸 사람일 수 있음)
            updated.set(key, value)
          }
        })
        
        return updated
      })
    } catch (error) {
      console.error('Error in loadChatParticipants:', error)
    }
  }, [])

  // Supabase Realtime Presence를 사용하여 채팅방 참여자 추적
  useEffect(() => {
    if (!room?.id || isPublicView) return // 고객은 참여자 목록을 볼 수 없음

    // chat_participants 테이블에서 참여자 목록 로드
    loadChatParticipants(room.id)

    const channelName = `chat-presence-${room.id}`
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: userId, // 사용자 ID (가이드 이메일 또는 고객 이름)
        }
      }
    })

      // 현재 사용자의 presence 설정
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          
          // 기존 참여자 목록을 유지하면서 Presence에서 온라인 참여자 추가/업데이트
          setOnlineParticipants(prev => {
            const updated = new Map(prev)

            // Presence state에서 참여자 정보 추출
            Object.entries(state).forEach(([key, presences]) => {
              if (Array.isArray(presences) && presences.length > 0) {
                const presence = presences[0] as any
                // 현재 사용자는 제외
                if (presence && presence.userId !== userId) {
                  // 메시지에서 사용자 정보 찾기
                  const userMessage = messages.find(m => 
                    (presence.userId === m.sender_email) || 
                    (presence.userId === m.sender_name)
                  )
                  
                  if (userMessage) {
                    updated.set(presence.userId, {
                      id: presence.userId,
                      name: userMessage.sender_name,
                      type: userMessage.sender_type,
                      email: userMessage.sender_email,
                      lastSeen: new Date()
                    })
                  } else if (presence.userName) {
                    // 메시지에 없는 경우 presence 데이터에서 직접 가져오기
                    updated.set(presence.userId, {
                      id: presence.userId,
                      name: presence.userName || presence.userId,
                      type: presence.userType || 'guide',
                      email: presence.userEmail,
                      lastSeen: new Date()
                    })
                  }
                }
              }
            })

            return updated
          })
        })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences)
        // 새 참여자 추가
        if (Array.isArray(newPresences) && newPresences.length > 0) {
          const presence = newPresences[0] as any
          if (presence && presence.userId !== userId) {
            setOnlineParticipants(prev => {
              const updated = new Map(prev)
              const userMessage = messages.find(m => 
                (presence.userId === m.sender_email) || 
                (presence.userId === m.sender_name)
              )
              
              updated.set(presence.userId, {
                id: presence.userId,
                name: userMessage?.sender_name || presence.userName || presence.userId,
                type: userMessage?.sender_type || presence.userType || 'guide',
                email: userMessage?.sender_email || presence.userEmail,
                lastSeen: new Date()
              })
              return updated
            })
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences)
        // 참여자를 삭제하지 않고 유지 (chat_participants에 등록된 참여자는 계속 표시)
        // 단지 온라인 상태만 업데이트
        setOnlineParticipants(prev => {
          const updated = new Map(prev)
          // Presence에서 나간 참여자는 삭제하지 않고 유지
          // chat_participants에 등록된 참여자는 계속 표시되어야 함
          return updated
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // 현재 사용자의 presence 전송
          await channel.track({
            userId: userId,
            userName: userName,
            userType: isPublicView ? 'customer' : 'guide',
            userEmail: isPublicView ? undefined : guideEmail,
            onlineAt: new Date().toISOString()
          })
        }
      })

    presenceChannelRef.current = channel

    return () => {
      if (presenceChannelRef.current) {
        presenceChannelRef.current.unsubscribe()
        presenceChannelRef.current = null
      }
    }
  }, [room?.id, userId, userName, isPublicView, guideEmail, messages, loadChatParticipants])

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

  const scrollToBottom = (instant = false) => {
    if (instant) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
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
      // 최근 200개 메시지만 로드하여 WebSocket 페이로드 크기 제한
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      // 시간순으로 정렬하여 표시
      const sortedMessages = (data || []).reverse()
      setMessages(sortedMessages)
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const loadRoomByCode = async (code: string) => {
    if (!code) {
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
      
      const room = rooms?.[0] as ChatRoom | undefined
      setRoom(room || null)
      if (room) {
        // soft-ban check on mount (오류가 발생해도 계속 진행)
        try {
          const banned = await checkBanned(room.id)
          if (banned) {
            setRoom({ ...room, is_active: false })
          }
        } catch (banError) {
          console.warn('Ban check failed, continuing:', banError)
        }
        await loadMessages(room.id)
        
        // 고객이 채팅방에 입장할 때 chat_participants에 추가
        if (isPublicView && customerName && room.id) {
          try {
            // 이미 등록되어 있는지 확인
            const { data: existingParticipant } = await supabase
              .from('chat_participants')
              .select('id')
              .eq('room_id', room.id)
              .eq('participant_type', 'customer')
              .eq('participant_id', customerName)
              .eq('is_active', true)
              .maybeSingle()

            // 등록되어 있지 않으면 추가
            if (!existingParticipant) {
              await supabase
                .from('chat_participants')
                .insert({
                  room_id: room.id,
                  participant_type: 'customer',
                  participant_id: customerName,
                  participant_name: customerName,
                  is_active: true
                })
            }
          } catch (error) {
            console.error('Error adding customer to participants:', error)
          }
        }
        
        // 투어에 배정된 팀원들을 자동으로 참여시키기 (고객 뷰가 아니고 tourId가 있는 경우)
        if (room.tour_id && !isPublicView && autoAddTeamMembersFnRef.current) {
          await autoAddTeamMembersFnRef.current(room.id, room.tour_id)
        }
        
        // chat_participants에서 참여자 목록 로드 (관리자/가이드 뷰만)
        if (!isPublicView) {
          loadChatParticipants(room.id)
        }
        
        // 고객용 채팅에서 픽업 스케줄 및 팀 정보 로드
        if (isPublicView && room.tour_id) {
          loadPickupSchedule()
          loadTeamInfo()
        }
      }
    } catch (error) {
      console.error('Error loading room by code:', error)
    } finally {
      setLoading(false)
    }
  }

  // 투어에 배정된 팀원들을 채팅방에 자동 참여시키기 (배정 변경 시 동기화)
  const autoAddTeamMembersRef = useRef<{ [key: string]: boolean }>({})
  const autoAddTeamMembersFnRef = useRef<((roomId: string, tourIdParam?: string) => Promise<void>) | null>(null)
  const autoAddTeamMembers = useCallback(async (roomId: string, tourIdParam?: string) => {
    try {
      const targetTourId = tourIdParam || tourId
      if (!targetTourId || isPublicView) return // 고객 뷰에서는 실행하지 않음
      
      // 중복 실행 방지: 같은 roomId에 대해 이미 실행 중이면 무시
      const key = `${roomId}_${targetTourId}`
      if (autoAddTeamMembersRef.current[key]) {
        return
      }
      autoAddTeamMembersRef.current[key] = true

      // 투어 정보 가져오기
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .select('tour_guide_id, assistant_id, tour_car_id')
        .eq('id', targetTourId)
        .single()

      if (tourError || !tour) {
        console.error('Error loading tour for auto-add team members:', tourError)
        return
      }

      // 현재 배정된 팀원 ID 목록 생성
      const assignedTeamMemberIds = new Set<string>()
      
      // 가이드 ID 추가
      if (tour.tour_guide_id) {
        assignedTeamMemberIds.add(tour.tour_guide_id)
      }
      
      // 어시스턴트 ID 추가
      if (tour.assistant_id) {
        assignedTeamMemberIds.add(tour.assistant_id)
      }
      
      // 드라이버 ID 추가 (차량 정보에서)
      if (tour.tour_car_id) {
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('driver_name, driver_email')
          .eq('id', tour.tour_car_id)
          .maybeSingle()

        if (vehicleData && vehicleData.driver_name) {
          const driverId = vehicleData.driver_email || `driver_${tour.tour_car_id}`
          assignedTeamMemberIds.add(driverId)
        }
      }

      // 현재 참여자 목록 가져오기 (가이드 타입만)
      const { data: existingParticipants, error: participantsError } = await supabase
        .from('chat_participants')
        .select('id, participant_id, participant_type')
        .eq('room_id', roomId)
        .eq('participant_type', 'guide')

      if (participantsError) {
        console.error('Error loading existing participants:', participantsError)
        return
      }

      const existingParticipantsList = existingParticipants || []
      const existingParticipantIds = new Set(
        existingParticipantsList.map(p => p.participant_id)
      )

      // 새로 배정된 사람 추가
      const participantsToAdd: Array<{
        room_id: string
        participant_type: 'guide'
        participant_id: string
        participant_name: string
        is_active: boolean
      }> = []

      // 가이드 추가
      if (tour.tour_guide_id && !existingParticipantIds.has(tour.tour_guide_id)) {
        const { data: guideData } = await supabase
          .from('team')
          .select('email, name_ko, name_en')
          .eq('email', tour.tour_guide_id)
          .maybeSingle()

        if (guideData) {
          participantsToAdd.push({
            room_id: roomId,
            participant_type: 'guide',
            participant_id: tour.tour_guide_id,
            participant_name: guideData.name_ko || guideData.name_en || tour.tour_guide_id,
            is_active: true
          })
        }
      }

      // 어시스턴트 추가
      if (tour.assistant_id && !existingParticipantIds.has(tour.assistant_id)) {
        const { data: assistantData } = await supabase
          .from('team')
          .select('email, name_ko, name_en')
          .eq('email', tour.assistant_id)
          .maybeSingle()

        if (assistantData) {
          participantsToAdd.push({
            room_id: roomId,
            participant_type: 'guide',
            participant_id: tour.assistant_id,
            participant_name: assistantData.name_ko || assistantData.name_en || tour.assistant_id,
            is_active: true
          })
        }
      }

      // 드라이버 추가 (차량 정보에서)
      if (tour.tour_car_id) {
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('driver_name, driver_email')
          .eq('id', tour.tour_car_id)
          .maybeSingle()

        if (vehicleData && vehicleData.driver_name) {
          const driverId = vehicleData.driver_email || `driver_${tour.tour_car_id}`
          
          if (!existingParticipantIds.has(driverId)) {
            participantsToAdd.push({
              room_id: roomId,
              participant_type: 'guide',
              participant_id: driverId,
              participant_name: vehicleData.driver_name,
              is_active: true
            })
          }
        }
      }

      // 더 이상 배정되지 않은 사람 제거 (is_active = false로 설정)
      const participantsToDeactivate: string[] = []
      
      for (const participant of existingParticipantsList) {
        // 고객 타입은 제외하고, 가이드 타입만 처리
        if (participant.participant_type === 'guide' && !assignedTeamMemberIds.has(participant.participant_id)) {
          participantsToDeactivate.push(participant.id)
        }
      }

      // 배정이 변경된 사람들 처리
      if (participantsToDeactivate.length > 0) {
        const { error: deactivateError } = await supabase
          .from('chat_participants')
          .update({ is_active: false })
          .in('id', participantsToDeactivate)

        if (deactivateError) {
          console.error('Error deactivating removed team members:', deactivateError)
        } else {
          console.log(`Deactivated ${participantsToDeactivate.length} removed team member(s) from chat room`)
        }
      }

      // 새로 배정된 사람 추가
      if (participantsToAdd.length > 0) {
        const { error: insertError } = await supabase
          .from('chat_participants')
          .insert(participantsToAdd)

        if (insertError) {
          console.error('Error auto-adding team members:', insertError)
        } else {
          console.log(`Auto-added ${participantsToAdd.length} team member(s) to chat room`)
        }
      }
    } catch (error) {
      console.error('Error in autoAddTeamMembers:', error)
    } finally {
      // 실행 완료 후 플래그 제거
      const key = `${roomId}_${tourIdParam || tourId}`
      delete autoAddTeamMembersRef.current[key]
    }
  }, [tourId, isPublicView])
  
  // autoAddTeamMembers를 ref에 저장하여 loadRoom에서 사용
  useEffect(() => {
    autoAddTeamMembersFnRef.current = autoAddTeamMembers
  }, [autoAddTeamMembers])

  const loadRoom = useCallback(async () => {
    if (!tourId) {
      setLoading(false)
      return
    }
    
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
        // 투어에 배정된 팀원들을 자동으로 참여시키기
        if (autoAddTeamMembersFnRef.current) {
          await autoAddTeamMembersFnRef.current(existingRoom.id, tourId)
        }
        // chat_participants에서 참여자 목록 로드 (관리자/가이드 뷰만)
        if (!isPublicView) {
          loadChatParticipants(existingRoom.id)
        }
        // 픽업 스케줄은 별도로 로드
        loadPickupSchedule()
      } else {
        setRoom(null)
        // room이 없어도 픽업 스케줄은 로드할 수 있음
        loadPickupSchedule()
      }
    } catch (error) {
      console.error('Error loading room:', error)
    } finally {
      setLoading(false)
    }
  }, [tourId])

  // 초기화 플래그를 ref로 관리하여 무한 루핑 방지
  const initializationRef = useRef<{ tourId?: string; isPublicView?: boolean; roomCode?: string }>({})
  
  // 채팅방 로드 또는 생성
  useEffect(() => {
    let isMounted = true
    
    // 이미 같은 파라미터로 초기화되었는지 확인
    const currentKey = `${tourId}_${isPublicView}_${roomCode}`
    const lastKey = `${initializationRef.current.tourId}_${initializationRef.current.isPublicView}_${initializationRef.current.roomCode}`
    
    if (currentKey === lastKey && initializationRef.current.tourId !== undefined) {
      // 이미 초기화되었으므로 스킵
      return
    }
    
    // 초기화 플래그 업데이트
    initializationRef.current = { tourId, isPublicView, roomCode }
    
    const initializeChat = async () => {
      if (!isMounted) return
      
      if (isPublicView && roomCode) {
        await loadRoomByCode(roomCode)
      } else if (!isPublicView && tourId) {
        await loadRoom()
      } else if (isPublicView && !roomCode) {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    initializeChat()
    
    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId, isPublicView, roomCode]) // loadRoom은 useCallback으로 메모이제이션되어 있으므로 의존성에서 제외

  // 실시간 메시지 구독
  useEffect(() => {
    if (!room?.id) return

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
          
          // 자신이 보낸 메시지는 Realtime 구독에서 무시 (낙관적 업데이트로 이미 추가됨)
          if (isPublicView) {
            // 고객용 공개 페이지: sender_name과 sender_type으로 확인
            if (newMessage.sender_type === 'customer' && 
                newMessage.sender_name === (customerName || '고객')) {
              return // 자신이 보낸 메시지는 무시
            }
          } else {
            // 가이드/관리자 페이지: sender_email로 확인
            if (newMessage.sender_type === 'guide' && 
                newMessage.sender_email === guideEmail) {
              return // 자신이 보낸 메시지는 무시
            }
          }
          
          setMessages(prev => {
            // 중복 메시지 방지: 이미 존재하는 메시지 ID는 추가하지 않음
            const exists = prev.some(m => m.id === newMessage.id)
            if (exists) {
              return prev
            }
            // 메시지 배열 크기 제한 (최대 500개) - WebSocket 페이로드 크기 제한
            const updated = [...prev, newMessage]
            if (updated.length > 500) {
              // 오래된 메시지 제거 (시간순으로 정렬 후 오래된 것부터 제거)
              return updated.sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              ).slice(-500)
            }
            return updated
          })
      scrollToBottom()
    }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
  }
  }, [room?.id, isPublicView, customerName, guideEmail])

  // 투어 배정 변경 감지 및 동기화
  useEffect(() => {
    if (!room?.id || !tourId || isPublicView) return

    const channel = supabase
      .channel(`tour_${tourId}_assignments`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tours',
          filter: `id=eq.${tourId}`
        },
        () => {
          // 투어 정보가 업데이트되면 팀원 동기화
          console.log('Tour assignment changed, syncing team members...')
          if (autoAddTeamMembersFnRef.current) {
            autoAddTeamMembersFnRef.current(room.id, tourId)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [room?.id, tourId, isPublicView])

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

  // 이미지 업로드 처리
  const handleImageUpload = async (file: File) => {
    if (!room || uploading) return
    
    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      alert(selectedLanguage === 'ko' ? '지원하지 않는 파일 형식입니다. JPEG, PNG, GIF, WebP 파일만 업로드 가능합니다.' : 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.')
      return
    }
    
    // 파일 크기 검증 (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      alert(selectedLanguage === 'ko' ? '파일 크기가 너무 큽니다. 최대 5MB까지 업로드 가능합니다.' : 'File too large. Maximum size is 5MB.')
      return
    }
    
    setUploading(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'chat-messages')
      
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Upload failed')
      }
      
      // 이미지를 메시지로 전송
      await sendImageMessage(result.imageUrl, file.name, file.size)
    } catch (error) {
      console.error('Image upload error:', error)
      alert(error instanceof Error ? error.message : (selectedLanguage === 'ko' ? '이미지 업로드 중 오류가 발생했습니다.' : 'An error occurred while uploading the image.'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }
  
  // 이미지 메시지 전송
  const sendImageMessage = async (imageUrl: string, fileName: string, fileSize: number) => {
    if (!room || sending) return
    
    setSending(true)
    
    // 즉시 UI에 메시지 표시 (낙관적 업데이트)
    const tempMessage: ChatMessage = {
      id: `temp_${Date.now()}`,
      room_id: room.id,
      sender_type: isPublicView ? 'customer' : 'guide',
      sender_name: isPublicView ? (customerName || '고객') : '가이드',
      sender_email: isPublicView ? undefined : guideEmail,
      sender_avatar: isPublicView ? selectedAvatar : undefined,
      message: '',
      message_type: 'image',
      file_url: imageUrl,
      file_name: fileName,
      file_size: fileSize,
      is_read: false,
      created_at: new Date().toISOString()
    }
    
    setMessages(prev => [...prev, tempMessage])
    scrollToBottom()
    
    try {
      let data: ChatMessage | null = null
      
      if (isPublicView) {
        const response = await fetch('/api/chat-messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            room_id: room.id,
            sender_name: customerName || '고객',
            sender_type: 'customer',
            sender_avatar: selectedAvatar,
            message: '',
            message_type: 'image',
            file_url: imageUrl,
            file_name: fileName,
            file_size: fileSize
          })
        })
        
        if (!response.ok) {
          let errorData
          try {
            errorData = await response.json()
          } catch (e) {
            const text = await response.text()
            errorData = { error: `HTTP ${response.status}: ${response.statusText}`, raw: text }
          }
          console.error('API Error:', {
            status: response.status,
            statusText: response.statusText,
            errorData,
            fullError: JSON.stringify(errorData, null, 2)
          })
          const errorMessage = errorData.error || errorData.details || errorData.message || '메시지 전송에 실패했습니다'
          const errorDetails = errorData.code || errorData.hint ? ` (${errorData.code || ''} ${errorData.hint || ''})` : ''
          throw new Error(`${errorMessage}${errorDetails}`)
        }
        
        const result = await response.json()
        data = result.message
      } else {
        const result = await (supabase
          .from('chat_messages') as unknown as SupabaseInsertBuilder)
          .insert({
            room_id: room.id,
            sender_type: 'guide',
            sender_name: '가이드',
            sender_email: guideEmail,
            message: '',
            message_type: 'image',
            file_url: imageUrl,
            file_name: fileName,
            file_size: fileSize
          })
          .select()
          .single()
        
        if (result.error) throw result.error
        data = result.data
      }
      
      // 실제 메시지로 교체
      if (data) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempMessage.id ? data : msg
          )
        )
      }
    } catch (error) {
      console.error('Error sending image message:', error)
      alert(error instanceof Error ? error.message : 'An error occurred while sending the image.')
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id))
    } finally {
      setSending(false)
    }
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
      sender_avatar: isPublicView ? selectedAvatar : undefined,
      message: messageText,
      message_type: 'text',
      is_read: false,
      created_at: new Date().toISOString()
    }
    
    setMessages(prev => [...prev, tempMessage])
    setNewMessage('')
    scrollToBottom()

    try {
      let data: ChatMessage | null = null

      // 고객용 공유 페이지는 API 엔드포인트 사용 (RLS 우회)
      if (isPublicView) {
        const response = await fetch('/api/chat-messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            room_id: room.id,
            sender_name: customerName || '고객',
            sender_type: 'customer',
            sender_avatar: selectedAvatar,
            message: messageText,
            message_type: 'text'
          })
        })

        if (!response.ok) {
          let errorData
          try {
            errorData = await response.json()
          } catch (e) {
            const text = await response.text()
            errorData = { error: `HTTP ${response.status}: ${response.statusText}`, raw: text }
          }
          console.error('API Error:', {
            status: response.status,
            statusText: response.statusText,
            errorData,
            fullError: JSON.stringify(errorData, null, 2)
          })
          const errorMessage = errorData.error || errorData.details || errorData.message || '메시지 전송에 실패했습니다'
          const errorDetails = errorData.code || errorData.hint ? ` (${errorData.code || ''} ${errorData.hint || ''})` : ''
          throw new Error(`${errorMessage}${errorDetails}`)
        }

        const result = await response.json()
        data = result.message
      } else {
        // 가이드/관리자는 직접 Supabase 사용
        const result = await (supabase
          .from('chat_messages') as unknown as SupabaseInsertBuilder)
          .insert({
            room_id: room.id,
            sender_type: 'guide',
            sender_name: '가이드',
            sender_email: guideEmail,
            message: messageText,
            message_type: 'text'
          })
          .select()
          .single()

        if (result.error) throw result.error
        data = result.data
      }
      
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
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An error occurred while sending the message.'
      alert(errorMessage)
      
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

  // 위치 공유 확인 후 메시지 전송
  const confirmLocationShare = async () => {
    if (!pendingLocation || !room) return
    
    setShowLocationShareModal(false)
    setGettingLocation(false)
    
    // 위치 정보를 메시지로 전송
    const locationMessage = selectedLanguage === 'ko' 
      ? `📍 내 위치\n위도: ${pendingLocation.latitude.toFixed(6)}\n경도: ${pendingLocation.longitude.toFixed(6)}\n\n🗺️ 지도 보기:\nGoogle Maps: ${pendingLocation.googleMapsLink}\nNaver Maps: ${pendingLocation.naverMapsLink}`
      : `📍 My Location\nLatitude: ${pendingLocation.latitude.toFixed(6)}\nLongitude: ${pendingLocation.longitude.toFixed(6)}\n\n🗺️ View on Map:\nGoogle Maps: ${pendingLocation.googleMapsLink}`
    
    // 메시지 전송
    const messageText = locationMessage
    setSending(true)
    
    // 즉시 UI에 메시지 표시 (낙관적 업데이트)
    const tempMessage: ChatMessage = {
      id: `temp_${Date.now()}`,
      room_id: room.id,
      sender_type: isPublicView ? 'customer' : 'guide',
      sender_name: isPublicView ? (customerName || '고객') : '가이드',
      sender_email: isPublicView ? undefined : guideEmail,
      sender_avatar: isPublicView ? selectedAvatar : undefined,
      message: messageText,
      message_type: 'location',
      is_read: false,
      created_at: new Date().toISOString()
    }
    
    setMessages(prev => [...prev, tempMessage])
    scrollToBottom()

    try {
      let data: ChatMessage | null = null

      // 고객용 공유 페이지는 API 엔드포인트 사용 (RLS 우회)
      if (isPublicView) {
        const response = await fetch('/api/chat-messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            room_id: room.id,
            sender_name: customerName || '고객',
            sender_type: 'customer',
            sender_avatar: selectedAvatar,
            message: messageText,
            message_type: 'location'
          })
        })

        if (!response.ok) {
          throw new Error('메시지 전송에 실패했습니다')
        }

        const result = await response.json()
        data = result.message
      } else {
        // 가이드/관리자는 직접 Supabase 사용
        const result = await (supabase
          .from('chat_messages') as unknown as SupabaseInsertBuilder)
          .insert({
            room_id: room.id,
            sender_type: 'guide',
            sender_name: '가이드',
            sender_email: guideEmail,
            message: messageText,
            message_type: 'location'
          })
          .select()
          .single()

        if (result.error) throw result.error
        data = result.data
      }
      
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
          }
        }
      }
      
      setPendingLocation(null)
    } catch (error) {
      console.error('Error sending location message:', error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An error occurred while sending the message.'
      alert(errorMessage)
      
      // 실패 시 임시 메시지 제거
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id))
    } finally {
      setSending(false)
    }
  }

  // 위치 공유 취소
  const cancelLocationShare = () => {
    setShowLocationShareModal(false)
    setPendingLocation(null)
    setGettingLocation(false)
  }

  // 위치 공유 함수
  const shareLocation = async () => {
    if (!room || gettingLocation || sending) return
    
    if (!navigator.geolocation) {
      alert(selectedLanguage === 'ko' ? '이 브라우저는 위치 서비스를 지원하지 않습니다.' : 'Geolocation is not supported by this browser.')
      return
    }
    
    setGettingLocation(true)
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false, // 정확도보다 속도 우선
          timeout: 20000, // 20초로 증가
          maximumAge: 60000 // 1분 이내 캐시된 위치 허용
        })
      })
      
      const { latitude, longitude } = position.coords
      const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`
      const naverMapsLink = `https://map.naver.com/?dlevel=11&lat=${latitude}&lng=${longitude}&mapMode=0&pinTitle=내+위치&pinType=default`
      
      // 위치 정보를 저장하고 모달 표시
      setPendingLocation({
        latitude,
        longitude,
        googleMapsLink,
        naverMapsLink
      })
      setShowLocationShareModal(true)
    } catch (error) {
      console.error('Error getting location:', error)
      if (error instanceof GeolocationPositionError) {
        if (error.code === error.PERMISSION_DENIED) {
          alert(selectedLanguage === 'ko' ? '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.' : 'Location permission denied. Please enable location access in your browser settings.')
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          alert(selectedLanguage === 'ko' ? '위치 정보를 가져올 수 없습니다.' : 'Location information is unavailable.')
        } else if (error.code === error.TIMEOUT) {
          // 타임아웃 시 재시도 옵션 제공
          const retry = confirm(selectedLanguage === 'ko' 
            ? '위치 정보 요청 시간이 초과되었습니다. 다시 시도하시겠습니까?' 
            : 'Location request timed out. Would you like to try again?')
          if (retry) {
            setTimeout(() => shareLocation(), 500)
            return
          }
        } else {
          alert(selectedLanguage === 'ko' ? '위치 정보를 가져오는 중 오류가 발생했습니다.' : 'An error occurred while getting location.')
        }
      } else {
        alert(selectedLanguage === 'ko' ? '위치 정보를 가져오는 중 오류가 발생했습니다.' : 'An error occurred while getting location.')
      }
    } finally {
      setGettingLocation(false)
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
        <div className="flex-shrink-0 px-2 lg:px-3 py-2 border-b bg-white bg-opacity-90 backdrop-blur-sm shadow-sm relative">
          {!isPublicView && (
          <div className="mb-1">
            <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 lg:space-x-3 flex-1 min-w-0">
              </div>
            </div>
          </div>
        )}
        

        {/* 버튼 영역 */}
        <div className={`mt-1 flex items-center gap-1 lg:gap-2 ${isMobileMenuOpen ? 'justify-between' : 'justify-center'} lg:justify-between`}>
          {/* 모바일: 접었을 때 아이콘만 표시 */}
          <div className={`lg:hidden flex items-center gap-2 flex-wrap justify-center flex-1 ${isMobileMenuOpen ? 'hidden' : ''}`}>
            {isPublicView && (
              <>
                <button
                  onClick={() => setIsAnnouncementsOpen(true)}
                  className="p-2 bg-amber-100 text-amber-800 rounded border border-amber-200 hover:bg-amber-200"
                  title={selectedLanguage === 'ko' ? '공지사항' : 'Announcements'}
                >
                  <Megaphone size={18} />
                </button>
                <button
                  onClick={() => setShowPickupScheduleModal(true)}
                  className="p-2 bg-blue-100 text-blue-800 rounded border border-blue-200 hover:bg-blue-200"
                  title={selectedLanguage === 'ko' ? '픽업 스케줄' : 'Pickup Schedule'}
                >
                  <Calendar size={18} />
                </button>
                <button
                  onClick={() => setShowPhotoGallery(true)}
                  className="p-2 bg-violet-100 text-violet-800 rounded border border-violet-200 hover:bg-violet-200"
                  title={selectedLanguage === 'ko' ? '투어 사진' : 'Tour Photos'}
                >
                  <ImageIcon size={18} />
                </button>
                <button
                  onClick={() => setShowTeamInfo(true)}
                  className="p-2 bg-indigo-100 text-indigo-800 rounded border border-indigo-200 hover:bg-indigo-200"
                  title={selectedLanguage === 'ko' ? '가이드 정보' : 'Guide Info'}
                >
                  <Users size={18} />
                </button>
                {/* 음성 통화 버튼 (고객용) */}
                <button
                  onClick={handleStartCall}
                  disabled={!room || callStatus !== 'idle' || availableCallUsers.length === 0}
                  className={`p-2 rounded border ${
                    callStatus === 'connected'
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : callStatus !== 'idle'
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : availableCallUsers.length === 0
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                  }`}
                  title={selectedLanguage === 'ko' ? '음성 통화' : 'Voice Call'}
                >
                  <Phone size={18} />
                </button>
              </>
            )}
            {!isPublicView && (
              <>
                <button
                  onClick={() => setIsAnnouncementsOpen(true)}
                  className="p-2 bg-amber-100 text-amber-800 rounded border border-amber-200 hover:bg-amber-200"
                  title={selectedLanguage === 'ko' ? '공지사항' : 'Announcements'}
                >
                  <Megaphone size={18} />
                </button>
                <button
                  onClick={() => setShowPickupScheduleModal(true)}
                  className="p-2 bg-blue-100 text-blue-800 rounded border border-blue-200 hover:bg-blue-200"
                  title={selectedLanguage === 'ko' ? '픽업 스케줄' : 'Pickup Schedule'}
                >
                  <Calendar size={18} />
                </button>
                <button
                  onClick={goToTourDetail}
                  className="p-2 bg-purple-100 text-purple-800 rounded border border-purple-200 hover:bg-purple-200"
                  title={selectedLanguage === 'ko' ? '투어 상세 페이지' : 'Tour Details'}
                >
                  <ExternalLink size={18} />
                </button>
              </>
            )}
            <button
              onClick={copyRoomLink}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
              title={selectedLanguage === 'ko' ? '링크 복사' : 'Copy Link'}
            >
              <Copy size={18} />
            </button>
            <button
              onClick={shareRoomLink}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
              title={selectedLanguage === 'ko' ? '공유' : 'Share'}
            >
              <Share2 size={18} />
            </button>
            <button
              onClick={handleMobileMenuToggle}
              className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded"
              title={selectedLanguage === 'ko' ? '펼치기' : 'Expand'}
            >
              <ChevronDown size={18} />
            </button>
          </div>

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
                {/* 참여자 목록 버튼 (모바일) */}
                {!isPublicView && (
                  <button
                    onClick={() => setShowParticipantsList(!showParticipantsList)}
                    className="px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs bg-indigo-100 text-indigo-800 rounded border border-indigo-200 hover:bg-indigo-200 flex items-center justify-center relative"
                    title={selectedLanguage === 'ko' ? '참여자 목록' : 'Participants'}
                  >
                    <Users size={12} className="lg:w-3.5 lg:h-3.5" />
                    {onlineParticipants.size > 0 && (
                      <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center">
                        {onlineParticipants.size}
                      </span>
                    )}
                  </button>
                )}
              </>
            )}
            
            {/* 음성 통화 버튼 */}
            <button
              onClick={handleStartCall}
              disabled={!room || callStatus !== 'idle' || availableCallUsers.length === 0}
              className={`px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs rounded border flex items-center justify-center ${
                callStatus === 'connected'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : callStatus !== 'idle'
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : availableCallUsers.length === 0
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
              }`}
              title={selectedLanguage === 'ko' ? '음성 통화' : 'Voice Call'}
              aria-label={selectedLanguage === 'ko' ? '음성 통화' : 'Voice Call'}
            >
              <Phone size={12} className="lg:w-3.5 lg:h-3.5" />
            </button>
            
            {/* 참여자 목록 버튼 (관리자/가이드/드라이버/어시스턴트만) */}
            {!isPublicView && (
              <button
                onClick={() => setShowParticipantsList(!showParticipantsList)}
                className="px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs rounded border bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200 flex items-center justify-center relative"
                title={selectedLanguage === 'ko' ? '참여자 목록' : 'Participants'}
                aria-label={selectedLanguage === 'ko' ? '참여자 목록' : 'Participants'}
              >
                <Users size={12} className="lg:w-3.5 lg:h-3.5" />
                {onlineParticipants.size > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center">
                    {onlineParticipants.size}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* 모바일: 접었다 폈다 할 수 있는 메뉴 */}
          <div className={`lg:hidden relative p-3 space-y-2 ${isMobileMenuOpen ? '' : 'hidden'}`}>
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
                
                {/* 투어 사진, 가이드 정보, 음성 통화: 3열 그리드 (고객용) */}
                {isPublicView && (
                  <div className="grid grid-cols-3 gap-2">
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
                    {/* 음성 통화 버튼 (고객용) */}
                    <button
                      onClick={handleStartCall}
                      disabled={!room || callStatus !== 'idle' || availableCallUsers.length === 0}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                        callStatus === 'connected'
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : callStatus !== 'idle'
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : availableCallUsers.length === 0
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                      }`}
                      title={selectedLanguage === 'ko' ? '음성 통화' : 'Voice Call'}
                    >
                      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                        <Phone size={20} />
                      </div>
                      <span className="text-[10px] font-medium">{selectedLanguage === 'ko' ? '통화' : 'Call'}</span>
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
            {/* 푸시 알림 토글 버튼 (고객용, 국기 아이콘 왼쪽) */}
            {isPublicView && isPushSupported && (
              <button
                onClick={async () => {
                  if (isPushSubscribed) {
                    await unsubscribeFromPush()
                  } else {
                    const success = await subscribeToPush()
                    if (success) {
                      alert(selectedLanguage === 'ko' 
                        ? '푸시 알림이 활성화되었습니다.' 
                        : 'Push notifications enabled.')
                    }
                  }
                }}
                disabled={isPushLoading}
                className={`p-1.5 lg:p-2 rounded transition-colors ${
                  isPushSubscribed
                    ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={selectedLanguage === 'ko' 
                  ? (isPushSubscribed ? '푸시 알림 비활성화' : '푸시 알림 활성화')
                  : (isPushSubscribed ? 'Disable Push Notifications' : 'Enable Push Notifications')}
              >
                {isPushSubscribed ? (
                  <Bell size={14} className="lg:w-4 lg:h-4" />
                ) : (
                  <BellOff size={14} className="lg:w-4 lg:h-4" />
                )}
              </button>
            )}
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

      {/* 참여자 목록 사이드바 (관리자/가이드/드라이버/어시스턴트만) */}
      {!isPublicView && showParticipantsList && (
        <div className="absolute right-0 top-0 bottom-0 w-64 bg-white border-l border-gray-200 shadow-lg z-30 flex flex-col">
          <div className="p-4 border-b bg-indigo-50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                <Users size={16} className="mr-2 text-indigo-600" />
                {selectedLanguage === 'ko' ? '참여자' : 'Participants'}
              </h3>
              <button
                onClick={() => setShowParticipantsList(false)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {onlineParticipants.size} {selectedLanguage === 'ko' ? '명 온라인' : 'online'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {onlineParticipants.size === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">{selectedLanguage === 'ko' ? '온라인 참여자가 없습니다' : 'No online participants'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from(onlineParticipants.values()).map((participant, index) => (
                  <div
                    key={`${participant.id}-${participant.type}-${index}`}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 border border-gray-100"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                        <User size={16} className="text-indigo-600" />
                      </div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{participant.name}</p>
                      <p className="text-xs text-gray-500">
                        {participant.type === 'guide' 
                          ? (selectedLanguage === 'ko' ? '가이드' : 'Guide')
                          : (selectedLanguage === 'ko' ? '고객' : 'Customer')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 메시지 목록 */}
      <div 
        className={`flex-1 overflow-y-auto p-2 lg:p-4 space-y-2 lg:space-y-3 min-h-0 bg-gradient-to-b from-transparent to-blue-50 bg-opacity-20 ${!isPublicView && showParticipantsList ? 'mr-64' : ''} ${!isMobileMenuOpen ? 'lg:mt-0' : ''}`}
        style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
      >
        {messages.map((message, index) => {
          const needsTrans = needsTranslation(message)
          const hasTranslation = translatedMessages[message.id]
          // const isTranslating = translating[message.id] // 사용되지 않음
          
          // 아바타 URL 가져오기 (메시지에 저장된 아바타 또는 기본값)
          const avatarUrl = (message as any).sender_avatar || 
            (message.sender_type === 'customer' 
              ? (message.sender_name === (customerName || '고객') ? selectedAvatar : undefined)
              : undefined)
          
          return (
            <div
              key={`${message.id}-${index}`}
              className={`flex items-start space-x-2 ${message.sender_type === 'guide' ? 'justify-end' : 'justify-start'}`}
            >
              {/* 아바타 (고객 메시지일 때만 왼쪽에 표시) */}
              {message.sender_type === 'customer' && (
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={message.sender_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <User size={20} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex flex-col max-w-xs lg:max-w-md">
                {/* 이름 (고객 메시지일 때만) */}
                {message.sender_type === 'customer' && (
                  <div className="text-xs font-medium text-gray-700 mb-1 px-1">
                    {message.sender_name}
                  </div>
                )}
                
                <div
                  className={`px-3 lg:px-4 py-2 rounded-lg border shadow-sm ${
                    message.sender_type === 'system'
                      ? 'bg-gray-200 bg-opacity-80 backdrop-blur-sm text-gray-700 text-center'
                      : message.sender_type === 'guide'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-600'
                      : 'bg-white bg-opacity-90 backdrop-blur-sm text-gray-900 border-gray-200'
                  }`}
                >
                  {message.sender_type === 'guide' && (
                    <div className="text-xs font-medium mb-1 opacity-90">
                      {message.sender_name}
                    </div>
                  )}
                  
                  {/* 메시지 내용 */}
                  <div className="text-sm" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
                    {message.message_type === 'image' && message.file_url ? (
                      <div className="mt-2">
                        <img
                          src={message.file_url}
                          alt={message.file_name || 'Uploaded image'}
                          className="max-w-full h-auto rounded-lg cursor-pointer"
                          onClick={() => window.open(message.file_url, '_blank')}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3EImage not found%3C/text%3E%3C/svg%3E'
                          }}
                        />
                        {message.file_name && (
                          <div className="text-xs text-gray-500 mt-1">{message.file_name}</div>
                        )}
                      </div>
                    ) : message.message.startsWith('[EN] ') ? (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">번역된 메시지:</div>
                        <div>{message.message.replace('[EN] ', '')}</div>
                      </div>
                    ) : (
                      <div>
                        {/* 원본 메시지 */}
                        <div className="whitespace-pre-wrap break-words">
                          {message.message.split('\n').map((line, idx) => {
                            // Google Maps 링크 감지
                            if (line.includes('Google Maps:') || line.includes('google.com/maps')) {
                              const urlMatch = line.match(/https?:\/\/[^\s]+/)
                              if (urlMatch) {
                                return (
                                  <div key={idx} className="my-1">
                                    {line.split(urlMatch[0])[0]}
                                    <a
                                      href={urlMatch[0]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1 inline-block"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        window.open(urlMatch[0], '_blank')
                                      }}
                                    >
                                      <MapPin size={14} />
                                      {selectedLanguage === 'ko' ? 'Google Maps에서 보기' : 'View on Google Maps'}
                                    </a>
                                  </div>
                                )
                              }
                            }
                            // Naver Maps 링크 감지
                            if (line.includes('Naver Maps:') || line.includes('map.naver.com')) {
                              const urlMatch = line.match(/https?:\/\/[^\s]+/)
                              if (urlMatch) {
                                return (
                                  <div key={idx} className="my-1">
                                    {line.split(urlMatch[0])[0]}
                                    <a
                                      href={urlMatch[0]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-green-600 hover:text-green-800 underline flex items-center gap-1 inline-block"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        window.open(urlMatch[0], '_blank')
                                      }}
                                    >
                                      <MapPin size={14} />
                                      {selectedLanguage === 'ko' ? 'Naver Maps에서 보기' : 'View on Naver Maps'}
                                    </a>
                                  </div>
                                )
                              }
                            }
                            return <div key={idx}>{line}</div>
                          })}
                        </div>
                        
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
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 메시지 입력 */}
      {room.is_active && (
        <div className={`${isPublicView ? 'p-2 lg:p-4' : 'p-2 lg:p-4 border-t bg-white bg-opacity-90 backdrop-blur-sm shadow-lg'} flex-shrink-0 relative`}>
          <div className="flex items-center space-x-1 w-full">
            {/* 이미지 업로드 버튼 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || sending}
              className="flex-shrink-0 p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={selectedLanguage === 'ko' ? '이미지 업로드' : 'Upload Image'}
            >
              {uploading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
              ) : (
                <ImageIcon size={18} />
              )}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  handleImageUpload(file)
                }
              }}
              className="hidden"
            />
            
            {/* 이모티콘 버튼 */}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="flex-shrink-0 p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
              title={selectedLanguage === 'ko' ? '이모티콘' : 'Emoji'}
            >
              <Smile size={18} />
            </button>
            
            {/* 위치 공유 버튼 (고객용만) */}
            {isPublicView && (
              <button
                onClick={shareLocation}
                disabled={gettingLocation || sending || uploading}
                className="flex-shrink-0 p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={selectedLanguage === 'ko' ? '위치 공유' : 'Share Location'}
              >
                {gettingLocation ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                ) : (
                  <MapPin size={18} />
                )}
              </button>
            )}
            
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={selectedLanguage === 'ko' ? '메시지를 입력하세요...' : 'Type your message...'}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base"
              disabled={sending || uploading || gettingLocation}
            />
            
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending || uploading}
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

      {/* 아바타 선택 모달 (고객용만) */}
      {isPublicView && (
        <AvatarSelector
          isOpen={showAvatarSelector}
          onClose={() => setShowAvatarSelector(false)}
          onSelect={(avatarUrl) => {
            setSelectedAvatar(avatarUrl)
            if (roomCode) {
              localStorage.setItem(`chat_avatar_${roomCode}`, avatarUrl)
            }
          }}
          currentAvatar={selectedAvatar}
          usedAvatars={usedAvatars}
          language={selectedLanguage as 'ko' | 'en'}
        />
      )}

      {/* 이모티콘 선택기 */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-2 lg:left-4 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50 max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{selectedLanguage === 'ko' ? '이모티콘' : 'Emoji'}</span>
            <button
              onClick={() => setShowEmojiPicker(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
            {['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setNewMessage(prev => prev + emoji)
                  setShowEmojiPicker(false)
                }}
                className="p-2 hover:bg-gray-100 rounded text-lg"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 통화할 사용자 선택 모달 */}
      <VoiceCallUserSelector
        isOpen={showCallUserSelector}
        onClose={() => setShowCallUserSelector(false)}
        users={availableCallUsers}
        onSelectUser={handleSelectUserAndCall}
        language={selectedLanguage as 'ko' | 'en'}
      />

      {/* 음성 통화 모달 */}
      <VoiceCallModal
        isOpen={callStatus !== 'idle'}
        callStatus={callStatus}
        callerName={callerName || selectedCallTarget?.name}
        callDuration={callDuration}
        isMuted={isMuted}
        callError={callError}
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

      {/* 위치 공유 확인 모달 */}
      {showLocationShareModal && pendingLocation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedLanguage === 'ko' ? '내 위치를 공유하시겠습니까?' : 'Share your location?'}
            </h3>
            <div className="mb-4 text-sm text-gray-600">
              <p className="mb-2 whitespace-pre-line">
                {selectedLanguage === 'ko' 
                  ? `위도: ${pendingLocation.latitude.toFixed(6)}\n경도: ${pendingLocation.longitude.toFixed(6)}`
                  : `Latitude: ${pendingLocation.latitude.toFixed(6)}\nLongitude: ${pendingLocation.longitude.toFixed(6)}`}
              </p>
              <div className="flex gap-2 mt-2">
                <a
                  href={pendingLocation.googleMapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-xs underline"
                >
                  {selectedLanguage === 'ko' ? 'Google Maps에서 보기' : 'View on Google Maps'}
                </a>
                {selectedLanguage === 'ko' && (
                  <a
                    href={pendingLocation.naverMapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-xs underline"
                  >
                    Naver Maps에서 보기
                  </a>
                )}
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelLocationShare}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {selectedLanguage === 'ko' ? '취소' : 'Cancel'}
              </button>
              <button
                onClick={confirmLocationShare}
                disabled={sending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending 
                  ? (selectedLanguage === 'ko' ? '전송 중...' : 'Sending...')
                  : (selectedLanguage === 'ko' ? '확인' : 'Confirm')}
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