'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Image as ImageIcon, Copy, Share2, Calendar, Megaphone, Trash2, ChevronDown, ChevronUp, MapPin, Camera, ExternalLink, Users, Play, Phone, User, X, Menu, UserCircle, Smile, Bell, BellOff } from 'lucide-react'
import { useVoiceCall } from '@/hooks/useVoiceCall'
import VoiceCallModal from './VoiceCallModal'
import VoiceCallUserSelector from './VoiceCallUserSelector'
import AvatarSelector from './AvatarSelector'
import PickupHotelPhotoGallery from './PickupHotelPhotoGallery'
// ReactCountryFlag는 ChatHeader에서 사용됨
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ChatRoomShareModal from './ChatRoomShareModal'
import PickupScheduleModal from './PickupScheduleModal'
import TourPhotoGallery from './TourPhotoGallery'
import { translateText, detectLanguage, SupportedLanguage, SUPPORTED_LANGUAGES } from '@/lib/translation'
import { formatTimeWithAMPM } from '@/lib/utils'
import { usePushNotification } from '@/hooks/usePushNotification'
import { useChatRoom } from '@/hooks/useChatRoom'
import { useChatMessages } from '@/hooks/useChatMessages'
import { useChatParticipants } from '@/hooks/useChatParticipants'
import type { ChatMessage, ChatRoom, ChatAnnouncement } from '@/types/chat'
import ChatHeader from './chat/ChatHeader'
import MessageList from './chat/MessageList'
import MessageInput from './chat/MessageInput'
import ChatSidebar from './chat/ChatSidebar'

