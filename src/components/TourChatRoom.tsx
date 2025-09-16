'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Image as ImageIcon, File, Users, Copy, Share2, MessageCircle, Languages, Calendar, Gift, Megaphone } from 'lucide-react'
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

  const checkBanned = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_bans')
        .select('id, banned_until')
        .eq('room_id', roomId)
        .or(`client_id.eq.${clientId},customer_name.eq.${customerName || ''}`)
        .limit(1)
      if (error) return false
      if (!data || data.length === 0) return false
      const bannedUntil = data[0].banned_until ? new Date(data[0].banned_until) : null
      if (!bannedUntil) return true
      return bannedUntil.getTime() > Date.now()
    } catch {
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
        // soft-ban check on mount
        const banned = await checkBanned(room.id)
        if (banned) {
          setRoom({ ...room, is_active: false })
        }
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


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  const toggleRoomActive = async () => {
    if (!room || togglingActive) return
    try {
      setTogglingActive(true)
      const next = !room.is_active
      const { error } = await supabase
        .from('chat_rooms')
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
    <div className="flex flex-col h-full max-h-screen overflow-hidden">
      {/* 채팅방 헤더 (관리자 뷰에서만 표시) */}
      {(
        <div className="p-4 border-b bg-gray-50">
          {!isPublicView && (
            <div className="flex items-center space-x-3">
              <MessageCircle size={20} className="text-blue-600" />
              <h3 className="font-semibold text-gray-900 truncate">{room.room_name}</h3>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
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
              className="px-2.5 py-1.5 text-xs bg-amber-100 text-amber-800 rounded border border-amber-200 hover:bg-amber-200 flex items-center justify-center"
              title="공지사항"
              aria-label="공지사항"
            >
              <Megaphone size={14} />
            </button>
            <a
              href="#pickup-schedule"
              className="px-2.5 py-1.5 text-xs bg-blue-100 text-blue-800 rounded border border-blue-200 hover:bg-blue-200 flex items-center justify-center"
              title="픽업 스케쥴"
              aria-label="픽업 스케쥴"
            >
              <Calendar size={14} />
            </a>
            <a
              href="#options"
              className="px-2.5 py-1.5 text-xs bg-emerald-100 text-emerald-800 rounded border border-emerald-200 hover:bg-emerald-200 flex items-center justify-center"
              title="옵션 상품"
              aria-label="옵션 상품"
            >
              <Gift size={14} />
            </a>
            {isPublicView && (
              <a
                href="#tour-photos"
                className="px-2.5 py-1.5 text-xs bg-violet-100 text-violet-800 rounded border border-violet-200 hover:bg-violet-200 flex items-center justify-center"
                title="투어 사진"
                aria-label="투어 사진"
              >
                <ImageIcon size={14} />
              </a>
            )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={copyRoomLink}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
                title="링크 복사"
                aria-label="링크 복사"
              >
                <Copy size={16} />
              </button>
              <button
                onClick={shareRoomLink}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
                title="공유"
                aria-label="공유"
              >
                <Share2 size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공지사항 영역 */}
      {/* 공지사항 토글/박스 제거 */}

      {/* 공지사항 토글 버튼 (공지사항이 숨겨진 경우) */}
      {/* 공지사항 토글 제거 */}

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
        <div className={`${isPublicView ? 'p-4' : 'p-4 border-t bg-gray-50'} flex-shrink-0`}>
          <div className="flex items-center space-x-2 w-full">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Send size={16} />
              <span className="hidden sm:inline">{sending ? 'Sending...' : 'Send'}</span>
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
          language={customerLanguage}
        />
      )}

      {/* 공지사항 모달 */}
      {!isPublicView && (
        <div className={`${isAnnouncementsOpen ? 'fixed' : 'hidden'} inset-0 bg-black/50 z-50 flex items-center justify-center p-4`}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h4 className="text-lg font-semibold text-gray-900">공지사항</h4>
              <button onClick={() => setIsAnnouncementsOpen(false)} className="px-2 py-1 rounded hover:bg-gray-100">닫기</button>
            </div>
            <div className="p-4 space-y-3">
              {announcements.length === 0 ? (
                <div className="text-sm text-gray-500">등록된 공지사항이 없습니다.</div>
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
              <button onClick={() => setIsAnnouncementsOpen(false)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
