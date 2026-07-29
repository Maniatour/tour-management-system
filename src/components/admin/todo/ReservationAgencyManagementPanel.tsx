'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { ExternalLink, Loader2, RefreshCw, Ticket, Users } from 'lucide-react'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { ReservationAgencyBookingHost } from '@/components/admin/todo/ReservationAgencyBookingHost'
import {
  findReservationAgencyManagementLinkedTodo,
  readReservationAgencyManagementLocalCompleted,
  reservationAgencyManagementCompletionDateKey,
  reservationAgencyManagementPanelTitle,
  writeReservationAgencyManagementLocalCompleted,
  type ReservationAgencyManagementLinkedTodo,
} from '@/lib/reservationAgencyManagementTodo'
import {
  useReservationAgencyManagementQueue,
  type ReservationAgencyManagementItem,
} from '@/hooks/useReservationAgencyManagementQueue'

const ReservationDetailPageView = dynamic(
  () =>
    import('@/components/reservation/ReservationDetailPageView').then(
      (mod) => mod.ReservationDetailPageView
    ),
  { ssr: false, loading: () => null }
)

type ReservationAgencyManagementPanelProps = {
  locale: string
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<ReservationAgencyManagementLinkedTodo & { title?: string | null }>
  onToggleLinkedTodo?: (
    todo: ReservationAgencyManagementLinkedTodo,
    completed: boolean
  ) => Promise<void>
  onCompletedChange?: (completed: boolean) => void
  onEditRequest?: () => void
  onHold?: boolean
  holdEnabled?: boolean
  onToggleHold?: () => void
  holdBusy?: boolean
  holdDisabledHint?: string
  queryEnabled?: boolean
}

const EMPTY_LINKED_TODOS: Array<ReservationAgencyManagementLinkedTodo & { title?: string | null }> =
  []

function formatShortTourDate(raw: string): string {
  if (!raw) return '—'
  const parts = raw.split('-')
  if (parts.length !== 3) return raw
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!month || !day) return raw
  return `${month}/${day}`
}

