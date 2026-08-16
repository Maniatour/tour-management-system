'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Database,
  Link2,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import TicketBookingCardView, {
  type DayTourCompareSummary,
  type TicketBookingCardViewRow,
} from '@/components/booking/TicketBookingCardView'
import type { TicketBookingCardActionHandlers } from '@/components/booking/TicketBookingCardActionBar'
import ZelleEmailPreviewModal from '@/components/booking/ZelleEmailPreview'
import {
  buildZelleReconQueue,
  formatZelleDayHeading,
  formatZelleMonthChip,
  formatZelleMonthHeading,
  formatZelleYearHeading,
  lasVegasTodayYmd,
  lasVegasYear,
  lasVegasYearMonth,
  leftoverNearBundle,
  shiftYear,
  shiftYearMonth,
  zellePaymentYmd,
  type ZelleReconBundle,
  type ZelleSyncListItem,
} from '@/lib/zelleDbSyncDayGroups'
import { bookingHasZelleAttachment } from '@/lib/zelleEmailAttachment'
import {
  formatZelleConfirmationDisplay,
  mergeZelleConfirmationNumbers,
} from '@/lib/zellePaymentEmail'

type ZelleMatchStatus =
  | 'skipped'
  | 'paid'
  | 'partial'
  | 'unmatched'
  | 'amount_mismatch'
  | 'parse_failed'
  | 'pending'

type PreviewRow = ZelleSyncListItem & {
  status: ZelleMatchStatus | 'pending'
}

type QueueTab = 'review' | 'exact' | 'done'

/** 헤더·데이터 행이 같은 열을 쓰도록 너비를 고정한다. */
const BUNDLE_GRID =
  'grid grid-cols-1 gap-y-1.5 px-3 py-2.5 md:grid-cols-[6.75rem_10.5rem_6rem_minmax(7.5rem,1fr)_6rem_5.5rem_8.5rem] md:items-center md:gap-x-3 md:gap-y-0'

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatDelta(n: number, locale: string): string {
  const abs = formatUsd(Math.abs(n))
  if (Math.abs(n) <= 0.51) return locale === 'ko' ? '$0' : '$0'
  return n > 0 ? `+${abs}` : `−${abs}`
}

function formatCardDate(ymd: string | null | undefined, locale: string): string | null {
  const s = ymd?.trim()
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  return dt.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  })
}

function bookingRnLabel(b: TicketBookingCardViewRow): string {
  const rn = String(b.rn_number ?? b.invoice_number ?? '').trim() || b.id.slice(0, 8)
  return rn.startsWith('#') ? rn : `#${rn}`
}

function bundleRnLabel(bundle: ZelleReconBundle<TicketBookingCardViewRow>): string {
  const rns = bundle.bookings.map(bookingRnLabel)
  if (rns.length === 0) return '—'
  if (rns.length <= 3) return rns.join(' + ')
  return `${rns.slice(0, 2).join(' + ')} +${rns.length - 2}`
}

function bundleConfLabel(bundle: ZelleReconBundle<TicketBookingCardViewRow>): string {
  const fromZelle = bundle.zelleItems
    .map((z) => formatZelleConfirmationDisplay(z.confirmationNumber))
    .filter(Boolean)
  if (fromZelle.length > 0) return [...new Set(fromZelle)].join(', ')
  const fromBookings = bundle.bookings
    .map((b) => formatZelleConfirmationDisplay(b.zelle_confirmation_number))
    .filter(Boolean)
  return fromBookings.length > 0 ? [...new Set(fromBookings)].join(', ') : '—'
}

function CompactZelleRow({
  item,
  locale,
  selected,
  onSelect,
  onOpenEmail,
  onReparse,
  reparsing,
}: {
  item: ZelleSyncListItem
  locale: string
  selected?: boolean
  onSelect?: () => void
  onOpenEmail?: () => void
  onReparse?: () => void
  reparsing?: boolean
}) {
  const ko = locale === 'ko'
  const conf = formatZelleConfirmationDisplay(item.confirmationNumber)
  const dateLabel = formatCardDate(zellePaymentYmd(item), locale)
  const memo = String(item.memo ?? '').trim()
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 text-xs ${
        selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-gray-200 bg-white'
      } ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold tabular-nums">
          {item.amount != null ? formatUsd(item.amount) : '—'}
        </span>
        {dateLabel ? <span className="text-gray-600">{dateLabel}</span> : null}
        <span className={`font-mono font-semibold ${conf ? 'text-slate-900' : 'text-amber-800'}`}>
          Conf {conf || '—'}
        </span>
        {item.status === 'parse_failed' ? (
          <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-800">
            {ko ? '파싱 실패' : 'Parse failed'}
          </span>
        ) : null}
        {onOpenEmail ? (
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] hover:bg-gray-50"
            onClick={(e) => {
              e.stopPropagation()
              onOpenEmail()
            }}
          >
            <Mail className="h-3 w-3" />
            {ko ? '메일' : 'Email'}
          </button>
        ) : null}
        {item.status === 'parse_failed' && onReparse ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] text-rose-900 disabled:opacity-50"
            disabled={reparsing}
            onClick={(e) => {
              e.stopPropagation()
              onReparse()
            }}
          >
            {reparsing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            {ko ? '다시 파싱' : 'Re-parse'}
          </button>
        ) : null}
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-snug text-gray-700">
        <span className="font-medium text-gray-500">{ko ? 'Memo ' : 'Memo '}</span>
        {memo || '—'}
      </p>
    </div>
  )
}

