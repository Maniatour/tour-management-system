'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ExternalLink,
  Globe,
  Loader2,
  Pencil,
  RefreshCw,
} from 'lucide-react'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { TodoPanelTourStatusButtons } from '@/components/admin/todo/TodoPanelTourStatusButtons'
import { TourHotelPriceCheckEditModal } from '@/components/admin/todo/TourHotelPriceCheckEditModal'
import {
  findTourHotelPriceCheckLinkedTodo,
  isTourHotelPriceCheckHighUnitPrice,
  normalizeTourHotelWebsiteUrl,
  readTourHotelPriceCheckLocalCompleted,
  tourHotelPriceCheckCompletionDateKey,
  tourHotelPriceCheckPanelTitle,
  writeTourHotelPriceCheckLocalCompleted,
  type TourHotelPriceCheckLinkedTodo,
} from '@/lib/tourHotelPriceCheckTodo'
import {
  countTodoPanelTourProgress,
  getTodoPanelTourStatus,
  todoPanelTourRowClassName,
  todoPanelTourTitleClassName,
} from '@/lib/todoPanelTourCompletion'
import { useTodoPanelTourCompletion } from '@/hooks/useTodoPanelTourCompletion'
import { useTourHotelPriceCheckQueue } from '@/hooks/useTourHotelPriceCheckQueue'

type TourHotelPriceCheckPanelProps = {
  locale: string
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<TourHotelPriceCheckLinkedTodo & { title?: string | null }>
  onToggleLinkedTodo?: (todo: TourHotelPriceCheckLinkedTodo, completed: boolean) => Promise<void>
  onCompletedChange?: (completed: boolean) => void
  onEditRequest?: () => void
  onOpenTourDetail?: (tourId: string) => void
  onHold?: boolean
  holdEnabled?: boolean
  onToggleHold?: () => void
  holdBusy?: boolean
  holdDisabledHint?: string
  queryEnabled?: boolean
}

const EMPTY_LINKED_TODOS: Array<TourHotelPriceCheckLinkedTodo & { title?: string | null }> = []

function formatShortDate(raw: string): string {
  if (!raw) return '—'
  const parts = raw.split('-')
  if (parts.length !== 3) return raw
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!month || !day) return raw
  return `${month}/${day}`
}

