'use client'

/**
 * 입장권 부킹 카드뷰 — v2 스타일.
 * 날짜 → 지출 업체 2단 그룹 · 모바일 폭 카드 · 클릭 시 편집 모달.
 */

import { useMemo, useState, useEffect, useRef, Fragment, type ReactNode } from 'react'
import { History, Users, Wallet, StickyNote, Paperclip, X } from 'lucide-react'
import type { SeasonDate } from '@/lib/ticketBookingCancelDue'
import {
  getTicketBookingEffectiveQty,
  getTicketBookingOriginalQty,
  isTicketBookingCancelDueHighlight,
  isTicketBookingCancelledStatus,
  resolveTicketBookingUnifiedStatus,
} from '@/lib/ticketBookingDisplay'
import {
  deriveTicketBookingUnitPriceUsd,
  formatExpenseArrow,
  formatHHMM,
  isTicketBookingCreditReceived,
  isTicketBookingPendingRequestState,
  ticketBookingPendingQtyDiffers,
} from '@/lib/ticketBookingWorkflow'
import { getTicketBookingEffectiveExpenseUsd } from '@/lib/ticket-booking-change-display'
import {
  getTicketBookingProductName,
  type TicketBookingTourEnrichment,
} from '@/lib/ticket-booking-tour-display'
import { tourChoiceCountsDisplayKeys } from '@/lib/tourChoiceCounts'
import { ticketBookingCanyonKeyFromBooking } from '@/lib/ticketBookingDateView'
import TicketBookingQtyTimeline from './TicketBookingQtyTimeline'
import TicketBookingCardActionBar, {
  TicketBookingIconTipButton,
  type TicketBookingCardActionHandlers,
} from './TicketBookingCardActionBar'
import TicketBookingStatusQuickMenu from './TicketBookingStatusQuickMenu'
import { TicketBookingRelatedDocuments } from './TicketBookingRelatedDocuments'
import {
  formatZelleConfirmationDisplay,
  isSeeCanyonZelleRecipient,
  SEE_CANYON_TICKET_UNIT_USD,
} from '@/lib/zellePaymentEmail'

export type TicketBookingCardViewRow = {
  id: string
  company: string
  category: string
  check_in_date: string
  time: string
  ea: number
  pending_ea?: number | null
  pending_time?: string | null
  rn_number?: string | null
  reservation_name?: string | null
  expense?: number | null
  paid_amount?: number | null
  credit_amount?: number | null
  unit_price?: number | null
  total_price?: number | null
  booking_status?: string | null
  vendor_status?: string | null
  change_status?: string | null
  payment_status?: string | null
  status?: string | null
  tour_id?: string | null
  tour_ids?: string[] | null
  tours?: TicketBookingTourEnrichment | null
  linked_tours?: Array<TicketBookingTourEnrichment & { tour_id: string }> | null
  created_at?: string | null
  submitted_by?: string | null
  note?: string | null
  uploaded_file_urls?: string[] | null
  invoice_number?: string | null
  zelle_confirmation_number?: string | null
  refund_status?: string | null
  operation_status?: string | null
}

const tourBadgeBase =
  'inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-tight'

/** 지급처(업체) 그룹 배경 — 이름 기준 고정 색 */
const COMPANY_SECTION_SURFACE = [
  'border-sky-200/80 bg-sky-50/70',
  'border-emerald-200/80 bg-emerald-50/70',
  'border-amber-200/80 bg-amber-50/70',
  'border-violet-200/80 bg-violet-50/70',
  'border-rose-200/80 bg-rose-50/70',
  'border-indigo-200/80 bg-indigo-50/70',
] as const

/** 자주 쓰는 지급처 — 항상 동일 색 */
const COMPANY_SECTION_SURFACE_BY_NAME: Record<string, (typeof COMPANY_SECTION_SURFACE)[number]> = {
  'antelope x': 'border-sky-200/80 bg-sky-50/70',
  'see canyon': 'border-emerald-200/80 bg-emerald-50/70',
  dixie: 'border-emerald-200/80 bg-emerald-50/70',
  'antelope canyon': 'border-amber-200/80 bg-amber-50/70',
  'horseshoe bend': 'border-violet-200/80 bg-violet-50/70',
}

function normalizeCompanyKey(company: string): string {
  return company.trim().toLowerCase().replace(/\s+/g, ' ')
}

function hashCompanySurfaceIndex(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % COMPANY_SECTION_SURFACE.length
}

function companySectionSurface(company: string): string {
  const key = normalizeCompanyKey(company)
  if (!key || key === '—') return COMPANY_SECTION_SURFACE[0]
  const mapped = COMPANY_SECTION_SURFACE_BY_NAME[key]
  if (mapped) return mapped
  if (key.includes('antelope') && /\bx\b/.test(key)) {
    return COMPANY_SECTION_SURFACE_BY_NAME['antelope x']
  }
  if (key.includes('see canyon') || key.includes('dixie')) {
    return COMPANY_SECTION_SURFACE_BY_NAME['see canyon']
  }
  return COMPANY_SECTION_SURFACE[hashCompanySurfaceIndex(key)]
}

type CanyonActionTask = {
  key: string
  diffEa: number
  kind: 'book_more' | 'cancel'
  text: string
}

export type DayTourCompareSummary = {
  tourPeople: number
  ticketEa: number
  canyonParts: Array<{ key: string; text: string; mismatch: boolean }>
  actionTasks?: CanyonActionTask[]
  mismatch: boolean
}

/** 지급처에 해당하는 캐년 키(X/L) 업무 뱃지만 표시 */
function actionTasksForCompany(
  company: string,
  tasks: CanyonActionTask[] | undefined
): CanyonActionTask[] {
  if (!tasks?.length) return []
  const canyonKey = ticketBookingCanyonKeyFromBooking({ company })
  if (!canyonKey) return []
  return tasks.filter((t) => t.key === canyonKey)
}

