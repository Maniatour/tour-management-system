'use client'

import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ExpenseStatementReconIcon } from '@/components/reconciliation/ExpenseStatementReconIcon'
import type { TicketBookingStatementReconDisplay } from '@/lib/ticket-booking-statement-recon'

export function TicketBookingStatementReconCell({
  matched,
  disabled,
  lines,
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

  return (
    <div className={`flex min-w-0 gap-2 ${compact ? 'flex-col items-center' : 'flex-row items-start'}`}>
      <ExpenseStatementReconIcon
        matched={matched}
        disabled={disabled}
        titleMatched={titleMatched}
        titleUnmatched={titleUnmatched}
        titleDisabled={titleDisabled}
        onClick={onOpenPicker}
      />
      <div className={`min-w-0 flex-1 space-y-1 ${compact ? 'w-full text-center' : 'text-left'}`}>
        {lines.length > 0 ? (
          lines.map((line, i) => (
            <div
              key={line.match_id || `${line.statement_line_id}-${i}`}
              className={`relative rounded border border-emerald-100 bg-emerald-50/60 ${compact ? '' : 'pr-7'}`}
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
                className={`block w-full rounded px-1.5 py-1 text-left hover:bg-emerald-50 disabled:opacity-50 ${textCls}`}
              >
                <div className="font-medium text-gray-800 truncate" title={line.financial_account_name}>
                  {line.financial_account_name}
                </div>
                <div className="flex flex-wrap items-baseline gap-x-1.5 tabular-nums text-gray-600">
                  <span>{line.posted_date}</span>
                  <span className="font-semibold text-gray-800">
                    ${line.amount.toFixed(2)}
                  </span>
                  {line.matched_amount != null &&
                  Math.abs(line.matched_amount - line.amount) > 0.009 ? (
                    <span
                      className="text-[10px] text-emerald-800"
                      title={t('statementLineAllocatedAmount')}
                    >
                      (${line.matched_amount.toFixed(2)})
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