function formatUsd(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function formatTourHotelPriceCheckRowLabel(
  row: {
    check_in_date: string
    hotel: string
    tour_name: string | null
    reservation_name: string | null
    tour_date: string | null
    display_price: number | null
    rooms: number
  },
  isKo: boolean
): string {
  const tourLabel = row.tour_name || row.reservation_name || '—'
  const priceLabel = formatUsd(row.display_price) + (row.rooms > 1 ? ` ×${row.rooms}` : '')
  const parts = [
    formatShortDate(row.check_in_date),
    row.hotel,
    tourLabel,
    priceLabel,
    row.tour_date ? `${isKo ? '투어' : 'Tour'} ${formatShortDate(row.tour_date)}` : null,
  ].filter((part): part is string => Boolean(part))
  return parts.join(' , ')
}

function tourHotelPriceCheckRowBorderClassName(
  rowStatus: ReturnType<typeof getTodoPanelTourStatus>,
  highPrice: boolean
): string {
  if (highPrice) {
    return 'border-red-300 bg-red-50/40 shadow-[inset_0_0_0_1px] shadow-red-200/50'
  }
  if (rowStatus === 'pending') {
    return 'border-sky-200/80 bg-white/80 shadow-[inset_0_0_0_1px] shadow-sky-300/40'
  }
  return todoPanelTourRowClassName(rowStatus)
}

export function TourHotelPriceCheckPanel({
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
}: TourHotelPriceCheckPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const completionDateKey = useMemo(() => tourHotelPriceCheckCompletionDateKey(), [])
  const { rows, loading, error, reload, dateRange } = useTourHotelPriceCheckQueue(queryEnabled)
  const { tourState, setTourStatus } = useTodoPanelTourCompletion(
    'tour-hotel-price-check',
    completionDateKey
  )
  const linkedTodo = findTourHotelPriceCheckLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [editBookingId, setEditBookingId] = useState<string | null>(null)

  useEffect(() => {
    setLocalCompleted(readTourHotelPriceCheckLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted

  const displayRows = rows

  const progress = useMemo(
    () => countTodoPanelTourProgress(rows.map((r) => r.id), tourState),
    [rows, tourState]
  )

  const progressLabel =
    progress.onHold > 0
      ? isKo
        ? `확인 ${progress.done}/${progress.total} · 보류 ${progress.onHold}`
        : `Checked ${progress.done}/${progress.total} · hold ${progress.onHold}`
      : isKo
        ? `확인 ${progress.done}/${progress.total}`
        : `Checked ${progress.done}/${progress.total}`

  const dateRangeLabel = useMemo(() => {
    const fmt = (d: string) => {
      const parts = d.split('-')
      if (parts.length !== 3) return d
      return `${Number(parts[1])}/${Number(parts[2])}`
    }
    return `${fmt(dateRange.start)} – ${fmt(dateRange.end)}`
  }, [dateRange])

  const handleToggleComplete = useCallback(async () => {
    const next = !completed
    setCompleting(true)
    try {
      if (linkedTodo && onToggleLinkedTodo) {
        await onToggleLinkedTodo(linkedTodo, next)
        onCompletedChange?.(next)
      } else {
        writeTourHotelPriceCheckLocalCompleted(next, completionDateKey)
        setLocalCompleted(next)
      }
      onCompletedChange?.(next)
    } finally {
      setCompleting(false)
    }
  }, [completed, linkedTodo, onToggleLinkedTodo, onCompletedChange, completionDateKey])

  return (
    <>
      <div
        className={
          isList
            ? className
            : `w-full rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50/70 to-white p-3 shadow-sm ${completed ? 'opacity-80' : ''}`
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
            holdDisabledHint={holdDisabledHint}
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
                  {tourHotelPriceCheckPanelTitle(locale)}
                </p>
                {isList ? (
                  <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                    {isKo ? '일일' : 'Daily'}
                  </span>
                ) : null}
                <span className="shrink-0 text-[10px] text-gray-500">{dateRangeLabel}</span>
                {rows.length > 0 ? (
                  <span className="shrink-0 text-[10px] font-medium text-sky-800">{progressLabel}</span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void reload()}
                className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-sky-800"
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
              {isKo ? '부킹 목록 불러오는 중…' : 'Loading bookings…'}
            </div>
          ) : error ? (
            <p className="rounded-md border border-dashed border-red-200 bg-red-50/60 py-3 text-center text-[11px] text-red-700">
              {isKo ? '부킹 목록을 불러오지 못했습니다.' : 'Failed to load bookings.'}
            </p>
          ) : displayRows.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-3 text-center text-[11px] text-gray-500">
              {isKo
                ? '가격 확인이 필요한 투어 호텔 부킹이 없습니다.'
                : 'No tour hotel bookings need a price check.'}
            </p>
          ) : (
            displayRows.map((row) => {
              const rowStatus = getTodoPanelTourStatus(row.id, tourState)
              const websiteUrl = normalizeTourHotelWebsiteUrl(row.website)
              const tourLabel = row.tour_name || row.reservation_name || '—'
              const rowLabel = formatTourHotelPriceCheckRowLabel(row, isKo)
              const highPrice = isTourHotelPriceCheckHighUnitPrice(
                row.total_price,
                row.unit_price,
                row.rooms
              )
              return (
                <div
                  key={row.id}
                  className={[
                    'rounded-md border p-1.5',
                    tourHotelPriceCheckRowBorderClassName(rowStatus, highPrice),
                    completed ? 'opacity-70' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-1.5">
                    <TodoPanelTourStatusButtons
                      locale={locale}
                      status={rowStatus}
                      onSetStatus={(next) => setTourStatus(row.id, next)}
                    />
                    <p
                      className={`min-w-0 flex-1 truncate text-[11px] font-medium leading-snug ${todoPanelTourTitleClassName(rowStatus)}`}
                      title={rowLabel}
                    >
                      <span className="tabular-nums">{formatShortDate(row.check_in_date)}</span>
                      <span className="text-gray-400"> , </span>
                      <span>{row.hotel}</span>
                      <span className="text-gray-400"> , </span>
                      <span>{tourLabel}</span>
                      <span className="text-gray-400"> , </span>
                      <span
                        className={`inline-flex rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums ${
                          highPrice ? 'bg-red-50 text-red-900' : 'bg-emerald-50 text-emerald-900'
                        }`}
                      >
                        {formatUsd(row.display_price)}
                      </span>
                      {row.rooms > 1 ? (
                        <span className="ml-0.5 text-[10px] text-gray-500">×{row.rooms}</span>
                      ) : null}
                      {row.tour_date ? (
                        <>
                          <span className="text-gray-400"> , </span>
                          <span className="text-gray-600 tabular-nums">
                            {isKo ? '투어' : 'Tour'} {formatShortDate(row.tour_date)}
                          </span>
                        </>
                      ) : null}
                    </p>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {websiteUrl ? (
                        <a
                          href={websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-sky-700 hover:bg-sky-50"
                          title={isKo ? '예약 사이트에서 가격 확인' : 'Check price on booking site'}
                          aria-label={isKo ? '예약 사이트 열기' : 'Open booking site'}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Globe className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setEditBookingId(row.id)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        title={isKo ? '부킹 수정 · 재부킹' : 'Edit / rebook'}
                        aria-label={isKo ? '부킹 수정 · 재부킹' : 'Edit / rebook'}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {row.tour_id && onOpenTourDetail ? (
                        <button
                          type="button"
                          onClick={() => onOpenTourDetail(row.tour_id!)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                          title={isKo ? '투어 상세' : 'Tour detail'}
                          aria-label={isKo ? '투어 상세' : 'Tour detail'}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <TourHotelPriceCheckEditModal
        bookingId={editBookingId}
        locale={locale}
        onClose={() => setEditBookingId(null)}
        onSaved={() => void reload()}
      />
    </>
  )
}
