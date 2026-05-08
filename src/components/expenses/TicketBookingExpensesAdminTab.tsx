'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import ReservationExpenseTabPager, {
  reservationExpenseTotalPages
} from '@/components/expenses/ReservationExpenseTabPager'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { RefreshCw } from 'lucide-react'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { filterTicketBookingsExcludedFromMainUi } from '@/lib/ticketBookingSoftDelete'
import { fetchReconciledSourceIdsBatched } from '@/lib/reconciliation-match-queries'
import type { ExpenseStatementReconContext } from '@/lib/expense-reconciliation-similar-lines'
import type { Tables } from '@/lib/database.types'
import { ExpenseStatementReconIcon } from '@/components/reconciliation/ExpenseStatementReconIcon'
import ExpenseStatementSimilarLinesModal from '@/components/reconciliation/ExpenseStatementSimilarLinesModal'
import TicketBookingForm from '@/components/booking/TicketBookingForm'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type TicketBookingRow = Tables<'ticket_bookings'>['Row']

type TicketRow = Pick<
  Tables<'ticket_bookings'>,
  | 'id'
  | 'category'
  | 'company'
  | 'expense'
  | 'submit_on'
  | 'check_in_date'
  | 'tour_id'
  | 'reservation_id'
  | 'payment_method'
  | 'submitted_by'
  | 'note'
  | 'deletion_requested_at'
  | 'booking_status'
  | 'operation_status'
  | 'payment_status'
>

