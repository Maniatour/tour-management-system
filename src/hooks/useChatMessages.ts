import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ChatMessage } from '@/types/chat'

interface UseChatMessagesProps {
  roomId: string | null
  isPublicView: boolean
  customerName?: string | undefined
  guideEmail?: string | undefined
  selectedLanguage: 'ko' | 'en'
}

export function useChatMessages({
  roomId,
  isPublicView,
  customerName,
  guideEmail,
  selectedLanguage
}: UseChatMessagesProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const messagesRef = useRef<ChatMessage[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const guideEmailRef = useRef<string | undefined>(guideEmail)
  const customerNameRef = useRef<string | undefined>(customerName)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    guideEmailRef.current = guideEmail
  }, [guideEmail])

  useEffect(() => {
    customerNameRef.current = customerName
  }, [customerName])

  const loadMessages = useCallback(async (roomIdParam: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomIdParam)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      const sortedMessages = (data || []).reverse()
      setMessages(sortedMessages)
      // 메시지 로드 후 스크롤을 맨 아래로 이동
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
      }, 50)
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }, [])

  const scrollToBottom = useCallback((instant = false) => {
    if (instant) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  // loadMessages를 ref로 저장하여 의존성 배열에서 제거
  const loadMessagesRef = useRef(loadMessages)
  useEffect(() => {
    loadMessagesRef.current = loadMessages
  }, [loadMessages])

  // roomId가 변경될 때 메시지 로드
  const loadedRoomIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!roomId) {
      loadedRoomIdRef.current = null
      setMessages([])
      return
    }
    
    // 이미 같은 room의 메시지를 로드했는지 확인
    if (loadedRoomIdRef.current === roomId) {
      return
    }
    
    loadedRoomIdRef.current = roomId
    loadMessagesRef.current(roomId)
  }, [roomId])

  // 실시간 메시지 구독
  const messageChannelRoomIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!roomId) {
      messageChannelRoomIdRef.current = null
      return
    }
    
    // room.id가 실제로 변경되었는지 확인
    if (messageChannelRoomIdRef.current === roomId) {
      return
    }
    
    messageChannelRoomIdRef.current = roomId

    const channel = supabase
      .channel(`chat_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload: { new: any }) => {
          const newMessage = payload.new as ChatMessage
          
          // 자신이 보낸 메시지는 Realtime 구독에서 무시
          if (isPublicView) {
            if (newMessage.sender_type === 'customer' && 
                newMessage.sender_name === (customerNameRef.current || '고객')) {
              return
            }
          } else {
            if (newMessage.sender_type === 'guide' && 
                newMessage.sender_email === guideEmailRef.current) {
              return
            }
          }
          
          setMessages(prev => {
            const exists = prev.some(m => m.id === newMessage.id)
            if (exists) {
              return prev
            }
            const updated = [...prev, newMessage]
            if (updated.length > 500) {
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
  }, [roomId, isPublicView, scrollToBottom])

  return {
    messages,
    setMessages,
    sending,
    setSending,
    loadMessages,
    scrollToBottom,
    messagesEndRef,
    messagesRef
  }
}

