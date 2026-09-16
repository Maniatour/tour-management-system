'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useReportAdminAlert } from '@/contexts/AdminAlertInboxContext'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  GOOGLE_REVIEW_IMPORT_NOTIFY_TABLE,
  mapGoogleReviewImportNotifyRow,
  type GoogleReviewImportNotifyRow,
} from '@/lib/googleReviewImportNotify'
import { makeAdminAlertDraft } from '@/lib/adminAlertInbox'
import { asAdminAlertPayload } from '@/lib/adminAlertReplay'
import { useAdminAlertReplay } from '@/hooks/useAdminAlertReplay'
import {
  googleReviewImportNotifyIdsAtOrBefore,
  mergeGoogleReviewImportNotifyRows,
  pickLatestGoogleReviewImportNotification,
} from '@/lib/googleReviewImportNotifyQueue'
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
  const report = useReportAdminAlert()
  const enabled = Boolean(authUser?.email && userRole && userRole !== 'customer')
  const [notification, setNotification] = useState<GoogleReviewImportNotifyRow | null>(null)
  const sessionDismissedRef = useRef<Set<string>>(new Set())
  const foreverDismissedRef = useRef<Set<string>>(new Set())
  const knownRowsRef = useRef<GoogleReviewImportNotifyRow[]>([])

  const dismissedIds = useCallback(() => {
    return new Set([...sessionDismissedRef.current, ...foreverDismissedRef.current])
  }, [])

  const reportRow = useCallback(
    (row: GoogleReviewImportNotifyRow) => {
      report(
        makeAdminAlertDraft('google_review_import', row.id, {
          title: '구글 리뷰 가져오기',
          body:
            row.unclassified_count > 0
              ? `미분류 ${row.unclassified_count}건`
              : `신규 ${row.imported_count}건 · 갱신 ${row.updated_count}건`,
          href: `/${locale}/admin/google-reviews?tab=google&unclassified=1`,
          createdAt: row.created_at,
          payload: row,
        })
      )
    },
    [locale, report]
  )

  const showLatest = useCallback(() => {
    setNotification(pickLatestGoogleReviewImportNotification(knownRowsRef.current, dismissedIds()))
  }, [dismissedIds])

  const enqueue = useCallback(
    (next: GoogleReviewImportNotifyRow) => {
      if (!next?.id) return
      knownRowsRef.current = mergeGoogleReviewImportNotifyRows(knownRowsRef.current, [next])
      if (!dismissedIds().has(next.id)) reportRow(next)
      showLatest()
    },
    [dismissedIds, reportRow, showLatest]
  )

  useAdminAlertReplay('google_review_import', (item) => {
    const row = asAdminAlertPayload<GoogleReviewImportNotifyRow>(item.payload)
    if (!row?.id) return
    knownRowsRef.current = mergeGoogleReviewImportNotifyRows(knownRowsRef.current, [row])
    setNotification(row)
  })

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
      const rows = data
        .map((raw) => mapGoogleReviewImportNotifyRow(raw as Record<string, unknown>))
        .filter((row): row is GoogleReviewImportNotifyRow => row != null)
      knownRowsRef.current = mergeGoogleReviewImportNotifyRows(knownRowsRef.current, rows)
      const latest = pickLatestGoogleReviewImportNotification(knownRowsRef.current, dismissedIds())
      if (latest) reportRow(latest)
      showLatest()
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
  }, [enabled, enqueue, showLatest, dismissedIds, reportRow])

  const dismissThroughCurrent = (forever: boolean) => {
    const current = notification
    if (!current?.id) {
      setNotification(null)
      return
    }
    const ids = googleReviewImportNotifyIdsAtOrBefore(knownRowsRef.current, current.created_at)
    const target = forever ? foreverDismissedRef : sessionDismissedRef
    const key = forever ? FOREVER_KEY : SESSION_KEY
    for (const id of ids) target.current.add(id)
    writeIdSet(key, target.current)
    showLatest()
  }

  const dismissSession = () => dismissThroughCurrent(false)

  const dismissForever = () => dismissThroughCurrent(true)

  const handleOpenPage = () => {
    dismissSession()
    router.push(`/${locale}/admin/google-reviews?tab=google&unclassified=1`)
  }

  if (!enabled || !notification) return null

  return (
    <GoogleReviewImportClassifyModal
      locale={locale}
      notification={notification}
      onLater={dismissSession}
      onDone={dismissForever}
      onOpenPage={handleOpenPage}
    />
  )
}