function AgencyItemRow({
  item,
  locale,
  onOpenReservation,
  onOpenBooking,
}: {
  item: ReservationAgencyManagementItem
  locale: string
  onOpenReservation: (reservationId: string) => void
  onOpenBooking: (item: ReservationAgencyManagementItem) => void
}) {
  const isKo = locale === 'ko'

  return (
    <div className="rounded-md border border-gray-200/80 bg-white px-2 py-1.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpenReservation(item.reservationId)}
            className="block w-full text-left"
          >
            <p className="truncate text-[11px] font-medium text-gray-900 hover:text-violet-700">
              <span className="tabular-nums text-gray-600">{formatShortTourDate(item.tourDate)}</span>
              <span className="mx-1 text-gray-300">·</span>
              <span>{item.customerName}</span>
              <span className="mx-1 text-gray-300">·</span>
              <span>{item.productName}</span>
            </p>
          </button>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {item.subCategory ? (
              <span className="rounded border border-sky-200 bg-sky-50 px-1 py-0.5 text-[9px] font-medium text-sky-900">
                {item.subCategory}
              </span>
            ) : null}
            {item.channelRn ? (
              <span className="truncate text-[9px] text-gray-500" title={item.channelRn}>
                RN {item.channelRn}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-0.5 text-[9px] text-gray-600">
              <Users className="h-3 w-3 shrink-0" aria-hidden />
              <span className="tabular-nums">{item.totalPeople}</span>
            </span>
            {item.ticketBookingCount > 0 ? (
              <span className="rounded border border-emerald-200 bg-emerald-50 px-1 py-0.5 text-[9px] font-medium text-emerald-800">
                {isKo ? `부킹 ${item.ticketBookingCount}` : `${item.ticketBookingCount} booking(s)`}
              </span>
            ) : (
              <span className="rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[9px] font-medium text-amber-900">
                {isKo ? '부킹 없음' : 'No booking'}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={() => onOpenReservation(item.reservationId)}
            className="inline-flex items-center gap-0.5 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[9px] font-medium text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            {isKo ? '예약·지출' : 'Reservation'}
          </button>
          <button
            type="button"
            onClick={() => onOpenBooking(item)}
            className="inline-flex items-center gap-0.5 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-medium text-violet-800 hover:bg-violet-100"
          >
            <Ticket className="h-3 w-3 shrink-0" aria-hidden />
            {isKo ? '티켓 부킹' : 'Ticket booking'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ReservationAgencyManagementPanel({
  locale,
  variant = 'list',
  className = '',
  linkedTodos = EMPTY_LINKED_TODOS,
  onToggleLinkedTodo,
  onCompletedChange,
  onEditRequest,
  onHold = false,
  holdEnabled = false,
  onToggleHold,
  holdBusy = false,
  holdDisabledHint,
  queryEnabled = true,
}: ReservationAgencyManagementPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const completionDateKey = useMemo(() => reservationAgencyManagementCompletionDateKey(), [])
  const { items, loading, reload, dateRange, count } = useReservationAgencyManagementQueue(queryEnabled)
  const linkedTodo = findReservationAgencyManagementLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null)
  const [bookingTarget, setBookingTarget] = useState<ReservationAgencyManagementItem | null>(null)

  useEffect(() => {
    setLocalCompleted(readReservationAgencyManagementLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted
  const progressLabel = isKo ? `대기 ${count}건` : `${count} pending`
  const dateRangeLabel = `${dateRange.start} ~ ${dateRange.end}`

  const handleToggleComplete = useCallback(async () => {
    const next = !completed
    setCompleting(true)
    try {
      if (linkedTodo && onToggleLinkedTodo) {
        await onToggleLinkedTodo(linkedTodo, next)
        onCompletedChange?.(next)
      } else {
        writeReservationAgencyManagementLocalCompleted(next, completionDateKey)
        setLocalCompleted(next)
      }
      onCompletedChange?.(next)
    } finally {
      setCompleting(false)
    }
  }, [completed, linkedTodo, onToggleLinkedTodo, onCompletedChange, completionDateKey])

  const handleModalSaved = useCallback(() => {
    setEditingReservationId(null)
    void reload()
  }, [reload])

  const handleBookingSaved = useCallback(() => {
    setBookingTarget(null)
    void reload()
  }, [reload])

  return (
    <>
      <div
        className={`${isList ? '' : 'rounded-xl border border-gray-200 bg-white p-3 shadow-sm'} ${className}`}
        onContextMenu={(e) => {
          if (!onEditRequest) return
          e.preventDefault()
          onEditRequest()
        }}
      >
        <div className="flex items-start gap-2">
          <TodoPanelStatusButtons
            locale={locale}
            completed={completed}
            onHold={onHold}
            busy={completing}
            holdBusy={holdBusy}
            holdEnabled={holdEnabled}
            holdDisabledHint={holdDisabledHint}
            onToggleComplete={() => void handleToggleComplete()}
            onToggleHold={onToggleHold}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p
                className={`text-[13px] font-semibold leading-snug ${
                  completed ? 'text-gray-400 line-through' : onHold ? 'text-amber-900' : 'text-gray-900'
                }`}
              >
                {reservationAgencyManagementPanelTitle(locale)}
              </p>
              <span className="shrink-0 text-[10px] font-medium text-gray-500">{progressLabel}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <p className="text-[10px] text-gray-500">
                {isKo
                  ? `예약 대행 상품 · 지출·고객카드 대행 미완료 (${dateRangeLabel})`
                  : `Agency products · pending expense or customer-card booking (${dateRangeLabel})`}
              </p>
              <button
                type="button"
                onClick={() => void reload()}
                className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-violet-700"
                title={isKo ? '목록 새로고침' : 'Refresh list'}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-2 space-y-1.5">
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {isKo ? '대상 예약 불러오는 중…' : 'Loading reservations…'}
            </div>
          ) : items.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-3 text-center text-[11px] text-gray-500">
              {isKo
                ? '처리가 필요한 예약 대행 건이 없습니다.'
                : 'No agency reservations need action.'}
            </p>
          ) : (
            items.map((item) => (
              <AgencyItemRow
                key={item.reservationId}
                item={item}
                locale={locale}
                onOpenReservation={setEditingReservationId}
                onOpenBooking={setBookingTarget}
              />
            ))
          )}
        </div>
      </div>

      {editingReservationId ? (
        <ReservationDetailPageView
          reservationId={editingReservationId}
          layout="modal"
          modalLightLoad
          onCancel={() => setEditingReservationId(null)}
          onSaved={handleModalSaved}
        />
      ) : null}

      {bookingTarget ? (
        <ReservationAgencyBookingHost
          locale={locale}
          reservationId={bookingTarget.reservationId}
          tourDate={bookingTarget.tourDate}
          onClose={() => setBookingTarget(null)}
          onSaved={handleBookingSaved}
        />
      ) : null}
    </>
  )
}
