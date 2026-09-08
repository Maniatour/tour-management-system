'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, ExternalLink, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { isCancellationRequestEmailSubject } from '@/lib/emailReservationParser'
import {
  isReservationRelatedImportNotifyRow,
  type ReservationImportNotifyRow,
} from '@/lib/reservationImportNotify'

const DISMISSED_KEY = 'tms-reservation-import-notify-dismissed'
const POLL_MS = 30_000

function readDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set()
  }
}

function writeDismissed(ids: Set<string>) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids].slice(-80)))
  } catch {
    /* quota */
  }
}

export default function ReservationImportNotificationListener({ locale }: { locale: string }) {
  const router = useRouter()
  const { authUser, userRole } = useAuth()
  const enabled = Boolean(authUser?.email && userRole && userRole !== 'customer')
  const [queue, setQueue] = useState<ReservationImportNotifyRow[]>([])
  const sinceIsoRef = useRef(new Date().toISOString())
  const dismissedRef = useRef<Set<string>>(new Set())
  const notification = queue[0] ?? null

  const enqueue = useCallback((next: ReservationImportNotifyRow) => {
    if (!next?.id || dismissedRef.current.has(next.id)) return
    if (!isReservationRelatedImportNotifyRow(next)) return
    setQueue((prev) => {
      if (prev.some((item) => item.id === next.id)) return prev
      return [...prev, next]
    })
  }, [])

  useEffect(() => {
    if (!enabled) return
    dismissedRef.current = readDismissed()
    sinceIsoRef.current = new Date().toISOString()

    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const pullNew = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData?.session) return
      const { data } = await supabase
        .from('reservation_imports')
        .select('id, subject, platform_key, received_at, created_at, extracted_data')
        .gt('created_at', sinceIsoRef.current)
        .order('created_at', { ascending: true })
        .limit(20)

      if (cancelled || !Array.isArray(data)) return
      for (const row of data as ReservationImportNotifyRow[]) {
        enqueue(row)
        if (row.created_at && row.created_at > sinceIsoRef.current) {
          sinceIsoRef.current = row.created_at
        }
      }
    }

    const start = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData?.session) return

      channel = supabase
        .channel('reservation-import-notify')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'reservation_imports' },
          (change) => {
            enqueue(change.new as ReservationImportNotifyRow)
          }
        )
        .subscribe()

      await pullNew()
    }

    void start()
    const timer = window.setInterval(() => {
      void pullNew()
    }, POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [enabled, enqueue])

  const handleClose = () => {
    const current = notification
    if (current?.id) {
      dismissedRef.current.add(current.id)
      writeDismissed(dismissedRef.current)
    }
    setQueue((prev) => prev.slice(1))
  }

  const handleOpen = () => {
    const current = notification
    handleClose()
    if (!current?.id) return
    if (isCancellationRequestEmailSubject(current.subject)) {
      router.push(`/${locale}/admin/reservation-imports?cancellationImport=${encodeURIComponent(current.id)}`)
      return
    }
    router.push(`/${locale}/admin/reservation-imports/${current.id}`)
  }

  if (!enabled || !notification) return null

  const remaining = Math.max(0, queue.length - 1)
  const isCancel = isCancellationRequestEmailSubject(notification.subject)
  const title = isCancel ? '취소 메일 접수' : '예약 메일 접수'
  const platform = notification.platform_key && notification.platform_key !== '-' ? notification.platform_key : null

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-import-notify-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-white shadow-2xl"
      >
        <div
          className={`flex items-start justify-between gap-3 border-b p-4 ${
            isCancel ? 'border-rose-100 bg-rose-50' : 'border-sky-100 bg-sky-50'
          }`}
        >
          <div className="flex items-start gap-2 min-w-0">
            <div className={`rounded-xl p-2 text-white ${isCancel ? 'bg-rose-600' : 'bg-sky-600'}`}>
              <Mail size={22} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 id="reservation-import-notify-title" className="text-base font-semibold text-gray-900">
                {title}
              </h2>
              {platform ? <p className="mt-0.5 text-xs text-gray-600">{platform}</p> : null}
              {remaining > 0 ? (
                <p className={`mt-0.5 text-xs ${isCancel ? 'text-rose-700' : 'text-sky-700'}`}>
                  외 {remaining}건 대기 중
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-gray-500 hover:bg-white/80 hover:text-gray-800"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <p className="text-sm font-medium text-gray-900 leading-snug">
            {notification.subject?.trim() || '(제목 없음)'}
          </p>
          <p className="text-sm text-gray-600">
            {isCancel
              ? '취소 관련 메일이 예약 가져오기 목록에 추가되었습니다.'
              : '예약 관련 메일이 예약 가져오기 목록에 추가되었습니다.'}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="min-h-[44px] rounded-xl px-4 text-sm text-gray-600 hover:bg-gray-50"
            >
              나중에
            </button>
            <button
              type="button"
              onClick={handleOpen}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              확인하러 가기
              <ExternalLink size={16} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
