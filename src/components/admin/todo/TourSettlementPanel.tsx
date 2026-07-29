'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
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
  findTourSettlementLinkedTodo,
  readTourSettlementLocalCompleted,
  tourSettlementCompletionDateKey,
  tourSettlementIssueBadgeClass,
  tourSettlementIssueLabel,
  tourSettlementPanelTitle,
  writeTourSettlementLocalCompleted,
  type TourSettlementLinkedTodo,
} from '@/lib/tourSettlementTodo'
import { TOUR_EXPENSE_RECEIPT_PENDING_PAID_FOR } from '@/lib/tourExpenseConstants'
import { useTourSettlementQueue } from '@/hooks/useTourSettlementQueue'
import { TourSettlementExpenseModal } from '@/components/admin/todo/TourSettlementExpenseModal'

type TourSettlementPanelProps = {
  locale: string
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<TourSettlementLinkedTodo & { title?: string | null }>
  onToggleLinkedTodo?: (todo: TourSettlementLinkedTodo, completed: boolean) => Promise<void>
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

const EMPTY_LINKED_TODOS: Array<TourSettlementLinkedTodo & { title?: string | null }> = []

function formatShortTourDate(raw: string): string {
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
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function expensePaidForLabel(paidFor: string, isKo: boolean): string {
  if (paidFor === TOUR_EXPENSE_RECEIPT_PENDING_PAID_FOR) {
    return isKo ? '영수증 정리 대기' : 'Receipt pending'
  }
  return paidFor || (isKo ? '항목 없음' : 'No category')
}

export function TourSettlementPanel({
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
}: TourSettlementPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const completionDateKey = useMemo(() => tourSettlementCompletionDateKey(), [])
  const { rows, loading, reload, dateRange } = useTourSettlementQueue(queryEnabled)
  const { tourState, setTourStatus } = useTodoPanelTourCompletion('tour-settlement', completionDateKey)
  const linkedTodo = findTourSettlementLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [expandedTourIds, setExpandedTourIds] = useState<Set<string>>(() => new Set())
  const [activeExpenseId, setActiveExpenseId] = useState<string | null>(null)

  useEffect(() => {
    setLocalCompleted(readTourSettlementLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted

  const dateRangeLabel = useMemo(() => {
    const fmt = (d: string) => {
      const parts = d.split('-')
      if (parts.length !== 3) return d
      return `${Number(parts[1])}/${Number(parts[2])}`
    }
    return isKo ? `어제·오늘 종료 (${fmt(dateRange.start)}–${fmt(dateRange.end)})` : `Ends yesterday–today (${fmt(dateRange.start)}–${fmt(dateRange.end)})`
  }, [dateRange, isKo])

  const totalExpenseCount = useMemo(
    () => rows.reduce((sum, row) => sum + row.expense_count, 0),
    [rows]
  )

  const missingReceiptCount = useMemo(
    () => rows.filter((row) => row.missing_receipt).length,
    [rows]
  )

  const progress = useMemo(
    () => countTodoPanelTourProgress(rows.map((r) => r.id), tourState),
    [rows, tourState]
  )

  const progressLabel =
    rows.length > 0
      ? progress.onHold > 0
        ? isKo
          ? `영수증 ${totalExpenseCount}건 · 영수증 없음 ${missingReceiptCount} · 투어 ${progress.done}/${progress.total} · 보류 ${progress.onHold}`
          : `${totalExpenseCount} receipts · ${missingReceiptCount} no receipt · tours ${progress.done}/${progress.total} · hold ${progress.onHold}`
        : isKo
          ? `영수증 ${totalExpenseCount}건 · 영수증 없음 ${missingReceiptCount} · 투어 ${progress.done}/${progress.total}`
          : `${totalExpenseCount} receipts · ${missingReceiptCount} no receipt · tours ${progress.done}/${progress.total}`
      : isKo
        ? '확인 필요 0건'
        : '0 to review'

  const toggleExpanded = useCallback((tourId: string) => {
    setExpandedTourIds((prev) => {
      const next = new Set(prev)
      if (next.has(tourId)) next.delete(tourId)
      else next.add(tourId)
      return next
    })
  }, [])

  const handleToggleComplete = useCallback(async () => {
    const next = !completed
    setCompleting(true)
    try {
      if (linkedTodo && onToggleLinkedTodo) {
        await onToggleLinkedTodo(linkedTodo, next)
        onCompletedChange?.(next)
      } else {
        writeTourSettlementLocalCompleted(next, completionDateKey)
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
          : `w-full rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/70 to-white p-3 shadow-sm ${completed ? 'opacity-80' : ''}`
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
                {tourSettlementPanelTitle(locale)}
              </p>
              {isList ? (
                <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">
                  {isKo ? '일일' : 'Daily'}
                </span>
              ) : null}
              <span className="shrink-0 text-[10px] text-gray-500">{dateRangeLabel}</span>
              {rows.length > 0 ? (
                <span className="shrink-0 text-[10px] font-medium text-violet-800">{progressLabel}</span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void reload()}
              className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-violet-800"
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
            {isKo ? '투어 영수증 확인 중…' : 'Checking tour receipts…'}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-3 text-center text-[11px] text-gray-500">
            {isKo
              ? '어제·오늘(종료일 기준) 투어 중 확인이 필요한 영수증이 없습니다.'
              : 'No receipts need review for yesterday or today tours (by end date).'}
          </p>
        ) : (
          rows.map((row) => {
            const rowStatus = getTodoPanelTourStatus(row.id, tourState)
            const expanded = expandedTourIds.has(row.id)
            const displayDate =
              row.settlement_end_date && row.settlement_end_date !== row.tour_date
                ? row.settlement_end_date
                : row.tour_date
            const dateLabel =
              row.settlement_end_date && row.settlement_end_date !== row.tour_date
                ? isKo
                  ? `${formatShortTourDate(row.tour_date)}–${formatShortTourDate(row.settlement_end_date)}`
                  : `${formatShortTourDate(row.tour_date)}–${formatShortTourDate(row.settlement_end_date)}`
                : formatShortTourDate(displayDate)
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
                  <button
                    type="button"
                    onClick={() => toggleExpanded(row.id)}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    title={isKo ? '영수증 목록' : 'Receipt list'}
                    aria-expanded={expanded}
                  >
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  <p
                    className={`flex min-w-0 flex-1 flex-wrap items-center gap-1 truncate text-[11px] font-medium leading-snug ${todoPanelTourTitleClassName(rowStatus)}`}
                  >
                    <span className="tabular-nums">{dateLabel}</span>
                    <span>{row.product_name}</span>
                    {row.guide_name ? <span className="text-gray-700">{row.guide_name}</span> : null}
                    {row.missing_receipt ? (
                      <span className="inline-flex rounded border border-rose-200 bg-rose-50 px-1 py-0.5 text-[10px] font-semibold text-rose-900">
                        {isKo ? '영수증 없음' : 'No receipt'}
                      </span>
                    ) : (
                      <span className="inline-flex rounded border border-violet-200 bg-violet-50 px-1 py-0.5 text-[10px] font-semibold tabular-nums text-violet-900">
                        {row.expense_count}
                        {isKo ? '건' : ''}
                      </span>
                    )}
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

                {expanded ? (
                  <div className="mt-1.5 space-y-1 border-t border-gray-100 pt-1.5">
                    {row.missing_receipt ? (
                      <div className="rounded border border-rose-100 bg-rose-50/60 px-1.5 py-1.5 text-[10px] leading-snug text-rose-900">
                        {isKo
                          ? '등록된 투어 지출·영수증이 없습니다. 투어 상세에서 지출을 등록해 주세요.'
                          : 'No tour expenses or receipts yet. Add expenses from the tour detail page.'}
                      </div>
                    ) : null}
                    {row.expenses.map((expense) => (
                      <button
                        key={expense.id}
                        type="button"
                        onClick={() => setActiveExpenseId(expense.id)}
                        className="w-full rounded border border-gray-100 bg-white/80 px-1.5 py-1 text-left transition hover:border-violet-200 hover:bg-violet-50/40"
                      >
                        <div className="flex flex-wrap items-center gap-1 text-[10px] leading-snug text-gray-800">
                          <span className="font-medium">{expensePaidForLabel(expense.paid_for, isKo)}</span>
                          <span className="tabular-nums text-gray-600">{formatUsd(expense.amount)}</span>
                          {expense.paid_to ? (
                            <span className="text-gray-600">{expense.paid_to}</span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-0.5">
                          {expense.issues.map((issue) => (
                            <span
                              key={`${expense.id}-${issue}`}
                              className={`inline-flex rounded border px-1 py-0.5 text-[9px] font-medium ${tourSettlementIssueBadgeClass(issue)}`}
                            >
                              {tourSettlementIssueLabel(issue, locale)}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>

      <TourSettlementExpenseModal
        expenseId={activeExpenseId}
        locale={locale}
        onClose={() => setActiveExpenseId(null)}
        onUpdated={() => void reload()}
      />
    </div>
  )
}
