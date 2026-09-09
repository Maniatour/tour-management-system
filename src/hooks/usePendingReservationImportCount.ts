'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GMAIL_RESERVATION_SYNC_COMPLETE } from '@/contexts/GmailReservationImportSyncContext'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import {
  isReservationImportWithinRecentDays,
  isUnprocessedBookingImportListRow,
  UNPROCESSED_BOOKING_IMPORT_BADGE_DAYS,
} from '@/lib/reservationImportNotify'
import { supabase } from '@/lib/supabase'
import { scheduleDeferredWork } from '@/lib/scheduleDeferredWork'

const REALTIME_REFRESH_DEBOUNCE_MS = 1200
const INITIAL_REFRESH_DEFER_MS = 2000

type ImportListApiRow = {
  id?: string
  subject?: string | null
  platform_key?: string | null
  source_email?: string | null
  extracted_data?: { is_booking_confirmed?: boolean } | null
  status?: string | null
  reservation_id?: string | null
  received_at?: string | null
  created_at?: string | null
  reservation_exists_by_channel_rn?: boolean | null
  reservation_exists_by_customer_match?: boolean | null
}

function extractedBookingFlag(raw: unknown): { is_booking_confirmed: boolean } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return {
    is_booking_confirmed: (raw as { is_booking_confirmed?: unknown }).is_booking_confirmed === true,
  }
}

function countUnprocessedBookingReceipts(rows: ImportListApiRow[], nowMs = Date.now()): number {
  return rows.filter((row) => {
    if (
      !isReservationImportWithinRecentDays(
        row.received_at,
        row.created_at,
        UNPROCESSED_BOOKING_IMPORT_BADGE_DAYS,
        nowMs
      )
    ) {
      return false
    }
    return isUnprocessedBookingImportListRow({
      id: String(row.id ?? ''),
      subject: row.subject ?? null,
      platform_key: row.platform_key ?? null,
      source_email: row.source_email ?? null,
      received_at: row.received_at ?? null,
      created_at: row.created_at ?? null,
      extracted_data: extractedBookingFlag(row.extracted_data),
      status: row.status ?? null,
      reservation_id: row.reservation_id ?? null,
      reservation_exists_by_channel_rn: row.reservation_exists_by_channel_rn ?? null,
      reservation_exists_by_customer_match: row.reservation_exists_by_customer_match ?? null,
    })
  }).length
}

function recentImportRangeIso(nowMs = Date.now()) {
  const fromMs = nowMs - UNPROCESSED_BOOKING_IMPORT_BADGE_DAYS * 24 * 60 * 60 * 1000
  return {
    fromUtc: new Date(fromMs).toISOString(),
    toUtc: new Date(nowMs).toISOString(),
  }
}

/**
 * 관리자 사이드바용: 최근 3일 수신 메일 중 빨간 행(예약 접수인데 아직 예약이 없는 건) 수.
 * 이미 채널 RN·고객 정보로 예약이 있으면 처리된 것으로 본다.
 */
export function usePendingReservationImportCount(enabled: boolean): number {
  const [count, setCount] = useState(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0)
      return
    }
    try {
      const { fromUtc, toUtc } = recentImportRangeIso()
      const params = new URLSearchParams({
        status: 'pending',
        from_utc: fromUtc,
        to_utc: toUtc,
      })
      const res = await fetchApiWithAuth(`/api/reservation-imports?${params}`)
      if (!res.ok) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[usePendingReservationImportCount] HTTP', res.status)
        }
        return
      }
      const json = (await res.json()) as { data?: unknown }
      const rows = Array.isArray(json.data) ? (json.data as ImportListApiRow[]) : []
      setCount(countUnprocessedBookingReceipts(rows))
    } catch {
      setCount(0)
    }
  }, [enabled])

  const scheduleRefreshDebounced = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null
      void refresh()
    }, REALTIME_REFRESH_DEBOUNCE_MS)
  }, [refresh])

  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }

    const cancelDeferredRefresh = scheduleDeferredWork(() => {
      void refresh()
    }, INITIAL_REFRESH_DEFER_MS)

    const channel = supabase
      .channel('admin-reservation-import-pending-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservation_imports' },
        () => {
          scheduleRefreshDebounced()
        }
      )
      .subscribe()

    const onSyncComplete = () => {
      scheduleRefreshDebounced()
    }
    window.addEventListener(GMAIL_RESERVATION_SYNC_COMPLETE, onSyncComplete)

    const interval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      void refresh()
    }, 120_000)

    return () => {
      cancelDeferredRefresh()
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      window.removeEventListener(GMAIL_RESERVATION_SYNC_COMPLETE, onSyncComplete)
      void supabase.removeChannel(channel)
      window.clearInterval(interval)
    }
  }, [enabled, refresh, scheduleRefreshDebounced])

  return count
}
