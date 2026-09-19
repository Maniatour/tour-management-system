import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Participant } from '@/types/chat'
import {
  customerChatIdentityKey,
  upsertCustomerParticipant,
} from '@/lib/chatCustomerPresence'

function makeParticipant(
  id: string,
  name: string,
  type: Participant['type'],
  email?: string | null,
  online = true
): Participant {
  const participant: Participant = { id, name, type, lastSeen: new Date(), online }
  if (email) participant.email = email
  return participant
}

function presenceKey(presence: {
  userId?: string
  userName?: string
  userType?: string
}): string {
  if (presence.userType === 'customer' || (!presence.userType && presence.userName)) {
    const nameKey = customerChatIdentityKey(presence.userName || presence.userId)
    if (nameKey) return nameKey
  }
  return String(presence.userId || presence.userName || '').trim()
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
      const [{ data: customers, error: customerError }, { data: customerMessages, error: messageError }] =
        await Promise.all([
          supabase
            .from('chat_participants')
            .select('participant_id, participant_name, participant_type, is_active')
            .eq('room_id', roomIdParam)
            .eq('participant_type', 'customer'),
          supabase
            .from('chat_messages')
            .select('sender_name')
            .eq('room_id', roomIdParam)
            .eq('sender_type', 'customer')
            .limit(1000),
        ])

      if (customerError) {
        console.error('Error loading chat participants:', customerError)
      }
      if (messageError) {
        console.warn('Error loading customer chat names:', messageError)
      }

      setOnlineParticipants((prev) => {
        const updated = new Map(prev)

        const rememberCustomer = (name: string, id?: string) => {
          const key = customerChatIdentityKey(name)
          if (!key) return
          const existing = updated.get(key)
          upsertCustomerParticipant(updated, name, {
            ...(id ? { id } : {}),
            online: existing?.online === true,
          })
        }

        for (const row of customers || []) {
          rememberCustomer(row.participant_name || row.participant_id, row.participant_id)
        }

        for (const row of customerMessages || []) {
          rememberCustomer(row.sender_name || '')
        }

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

    const markPresence = (
      presence: {
        userId?: string
        userName?: string
        userType?: string
        userEmail?: string
      },
      online: boolean
    ) => {
      const key = presenceKey(presence)
      if (!key) return
      if (key === customerChatIdentityKey(userId) || key === userId) return
      setOnlineParticipants((prev) => {
        const updated = new Map(prev)
        const currentMessages = messagesRef.current
        const userMessage = currentMessages.find(
          (m: { sender_email?: string; sender_name?: string }) =>
            presence.userId === m.sender_email ||
            presence.userId === m.sender_name ||
            presence.userName === m.sender_name
        )
        const type: Participant['type'] =
          userMessage?.sender_type === 'system' || userMessage?.sender_type === 'admin'
            ? 'guide'
            : ((userMessage?.sender_type || presence.userType || 'guide') as Participant['type'])
        const name = userMessage?.sender_name || presence.userName || presence.userId || key
        if (type === 'customer') {
          upsertCustomerParticipant(updated, name, {
            id: presence.userId || name,
            online,
          })
        } else if (online) {
          updated.set(
            key,
            makeParticipant(
              presence.userId || key,
              name,
              'guide',
              userMessage?.sender_email || presence.userEmail,
              true
            )
          )
        } else {
          const existing = updated.get(key)
          if (existing) {
            updated.set(key, { ...existing, online: false })
          }
        }
        return updated
      })
    }

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const presentKeys = new Set<string>()

        setOnlineParticipants((prev) => {
          const updated = new Map(prev)
          Object.entries(state).forEach(([, presences]) => {
            if (!Array.isArray(presences) || presences.length === 0) return
            const presence = presences[0] as {
              userId?: string
              userName?: string
              userType?: string
              userEmail?: string
            }
            const key = presenceKey(presence)
            if (!key) return
            presentKeys.add(key)
            const isSelf = key === customerChatIdentityKey(userId) || key === userId
            if (isSelf) return
            const userMessage = messagesRef.current.find(
              (m: { sender_email?: string; sender_name?: string }) =>
                presence.userId === m.sender_email ||
                presence.userId === m.sender_name ||
                presence.userName === m.sender_name
            )
            const type: Participant['type'] =
              presence.userType === 'customer' || userMessage?.sender_type === 'customer'
                ? 'customer'
                : 'guide'
            const name = userMessage?.sender_name || presence.userName || presence.userId || key
            if (type === 'customer') {
              upsertCustomerParticipant(updated, name, {
                id: presence.userId || name,
                online: true,
              })
            } else {
              updated.set(
                key,
                makeParticipant(
                  presence.userId || key,
                  name,
                  'guide',
                  presence.userEmail,
                  true
                )
              )
            }
          })

          updated.forEach((value, key) => {
            if (value.online === true && !presentKeys.has(key) && key !== customerChatIdentityKey(userId) && key !== userId) {
              updated.set(key, { ...value, online: false })
            }
          })
          return updated
        })
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        if (Array.isArray(newPresences) && newPresences.length > 0) {
          markPresence(newPresences[0] as never, true)
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (Array.isArray(leftPresences) && leftPresences.length > 0) {
          markPresence(leftPresences[0] as never, false)
        }
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
            if (isPublicView) {
              upsertCustomerParticipant(updated, userName, {
                id: userId,
                online: true,
              })
            } else {
              updated.set(
                userId,
                makeParticipant(userId, userName, 'guide', guideEmail, true)
              )
            }
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
