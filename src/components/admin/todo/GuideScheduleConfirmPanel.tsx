'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, Loader2, RefreshCw, Users } from 'lucide-react'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { TodoPanelTourStatusButtons } from '@/components/admin/todo/TodoPanelTourStatusButtons'
import {
  findGuideScheduleConfirmLinkedTodo,
  guideScheduleConfirmCompletionDateKey,
  guideScheduleConfirmPanelTitle,
  readGuideScheduleConfirmLocalCompleted,
  writeGuideScheduleConfirmLocalCompleted,
} from '@/lib/guideScheduleConfirmTodo'
import {
  countTodoPanelTourProgress,
  getTodoPanelTourStatus,
  todoPanelTourRowClassName,
  todoPanelTourTitleClassName,
} from '@/lib/todoPanelTourCompletion'
import { useTodoPanelTourCompletion } from '@/hooks/useTodoPanelTourCompletion'
import { useToursForGuideScheduleConfirm } from '@/hooks/useToursForGuideScheduleConfirm'
import { GuideScheduleConfirmPreviewModal } from '@/components/admin/todo/GuideScheduleConfirmPreviewModal'

type GuideScheduleConfirmPanelProps = {
  locale: string
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<{ title?: string | null; id: string; completed: boolean }>
  onToggleLinkedTodo?: (todo: { id: string; completed: boolean }, completed: boolean) => Promise<void>
  onCompletedChange?: (completed: boolean) => void
  onEditRequest?: () => void
  onHold?: boolean
  holdEnabled?: boolean
  onToggleHold?: (() => void) | undefined
  holdBusy?: boolean
  holdDisabledHint?: string
  queryEnabled?: boolean
}

const EMPTY_LINKED_TODOS: Array<{ title?: string | null; id: string; completed: boolean }> = []

function formatShortTourDate(raw: string): string {
  if (!raw) return '—'
  const parts = raw.split('-')
  if (parts.length !== 3) return raw
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!month || !day) return raw
  return `${month}/${day}`
}

function tourSummaryText(tour: {
  tour_date: string
  product_internal_name: string
  guide_name: string | null
  assistant_name: string | null
  vehicle_number: string | null
}): string {
  const segments = [
    `${formatShortTourDate(tour.tour_date)} ${tour.product_internal_name}`,
    tour.guide_name,
    tour.assistant_name,
    tour.vehicle_number,
  ].filter((s): s is string => Boolean(s && String(s).trim()))
  return segments.join(' , ')
}

export function GuideScheduleConfirmPanel({
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
}: GuideScheduleConfirmPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const completionDateKey = useMemo(() => guideScheduleConfirmCompletionDateKey(), [])
  const { rows, loading, reload, targetDates, previewByTourId } = useToursForGuideScheduleConfirm(
    queryEnabled,
    locale
  )
  const { tourState, setTourStatus } = useTodoPanelTourCompletion('guide-schedule-confirm', completionDateKey)
  const linkedTodo = findGuideScheduleConfirmLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [previewTourId, setPreviewTourId] = useState<string | null>(null)

  useEffect(() => {
    setLocalCompleted(readGuideScheduleConfirmLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted
  const progress = useMemo(
    () => countTodoPanelTourProgress(rows.map((r) => r.id), tourState),
    [rows, tourState]
  )

  const handleToggleComplete = useCallback(async () => {
    const next = !completed
    setCompleting(true)
    try {
      if (linkedTodo && onToggleLinkedTodo) {
        await onToggleLinkedTodo(linkedTodo, next)
        onCompletedChange?.(next)
      } else {
        writeGuideScheduleConfirmLocalCompleted(next, completionDateKey)
        setLocalCompleted(next)
      }
      onCompletedChange?.(next)
    } finally {
      setCompleting(false)
    }
  }, [completed, linkedTodo, onToggleLinkedTodo, onCompletedChange, completionDateKey])

  const dateRangeLabel = useMemo(() => {
    const [d1, d2] = targetDates
    const fmt = (d: string) => {
      const parts = d.split('-')
      if (parts.length !== 3) return d
      return `${Number(parts[1])}/${Number(parts[2])}`
    }
    return `${fmt(d1)} – ${fmt(d2)}`
  }, [targetDates])

  const progressLabel =
    progress.onHold > 0
      ? isKo
        ? `투어 ${progress.done}/${progress.total} · 보류 ${progress.onHold}`
        : `Tours ${progress.done}/${progress.total} · hold ${progress.onHold}`
      : isKo
        ? `투어 ${progress.done}/${progress.total}`
        : `Tours ${progress.done}/${progress.total}`

  return (
    <>
      <div
        className={
          isList
            ? className
            : `w-full rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-3 shadow-sm ${completed ? 'opacity-80' : ''}`
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
                  {guideScheduleConfirmPanelTitle(locale)}
                </p>
                {isList ? (
                  <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                    {isKo ? '일일' : 'Daily'}
                  </span>
                ) : null}
                <span className="shrink-0 text-[10px] text-gray-500">{dateRangeLabel}</span>
                {rows.length > 0 ? (
                  <span className="shrink-0 text-[10px] font-medium text-violet-700">{progressLabel}</span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void reload()}
                className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-violet-700"
                title={isKo ? '투어 목록 새로고침' : 'Refresh tours'}
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
              {isKo ? '투어 목록 불러오는 중…' : 'Loading tours…'}
            </div>
          ) : rows.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-3 text-center text-[11px] text-gray-500">
              {isKo ? '내일·모레 예정된 투어가 없습니다.' : 'No tours for tomorrow or the day after.'}
            </p>
          ) : (
            rows.map((tour) => {
              const tourStatus = getTodoPanelTourStatus(tour.id, tourState)
              return (
                <div
                  key={tour.id}
                  className={`rounded-md border p-1.5 ${todoPanelTourRowClassName(tourStatus)}`}
                >
                  <div className="flex items-center gap-1.5">
                    <TodoPanelTourStatusButtons
                      locale={locale}
                      status={tourStatus}
                      onSetStatus={(next) => setTourStatus(tour.id, next)}
                    />
                    <p
                      className={`min-w-0 flex-1 truncate text-[11px] font-medium ${todoPanelTourTitleClassName(tourStatus)}`}
                      title={`${tourSummaryText(tour)} · ${tour.assigned_people}`}
                    >
                      <span>{tourSummaryText(tour)}</span>
                      <span className="text-gray-400"> , </span>
                      <span className="inline-flex items-center gap-0.5 align-middle text-gray-700">
                        <Users className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="tabular-nums">{tour.assigned_people}</span>
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setPreviewTourId(tour.id)}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      title={isKo ? '메시지 미리보기·발송' : 'Preview & send message'}
                      aria-label={isKo ? '메시지 미리보기·발송' : 'Preview & send message'}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <GuideScheduleConfirmPreviewModal
        isOpen={Boolean(previewTourId)}
        tourId={previewTourId}
        locale={locale}
        cachedPreview={previewTourId ? previewByTourId.get(previewTourId) ?? null : null}
        onClose={() => setPreviewTourId(null)}
      />
    </>
  )
}
