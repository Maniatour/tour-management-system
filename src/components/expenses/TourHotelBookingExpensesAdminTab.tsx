'use client'

import type { ComponentProps } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { RefreshCw } from 'lucide-react'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { fetchReconciledSourceIdsBatched } from '@/lib/reconciliation-match-queries'
import type { ExpenseStatementReconContext } from '@/lib/expense-reconciliation-similar-lines'
import type { Tables } from '@/lib/database.types'
import { ExpenseStatementReconIcon } from '@/components/reconciliation/ExpenseStatementReconIcon'
import ExpenseStatementSimilarLinesModal from '@/components/reconciliation/ExpenseStatementSimilarLinesModal'
import TourHotelBookingForm from '@/components/booking/TourHotelBookingForm'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ReservationExpenseTabPager, {
  reservationExpenseTotalPages
} from '@/components/expenses/ReservationExpenseTabPager'

type HotelRow = Pick<
  Tables<'tour_hotel_bookings'>,
  | 'id'
  | 'total_price'
  | 'submit_on'
  | 'hotel'
  | 'event_date'
  | 'check_in_date'
  | 'tour_id'
  | 'reservation_name'
  | 'city'
  | 'rooms'
  | 'payment_method'
  | 'submitted_by'
  | 'status'
>

type TourHotelBookingRow = Tables<'tour_hotel_bookings'>['Row']

