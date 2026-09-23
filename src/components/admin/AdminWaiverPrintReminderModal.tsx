'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Printer } from 'lucide-react'
import { useReportAdminAlert } from '@/contexts/AdminAlertInboxContext'
import { makeAdminAlertDraft } from '@/lib/adminAlertInbox'
import { asAdminAlertPayload } from '@/lib/adminAlertReplay'
import { useAdminAlertReplay } from '@/hooks/useAdminAlertReplay'
import {
  isWaiverPrintReminderWindow,
  todayLasVegasYmd,
  tomorrowTourDateYmd,
} from '@/lib/waiver/signingWindow'

const DISMISS_PREFIX = 'admin_waiver_print_reminder:'

type WaiverRow = {
  overall: string
  guestCount: number
  completeGuests: number
}

function dismissKey(dateYmd: string): string {
  return `${DISMISS_PREFIX}${dateYmd}`
}

export default function AdminWaiverPrintReminderModal({ locale }: { locale: string }) {
  const pathname = usePathname() ?? ''
  const report = useReportAdminAlert()
  const isKo = locale.startsWith('ko')
  const [open, setOpen] = useState(false)
  const [tourDate, setTourDate] = useState('')
  const [bookingCount, setBookingCount] = useState(0)
  const [unsignedGuests, setUnsignedGuests] = useState(0)
  const closedThisSessionRef = useRef(false)

  const maybeOpen = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (!pathname.includes('/admin')) return
    if (closedThisSessionRef.current) return
    if (open) return
    if (!isWaiverPrintReminderWindow()) return
    const todayYmd = todayLasVegasYmd()
    const tomorrowYmd = tomorrowTourDateYmd()
    try {
      if (localStorage.getItem(dismissKey(todayYmd)) === '1') return
    } catch {
      /* ignore */
    }
    const res = await fetch(`/api/admin/waivers?tourDate=${encodeURIComponent(tomorrowYmd)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return
    const data = (await res.json().catch(() => ({}))) as { rows?: WaiverRow[] }
    const rows = data.rows ?? []
    if (rows.length === 0) return
    const unsigned = rows.reduce(
      (sum, row) => sum + Math.max(0, Number(row.guestCount ?? 0) - Number(row.completeGuests ?? 0)),
      0
    )
    setTourDate(tomorrowYmd)
    setBookingCount(rows.length)
    setUnsignedGuests(unsigned)
    setOpen(true)
    report(
      makeAdminAlertDraft('waiver_print_reminder', tomorrowYmd, {
        title: isKo ? '내일 투어 면책 동의서 마감' : "Tomorrow's tour waivers are closed",
        body: isKo
          ? '온라인 서명이 마감됐습니다. 내일 투어 면책 동의서를 인쇄해 주세요.'
          : 'Online signing is closed. Please print the waiver forms for tomorrow’s tours.',
        href: `/${locale}/admin/waivers?tourDate=${encodeURIComponent(tomorrowYmd)}`,
        createdAt: new Date().toISOString(),
        payload: { tourDate: tomorrowYmd, bookingCount: rows.length, unsignedGuests: unsigned },
      })
    )
  }, [pathname, open, report, isKo, locale])

  useAdminAlertReplay('waiver_print_reminder', (item) => {
    const row = asAdminAlertPayload<{ tourDate?: string; bookingCount?: number; unsignedGuests?: number }>(
      item.payload
    )
    closedThisSessionRef.current = false
    setTourDate(row?.tourDate || tomorrowTourDateYmd())
    setBookingCount(Number(row?.bookingCount ?? 0))
    setUnsignedGuests(Number(row?.unsignedGuests ?? 0))
    setOpen(true)
  })

  useEffect(() => {
    void maybeOpen()
    const timer = window.setInterval(() => {
      void maybeOpen()
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [maybeOpen])

  const handleClose = () => {
    closedThisSessionRef.current = true
    setOpen(false)
  }

  const handleDismissToday = () => {
    try {
      localStorage.setItem(dismissKey(todayLasVegasYmd()), '1')
    } catch {
      /* ignore */
    }
    handleClose()
  }

  if (!open) return null

  const printHref = `/${locale}/admin/waivers?tourDate=${encodeURIComponent(tourDate)}`

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-waiver-print-reminder-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-full bg-amber-100 p-2">
            <Printer className="h-6 w-6 text-amber-800" />
          </div>
          <div>
            <h2 id="admin-waiver-print-reminder-title" className="text-lg font-semibold tracking-tight text-gray-900">
              {isKo ? '내일 투어 면책 동의서가 마감되었습니다' : "Tomorrow’s tour waivers are closed"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {isKo
                ? '온라인 서명이 오늘 오후 5시에 마감됐습니다. 내일 투어 면책 동의서를 인쇄해 가져가세요. 서명하지 못한 고객은 인쇄물에 서명하면 됩니다.'
                : 'Online signing closed at 5:00 PM. Please print the waiver forms for tomorrow’s tours. Guests who did not sign online can sign the printed copy.'}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p>
            {isKo ? '내일 투어일' : 'Tomorrow’s tour date'}: <span className="font-medium">{tourDate}</span>
          </p>
          <p className="mt-1">
            {isKo
              ? `예약 ${bookingCount}건 · 미서명 게스트 ${unsignedGuests}명`
              : `${bookingCount} bookings · ${unsignedGuests} unsigned guests`}
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href={printHref}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-amber-800 px-4 text-sm font-medium text-white hover:bg-amber-900"
            onClick={handleClose}
          >
            {isKo ? '면책 동의서 인쇄하기' : 'Print waivers'}
          </Link>
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 px-4 text-sm text-gray-700 hover:bg-gray-50"
            onClick={handleClose}
          >
            {isKo ? '나중에' : 'Later'}
          </button>
        </div>
        <button
          type="button"
          className="mt-3 text-sm text-gray-500 underline-offset-2 hover:underline"
          onClick={handleDismissToday}
        >
          {isKo ? '오늘은 다시 보지 않기' : "Don't show again today"}
        </button>
      </div>
    </div>
  )
}
