'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Mail, RefreshCw, Users, Wand2 } from 'lucide-react'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { useTranslations } from 'next-intl'
import { TodoPanelTourStatusButtons } from '@/components/admin/todo/TodoPanelTourStatusButtons'
import {
  findPickupNotificationLinkedTodo,
  pickupNotificationCompletionDateKey,
  pickupNotificationPanelTitle,
  readPickupNotificationLocalCompleted,
  writePickupNotificationLocalCompleted,
  type PickupNotificationLinkedTodo,
} from '@/lib/pickupNotificationTodo'
import {
  countTodoPanelTourProgress,
  getTodoPanelTourStatus,
  todoPanelTourRowClassName,
  todoPanelTourTitleClassName,
} from '@/lib/todoPanelTourCompletion'
import { useTodoPanelTourCompletion } from '@/hooks/useTodoPanelTourCompletion'
import { useToursForPickupNotification } from '@/hooks/useToursForPickupNotification'
import type { TourPickupNotificationKind } from '@/components/admin/todo/TourPickupNotificationHost'

type PickupNotificationPanelProps = {
  locale: string
  onPickupAction: (tourId: string, kind: TourPickupNotificationKind) => void
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<PickupNotificationLinkedTodo & { title?: string | null }>
  onToggleLinkedTodo?: (todo: PickupNotificationLinkedTodo, completed: boolean) => Promise<void>
  onCompletedChange?: (completed: boolean) => void
  onEditRequest?: () => void
  onHold?: boolean
  holdEnabled?: boolean
  onToggleHold?: () => void
  holdBusy?: boolean
  holdDisabledHint?: string
  queryEnabled?: boolean
}

const EMPTY_LINKED_TODOS: Array<PickupNotificationLinkedTodo & { title?: string | null }> = []

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

export function PickupNotificationPanel({
  locale,
  onPickupAction,
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
}: PickupNotificationPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const tPickup = useTranslations('tours.pickupSchedule')
  const completionDateKey = useMemo(() => pickupNotificationCompletionDateKey(), [])
  const { rows, loading, reload } = useToursForPickupNotification(queryEnabled)
  const { tourState, setTourStatus } = useTodoPanelTourCompletion(
    'pickup-notification',
    completionDateKey
  )
  const linkedTodo = findPickupNotificationLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    setLocalCompleted(readPickupNotificationLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted
  const progress = useMemo(
    () => countTodoPanelTourProgress(rows.map((r) => r.id), tourState),
    [rows, tourState]
  )
  const progressLabel =
    progress.onHold > 0
      ? isKo
        ? `투어 ${progress.done}/${progress.total} · 보류 ${progress.onHold}`
        : `Tours ${progress.done}/${progress.total} · hold ${progress.onHold}`
      : isKo
        ? `투어 ${progress.done}/${progress.total}`
        : `Tours ${progress.done}/${progress.total}`

  const handleToggleComplete = useCallback(async () => {
    const next = !completed
    setCompleting(true)
    try {
      if (linkedTodo && onToggleLinkedTodo) {
        await onToggleLinkedTodo(linkedTodo, next)
        onCompletedChange?.(next)
      } else {
        writePickupNotificationLocalCompleted(next, completionDateKey)
        setLocalCompleted(next)
      }
      onCompletedChange?.(next)
    } finally {
      setCompleting(false)
    }
  }, [completed, linkedTodo, onToggleLinkedTodo, onCompletedChange, completionDateKey])

  const autoGenerateLabel = tPickup('autoGenerate')
  const emailLabel = tPickup('email')

  const actionButtons = (tourId: string) => (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={() => onPickupAction(tourId, 'autoGenerate')}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
        title={autoGenerateLabel}
        aria-label={autoGenerateLabel}
      >
        <Wand2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onPickupAction(tourId, 'email')}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-green-200 bg-green-50 text-green-800 hover:bg-green-100"
        title={emailLabel}
        aria-label={emailLabel}
      >
        <Mail className="h-3.5 w-3.5" />
      </button>
    </div>
  )

  return (
    <div
      className={isList ? className : `w-full rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50/80 to-white p-3 shadow-sm ${completed ? 'opacity-80' : ''}`}
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
                {pickupNotificationPanelTitle(locale)}
              </p>
              {isList ? (
                <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                  {isKo ? '일일' : 'Daily'}
                </span>
                ) : null}
                {rows.length > 0 ? (
                  <span className="shrink-0 text-[10px] font-medium text-sky-700">{progressLabel}</span>
                ) : null}
              </div>
            <button
              type="button"
              onClick={() => void reload()}
              className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-sky-700"
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
            {isKo ? '48시간 이내 출발 예정 투어가 없습니다.' : 'No tours departing within 48 hours.'}
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
                {actionButtons(tour.id)}
              </div>
            </div>
            )
          })
        )}
      </div>
    </div>
  )
}
