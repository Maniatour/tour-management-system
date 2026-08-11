'use client'

/**
 * 입장권 부킹 카드뷰 — v2 스타일.
 * 날짜 → 지출 업체 2단 그룹 · 모바일 폭 카드 · 클릭 시 편집 모달.
 */

import { useMemo, useState, useEffect, useRef, Fragment } from 'react'
import { History, Users } from 'lucide-react'
import type { SeasonDate } from '@/lib/ticketBookingCancelDue'
import {
  getTicketBookingEffectiveQty,
  getTicketBookingUnifiedStatusBadgeClass,
  isTicketBookingCancelDueHighlight,
  resolveTicketBookingUnifiedStatus,
} from '@/lib/ticketBookingDisplay'
import {
  formatExpenseArrow,
  formatHHMM,
  isTicketBookingPendingRequestState,
  ticketBookingPendingQtyDiffers,
} from '@/lib/ticketBookingWorkflow'
import { getTicketBookingEffectiveExpenseUsd } from '@/lib/ticket-booking-change-display'
import {
  getTicketBookingProductName,
  type TicketBookingTourEnrichment,
} from '@/lib/ticket-booking-tour-display'
import { tourChoiceCountsDisplayKeys } from '@/lib/tourChoiceCounts'
import TicketBookingQtyTimeline from './TicketBookingQtyTimeline'

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
}

const tourBadgeBase =
  'inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-tight'