function formatUsd(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function ticketStatusLine(r: { booking_status: string; operation_status: string; payment_status: string }) {
  const parts = [r.booking_status, r.operation_status, r.payment_status]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
  return [...new Set(parts)].join(' · ') || '—'
}

export default function TicketBookingExpensesAdminTab({ locale }: { locale: string }) {
  const t = useTranslations('expenses.reservationSubTabs')
  const tStmt = useTranslations('expenses.statementRecon')
  const [rows, setRows] = useState<TicketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [teamMembers, setTeamMembers] = useState<Record<string, string>>({})
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [reconciledIds, setReconciledIds] = useState<Set<string>>(() => new Set())
  const [stmtOpen, setStmtOpen] = useState(false)
  const [stmtCtx, setStmtCtx] = useState<ExpenseStatementReconContext | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [unmatchedOnly, setUnmatchedOnly] = useState(false)
  const [ticketFormOpen, setTicketFormOpen] = useState(false)
  const [ticketEditingRow, setTicketEditingRow] = useState<TicketBookingRow | null>(null)

  const loadTeam = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('team').select('email, name_ko')
      if (error) throw error
      const m: Record<string, string> = {}
      ;(data || []).forEach((r: { email: string; name_ko: string }) => {
        m[r.email] = r.name_ko
      })
      setTeamMembers(m)
    } catch (e) {
      if (!isAbortLikeError(e)) console.error(e)
    }
  }, [])

  const loadRows = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('ticket_bookings')
        .select(
          'id, category, company, expense, submit_on, check_in_date, tour_id, reservation_id, payment_method, submitted_by, note, deletion_requested_at, booking_status, operation_status, payment_status'
        )
        .order('submit_on', { ascending: false, nullsFirst: false })
        .limit(1000)
      if (error) throw error
      setRows(filterTicketBookingsExcludedFromMainUi((data || []) as TicketRow[]))
    } catch (e) {
      if (!isAbortLikeError(e)) console.error(e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTeam()
  }, [loadTeam])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const visibleIds = useMemo(() => rows.map((r) => r.id).filter(Boolean), [rows])
  const reconKey = useMemo(() => [...visibleIds].sort().join('|'), [visibleIds])

  useEffect(() => {
    if (visibleIds.length === 0) {
      setReconciledIds(new Set())
      return
    }
    let cancelled = false
    void fetchReconciledSourceIdsBatched(supabase, 'ticket_bookings', visibleIds).then((s) => {
      if (!cancelled) setReconciledIds(s)
    })
    return () => {
      cancelled = true
    }
  }, [reconKey])

  const baseFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      const ymd = (r.submit_on || '').slice(0, 10)
      if (dateFrom && (!ymd || ymd < dateFrom)) return false
      if (dateTo && (!ymd || ymd > dateTo)) return false
      if (!q) return true
      const blob = [
        r.category,
        r.company,
        r.note,
        r.tour_id,
        r.reservation_id,
        r.payment_method,
        r.submitted_by,
        r.booking_status,
        r.operation_status,
        r.payment_status
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [rows, dateFrom, dateTo, search])

  const filteredAll = useMemo(() => {
    if (!unmatchedOnly) return baseFiltered
    return baseFiltered.filter((r) => !reconciledIds.has(r.id))
  }, [baseFiltered, unmatchedOnly, reconciledIds])

  const totalPages = useMemo(
    () => reservationExpenseTotalPages(filteredAll.length, pageSize),
    [filteredAll.length, pageSize]
  )
  const safePage = Math.min(Math.max(1, page), totalPages)

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  useEffect(() => {
    setPage(1)
  }, [dateFrom, dateTo, search, unmatchedOnly, pageSize])

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredAll.slice(start, start + pageSize)
  }, [filteredAll, safePage, pageSize])

  const openStmt = (r: TicketRow) => {
    const ymd = (r.submit_on || r.check_in_date || '').slice(0, 10)
    const amt = Math.abs(Number(r.expense ?? 0))
    if (!ymd || amt <= 0) return
    setStmtCtx({
      sourceTable: 'ticket_bookings',
      sourceId: r.id,
      dateYmd: ymd,
      amount: amt,
      direction: 'outflow'
    })
    setStmtOpen(true)
  }

  const stmtDisabled = (r: TicketRow) => {
    const ymd = (r.submit_on || r.check_in_date || '').slice(0, 10)
    const amt = Math.abs(Number(r.expense ?? 0))
    return !ymd || amt <= 0
  }

  const openTicketEdit = async (id: string) => {
    try {
      const { data, error } = await supabase.from('ticket_bookings').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      if (!data) throw new Error('missing row')
      setTicketEditingRow(data as TicketBookingRow)
      setTicketFormOpen(true)
    } catch (e) {
      if (!isAbortLikeError(e)) console.error(e)
      window.alert(t('saveError'))
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs sm:text-sm text-gray-600">{t('ticketsHint')}</p>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-end">
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs text-gray-600 flex flex-col gap-0.5">
            <span>{t('filterDateFrom')}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600 flex flex-col gap-0.5">
            <span>{t('filterDateTo')}</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <div className="flex-1 min-w-[12rem]">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void loadRows()}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" aria-hidden />
          {t('refresh')}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 justify-between">
        <label className="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={unmatchedOnly}
            onChange={(e) => setUnmatchedOnly(e.target.checked)}
          />
          <span>{t('filterUnmatchedOnly')}</span>
        </label>
        {!loading && filteredAll.length > 0 ? (
          <ReservationExpenseTabPager
            page={safePage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalFiltered={filteredAll.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-6 text-center">{t('loading')}</p>
      ) : filteredAll.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">{t('empty')}</p>
      ) : (
        <div className="max-h-[min(70vh,44rem)] overflow-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="sticky top-0 z-20 bg-gray-50 shadow-[0_1px_0_0_rgb(229,231,235)]">
              <tr>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 w-12">{t('ticketsColRecon')}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{t('ticketsColExpense')}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{t('ticketsColSubmitOn')}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">{t('ticketsColCategory')}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">{t('ticketsColCompany')}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{t('ticketsColCheckIn')}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">{t('ticketsColTour')}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">{t('ticketsColReservation')}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{t('ticketsColStatus')}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{t('ticketsColMethod')}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">{t('ticketsColSubmitter')}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 max-w-[12rem]">{t('ticketsColNote')}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-[4.5rem]">
                  {t('colActions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {pageRows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-1 py-1 text-center align-middle">
                    <ExpenseStatementReconIcon
                      matched={reconciledIds.has(r.id)}
                      disabled={stmtDisabled(r)}
                      titleMatched={tStmt('matchedTitle')}
                      titleUnmatched={tStmt('unmatchedTitle')}
                      titleDisabled={tStmt('unmatchedTitle')}
                      onClick={() => openStmt(r)}
                    />
                  </td>
                  <td className="px-2 py-2 tabular-nums whitespace-nowrap text-right font-medium">
                    {formatUsd(Number(r.expense ?? 0))}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-gray-800">
                    {r.submit_on ? r.submit_on.slice(0, 10) : '—'}
                  </td>
                  <td className="px-2 py-2 max-w-[10rem] truncate" title={r.category}>
                    {r.category}
                  </td>
                  <td className="px-2 py-2 max-w-[10rem] truncate" title={r.company ?? ''}>
                    {r.company ?? '—'}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{r.check_in_date?.slice(0, 10) ?? '—'}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {r.tour_id ? (
                      <Link
                        href={`/${locale}/admin/tours/${r.tour_id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {t('openTour')}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-2 py-2 max-w-[10rem] truncate">
                    {r.reservation_id ? (
                      <Link href={`/${locale}/admin/reservations/${r.reservation_id}`} className="text-blue-600 hover:underline">
                        {r.reservation_id.slice(0, 8)}…
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-2 py-2 max-w-[10rem] truncate text-xs text-gray-800" title={ticketStatusLine(r)}>
                    {ticketStatusLine(r)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{r.payment_method ?? '—'}</td>
                  <td className="px-2 py-2 max-w-[8rem] truncate" title={r.submitted_by}>
                    {teamMembers[r.submitted_by] || r.submitted_by}
                  </td>
                  <td className="px-2 py-2 max-w-[14rem] truncate text-gray-600" title={r.note ?? ''}>
                    {r.note ?? '—'}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap align-middle">
                    <button
                      type="button"
                      onClick={() => void openTicketEdit(r.id)}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      {t('editRow')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filteredAll.length > 0 ? (
        <div className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50/80">
          <ReservationExpenseTabPager
            page={safePage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalFiltered={filteredAll.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      ) : null}

      <ExpenseStatementSimilarLinesModal
        open={stmtOpen}
        onOpenChange={setStmtOpen}
        context={stmtCtx}
        onApplied={() => {
          void fetchReconciledSourceIdsBatched(supabase, 'ticket_bookings', visibleIds).then(setReconciledIds)
        }}
      />

      <Dialog
        open={ticketFormOpen}
        onOpenChange={(o) => {
          setTicketFormOpen(o)
          if (!o) setTicketEditingRow(null)
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto w-[min(96vw,56rem)] max-w-none p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 border-b">
            <DialogTitle>{t('ticketEditTitle')}</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-4 pt-2">
            {ticketEditingRow ? (
              <TicketBookingForm
                key={ticketEditingRow.id}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB row를 폼 초기값으로 그대로 전달
                booking={ticketEditingRow as any}
                tourId={ticketEditingRow.tour_id ?? undefined}
                onSave={() => {
                  setTicketFormOpen(false)
                  setTicketEditingRow(null)
                  void loadRows()
                }}
                onCancel={() => {
                  setTicketFormOpen(false)
                  setTicketEditingRow(null)
                }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
