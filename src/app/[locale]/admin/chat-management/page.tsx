'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageCircle, Calendar, Search, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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
  product?: {
    name_ko?: string
    name_en?: string
    name?: string
    description?: string
  }
  reservations?: Array<{
    id: string
    customer_name: string
    customer_email: string
    customer_phone?: string
    adult_count: number
    child_count: number
    total_price: number
    reservation_status: string
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
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [tourInfo, setTourInfo] = useState<TourInfo | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // 새로고침 함수
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchChatRooms()
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
  const fetchChatRooms = useCallback(async () => {
    try {
      // 먼저 기본 채팅방 정보만 가져오기
      const { data: chatRoomsData, error: chatRoomsError } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (chatRoomsError) throw chatRoomsError

      if (!chatRoomsData || chatRoomsData.length === 0) {
        setChatRooms([])
        return
      }

      // 각 채팅방에 대해 투어 정보를 별도로 가져오기
      const roomsWithTour = await Promise.all(
        chatRoomsData.map(async (room: any) => {
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
                tour: null,
                unread_count: 0
              }
            }

            return {
              ...room,
              tour: tourData,
              unread_count: 0
            }
          } catch (error) {
            console.warn(`Error processing room ${room.id}:`, error)
            return {
              ...room,
              tour: null,
              unread_count: 0
            }
          }
        })
      )

      // 이제 읽지 않은 메시지 수 계산
      const roomsWithUnreadCount = await Promise.all(
        roomsWithTour.map(async (room: any) => {
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

      setChatRooms(roomsWithUnreadCount)
    } catch (error: any) {
      console.error('Error fetching chat rooms:', error)
      console.error('Error details:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      })
      setChatRooms([]) // 오류 시 빈 배열로 설정
    } finally {
      setLoading(false)
    }
  }, [])

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

  // 투어 정보 가져오기
  const fetchTourInfo = useCallback(async (tourId: string) => {
    try {
      // 투어 기본 정보만 가져오기
      const { data: tourData, error: tourError } = await supabase
        .from('tours')
        .select(`
          *,
          product:products(
            name,
            description
          )
        `)
        .eq('id', tourId)
        .single()

      if (tourError) throw tourError

      // 차량 정보 별도로 가져오기
      let vehicleData = null
      if (tourData.tour_car_id) {
        const { data: vehicle, error: vehicleError } = await supabase
          .from('vehicles')
          .select(`
            id,
            vehicle_number,
            vehicle_category,
            driver_name,
            driver_phone
          `)
          .eq('id', tourData.tour_car_id)
          .single()

        if (!vehicleError) {
          vehicleData = vehicle
        }
      }

      // 예약 정보 별도로 가져오기
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select(`
          id,
          customer_name,
          customer_email,
          customer_phone,
          adult_count,
          child_count,
          total_price,
          reservation_status
        `)
        .eq('tour_id', tourId)

      if (reservationsError) {
        console.warn('Error fetching reservations:', reservationsError)
      }

      // 데이터 결합
      const combinedData = {
        ...tourData,
        vehicle: vehicleData,
        reservations: reservationsData || []
      }

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
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: selectedRoom.id,
          sender_type: 'admin',
          sender_name: '관리자',
          sender_email: 'admin@kovegas.com',
          message: messageText,
          message_type: 'text'
        } as any)
        .select()
        .single()

      if (error) throw error
      
      // 실제 메시지로 교체
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempMessage.id ? data : msg
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
      await supabase
        .from('chat_messages')
        .update({ is_read: true } as any)
        .eq('room_id', room.id)
        .eq('sender_type', 'customer')
        .eq('is_read', false)
      
      // 채팅방 목록 업데이트
      setChatRooms(prev => 
        prev.map(r => 
          r.id === room.id ? { ...r, unread_count: 0 } : r
        )
      )
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }

  // 필터링된 채팅방 목록
  const filteredRooms = chatRooms.filter(room => {
    const matchesSearch = room.room_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.tour?.product?.name_ko?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.tour?.product?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (filterStatus === 'all') return matchesSearch
    // 투어 상태 필터링은 일단 제거 (status 컬럼이 없음)
    
    return matchesSearch
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

  useEffect(() => {
    fetchChatRooms().finally(() => setLoading(false))
  }, [fetchChatRooms])

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">채팅방을 불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 왼쪽: 채팅방 목록 */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-gray-900">채팅 관리</h1>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                읽지않은 메시지 ({chatRooms.reduce((sum, room) => sum + room.unread_count, 0)})
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                <span>{refreshing ? '새로고침 중...' : '새로고침'}</span>
              </button>
            </div>
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
          {filteredRooms.map((room) => (
            <div
              key={room.id}
              onClick={() => selectRoom(room)}
              className={`p-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                selectedRoom?.id === room.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  {/* 상품 이름 */}
                  <h3 className="font-medium text-gray-900 text-xs truncate mb-0.5">
                    {room.tour?.product?.name_ko || room.tour?.product?.name || room.room_name}
                  </h3>
                  
                  {/* 투어 날짜와 방 코드를 한 줄에 */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center">
                      <Calendar size={10} className="mr-1" />
                      <span className="truncate">
                        {room.tour?.tour_date ? new Date(room.tour.tour_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '날짜미정'}
                      </span>
                    </div>
                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                      {room.room_code}
                    </span>
                  </div>
                </div>
                
                {/* 읽지 않은 메시지 수 */}
                {room.unread_count > 0 && (
                  <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium ml-2">
                    {room.unread_count}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 가운데: 채팅창 */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            {/* 채팅 헤더 */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedRoom.tour?.product?.name_ko || selectedRoom.tour?.product?.name || selectedRoom.room_name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedRoom.tour?.tour_date ? formatDate(selectedRoom.tour.tour_date) : '날짜 미정'}
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  방 코드: {selectedRoom.room_code}
                </div>
              </div>
            </div>

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender_type === 'admin'
                        ? 'bg-blue-600 text-white'
                        : message.sender_type === 'system'
                        ? 'bg-gray-200 text-gray-700 text-center'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {message.sender_type !== 'system' && (
                      <div className="text-xs font-medium mb-1">
                        {message.sender_name}
                      </div>
                    )}
                    <div className="text-sm">{message.message}</div>
                    <div className="text-xs mt-1 opacity-70">
                      {formatTime(message.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 메시지 입력 */}
            <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
              <div className="flex items-center space-x-2 w-full">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={sending}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? '전송 중...' : '전송'}
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

      {/* 오른쪽: 투어 정보 */}
      <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
        {tourInfo ? (
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">투어 정보</h3>
            
            {/* 투어 기본 정보 */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">상품</label>
                <p className="text-sm text-gray-900">{tourInfo.product?.name_ko || tourInfo.product?.name}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">날짜</label>
                <p className="text-sm text-gray-900">
                  {formatDate(tourInfo.tour_date)}
                  <span className="text-gray-500 ml-1">* 시간 미정</span>
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">인원</label>
                <p className="text-sm text-gray-900">
                  성인 {tourInfo.reservations?.reduce((sum, r) => sum + r.adult_count, 0) || 0}명
                </p>
                <p className="text-sm text-gray-500">
                  총 {tourInfo.reservations?.length || 0}명
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">픽업장소</label>
                <p className="text-sm text-gray-900">Bellagio Hotel</p>
                <button className="text-xs text-blue-600 hover:underline">지도보기</button>
              </div>
            </div>

            {/* 고객 정보 */}
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">고객정보</h4>
              {tourInfo.reservations?.map((reservation) => (
                <div key={reservation.id} className="mb-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">{reservation.customer_name}</p>
                  <p className="text-xs text-gray-500">{reservation.customer_email}</p>
                  {reservation.customer_phone && (
                    <p className="text-xs text-gray-500">{reservation.customer_phone}</p>
                  )}
                </div>
              ))}
            </div>

            {/* 비용 정보 */}
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">비용</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">결제방법</span>
                  <span className="text-gray-900">전액 결제</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">총 비용</span>
                  <span className="text-gray-900">
                    US $350.00 (486,013원)
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">수익</span>
                  <span className="text-gray-900">
                    US $289.10 (400,781원)
                  </span>
                </div>
              </div>
            </div>

            {/* 모객현황 */}
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">모객현황</h4>
              <p className="text-sm text-gray-500">마지막 업데이트 없음</p>
              
              {/* 캘린더 */}
              <div className="mt-4">
                <div className="text-sm font-medium text-gray-700 mb-2">9월 2025</div>
                <div className="grid grid-cols-7 gap-1 text-xs">
                  {Array.from({ length: 30 }, (_, i) => i + 1).map(day => (
                    <div
                      key={day}
                      className={`p-2 text-center rounded ${
                        day === 1 ? 'bg-blue-100 text-blue-900 font-medium' : 'text-gray-600'
                      }`}
                    >
                      {day}
                    </div>
                  ))}
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