type DayTourCompareSummary = {
  tourPeople: number
  ticketEa: number
  canyonParts: Array<{ key: string; text: string; mismatch: boolean }>
  actionTasks?: Array<{
    key: string
    diffEa: number
    kind: 'book_more' | 'cancel'
    text: string
  }>
  mismatch: boolean
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

function TourLinkBadgeChip({
  locale,
  isEn,
  tours,
}: {
  locale: string
  isEn: boolean
  tours: TicketBookingTourEnrichment
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

  return (
    <span
      className={`${tourBadgeBase} max-w-full gap-1 bg-indigo-50 text-indigo-950 ring-1 ring-indigo-200/80`}
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
        <span className="max-w-[5.5rem] truncate">{tourProductName}</span>
      ) : null}
      {tourPeople != null ? (
        <span className="inline-flex items-center gap-0.5 tabular-nums">
          <Users className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
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

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
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
}: Props<T>) {
  const isEn = locale.startsWith('en')
  const [qtyTimelineBooking, setQtyTimelineBooking] = useState<T | null>(null)
  const [qtyTimelineAnchor, setQtyTimelineAnchor] = useState<{
    top: number
    left: number
    bottom: number
    right: number
  } | null>(null)
  const qtyTimelinePopoverRef = useRef<HTMLDivElement | null>(null)
  const qtyTimelineTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!qtyTimelineBooking) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQtyTimelineBooking(null)
        setQtyTimelineAnchor(null)
      }
    }
    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (qtyTimelinePopoverRef.current?.contains(target)) return
      if (qtyTimelineTriggerRef.current?.contains(target)) return
      setQtyTimelineBooking(null)
      setQtyTimelineAnchor(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [qtyTimelineBooking])

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
      .sort(([a], [b]) => a.localeCompare(b))
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
  }, [bookings])

  if (bookings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/10 px-6 py-16 text-center">
        <p className="text-base font-medium text-foreground">
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
            {dayIdx > 0 ? (
              <div className="mb-2 mt-8 border-t-2 border-gray-300" role="separator" aria-hidden />
            ) : null}

            <section className={dayIdx === 0 ? 'pb-4' : 'pb-4 pt-1'}>
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
                  <div className="mb-3 space-y-1">
                    <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-base font-semibold tracking-tight text-foreground">
                      <span>{dayGroup.date}</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {dayCount}
                        {isEn ? (dayCount === 1 ? ' booking' : ' bookings') : '건'}
                      </span>
                      {compare && compare.actionTasks && compare.actionTasks.length > 0
                        ? compare.actionTasks.map((task) => (
                            <span
                              key={`${task.key}-${task.kind}`}
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-tight ring-1 ${
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
                          ))
                        : null}
                    </h3>
                    {summaryText ? (
                      <div
                        className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold leading-tight ${
                          compare?.mismatch ? 'text-red-600' : 'text-primary'
                        }`}
                      >
                        <span className="whitespace-nowrap">{summaryText}</span>
                        {compare && compare.canyonParts.length > 0 ? (
                          <span className="flex flex-nowrap items-center gap-x-1.5 text-xs font-bold tabular-nums sm:text-sm">
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
                )
              })()}

              <div className="space-y-4">
                {dayGroup.companies.map(({ company, rows }) => (
                  <div key={`${dayGroup.date}__${company}`}>
                    <h4 className="mb-2 text-sm font-semibold text-foreground">
                      {company}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {rows.length}
                        {isEn ? '' : '건'}
                      </span>
                    </h4>
                    <ul className="flex flex-wrap gap-3">
                      {rows.map((booking) => {
                        const unified = resolveTicketBookingUnifiedStatus(booking, locale)
                        const eff = getTicketBookingEffectiveQty(booking)
                        const awaitingVendor = isTicketBookingPendingRequestState(booking)
                        const cancelDue = getCancelDueDate(booking)
                        const supplierProduct = getSupplierProduct?.(booking)
                        const cancelWarn =
                          Boolean(cancelDue) &&
                          isTicketBookingCancelDueHighlight(
                            booking,
                            supplierProduct ?? null,
                            todayYmd
                          )
                        const qtyPending = ticketBookingPendingQtyDiffers(booking)
                        const paid = Number(booking.paid_amount ?? 0)
                        const credit = Number(booking.credit_amount ?? 0)
                        const expected = getTicketBookingEffectiveExpenseUsd(booking)
                        const rn = (booking.rn_number || '').trim()
                        const timeLabel = formatHHMM(booking.time) || '—'
                        const expenseArrow = formatExpenseArrow(booking)
                        const amountMain = formatUsd(expected)
                        const linkedTours = collectLinkedToursForBooking(booking, toursByRn)
                        const hasLinkedTour = linkedTours.length > 0
                        const qtyTimelineLabel = isEn ? 'Quantity timeline' : '수량 타임라인'

                        return (
                          <li
                            key={booking.id}
                            className="w-full max-w-[22.5rem] shrink-0 sm:w-[22.5rem]"
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => onOpenBooking(booking)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  onOpenBooking(booking)
                                }
                              }}
                              className={`flex h-full w-full cursor-pointer flex-col rounded-xl border bg-white p-3.5 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                qtyPending || unified.key === 'change_pending'
                                  ? 'border-red-300 ring-1 ring-red-200'
                                  : 'border-border/60'
                              }`}
                            >
                              {/* 1줄: 상태 칩 (왼쪽) + 수량 타임라인 (오른쪽 끝) */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                  <span
                                    className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-medium ${getTicketBookingUnifiedStatusBadgeClass(unified.key)}`}
                                    title={unified.detail}
                                  >
                                    {unified.label}
                                  </span>
                                  {awaitingVendor ? (
                                    <span className="inline-flex rounded-lg border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-800">
                                      {isEn ? 'Awaiting vendor' : '벤더 응답 대기'}
                                    </span>
                                  ) : null}
                                  {cancelWarn && cancelDue ? (
                                    <span className="inline-flex rounded-lg border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                                      Cancel Due {cancelDue}
                                    </span>
                                  ) : null}
                                  {!hasLinkedTour ? (
                                    <span className="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                                      {isEn ? 'No tour' : '투어 미연결'}
                                    </span>
                                  ) : null}
                                </div>
                                <button
                                  ref={
                                    qtyTimelineBooking?.id === booking.id
                                      ? qtyTimelineTriggerRef
                                      : undefined
                                  }
                                  type="button"
                                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  title={qtyTimelineLabel}
                                  aria-label={qtyTimelineLabel}
                                  aria-expanded={qtyTimelineBooking?.id === booking.id}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (qtyTimelineBooking?.id === booking.id) {
                                      setQtyTimelineBooking(null)
                                      setQtyTimelineAnchor(null)
                                      return
                                    }
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    qtyTimelineTriggerRef.current = e.currentTarget
                                    setQtyTimelineAnchor({
                                      top: rect.top,
                                      left: rect.left,
                                      bottom: rect.bottom,
                                      right: rect.right,
                                    })
                                    setQtyTimelineBooking(booking)
                                  }}
                                >
                                  <History className="h-3.5 w-3.5" aria-hidden />
                                </button>
                              </div>

                              {/* 2줄: 시간 · RN (왼쪽) + 유효 수량 (오른쪽 끝) */}
                              <div className="mt-2 flex w-full items-center justify-between gap-2">
                                <p className="min-w-0 shrink text-base font-semibold tabular-nums text-foreground">
                                  {timeLabel}
                                  {rn ? (
                                    <span className="ml-2 text-sm font-medium text-muted-foreground">
                                      RN# {rn}
                                    </span>
                                  ) : null}
                                </p>
                                <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                                  <span className="font-semibold text-foreground">{eff} EA</span>
                                  {qtyPending && booking.pending_ea != null ? (
                                    <span className="ml-1 font-semibold text-orange-700">
                                      {'>'} {Number(booking.pending_ea)} EA
                                    </span>
                                  ) : null}
                                </p>
                              </div>

                              {/* 3줄: 투어 뱃지 (왼쪽) · 금액 (오른쪽 끝) */}
                              <div className="mt-2 flex w-full items-end justify-between gap-2 text-sm leading-snug">
                                <div className="flex min-w-0 flex-wrap gap-1">
                                  {hasLinkedTour
                                    ? linkedTours.map((lt) => (
                                        <TourLinkBadgeChip
                                          key={lt.tourId}
                                          locale={locale}
                                          isEn={isEn}
                                          tours={lt.tours}
                                        />
                                      ))
                                    : null}
                                </div>
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
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </Fragment>
        )
      })}

      {qtyTimelineBooking && qtyTimelineAnchor ? (
        <div
          ref={qtyTimelinePopoverRef}
          role="dialog"
          aria-label={isEn ? 'Quantity timeline' : '수량 타임라인'}
          className="fixed z-[80] w-[min(18rem,calc(100vw-1rem))] rounded-xl border border-border/70 bg-white p-3 shadow-lg"
          style={{
            top: Math.max(8, qtyTimelineAnchor.top - 8),
            left: Math.min(
              Math.max(8, qtyTimelineAnchor.left),
              typeof window !== 'undefined' ? window.innerWidth - 8 - 288 : qtyTimelineAnchor.left
            ),
            transform: 'translateY(-100%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-xs font-semibold text-foreground">
            {isEn ? 'Quantity timeline' : '수량 타임라인'}
          </p>
          <div className="max-h-56 overflow-y-auto">
            <TicketBookingQtyTimeline
              booking={qtyTimelineBooking}
              locale={locale}
              hideHeading
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
