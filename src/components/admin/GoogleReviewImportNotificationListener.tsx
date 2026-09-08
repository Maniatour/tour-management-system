'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  GOOGLE_REVIEW_IMPORT_NOTIFY_TABLE,
  mapGoogleReviewImportNotifyRow,
  type GoogleReviewImportNotifyRow,
} from '@/lib/googleReviewImportNotify'
import GoogleReviewImportClassifyModal from '@/components/admin/google-reviews/GoogleReviewImportClassifyModal'

const SESSION_KEY = 'tms-google-review-import-notify-session'
const FOREVER_KEY = 'tms-google-review-import-notify-seen'
const POLL_MS = 30_000
const LOOKBACK_DAYS = 7

function readIdSet(key: string): Set<string> {
  try {
    const raw = (key === SESSION_KEY ? sessionStorage : localStorage).getItem(key)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set()
  }
}

function writeIdSet(key: string, ids: Set<string>) {
  try {
    const store = key === SESSION_KEY ? sessionStorage : localStorage
    store.setItem(key, JSON.stringify([...ids].slice(-80)))
  } catch {
    /* quota */
  }
}

export default function GoogleReviewImportNotificationListener({ locale }: { locale: string }) {
  const router = useRouter()
  const { authUser, userRole } = useAuth()
  const enabled = Boolean(authUser?.email && userRole && userRole !== 'customer')
  const [queue, setQueue] = useState<GoogleReviewImportNotifyRow[]>([])
  const sessionDismissedRef = useRef<Set<string>>(new Set())
  const foreverDismissedRef = useRef<Set<string>>(new Set())
  const notification = queue[0] ?? null

  const enqueue = useCallback((next: GoogleReviewImportNotifyRow) => {
    if (!next?.id) return
    if (sessionDismissedRef.current.has(next.id) || foreverDismissedRef.current.has(next.id)) return
    setQueue((prev) => (prev.some((item) => item.id === next.id) ? prev : [...prev, next]))
  }, [])

  useEffect(() => {
    if (!enabled) return
    sessionDismissedRef.current = readIdSet(SESSION_KEY)
    foreverDismissedRef.current = readIdSet(FOREVER_KEY)

    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const pull = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData?.session) return
      const { data } = await fromUntypedTable(supabase, GOOGLE_REVIEW_IMPORT_NOTIFY_TABLE)
        .select(
          'id, operator_id, imported_count, updated_count, classified_count, unclassified_count, created_at'
        )
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(20)

      if (cancelled || !Array.isArray(data)) return
      for (const raw of data) {
        const row = mapGoogleReviewImportNotifyRow(raw as Record<string, unknown>)
        if (row) enqueue(row)
      }
    }

    const start = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData?.session) return
      channel = supabase
        .channel('google-review-import-notify')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: GOOGLE_REVIEW_IMPORT_NOTIFY_TABLE },
          (change) => {
            const row = mapGoogleReviewImportNotifyRow(change.new as Record<string, unknown>)
            if (row) enqueue(row)
          }
        )
        .subscribe()
      await pull()
    }

    void start()
    const timer = window.setInterval(() => {
      void pull()
    }, POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [enabled, enqueue])

  const dismissSession = () => {
    const current = notification
    if (current?.id) {
      sessionDismissedRef.current.add(current.id)
      writeIdSet(SESSION_KEY, sessionDismissedRef.current)
    }
    setQueue((prev) => prev.slice(1))
  }

  const dismissForever = () => {
    const current = notification
    if (current?.id) {
      foreverDismissedRef.current.add(current.id)
      writeIdSet(FOREVER_KEY, foreverDismissedRef.current)
    }
    setQueue((prev) => prev.slice(1))
  }

  const handleOpenPage = () => {
    dismissSession()
    router.push(`/${locale}/admin/google-reviews?tab=google&unclassified=1`)
  }

  if (!enabled || !notification) return null

  return (
    <GoogleReviewImportClassifyModal
      locale={locale}
      notification={notification}
      remaining={Math.max(0, queue.length - 1)}
      onLater={dismissSession}
      onDone={dismissForever}
      onOpenPage={handleOpenPage}
    />
  )
}