export default function TicketBookingZelleDbSyncModal({
  open,
  locale,
  bookings,
  onClose,
  onApplied,
  onOpenBooking,
  getCancelDueDate,
  actionHandlers,
  onSaveNote,
  onAddDocuments,
  onRemoveDocument,
  onSaveInvoiceNumber,
  onSaveAmounts,
  zelleAttachmentMap,
}: {
  open: boolean
  locale: string
  bookings: TicketBookingCardViewRow[]
  dayTourCompareByDate?: Map<string, DayTourCompareSummary>
  tourPeopleReservationsSummary?: (tourPeople: number, reservations: number) => string
  onClose: () => void
  onApplied: () => void
  onOpenBooking?: (booking: TicketBookingCardViewRow) => void
  getCancelDueDate?: (booking: TicketBookingCardViewRow) => string | null
  actionHandlers?: TicketBookingCardActionHandlers
  onSaveNote?: (booking: TicketBookingCardViewRow, note: string) => void | Promise<void>
  onAddDocuments?: (booking: TicketBookingCardViewRow, files: File[]) => void | Promise<void>
  onRemoveDocument?: (booking: TicketBookingCardViewRow, index: number) => void | Promise<void>
  onSaveInvoiceNumber?: (bookingId: string, invoiceNumber: string) => void | Promise<void>
  onSaveAmounts?: (
    bookingId: string,
    amounts: { expense: number; paid_amount: number }
  ) => void | Promise<void>
  zelleAttachmentMap?: Map<string, string[]>
}) {
  const ko = locale === 'ko'
  const todayYmd = lasVegasTodayYmd()
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reprocessUnmatched, setReprocessUnmatched] = useState(false)
  const [queueTab, setQueueTab] = useState<QueueTab>('review')
  const [periodMode, setPeriodMode] = useState<'month' | 'year'>('month')
  const [progress, setProgress] = useState<string | null>(null)
  const [monthKey, setMonthKey] = useState(lasVegasYearMonth)
  const [yearKey, setYearKey] = useState(lasVegasYear)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [invoiceOverlay, setInvoiceOverlay] = useState<Record<string, string>>({})
  const [amountOverlay, setAmountOverlay] = useState<
    Record<string, { expense: number; paid_amount: number }>
  >({})
  const [confOverlay, setConfOverlay] = useState<Record<string, string>>({})
  const [viewingEmailId, setViewingEmailId] = useState<string | null>(null)
  const [selectedZelleIds, setSelectedZelleIds] = useState<string[]>([])
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [reparsingId, setReparsingId] = useState<string | null>(null)
  const listScrollRef = useRef<HTMLDivElement>(null)
  const listScrollTopRef = useRef(0)
  const wasOpenRef = useRef(false)

  const loadPreview = useCallback(async () => {
    setError(null)
    const scrollEl = listScrollRef.current
    if (scrollEl) listScrollTopRef.current = scrollEl.scrollTop
    else setLoading(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/ticket-bookings/zelle-db-sync')
      const data = (await res.json().catch(() => ({}))) as {
        items?: PreviewRow[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || res.statusText)
      setPreview(data.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }
    const justOpened = !wasOpenRef.current
    wasOpenRef.current = true
    if (!justOpened) return
    setProgress(null)
    setSelectedMonth(null)
    setPeriodMode('month')
    setQueueTab('review')
    setMonthKey(lasVegasYearMonth())
    setYearKey(lasVegasYear())
    setSelectedZelleIds([])
    setSelectedBookingIds([])
    setExpandedId(null)
    setConfOverlay({})
    listScrollTopRef.current = 0
    void loadPreview()
  }, [open, loadPreview])

  const bookingsForGroups = useMemo(() => {
    const hasInv = Object.keys(invoiceOverlay).length > 0
    const hasAmt = Object.keys(amountOverlay).length > 0
    const hasConf = Object.keys(confOverlay).length > 0
    if (!hasInv && !hasAmt && !hasConf) return bookings
    return bookings.map((b) => {
      let next = b
      if (hasInv && Object.prototype.hasOwnProperty.call(invoiceOverlay, b.id)) {
        next = { ...next, invoice_number: invoiceOverlay[b.id] }
      }
      const amt = amountOverlay[b.id]
      if (amt) next = { ...next, expense: amt.expense, paid_amount: amt.paid_amount }
      if (hasConf && Object.prototype.hasOwnProperty.call(confOverlay, b.id)) {
        next = { ...next, zelle_confirmation_number: confOverlay[b.id] }
      }
      return next
    })
  }, [bookings, invoiceOverlay, amountOverlay, confOverlay])

  const saveInvoiceNumber = useCallback(
    async (bookingId: string, invoiceNumber: string) => {
      setInvoiceOverlay((prev) => ({ ...prev, [bookingId]: invoiceNumber }))
      try {
        await onSaveInvoiceNumber?.(bookingId, invoiceNumber)
      } catch (err) {
        setInvoiceOverlay((prev) => {
          const next = { ...prev }
          delete next[bookingId]
          return next
        })
        throw err
      }
    },
    [onSaveInvoiceNumber]
  )

  const saveAmounts = useCallback(
    async (bookingId: string, amounts: { expense: number; paid_amount: number }) => {
      setAmountOverlay((prev) => ({ ...prev, [bookingId]: amounts }))
      try {
        await onSaveAmounts?.(bookingId, amounts)
      } catch (err) {
        setAmountOverlay((prev) => {
          const next = { ...prev }
          delete next[bookingId]
          return next
        })
        throw err
      }
    },
    [onSaveAmounts]
  )

  const periodKey = periodMode === 'year' ? yearKey : monthKey

  const queue = useMemo(
    () => buildZelleReconQueue(preview, bookingsForGroups, periodKey),
    [preview, bookingsForGroups, periodKey]
  )

  const monthFiltered = useMemo(() => {
    if (periodMode !== 'year' || !selectedMonth) return queue
    const prefix = `${selectedMonth}-`
    return {
      bundles: queue.bundles.filter((b) => b.dateYmd?.startsWith(prefix)),
      leftoverZelles: queue.leftoverZelles.filter((z) => zellePaymentYmd(z)?.startsWith(prefix)),
      leftoverBookings: queue.leftoverBookings.filter((b) =>
        String(b.check_in_date ?? '').startsWith(prefix)
      ),
    }
  }, [queue, periodMode, selectedMonth])

  const monthChips = useMemo(() => {
    const counts = new Map<string, number>()
    const bump = (ymd: string | null | undefined) => {
      const ym = ymd?.slice(0, 7)
      if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return
      counts.set(ym, (counts.get(ym) ?? 0) + 1)
    }
    for (const b of queue.bundles) bump(b.dateYmd)
    for (const z of queue.leftoverZelles) bump(zellePaymentYmd(z))
    for (const b of queue.leftoverBookings) bump(String(b.check_in_date ?? '').slice(0, 10))
    return [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [queue])

  const exactBundles = monthFiltered.bundles.filter((b) => b.kind === 'exact')
  const mismatchBundles = monthFiltered.bundles.filter((b) => b.kind === 'mismatch')
  const doneBundles = monthFiltered.bundles.filter((b) => b.kind === 'done')
  const leftoverZelles = monthFiltered.leftoverZelles
  const leftoverBookings = monthFiltered.leftoverBookings
  const oneSideCount = leftoverZelles.length + leftoverBookings.length
  const reviewCount = mismatchBundles.length + oneSideCount
  const unresolvedDelta =
    mismatchBundles.reduce((s, b) => s + b.delta, 0) +
    leftoverBookings.reduce((s, b) => s + Number(b.expense ?? 0), 0) -
    leftoverZelles.reduce((s, z) => s + (z.amount ?? 0), 0)

  const visibleBundles =
    queueTab === 'exact' ? exactBundles : queueTab === 'done' ? doneBundles : mismatchBundles

  useEffect(() => {
    const el = listScrollRef.current
    if (!el) return
    const top = listScrollTopRef.current
    const restore = () => {
      el.scrollTop = top
    }
    restore()
    const id = requestAnimationFrame(restore)
    return () => cancelAnimationFrame(id)
  }, [preview])

  const parseFailedCount = useMemo(
    () => preview.filter((item) => item.status === 'parse_failed').length,
    [preview]
  )

  const runSync = async (opts?: { reparseFailed?: boolean; importIds?: string[] }) => {
    const reparseFailed = opts?.reparseFailed === true
    const reparseToken = reparseFailed ? `${Date.now()}` : undefined
    setSyncing(true)
    setError(null)
    setProgress(null)
    let done = 0
    let skippedTotal = 0
    let recovered = 0
    let fetchedTotal = 0
    try {
      let remaining = 1
      while (remaining > 0) {
        const res = await fetchApiWithAuth('/api/admin/ticket-bookings/zelle-db-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reprocessUnmatched: reparseFailed ? false : reprocessUnmatched,
            reparseFailed,
            reparseToken,
            importIds: opts?.importIds,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          items?: Array<{ status: string }>
          remaining?: number
          fetchedBodies?: number
          skippedVendors?: number
          gmailError?: string | null
          error?: string
        }
        if (!res.ok) throw new Error(data.error || res.statusText)
        const batch = data.items ?? []
        done += batch.length
        skippedTotal += data.skippedVendors ?? 0
        fetchedTotal += data.fetchedBodies ?? 0
        recovered += batch.filter((i) => i.status !== 'parse_failed' && i.status !== 'skipped').length
        remaining = data.remaining ?? 0
        setProgress(
          ko
            ? `${reparseFailed ? '다시 파싱' : 'SEE CANYON'} ${done}건${
                recovered ? ` · 복구 ${recovered}건` : ''
              }${skippedTotal ? ` · 다른 수신인 ${skippedTotal}건 제외` : ''}${
                fetchedTotal ? ` · Gmail 본문 ${fetchedTotal}건` : ''
              }${remaining > 0 ? ` · 남은 ${remaining}건` : ''}`
            : `${reparseFailed ? 'Re-parse' : 'SEE CANYON'} ${done}${
                recovered ? ` · recovered ${recovered}` : ''
              }${skippedTotal ? ` · skipped ${skippedTotal}` : ''}${remaining > 0 ? ` · ${remaining} left` : ''}`
        )
        await loadPreview()
        if (data.gmailError) {
          setError(data.gmailError)
          break
        }
        if (remaining <= 0) break
        if (
          !reparseFailed &&
          batch.length > 0 &&
          (data.fetchedBodies ?? 0) === 0 &&
          batch.every((i) => i.status === 'parse_failed')
        ) {
          break
        }
        if (batch.length === 0 && (data.skippedVendors ?? 0) === 0) break
      }
      onApplied()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
  }

  const reparseOne = async (importId: string) => {
    setReparsingId(importId)
    try {
      await runSync({ reparseFailed: true, importIds: [importId] })
    } finally {
      setReparsingId(null)
    }
  }

  const applyGroups = async (groups: Array<{ importIds: string[]; bookingIds: string[] }>) => {
    const usable = groups.filter((g) => g.importIds.length > 0 && g.bookingIds.length > 0)
    if (usable.length === 0) return
    setLinking(true)
    setError(null)
    try {
      let paid = 0
      let attached = 0
      let zelleCount = 0
      let bookingCount = 0
      for (const group of usable) {
        const res = await fetchApiWithAuth('/api/admin/ticket-bookings/zelle-db-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'link',
            importIds: group.importIds,
            bookingIds: group.bookingIds,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          paid?: number
          attached?: number
          error?: string | null
        }
        if (!res.ok) throw new Error(data.error || res.statusText)
        if (data.error) throw new Error(data.error)
        paid += data.paid ?? 0
        attached += data.attached ?? 0
        zelleCount += group.importIds.length
        bookingCount += group.bookingIds.length
        const incomingConf = group.importIds.reduce((acc, id) => {
          const item = preview.find((row) => row.id === id)
          return mergeZelleConfirmationNumbers(acc, item?.confirmationNumber)
        }, '')
        if (incomingConf) {
          setConfOverlay((prev) => {
            const next = { ...prev }
            for (const bookingId of group.bookingIds) {
              const existing =
                next[bookingId] ??
                bookings.find((b) => b.id === bookingId)?.zelle_confirmation_number ??
                ''
              next[bookingId] = mergeZelleConfirmationNumbers(existing, incomingConf)
            }
            return next
          })
        }
      }
      setProgress(
        ko
          ? `Zelle ${zelleCount}건 ↔ 입장권 ${bookingCount}건 · 지불 ${paid} · 메일 첨부 ${attached}`
          : `Zelle ${zelleCount} ↔ tickets ${bookingCount} · paid ${paid} · attached ${attached}`
      )
      setSelectedZelleIds([])
      setSelectedBookingIds([])
      setExpandedId(null)
      await loadPreview()
      onApplied()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLinking(false)
    }
  }

  const applyBundle = (bundle: ZelleReconBundle<TicketBookingCardViewRow>, extraZelleIds: string[] = [], extraBookingIds: string[] = []) =>
    applyGroups([
      {
        importIds: [...new Set([...bundle.zelleItems.map((z) => z.id), ...extraZelleIds])],
        bookingIds: [...new Set([...bundle.bookings.map((b) => b.id), ...extraBookingIds])],
      },
    ])

  const toggleZelleSelect = (id: string) => {
    setSelectedZelleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleBookingSelect = (bookingId: string) => {
    setSelectedBookingIds((prev) =>
      prev.includes(bookingId) ? prev.filter((id) => id !== bookingId) : [...prev, bookingId]
    )
  }

  const toggleBundleSelect = (bundle: ZelleReconBundle<TicketBookingCardViewRow>) => {
    const zIds = bundle.zelleItems.map((z) => z.id)
    const bIds = bundle.bookings.map((b) => b.id)
    const allOn =
      zIds.every((id) => selectedZelleIds.includes(id)) &&
      bIds.every((id) => selectedBookingIds.includes(id))
    if (allOn) {
      setSelectedZelleIds((prev) => prev.filter((id) => !zIds.includes(id)))
      setSelectedBookingIds((prev) => prev.filter((id) => !bIds.includes(id)))
      return
    }
    setSelectedZelleIds((prev) => [...new Set([...prev, ...zIds])])
    setSelectedBookingIds((prev) => [...new Set([...prev, ...bIds])])
  }

  if (!open) return null

  const renderBundleRow = (bundle: ZelleReconBundle<TicketBookingCardViewRow>) => {
    const expanded = expandedId === bundle.id
    const nearby = leftoverNearBundle(bundle, leftoverZelles, leftoverBookings)
    const deltaClass =
      Math.abs(bundle.delta) <= 0.51
        ? 'text-emerald-800'
        : bundle.delta < 0
          ? 'text-amber-800'
          : 'text-rose-800'
    return (
      <div
        key={bundle.id}
        className={`border-b border-gray-100 last:border-b-0 ${
          bundle.kind === 'exact'
            ? 'bg-emerald-50/50'
            : bundle.kind === 'done'
              ? 'bg-white'
              : 'bg-amber-50/50'
        }`}
      >
        <div className={BUNDLE_GRID}>
          <div>
            <p className="text-[11px] text-gray-500 md:hidden">{ko ? '송금일' : 'Date'}</p>
            <p className="text-xs font-medium text-gray-800">
              {bundle.dateYmd ? formatZelleDayHeading(bundle.dateYmd, locale) : '—'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-500 md:hidden">Conf</p>
            <p className="truncate font-mono text-xs font-semibold text-slate-900" title={bundleConfLabel(bundle)}>
              {bundleConfLabel(bundle)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 md:hidden">{ko ? '송금' : 'Zelle'}</p>
            <p className="text-xs font-semibold tabular-nums md:text-right">{formatUsd(bundle.zelleSum)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-500 md:hidden">RN</p>
            <p className="truncate text-xs text-gray-800" title={bundleRnLabel(bundle)}>
              {bundleRnLabel(bundle)}
              <span className="ml-1 text-gray-500">
                {bundle.bookings.length}
                {ko ? '건' : ''}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 md:hidden">{ko ? '입장권 합' : 'Tickets'}</p>
            <p className="text-xs font-semibold tabular-nums md:text-right">{formatUsd(bundle.ticketSum)}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 md:hidden">{ko ? '차액' : 'Delta'}</p>
            <p className={`text-xs font-semibold tabular-nums md:text-right ${deltaClass}`}>
              {formatDelta(bundle.delta, locale)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1 md:justify-end">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-white"
              onClick={() => setExpandedId((cur) => (cur === bundle.id ? null : bundle.id))}
            >
              {expanded ? (ko ? '접기' : 'Hide') : ko ? '상세' : 'Details'}
            </button>
            {bundle.kind === 'exact' ? (
              <button
                type="button"
                disabled={linking || syncing}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                onClick={() => void applyBundle(bundle)}
              >
                {linking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                {ko ? '확인' : 'Confirm'}
              </button>
            ) : bundle.kind === 'mismatch' ? (
              <button
                type="button"
                className="rounded-lg bg-amber-800 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-amber-900"
                onClick={() => {
                  setExpandedId(bundle.id)
                  toggleBundleSelect(bundle)
                }}
              >
                {ko ? '묶기' : 'Match'}
              </button>
            ) : null}
          </div>
        </div>
        {expanded ? (
          <div className="space-y-3 border-t border-black/5 px-3 py-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  {ko ? 'Zelle 송금' : 'Zelle'}
                </p>
                {bundle.zelleItems.map((item) => (
                  <CompactZelleRow
                    key={item.id}
                    item={item}
                    locale={locale}
                    selected={selectedZelleIds.includes(item.id)}
                    onSelect={() => toggleZelleSelect(item.id)}
                    onOpenEmail={() => setViewingEmailId(item.id)}
                    onReparse={() => void reparseOne(item.id)}
                    reparsing={reparsingId === item.id}
                  />
                ))}
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  {ko ? '입장권' : 'Tickets'}
                </p>
                <div className="flex flex-wrap gap-1">
                  {bundle.bookings.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleBookingSelect(b.id)}
                      className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                        selectedBookingIds.includes(b.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-white text-gray-800 ring-1 ring-gray-300'
                      }`}
                    >
                      {bookingRnLabel(b)}
                      {formatZelleConfirmationDisplay(b.zelle_confirmation_number)
                        ? ` · ${formatZelleConfirmationDisplay(b.zelle_confirmation_number)}`
                        : ''}
                    </button>
                  ))}
                </div>
                <TicketBookingCardView
                  bookings={bundle.bookings}
                  locale={locale}
                  todayYmd={todayYmd}
                  getCancelDueDate={getCancelDueDate ?? (() => null)}
                  onOpenBooking={onOpenBooking ?? (() => undefined)}
                  flat
                  allowOpenWhenFlat={Boolean(onOpenBooking)}
                  density="compact"
                  hideAmounts={false}
                  showCheckInDate
                  actionHandlers={actionHandlers}
                  onSaveNote={onSaveNote}
                  onAddDocuments={onAddDocuments}
                  onRemoveDocument={onRemoveDocument}
                  onSaveInvoiceNumber={saveInvoiceNumber}
                  onSaveAmounts={onSaveAmounts ? saveAmounts : undefined}
                />
              </div>
            </div>
            {bundle.kind !== 'done' && (nearby.zelles.length > 0 || nearby.bookings.length > 0) ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white/70 p-2">
                <p className="mb-1.5 text-[11px] font-semibold text-gray-700">
                  {ko ? '±3일 잔여 후보 — 골라 이 줄에 더합니다' : 'Leftovers within ±3 days'}
                </p>
                <div className="space-y-1.5">
                  {nearby.zelles.map((item) => (
                    <CompactZelleRow
                      key={item.id}
                      item={item}
                      locale={locale}
                      selected={selectedZelleIds.includes(item.id)}
                      onSelect={() => toggleZelleSelect(item.id)}
                      onOpenEmail={() => setViewingEmailId(item.id)}
                      onReparse={() => void reparseOne(item.id)}
                      reparsing={reparsingId === item.id}
                    />
                  ))}
                  {nearby.bookings.map((b) => {
                    const on = selectedBookingIds.includes(b.id)
                    return (
                      <div
                        key={b.id}
                        className={`rounded-xl p-1 ${
                          on ? 'bg-primary/5 ring-2 ring-primary' : 'ring-1 ring-amber-300'
                        }`}
                      >
                        <button
                          type="button"
                          className={`mb-1 rounded-full px-2 py-1 text-[11px] font-medium ${
                            on
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-white text-amber-950 ring-1 ring-amber-300'
                          }`}
                          onClick={() => toggleBookingSelect(b.id)}
                        >
                          {on
                            ? ko
                              ? `선택됨 ${bookingRnLabel(b)}`
                              : `Selected ${bookingRnLabel(b)}`
                            : ko
                              ? `이 줄에 더하기 ${bookingRnLabel(b)} · ${formatUsd(Number(b.expense ?? 0))}`
                              : `Add ${bookingRnLabel(b)} · ${formatUsd(Number(b.expense ?? 0))}`}
                        </button>
                        <TicketBookingCardView
                          bookings={[b]}
                          locale={locale}
                          todayYmd={todayYmd}
                          getCancelDueDate={getCancelDueDate ?? (() => null)}
                          onOpenBooking={onOpenBooking ?? (() => undefined)}
                          flat
                          allowOpenWhenFlat={Boolean(onOpenBooking)}
                          density="compact"
                          hideAmounts={false}
                          showCheckInDate
                          actionHandlers={actionHandlers}
                          onSaveNote={onSaveNote}
                          onAddDocuments={onAddDocuments}
                          onRemoveDocument={onRemoveDocument}
                          onSaveInvoiceNumber={saveInvoiceNumber}
                          onSaveAmounts={onSaveAmounts ? saveAmounts : undefined}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
            {bundle.kind !== 'done' ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={linking || syncing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                  onClick={() =>
                    void applyBundle(bundle, selectedZelleIds, selectedBookingIds)
                  }
                >
                  {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  {ko ? '이 줄 연결·지불' : 'Link this row'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => !syncing && onClose()}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {ko ? 'Zelle 지출 연동 확인' : 'Review Zelle expenses'}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                {ko
                  ? '입력한 입장권 합과 실제 Zelle 송금이 같은지 차액부터 맞춥니다.'
                  : 'Match entered ticket totals to actual Zelle payments, starting with the difference.'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  className={`rounded-md px-2.5 py-1.5 ${
                    periodMode === 'month'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  onClick={() => {
                    setPeriodMode('month')
                    if (selectedMonth) setMonthKey(selectedMonth)
                    else setMonthKey(`${yearKey}-${monthKey.slice(5, 7)}`)
                    setSelectedMonth(null)
                  }}
                >
                  {ko ? '월별 보기' : 'Monthly'}
                </button>
                <button
                  type="button"
                  className={`rounded-md px-2.5 py-1.5 ${
                    periodMode === 'year'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  onClick={() => {
                    setPeriodMode('year')
                    setYearKey(monthKey.slice(0, 4))
                    setSelectedMonth(null)
                  }}
                >
                  {ko ? '연간 보기' : 'Yearly'}
                </button>
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  className="rounded-lg p-2 text-gray-700 hover:bg-white"
                  aria-label={periodMode === 'year' ? (ko ? '이전 해' : 'Previous year') : ko ? '이전 달' : 'Previous month'}
                  onClick={() => {
                    if (periodMode === 'year') {
                      setYearKey((y) => shiftYear(y, -1))
                      setSelectedMonth(null)
                    } else {
                      setMonthKey((m) => shiftYearMonth(m, -1))
                    }
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[7.5rem] text-center text-sm font-semibold text-gray-900">
                  {periodMode === 'year'
                    ? formatZelleYearHeading(yearKey, locale)
                    : formatZelleMonthHeading(monthKey, locale)}
                </span>
                <button
                  type="button"
                  className="rounded-lg p-2 text-gray-700 hover:bg-white"
                  aria-label={periodMode === 'year' ? (ko ? '다음 해' : 'Next year') : ko ? '다음 달' : 'Next month'}
                  onClick={() => {
                    if (periodMode === 'year') {
                      setYearKey((y) => shiftYear(y, 1))
                      setSelectedMonth(null)
                    } else {
                      setMonthKey((m) => shiftYearMonth(m, 1))
                    }
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          ref={listScrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4"
          onScroll={(e) => {
            listScrollTopRef.current = e.currentTarget.scrollTop
          }}
        >
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          {loading && preview.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {ko ? '목록 불러오는 중…' : 'Loading…'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                <p className="text-lg font-semibold tabular-nums text-emerald-950">{exactBundles.length}</p>
                <p className="text-[11px] text-emerald-900">{ko ? '자동 일치 대기' : 'Ready to confirm'}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
                <p className="text-lg font-semibold tabular-nums text-amber-950">{mismatchBundles.length}</p>
                <p className="text-[11px] text-amber-900">{ko ? '금액 불일치' : 'Amount mismatch'}</p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2">
                <p className="text-lg font-semibold tabular-nums text-rose-950">{oneSideCount}</p>
                <p className="text-[11px] text-rose-900">{ko ? '한쪽만 있음' : 'One side only'}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-lg font-semibold tabular-nums text-gray-900">
                  {formatDelta(Math.round(unresolvedDelta * 100) / 100, locale)}
                </p>
                <p className="text-[11px] text-gray-600">{ko ? '미해결 차액' : 'Unresolved net'}</p>
              </div>
            </div>
          )}
          {progress ? <p className="text-xs text-violet-800">{progress}</p> : null}

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs font-medium">
              {([
                ['review', ko ? `검토 필요 ${reviewCount}` : `Needs review ${reviewCount}`],
                ['exact', ko ? `자동 일치 ${exactBundles.length}` : `Matched ${exactBundles.length}`],
                ['done', ko ? `완료 ${doneBundles.length}` : `Done ${doneBundles.length}`],
              ] as Array<[QueueTab, string]>).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`rounded-md px-2.5 py-1.5 ${
                    queueTab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  onClick={() => {
                    setQueueTab(id)
                    setExpandedId(null)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {queueTab === 'exact' && exactBundles.length > 0 ? (
              <button
                type="button"
                disabled={linking || syncing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                onClick={() =>
                  void applyGroups(
                    exactBundles.map((b) => ({
                      importIds: b.zelleItems.map((z) => z.id),
                      bookingIds: b.bookings.map((row) => row.id),
                    }))
                  )
                }
              >
                {linking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                {ko ? `일치 ${exactBundles.length}건 모두 확인` : `Confirm all ${exactBundles.length}`}
              </button>
            ) : null}
            <label className="ml-auto flex items-center gap-2 text-[11px] text-gray-600">
              <input
                type="checkbox"
                checked={reprocessUnmatched}
                onChange={(e) => setReprocessUnmatched(e.target.checked)}
                disabled={syncing}
              />
              {ko ? '동기화 시 미매칭도 다시 처리' : 'Reprocess unmatched on sync'}
            </label>
          </div>

          {periodMode === 'year' && monthChips.length > 0 ? (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedMonth(null)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                  selectedMonth == null ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {ko ? '연간 전체' : 'Full year'}
              </button>
              {monthChips.map(([ym, count]) => (
                <button
                  key={ym}
                  type="button"
                  onClick={() => setSelectedMonth((cur) => (cur === ym ? null : ym))}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                    selectedMonth === ym
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {formatZelleMonthChip(ym, locale)} · {count}
                </button>
              ))}
            </div>
          ) : null}

          {visibleBundles.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <div
                className={`${BUNDLE_GRID} hidden border-b border-gray-200 bg-slate-50 text-[11px] font-medium uppercase tracking-wide text-gray-500 md:grid`}
              >
                <span>{ko ? '송금일' : 'Date'}</span>
                <span>Conf</span>
                <span className="text-right">{ko ? '송금' : 'Zelle'}</span>
                <span>RN</span>
                <span className="text-right">{ko ? '입장권 합' : 'Tickets'}</span>
                <span className="text-right">{ko ? '차액' : 'Delta'}</span>
                <span className="text-right">{ko ? '동작' : 'Action'}</span>
              </div>
              <div>{visibleBundles.map(renderBundleRow)}</div>
            </div>
          ) : null}

          {visibleBundles.length === 0 && (queueTab !== 'review' || oneSideCount === 0) && !loading ? (
            <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
              {queueTab === 'exact'
                ? ko
                  ? '금액이 맞는 대기 건이 없습니다.'
                  : 'No exact matches waiting.'
                : queueTab === 'done'
                  ? ko
                    ? '이 기간에 완료된 연동이 없습니다.'
                    : 'No completed matches this period.'
                  : ko
                    ? '검토할 불일치·미연결 건이 없습니다.'
                    : 'Nothing left to review.'}
            </p>
          ) : null}

          {queueTab === 'review' ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/40 p-3">
                <p className="mb-2 text-xs font-semibold text-rose-950">
                  {ko ? `Zelle만 ${leftoverZelles.length}건` : `Zelle only ${leftoverZelles.length}`}
                </p>
                {leftoverZelles.length === 0 ? (
                  <p className="text-xs text-rose-800/80">{ko ? '남은 송금 없음' : 'No leftover transfers'}</p>
                ) : (
                  <div className="space-y-1.5">
                    {leftoverZelles.map((item) => (
                      <CompactZelleRow
                        key={item.id}
                        item={item}
                        locale={locale}
                        selected={selectedZelleIds.includes(item.id)}
                        onSelect={() => toggleZelleSelect(item.id)}
                        onOpenEmail={() => setViewingEmailId(item.id)}
                        onReparse={() => void reparseOne(item.id)}
                        reparsing={reparsingId === item.id}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 p-3">
                <p className="mb-2 text-xs font-semibold text-amber-950">
                  {ko
                    ? `입장권만 ${leftoverBookings.length}건`
                    : `Tickets only ${leftoverBookings.length}`}
                </p>
                {leftoverBookings.length === 0 ? (
                  <p className="text-xs text-amber-800/80">{ko ? '남은 입장권 없음' : 'No leftover tickets'}</p>
                ) : (
                  <>
                    <div className="mb-2 flex flex-wrap gap-1">
                      {leftoverBookings.map((b) => {
                        const missingFile = !bookingHasZelleAttachment(b, zelleAttachmentMap)
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => toggleBookingSelect(b.id)}
                            className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                              selectedBookingIds.includes(b.id)
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-white text-gray-800 ring-1 ring-amber-300'
                            }`}
                          >
                            {bookingRnLabel(b)} · {formatUsd(Number(b.expense ?? 0))}
                            {missingFile ? (ko ? ' · 미첨부' : ' · no file') : ''}
                          </button>
                        )
                      })}
                    </div>
                    {leftoverBookings.length <= 12 ||
                    leftoverBookings.some((b) => selectedBookingIds.includes(b.id)) ? (
                      <TicketBookingCardView
                        bookings={
                          leftoverBookings.length <= 12
                            ? leftoverBookings
                            : leftoverBookings.filter((b) => selectedBookingIds.includes(b.id))
                        }
                        locale={locale}
                        todayYmd={todayYmd}
                        getCancelDueDate={getCancelDueDate ?? (() => null)}
                        onOpenBooking={onOpenBooking ?? (() => undefined)}
                        flat
                        allowOpenWhenFlat={Boolean(onOpenBooking)}
                        density="compact"
                        hideAmounts={false}
                        showCheckInDate
                        actionHandlers={actionHandlers}
                        onSaveNote={onSaveNote}
                        onAddDocuments={onAddDocuments}
                        onRemoveDocument={onRemoveDocument}
                        onSaveInvoiceNumber={saveInvoiceNumber}
                        onSaveAmounts={onSaveAmounts ? saveAmounts : undefined}
                      />
                    ) : (
                      <p className="text-[11px] text-amber-900">
                        {ko
                          ? '입장권이 많아 칩만 보여 줍니다. 고르면 카드가 나옵니다.'
                          : 'Too many tickets to list as cards. Select chips to open them.'}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          {selectedZelleIds.length > 0 || selectedBookingIds.length > 0 ? (
            <p className="mr-auto text-xs text-gray-600">
              {ko
                ? `선택 Zelle ${selectedZelleIds.length}건 · 입장권 ${selectedBookingIds.length}건`
                : `Selected ${selectedZelleIds.length} Zelle · ${selectedBookingIds.length} tickets`}
            </p>
          ) : null}
          <button
            type="button"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            disabled={syncing}
            onClick={onClose}
          >
            {ko ? '닫기' : 'Close'}
          </button>
          {selectedZelleIds.length > 0 && selectedBookingIds.length > 0 ? (
            <button
              type="button"
              disabled={linking || syncing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              onClick={() =>
                void applyGroups([{ importIds: selectedZelleIds, bookingIds: selectedBookingIds }])
              }
            >
              {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {ko
                ? `선택 ${selectedZelleIds.length}↔${selectedBookingIds.length} 연결·지불`
                : `Link ${selectedZelleIds.length}↔${selectedBookingIds.length}`}
            </button>
          ) : null}
          {parseFailedCount > 0 ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100 disabled:opacity-50"
              disabled={syncing || loading}
              onClick={() => void runSync({ reparseFailed: true })}
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {ko ? `파싱 실패 ${parseFailedCount}건 다시 시도` : `Re-parse ${parseFailedCount} failed`}
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            disabled={syncing || loading}
            onClick={() => void runSync()}
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? (ko ? '처리 중…' : 'Working…') : ko ? 'DB와 동기화' : 'Sync with DB'}
          </button>
        </div>
      </div>
      <ZelleEmailPreviewModal
        open={Boolean(viewingEmailId)}
        importId={viewingEmailId}
        locale={locale}
        onClose={() => setViewingEmailId(null)}
      />
    </div>
  )
}

export function TicketBookingZelleDbSyncButton({
  locale,
  onClick,
}: {
  locale: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 bg-violet-50 border border-violet-200 text-violet-950 rounded-lg hover:bg-violet-100 text-sm font-medium transition-colors flex-shrink-0"
      title={
        locale === 'ko'
          ? 'Zelle 송금과 입장권 지출 연동을 확인합니다'
          : 'Review Zelle transfers linked to ticket expenses'
      }
    >
      <Database size={16} />
      <span className="hidden sm:inline">
        {locale === 'ko' ? 'Zelle 지출 연동 확인' : 'Review Zelle expenses'}
      </span>
      <span className="sm:hidden">{locale === 'ko' ? 'Zelle 연동' : 'Zelle'}</span>
    </button>
  )
}