function CanyonActionTaskBadges({
  tasks,
  isEn,
  compact = false,
}: {
  tasks: CanyonActionTask[]
  isEn: boolean
  compact?: boolean
}) {
  if (tasks.length === 0) return null
  return (
    <>
      {tasks.map((task) => (
        <span
          key={`${task.key}-${task.kind}`}
          className={`inline-flex items-center rounded-full font-semibold leading-tight ring-1 ${
            compact
              ? 'px-1.5 py-0.5 text-[10px]'
              : 'px-2.5 py-0.5 text-xs sm:text-sm'
          } ${
            task.kind === 'book_more'
              ? 'bg-amber-50 text-amber-950 ring-amber-200'
              : 'bg-red-50 text-red-800 ring-red-200'
          }`}
          title={
            isEn
              ? `Tour ${task.key} vs ticket EA — action needed`
              : `투어 ${task.key} vs 입장권 EA — 실행 필요`
          }
        >
          {task.text}
        </span>
      ))}
    </>
  )
}

type LinkedTourBadge = {
  tourId: string
  tours: TicketBookingTourEnrichment
}

type Props<T extends TicketBookingCardViewRow> = {
  bookings: T[]
  locale: string
  todayYmd: string
  getCancelDueDate: (booking: T) => string | null
  getSupplierProduct?: (booking: T) => { season_dates: SeasonDate[] | null } | null | undefined
  onOpenBooking: (booking: T) => void
  /** 달력뷰와 동일 — 날짜별 투어 인원 vs 입장권 비교 */
  dayTourCompareByDate?: Map<string, DayTourCompareSummary>
  tourPeopleReservationsSummary?: (tourPeople: number, reservations: number) => string
  /**
   * 같은 RN에 묶인 다른 부킹의 투어까지 합칠 때 사용 (페이지 밖 행 포함).
   * 미지정 시 `bookings`만 사용.
   */
  tourLinkSourceBookings?: T[]
  emptyMessage?: string
  /** 업무 TODO 위젯 등 — 날짜·업체·카드 타이포/여백 축소 */
  density?: 'default' | 'compact'
  /** compact 기본 true — 금액 줄 숨김 */
  hideAmounts?: boolean
  /** 시간 앞에 체크인 날짜 표시 (Zelle 연동 등 송금일과 체크인이 다를 때) */
  showCheckInDate?: boolean
  /** 날짜·업체 헤더 없이 카드만 */
  flat?: boolean
  /** 날짜 그룹 정렬 (기본 오래된 순) */
  dateSort?: 'asc' | 'desc'
  /** flat이어도 카드 클릭으로 편집 열기 */
  allowOpenWhenFlat?: boolean
  /** 카드 하단 워크플로 액션 줄 */
  actionHandlers?: TicketBookingCardActionHandlers | undefined
  onSaveNote?: ((booking: T, note: string) => void | Promise<void>) | undefined
  onAddDocuments?: ((booking: T, files: File[]) => void | Promise<void>) | undefined
  onRemoveDocument?: ((booking: T, index: number) => void | Promise<void>) | undefined
  /** Zelle 연동 등 — 카드 우하단 인보이스 번호 빠른 입력 */
  onSaveInvoiceNumber?: ((bookingId: string, invoiceNumber: string) => void | Promise<void>) | undefined
  /** 카드 금액($지급 / $지출) 클릭 수정 */
  onSaveAmounts?: (
    (
      bookingId: string,
      amounts: { expense: number; paid_amount: number }
    ) => void | Promise<void>
  ) | undefined
  /** 상세 모달 — 편집/삭제/뷰 전환 등 카드 우하단 아이콘 */
  chromeActions?: (booking: T) => ReactNode
  /** 상세 모달 — 우상단 닫기 */
  onClose?: () => void
}

function collectLinkedToursForBooking(
  booking: TicketBookingCardViewRow,
  toursByRn: Map<string, LinkedTourBadge[]>
): LinkedTourBadge[] {
  if (booking.linked_tours && booking.linked_tours.length > 0) {
    return booking.linked_tours.map((t) => ({
      tourId: t.tour_id,
      tours: t,
    }))
  }
  const rn = (booking.rn_number || '').trim()
  if (rn) {
    const fromRn = toursByRn.get(rn)
    if (fromRn && fromRn.length > 0) return fromRn
  }
  const tid = booking.tour_id?.trim()
  if (tid && booking.tours) {
    return [{ tourId: tid, tours: booking.tours }]
  }
  return []
}

