'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Image as ImageIcon, File, Users, Copy, Share2, MessageCircle, Languages } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ChatRoomShareModal from './ChatRoomShareModal'
import { translateText, detectLanguage, SupportedLanguage } from '@/lib/translation'

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

interface TourChatRoomProps {
  tourId: string
  guideEmail: string
  isPublicView?: boolean
  roomCode?: string
  tourDate?: string
  customerName?: string
  customerLanguage?: SupportedLanguage
}

export default function TourChatRoom({ 
  tourId, 
  guideEmail, 
  isPublicView = false, 
  roomCode,
  tourDate,
  customerName,
  customerLanguage = 'en'
}: TourChatRoomProps) {
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [participantCount, setParticipantCount] = useState(0)
  const [showShareModal, setShowShareModal] = useState(false)
  const [translatedMessages, setTranslatedMessages] = useState<{ [key: string]: string }>({})
  const [translating, setTranslating] = useState<{ [key: string]: boolean }>({})
  const [announcements, setAnnouncements] = useState<ChatAnnouncement[]>([])
  const [showAnnouncements, setShowAnnouncements] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 사용자별 채팅 색상 팔레트
  const chatColors = [
    'bg-blue-100 text-blue-900 border-blue-200',
    'bg-green-100 text-green-900 border-green-200',
    'bg-purple-100 text-purple-900 border-purple-200',
    'bg-pink-100 text-pink-900 border-pink-200',
    'bg-yellow-100 text-yellow-900 border-yellow-200',
    'bg-indigo-100 text-indigo-900 border-indigo-200',
    'bg-red-100 text-red-900 border-red-200',
    'bg-teal-100 text-teal-900 border-teal-200',
    'bg-orange-100 text-orange-900 border-orange-200',
    'bg-cyan-100 text-cyan-900 border-cyan-200'
  ]

  // 사용자별 색상 할당 함수
  const getUserColor = (senderName: string) => {
    if (senderName === '가이드' || senderName === 'Guide') {
      return 'bg-blue-600 text-white border-blue-700'
    }
    
    // 고객 이름을 기반으로 일관된 색상 할당
    let hash = 0
    for (let i = 0; i < senderName.length; i++) {
      hash = senderName.charCodeAt(i) + ((hash << 5) - hash)
    }
    const colorIndex = Math.abs(hash) % chatColors.length
    return chatColors[colorIndex]
  }

  // 채팅방 로드 또는 생성
  useEffect(() => {
    if (isPublicView && roomCode) {
      loadRoomByCode(roomCode)
    } else {
      loadRoom()
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
        await loadAnnouncements(room.id)
      }
    } catch (error) {
      console.error('Error loading room by code:', error)
    } finally {
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

      const existingRoom = existingRooms?.[0]

      if (existingRoom) {
        setRoom(existingRoom)
        await loadMessages(existingRoom.id)
        await loadAnnouncements(existingRoom.id)
      } else {
        console.warn('Chat room not found. Please wait a moment after the tour is created.')
        setRoom(null)
      }
    } catch (error) {
      console.error('Error loading room:', error)
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

  const loadAnnouncements = async (roomId: string) => {
    try {
      // 채팅방별 공지사항 로드
      const { data: roomAnnouncements, error: roomError } = await supabase
        .from('chat_room_announcements')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (roomError) throw roomError

      // 투어별 공지사항 로드
      const { data: tourAnnouncements, error: tourError } = await supabase
        .from('tour_announcements')
        .select('*')
        .eq('tour_id', tourId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (tourError) throw tourError

      // 기본 공지사항 템플릿 로드
      const { data: templateAnnouncements, error: templateError } = await supabase
        .from('chat_announcement_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (templateError) throw templateError

      // 상품의 채팅 공지사항 로드
      const { data: productAnnouncements, error: productError } = await supabase
        .from('product_details')
        .select('chat_announcement')
        .eq('product_id', tourId)
        .not('chat_announcement', 'is', null)

      if (productError) throw productError

      // 상품 공지사항을 공지사항 형식으로 변환
      const productAnnouncementList = (productAnnouncements || [])
        .filter(p => p.chat_announcement)
        .map(p => ({
          id: `product_${tourId}`,
          title: '상품 공지사항',
          content: p.chat_announcement,
          language: customerLanguage,
          is_active: true,
          created_at: new Date().toISOString()
        }))

      // 모든 공지사항을 합치고 언어별로 필터링
      const allAnnouncements = [
        ...(roomAnnouncements || []),
        ...(tourAnnouncements || []),
        ...(templateAnnouncements || []),
        ...productAnnouncementList
      ]

      // 고객 언어에 맞는 공지사항만 필터링
      const filteredAnnouncements = allAnnouncements.filter(announcement => 
        announcement.language === customerLanguage || announcement.language === 'ko'
      )

      setAnnouncements(filteredAnnouncements)
    } catch (error) {
      console.error('Error loading announcements:', error)
    }
  }


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !room || sending) return

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
      const { data, error } = await supabase
        .from('chat_messages')
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
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempMessage.id ? data : msg
        )
      )
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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 메시지 번역 함수
  const translateMessage = async (messageId: string, messageText: string) => {
    if (translating[messageId]) return // 이미 번역 중이면 스킵
    
    setTranslating(prev => ({ ...prev, [messageId]: true }))
    
    try {
      const result = await translateText(messageText, customerLanguage)
      setTranslatedMessages(prev => ({
        ...prev,
        [messageId]: result.translatedText
      }))
    } catch (error) {
      console.error('Translation error:', error)
    } finally {
      setTranslating(prev => ({ ...prev, [messageId]: false }))
    }
  }

  // 메시지가 번역이 필요한지 확인
  const needsTranslation = (message: ChatMessage) => {
    if (isPublicView && message.sender_type === 'guide') {
      const messageLanguage = detectLanguage(message.message)
      return messageLanguage !== customerLanguage
    }
    return false
  }

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
    <div className="flex flex-col h-full max-h-screen">
      {/* 채팅방 헤더 (관리자 뷰에서만 표시) */}
      {!isPublicView && (
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
          </div>
        </div>
      )}

      {/* 공지사항 영역 */}
      {announcements.length > 0 && showAnnouncements && (
        <div className="bg-yellow-50 border-b border-yellow-200 p-4 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-yellow-800 flex items-center">
              <MessageCircle size={16} className="mr-2" />
              공지사항
            </h4>
            <button
              onClick={() => setShowAnnouncements(false)}
              className="text-yellow-600 hover:text-yellow-800 text-sm"
            >
              닫기
            </button>
          </div>
          <div className="space-y-2">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="bg-white rounded-lg p-3 border border-yellow-200"
              >
                <h5 className="text-sm font-medium text-gray-900 mb-1">
                  {announcement.title}
                </h5>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {announcement.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 공지사항 토글 버튼 (공지사항이 숨겨진 경우) */}
      {announcements.length > 0 && !showAnnouncements && (
        <div className="bg-yellow-50 border-b border-yellow-200 p-2 text-center">
          <button
            onClick={() => setShowAnnouncements(true)}
            className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
          >
            공지사항 보기 ({announcements.length}개)
          </button>
        </div>
      )}

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.map((message) => {
          const needsTrans = needsTranslation(message)
          const hasTranslation = translatedMessages[message.id]
          const isTranslating = translating[message.id]
          
          return (
            <div
              key={message.id}
              className={`flex ${message.sender_type === 'guide' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg border ${
                  message.sender_type === 'system'
                    ? 'bg-gray-200 text-gray-700 text-center'
                    : getUserColor(message.sender_name)
                }`}
              >
                {message.sender_type !== 'system' && (
                  <div className="text-xs font-medium mb-1">
                    {message.sender_name}
                  </div>
                )}
                
                {/* 원본 메시지 */}
                <div className="text-sm">{message.message}</div>
                
                {/* 번역된 메시지 (가이드 메시지이고 번역이 필요한 경우) */}
                {isPublicView && message.sender_type === 'guide' && needsTrans && (
                  <div className="mt-2 pt-2 border-t border-white/20">
                    {isTranslating ? (
                      <div className="text-xs opacity-70 flex items-center">
                        <Languages size={12} className="mr-1 animate-spin" />
                        Translating...
                      </div>
                    ) : hasTranslation ? (
                      <div className="text-xs opacity-90">
                        {hasTranslation}
                      </div>
                    ) : (
                      <button
                        onClick={() => translateMessage(message.id, message.message)}
                        className="text-xs opacity-70 hover:opacity-100 flex items-center"
                      >
                        <Languages size={12} className="mr-1" />
                        Translate
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
        <div ref={messagesEndRef} />
      </div>

      {/* 메시지 입력 */}
      {room.is_active && (
        <div className={`${isPublicView ? 'p-4' : 'p-4 border-t bg-gray-50'}`}>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Send size={16} />
              <span>{sending ? 'Sending...' : 'Send'}</span>
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