function formatUsd(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function TourHotelBookingExpensesAdminTab({ locale }: { locale: string }) {
  const t = useTranslations('expenses.reservationSubTabs')
  const tStmt = useTranslations('expenses.statementRecon')
  const [rows, setRows] = useState<HotelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [teamMembers, setTeamMembers] = useState<Record<string, string>>({})
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [reconciledIds, setReconciledIds] = useState<Set<string>>(() => new Set())
  const [stmtOpen, setStmtOpen] = useState(false)
  const [stmtCtx, setStmtCtx] = useState<ExpenseStatementReconContext | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'edit' | 'copy'>('edit')
  const [formInitialRow, setFormInitialRow] = useState<TourHotelBookingRow | null>(null)
  const headerSelectRef = useRef<HTMLInputElement>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [unmatchedOnly, setUnmatchedOnly] = useState(false)

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
        .from('tour_hotel_bookings')
        .select(
          'id, total_price, submit_on, hotel, event_date, check_in_date, tour_id, reservation_name, city, rooms, payment_method, submitted_by, status'
        )
        .order('submit_on', { ascending: false, nullsFirst: false })
        .limit(1000)
      if (error) throw error
      setRows((data || []) as HotelRow[])
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
    void fetchReconciledSourceIdsBatched(supabase, 'tour_hotel_bookings', visibleIds).then((s) => {
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
        r.hotel,
        r.reservation_name,
        r.city,
        r.tour_id,
        r.payment_method,
        r.submitted_by,
        String(r.rooms ?? ''),
        r.status
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

  const filteredIdSet = useMemo(() => new Set(filteredAll.map((r) => r.id)), [filteredAll])
  const allFilteredSelected = filteredAll.length > 0 && filteredAll.every((r) => selectedIds.has(r.id))
  const someFilteredSelected = filteredAll.some((r) => selectedIds.has(r.id))

  useEffect(() => {
    const el = headerSelectRef.current
    if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected
  }, [someFilteredSelected, allFilteredSelected])

  useEffect(() => {
    setSelectedIds((prev) => {
      let changed = false
      const next = new Set<string>()
      prev.forEach((id) => {
        if (filteredIdSet.has(id)) next.add(id)
        else changed = true
      })
      if (next.size !== prev.size) changed = true
      return changed ? next : prev
    })
  }, [filteredIdSet])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const n = new Set(prev)
        filteredAll.forEach((r) => n.delete(r.id))
        return n
      })
    } else {
      setSelectedIds((prev) => {
        const n = new Set(prev)
        filteredAll.forEach((r) => n.add(r.id))
        return n
      })
    }
  }

  const openHotelFormById = async (id: string, mode: 'edit' | 'copy') => {
    try {
      const { data, error } = await supabase.from('tour_hotel_bookings').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      if (!data) throw new Error('missing row')
      setFormInitialRow(data as TourHotelBookingRow)
      setFormMode(mode)
      setFormOpen(true)
    } catch (e) {
      if (!isAbortLikeError(e)) console.error(e)
      window.alert(t('saveError'))
    }
  }

  const openBookingForm = async (mode: 'edit' | 'copy') => {
    if (selectedIds.size !== 1) {
      window.alert(mode === 'edit' ? t('hotelsEditOneOnly') : t('hotelsCopyOneOnly'))
      return
    }
    const id = [...selectedIds][0]
    await openHotelFormById(id, mode)
  }

  const openStmt = (r: HotelRow) => {
    const ymd = (r.submit_on || r.event_date || r.check_in_date || '').slice(0, 10)
    const amt = Math.abs(Number(r.total_price ?? 0))
    if (!ymd || amt <= 0) return
    setStmtCtx({
      sourceTable: 'tour_hotel_bookings',
      sourceId: r.id,
      dateYmd: ymd,
      amount: amt,
      direction: 'outflow'
    })
    setStmtOpen(true)
  }

  const stmtDisabled = (r: HotelRow) => {
    const ymd = (r.submit_on || r.event_date || r.check_in_date || '').slice(0, 10)
    const amt = Math.abs(Number(r.total_price ?? 0))
    return !ymd || amt <= 0
  }

  const formTitle = formMode === 'copy' ? t('hotelCopyTitle') : t('hotelEditTitle')

  return (
    <div className="space-y-3">
      <p className="text-xs sm:text-sm text-gray-600">{t('hotelsHint')}</p>
      <p className="text-[11px] text-gray-500">{t('hotelsBulkActionsHint')}</p>

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

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 text-sm">
          <span className="font-medium text-blue-900 tabular-nums">{t('selectedCount', { n: selectedIds.size })}</span>
          <button
            type="button"
            onClick={() => void openBookingForm('edit')}
            className="px-2.5 py-1 rounded border border-blue-300 bg-white text-blue-800 hover:bg-blue-100/80 text-sm font-medium"
          >
            {t('editRow')}
          </button>
          <button
            type="button"
            onClick={() => void openBookingForm('copy')}
            className="px-2.5 py-1 rounded border border-blue-300 bg-white text-blue-800 hover:bg-blue-100/80 text-sm font-medium"
          >
            {t('copyRow')}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="px-2.5 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm"
          >
            {t('clearSelection')}
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500 py-6 text-center">{t('loading')}</p>
      ) : filteredAll.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">{t('empty')}</p>
      ) : (
        <div className="max-h-[min(70vh,44rem)] overflow-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="sticky top-0 z-20 bg-gray-50 shadow-[0_1px_0_0_rgb(229,231,235)]">
              <tr>
                <th className="px-1 py-2 text-center w-10 align-middle">
                  <input
                    ref={headerSelectRef}
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    aria-label={t('hotelsColSelect')}
                  />
                </th>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 w-12">{t('hotelsColRecon')}</th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 whitespace-nowrap">
                  {t('hotelsColAmount')}
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                  {t('hotelsColSubmitOn')}
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">{t('hotelsColHotel')}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                  {t('hotelsColEvent')}
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                  {t('hotelsColCheckIn')}
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">{t('hotelsColTour')}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">{t('hotelsColReservationName')}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">{t('hotelsColCity')}</th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 whitespace-nowrap">
                  {t('hotelsColRooms')}
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                  {t('hotelsColStatus')}
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                  {t('hotelsColMethod')}
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">{t('hotelsColSubmitter')}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-[4.5rem]">
                  {t('colActions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {pageRows.map((r) => (
                <tr
                  key={r.id}
                  className={`hover:bg-gray-50 ${selectedIds.has(r.id) ? 'bg-blue-50/70' : ''}`}
                >
                  <td className="px-1 py-1.5 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      aria-label={t('hotelsColSelect')}
                    />
                  </td>
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
                    {formatUsd(Number(r.total_price ?? 0))}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{r.submit_on ? r.submit_on.slice(0, 10) : '—'}</td>
                  <td className="px-2 py-2 max-w-[12rem] truncate" title={r.hotel}>
                    {r.hotel}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{r.event_date?.slice(0, 10) ?? '—'}</td>
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
                  <td className="px-2 py-2 max-w-[12rem] truncate" title={r.reservation_name}>
                    {r.reservation_name}
                  </td>
                  <td className="px-2 py-2 max-w-[8rem] truncate">{r.city}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.rooms ?? '—'}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-800 max-w-[8rem] truncate" title={r.status ?? ''}>
                    {r.status?.trim() ? r.status : '—'}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{r.payment_method ?? '—'}</td>
                  <td className="px-2 py-2 max-w-[8rem] truncate" title={r.submitted_by ?? ''}>
                    {(r.submitted_by && teamMembers[r.submitted_by]) || r.submitted_by || '—'}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap align-middle">
                    <button
                      type="button"
                      onClick={() => void openHotelFormById(r.id, 'edit')}
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

      <Dialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o)
          if (!o) setFormInitialRow(null)
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto w-[min(96vw,56rem)] max-w-none p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 border-b">
            <DialogTitle>{formTitle}</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-4 pt-2">
            {formInitialRow ? (
              <TourHotelBookingForm
                key={formMode === 'copy' ? `copy-${formInitialRow.id}` : formInitialRow.id}
                booking={
                  {
                    ...formInitialRow,
                    id: formMode === 'copy' ? undefined : formInitialRow.id,
                    tour_id: formInitialRow.tour_id ?? '',
                    check_in_date: formInitialRow.check_in_date,
                    check_out_date: formInitialRow.check_out_date,
                    reservation_name: formInitialRow.reservation_name,
                    submitted_by: formInitialRow.submitted_by ?? '',
                    cc: formInitialRow.cc ?? 'not_sent',
                    rooms: formInitialRow.rooms ?? 1,
                    city: formInitialRow.city,
                    hotel: formInitialRow.hotel,
                    room_type: formInitialRow.room_type ?? '',
                    unit_price: formInitialRow.unit_price ?? 0,
                    total_price: formInitialRow.total_price ?? 0,
                    payment_method: formInitialRow.payment_method ?? '',
                    website: formInitialRow.website ?? '',
                    rn_number: formInitialRow.rn_number ?? '',
                    status: formInitialRow.status ?? 'pending',
                    event_date: formInitialRow.event_date,
                    uploaded_file_urls: formInitialRow.uploaded_file_urls ?? []
                  } as ComponentProps<typeof TourHotelBookingForm>['booking']
                }
                tourId={formInitialRow.tour_id || undefined}
                onSave={() => {
                  setFormOpen(false)
                  setFormInitialRow(null)
                  setSelectedIds(new Set())
                  void loadRows()
                }}
                onCancel={() => {
                  setFormOpen(false)
                  setFormInitialRow(null)
                }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <ExpenseStatementSimilarLinesModal
        open={stmtOpen}
        onOpenChange={setStmtOpen}
        context={stmtCtx}
        onApplied={() => {
          void fetchReconciledSourceIdsBatched(supabase, 'tour_hotel_bookings', visibleIds).then(setReconciledIds)
        }}
      />
    </div>
  )
}
