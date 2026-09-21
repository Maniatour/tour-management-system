import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Participant } from '@/types/chat'
import {
  chatPresenceIdentityKey,
  chatPresenceSelfKeys,
  customerChatIdentityKey,
  guideChatIdentityKey,
  isChatPresenceSelfKey,
  isTourChatPresenceTopic,
  tourChatPresenceChannelName,
  upsertCustomerParticipant,
  type ChatPresencePayload,
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

function removeExistingPresenceChannels(roomId: string) {
  for (const existing of supabase.getChannels()) {
    if (isTourChatPresenceTopic(existing.topic, roomId)) {
      void supabase.removeChannel(existing)
    }
  }
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

    const selfArgs = { userId, userName, isPublicView, ...(guideEmail ? { guideEmail } : {}) }
    const selfKey = isPublicView
      ? customerChatIdentityKey(userName || userId)
      : guideChatIdentityKey(guideEmail || userId)
    const presenceKey = selfKey || userId
    const channelName = tourChatPresenceChannelName(roomId)

    removeExistingPresenceChannels(roomId)

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: presenceKey,
        },
      },
    })
    presenceChannelRef.current = channel

    const applySelfOnline = (online: boolean) => {
      setOnlineParticipants((prev) => {
        const updated = new Map(prev)
        if (isPublicView) {
          upsertCustomerParticipant(updated, userName, {
            id: userId,
            online,
          })
        } else if (selfKey) {
          updated.set(
            selfKey,
            makeParticipant(selfKey, userName, 'guide', guideEmail || userId, online)
          )
        }
        return updated
      })
    }

    const markPresence = (presence: ChatPresencePayload, online: boolean) => {
      const key = chatPresenceIdentityKey(presence)
      if (!key) return
      if (isChatPresenceSelfKey(key, selfArgs)) return
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
          presence.userType === 'customer' || userMessage?.sender_type === 'customer'
            ? 'customer'
            : 'guide'
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
              key,
              name,
              'guide',
              userMessage?.sender_email || presence.userEmail || presence.userId,
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

    const trackSelf = async () => {
      if (document.visibilityState === 'hidden') {
        await channel.untrack()
        applySelfOnline(false)
        return
      }
      await channel.track({
        userId: presenceKey,
        userName,
        userType: isPublicView ? 'customer' : 'guide',
        ...(isPublicView || !(guideEmail || userId)
          ? {}
          : { userEmail: guideEmail || userId }),
        onlineAt: new Date().toISOString(),
      })
      applySelfOnline(true)
    }

    const onVisibilityChange = () => {
      if (channel.state !== 'joined') return
      void trackSelf()
    }

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const selfOnline = document.visibilityState !== 'hidden'

        setOnlineParticipants((prev) => {
          const presentKeys = new Set<string>(chatPresenceSelfKeys(selfArgs))
          const updated = new Map(prev)
          Object.entries(state).forEach(([, presences]) => {
            if (!Array.isArray(presences) || presences.length === 0) return
            const presence = presences[0] as ChatPresencePayload
            const key = chatPresenceIdentityKey(presence)
            if (!key) return
            presentKeys.add(key)
            if (isChatPresenceSelfKey(key, selfArgs)) return
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
                  key,
                  name,
                  'guide',
                  presence.userEmail || presence.userId,
                  true
                )
              )
            }
          })

          if (isPublicView) {
            upsertCustomerParticipant(updated, userName, {
              id: userId,
              online: selfOnline,
            })
          } else if (selfKey) {
            updated.set(
              selfKey,
              makeParticipant(selfKey, userName, 'guide', guideEmail || userId, selfOnline)
            )
          }

          updated.forEach((value, key) => {
            if (
              value.online === true &&
              !presentKeys.has(key) &&
              !isChatPresenceSelfKey(key, selfArgs)
            ) {
              updated.set(key, { ...value, online: false })
            }
          })
          return updated
        })
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        if (!Array.isArray(newPresences)) return
        for (const presence of newPresences) {
          markPresence(presence as ChatPresencePayload, true)
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (!Array.isArray(leftPresences)) return
        for (const presence of leftPresences) {
          markPresence(presence as ChatPresencePayload, false)
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void trackSelf()
        }
      })

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
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
