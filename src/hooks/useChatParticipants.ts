import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Participant } from '@/types/chat'

interface UseChatParticipantsProps {
  roomId: string | null
  isPublicView: boolean
  userId: string
  userName: string
  guideEmail?: string
  messagesRef: React.MutableRefObject<any[]>
}

export function useChatParticipants({
  roomId,
  isPublicView,
  userId,
  userName,
  guideEmail,
  messagesRef
}: UseChatParticipantsProps) {
  const [onlineParticipants, setOnlineParticipants] = useState<Map<string, Participant>>(new Map())
  const presenceChannelRef = useRef<any>(null)
  const roomIdRef = useRef<string | null>(null)
  const loadChatParticipantsRef = useRef<((roomId: string) => Promise<void>) | null>(null)

  const loadChatParticipants = useCallback(async (roomIdParam: string) => {
    try {
      const { data: participants, error } = await supabase
        .from('chat_participants')
        .select('participant_id, participant_name, participant_type, is_active')
        .eq('room_id', roomIdParam)
        .eq('is_active', true)

      if (error) {
        console.error('Error loading chat participants:', error)
        return
      }

      if (!participants || participants.length === 0) {
        return
      }

      setOnlineParticipants(prev => {
        const updated = new Map<string, Participant>()
        
        participants.forEach((participant: { participant_id: string; participant_name: string; participant_type: string; is_active: boolean }) => {
          const key = participant.participant_id
          updated.set(key, {
            id: key,
            name: participant.participant_name || key,
            type: participant.participant_type === 'customer' ? 'customer' : 'guide',
            email: participant.participant_type === 'guide' ? (key || undefined) : undefined,
            lastSeen: new Date()
          })
        })
        
        prev.forEach((value, key) => {
          if (updated.has(key)) {
            const existing = updated.get(key)!
            updated.set(key, {
              ...existing,
              lastSeen: value.lastSeen
            })
          } else {
            updated.set(key, value)
          }
        })
        
        return updated
      })
    } catch (error) {
      console.error('Error in loadChatParticipants:', error)
    }
  }, [])

  useEffect(() => {
    loadChatParticipantsRef.current = loadChatParticipants
  }, [loadChatParticipants])

  // Supabase Realtime Presence를 사용하여 채팅방 참여자 추적
  useEffect(() => {
    if (!roomId || isPublicView) {
      roomIdRef.current = null
      return
    }
    
    if (roomIdRef.current === roomId) {
      return
    }
    
    roomIdRef.current = roomId

    if (loadChatParticipantsRef.current) {
      loadChatParticipantsRef.current(roomId)
    }

    const channelName = `chat-presence-${roomId}`
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: userId,
        }
      }
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        
        setOnlineParticipants(prev => {
          const updated = new Map(prev)
          const currentMessages = messagesRef.current

          Object.entries(state).forEach(([key, presences]) => {
            if (Array.isArray(presences) && presences.length > 0) {
              const presence = presences[0] as any
              if (presence && presence.userId !== userId) {
                const userMessage = currentMessages.find((m: any) => 
                  (presence.userId === m.sender_email) || 
                  (presence.userId === m.sender_name)
                )
                
                if (userMessage) {
                  updated.set(presence.userId, {
                    id: presence.userId,
                    name: userMessage.sender_name,
                    type: userMessage.sender_type === 'system' ? 'guide' : userMessage.sender_type,
                    email: userMessage.sender_email || undefined,
                    lastSeen: new Date()
                  })
                } else if (presence.userName) {
                  updated.set(presence.userId, {
                    id: presence.userId,
                    name: presence.userName || presence.userId,
                    type: presence.userType || 'guide',
                    email: presence.userEmail || undefined,
                    lastSeen: new Date()
                  })
                }
              }
            }
          })

          return updated
        })
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (Array.isArray(newPresences) && newPresences.length > 0) {
          const presence = newPresences[0] as any
          if (presence && presence.userId !== userId) {
            setOnlineParticipants(prev => {
              const updated = new Map(prev)
              const currentMessages = messagesRef.current
              const userMessage = currentMessages.find((m: any) => 
                (presence.userId === m.sender_email) || 
                (presence.userId === m.sender_name)
              )
              
              updated.set(presence.userId, {
                id: presence.userId,
                name: userMessage?.sender_name || presence.userName || presence.userId,
                type: userMessage?.sender_type === 'system' ? 'guide' : (userMessage?.sender_type || presence.userType || 'guide'),
                email: userMessage?.sender_email || presence.userEmail || undefined,
                lastSeen: new Date()
              })
              return updated
            })
          }
        }
      })
      .on('presence', { event: 'leave' }, () => {
        // 참여자를 삭제하지 않고 유지
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: userId,
            userName: userName,
            userType: isPublicView ? 'customer' : 'guide',
            userEmail: isPublicView ? undefined : guideEmail,
            onlineAt: new Date().toISOString()
          })
        }
      })

    presenceChannelRef.current = channel

    return () => {
      if (presenceChannelRef.current) {
        presenceChannelRef.current.unsubscribe()
        presenceChannelRef.current = null
      }
    }
  }, [roomId, userId, userName, isPublicView, guideEmail])

  return {
    onlineParticipants,
    setOnlineParticipants,
    loadChatParticipants
  }
}

