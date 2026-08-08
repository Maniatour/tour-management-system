'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, ShoppingBag, UtensilsCrossed } from 'lucide-react'
import { BentoCheckOrderModal } from '@/components/admin/todo/BentoCheckOrderModal'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { TodoPanelTourStatusButtons } from '@/components/admin/todo/TodoPanelTourStatusButtons'
import {
  findBentoCheckLinkedTodo,
  bentoCheckCompletionDateKey,
  bentoCheckPanelTitle,
  readBentoCheckLocalCompleted,
  writeBentoCheckLocalCompleted,
  type BentoCheckLinkedTodo,
} from '@/lib/bentoCheckTodo'
import {
  countTodoPanelTourProgress,
  getTodoPanelTourStatus,
  todoPanelTourRowClassName,
  todoPanelTourTitleClassName,
  type TodoPanelTourItemState,
} from '@/lib/todoPanelTourCompletion'
import { useTodoPanelTourCompletion } from '@/hooks/useTodoPanelTourCompletion'
import { useBentoCheckQueue } from '@/hooks/useBentoCheckQueue'
import { useTodoPanelAutoComplete } from '@/hooks/useTodoPanelAutoComplete'
import {
  getTodoPanelAutoCompleteMode,
  todoPanelPendingTourCount,
} from '@/lib/todoPanelAutoComplete'
import type { BentoCheckTourRow } from '@/lib/bentoCheckQueue'

type BentoCheckPanelProps = {
  locale: string
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<BentoCheckLinkedTodo & { title?: string | null }>
  onToggleLinkedTodo?: (todo: BentoCheckLinkedTodo, completed: boolean) => Promise<void>
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

const EMPTY_LINKED_TODOS: Array<BentoCheckLinkedTodo & { title?: string | null }> = []

function formatShortDate(raw: string): string {
  if (!raw) return '—'
  const parts = raw.split('-')
  if (parts.length !== 3) return raw
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!month || !day) return raw
  return `${month}/${day}`
}

function tourSummaryText(tour: BentoCheckTourRow): string {
  const segments = [
    `${formatShortDate(tour.tour_date)} ${tour.product_internal_name}`,
    tour.guide_name,
    tour.assistant_name,
    tour.vehicle_number,
    `${tour.total_bento_quantity}ea`,
  ].filter((s): s is string => Boolean(s && String(s).trim()))
  return segments.join(' , ')
}

export function BentoCheckPanel({
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
}: BentoCheckPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const completionDateKey = useMemo(() => bentoCheckCompletionDateKey(), [])
  const { rows, loading, error, reload, targetDate } = useBentoCheckQueue(queryEnabled)
  const { tourState, setTourStatus } = useTodoPanelTourCompletion('bento-check', completionDateKey)
  const linkedTodo = findBentoCheckLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [orderRow, setOrderRow] = useState<BentoCheckTourRow | null>(null)

  useEffect(() => {
    setLocalCompleted(readBentoCheckLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted

  const progress = useMemo(
    () => countTodoPanelTourProgress(rows.map((r) => r.id), tourState),
    [rows, tourState]
  )

  const setPanelCompleted = useCallback(
    async (next: boolean) => {
      if (next === completed) return
      setCompleting(true)
      try {
        if (linkedTodo && onToggleLinkedTodo) {
          await onToggleLinkedTodo(linkedTodo, next)
        } else {
          writeBentoCheckLocalCompleted(next, completionDateKey)
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
    mode: getTodoPanelAutoCompleteMode('bento-check'),
    applyCompleted: setPanelCompleted,
  })

  const progressLabel =
    progress.onHold > 0
      ? isKo
        ? `투어 ${progress.done}/${progress.total} · 보류 ${progress.onHold}`
        : `Tours ${progress.done}/${progress.total} · hold ${progress.onHold}`
      : isKo
        ? `투어 ${progress.done}/${progress.total}`
        : `Tours ${progress.done}/${progress.total}`

  const dateLabel = formatShortDate(targetDate)

  return (
    <>
      <div
        className={
          isList
            ? className
            : `w-full rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50/80 to-white p-3 shadow-sm ${completed ? 'opacity-80' : ''}`
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
                <UtensilsCrossed className="h-3.5 w-3.5 shrink-0 text-orange-600" aria-hidden />
                <p
                  className={`min-w-0 text-[13px] font-semibold leading-snug ${
                    completed ? 'text-gray-400 line-through' : onHold ? 'text-amber-900' : 'text-gray-900'
                  }`}
                >
                  {bentoCheckPanelTitle(locale)}
                </p>
                {isList ? (
                  <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-800">
                    {isKo ? '일일' : 'Daily'}
                  </span>
                ) : null}
                <span className="shrink-0 text-[10px] text-gray-500">
                  {isKo ? `D+2 ${dateLabel}` : `D+2 ${dateLabel}`}
                </span>
                {rows.length > 0 ? (
                  <span className="shrink-0 text-[10px] font-medium text-orange-700">{progressLabel}</span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void reload()}
                className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-orange-700"
                title={isKo ? '새로고침' : 'Refresh'}
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
              {isKo ? '불러오는 중…' : 'Loading…'}
            </div>
          ) : error ? (
            <p className="py-2 text-center text-[11px] text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-3 text-center text-[11px] text-gray-500">
              {isKo
                ? `${dateLabel} 투어 중 도시락 옵션이 있는 예약이 없습니다.`
                : `No bento options on tours for ${dateLabel}.`}
            </p>
          ) : (
            rows.map((row) => {
              const tourStatus = getTodoPanelTourStatus(row.id, tourState)
              const ordered = Boolean(row.order_id)
              return (
                <div
                  key={row.id}
                  className={`rounded-md border p-1.5 ${todoPanelTourRowClassName(tourStatus)} ${ordered && tourStatus === 'pending' ? 'border-orange-200 bg-orange-50/40' : ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    <TodoPanelTourStatusButtons
                      locale={locale}
                      status={tourStatus}
                      onSetStatus={(next: TodoPanelTourItemState) => setTourStatus(row.id, next)}
                    />
                    <button
                      type="button"
                      onClick={() => onOpenTourDetail?.(row.id)}
                      className={`min-w-0 flex-1 truncate text-left text-[11px] font-medium ${todoPanelTourTitleClassName(tourStatus)} ${onOpenTourDetail ? 'hover:underline' : ''}`}
                      title={tourSummaryText(row)}
                    >
                      {tourSummaryText(row)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderRow(row)}
                      className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-[10px] font-medium ${
                        ordered
                          ? 'border border-orange-300 bg-orange-100 text-orange-900 hover:bg-orange-200'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                    >
                      <ShoppingBag className="h-3 w-3" />
                      {ordered ? (isKo ? '주문됨' : 'Ordered') : isKo ? '주문' : 'Order'}
                    </button>
                  </div>
                  {row.bento_lines.length > 0 ? (
                    <p className="mt-1 truncate pl-7 text-[10px] text-muted-foreground">
                      {row.bento_lines.map((l) => `${l.option_name}×${l.quantity}`).join(' · ')}
                    </p>
                  ) : null}
                  {ordered && row.ordered_at ? (
                    <p className="mt-0.5 pl-7 text-[10px] text-orange-700/80">
                      {new Date(row.ordered_at).toLocaleString(isKo ? 'ko-KR' : 'en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </div>

      {orderRow ? (
        <BentoCheckOrderModal
          row={orderRow}
          locale={locale}
          onClose={() => setOrderRow(null)}
          onOrdered={() => void reload()}
        />
      ) : null}
    </>
  )
}
