import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Participant } from '@/types/chat'

function makeParticipant(
  id: string,
  name: string,
  type: Participant['type'],
  email?: string | null
): Participant {
  const participant: Participant = { id, name, type, lastSeen: new Date() }
  if (email) participant.email = email
  return participant
}

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
  messagesRef,
}: UseChatParticipantsProps) {
  const [onlineParticipants, setOnlineParticipants] = useState<Map<string, Participant>>(
    new Map()
  )
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

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

      setOnlineParticipants((prev) => {
        const updated = new Map<string, Participant>()

        participants.forEach((participant) => {
          if (participant.is_active === false) return
          const key = participant.participant_id
          const entry: Participant = {
            id: key,
            name: participant.participant_name || key,
            type: participant.participant_type === 'customer' ? 'customer' : 'guide',
            lastSeen: new Date(),
          }
          if (participant.participant_type === 'guide' && key) {
            entry.email = key
          }
          updated.set(key, entry)
        })

        prev.forEach((value, key) => {
          if (updated.has(key)) {
            const existing = updated.get(key)!
            updated.set(key, {
              ...existing,
              lastSeen: value.lastSeen,
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
    if (!roomId) {
      setOnlineParticipants(new Map())
      if (presenceChannelRef.current) {
        void supabase.removeChannel(presenceChannelRef.current)
        presenceChannelRef.current = null
      }
      return
    }

    void loadChatParticipants(roomId)

    const channel = supabase.channel(`chat_presence_${roomId}_${Date.now()}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    })
    presenceChannelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()

        setOnlineParticipants((prev) => {
          const updated = new Map(prev)
          const currentMessages = messagesRef.current

          Object.entries(state).forEach(([, presences]) => {
            if (Array.isArray(presences) && presences.length > 0) {
              const presence = presences[0] as {
                userId?: string
                userName?: string
                userType?: string
                userEmail?: string
              }
              const participantUserId = presence?.userId
              if (participantUserId && participantUserId !== userId) {
                const userMessage = currentMessages.find(
                  (m: { sender_email?: string; sender_name?: string }) =>
                    participantUserId === m.sender_email ||
                    participantUserId === m.sender_name
                )

                if (userMessage) {
                  updated.set(
                    participantUserId,
                    makeParticipant(
                      participantUserId,
                      userMessage.sender_name,
                      userMessage.sender_type === 'system' ||
                        userMessage.sender_type === 'admin'
                        ? 'guide'
                        : userMessage.sender_type,
                      userMessage.sender_email
                    )
                  )
                } else if (presence.userName) {
                  updated.set(
                    participantUserId,
                    makeParticipant(
                      participantUserId,
                      presence.userName || participantUserId,
                      (presence.userType as Participant['type']) || 'guide',
                      presence.userEmail
                    )
                  )
                }
              }
            }
          })

          return updated
        })
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        if (Array.isArray(newPresences) && newPresences.length > 0) {
          const presence = newPresences[0] as {
            userId?: string
            userName?: string
            userType?: string
            userEmail?: string
          }
          const participantUserId = presence?.userId
          if (participantUserId && participantUserId !== userId) {
            setOnlineParticipants((prev) => {
              const updated = new Map(prev)
              const currentMessages = messagesRef.current
              const userMessage = currentMessages.find(
                (m: { sender_email?: string; sender_name?: string }) =>
                  participantUserId === m.sender_email ||
                  participantUserId === m.sender_name
              )

              updated.set(
                participantUserId,
                makeParticipant(
                  participantUserId,
                  userMessage?.sender_name || presence.userName || participantUserId,
                  userMessage?.sender_type === 'system' ||
                    userMessage?.sender_type === 'admin'
                    ? 'guide'
                    : (userMessage?.sender_type || presence.userType || 'guide') as Participant['type'],
                  userMessage?.sender_email || presence.userEmail
                )
              )
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
            userId,
            userName,
            userType: isPublicView ? 'customer' : 'guide',
            ...(isPublicView || !guideEmail ? {} : { userEmail: guideEmail }),
            onlineAt: new Date().toISOString(),
          })
          setOnlineParticipants((prev) => {
            const updated = new Map(prev)
            updated.set(
              userId,
              makeParticipant(
                userId,
                userName,
                isPublicView ? 'customer' : 'guide',
                isPublicView ? null : guideEmail
              )
            )
            return updated
          })
        }
      })

    return () => {
      void supabase.removeChannel(channel)
      if (presenceChannelRef.current === channel) {
        presenceChannelRef.current = null
      }
    }
  }, [roomId, userId, userName, isPublicView, guideEmail, loadChatParticipants, messagesRef])

  return {
    onlineParticipants,
    setOnlineParticipants,
    loadChatParticipants,
  }
}
