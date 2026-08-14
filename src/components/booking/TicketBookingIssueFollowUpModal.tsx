'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatTicketBookingStatusLabel } from '@/lib/ticketBookingStatus'
import TicketBookingAxisSummary from '@/components/booking/TicketBookingAxisSummary'

export type TicketBookingIssueFollowUpRow = {
  id: string
  check_in_date: string
  company: string
  category?: string
  rn_number?: string
  status?: string
  time?: string
  ea?: number
  note?: string | null
  booking_status?: string | null
  vendor_status?: string | null
  change_status?: string | null
  payment_status?: string | null
  refund_status?: string | null
  operation_status?: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  bookings: TicketBookingIssueFollowUpRow[]
  onOpenBooking: (booking: TicketBookingIssueFollowUpRow) => void
  onClearIssue: (booking: TicketBookingIssueFollowUpRow) => void | Promise<void>
  clearingId?: string | null
}

function checkInYmd(b: TicketBookingIssueFollowUpRow): string {
  const s = (b.check_in_date || '').trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

export default function TicketBookingIssueFollowUpModal({
  open,
  onClose,
  bookings,
  onOpenBooking,
  onClearIssue,
  clearingId = null,
}: Props) {
  const t = useTranslations('booking.calendar')
  const locale = useLocale()
  const isEn = locale.startsWith('en')
  const [sortAsc, setSortAsc] = useState(true)

  const rows = useMemo(() => {
    const out = [...bookings]
    out.sort((a, b) => {
      const cmp = checkInYmd(a).localeCompare(checkInYmd(b))
      return sortAsc ? cmp : -cmp
    })
    return out
  }, [bookings, sortAsc])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-issue-followup-title"
      onClick={() => onClose()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-5">
          <div>
            <h2 id="ticket-issue-followup-title" className="text-lg font-semibold text-gray-900">
              {t('ticketIssueFollowUpTitle')}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('ticketIssueFollowUpHint')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-2xl leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500 sm:px-5">
              {t('ticketIssueFollowUpEmpty')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
                <thead className="sticky top-0 z-[1] bg-gray-50 text-gray-700">
                  <tr className="border-b border-gray-200">
                    <th className="whitespace-nowrap px-3 py-2 font-medium sm:px-4">
                      <button
                        type="button"
                        onClick={() => setSortAsc((v) => !v)}
                        className="inline-flex items-center gap-1 rounded hover:text-primary"
                      >
                        {t('ticketNeedCheckColCheckIn')}
                        <span className="tabular-nums text-gray-400" aria-hidden>
                          {sortAsc ? '↑' : '↓'}
                        </span>
                      </button>
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium sm:px-4">
                      {t('ticketNeedCheckColCompany')}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium sm:px-4">
                      {t('ticketNeedCheckColRn')}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium sm:px-4">
                      {t('ticketNeedCheckColStatus')}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium sm:px-4">
                      {t('ticketNeedCheckColEa')}
                    </th>
                    <th className="px-3 py-2 font-medium sm:px-4">
                      {isEn ? 'Note' : '메모'}
                    </th>
                    <th className="px-3 py-2 font-medium sm:px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((b) => (
                    <tr key={b.id} className="hover:bg-red-50/40">
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums sm:px-4">
                        {b.check_in_date || '—'}
                        {b.time ? (
                          <span className="ml-1 text-gray-500">{String(b.time).slice(0, 5)}</span>
                        ) : null}
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2 sm:max-w-[180px] sm:px-4">
                        {b.company || '—'}
                      </td>
                      <td className="max-w-[100px] truncate px-3 py-2 font-mono text-[11px] sm:px-4">
                        {b.rn_number?.trim() || '—'}
                      </td>
                      <td className="max-w-[min(100vw,14rem)] px-3 py-2 sm:max-w-[16rem] sm:px-4">
                        <div className="whitespace-nowrap">
                          {b.status ? formatTicketBookingStatusLabel(b.status, t, locale) : '—'}
                        </div>
                        <TicketBookingAxisSummary booking={b} variant="inline" className="mt-0.5" />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums sm:px-4">
                        {b.ea ?? '—'}
                      </td>
                      <td className="max-w-[16rem] px-3 py-2 text-gray-700 sm:px-4">
                        <span className="line-clamp-2 whitespace-pre-wrap break-words">
                          {(b.note || '').trim() || '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 sm:px-4">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onOpenBooking(b)
                              onClose()
                            }}
                            className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary/90"
                          >
                            {t('ticketNeedCheckOpenEdit')}
                          </button>
                          <button
                            type="button"
                            disabled={clearingId === b.id}
                            onClick={() => void onClearIssue(b)}
                            className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
                          >
                            {clearingId === b.id ? '…' : t('ticketIssueFollowUpClear')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