function InvoiceQuickField({
  bookingId,
  value,
  locale,
  compact,
  onSave,
}: {
  bookingId: string
  value: string
  locale: string
  compact?: boolean
  onSave: (bookingId: string, invoiceNumber: string) => void | Promise<void>
}) {
  const isEn = locale.startsWith('en')
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const focusedRef = useRef(false)
  const pendingSaveRef = useRef<string | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    if (focusedRef.current) return
    const next = value.trim()
    if (pendingSaveRef.current != null) {
      if (next === pendingSaveRef.current) pendingSaveRef.current = null
      else return
    }
    setDraft(value)
  }, [value])

  const commit = async () => {
    const next = draftRef.current.trim()
    if (next === value.trim() || saving) return
    pendingSaveRef.current = next
    setSaving(true)
    try {
      await onSave(bookingId, next)
    } catch {
      pendingSaveRef.current = null
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={`flex justify-end ${compact ? 'mt-1.5' : 'mt-2'}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <label className="flex min-w-0 items-center gap-1">
        <span className={`shrink-0 font-medium text-muted-foreground ${compact ? 'text-[10px]' : 'text-xs'}`}>
          {isEn ? 'Inv#' : '인보이스'}
        </span>
        <input
          type="text"
          value={draft}
          aria-busy={saving}
          placeholder={isEn ? 'Invoice #' : '번호'}
          aria-label={isEn ? 'Invoice number' : '인보이스 번호'}
          className={`rounded-md border border-border/70 bg-background px-1.5 font-medium tabular-nums text-foreground shadow-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 ${
            compact ? 'h-7 w-[7.25rem] text-[11px]' : 'h-8 w-36 text-sm'
          } ${saving ? 'opacity-70' : ''}`}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => {
            focusedRef.current = true
          }}
          onBlur={() => {
            focusedRef.current = false
            void commit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
      </label>
    </div>
  )
}

function TourLinkBadgeChip({
  locale,
  isEn,
  tours,
  compact = false,
}: {
  locale: string
  isEn: boolean
  tours: TicketBookingTourEnrichment
  compact?: boolean
}) {
  const tourProductName = getTicketBookingProductName(
    locale,
    tours.products ?? undefined,
    isEn ? 'Tour' : '투어'
  )
  const tourPeople =
    tours.total_people != null && Number.isFinite(Number(tours.total_people))
      ? Number(tours.total_people)
      : null
  const tourChoiceKeys = tours.choice_counts
    ? tourChoiceCountsDisplayKeys(tours.choice_counts)
    : []
  const badgeClass = compact
    ? 'inline-flex max-w-full shrink-0 flex-wrap items-center gap-0.5 rounded-full px-1 py-0.5 text-[9px] font-semibold leading-tight'
    : tourBadgeBase

  return (
    <span
      className={`${badgeClass} max-w-full gap-1 bg-indigo-50 text-indigo-950 ring-1 ring-indigo-200/80`}
      title={[
        tourProductName,
        tourPeople != null
          ? isEn
            ? `Total ${tourPeople}`
            : `총인원 ${tourPeople}명`
          : '',
        tourChoiceKeys.map((k) => `🏜️${k} ${tours.choice_counts?.[k] ?? 0}`).join(' '),
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {tourProductName ? (
        <span className={`truncate ${compact ? 'max-w-[4.5rem]' : 'max-w-[5.5rem]'}`}>
          {tourProductName}
        </span>
      ) : null}
      {tourPeople != null ? (
        <span className="inline-flex items-center gap-0.5 tabular-nums">
          <Users
            className={`shrink-0 opacity-80 ${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'}`}
            aria-hidden
          />
          <span>{tourPeople}</span>
        </span>
      ) : null}
      {tourChoiceKeys.map((k) => (
        <span key={k} className="tabular-nums whitespace-nowrap">
          🏜️{k} {tours.choice_counts?.[k] ?? 0}
        </span>
      ))}
    </span>
  )
}

type DateCompanyGroup<T> = {
  date: string
  companies: Array<{ company: string; rows: T[] }>
}

