'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import {
  flushPendingNarrationPlays,
  prefetchAssignedToursForNarrationLog,
  recordNarrationPlayback,
} from '@/lib/tourNarrationPlays'

export default function GuideNarrationPlayLogger() {
  const { user, isSimulating } = useAuth()
  const { currentTrack, isPlaying } = useAudioPlayer()
  const sessionRef = useRef<{
    materialId: string
    title: string
    filePath: string
    startedAt: number
  } | null>(null)

  const email = isSimulating ? null : user?.email || null

  useEffect(() => {
    if (!email) return
    void prefetchAssignedToursForNarrationLog(email)
    void flushPendingNarrationPlays(email)
    const onOnline = () => {
      void prefetchAssignedToursForNarrationLog(email)
      void flushPendingNarrationPlays(email)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [email])

  useEffect(() => {
    if (!email) return

    const flushSession = (newSession: boolean, playSeconds: number) => {
      const session = sessionRef.current
      if (!session) return
      void recordNarrationPlayback({
        email,
        materialId: session.materialId,
        materialTitle: session.title,
        filePath: session.filePath,
        playSeconds,
        newSession,
      })
    }

    if (isPlaying && currentTrack?.id) {
      const same = sessionRef.current?.materialId === currentTrack.id
      if (!same) {
        if (sessionRef.current) {
          const elapsed = Math.max(0, Math.round((Date.now() - sessionRef.current.startedAt) / 1000))
          flushSession(false, elapsed)
        }
        sessionRef.current = {
          materialId: currentTrack.id,
          title: currentTrack.title,
          filePath: currentTrack.filePath || '',
          startedAt: Date.now(),
        }
        flushSession(true, 0)
      }
      return
    }

    if (sessionRef.current) {
      const elapsed = Math.max(0, Math.round((Date.now() - sessionRef.current.startedAt) / 1000))
      flushSession(false, elapsed)
      sessionRef.current = null
    }
  }, [currentTrack, email, isPlaying])

  useEffect(() => {
    return () => {
      const session = sessionRef.current
      const em = email
      if (!session || !em) return
      const elapsed = Math.max(0, Math.round((Date.now() - session.startedAt) / 1000))
      void recordNarrationPlayback({
        email: em,
        materialId: session.materialId,
        materialTitle: session.title,
        filePath: session.filePath,
        playSeconds: elapsed,
        newSession: false,
      })
    }
  }, [email])

  return null
}
