'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageCircle, Plus, Settings, Pin, Search, X, Paperclip, Image, File, RefreshCw, Trash2, Calendar, Users, User, Car } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useOptimizedData } from '@/hooks/useOptimizedData'
import { useTranslations } from 'next-intl'
import { createClientSupabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'

interface TeamChatRoom {
  id: string
  room_name: string
  room_type: 'general' | 'department' | 'project' | 'announcement'
  description?: string
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
  last_message_at?: string
  unread_count: number
  participants_count: number
  team_chat_participants?: Array<{ count: number }>
  last_message?: {
    id: string
    message: string
    sender_name: string
    sender_position?: string
    created_at: string
  }
}

interface TeamChatMessage {
  id: string
  room_id: string
  sender_email: string
  sender_name: string
  sender_position?: string
  message: string
  message_type: 'text' | 'image' | 'file' | 'system' | 'announcement'
  file_url?: string
  file_name?: string
  file_size?: number
  file_type?: string
  is_pinned: boolean
  reply_to_id?: string
  reply_to_message?: {
    id: string
    message: string
    sender_name: string
  }
  created_at: string
  read_by: Array<{
    reader_email: string
    read_at: string
  }>
}

interface TourChatRoom {
  id: string
  tour_id: string
  tour_name: string
  tour_date: string
  product_name?: string
  product_name_en?: string
  assigned_people?: number
  guide_name?: string
  assistant_name?: string
  vehicle_number?: string
  last_message?: {
    id: string
    message: string
    sender_name: string
    created_at: string
  }
  unread_count: number
}

interface TourChatMessage {
  id: string
  tour_id: string
  sender_email: string
  sender_name: string
  message: string
  message_type: 'text' | 'image' | 'file' | 'system'
  file_url?: string
  file_name?: string
  file_size?: number
  file_type?: string
  created_at: string
}

export default function GuideChatPage() {
  const { user, simulatedUser, isSimulating } = useAuth()
  const t = useTranslations('teamChat')
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'team' | 'tour'>('team')
  const [selectedRoom, setSelectedRoom] = useState<TeamChatRoom | TourChatRoom | null>(null)
  const [messages, setMessages] = useState<TeamChatMessage[] | TourChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [replyingTo, setReplyingTo] = useState<TeamChatMessage | TourChatMessage | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [newRoomData, setNewRoomData] = useState({
    room_name: '',
    room_type: 'general' as 'general' | 'department' | 'project' | 'announcement',
    description: '',
    participant_emails: [] as string[]
  })

  // URL 쿼리 파라미터에서 초기 탭 설정
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'team' || tab === 'tour') {
      setActiveTab(tab)
    }
  }, [searchParams])

  // 팀 채팅방 데이터 로딩
  const { data: teamChatRoomsData, loading: teamChatLoading, refetch: refetchTeamChatRooms } = useOptimizedData<TeamChatRoom[]>({
    fetchFn: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          console.error('세션이 없습니다')
          return []
        }

        const headers: Record<string, string> = {
          'Authorization': `Bearer ${session.access_token}`
        }
        
        if (isSimulating && simulatedUser?.email) {
          headers['x-simulated-user-email'] = simulatedUser.email
        }

        const response = await fetch('/api/team-chat/rooms', {
          headers
        })
        
        const result = await response.json()
        console.log('팀 채팅방 조회 응답:', result)

        if (result.error) {
          console.error('팀 채팅방 조회 오류:', result.error)
          return []
        }

        const rooms = (result.rooms || []) as TeamChatRoom[]
        if (!rooms || rooms.length === 0) {
          return []
        }

        const roomsWithStats = await Promise.all(
          rooms.map(async (room) => {
            try {
              const { data: { session } } = await supabase.auth.getSession()
              let lastMessage = null
              
              if (session?.access_token) {
                try {
                  const response = await fetch(`/api/team-chat/last-message?room_id=${room.id}`, {
                    headers: {
                      'Authorization': `Bearer ${session.access_token}`
                    }
                  })

                  if (response.ok) {
                    const result = await response.json()
                    lastMessage = result.lastMessage
                  }
                } catch (error) {
                  console.error(`채팅방 ${room.id} 마지막 메시지 조회 오류:`, error)
                }
              }

              const unreadCount = 0

              return {
                ...room,
                last_message: lastMessage,
                unread_count: unreadCount,
                participants_count: room.team_chat_participants?.[0]?.count || 0
              }
            } catch (error) {
              console.error(`채팅방 ${room.id} 통계 계산 오류:`, error)
              return {
                ...room,
                last_message: null,
                unread_count: 0,
                participants_count: room.team_chat_participants?.[0]?.count || 0
              }
            }
          })
        )

        return roomsWithStats
      } catch (error) {
        console.error('Team chat room data loading error:', error)
        throw error
      }
    },
    dependencies: [user?.email]
  })

  // 투어 채팅방 데이터 로딩
  const { data: tourChatRoomsData, loading: tourChatLoading, refetch: refetchTourChatRooms } = useOptimizedData<TourChatRoom[]>({
    fetchFn: async () => {
      try {
        const supabaseClient = createClientSupabase()
        const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email
        
        if (!currentUserEmail) return []

        // 최근 30일간의 투어 데이터 가져오기
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

        const { data: toursData, error } = await supabaseClient
          .from('tours')
          .select('*')
          .or(`tour_guide_id.eq.${currentUserEmail},assistant_id.eq.${currentUserEmail}`)
          .gte('tour_date', thirtyDaysAgoStr)
          .order('tour_date', { ascending: false })
          .limit(50)

        if (error) {
          console.error('Error loading tours:', error)
          return []
        }

        // 상품 정보 가져오기
        const productIds = [...new Set((toursData || []).map(tour => tour.product_id).filter(Boolean))]
        let productMap = new Map()
        let productEnMap = new Map()
        
        if (productIds.length > 0) {
          const { data: productsData } = await supabaseClient
            .from('products')
            .select('id, name_ko, name_en, name')
            .in('id', productIds)
          
          productMap = new Map((productsData || []).map(p => [p.id, p.name_ko || p.name_en || p.name]))
          productEnMap = new Map((productsData || []).map(p => [p.id, p.name_en || p.name_ko || p.name]))
        }

        // 팀원 정보 가져오기
        const guideEmails = [...new Set((toursData || []).map(tour => tour.tour_guide_id).filter(Boolean))]
        const assistantEmails = [...new Set((toursData || []).map(tour => tour.assistant_id).filter(Boolean))]
        const allEmails = [...new Set([...guideEmails, ...assistantEmails])]
        
        let teamMap = new Map()
        if (allEmails.length > 0) {
          const { data: teamData } = await supabaseClient
            .from('team')
            .select('email, name_ko')
            .in('email', allEmails)
          
          teamMap = new Map((teamData || []).map(member => [member.email, member.name_ko]))
        }

        // 차량 정보 가져오기
        const vehicleIds = [...new Set((toursData || []).map(tour => tour.tour_car_id).filter(Boolean))]
        
        let vehicleMap = new Map()
        if (vehicleIds.length > 0) {
          const { data: vehiclesData } = await supabaseClient
            .from('vehicles')
            .select('id, vehicle_number')
            .in('id', vehicleIds)
          
          vehicleMap = new Map((vehiclesData || []).map(vehicle => [vehicle.id, vehicle.vehicle_number]))
        }

        // 예약 정보로 인원 계산
        const reservationIds = [...new Set((toursData || []).flatMap(tour => {
          if (!tour.reservation_ids) return []
          return Array.isArray(tour.reservation_ids) 
            ? tour.reservation_ids 
            : String(tour.reservation_ids).split(',').map(id => id.trim()).filter(id => id)
        }))]

        let reservationMap = new Map()
        if (reservationIds.length > 0) {
          const { data: reservationsData } = await supabaseClient
            .from('reservations')
            .select('id, total_people')
            .in('id', reservationIds)
          
          reservationMap = new Map((reservationsData || []).map(r => [r.id, r.total_people || 0]))
        }

        // 투어 채팅방 데이터 생성
        const tourChatRooms: TourChatRoom[] = (toursData || []).map(tour => {
          let assignedPeople = 0
          if (tour.reservation_ids) {
            const ids = Array.isArray(tour.reservation_ids) 
              ? tour.reservation_ids 
              : String(tour.reservation_ids).split(',').map(id => id.trim()).filter(id => id)
            
            assignedPeople = ids.reduce((sum, id) => sum + (reservationMap.get(id) || 0), 0)
          }

          return {
            id: `tour_${tour.id}`,
            tour_id: tour.id,
            tour_name: tour.product_id ? productMap.get(tour.product_id) : `투어 ${tour.id}`,
            tour_date: tour.tour_date,
            product_name: tour.product_id ? productMap.get(tour.product_id) : null,
            product_name_en: tour.product_id ? productEnMap.get(tour.product_id) : null,
            assigned_people: assignedPeople,
            guide_name: tour.tour_guide_id ? teamMap.get(tour.tour_guide_id) : null,
            assistant_name: tour.assistant_id ? teamMap.get(tour.assistant_id) : null,
            vehicle_number: tour.tour_car_id ? vehicleMap.get(tour.tour_car_id) : null,
            last_message: null,
            unread_count: 0
          }
        })

        return tourChatRooms
      } catch (error) {
        console.error('Tour chat room data loading error:', error)
        throw error
      }
    },
    dependencies: [user?.email]
  })

  // 메시지 로딩
  const loadMessages = useCallback(async (roomId: string, roomType: 'team' | 'tour') => {
    if (!roomId) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('세션이 없습니다')
        return
      }

      if (roomType === 'team') {
        const response = await fetch(`/api/team-chat/messages?room_id=${roomId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        
        const result = await response.json()
        console.log('팀 메시지 조회 응답:', result)

        if (result.error) {
          console.error('Message loading error:', result.error)
          return
        }

        setMessages(result.messages || [])
      } else {
        // 투어 채팅 메시지 로딩 (실제 구현 필요)
        setMessages([])
      }
    } catch (error) {
      console.error('Exception occurred while loading messages:', error)
    }
  }, [])

  // 메시지 전송
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom || sending) return

    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('세션이 없습니다')
        setSending(false)
        return
      }

      if (activeTab === 'team' && 'room_id' in selectedRoom) {
        const messageData = {
          room_id: selectedRoom.room_id,
          message: newMessage.trim(),
          message_type: 'text',
          reply_to_id: replyingTo?.id || null
        }

        const response = await fetch('/api/team-chat/messages', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(messageData)
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('메시지 전송 HTTP 오류:', response.status, errorText)
          alert(`메시지 전송 실패: ${response.status} ${errorText}`)
          return
        }
        
        const result = await response.json()
        console.log('메시지 전송 응답:', result)

        if (result.error) {
          console.error('메시지 전송 오류:', result.error)
          alert(`메시지 전송 오류: ${result.error}`)
          return
        }
      } else if (activeTab === 'tour' && 'tour_id' in selectedRoom) {
        // 투어 채팅 메시지 전송 (실제 구현 필요)
        console.log('투어 채팅 메시지 전송:', newMessage.trim())
      }

      setNewMessage('')
      setReplyingTo(null)
      await loadMessages(selectedRoom.id, activeTab)
    } catch (error) {
      console.error('메시지 전송 오류:', error)
    } finally {
      setSending(false)
    }
  }

  // 채팅방 선택
  const selectRoom = async (room: TeamChatRoom | TourChatRoom) => {
    setSelectedRoom(room)
    await loadMessages(room.id, activeTab)
  }

  // 메시지 새로고침
  const refreshMessages = useCallback(async () => {
    if (!selectedRoom) return
    
    setRefreshing(true)
    try {
      await loadMessages(selectedRoom.id, activeTab)
    } finally {
      setRefreshing(false)
    }
  }, [selectedRoom, loadMessages, activeTab])

  // 채팅방 생성
  const createRoom = async () => {
    if (!newRoomData.room_name.trim()) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('세션이 없습니다')
        return
      }

      const response = await fetch('/api/team-chat/rooms', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(newRoomData)
      })
      
      const result = await response.json()
      console.log('채팅방 생성 응답:', result)

      if (result.error) {
        console.error('채팅방 생성 오류:', result.error)
        return
      }

      setShowCreateRoom(false)
      setNewRoomData({
        room_name: '',
        room_type: 'general',
        description: '',
        participant_emails: []
      })
      await refetchTeamChatRooms()
    } catch (error) {
      console.error('채팅방 생성 오류:', error)
    }
  }

  const teamChatRooms = teamChatRoomsData || []
  const tourChatRooms = tourChatRoomsData || []

  // 필터링된 채팅방 목록
  const filteredRooms = (activeTab === 'team' ? teamChatRooms : tourChatRooms).filter(room => {
    const matchesSearch = room.room_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (activeTab === 'tour' && 'tour_name' in room && room.tour_name?.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesType = filterType === 'all' || (activeTab === 'team' && 'room_type' in room && room.room_type === filterType)
    return matchesSearch && matchesType
  })

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    if (diffDays === 1) {
      return `어제 ${date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })}`
    }
    
    if (diffDays < 7) {
      return `${diffDays}일 전 ${date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })}`
    }
    
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateWithDay = (dateString: string) => {
    const date = new Date(dateString)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const dayName = days[date.getDay()]
    return `${dateString} (${dayName})`
  }

  const loading = activeTab === 'team' ? teamChatLoading : tourChatLoading

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[90vh]">
        <div className="text-gray-500">채팅을 불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="flex h-[90vh] bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* 왼쪽: 채팅방 목록 */}
      <div className={`${selectedRoom ? 'hidden lg:flex' : 'flex'} lg:w-80 w-full bg-white/80 backdrop-blur-sm border-r border-gray-200 flex-col shadow-lg`}>
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">채팅</h1>
              <p className="text-sm text-gray-500">팀 채팅과 투어 채팅</p>
            </div>
            {activeTab === 'team' && (
              <button
                onClick={() => setShowCreateRoom(true)}
                className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="새 채팅방 만들기"
              >
                <Plus size={16} />
              </button>
            )}
          </div>

          {/* 탭 */}
          <div className="flex space-x-1 mb-4 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => {
                setActiveTab('team')
                setSelectedRoom(null)
                setMessages([])
              }}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'team'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              팀 채팅
            </button>
            <button
              onClick={() => {
                setActiveTab('tour')
                setSelectedRoom(null)
                setMessages([])
              }}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'tour'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              투어 채팅
            </button>
          </div>
          
          {/* 검색 및 필터 */}
          <div className="space-y-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={activeTab === 'team' ? '채팅방 검색...' : '투어 검색...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {activeTab === 'team' && (
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">전체</option>
                <option value="general">일반</option>
                <option value="department">부서</option>
                <option value="project">프로젝트</option>
                <option value="announcement">공지</option>
              </select>
            )}
          </div>
        </div>

        {/* 채팅방 목록 */}
        <div className="flex-1 overflow-y-auto">
          {filteredRooms.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageCircle size={48} className="mx-auto mb-2 text-gray-300" />
              <p>{activeTab === 'team' ? '채팅방이 없습니다' : '투어가 없습니다'}</p>
            </div>
          ) : (
            filteredRooms.map((room) => (
              <div
                key={room.id}
                onClick={() => selectRoom(room)}
                className={`p-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedRoom?.id === room.id 
                    ? 'bg-blue-50 border-l-2 border-l-blue-500' 
                    : room.unread_count > 0 
                      ? 'bg-yellow-50 border-l-2 border-l-yellow-400' 
                      : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className={`text-xs truncate ${
                        room.unread_count > 0 
                          ? 'font-bold text-gray-900' 
                          : 'font-medium text-gray-900'
                      }`}>
                        {activeTab === 'team' && 'room_name' in room ? room.room_name : 
                         activeTab === 'tour' && 'tour_name' in room ? room.tour_name : room.id}
                        {room.unread_count > 0 && ' • 새 메시지'}
                        {activeTab === 'team' && 'room_type' in room && room.room_type === 'announcement' && (
                          <Pin size={10} className="inline ml-1 text-yellow-500" />
                        )}
                      </h3>
                      {activeTab === 'team' && 'room_type' in room && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          room.room_type === 'announcement' 
                            ? 'bg-yellow-100 text-yellow-800'
                            : room.room_type === 'department'
                            ? 'bg-blue-100 text-blue-800'
                            : room.room_type === 'project'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {room.room_type === 'general' ? '일반' :
                           room.room_type === 'department' ? '부서' :
                           room.room_type === 'project' ? '프로젝트' :
                           room.room_type === 'announcement' ? '공지' : room.room_type}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center">
                        <span className="truncate">
                          {activeTab === 'team' && 'description' in room ? 
                            (room.description || `참여자 ${'participants_count' in room ? room.participants_count : 0}명`) :
                            activeTab === 'tour' && 'tour_date' in room ? 
                            formatDateWithDay(room.tour_date) : ''}
                        </span>
                      </div>
                      {room.last_message && (
                        <span className="text-xs text-gray-400">
                          {formatTime(room.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    
                    {activeTab === 'tour' && 'assigned_people' in room && (
                      <div className="flex items-center space-x-2 text-xs text-gray-600 mt-1">
                        <span className="flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {room.assigned_people || 0}명
                        </span>
                        {room.guide_name && (
                          <span className="flex items-center">
                            <User className="w-3 h-3 mr-1" />
                            {room.guide_name}
                          </span>
                        )}
                        {room.vehicle_number && (
                          <span className="flex items-center">
                            <Car className="w-3 h-3 mr-1" />
                            {room.vehicle_number}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {room.last_message && (
                      <p className="text-xs text-gray-600 truncate mt-1">
                        <span className="font-medium">{room.last_message.sender_name}:</span>
                        {room.last_message.message}
                      </p>
                    )}
                  </div>
                  
                  {room.unread_count > 0 && (
                    <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium ml-2">
                      {room.unread_count}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 오른쪽: 채팅 영역 */}
      <div className={`${selectedRoom ? 'flex' : 'hidden lg:flex'} flex-1 flex-col`}>
        {selectedRoom ? (
          <>
            {/* 채팅방 헤더 */}
            <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2 lg:hidden">
                    <button
                      onClick={() => setSelectedRoom(null)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                      title="채팅방 목록으로"
                    >
                      ←
                    </button>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 truncate">
                    {activeTab === 'team' && 'room_name' in selectedRoom ? selectedRoom.room_name :
                     activeTab === 'tour' && 'tour_name' in selectedRoom ? selectedRoom.tour_name : selectedRoom.id}
                  </h2>
                  <p className="text-sm text-gray-500 truncate">
                    {activeTab === 'team' && 'description' in selectedRoom ? 
                      (selectedRoom.description || `참여자 ${'participants_count' in selectedRoom ? selectedRoom.participants_count : 0}명`) :
                      activeTab === 'tour' && 'tour_date' in selectedRoom ? 
                      formatDateWithDay(selectedRoom.tour_date) : ''}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={refreshMessages}
                    disabled={refreshing}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="메시지 새로고침"
                  >
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
            </div>

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto p-2 lg:p-4 space-y-3 lg:space-y-4 bg-gradient-to-b from-transparent to-green-50/30">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageCircle size={48} className="mx-auto mb-2 text-gray-300" />
                  <p>메시지가 없습니다</p>
                  <p className="text-sm">첫 번째 메시지를 보내보세요</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_email === user?.email ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`group max-w-xs lg:max-w-md px-3 lg:px-4 py-2 rounded-lg shadow-sm ${
                        message.sender_email === user?.email
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                          : message.message_type === 'system'
                          ? 'bg-gray-200/80 backdrop-blur-sm text-gray-700 text-center'
                          : 'bg-white/90 backdrop-blur-sm text-gray-900 border border-gray-200/50'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        <div className="flex-1">
                          {message.message_type !== 'system' && (
                            <div className="text-xs font-medium mb-1">
                              {message.sender_name}
                              {'sender_position' in message && message.sender_position && (
                                <span className="text-gray-500 ml-1">({message.sender_position})</span>
                              )}
                            </div>
                          )}
                          <div className="text-sm">{message.message}</div>
                          
                          <div className="flex items-center justify-between mt-1">
                            <div className="text-xs opacity-70">
                              {formatTime(message.created_at)}
                            </div>
                          </div>
                        </div>
                        {'is_pinned' in message && message.is_pinned && (
                          <Pin size={14} className="text-yellow-500 flex-shrink-0 mt-1" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
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
              <MessageCircle size={64} className="mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">채팅방을 선택하세요</h3>
              <p>{activeTab === 'team' ? '팀 채팅방을 선택하여 대화를 시작하세요' : '투어를 선택하여 채팅을 시작하세요'}</p>
            </div>
          </div>
        )}
      </div>

      {/* 채팅방 생성 모달 */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">새 채팅방 만들기</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  채팅방 이름
                </label>
                <input
                  type="text"
                  value={newRoomData.room_name}
                  onChange={(e) => setNewRoomData(prev => ({ ...prev, room_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="채팅방 이름을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  채팅방 유형
                </label>
                <select
                  value={newRoomData.room_type}
                  onChange={(e) => setNewRoomData(prev => ({ ...prev, room_type: e.target.value as 'general' | 'department' | 'project' | 'announcement' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="general">일반</option>
                  <option value="department">부서</option>
                  <option value="project">프로젝트</option>
                  <option value="announcement">공지</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <textarea
                  value={newRoomData.description}
                  onChange={(e) => setNewRoomData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="채팅방 설명을 입력하세요"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowCreateRoom(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={createRoom}
                disabled={!newRoomData.room_name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                만들기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
