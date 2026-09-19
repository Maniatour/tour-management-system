import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type TourChatGuideMember = {
  id: string
  email: string
  name: string
  position: string | null
  membership_source: 'assignment' | 'invited'
  assigned: boolean
  can_remove: boolean
}

export type TourChatInviteCandidate = {
  email: string
  name: string
  position: string | null
  is_guide_or_driver: boolean
  already_member: boolean
}

async function staffChatFetch(path: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('인증이 필요합니다.')
  }
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(path, { ...init, headers })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof json?.message === 'string' && json.message) ||
      (typeof json?.error === 'string' && json.error) ||
      '요청에 실패했습니다.'
    throw new Error(message)
  }
  return json
}

export function useTourChatGuideMembers(roomId: string | null, enabled: boolean) {
  const [members, setMembers] = useState<TourChatGuideMember[]>([])
  const [candidates, setCandidates] = useState<TourChatInviteCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [busyEmail, setBusyEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!roomId || !enabled) {
      setMembers([])
      setCandidates([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const json = await staffChatFetch(
        `/api/chat-rooms/participants?room_id=${encodeURIComponent(roomId)}`
      )
      setMembers(Array.isArray(json.participants) ? json.participants : [])
      setCandidates(Array.isArray(json.invite_candidates) ? json.invite_candidates : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '멤버를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [roomId, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  const invite = useCallback(
    async (email: string) => {
      if (!roomId) return
      setBusyEmail(email)
      setError(null)
      try {
        await staffChatFetch('/api/chat-rooms/participants', {
          method: 'POST',
          body: JSON.stringify({ room_id: roomId, action: 'invite', emails: [email] }),
        })
        await reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : '초대에 실패했습니다.')
        throw err
      } finally {
        setBusyEmail(null)
      }
    },
    [roomId, reload]
  )

  const remove = useCallback(
    async (email: string) => {
      if (!roomId) return
      setBusyEmail(email)
      setError(null)
      try {
        await staffChatFetch(
          `/api/chat-rooms/participants?room_id=${encodeURIComponent(roomId)}&email=${encodeURIComponent(email)}`,
          { method: 'DELETE' }
        )
        await reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : '내보내기에 실패했습니다.')
        throw err
      } finally {
        setBusyEmail(null)
      }
    },
    [roomId, reload]
  )

  const sync = useCallback(async () => {
    if (!roomId || !enabled) return
    await staffChatFetch('/api/chat-rooms/participants', {
      method: 'POST',
      body: JSON.stringify({ room_id: roomId, action: 'sync' }),
    })
    await reload()
  }, [roomId, enabled, reload])

  return { members, candidates, loading, busyEmail, error, reload, invite, remove, sync }
}
