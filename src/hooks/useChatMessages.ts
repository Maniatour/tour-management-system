import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ChatMessage } from '@/types/chat'

const PUBLIC_CHAT_POLL_MS = 4000

interface UseChatMessagesProps {
  roomId: string | null
  /** 공개(anon) 뷰: 메시지는 room_code RPC로만 조회 */
  roomCode?: string | undefined
  isPublicView: boolean
  customerName?: string | undefined
  guideEmail?: string | undefined
}

export function useChatMessages({
  roomId,
  roomCode,
  isPublicView,
  customerName,
  guideEmail
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

  const scrollToBottom = useCallback((instant = false) => {
    if (instant) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  const loadMessages = useCallback(
    async (roomIdParam: string, options?: { publicPoll?: boolean }) => {
      try {
        if (isPublicView && roomCode) {
          const { data, error } = await supabase.rpc('get_chat_messages_by_room_code', {
            p_room_code: roomCode,
            p_limit: 200
          })
          if (error) throw error
          const rows = (data || []) as ChatMessage[]
          const sortedMessages = [...rows].reverse()

          if (options?.publicPoll) {
            setMessages(prev => {
              const idSet = new Set(prev.map(m => m.id))
              const additions = sortedMessages.filter(m => !idSet.has(m.id))
              if (additions.length === 0) return prev
              const merged = [...prev, ...additions].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )
              const next = merged.length > 500 ? merged.slice(-500) : merged
              queueMicrotask(() => scrollToBottom())
              return next
            })
            return
          }

          setMessages(sortedMessages)
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
          }, 50)
          return
        }

        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('room_id', roomIdParam)
          .order('created_at', { ascending: false })
          .limit(200)

        if (error) throw error
        const sortedMessages = (data || []).reverse()
        setMessages(sortedMessages)
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
        }, 50)
      } catch (error) {
        console.error('Error loading messages:', error)
      }
    },
    [isPublicView, roomCode, scrollToBottom]
  )

  const loadMessagesRef = useRef(loadMessages)
  useEffect(() => {
    loadMessagesRef.current = loadMessages
  }, [loadMessages])

  const loadedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (isPublicView && roomCode) {
      const key = `pub:${roomCode}`
      if (loadedKeyRef.current === key) {
        return
      }
      loadedKeyRef.current = key
      void loadMessagesRef.current(roomId || '')
      return
    }

    if (!roomId) {
      loadedKeyRef.current = null
      setMessages([])
      return
    }

    const key = `id:${roomId}`
    if (loadedKeyRef.current === key) {
      return
    }

    loadedKeyRef.current = key
    void loadMessagesRef.current(roomId)
  }, [roomId, isPublicView, roomCode])

  useEffect(() => {
    if (!isPublicView || !roomCode) {
      return
    }
    const id = window.setInterval(() => {
      void loadMessagesRef.current(roomId || '', { publicPoll: true })
    }, PUBLIC_CHAT_POLL_MS)
    return () => window.clearInterval(id)
  }, [isPublicView, roomCode, roomId])

  const messageChannelRoomIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (isPublicView && roomCode) {
      messageChannelRoomIdRef.current = null
      return
    }

    if (!roomId) {
      messageChannelRoomIdRef.current = null
      return
    }

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
        (payload: { new: Record<string, unknown> }) => {
          const newMessage = payload.new as ChatMessage

          if (isPublicView) {
            if (
              newMessage.sender_type === 'customer' &&
              newMessage.sender_name === (customerNameRef.current || '고객')
            ) {
              return
            }
          } else {
            if (newMessage.sender_type === 'guide' && newMessage.sender_email === guideEmailRef.current) {
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
              return updated
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .slice(-500)
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
  }, [roomId, isPublicView, roomCode, scrollToBottom])

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
