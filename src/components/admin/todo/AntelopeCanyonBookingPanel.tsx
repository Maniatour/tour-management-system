'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ExternalLink, Loader2, RefreshCw, Ticket } from 'lucide-react'
import dynamic from 'next/dynamic'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { TodoPanelTourStatusButtons } from '@/components/admin/todo/TodoPanelTourStatusButtons'
import { AntelopeCanyonBookingEditModal } from '@/components/admin/todo/AntelopeCanyonBookingEditModal'
import {
  findAntelopeCanyonBookingLinkedTodo,
  readAntelopeCanyonBookingLocalCompleted,
  antelopeCanyonBookingCompletionDateKey,
  antelopeCanyonBookingPanelTitle,
  writeAntelopeCanyonBookingLocalCompleted,
  type AntelopeCanyonBookingLinkedTodo,
} from '@/lib/antelopeCanyonBookingTodo'
import {
  formatAntelopeCanyonCountSummary,
  formatAntelopeCanyonTicketTime,
  formatTicketEaWithPending,
  isTicketChangeRequested,
  type AntelopeCanyonTicketLite,
} from '@/lib/antelopeCanyonBookingQueue'
import { isTicketBookingPendingRequestState } from '@/lib/ticketBookingWorkflow'
import {
  countTodoPanelTourProgress,
  getTodoPanelTourStatus,
  todoPanelTourRowClassName,
  todoPanelTourTitleClassName,
  type TodoPanelTourItemState,
} from '@/lib/todoPanelTourCompletion'
import { useTodoPanelTourCompletion } from '@/hooks/useTodoPanelTourCompletion'
import { useAntelopeCanyonBookingQueue } from '@/hooks/useAntelopeCanyonBookingQueue'
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

function formatShortDate(raw: string): string {
  if (!raw) return '—'
  const parts = raw.split('-')
  if (parts.length !== 3) return raw
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!month || !day) return raw
  return `${month}/${day}`
}

function toDetailRow(ticket: AntelopeCanyonTicketLite): TicketBookingReservationDetailRow {
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
  }
}

