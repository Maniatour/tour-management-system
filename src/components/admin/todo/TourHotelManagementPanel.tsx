'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { TodoPanelTourStatusButtons } from '@/components/admin/todo/TodoPanelTourStatusButtons'
import {
  countTodoPanelTourProgress,
  getTodoPanelTourStatus,
  todoPanelTourRowClassName,
  todoPanelTourTitleClassName,
} from '@/lib/todoPanelTourCompletion'
import { useTodoPanelTourCompletion } from '@/hooks/useTodoPanelTourCompletion'
import {
  findTourHotelManagementLinkedTodo,
  readTourHotelManagementLocalCompleted,
  tourHotelManagementCompletionDateKey,
  tourHotelManagementPanelTitle,
  writeTourHotelManagementLocalCompleted,
  type TourHotelManagementLinkedTodo,
} from '@/lib/tourHotelManagementTodo'
import { useTourHotelManagementQueue } from '@/hooks/useTourHotelManagementQueue'

type TourHotelManagementPanelProps = {
  locale: string
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<TourHotelManagementLinkedTodo & { title?: string | null }>
  onToggleLinkedTodo?: (todo: TourHotelManagementLinkedTodo, completed: boolean) => Promise<void>
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

const EMPTY_LINKED_TODOS: Array<TourHotelManagementLinkedTodo & { title?: string | null }> = []

function formatShortTourDate(raw: string): string {
  if (!raw) return '—'
  const parts = raw.split('-')
  if (parts.length !== 3) return raw
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!month || !day) return raw
  return `${month}/${day}`
}

export function TourHotelManagementPanel({
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
}: TourHotelManagementPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const completionDateKey = useMemo(() => tourHotelManagementCompletionDateKey(), [])
  const { rows, loading, reload, dateRange } = useTourHotelManagementQueue(queryEnabled)
  const { tourState, setTourStatus } = useTodoPanelTourCompletion(
    'tour-hotel-management',
    completionDateKey
  )
  const linkedTodo = findTourHotelManagementLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    setLocalCompleted(readTourHotelManagementLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted

  const dateRangeLabel = useMemo(() => {
    const fmt = (d: string) => {
      const parts = d.split('-')
      if (parts.length !== 3) return d
      return `${Number(parts[1])}/${Number(parts[2])}`
    }
    return `${fmt(dateRange.start)} – ${fmt(dateRange.end)}`
  }, [dateRange])

  const progress = useMemo(
    () => countTodoPanelTourProgress(rows.map((r) => r.id), tourState),
    [rows, tourState]
  )

  const progressLabel =
    rows.length > 0
      ? progress.onHold > 0
        ? isKo
          ? `미부킹 ${rows.length}건 · 완료 ${progress.done}/${progress.total} · 보류 ${progress.onHold}`
          : `${rows.length} mismatched · done ${progress.done}/${progress.total} · hold ${progress.onHold}`
        : isKo
          ? `미부킹 ${rows.length}건 · 완료 ${progress.done}/${progress.total}`
          : `${rows.length} mismatched · done ${progress.done}/${progress.total}`
      : isKo
        ? '미부킹 0건'
        : '0 mismatched'

  const handleToggleComplete = useCallback(async () => {
    const next = !completed
    setCompleting(true)
    try {
      if (linkedTodo && onToggleLinkedTodo) {
        await onToggleLinkedTodo(linkedTodo, next)
        onCompletedChange?.(next)
      } else {
        writeTourHotelManagementLocalCompleted(next, completionDateKey)
        setLocalCompleted(next)
      }
      onCompletedChange?.(next)
    } finally {
      setCompleting(false)
    }
  }, [completed, linkedTodo, onToggleLinkedTodo, onCompletedChange, completionDateKey])

  return (
    <div
      className={
        isList
          ? className
          : `w-full rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50/80 to-white p-3 shadow-sm ${completed ? 'opacity-80' : ''}`
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
                {tourHotelManagementPanelTitle(locale)}
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
            {isKo ? '멀티데이 투어 호텔 확인 중…' : 'Checking multi-day tour hotels…'}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-3 text-center text-[11px] text-gray-500">
            {isKo
              ? '호텔 부킹이 부족한 멀티데이 투어가 없습니다.'
              : 'No multi-day tours with hotel booking gaps.'}
          </p>
        ) : (
          rows.map((row) => {
            const rowStatus = getTodoPanelTourStatus(row.id, tourState)
            return (
            <div
              key={row.id}
              className={[
                'rounded-md border p-1.5',
                todoPanelTourRowClassName(rowStatus),
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
                  className={`flex min-w-0 flex-1 flex-wrap items-center gap-1 truncate text-[11px] font-medium leading-snug ${todoPanelTourTitleClassName(rowStatus)}`}
                >
                  <span className="tabular-nums">{formatShortTourDate(row.tour_date)}</span>
                  <span>{row.product_name}</span>
                  <span
                    className="inline-flex rounded bg-blue-50 px-1 py-0.5 text-[10px] font-medium tabular-nums text-blue-900"
                    title={isKo ? '투어 총 인원' : 'Total guests'}
                  >
                    {row.assigned_people}
                    {isKo ? '인' : ' pax'}
                  </span>
                  <span
                    className="inline-flex rounded bg-violet-50 px-1 py-0.5 text-[10px] font-medium tabular-nums text-violet-900"
                    title={isKo ? '예약 건수' : 'Reservation count'}
                  >
                    {row.reservation_count}
                    {isKo ? '그룹' : ' grp'}
                  </span>
                  {row.guide_name ? <span className="text-gray-700">{row.guide_name}</span> : null}
                  <span
                    className={[
                      'inline-flex rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums',
                      row.booked_hotel_count < row.required_hotel_count
                        ? 'border border-red-300 bg-red-50 text-red-900'
                        : 'border border-gray-200 bg-gray-50 text-gray-900',
                    ].join(' ')}
                    title={
                      isKo
                        ? `고객 ${row.customer_hotel_count}실 + 가이드 1실`
                        : `${row.customer_hotel_count} customer + 1 guide`
                    }
                  >
                    {row.booked_hotel_count} / {row.required_hotel_count}
                  </span>
                </p>
                {onOpenTourDetail ? (
                  <button
                    type="button"
                    onClick={() => onOpenTourDetail(row.id)}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    title={isKo ? '투어 상세' : 'Tour detail'}
                    aria-label={isKo ? '투어 상세' : 'Tour detail'}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
            )
          })
        )}
      </div>
    </div>
  )
}
