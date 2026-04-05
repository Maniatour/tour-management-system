'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const ROOM_BATCH = 50

/**
 * 관리자 헤더용: 활성 투어 채팅방에서 고객이 보낸 미읽음 메시지 총합.
 * 채팅 관리 페이지의 unread_count 집계와 동일 (customer + is_read false + 활성 방만).
 */
export function useAdminTourChatUnreadCount(enabled: boolean): number {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0)
      return
    }
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) {
        setCount(0)
        return
      }

      const { data: rooms, error: roomsError } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('is_active', true)

      if (roomsError || !rooms?.length) {
        setCount(0)
        return
      }

      const ids = rooms.map((r) => r.id as string).filter(Boolean)
      let total = 0
      for (let i = 0; i < ids.length; i += ROOM_BATCH) {
        const batch = ids.slice(i, i + ROOM_BATCH)
        const { count: batchCount, error } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .in('room_id', batch)
          .eq('sender_type', 'customer')
          .eq('is_read', false)
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('[useAdminTourChatUnreadCount] 배치 조회:', error)
          }
          continue
        }
        total += batchCount ?? 0
      }
      setCount(total)
    } catch {
      setCount(0)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }

    void refresh()

    const channel = supabase
      .channel('admin-tour-chat-unread-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages' },
        () => {
          void refresh()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_rooms' },
        () => {
          void refresh()
        }
      )
      .subscribe()

    const interval = setInterval(() => {
      void refresh()
    }, 300_000)

    return () => {
      void supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [enabled, refresh])

  return count
}
