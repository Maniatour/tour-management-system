'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import dynamic from 'next/dynamic'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { TodoPanelTourStatusButtons } from '@/components/admin/todo/TodoPanelTourStatusButtons'
import { AntelopeCanyonBookingEditModal } from '@/components/admin/todo/AntelopeCanyonBookingEditModal'
import TicketBookingCardView, {
  type DayTourCompareSummary,
  type TicketBookingCardViewRow,
} from '@/components/booking/TicketBookingCardView'
import {
  findAntelopeCanyonBookingLinkedTodo,
  readAntelopeCanyonBookingLocalCompleted,
  antelopeCanyonBookingCompletionDateKey,
  antelopeCanyonBookingPanelTitle,
  writeAntelopeCanyonBookingLocalCompleted,
  type AntelopeCanyonBookingLinkedTodo,
} from '@/lib/antelopeCanyonBookingTodo'
import {
  type AntelopeCanyonCancelDueTourRow,
  type AntelopeCanyonMismatchTourRow,
  type AntelopeCanyonTicketLite,
  type AntelopeCanyonTourLite,
} from '@/lib/antelopeCanyonBookingQueue'
import {
  aggregateTicketEaByCanyon,
  buildDayCanyonBookingActionTasks,
  canyonLxCountsMismatch,
  formatDayTourTicketCanyonCompare,
} from '@/lib/ticketBookingDateView'
import { getCancelDueDateForTicketBooking, localDateYmd } from '@/lib/ticketBookingCancelDue'
import {
  tourChoiceCountsDisplayKeys,
  type TourChoiceCounts,
} from '@/lib/tourChoiceCounts'
import {
  countTodoPanelTourProgress,
  getTodoPanelTourStatus,
  todoPanelTourRowClassName,
  todoPanelTourTitleClassName,
  type TodoPanelTourItemState,
} from '@/lib/todoPanelTourCompletion'
import { useTodoPanelTourCompletion } from '@/hooks/useTodoPanelTourCompletion'
import { useAntelopeCanyonBookingQueue } from '@/hooks/useAntelopeCanyonBookingQueue'
import { useTodoPanelAutoComplete } from '@/hooks/useTodoPanelAutoComplete'
import {
  getTodoPanelAutoCompleteMode,
  todoPanelPendingTourCount,
} from '@/lib/todoPanelAutoComplete'
import type { TicketBookingReservationDetailRow } from '@/components/booking/TicketBookingReservationDetailModal'

const TicketBookingReservationDetailModal = dynamic(
  () => import('@/components/booking/TicketBookingReservationDetailModal'),
  { ssr: false, loading: () => null }
)

type AntelopeCanyonBookingPanelProps = {
  locale: string
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<{ id: string; completed: boolean; title?: string | null }>
  onToggleLinkedTodo?: (
    todo: AntelopeCanyonBookingLinkedTodo,
    completed: boolean
  ) => Promise<void>
  onCompletedChange?: (completed: boolean) => void
  onEditRequest?: () => void
  onOpenTourDetail?: (tourId: string) => void
  onHold?: boolean
  holdEnabled?: boolean
  onToggleHold?: (() => void) | undefined
  holdBusy?: boolean
  holdDisabledHint?: string
  queryEnabled?: boolean
}

const EMPTY_LINKED_TODOS: Array<AntelopeCanyonBookingLinkedTodo & { title?: string | null }> = []

type WorkItem = {
  id: string
  date: string
  kind: 'mismatch' | 'cancel'
  label: string
  tourPeople: number
  ticketEa: number
  ticketCounts: TourChoiceCounts
  primaryTourId: string | null
  tickets: AntelopeCanyonTicketLite[]
}

/** mismatch / cancel 이 같은 day::YYYY-MM-DD id 를 공유할 수 있어 kind 를 합친다. */
function workItemKey(item: Pick<WorkItem, 'kind' | 'id'>): string {
  return `${item.kind}::${item.id}`
}

function formatShortDate(raw: string): string {
  if (!raw) return '—'
  const parts = raw.split('-')
  if (parts.length !== 3) return raw
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!month || !day) return raw
  return `${month}/${day}`
}

