'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Image as ImageIcon, File, Users, Copy, Share2, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ChatRoomShareModal from './ChatRoomShareModal'

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

interface TourChatRoomProps {
  tourId: string
  guideEmail: string
  isPublicView?: boolean
  roomCode?: string
  tourDate?: string
}

export default function TourChatRoom({ 
  tourId, 
  guideEmail, 
  isPublicView = false, 
  roomCode,
  tourDate
}: TourChatRoomProps) {
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [participantCount, setParticipantCount] = useState(0)
  const [showShareModal, setShowShareModal] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 채팅방 로드 또는 생성
  useEffect(() => {
    if (isPublicView && roomCode) {
      loadRoomByCode(roomCode)
    } else {
      loadOrCreateRoom()
    }
  }, [tourId, isPublicView, roomCode])

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
        (payload) => {
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

  const loadRoomByCode = async (code: string) => {
    try {
      const { data: rooms, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('room_code', code)
        .eq('is_active', true)
        .limit(1)

      if (error) throw error
      
      const room = rooms?.[0]
      setRoom(room)
      if (room) {
        await loadMessages(room.id)
      }
    } catch (error) {
      console.error('Error loading room by code:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadOrCreateRoom = async () => {
    try {
      // 기존 채팅방 찾기
      const { data: existingRooms, error: findError } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('tour_id', tourId)
        .eq('is_active', true)
        .limit(1)

      const existingRoom = existingRooms?.[0]

      if (existingRoom) {
        setRoom(existingRoom)
        await loadMessages(existingRoom.id)
      } else {
        // 새 채팅방 생성
        const roomCode = generateRoomCode()
        const { data: newRoom, error: createError } = await supabase
          .from('chat_rooms')
          .insert({
            tour_id: tourId,
            room_name: `투어 채팅방`,
            room_code: roomCode,
            description: '투어 관련 소통을 위한 채팅방입니다.',
            created_by: guideEmail
          })
          .select()
          .single()

        if (createError) throw createError
        setRoom(newRoom)
      }
    } catch (error) {
      console.error('Error loading or creating room:', error)
    } finally {
      setLoading(false)
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

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !room || sending) return

    setSending(true)
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: room.id,
          sender_type: isPublicView ? 'customer' : 'guide',
          sender_name: isPublicView ? '고객' : '가이드',
          sender_email: isPublicView ? undefined : guideEmail,
          message: newMessage.trim(),
          message_type: 'text'
        })

      if (error) throw error
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      alert('메시지 전송 중 오류가 발생했습니다.')
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
    alert('채팅방 링크가 클립보드에 복사되었습니다.')
  }

  const shareRoomLink = () => {
    if (!room) return
    setShowShareModal(true)
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">채팅방을 불러오는 중...</div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">채팅방을 찾을 수 없습니다.</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-96 bg-white rounded-lg border">
      {/* 채팅방 헤더 */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-3">
          <MessageCircle size={20} className="text-blue-600" />
          <div>
            <h3 className="font-semibold text-gray-900">{room.room_name}</h3>
            <p className="text-sm text-gray-500">{room.description}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center text-sm text-gray-500">
            <Users size={16} className="mr-1" />
            {participantCount}명
          </div>
          {!isPublicView && (
            <>
              <button
                onClick={copyRoomLink}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
                title="링크 복사"
              >
                <Copy size={16} />
              </button>
              <button
                onClick={shareRoomLink}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
                title="공유"
              >
                <Share2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender_type === 'guide' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.sender_type === 'guide'
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
        <div ref={messagesEndRef} />
      </div>

      {/* 메시지 입력 */}
      {room.is_active && (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="메시지를 입력하세요..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Send size={16} />
              <span>{sending ? '전송 중...' : '전송'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 공유 모달 */}
      {!isPublicView && room && (
        <ChatRoomShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          roomCode={room.room_code}
          roomName={room.room_name}
          tourDate={tourDate}
        />
      )}
    </div>
  )
}