// 타입은 @/types/chat에서 import

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
  
  // 커스텀 훅 사용
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(customerLanguage)
  
  // customerLanguage prop이 변경되면 selectedLanguage도 업데이트
  useEffect(() => {
    setSelectedLanguage(customerLanguage)
  }, [customerLanguage])
  
  const { room, setRoom, loading, setLoading, roomRef, loadRoom: loadRoomFromHook, loadRoomByCode: loadRoomByCodeFromHook } = useChatRoom({
    tourId: tourId || undefined,
    isPublicView,
    roomCode: roomCode || undefined
  })
  
  const {
    messages,
    setMessages,
    sending,
    setSending,
    loadMessages,
    scrollToBottom,
    messagesEndRef,
    messagesRef
  } = useChatMessages({
    roomId: room?.id || null,
    isPublicView,
    customerName: customerName || undefined,
    guideEmail: guideEmail || undefined,
    selectedLanguage: selectedLanguage === 'ko' ? 'ko' : 'en'
  })
  
  const userId = isPublicView ? (customerName || '고객') : (guideEmail || '')
  const userName = isPublicView ? (customerName || '고객') : '가이드'
  
  const {
    onlineParticipants,
    setOnlineParticipants,
    loadChatParticipants
  } = useChatParticipants({
    roomId: room?.id || null,
    isPublicView,
    userId,
    userName,
    guideEmail,
    messagesRef
  })
  
  const [newMessage, setNewMessage] = useState('')
  
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
  
  const [showParticipantsList, setShowParticipantsList] = useState(false)
  
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
  } = usePushNotification(room?.id, undefined, selectedLanguage === 'ko' ? 'ko' : 'en')
  
  // 이미지 업로드
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
  const [showCallUserSelector, setShowCallUserSelector] = useState(false)
  const [selectedCallTarget, setSelectedCallTarget] = useState<{id: string, name: string} | null>(null)
  
  // 메시지와 온라인 참여자에서 통화 가능한 사용자 목록 추출
  const availableCallUsers = React.useMemo(() => {
    const userMap = new Map<string, { id: string; name: string; type: 'guide' | 'customer'; email?: string }>()
    
    // 메시지에서 사용자 추출
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
            type: message.sender_type === 'system' ? 'guide' : message.sender_type,
            email: message.sender_email || undefined
          })
        }
      }
    })
    
    // 온라인 참여자에서 사용자 추가 (고객용 뷰에서는 가이드/어시스턴트만)
    onlineParticipants.forEach((participant, key) => {
      if (isPublicView) {
        // 고객용 뷰: 가이드 타입만 통화 가능
        if (participant.type === 'guide') {
          const userKey = participant.email || participant.id
          if (!userMap.has(userKey)) {
            userMap.set(userKey, {
              id: participant.email || participant.id,
              name: participant.name,
              type: participant.type,
              email: participant.email || undefined
            })
          }
        }
      } else {
        // 관리자/가이드 뷰: 고객 타입만 통화 가능
        if (participant.type === 'customer') {
          const userKey = participant.id
          if (!userMap.has(userKey)) {
            userMap.set(userKey, {
              id: participant.id,
              name: participant.name,
              type: participant.type,
              email: participant.email || undefined
            })
          }
        }
      }
    })
    
    return Array.from(userMap.values())
  }, [messages, isPublicView, customerName, guideEmail, onlineParticipants])
  
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
    targetUserId: selectedCallTarget?.id || undefined,
    targetUserName: selectedCallTarget?.name || undefined
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
      const success = await startCallInternal(userId, userName)
      if (!success) {
        // startCall이 false를 반환하면 에러 메시지가 이미 설정되어 있음
        // callError가 설정되어 있으면 VoiceCallModal에서 표시됨
        console.error('Failed to start call')
      }
    } catch (error: any) {
      console.error('Error in handleSelectUserAndCall:', error)
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
  const loadPickupSchedule = useCallback(async () => {
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
      const reservationsWithCustomers: Array<Reservation & { customers?: Customer }> = reservationsData?.map((reservation: Reservation) => ({
        ...reservation,
        customers: customersData.find((customer: Customer) => customer.id === reservation.customer_id) || undefined
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
      const groupedByHotel = reservationsWithCustomers.reduce<Record<string, {
        time: string;
        date: string;
        hotel: string;
        location: string;
        people: number;
        customers: Array<{ name: string; people: number }>;
      }>>((acc, reservation) => {
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
      }, {})

      const schedule: Array<{
        time: string;
        date: string;
        hotel: string;
        location: string;
        people: number;
      }> = Object.values(groupedByHotel)
        .sort((a, b) => {
          if (!a || !b) return 0
          return a.time.localeCompare(b.time)
        })
        .filter((item): item is { time: string; date: string; hotel: string; location: string; people: number } => item !== undefined)

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
  }, [tourId, tourDate, isPublicView])
  
  // loadPickupSchedule을 ref에 저장
  useEffect(() => {
    loadPickupScheduleRef.current = loadPickupSchedule
  }, [loadPickupSchedule])

  // loadChatParticipants와 Presence 채널은 useChatParticipants 훅에서 처리됨
  // ref로 접근하기 위해 저장
  useEffect(() => {
    loadChatParticipantsRef.current = loadChatParticipants
  }, [loadChatParticipants])

  // 팀 정보 로드 (가이드, 어시스턴트, 드라이버)
  const loadTeamInfo = useCallback(async () => {
    try {
      if (!tourId) return

      // 투어 정보 가져오기
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .select('tour_guide_id, assistant_id, tour_car_id')
        .eq('id', tourId)
        .single<{ tour_guide_id: string | null; assistant_id: string | null; tour_car_id: string | null }>()

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
          .maybeSingle<{ name_ko: string | null; name_en: string | null; phone: string | null }>()

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
          .maybeSingle<{ name_ko: string | null; name_en: string | null; phone: string | null }>()

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
          .maybeSingle<{ driver_name: string | null; driver_phone: string | null }>()

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
  
  // loadTeamInfo를 ref에 저장
  useEffect(() => {
    loadTeamInfoRef.current = loadTeamInfo
  }, [loadTeamInfo])

  // scrollToBottom은 useChatMessages 훅에서 제공됨

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

  // loadMessages는 useChatMessages 훅에서 제공됨
  // ref로 접근하기 위해 저장
  const loadMessagesRef = useRef<((roomId: string) => Promise<void>) | null>(null)
  
  useEffect(() => {
    loadMessagesRef.current = loadMessages
  }, [loadMessages])

  // loadRoomByCode는 useChatRoom 훅에서 제공됨

  // 투어에 배정된 팀원들을 채팅방에 자동 참여시키기 (배정 변경 시 동기화)
  const autoAddTeamMembersRef = useRef<{ [key: string]: boolean }>({})
  const autoAddTeamMembersFnRef = useRef<((roomId: string, tourIdParam?: string) => Promise<void>) | null>(null)
  
  // 함수들을 ref로 저장하여 의존성 배열 문제 해결
  // loadMessagesRef는 위에서 이미 정의됨
  const loadAnnouncementsRef = useRef<((roomId: string) => Promise<void>) | null>(null)
  const loadChatParticipantsRef = useRef<((roomId: string) => Promise<void>) | null>(null)
  const loadPickupScheduleRef = useRef<(() => Promise<void>) | null>(null)
  const loadTeamInfoRef = useRef<(() => Promise<void>) | null>(null)
  const loadRoomRef = useRef<(() => Promise<void>) | null>(null)
  
  // messagesRef와 roomRef는 각각 useChatMessages와 useChatRoom 훅에서 제공됨
  
  // guideEmail과 customerName을 ref로 저장
  const guideEmailRef = useRef<string | undefined>(guideEmail)
  const customerNameRef = useRef<string | undefined>(customerName)
  useEffect(() => {
    guideEmailRef.current = guideEmail
  }, [guideEmail])
  useEffect(() => {
    customerNameRef.current = customerName
  }, [customerName])
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
        .single<{ tour_guide_id: string | null; assistant_id: string | null; tour_car_id: string | null }>()

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
          .maybeSingle<{ driver_name: string | null; driver_email: string | null }>()

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

      const existingParticipantsList = (existingParticipants || []) as Array<{ id: string; participant_id: string; participant_type: string }>
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
          .maybeSingle<{ email: string; name_ko: string | null; name_en: string | null }>()

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
          .maybeSingle<{ email: string; name_ko: string | null; name_en: string | null }>()

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
          .maybeSingle<{ driver_name: string | null; driver_email: string | null }>()

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
        const { error: deactivateError } = await (supabase
          .from('chat_participants') as any)
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
        const { error: insertError } = await (supabase
          .from('chat_participants') as any)
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

  // 공지사항 로드 (loadRoom보다 먼저 정의되어야 함)
  const loadAnnouncements = useCallback(async (roomId: string) => {
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
  }, [tourId])
  
  // loadAnnouncements를 ref에 저장
  useEffect(() => {
    loadAnnouncementsRef.current = loadAnnouncements
  }, [loadAnnouncements])

  // loadRoom은 useChatRoom 훅에서 제공됨
  
  // loadRoom을 ref에 저장
  useEffect(() => {
    loadRoomRef.current = loadRoomFromHook
  }, [loadRoomFromHook])

  // 초기화 플래그를 ref로 관리하여 무한 루핑 방지
  const initializationRef = useRef<{ tourId?: string; isPublicView?: boolean; roomCode?: string; initialized?: boolean }>({})
  
  // 채팅방 로드 또는 생성
  useEffect(() => {
    let isMounted = true
    
    // 이미 같은 파라미터로 초기화되었는지 확인
    const currentKey = `${tourId}_${isPublicView}_${roomCode}`
    const lastKey = `${initializationRef.current.tourId}_${initializationRef.current.isPublicView}_${initializationRef.current.roomCode}`
    
    if (currentKey === lastKey && initializationRef.current.initialized) {
      // 이미 초기화되었으므로 스킵
      return
    }
    
    // 초기화 플래그 업데이트 (같은 키면 업데이트하지 않음)
    if (currentKey !== lastKey) {
      initializationRef.current = { tourId, isPublicView, roomCode, initialized: false }
    } else if (initializationRef.current.initialized) {
      return // 이미 초기화되었으므로 스킵
    }
    
    const initializeChat = async () => {
      if (!isMounted) return
      
      try {
        if (isPublicView && roomCode) {
          await loadRoomByCodeFromHook(roomCode)
        } else if (!isPublicView && tourId) {
          await loadRoomFromHook()
        } else if (isPublicView && !roomCode) {
          if (isMounted) {
            setLoading(false)
          }
        }
        
        // 초기화 완료 표시
        if (isMounted) {
          initializationRef.current.initialized = true
        }
      } catch (error) {
        console.error('Error initializing chat:', error)
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    initializeChat()
    
    return () => {
      isMounted = false
    }
  }, [tourId, isPublicView, roomCode, loadRoomByCodeFromHook, loadRoomFromHook])

  // 실시간 메시지 구독 및 메시지 로드는 useChatMessages 훅에서 처리됨

  // 투어 배정 변경 감지 및 동기화
  const assignmentChannelRoomIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!room?.id || !tourId || isPublicView) {
      assignmentChannelRoomIdRef.current = null
      return
    }
    
    // room.id가 실제로 변경되었는지 확인
    if (assignmentChannelRoomIdRef.current === room.id) {
      return // 같은 room이면 재구독하지 않음
    }
    
    assignmentChannelRoomIdRef.current = room.id

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
    const tempMessage = {
      id: `temp_${Date.now()}`,
      room_id: room.id,
      sender_type: isPublicView ? 'customer' : 'guide',
      sender_name: isPublicView ? (customerName || '고객') : '가이드',
      sender_email: isPublicView ? undefined : (guideEmail || undefined),
      sender_avatar: isPublicView ? selectedAvatar : undefined,
      message: '',
      message_type: 'image' as const,
      file_url: imageUrl,
      file_name: fileName,
      file_size: fileSize,
      is_read: false,
      created_at: new Date().toISOString()
    } as ChatMessage
    
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
          .from('chat_messages') as any)
          .insert({
            room_id: room.id,
            sender_type: 'guide',
            sender_name: '가이드',
            sender_email: guideEmail || null,
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
    const tempMessage = {
      id: `temp_${Date.now()}`,
      room_id: room.id,
      sender_type: isPublicView ? 'customer' : 'guide',
      sender_name: isPublicView ? (customerName || '고객') : '가이드',
      sender_email: isPublicView ? undefined : (guideEmail || undefined),
      sender_avatar: isPublicView ? selectedAvatar : undefined,
      message: messageText,
      message_type: 'text' as const,
      is_read: false,
      created_at: new Date().toISOString()
    } as ChatMessage
    
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
    const tempMessage = {
      id: `temp_${Date.now()}`,
      room_id: room.id,
      sender_type: isPublicView ? 'customer' : 'guide',
      sender_name: isPublicView ? (customerName || '고객') : '가이드',
      sender_email: isPublicView ? undefined : (guideEmail || undefined),
      sender_avatar: isPublicView ? selectedAvatar : undefined,
      message: messageText,
      message_type: 'location' as const,
      is_read: false,
      created_at: new Date().toISOString()
    } as ChatMessage
    
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

        let result
        try {
          result = await response.json()
        } catch (jsonError) {
          console.error('Failed to parse JSON response:', jsonError)
          const text = await response.text()
          console.error('Response text:', text)
          throw new Error(selectedLanguage === 'ko' ? '서버 응답을 파싱할 수 없습니다.' : 'Failed to parse server response.')
        }

        if (!response.ok) {
          const errorMsg = result?.error || result?.details || (selectedLanguage === 'ko' ? '메시지 전송에 실패했습니다' : 'Failed to send message')
          console.error('API error:', result)
          throw new Error(errorMsg)
        }

        if (!result || !result.message) {
          console.error('Invalid API response:', result)
          throw new Error(selectedLanguage === 'ko' ? '서버 응답이 올바르지 않습니다.' : 'Invalid server response.')
        }

        data = result.message
      } else {
        // 가이드/관리자는 직접 Supabase 사용
        const result = await (supabase
          .from('chat_messages') as any)
          .insert({
            room_id: room.id,
            sender_type: 'guide',
            sender_name: '가이드',
            sender_email: guideEmail || null,
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
        : (selectedLanguage === 'ko' ? '메시지 전송 중 오류가 발생했습니다.' : 'An error occurred while sending the message.')
      
      // 더 자세한 에러 메시지 표시
      const displayMessage = selectedLanguage === 'ko'
        ? `위치 공유 실패: ${errorMessage}`
        : `Failed to share location: ${errorMessage}`
      
      alert(displayMessage)
      
      // 실패 시 임시 메시지 제거
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id))
      
      // pendingLocation은 유지하여 다시 시도할 수 있도록 함
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
  // 무한 로딩 문제로 인해 일시적으로 비활성화
  // useEffect(() => {
  //   if (!room) return

  //   const translateExistingMessages = async () => {
  //     console.log('Translating existing messages for language:', selectedLanguage)
  //     const guideMessages = messages.filter(msg => 
  //       msg.sender_type === 'guide' && 
  //       !msg.message.startsWith('[EN] ') &&
  //       needsTranslation(msg)
  //     )
      
  //     console.log('Found guide messages to translate:', guideMessages.length)

  //     for (const message of guideMessages) {
  //       if (translating[message.id]) continue

  //       console.log('Translating message:', message.message)
  //       setTranslating(prev => ({ ...prev, [message.id]: true }))
  //       try {
  //         const result = await translateText(message.message, detectLanguage(message.message), selectedLanguage)
  //         console.log('Translation result:', result)
  //     setTranslatedMessages(prev => ({
  //       ...prev,
  //           [message.id]: result.translatedText
  //     }))
  //   } catch (error) {
  //         console.error('Translation error for existing message:', error)
  //   } finally {
  //         setTranslating(prev => ({ ...prev, [message.id]: false }))
  //       }
  //     }
  //   }

  //   translateExistingMessages()
  // }, [selectedLanguage, messages, room, needsTranslation, translating])

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
      {room && (
        <ChatHeader
          room={room}
          isPublicView={isPublicView}
          isMobileMenuOpen={isMobileMenuOpen}
          selectedLanguage={selectedLanguage}
          callStatus={callStatus}
          availableCallUsersCount={availableCallUsers.length}
          onlineParticipantsCount={onlineParticipants.size}
          isPushSupported={isPushSupported}
          isPushSubscribed={isPushSubscribed}
          isPushLoading={isPushLoading}
          togglingActive={togglingActive}
          onToggleRoomActive={toggleRoomActive}
          onToggleMobileMenu={handleMobileMenuToggle}
          onShowAnnouncements={() => setIsAnnouncementsOpen(true)}
          onShowPickupSchedule={() => setShowPickupScheduleModal(true)}
          onShowPhotoGallery={() => setShowPhotoGallery(true)}
          onShowTeamInfo={() => setShowTeamInfo(true)}
          onGoToTourDetail={goToTourDetail}
          onStartCall={handleStartCall}
          onCopyLink={copyRoomLink}
          onShare={shareRoomLink}
          onTogglePush={async () => {
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
          onLanguageToggle={handleLanguageToggle}
          onShowParticipants={() => setShowParticipantsList(!showParticipantsList)}
          getLanguageFlag={getLanguageFlag}
        />
      )}

      {/* 참여자 목록 사이드바 (관리자/가이드/드라이버/어시스턴트만) */}
      {!isPublicView && (
        <ChatSidebar
          isOpen={showParticipantsList}
          onClose={() => setShowParticipantsList(false)}
          participants={onlineParticipants}
          selectedLanguage={selectedLanguage}
        />
      )}

      {/* 메시지 목록 */}
      <MessageList
        messages={messages}
        isPublicView={isPublicView}
        customerName={customerName}
        selectedAvatar={selectedAvatar}
        selectedLanguage={selectedLanguage}
        translatedMessages={translatedMessages}
        needsTranslation={needsTranslation}
        getLanguageDisplayName={getLanguageDisplayName}
        formatTime={formatTime}
        canDeleteMessage={canDeleteMessage}
        deleteMessage={deleteMessage}
        messagesEndRef={messagesEndRef}
        showParticipantsList={showParticipantsList}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      {/* 메시지 입력 */}
      {room && (
        <MessageInput
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          sending={sending}
          uploading={uploading}
          gettingLocation={gettingLocation}
          isPublicView={isPublicView}
          selectedLanguage={selectedLanguage}
          roomActive={room.is_active}
          onSendMessage={sendMessage}
          onImageUpload={handleImageUpload}
          onShareLocation={shareLocation}
          fileInputRef={fileInputRef}
        />
      )}

      {/* 공유 모달 (관리자/고객 공통) */}
      {room && (
        <ChatRoomShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          roomCode={room.room_code}
          roomName={room.room_name}
          tourDate={tourDate || undefined}
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
        callerName={callerName || selectedCallTarget?.name || undefined}
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