'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ExpenseStatementReconIcon } from '@/components/reconciliation/ExpenseStatementReconIcon'
import {
  BOOKING_STATEMENT_AMOUNT_EPS,
  bookingStatementMatchesExpense,
  computeBookingStatementView,
  isStatementLineInflow,
} from '@/lib/ticket-booking-statement-totals'
import type { TicketBookingStatementReconDisplay } from '@/lib/ticket-booking-statement-recon'

export function TicketBookingStatementReconCell({
  matched,
  disabled,
  lines,
  bookingExpense,
  titleMatched,
  titleUnmatched,
  titleDisabled,
  onOpenPicker,
  onUnlink,
  unlinking = false,
  unlinkTitle,
  unlinkAriaLabel,
  compact = false,
}: {
  matched: boolean
  disabled?: boolean
  lines: TicketBookingStatementReconDisplay[]
  /** 부킹 행 비용(테이블 표시와 동일·변경 대기 반영 권장) */
  bookingExpense?: number | null
  titleMatched: string
  titleUnmatched: string
  titleDisabled?: string
  onOpenPicker: () => void
  onUnlink?: (line: TicketBookingStatementReconDisplay) => void
  unlinking?: boolean
  unlinkTitle?: string
  unlinkAriaLabel?: string
  compact?: boolean
}) {
  const t = useTranslations('expenses.statementRecon')
  const textCls = compact ? 'text-[10px] leading-snug' : 'text-xs leading-snug'

  const expenseUsd = Math.abs(Number(bookingExpense ?? 0))
  const view = lines.length > 0 ? computeBookingStatementView(lines, expenseUsd) : null
  const totals = view
  const amountMismatch =
    totals != null && !bookingStatementMatchesExpense(totals, expenseUsd, BOOKING_STATEMENT_AMOUNT_EPS)

  const lineCardClass = (line: TicketBookingStatementReconDisplay) => {
    if (isStatementLineInflow(line)) {
      return 'relative rounded border border-sky-200 bg-sky-50'
    }
    return 'relative rounded border border-emerald-100 bg-emerald-50/60'
  }

  const lineHoverClass = (line: TicketBookingStatementReconDisplay) =>
    isStatementLineInflow(line) ? 'hover:bg-sky-100/80' : 'hover:bg-emerald-50'

  const fmt = (n: number) => n.toFixed(2)

  return (
    <div className={`flex min-w-0 gap-2 ${compact ? 'flex-col items-center' : 'flex-row items-start'}`}>
      <ExpenseStatementReconIcon
        matched={matched}
        {...(disabled !== undefined ? { disabled } : {})}
        titleMatched={titleMatched}
        titleUnmatched={titleUnmatched}
        {...(titleDisabled !== undefined ? { titleDisabled } : {})}
        onClick={onOpenPicker}
      />
      <div
        className={`min-w-0 flex-1 space-y-1 ${compact ? 'w-full text-center' : 'text-left'} ${
          amountMismatch ? 'rounded-md ring-2 ring-amber-400 ring-offset-1' : ''
        }`}
      >
        {totals ? (
          <div
            className={`tabular-nums ${textCls} ${
              amountMismatch
                ? 'rounded-md border border-amber-300 bg-amber-50 px-1.5 py-1 font-semibold text-amber-950'
                : 'px-0.5 font-medium text-gray-700'
            }`}
            title={t('bookingStatementSumFormula', {
              outflow: fmt(totals.outflowSum),
              inflow: fmt(totals.inflowSum),
              net: fmt(totals.netSum),
              expense: fmt(expenseUsd),
            })}
          >
            {amountMismatch ? (
              <AlertTriangle
                className={`mr-0.5 inline shrink-0 text-amber-600 ${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`}
                aria-hidden
              />
            ) : null}
            <span>
              {t('bookingStatementSumBreakdown', {
                outflow: fmt(totals.outflowSum),
                inflow: fmt(totals.inflowSum),
                net: fmt(totals.netSum),
              })}
            </span>
            {amountMismatch ? (
              <span className="block text-amber-900">
                {t('bookingStatementSumMismatch', {
                  net: fmt(totals.netSum),
                  expense: fmt(expenseUsd),
                })}
              </span>
            ) : null}
          </div>
        ) : null}
        {lines.length > 0 ? (
          lines.map((line, i) => (
            <div
              key={line.match_id || `${line.statement_line_id}-${i}`}
              className={`${lineCardClass(line)} ${compact ? '' : 'pr-7'}`}
            >
              {onUnlink && !disabled ? (
                <button
                  type="button"
                  disabled={unlinking}
                  title={unlinkTitle}
                  aria-label={unlinkAriaLabel}
                  onClick={(e) => {
                    e.stopPropagation()
                    onUnlink(line)
                  }}
                  className={`absolute z-[1] rounded p-0.5 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 ${
                    compact ? 'top-0.5 right-0.5' : 'top-1 right-1'
                  }`}
                >
                  <X className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!disabled) onOpenPicker()
                }}
                className={`block w-full rounded px-1.5 py-1 text-left disabled:opacity-50 ${lineHoverClass(line)} ${textCls}`}
              >
                <div className="font-medium text-gray-800 truncate" title={line.financial_account_name}>
                  {line.financial_account_name}
                  {isStatementLineInflow(line) ? (
                    <span className="ml-1 font-normal text-sky-700">({t('statementInflowBadge')})</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-baseline gap-x-1.5 tabular-nums text-gray-600">
                  <span>{line.posted_date}</span>
                  <span
                    className={`font-semibold ${isStatementLineInflow(line) ? 'text-sky-800' : 'text-gray-800'}`}
                  >
                    {isStatementLineInflow(line) ? '−' : ''}$
                    {(view?.perLineUsd[i] ?? 0).toFixed(2)}
                  </span>
                  {view != null &&
                  Math.abs((view.perLineUsd[i] ?? 0) - Math.abs(line.amount)) >
                    BOOKING_STATEMENT_AMOUNT_EPS ? (
                    <span
                      className={`text-[10px] ${isStatementLineInflow(line) ? 'text-sky-800' : 'text-emerald-800'}`}
                      title={t('statementLineAllocatedAmount')}
                    >
                      ({isStatementLineInflow(line) ? '−' : ''}$
                      {(view.perLineUsd[i] ?? 0).toFixed(2)} / ${Math.abs(line.amount).toFixed(2)})
                    </span>
                  ) : null}
                </div>
                <div className="text-gray-700 line-clamp-2 break-words" title={line.description}>
                  {line.description}
                </div>
              </button>
            </div>
          ))
        ) : matched ? (
          <span className={`${textCls} text-emerald-700`}>{titleMatched}</span>
        ) : !disabled ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenPicker()
            }}
            className={`${textCls} text-gray-500 underline decoration-gray-300 hover:text-gray-800`}
          >
            {titleUnmatched}
          </button>
        ) : null}
      </div>
    </div>
  )
}
