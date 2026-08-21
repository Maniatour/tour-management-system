import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  mergePolledChatMessages,
  upsertIncomingChatMessage
} from '@/lib/chatMessageMerge'
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
  isPublicView
}: UseChatMessagesProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const messagesRef = useRef<ChatMessage[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const scrollToBottom = useCallback((instant = false) => {
    const container = messagesScrollRef.current
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: instant ? 'auto' : 'smooth',
      })
      return
    }
    messagesEndRef.current?.scrollIntoView({
      behavior: instant ? 'auto' : 'smooth',
      block: 'nearest',
    })
  }, [])

  const scrollToBottomRef = useRef(scrollToBottom)
  useEffect(() => {
    scrollToBottomRef.current = scrollToBottom
  }, [scrollToBottom])

  const loadMessages = useCallback(
    async (roomIdParam: string, options?: { publicPoll?: boolean }) => {
      try {
        if (isPublicView && roomCode) {
          const { data, error } = await supabase.rpc('get_chat_messages_by_room_code', {
            p_room_code: roomCode,
            p_limit: 200
          })
          if (error) throw error
          const rows = (data || []) as unknown as ChatMessage[]
          const sortedMessages = [...rows].reverse()

          if (options?.publicPoll) {
            setMessages(prev => {
              const merged = mergePolledChatMessages(prev, sortedMessages)
              if (merged === prev) return prev
              const sorted = [...merged].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )
              const next = sorted.length > 500 ? sorted.slice(-500) : sorted
              queueMicrotask(() => scrollToBottom())
              return next
            })
            return
          }

          setMessages(sortedMessages)
          setTimeout(() => {
            scrollToBottom(true)
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
        const sortedMessages = ((data || []).reverse()) as unknown as ChatMessage[]
        setMessages(sortedMessages)
        setTimeout(() => {
          scrollToBottom(true)
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

  const messageChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if ((isPublicView && roomCode) || !roomId) {
      if (messageChannelRef.current) {
        void supabase.removeChannel(messageChannelRef.current)
        messageChannelRef.current = null
      }
      return
    }

    const channel = supabase.channel(`chat_messages_hook_${roomId}_${Date.now()}`)
    messageChannelRef.current = channel

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const newMessage = payload.new as unknown as ChatMessage

          setMessages((prev) => {
            const next = upsertIncomingChatMessage(prev, newMessage)
            if (next === prev) return prev
            queueMicrotask(() => scrollToBottomRef.current())
            if (next.length > 500) {
              return next
                .sort(
                  (a, b) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                )
                .slice(-500)
            }
            return next
          })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
      if (messageChannelRef.current === channel) {
        messageChannelRef.current = null
      }
    }
  }, [roomId, isPublicView, roomCode])

  return {
    messages,
    setMessages,
    sending,
    setSending,
    loadMessages,
    scrollToBottom,
    messagesEndRef,
    messagesScrollRef,
    messagesRef
  }
}
