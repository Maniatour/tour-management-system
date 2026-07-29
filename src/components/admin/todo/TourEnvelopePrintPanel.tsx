'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DollarSign, FileText, Loader2, Mail, Printer, RefreshCw, Users } from 'lucide-react'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { TodoPanelTourStatusButtons } from '@/components/admin/todo/TodoPanelTourStatusButtons'
import {
  findTourEnvelopePrintLinkedTodo,
  readTourEnvelopePrintLocalCompleted,
  tourEnvelopePrintPanelTitle,
  tourEnvelopePrintTargetDate,
  writeTourEnvelopePrintLocalCompleted,
  type TourEnvelopePrintLinkedTodo,
} from '@/lib/tourEnvelopePrintTodo'
import {
  countTodoPanelTourProgress,
  getTodoPanelTourStatus,
  todoPanelTourRowClassName,
  todoPanelTourTitleClassName,
} from '@/lib/todoPanelTourCompletion'
import { useTodoPanelTourCompletion } from '@/hooks/useTodoPanelTourCompletion'
import { useToursForEnvelopePrint } from '@/hooks/useToursForEnvelopePrint'
import type { TourQuickPrintKind } from '@/components/admin/todo/TourQuickPrintHost'

type TourEnvelopePrintPanelProps = {
  locale: string
  onQuickPrint: (tourId: string, kind: TourQuickPrintKind) => void
  compact?: boolean
  /** 할 일 목록 카드와 동일한 스타일 (스크롤 영역 안에 배치) */
  variant?: 'panel' | 'list'
  className?: string
  /** DB에 동일 제목 Todo가 있으면 완료 상태를 동기화 */
  linkedTodos?: Array<TourEnvelopePrintLinkedTodo & { title?: string | null }>
  onToggleLinkedTodo?: (todo: TourEnvelopePrintLinkedTodo, completed: boolean) => Promise<void>
  onCompletedChange?: (completed: boolean) => void
  /** 우클릭 시 Todo 수정(또는 생성) 모달 */
  onEditRequest?: () => void
  onHold?: boolean
  holdEnabled?: boolean
  onToggleHold?: () => void
  holdBusy?: boolean
  holdDisabledHint?: string
  /** false면 Supabase 큐 로드를 생략 (뷰포트 밖) */
  queryEnabled?: boolean
}

const EMPTY_LINKED_TODOS: Array<TourEnvelopePrintLinkedTodo & { title?: string | null }> = []

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

export function TourEnvelopePrintPanel({
  locale,
  onQuickPrint,
  compact = false,
  variant = 'panel',
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
}: TourEnvelopePrintPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const targetDate = useMemo(() => tourEnvelopePrintTargetDate(), [])
  const { rows, loading, reload } = useToursForEnvelopePrint(targetDate, queryEnabled)
  const { tourState, setTourStatus } = useTodoPanelTourCompletion('tour-envelope-print', targetDate)
  const linkedTodo = findTourEnvelopePrintLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    setLocalCompleted(readTourEnvelopePrintLocalCompleted(targetDate))
  }, [targetDate])

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
        writeTourEnvelopePrintLocalCompleted(targetDate, next)
        setLocalCompleted(next)
      }
      onCompletedChange?.(next)
    } finally {
      setCompleting(false)
    }
  }, [completed, linkedTodo, onToggleLinkedTodo, onCompletedChange, targetDate])

  const printButtons = (tourId: string) => (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={() => onQuickPrint(tourId, 'tourInfo')}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
        title={isKo ? '투어 정보' : 'Tour info'}
        aria-label={isKo ? '투어 정보' : 'Tour info'}
      >
        <FileText className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onQuickPrint(tourId, 'receipts')}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
        title={isKo ? '영수증' : 'Receipts'}
        aria-label={isKo ? '영수증' : 'Receipts'}
      >
        <Printer className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onQuickPrint(tourId, 'tip')}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
        title={isKo ? '팁 봉투' : 'Tip envelope'}
        aria-label={isKo ? '팁 봉투' : 'Tip envelope'}
      >
        <Mail className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onQuickPrint(tourId, 'balance')}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
        title="Balance"
        aria-label="Balance"
      >
        <DollarSign className="h-3.5 w-3.5" />
      </button>
    </div>
  )

  return (
    <div
      className={
        isList
          ? className
          : `w-full rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white shadow-sm ${
              compact ? 'p-2.5' : 'p-3'
            } ${completed ? 'opacity-80' : ''}`
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
      <div className={`flex items-start gap-2 ${isList ? '' : 'items-center'}`}>
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
                className={`min-w-0 font-semibold ${
                  isList ? 'text-[13px] leading-snug' : 'text-sm'
                } ${completed ? 'text-gray-400 line-through' : onHold ? 'text-amber-900' : 'text-gray-900'}`}
              >
                {tourEnvelopePrintPanelTitle(locale)}
              </p>
              {isList ? (
                <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                  {isKo ? '일일' : 'Daily'}
                </span>
                ) : null}
                {rows.length > 0 ? (
                  <span className="shrink-0 text-[10px] font-medium text-emerald-700">{progressLabel}</span>
                ) : null}
              </div>
            <button
              type="button"
              onClick={() => void reload()}
              className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-emerald-700"
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
            {isKo ? '내일 예정된 투어가 없습니다.' : 'No tours scheduled for tomorrow.'}
          </p>
        ) : (
          rows.map((tour) => {
            const tourStatus = getTodoPanelTourStatus(tour.id, tourState)
            return (
            <div
              key={tour.id}
              className={
                isList
                  ? `rounded-md border p-1.5 ${todoPanelTourRowClassName(tourStatus, 'list')}`
                  : `rounded-lg border bg-white p-2 shadow-sm ${todoPanelTourRowClassName(tourStatus, 'panel')}`
              }
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
                {printButtons(tour.id)}
              </div>
            </div>
            )
          })
        )}
      </div>
    </div>
  )
}
