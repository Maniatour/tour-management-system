'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Calendar, FileText, Loader2 } from 'lucide-react'
import { fetchApiWithAuthWhenReady } from '@/lib/api-client-bearer'
import { useAuth } from '@/contexts/AuthContext'
import type { GuideUncompletedTourReportItem } from '@/lib/guideUncompletedTourReports'

export type UncompletedTourReportItem = GuideUncompletedTourReportItem

function dismissStorageKey(email: string) {
  return `uncompleted-tour-reports:${email.toLowerCase()}`
}

function formatTourDate(dateString: string, locale: string) {
  const date = new Date(`${dateString}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  const weekday = date.toLocaleDateString(locale.startsWith('en') ? 'en-US' : 'ko-KR', {
    weekday: 'short',
  })
  return `${dateString} (${weekday})`
}

export function UncompletedTourReportReminderModal({
  open,
  locale,
  items,
  loading = false,
  onWriteNow,
  onDismiss,
}: {
  open: boolean
  locale: string
  items: UncompletedTourReportItem[]
  loading?: boolean
  onWriteNow: () => void
  onDismiss: () => void
}) {
  const isEn = locale.startsWith('en')
  const count = items.length

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[248] flex items-center justify-center bg-black/70 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="uncompleted-tour-report-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl"
      >
        <div className="border-b border-amber-100 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white">
              <AlertTriangle className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                {isEn ? 'Required' : '필수'}
              </p>
              <h2
                id="uncompleted-tour-report-title"
                className="mt-0.5 text-lg font-semibold tracking-tight text-gray-900"
              >
                {isEn ? 'Unsubmitted tour reports' : '미작성 투어 리포트가 있습니다'}
              </h2>
            </div>
            {count > 0 ? (
              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-red-600 px-2 text-sm font-bold text-white">
                {count}
              </span>
            ) : null}
          </div>
        </div>

        <div className="max-h-[min(52vh,420px)] space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-sm leading-6 text-gray-700">
            {isEn
              ? 'Please submit a tour report after every assigned tour. Missing reports may negatively affect payroll review and future assignments.'
              : '배정받은 투어는 종료 후 반드시 리포트를 작성해 주세요. 미작성 시 정산·배정 검토에 불이익이 있을 수 있습니다.'}
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <ul className="space-y-2">
              {items.slice(0, 8).map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-border bg-muted/40 px-3 py-2.5"
                >
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatTourDate(item.tourDate, locale)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {!loading && count > 8 ? (
            <p className="text-xs text-muted-foreground">
              {isEn ? `+${count - 8} more` : `외 ${count - 8}건`}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t bg-gray-50 px-5 py-4 sm:flex-row">
          <button
            type="button"
            onClick={onWriteNow}
            className="inline-flex h-12 min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:flex-1"
          >
            <FileText className="h-4 w-4" />
            {isEn ? 'Write report now' : '지금 작성하기'}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-12 min-h-12 w-full shrink-0 items-center justify-center rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-white sm:min-w-[7rem] sm:flex-none"
          >
            {isEn ? 'Later' : '나중에'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function UncompletedTourReportReminderLayer({
  userEmail,
  locale,
  paused = false,
  refreshKey = 0,
  onWriteNow,
}: {
  userEmail: string | null | undefined
  locale: string
  paused?: boolean
  refreshKey?: number
  onWriteNow: () => void
}) {
  const { isInitialized, isSimulating, simulatedUser } = useAuth()
  const [items, setItems] = useState<UncompletedTourReportItem[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const emailRaw = (userEmail || '').trim()
  const emailKey = emailRaw.toLowerCase()

  const loadPending = useCallback(async () => {
    if (!emailKey || !isInitialized) {
      setItems([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const headers: Record<string, string> = {}
      if (isSimulating && simulatedUser?.email) {
        headers['x-simulated-user-email'] = simulatedUser.email
      }
      const localeParam = locale.startsWith('en') ? 'en' : 'ko'
      const res = await fetchApiWithAuthWhenReady(
        `/api/guide/uncompleted-tour-reports?locale=${localeParam}`,
        { headers }
      )
      if (!res || !res.ok) {
        setItems([])
        setOpen(false)
        return
      }
      const payload = (await res.json()) as { items?: UncompletedTourReportItem[] }
      const next = Array.isArray(payload.items) ? payload.items : []
      setItems(next)

      let dismissedCount = -1
      try {
        dismissedCount = Number(sessionStorage.getItem(dismissStorageKey(emailKey)) || '-1')
      } catch {
        dismissedCount = -1
      }
      setOpen(next.length > 0 && next.length !== dismissedCount)
    } catch {
      setItems([])
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }, [emailKey, isInitialized, isSimulating, simulatedUser?.email, locale])

  useEffect(() => {
    void loadPending()
  }, [loadPending, refreshKey])

  const dismiss = (count: number) => {
    try {
      sessionStorage.setItem(dismissStorageKey(emailKey), String(count))
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  if (paused) return null

  return (
    <UncompletedTourReportReminderModal
      open={open && items.length > 0}
      locale={locale}
      items={items}
      loading={loading && items.length === 0}
      onWriteNow={() => {
        dismiss(items.length)
        onWriteNow()
      }}
      onDismiss={() => dismiss(items.length)}
    />
  )
}