function TicketCard({
  ticket,
  locale,
  onOpenDetail,
}: {
  ticket: AntelopeCanyonTicketLite
  locale: string
  onOpenDetail: (ticket: AntelopeCanyonTicketLite) => void
}) {
  const isKo = locale === 'ko'
  const pending = isTicketChangeRequested(ticket)
  const vendorPending = isTicketBookingPendingRequestState(ticket)
  const displayTime = formatAntelopeCanyonTicketTime(
    pending && ticket.pending_time ? ticket.pending_time : ticket.time
  )

  return (
    <button
      type="button"
      onClick={() => onOpenDetail(ticket)}
      className={[
        'flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left transition-colors',
        pending
          ? 'border-violet-300 bg-violet-50/50 hover:border-violet-400 hover:bg-violet-50'
          : vendorPending
            ? 'border-amber-300 bg-amber-50/50 hover:border-amber-400 hover:bg-amber-50'
            : 'border-orange-200/80 bg-white hover:border-orange-300 hover:bg-orange-50/40',
      ].join(' ')}
    >
      <Ticket
        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
          pending ? 'text-violet-700' : vendorPending ? 'text-amber-700' : 'text-orange-700'
        }`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-gray-900">
          <span className="text-gray-600">{ticket.company}</span>
          {displayTime ? (
            <>
              <span className="mx-1 text-gray-300">·</span>
              <span className="tabular-nums">{displayTime}</span>
            </>
          ) : null}
          <span className="mx-1 text-gray-300">·</span>
          <span
            className={[
              'inline-flex rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums',
              pending
                ? 'bg-violet-100 text-violet-900'
                : vendorPending
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-orange-50 text-orange-900',
            ].join(' ')}
          >
            {formatTicketEaWithPending(ticket, isKo)}
          </span>
          {pending ? (
            <span className="ml-1 rounded border border-violet-200 bg-white px-1 py-0.5 text-[9px] font-medium text-violet-800">
              {isKo ? '변경 요청' : 'Change req.'}
            </span>
          ) : vendorPending ? (
            <span className="ml-1 rounded border border-amber-200 bg-white px-1 py-0.5 text-[9px] font-medium text-amber-800">
              {isKo ? '대기중' : 'Pending'}
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-gray-500">
          {ticket.rn_number || ticket.category || '—'}
        </p>
      </div>
    </button>
  )
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
  const { mismatchRows, cancelDueRows, loading, reload, dateRange, cancelDueCheckInYmd } =
    useAntelopeCanyonBookingQueue(queryEnabled)
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

  const progress = useMemo(() => {
    const ids = [
      ...mismatchRows.map((r) => r.id),
      ...cancelDueRows.map((r) => r.id),
    ]
    return countTodoPanelTourProgress(ids, tourState)
  }, [mismatchRows, cancelDueRows, tourState])

  const dateRangeLabel = useMemo(() => {
    const fmt = (d: string) => formatShortDate(d)
    return `${fmt(dateRange.start)} – ${fmt(dateRange.end)}`
  }, [dateRange])

  const progressLabel = useMemo(() => {
    const queueLabel = isKo
      ? `불일치 ${mismatchRows.length} · 취소 ${cancelDueRows.length}`
      : `${mismatchRows.length} mismatched · ${cancelDueRows.length} cancel due`
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
  }, [isKo, mismatchRows.length, cancelDueRows.length, progress])

  const handleToggleComplete = useCallback(async () => {
    const next = !completed
    setCompleting(true)
    try {
      if (linkedTodo && onToggleLinkedTodo) {
        await onToggleLinkedTodo(linkedTodo as AntelopeCanyonBookingLinkedTodo, next)
        onCompletedChange?.(next)
      } else {
        writeAntelopeCanyonBookingLocalCompleted(next, completionDateKey)
        setLocalCompleted(next)
      }
      onCompletedChange?.(next)
    } finally {
      setCompleting(false)
    }
  }, [completed, linkedTodo, onToggleLinkedTodo, onCompletedChange, completionDateKey])

  const openTicketDetail = useCallback((ticket: AntelopeCanyonTicketLite) => {
    setDetailTickets([ticket])
    setDetailOpen(true)
  }, [])

  const openTourTicketsDetail = useCallback((tickets: AntelopeCanyonTicketLite[]) => {
    if (!tickets.length) return
    setDetailTickets(tickets)
    setDetailOpen(true)
  }, [])

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
                {(mismatchRows.length > 0 || cancelDueRows.length > 0) && (
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

        <div className="mt-2 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {isKo ? '앤텔롭캐년 부킹 확인 중…' : 'Checking Antelope Canyon bookings…'}
            </div>
          ) : (
            <>
              <section>
                <div className="mb-1 flex items-center gap-1.5">
                  <p className="text-[11px] font-semibold text-gray-800">
                    {isKo ? '1. 추가 등록 / 변경' : '1. Add / change bookings'}
                  </p>
                  <span className="text-[10px] text-gray-500">
                    {isKo
                      ? `3일 이내 투어 · 인원 불일치·변경·대기`
                      : `Tours within 3 days · mismatch / change / pending`}
                  </span>
                </div>
                {mismatchRows.length === 0 ? (
                  <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-2.5 text-center text-[11px] text-gray-500">
                    {isKo
                      ? '인원·부킹 불일치, 변경 요청, 벤더 대기 중인 3일 이내 투어가 없습니다.'
                      : 'No mismatched, change-pending, or vendor-pending tours in the next 3 days.'}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {mismatchRows.map((row) => {
                      const rowStatus = getTodoPanelTourStatus(row.id, tourState)
                      return (
                        <div
                          key={row.id}
                          className={`rounded-md border p-1.5 ${todoPanelTourRowClassName(rowStatus)}`}
                        >
                          <div className="flex items-start gap-1.5">
                            <TodoPanelTourStatusButtons
                              locale={locale}
                              status={rowStatus}
                              onSetStatus={(next: TodoPanelTourItemState) =>
                                setTourStatus(row.id, next)
                              }
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-[11px] font-medium leading-snug ${todoPanelTourTitleClassName(rowStatus)}`}
                              >
                                <span className="tabular-nums text-gray-600">
                                  {formatShortDate(row.tour_date)}
                                </span>
                                <span className="mx-1 text-gray-300">·</span>
                                <span>{row.product_name}</span>
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                <span className="rounded border border-blue-200 bg-blue-50 px-1 py-0.5 text-[9px] font-semibold tabular-nums text-blue-900">
                                  {isKo ? '투어' : 'Tour'} {row.tour_people}
                                </span>
                                <span className="rounded border border-orange-200 bg-orange-50 px-1 py-0.5 text-[9px] font-semibold tabular-nums text-orange-900">
                                  {isKo ? '티켓' : 'Tickets'}{' '}
                                  {row.ticket_ea_current !== row.ticket_ea
                                    ? `${row.ticket_ea_current} → ${row.ticket_ea}`
                                    : row.ticket_ea}
                                </span>
                                {row.has_pending_change ? (
                                  <span className="rounded border border-violet-200 bg-violet-50 px-1 py-0.5 text-[9px] font-medium text-violet-900">
                                    {isKo ? '변경 요청' : 'Change pending'}
                                  </span>
                                ) : null}
                                {row.has_vendor_pending ? (
                                  <span className="rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[9px] font-medium text-amber-900">
                                    {isKo ? '대기중' : 'Pending'}
                                  </span>
                                ) : null}
                                {formatAntelopeCanyonCountSummary(row.ticket_counts, isKo) !==
                                '—' ? (
                                  <span className="text-[9px] text-gray-600">
                                    {formatAntelopeCanyonCountSummary(row.ticket_counts, isKo)}
                                  </span>
                                ) : null}
                                <span className="inline-flex items-center gap-0.5 rounded border border-red-200 bg-red-50 px-1 py-0.5 text-[9px] font-medium text-red-800">
                                  <AlertTriangle className="h-3 w-3" aria-hidden />
                                  {row.has_pending_change &&
                                  row.tour_people === row.ticket_ea_current
                                    ? isKo
                                      ? '변경 요청 확인'
                                      : 'Review change'
                                    : row.has_vendor_pending &&
                                        row.tour_people === row.ticket_ea_current
                                      ? isKo
                                        ? '벤더 응답 대기'
                                        : 'Vendor pending'
                                      : `${row.tour_people} ≠ ${row.ticket_ea_current}`}
                                </span>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col gap-0.5">
                              {onOpenTourDetail &&
                              (row.primary_tour_id || !row.id.startsWith('day::')) ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenTourDetail(row.primary_tour_id ?? row.id)
                                  }
                                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                  title={isKo ? '투어 상세' : 'Tour detail'}
                                  aria-label={isKo ? '투어 상세' : 'Tour detail'}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                              {row.tickets.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => openTourTicketsDetail(row.tickets)}
                                  className="inline-flex h-6 items-center justify-center rounded border border-orange-200 bg-orange-50 px-1.5 text-[9px] font-medium text-orange-900 hover:bg-orange-100"
                                >
                                  {isKo ? '전체' : 'All'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                          {row.tickets.length > 0 ? (
                            <div className="mt-1.5 space-y-1">
                              {row.tickets.map((ticket) => (
                                <TicketCard
                                  key={ticket.id}
                                  ticket={ticket}
                                  locale={locale}
                                  onOpenDetail={openTicketDetail}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-1 flex items-center gap-1.5">
                  <p className="text-[11px] font-semibold text-gray-800">
                    {isKo ? '2. Due Date' : '2. Due Date'}
                  </p>
                  <span className="text-[10px] text-gray-500">
                    {isKo
                      ? `오늘 취소 · 체크인 ${formatShortDate(cancelDueCheckInYmd)} (2일 후)`
                      : `Cancel today · check-in ${cancelDueCheckInYmd} (D+2)`}
                  </span>
                </div>
                {cancelDueRows.length === 0 ? (
                  <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-2.5 text-center text-[11px] text-gray-500">
                    {isKo
                      ? '오늘 취소가 필요한 초과 티켓이 없습니다.'
                      : 'No excess tickets need cancellation today.'}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {cancelDueRows.map((row) => {
                      const rowStatus = getTodoPanelTourStatus(row.id, tourState)
                      return (
                        <div
                          key={row.id}
                          className={`rounded-md border p-1.5 ${
                            rowStatus === 'pending'
                              ? 'border-red-200/80 bg-red-50/30'
                              : todoPanelTourRowClassName(rowStatus)
                          }`}
                        >
                          <div className="flex items-start gap-1.5">
                            <TodoPanelTourStatusButtons
                              locale={locale}
                              status={rowStatus}
                              onSetStatus={(next: TodoPanelTourItemState) =>
                                setTourStatus(row.id, next)
                              }
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-[11px] font-medium leading-snug ${todoPanelTourTitleClassName(rowStatus)}`}
                              >
                                <span className="tabular-nums text-gray-600">
                                  {formatShortDate(row.check_in_date)}
                                </span>
                                <span className="mx-1 text-gray-300">·</span>
                                <span>{row.product_name}</span>
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                <span className="rounded border border-blue-200 bg-blue-50 px-1 py-0.5 text-[9px] font-semibold tabular-nums text-blue-900">
                                  {isKo ? '투어' : 'Tour'} {row.tour_people}
                                </span>
                                <span className="rounded border border-orange-200 bg-orange-50 px-1 py-0.5 text-[9px] font-semibold tabular-nums text-orange-900">
                                  {isKo ? '보유' : 'Held'}{' '}
                                  {row.ticket_ea_current !== row.ticket_ea
                                    ? `${row.ticket_ea_current} → ${row.ticket_ea}`
                                    : row.ticket_ea}
                                </span>
                                {row.has_pending_change ? (
                                  <span className="rounded border border-violet-200 bg-violet-50 px-1 py-0.5 text-[9px] font-medium text-violet-900">
                                    {isKo ? '변경 요청' : 'Change pending'}
                                  </span>
                                ) : null}
                                {row.has_vendor_pending ? (
                                  <span className="rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[9px] font-medium text-amber-900">
                                    {isKo ? '대기중' : 'Pending'}
                                  </span>
                                ) : null}
                                <span className="rounded border border-red-300 bg-red-100 px-1 py-0.5 text-[9px] font-bold tabular-nums text-red-900">
                                  {isKo ? '취소 요청' : 'Cancel'} {row.cancel_from} →{' '}
                                  {row.cancel_to}
                                </span>
                                <span className="text-[9px] text-gray-500">
                                  Due {formatShortDate(row.cancel_due_date)}
                                </span>
                              </div>
                            </div>
                            {onOpenTourDetail ? (
                              <button
                                type="button"
                                onClick={() => onOpenTourDetail(row.tour_id)}
                                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                title={isKo ? '투어 상세' : 'Tour detail'}
                                aria-label={isKo ? '투어 상세' : 'Tour detail'}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                          {row.tickets.length > 0 ? (
                            <div className="mt-1.5 space-y-1">
                              {row.tickets.map((ticket) => (
                                <TicketCard
                                  key={ticket.id}
                                  ticket={ticket}
                                  locale={locale}
                                  onOpenDetail={openTicketDetail}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <TicketBookingReservationDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        bookings={detailTickets.map(toDetailRow)}
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