function toDetailRow(
  ticket: AntelopeCanyonTicketLite,
  toursById: Record<string, AntelopeCanyonTourLite>
): TicketBookingReservationDetailRow {
  const tourId = String(ticket.tour_id || '').trim()
  const linkedTour = tourId ? toursById[tourId] : undefined
  return {
    id: ticket.id,
    tour_id: ticket.tour_id,
    submit_on: '',
    category: ticket.category,
    company: ticket.company,
    reservation_name: ticket.rn_number || '',
    time: ticket.time,
    ea: ticket.ea,
    total_price: 0,
    status: ticket.status,
    cc: '',
    rn_number: ticket.rn_number || '',
    updated_at: '',
    booking_status: ticket.booking_status,
    vendor_status: ticket.vendor_status,
    change_status: ticket.change_status,
    check_in_date: ticket.check_in_date,
    ...(linkedTour
      ? {
          tours: {
            tour_date: linkedTour.tour_date,
            ...(linkedTour.products
              ? {
                  products: {
                    ...(linkedTour.products.name != null
                      ? { name: linkedTour.products.name }
                      : {}),
                    ...(linkedTour.products.name_en != null
                      ? { name_en: linkedTour.products.name_en }
                      : {}),
                    ...(linkedTour.products.name_ko != null
                      ? { name_ko: linkedTour.products.name_ko }
                      : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
  }
}

function ticketToCardRow(
  ticket: AntelopeCanyonTicketLite,
  toursById: Record<string, AntelopeCanyonTourLite>
): TicketBookingCardViewRow {
  const tourId = String(ticket.tour_id || '').trim()
  const linkedTour = tourId ? toursById[tourId] : undefined
  return {
    id: ticket.id,
    company: ticket.company || '—',
    category: ticket.category || '',
    check_in_date: String(ticket.check_in_date || '').slice(0, 10),
    time: ticket.time || '',
    ea: Number(ticket.ea) || 0,
    pending_ea: ticket.pending_ea ?? null,
    pending_time: ticket.pending_time ?? null,
    rn_number: ticket.rn_number ?? null,
    status: ticket.status ?? null,
    booking_status: ticket.booking_status ?? null,
    vendor_status: ticket.vendor_status ?? null,
    change_status: ticket.change_status ?? null,
    tour_id: ticket.tour_id ?? null,
    ...(linkedTour
      ? {
          tours: {
            tour_date: linkedTour.tour_date,
            ...(linkedTour.products
              ? {
                  products: {
                    ...(linkedTour.products.name != null
                      ? { name: linkedTour.products.name }
                      : {}),
                    ...(linkedTour.products.name_en != null
                      ? { name_en: linkedTour.products.name_en }
                      : {}),
                    ...(linkedTour.products.name_ko != null
                      ? { name_ko: linkedTour.products.name_ko }
                      : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
  }
}

/** 티켓 캐년 키가 하나면 투어 인원을 그 키에 매핑 (부킹 관리 카드뷰와 동일 뱃지) */
function approximateTourChoiceCounts(
  tourPeople: number,
  ticketCounts: TourChoiceCounts
): TourChoiceCounts {
  const keys = tourChoiceCountsDisplayKeys(ticketCounts)
  if (keys.length === 1) {
    return { [keys[0]!]: tourPeople }
  }
  if (keys.length === 0 && tourPeople > 0) {
    return { L: tourPeople }
  }
  return {}
}

function workDateFromMismatch(row: AntelopeCanyonMismatchTourRow): string {
  return String(row.tour_date || '').slice(0, 10)
}

function workDateFromCancel(row: AntelopeCanyonCancelDueTourRow): string {
  return String(row.check_in_date || row.tour_date || '').slice(0, 10)
}

export function AntelopeCanyonBookingPanel({
  locale,
  variant = 'list',
  className = '',
  linkedTodos = EMPTY_LINKED_TODOS,
  onToggleLinkedTodo,
  onCompletedChange,
  onEditRequest,
  onOpenTourDetail,
  onHold = false,
  holdEnabled = false,
  onToggleHold,
  holdBusy = false,
  holdDisabledHint,
  queryEnabled = true,
}: AntelopeCanyonBookingPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const completionDateKey = useMemo(() => antelopeCanyonBookingCompletionDateKey(), [])
  const {
    mismatchRows,
    cancelDueRows,
    toursById,
    supplierProductsByBookingId,
    loading,
    reload,
    dateRange,
  } = useAntelopeCanyonBookingQueue(queryEnabled)
  const { tourState, setTourStatus } = useTodoPanelTourCompletion(
    'antelope-canyon-booking',
    completionDateKey
  )
  const linkedTodo = findAntelopeCanyonBookingLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [detailTickets, setDetailTickets] = useState<AntelopeCanyonTicketLite[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [editBookingId, setEditBookingId] = useState<string | null>(null)

  useEffect(() => {
    setLocalCompleted(readAntelopeCanyonBookingLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted

  const workItems = useMemo((): WorkItem[] => {
    const items: WorkItem[] = []
    for (const row of mismatchRows) {
      const date = workDateFromMismatch(row)
      if (!date) continue
      items.push({
        id: row.id,
        date,
        kind: 'mismatch',
        label: row.product_name,
        tourPeople: row.tour_people,
        ticketEa: row.ticket_ea_current,
        ticketCounts: row.ticket_counts,
        primaryTourId: row.primary_tour_id ?? (row.id.startsWith('day::') ? null : row.id),
        tickets: row.tickets,
      })
    }
    for (const row of cancelDueRows) {
      const date = workDateFromCancel(row)
      if (!date) continue
      // 같은 날짜·같은 티켓 집합이 mismatch에 이미 있으면 cancel 처리 상태만 별도 유지
      items.push({
        id: row.id,
        date,
        kind: 'cancel',
        label: row.product_name,
        tourPeople: row.tour_people,
        ticketEa: row.ticket_ea_current,
        ticketCounts: aggregateTicketEaByCanyon(row.tickets),
        primaryTourId: row.tour_id || null,
        tickets: row.tickets,
      })
    }
    return items.sort(
      (a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label)
    )
  }, [mismatchRows, cancelDueRows])

  const progress = useMemo(() => {
    return countTodoPanelTourProgress(
      workItems.map((w) => workItemKey(w)),
      tourState
    )
  }, [workItems, tourState])

  const dateRangeLabel = useMemo(() => {
    const fmt = (d: string) => formatShortDate(d)
    return `${fmt(dateRange.start)} – ${fmt(dateRange.end)}`
  }, [dateRange])

  const progressLabel = useMemo(() => {
    const mismatchCount = workItems.filter((w) => w.kind === 'mismatch').length
    const cancelCount = workItems.filter((w) => w.kind === 'cancel').length
    const queueLabel = isKo
      ? `불일치 ${mismatchCount} · 취소 ${cancelCount}`
      : `${mismatchCount} mismatched · ${cancelCount} cancel due`
    if (progress.total === 0) return queueLabel
    const tourProgress =
      progress.onHold > 0
        ? isKo
          ? `처리 ${progress.done}/${progress.total} · 보류 ${progress.onHold}`
          : `Done ${progress.done}/${progress.total} · hold ${progress.onHold}`
        : isKo
          ? `처리 ${progress.done}/${progress.total}`
          : `Done ${progress.done}/${progress.total}`
    return `${queueLabel} · ${tourProgress}`
  }, [isKo, workItems, progress])

  const cardBookings = useMemo((): TicketBookingCardViewRow[] => {
    const byId = new Map<string, TicketBookingCardViewRow>()
    for (const item of workItems) {
      for (const ticket of item.tickets) {
        if (!ticket?.id || byId.has(ticket.id)) continue
        byId.set(ticket.id, ticketToCardRow(ticket, toursById))
      }
    }
    return Array.from(byId.values()).sort(
      (a, b) =>
        String(a.check_in_date).localeCompare(String(b.check_in_date)) ||
        String(a.company).localeCompare(String(b.company)) ||
        String(a.time).localeCompare(String(b.time))
    )
  }, [workItems, toursById])

  const dayTourCompareByDate = useMemo(() => {
    const map = new Map<string, DayTourCompareSummary>()
    const byDate = new Map<string, WorkItem[]>()
    for (const item of workItems) {
      const list = byDate.get(item.date) || []
      list.push(item)
      byDate.set(item.date, list)
    }

    for (const [date, items] of byDate) {
      // 당일 합산 행 우선, 없으면 인원·티켓 최대값 사용 (중복 집계 방지)
      const preferred =
        items.find((i) => i.id.startsWith('day::')) ||
        items.reduce((best, cur) =>
          cur.ticketEa > best.ticketEa || cur.tourPeople > best.tourPeople ? cur : best
        )
      const ticketCounts =
        Object.keys(preferred.ticketCounts).length > 0
          ? preferred.ticketCounts
          : aggregateTicketEaByCanyon(preferred.tickets)
      const tourCounts = approximateTourChoiceCounts(preferred.tourPeople, ticketCounts)
      const canyonParts = formatDayTourTicketCanyonCompare(tourCounts, ticketCounts)
      const actionTasks = buildDayCanyonBookingActionTasks(tourCounts, ticketCounts, locale)
      const canyonMismatch =
        canyonParts.length > 0 && canyonLxCountsMismatch(tourCounts, ticketCounts)
      map.set(date, {
        tourPeople: preferred.tourPeople,
        ticketEa: preferred.ticketEa,
        canyonParts,
        actionTasks,
        mismatch: preferred.tourPeople !== preferred.ticketEa || canyonMismatch,
      })
    }
    return map
  }, [workItems, locale])

  const workItemsByDate = useMemo(() => {
    const map = new Map<string, WorkItem[]>()
    for (const item of workItems) {
      const list = map.get(item.date) || []
      list.push(item)
      map.set(item.date, list)
    }
    return map
  }, [workItems])

  const todayYmd = useMemo(() => localDateYmd(), [])

  const setPanelCompleted = useCallback(
    async (next: boolean) => {
      if (next === completed) return
      setCompleting(true)
      try {
        if (linkedTodo && onToggleLinkedTodo) {
          await onToggleLinkedTodo(linkedTodo as AntelopeCanyonBookingLinkedTodo, next)
        } else {
          writeAntelopeCanyonBookingLocalCompleted(next, completionDateKey)
          setLocalCompleted(next)
        }
        onCompletedChange?.(next)
      } finally {
        setCompleting(false)
      }
    },
    [completed, linkedTodo, onToggleLinkedTodo, onCompletedChange, completionDateKey]
  )

  const handleToggleComplete = useCallback(async () => {
    await setPanelCompleted(!completed)
  }, [completed, setPanelCompleted])

  useTodoPanelAutoComplete({
    enabled: queryEnabled,
    loading,
    workCount: todoPanelPendingTourCount(progress),
    completed,
    onHold,
    mode: getTodoPanelAutoCompleteMode('antelope-canyon-booking'),
    applyCompleted: setPanelCompleted,
  })

  const openTicketDetail = useCallback((ticketId: string) => {
    const ticket = workItems
      .flatMap((w) => w.tickets)
      .find((t) => t.id === ticketId)
    if (!ticket) return
    setDetailTickets([ticket])
    setDetailOpen(true)
  }, [workItems])

  const sortedDates = useMemo(
    () => Array.from(workItemsByDate.keys()).sort((a, b) => a.localeCompare(b)),
    [workItemsByDate]
  )

  return (
    <>
      <div
        className={
          isList
            ? className
            : `w-full rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50/70 to-white p-3 shadow-sm ${completed ? 'opacity-80' : ''}`
        }
        title={onEditRequest ? (isKo ? '우클릭: 수정' : 'Right-click to edit') : undefined}
        onContextMenu={
          onEditRequest
            ? (e) => {
                e.preventDefault()
                e.stopPropagation()
                onEditRequest()
              }
            : undefined
        }
      >
        <div className="flex items-start gap-2">
          <TodoPanelStatusButtons
            locale={locale}
            completed={completed}
            onHold={onHold}
            busy={completing}
            holdBusy={holdBusy}
            holdEnabled={holdEnabled}
            {...(holdDisabledHint ? { holdDisabledHint } : {})}
            onToggleComplete={() => void handleToggleComplete()}
            onToggleHold={onToggleHold}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <p
                  className={`min-w-0 text-[13px] font-semibold leading-snug ${
                    completed ? 'text-gray-400 line-through' : onHold ? 'text-amber-900' : 'text-gray-900'
                  }`}
                >
                  {antelopeCanyonBookingPanelTitle(locale)}
                </p>
                {isList ? (
                  <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-900">
                    {isKo ? '일일' : 'Daily'}
                  </span>
                ) : null}
                <span className="shrink-0 text-[10px] text-gray-500">{dateRangeLabel}</span>
                {workItems.length > 0 && (
                  <span className="shrink-0 text-[10px] font-medium text-orange-900">{progressLabel}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => void reload()}
                className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-orange-800"
                title={isKo ? '목록 새로고침' : 'Refresh list'}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-2 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {isKo ? '앤텔롭캐년 부킹 확인 중…' : 'Checking Antelope Canyon bookings…'}
            </div>
          ) : workItems.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-2.5 text-center text-[11px] text-gray-500">
              {isKo
                ? '처리할 앤텔롭캐년 부킹(불일치·변경·취소 마감)이 없습니다.'
                : 'No Antelope Canyon booking tasks (mismatch / change / cancel due).'}
            </p>
          ) : (
            sortedDates.map((date) => {
              const dayItems = workItemsByDate.get(date) || []
              const dayBookings = cardBookings.filter(
                (b) => String(b.check_in_date || '').slice(0, 10) === date
              )
              const dayCompare = new Map<string, DayTourCompareSummary>()
              const compare = dayTourCompareByDate.get(date)
              if (compare) dayCompare.set(date, compare)

              return (
                <div key={date} className="space-y-1.5">
                  {dayItems.map((item) => {
                    const itemKey = workItemKey(item)
                    const rowStatus = getTodoPanelTourStatus(itemKey, tourState)
                    return (
                      <div
                        key={itemKey}
                        className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 ${todoPanelTourRowClassName(rowStatus)}`}
                      >
                        <TodoPanelTourStatusButtons
                          locale={locale}
                          status={rowStatus}
                          onSetStatus={(next: TodoPanelTourItemState) =>
                            setTourStatus(itemKey, next)
                          }
                        />
                        <p
                          className={`min-w-0 flex-1 truncate text-[10px] font-medium ${todoPanelTourTitleClassName(rowStatus)}`}
                        >
                          <span className="tabular-nums text-gray-600">
                            {formatShortDate(item.date)}
                          </span>
                          <span className="mx-1 text-gray-300">·</span>
                          <span>{item.label}</span>
                          <span className="mx-1 text-gray-300">·</span>
                          <span className="tabular-nums text-gray-500">
                            {item.tourPeople}/{item.ticketEa}
                          </span>
                        </p>
                        {onOpenTourDetail && item.primaryTourId ? (
                          <button
                            type="button"
                            onClick={() => onOpenTourDetail(item.primaryTourId!)}
                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                            title={isKo ? '투어 상세' : 'Tour detail'}
                            aria-label={isKo ? '투어 상세' : 'Tour detail'}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        ) : null}
                      </div>
                    )
                  })}

                  <TicketBookingCardView
                    bookings={dayBookings}
                    locale={locale}
                    todayYmd={todayYmd}
                    density="compact"
                    hideAmounts
                    dayTourCompareByDate={dayCompare}
                    tourPeopleReservationsSummary={(tourPeople, reservations) =>
                      isKo
                        ? `투어 : ${tourPeople}명 / 예약 : ${reservations}개`
                        : `Tour: ${tourPeople} people / Tickets: ${reservations}`
                    }
                    getCancelDueDate={(b) =>
                      getCancelDueDateForTicketBooking(
                        { check_in_date: b.check_in_date, company: b.company },
                        supplierProductsByBookingId.get(b.id) ?? null
                      )
                    }
                    getSupplierProduct={(b) => supplierProductsByBookingId.get(b.id) ?? null}
                    onOpenBooking={(b) => openTicketDetail(b.id)}
                    emptyMessage={
                      isKo ? '표시할 부킹이 없습니다' : 'No bookings to show'
                    }
                  />
                </div>
              )
            })
          )}
        </div>
      </div>

      <TicketBookingReservationDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        bookings={detailTickets.map((ticket) => toDetailRow(ticket, toursById))}
        onEdit={(b) => {
          setDetailOpen(false)
          setEditBookingId(b.id)
        }}
        onActionApplied={() => void reload()}
      />

      <AntelopeCanyonBookingEditModal
        bookingId={editBookingId}
        locale={locale}
        onClose={() => setEditBookingId(null)}
        onSaved={() => void reload()}
      />
    </>
  )
}