function formatCheckInDateShort(raw: string | null | undefined, isEn: boolean): string | null {
  const ymd = String(raw ?? '').slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const month = Number(m[2])
  const day = Number(m[3])
  if (isEn) return `${month}/${day}`
  return `${month}월 ${day}일`
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function parseUsdInput(raw: string): number | null {
  const n = Number(String(raw).replace(/[$,\s]/g, ''))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

function ticketAmountFormula(booking: TicketBookingCardViewRow): {
  unit: number
  ea: number
  total: number
} | null {
  const ea = getTicketBookingEffectiveQty(booking)
  if (!(ea > 0)) return null
  const unit = isSeeCanyonZelleRecipient(booking.company)
    ? SEE_CANYON_TICKET_UNIT_USD
    : deriveTicketBookingUnitPriceUsd(
        Number(booking.ea ?? 0),
        Number(booking.expense ?? 0),
        booking.unit_price ?? null
      )
  if (!(unit > 0)) return null
  return { unit, ea, total: Math.round(unit * ea * 100) / 100 }
}

/** 지급처 그룹 — 지불할 총 비용 뱃지: `19EA * $82 = $1,558` */
function companyPayableCostBadge(rows: TicketBookingCardViewRow[]): {
  text: string
  totalEa: number
  unitPrice: number
  total: number
} | null {
  let totalEa = 0
  let totalExpense = 0
  const unitKeys = new Set<string>()
  let sharedUnit = 0

  for (const b of rows) {
    if (isTicketBookingCancelledStatus(b)) continue
    const ea = getTicketBookingEffectiveQty(b)
    if (!(ea > 0)) continue
    const expense = getTicketBookingEffectiveExpenseUsd(b)
    const unit = deriveTicketBookingUnitPriceUsd(
      Number(b.ea ?? 0),
      Number(b.expense ?? 0),
      b.unit_price ?? null
    )
    totalEa += ea
    totalExpense += Number.isFinite(expense) ? expense : 0
    if (unit > 0) {
      const key = (Math.round(unit * 100) / 100).toFixed(2)
      unitKeys.add(key)
      sharedUnit = unit
    }
  }

  if (totalEa <= 0) return null

  const unitPrice =
    unitKeys.size === 1
      ? sharedUnit
      : totalExpense > 0
        ? totalExpense / totalEa
        : 0
  if (!(unitPrice > 0)) return null

  const total =
    unitKeys.size === 1
      ? Math.round(unitPrice * totalEa * 100) / 100
      : Math.round(totalExpense * 100) / 100

  return {
    text: `${totalEa}EA * ${formatUsd(unitPrice)} = ${formatUsd(total)}`,
    totalEa,
    unitPrice,
    total,
  }
}

export default function TicketBookingCardView<T extends TicketBookingCardViewRow>({
  bookings,
  locale,
  todayYmd,
  getCancelDueDate,
  getSupplierProduct,
  onOpenBooking,
  dayTourCompareByDate,
  tourPeopleReservationsSummary,
  tourLinkSourceBookings,
  emptyMessage,
  density = 'default',
  hideAmounts,
  showCheckInDate = false,
  flat = false,
  dateSort = 'asc',
  allowOpenWhenFlat = false,
  actionHandlers,
  onSaveNote,
  onAddDocuments,
  onRemoveDocument,
  onSaveInvoiceNumber,
  onSaveAmounts,
  chromeActions,
  onClose,
}: Props<T>) {
  const isEn = locale.startsWith('en')
  const compact = density === 'compact'
  const showAmounts = hideAmounts === undefined ? !compact : !hideAmounts
  const cardOpens = !flat || allowOpenWhenFlat
  type PopoverKind = 'qty' | 'note' | 'docs' | 'amount'
  const [cardPopover, setCardPopover] = useState<{
    kind: PopoverKind
    booking: T
    anchor: { top: number; left: number; bottom: number; right: number }
  } | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [paidDraft, setPaidDraft] = useState('')
  const [expenseDraft, setExpenseDraft] = useState('')
  const [amountSaving, setAmountSaving] = useState(false)
  const cardPopoverRef = useRef<HTMLDivElement | null>(null)
  const cardPopoverTriggerRef = useRef<HTMLButtonElement | null>(null)
  const docsFileInputRef = useRef<HTMLInputElement | null>(null)

  const closeCardPopover = () => setCardPopover(null)

  const openCardPopover = (
    kind: PopoverKind,
    booking: T,
    el: HTMLButtonElement
  ) => {
    if (cardPopover?.kind === kind && cardPopover.booking.id === booking.id) {
      closeCardPopover()
      return
    }
    const rect = el.getBoundingClientRect()
    cardPopoverTriggerRef.current = el
    if (kind === 'note') setNoteDraft(String(booking.note || ''))
    if (kind === 'amount') {
      setPaidDraft(String(Number(booking.paid_amount ?? 0)))
      setExpenseDraft(String(Number(booking.expense ?? 0)))
    }
    setCardPopover({
      kind,
      booking,
      anchor: { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right },
    })
  }

  useEffect(() => {
    if (!cardPopover) return
    const isInsidePopover = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return false
      if (cardPopoverRef.current?.contains(target)) return true
      if (cardPopoverTriggerRef.current?.contains(target)) return true
      if (target instanceof Element && target.closest('[data-ticket-booking-docs-lightbox]')) return true
      return false
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      closeCardPopover()
    }
    const onOutside = (e: Event) => {
      if (isInsidePopover(e.target)) return
      e.stopPropagation()
      if (e.cancelable) e.preventDefault()
      closeCardPopover()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('click', onOutside, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('click', onOutside, true)
    }
  }, [cardPopover])

  useEffect(() => {
    setCardPopover((prev) => {
      if (!prev) return prev
      const fresh = bookings.find((b) => b.id === prev.booking.id)
      if (!fresh || fresh === prev.booking) return prev
      return { ...prev, booking: fresh }
    })
  }, [bookings])

  /** 같은 RN → 연결 투어 전부 (tour_id 기준 중복 제거) */
  const toursByRn = useMemo(() => {
    const source = tourLinkSourceBookings ?? bookings
    const map = new Map<string, Map<string, LinkedTourBadge>>()
    for (const b of source) {
      const rn = (b.rn_number || '').trim()
      const tid = b.tour_id?.trim()
      if (!rn || !tid || !b.tours) continue
      let byTour = map.get(rn)
      if (!byTour) {
        byTour = new Map()
        map.set(rn, byTour)
      }
      if (!byTour.has(tid)) {
        byTour.set(tid, { tourId: tid, tours: b.tours })
      }
    }
    const out = new Map<string, LinkedTourBadge[]>()
    for (const [rn, byTour] of map) {
      out.set(rn, Array.from(byTour.values()))
    }
    return out
  }, [bookings, tourLinkSourceBookings])

  const groupedByDate = useMemo((): DateCompanyGroup<T>[] => {
    if (flat) {
      return [{ date: '__flat__', companies: [{ company: '__flat__', rows: bookings }] }]
    }
    const byDate = new Map<string, Map<string, T[]>>()
    for (const b of bookings) {
      const date = String(b.check_in_date || '').slice(0, 10) || '—'
      const company = (b.company || '').trim() || '—'
      let byCompany = byDate.get(date)
      if (!byCompany) {
        byCompany = new Map()
        byDate.set(date, byCompany)
      }
      const list = byCompany.get(company) ?? []
      list.push(b)
      byCompany.set(company, list)
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => (dateSort === 'desc' ? b.localeCompare(a) : a.localeCompare(b)))
      .map(([date, companyMap]) => ({
        date,
        companies: Array.from(companyMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([company, rows]) => ({
            company,
            rows: [...rows].sort(
              (x, y) =>
                String(x.time || '').localeCompare(String(y.time || '')) ||
                String(x.id).localeCompare(String(y.id))
            ),
          })),
      }))
  }, [bookings, flat, dateSort])

  if (bookings.length === 0) {
    return (
      <div
        className={
          compact
            ? 'rounded-md border border-dashed border-border bg-muted/10 px-3 py-4 text-center'
            : 'rounded-xl border border-dashed border-border bg-muted/10 px-6 py-16 text-center'
        }
      >
        <p className={compact ? 'text-[11px] font-medium text-foreground' : 'text-base font-medium text-foreground'}>
          {emptyMessage || (isEn ? 'No bookings to show' : '표시할 부킹이 없습니다')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {groupedByDate.map((dayGroup, dayIdx) => {
        const dayCount = dayGroup.companies.reduce((s, c) => s + c.rows.length, 0)
        return (
          <Fragment key={dayGroup.date}>
            {!flat && dayIdx > 0 ? (
              <div
                className={
                  compact
                    ? 'mb-3 mt-3 border-t border-gray-200'
                    : 'mb-10 mt-10 border-t-2 border-gray-300'
                }
                role="separator"
                aria-hidden
              />
            ) : null}

            <section className={flat ? '' : dayIdx === 0 ? (compact ? 'pb-1' : 'pb-4') : compact ? 'pb-1 pt-1' : 'pb-4 pt-3'}>
              {(() => {
                const compare = dayTourCompareByDate?.get(dayGroup.date)
                const summaryText =
                  compare && tourPeopleReservationsSummary
                    ? tourPeopleReservationsSummary(compare.tourPeople, compare.ticketEa)
                    : compare
                      ? isEn
                        ? `Tour: ${compare.tourPeople} / Tickets: ${compare.ticketEa}`
                        : `투어 : ${compare.tourPeople}명 / 예약 : ${compare.ticketEa}개`
                      : null
                return (
                  <>
                  {!flat ? (
                  <div className={compact ? 'mb-1.5 space-y-0.5' : 'mb-3 space-y-1'}>
                    <h3
                      className={
                        compact
                          ? 'flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] font-semibold tracking-tight text-foreground'
                          : 'flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xl font-semibold tracking-tight text-foreground md:text-2xl'
                      }
                    >
                      <span>{dayGroup.date}</span>
                      <span
                        className={
                          compact
                            ? 'text-[11px] font-normal text-muted-foreground'
                            : 'text-base font-normal text-muted-foreground md:text-lg'
                        }
                      >
                        {dayCount}
                        {isEn ? (dayCount === 1 ? ' booking' : ' bookings') : '건'}
                      </span>
                    </h3>
                    {summaryText ? (
                      <div
                        className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold leading-tight ${
                          compact ? 'text-[11px]' : 'gap-x-3 gap-y-1 text-sm'
                        } ${compare?.mismatch ? 'text-red-600' : 'text-primary'}`}
                      >
                        <span className="whitespace-nowrap">{summaryText}</span>
                        {compare && compare.canyonParts.length > 0 ? (
                          <span
                            className={`flex flex-nowrap items-center gap-x-1.5 font-bold tabular-nums ${
                              compact ? 'text-[10px]' : 'text-xs sm:text-sm'
                            }`}
                          >
                            {compare.canyonParts.map((part) => (
                              <span
                                key={part.key}
                                className={`whitespace-nowrap ${part.mismatch ? 'text-red-600' : 'text-inherit'}`}
                                title={
                                  isEn
                                    ? `Tour ${part.key} / Ticket EA ${part.key}`
                                    : `투어 ${part.key} / 입장권 ${part.key}`
                                }
                              >
                                {part.text}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  ) : null}

              <div className={compact ? 'space-y-2' : 'space-y-4'}>
                {dayGroup.companies.map(({ company, rows }) => {
                  const companyTasks = actionTasksForCompany(company, compare?.actionTasks)
                  const payable = companyPayableCostBadge(rows)
                  return (
                  <div
                    key={`${dayGroup.date}__${company}`}
                    className={
                      flat
                        ? ''
                        : `rounded-xl border ${
                            compact ? 'rounded-lg p-2' : 'rounded-2xl p-3 sm:p-4'
                          } ${companySectionSurface(company)}`
                    }
                  >
                    {!flat ? (
                    <h4
                      className={`flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-foreground ${
                        compact ? 'mb-1.5 text-[11px]' : 'mb-2.5 text-sm'
                      }`}
                    >
                      <span>
                        {company}
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          {rows.length}
                          {isEn ? '' : '건'}
                        </span>
                      </span>
                      {payable ? (
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-full bg-slate-900/90 font-semibold tabular-nums text-white ring-1 ring-slate-700/40 ${
                            compact
                              ? 'px-1.5 py-0.5 text-[10px]'
                              : 'gap-1 px-2.5 py-0.5 text-xs sm:text-sm'
                          }`}
                          title={payable.text}
                          aria-label={
                            isEn
                              ? `Expense ${formatUsd(payable.total)}. ${payable.text}`
                              : `지출 ${formatUsd(payable.total)}. ${payable.text}`
                          }
                        >
                          <Wallet
                            className={`shrink-0 opacity-90 ${compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'}`}
                            aria-hidden
                          />
                          {formatUsd(payable.total)}
                        </span>
                      ) : null}
                      <CanyonActionTaskBadges
                        tasks={companyTasks}
                        isEn={isEn}
                        compact={compact}
                      />
                    </h4>
                    ) : null}
                    <ul className={flat || compact ? 'flex flex-col gap-1.5' : 'flex flex-wrap gap-3'}>
                      {rows.map((booking) => {
                        const unified = resolveTicketBookingUnifiedStatus(booking, locale)
                        const eff = getTicketBookingEffectiveQty(booking)
                        const currentEa = getTicketBookingOriginalQty(booking)
                        const cancelled = isTicketBookingCancelledStatus(booking)
                        const awaitingVendor =
                          !cancelled && isTicketBookingPendingRequestState(booking)
                        const cancelDue = getCancelDueDate(booking)
                        const supplierProduct = getSupplierProduct?.(booking)
                        const cancelWarn =
                          Boolean(cancelDue) &&
                          isTicketBookingCancelDueHighlight(
                            booking,
                            supplierProduct ?? null,
                            todayYmd
                          )
                        const qtyPending =
                          !cancelled && ticketBookingPendingQtyDiffers(booking)
                        const paid = Number(booking.paid_amount ?? 0)
                        const credit = Number(booking.credit_amount ?? 0)
                        const expected = getTicketBookingEffectiveExpenseUsd(booking)
                        const rn = (booking.rn_number || '').trim()
                        const zelleConf = formatZelleConfirmationDisplay(booking.zelle_confirmation_number)
                        const showZelleConf =
                          Boolean(zelleConf) || isSeeCanyonZelleRecipient(booking.company)
                        const timeLabel = formatHHMM(booking.time) || '—'
                        const dateLabel = showCheckInDate
                          ? formatCheckInDateShort(booking.check_in_date, isEn)
                          : null
                        const whenLabel = dateLabel ? `${dateLabel} ${timeLabel}` : timeLabel
                        const expenseArrow = formatExpenseArrow(booking)
                        const amountMain = formatUsd(expected)
                        const linkedTours = collectLinkedToursForBooking(booking, toursByRn)
                        const hasLinkedTour = linkedTours.length > 0
                        const qtyTimelineLabel = isEn ? 'Quantity timeline' : '수량 타임라인'

                        return (
                          <li
                            key={booking.id}
                            className={
                              flat || compact
                                ? 'w-full shrink-0'
                                : 'w-full max-w-[22.5rem] shrink-0 sm:w-[22.5rem]'
                            }
                          >
                            <div
                              role={cardOpens ? 'button' : undefined}
                              tabIndex={cardOpens ? 0 : undefined}
                              onClick={cardOpens ? () => onOpenBooking(booking) : undefined}
                              onKeyDown={
                                cardOpens
                                  ? (e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault()
                                        onOpenBooking(booking)
                                      }
                                    }
                                  : undefined
                              }
                              className={`flex h-full w-full flex-col border bg-white text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                compact ? 'rounded-lg p-2' : 'rounded-xl p-3.5'
                              } ${cardOpens ? 'cursor-pointer hover:border-primary/40 hover:shadow-md' : ''} ${
                                qtyPending || unified.key === 'change_pending'
                                  ? 'border-red-300 ring-1 ring-red-200'
                                  : 'border-border/60'
                              }`}
                            >
                              {/* 1줄: 상태 칩 + 공급업체 (왼쪽) · 타임라인/메모/문서/닫기 (오른쪽 끝) */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 flex-wrap items-center gap-1">
                                  <TicketBookingStatusQuickMenu
                                    booking={booking}
                                    locale={locale}
                                    compact={compact}
                                    onUpdated={() => {
                                      actionHandlers?.onApplied()
                                    }}
                                    {...(actionHandlers
                                      ? {
                                          onRequestChange: () => actionHandlers.onQtyTimeChange(booking),
                                        }
                                      : {})}
                                  />
                                  {booking.company?.trim() ? (
                                    <span
                                      className={`inline-flex max-w-[9rem] truncate font-medium text-foreground ${
                                        compact
                                          ? 'text-[10px]'
                                          : 'rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-xs'
                                      }`}
                                      title={booking.company}
                                    >
                                      {booking.company}
                                    </span>
                                  ) : null}
                                  {awaitingVendor ? (
                                    <span
                                      className={`inline-flex border border-orange-200 bg-orange-50 font-medium text-orange-800 ${
                                        compact
                                          ? 'rounded-md px-1.5 py-0.5 text-[10px]'
                                          : 'rounded-lg px-2 py-0.5 text-xs'
                                      }`}
                                    >
                                      {isEn ? 'Awaiting vendor' : '벤더 응답 대기'}
                                    </span>
                                  ) : null}
                                  {isTicketBookingCreditReceived(booking) ? (
                                    <span
                                      className={`inline-flex border border-cyan-200 bg-cyan-50 font-medium text-cyan-900 ${
                                        compact
                                          ? 'rounded-md px-1.5 py-0.5 text-[10px]'
                                          : 'rounded-lg px-2 py-0.5 text-xs'
                                      }`}
                                    >
                                      {isEn ? 'Credit' : '크레딧'}
                                    </span>
                                  ) : null}
                                  {cancelWarn && cancelDue ? (
                                    <span
                                      className={`inline-flex border border-red-200 bg-red-50 font-medium text-red-700 ${
                                        compact
                                          ? 'rounded-md px-1.5 py-0.5 text-[10px]'
                                          : 'rounded-lg px-2 py-0.5 text-xs'
                                      }`}
                                    >
                                      Cancel Due {cancelDue}
                                    </span>
                                  ) : null}
                                  {!hasLinkedTour ? (
                                    <span
                                      className={`inline-flex border border-amber-200 bg-amber-50 font-medium text-amber-900 ${
                                        compact
                                          ? 'rounded-md px-1.5 py-0.5 text-[10px]'
                                          : 'rounded-lg px-2 py-0.5 text-xs'
                                      }`}
                                    >
                                      {isEn ? 'No tour' : '투어 미연결'}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="ml-auto flex shrink-0 items-center justify-end gap-1">
                                  {([
                                    {
                                      kind: 'qty' as const,
                                      label: qtyTimelineLabel,
                                      active: false,
                                      show: true,
                                      icon: History,
                                      activeClass: '',
                                    },
                                    {
                                      kind: 'note' as const,
                                      label: isEn ? 'Memo' : '메모',
                                      active: Boolean(String(booking.note || '').trim()),
                                      show:
                                        Boolean(onSaveNote) ||
                                        Boolean(String(booking.note || '').trim()),
                                      icon: StickyNote,
                                      activeClass: 'border-amber-300 bg-amber-50 text-amber-800',
                                    },
                                    {
                                      kind: 'docs' as const,
                                      label: isEn ? 'Documents' : '관련 문서',
                                      active: (booking.uploaded_file_urls ?? []).some(
                                        (u) => typeof u === 'string' && u.trim() !== ''
                                      ),
                                      show:
                                        Boolean(onAddDocuments) ||
                                        (booking.uploaded_file_urls ?? []).some(
                                          (u) => typeof u === 'string' && u.trim() !== ''
                                        ),
                                      icon: Paperclip,
                                      activeClass: 'border-sky-300 bg-sky-50 text-sky-800',
                                    },
                                  ]).filter((meta) => meta.show).map((meta) => {
                                    const Icon = meta.icon
                                    const open = cardPopover?.kind === meta.kind && cardPopover.booking.id === booking.id
                                    return (
                                      <TicketBookingIconTipButton
                                        key={meta.kind}
                                        ref={open ? cardPopoverTriggerRef : undefined}
                                        label={meta.label}
                                        tip="bottom"
                                        aria-expanded={open}
                                        className={
                                          meta.active
                                            ? meta.activeClass
                                            : 'border-border/70 bg-muted/40 text-muted-foreground hover:bg-primary/5 hover:text-foreground'
                                        }
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          openCardPopover(meta.kind, booking, e.currentTarget)
                                        }}
                                      >
                                        <Icon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
                                      </TicketBookingIconTipButton>
                                    )
                                  })}
                                  {onClose ? (
                                    <>
                                      <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />
                                      <TicketBookingIconTipButton
                                        label={isEn ? 'Close' : '닫기'}
                                        tip="bottom"
                                        className="border-border/70 bg-muted/40 text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onClose()
                                        }}
                                      >
                                        <X className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2} aria-hidden />
                                      </TicketBookingIconTipButton>
                                    </>
                                  ) : null}
                                </div>
                              </div>

                              {/* 2줄: 시간 · RN (왼쪽) + 유효 수량 (오른쪽 끝) */}
                              <div className={`flex w-full items-center justify-between gap-2 ${compact ? 'mt-1' : 'mt-2'}`}>
                                <p
                                  className={`min-w-0 shrink font-semibold tabular-nums text-foreground ${
                                    compact ? 'text-[12px]' : 'text-base'
                                  }`}
                                >
                                  {whenLabel}
                                  {rn ? (
                                    <span
                                      className={`ml-1.5 font-medium text-muted-foreground ${
                                        compact ? 'text-[10px]' : 'text-sm'
                                      }`}
                                    >
                                      RN# {rn}
                                    </span>
                                  ) : null}
                                  {showZelleConf ? (
                                    <span
                                      className={`ml-1.5 font-mono font-semibold ${
                                        zelleConf ? 'text-emerald-800' : 'text-amber-800'
                                      } ${compact ? 'text-[10px]' : 'text-xs'}`}
                                      title={
                                        zelleConf
                                          ? `Zelle ${zelleConf}`
                                          : isEn
                                            ? 'No Zelle confirmation'
                                            : 'Zelle Conf 없음'
                                      }
                                    >
                                      Conf {zelleConf || '—'}
                                    </span>
                                  ) : null}
                                </p>
                                <p
                                  className={`shrink-0 tabular-nums text-muted-foreground ${
                                    compact ? 'text-[11px]' : 'text-sm'
                                  }`}
                                >
                                  <span className="font-semibold text-foreground">
                                    {qtyPending ? currentEa : eff} EA
                                  </span>
                                  {qtyPending && booking.pending_ea != null ? (
                                    <span className="ml-1 font-semibold text-orange-700">
                                      {'>'} {Number(booking.pending_ea)} EA
                                    </span>
                                  ) : null}
                                </p>
                              </div>

                              {/* 3줄: 투어 뱃지 (왼쪽) · 금액 (오른쪽 끝) */}
                              {(hasLinkedTour || showAmounts) ? (
                                <div
                                  className={`flex w-full items-end justify-between gap-2 leading-snug ${
                                    compact ? 'mt-1 text-[10px]' : 'mt-2 text-sm'
                                  }`}
                                >
                                  <div className="flex min-w-0 flex-wrap gap-1">
                                    {hasLinkedTour
                                      ? linkedTours.map((lt) => (
                                          <TourLinkBadgeChip
                                            key={lt.tourId}
                                            locale={locale}
                                            isEn={isEn}
                                            tours={lt.tours}
                                            compact={compact}
                                          />
                                        ))
                                      : null}
                                  </div>
                                  {showAmounts ? (
                                    onSaveAmounts ? (
                                      <button
                                        type="button"
                                        className={`shrink-0 whitespace-nowrap rounded-md text-right font-semibold tabular-nums text-foreground hover:bg-muted/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                          compact ? 'px-1 py-0.5 text-[10px]' : 'px-1.5 py-0.5'
                                        }`}
                                        title={
                                          isEn ? 'Edit amounts' : '금액 수정'
                                        }
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          openCardPopover('amount', booking, e.currentTarget)
                                        }}
                                      >
                                        {formatUsd(paid)} / {amountMain}
                                        {credit > 0 ? (
                                          <span className="ml-1 font-normal text-muted-foreground">
                                            · {isEn ? 'cr' : '크레딧'} {formatUsd(credit)}
                                          </span>
                                        ) : null}
                                      </button>
                                    ) : (
                                      <p
                                        className="shrink-0 whitespace-nowrap text-right font-semibold tabular-nums text-foreground"
                                        title={
                                          expenseArrow && expenseArrow.includes('>')
                                            ? expenseArrow
                                            : undefined
                                        }
                                      >
                                        {formatUsd(paid)} / {amountMain}
                                        {credit > 0 ? (
                                          <span className="ml-1 font-normal text-muted-foreground">
                                            · {isEn ? 'cr' : '크레딧'} {formatUsd(credit)}
                                          </span>
                                        ) : null}
                                      </p>
                                    )
                                  ) : null}
                                </div>
                              ) : null}

                              {actionHandlers ? (
                                <TicketBookingCardActionBar
                                  booking={booking}
                                  locale={locale}
                                  handlers={actionHandlers}
                                  extra={chromeActions?.(booking)}
                                />
                              ) : chromeActions ? (
                                <div
                                  className="mt-2 flex justify-end"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex flex-nowrap items-center justify-end gap-1">
                                    {chromeActions(booking)}
                                  </div>
                                </div>
                              ) : null}
                              {onSaveInvoiceNumber ? (
                                <InvoiceQuickField
                                  key={booking.id}
                                  bookingId={booking.id}
                                  value={String(booking.invoice_number ?? '').trim()}
                                  locale={locale}
                                  compact={compact}
                                  onSave={onSaveInvoiceNumber}
                                />
                              ) : null}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                  )
                })}
              </div>
                  </>
                )
              })()}
            </section>
          </Fragment>
        )
      })}

      {cardPopover ? (
        <div
          ref={cardPopoverRef}
          role="dialog"
          aria-label={
            cardPopover.kind === 'qty'
              ? isEn
                ? 'Quantity timeline'
                : '수량 타임라인'
              : cardPopover.kind === 'note'
                ? isEn
                  ? 'Memo'
                  : '메모'
                : cardPopover.kind === 'amount'
                  ? isEn
                    ? 'Edit amounts'
                    : '금액 수정'
                  : isEn
                    ? 'Related documents'
                    : '관련 문서'
          }
          className={`fixed z-[180] rounded-xl border border-border/70 bg-white p-3 shadow-lg ${
            cardPopover.kind === 'docs'
              ? 'w-[min(22rem,calc(100vw-1rem))]'
              : 'w-[min(20rem,calc(100vw-1rem))]'
          }`}
          style={{
            top: Math.max(8, cardPopover.anchor.top - 8),
            left: Math.min(
              Math.max(8, cardPopover.anchor.left),
              typeof window !== 'undefined' ? window.innerWidth - 8 - 320 : cardPopover.anchor.left
            ),
            transform: 'translateY(-100%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {cardPopover.kind === 'amount' && onSaveAmounts ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault()
                const paidN = parseUsdInput(paidDraft)
                const expenseN = parseUsdInput(expenseDraft)
                if (paidN == null || expenseN == null) return
                void (async () => {
                  setAmountSaving(true)
                  try {
                    await onSaveAmounts(cardPopover.booking.id, {
                      paid_amount: paidN,
                      expense: expenseN,
                    })
                    closeCardPopover()
                  } finally {
                    setAmountSaving(false)
                  }
                })()
              }}
            >
              <p className="text-xs font-semibold text-foreground">{isEn ? 'Amounts' : '금액'}</p>
              {(() => {
                const formula = ticketAmountFormula(cardPopover.booking)
                if (!formula) return null
                const label = `${formatUsd(formula.unit)} * ${formula.ea} EA  = ${formatUsd(formula.total)}`
                return (
                  <button
                    type="button"
                    className="w-full rounded-lg border border-border/70 bg-muted/40 px-2.5 py-2 text-left text-sm font-semibold tabular-nums text-foreground hover:bg-muted/70"
                    title={isEn ? 'Fill expense with this total' : '이 합계로 지출 채우기'}
                    onClick={() => {
                      setExpenseDraft(String(formula.total))
                      setPaidDraft(String(formula.total))
                    }}
                  >
                    {label}
                  </button>
                )
              })()}
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {isEn ? 'Paid' : '지급액'}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={paidDraft}
                  disabled={amountSaving}
                  className="h-9 w-full rounded-lg border border-border/70 bg-white px-2.5 text-sm tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(e) => setPaidDraft(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {isEn ? 'Expense' : '지출'}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={expenseDraft}
                  disabled={amountSaving}
                  autoFocus
                  className="h-9 w-full rounded-lg border border-border/70 bg-white px-2.5 text-sm tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(e) => setExpenseDraft(e.target.value)}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={amountSaving}
                  className="inline-flex h-8 items-center rounded-lg border border-border/70 bg-white px-3 text-xs font-medium text-foreground hover:bg-muted/60 disabled:opacity-50"
                  onClick={() => closeCardPopover()}
                >
                  {isEn ? 'Cancel' : '취소'}
                </button>
                <button
                  type="submit"
                  disabled={amountSaving}
                  className="inline-flex h-8 items-center rounded-lg bg-slate-800 px-3 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  {amountSaving ? '…' : isEn ? 'Save' : '저장'}
                </button>
              </div>
            </form>
          ) : null}
          {cardPopover.kind === 'qty' ? (
            <>
              <p className="mb-2 text-xs font-semibold text-foreground">
                {isEn ? 'Quantity timeline' : '수량 타임라인'}
              </p>
              <div className="max-h-56 overflow-y-auto">
                <TicketBookingQtyTimeline
                  booking={cardPopover.booking}
                  locale={locale}
                  hideHeading
                />
              </div>
            </>
          ) : null}
          {cardPopover.kind === 'note' ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">{isEn ? 'Memo' : '메모'}</p>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={5}
                disabled={!onSaveNote || noteSaving}
                className="w-full resize-y rounded-lg border border-border/70 bg-white px-2.5 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted/40"
                placeholder={isEn ? 'Add a memo' : '메모를 입력하세요'}
              />
              {onSaveNote ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={noteSaving}
                    className="inline-flex h-8 items-center rounded-lg bg-slate-800 px-3 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                    onClick={() => {
                      void (async () => {
                        setNoteSaving(true)
                        try {
                          await onSaveNote(cardPopover.booking, noteDraft)
                        } finally {
                          setNoteSaving(false)
                        }
                      })()
                    }}
                  >
                    {noteSaving ? '…' : isEn ? 'Save' : '저장'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {cardPopover.kind === 'docs' ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">
                {isEn ? 'Related documents' : '관련 문서'}
              </p>
              {(cardPopover.booking.uploaded_file_urls ?? []).some(
                (u) => typeof u === 'string' && u.trim() !== ''
              ) ? (
                <div className="max-h-56 overflow-y-auto">
                  <TicketBookingRelatedDocuments
                    urls={(cardPopover.booking.uploaded_file_urls ?? []).filter(
                      (u): u is string => typeof u === 'string' && u.trim() !== ''
                    )}
                    openLabel={isEn ? 'Open document' : '문서 열기'}
                    closeLabel={isEn ? 'Close' : '닫기'}
                    imageClassName="h-28 w-full object-cover"
                    {...(onRemoveDocument
                      ? {
                          onRemove: (index: number) => {
                            void onRemoveDocument(cardPopover.booking, index)
                          },
                          removeLabel: isEn ? 'Remove' : '삭제',
                        }
                      : {})}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {isEn ? 'No documents yet' : '등록된 문서가 없습니다'}
                </p>
              )}
              {onAddDocuments ? (
                <>
                  <input
                    ref={docsFileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? [])
                      e.target.value = ''
                      if (files.length === 0) return
                      void onAddDocuments(cardPopover.booking, files)
                    }}
                  />
                  <button
                    type="button"
                    className="inline-flex h-8 w-full items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-xs font-medium text-foreground hover:bg-muted"
                    onClick={() => docsFileInputRef.current?.click()}
                  >
                    {isEn ? 'Add files' : '파일 추가'}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
