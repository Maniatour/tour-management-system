'use client'

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
  compact = false,
}: {
  matched: boolean
  disabled?: boolean
  lines: TicketBookingStatementReconDisplay[]
  titleMatched: string
  titleUnmatched: string
  titleDisabled?: string
  onOpenPicker: () => void
  compact?: boolean
}) {
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
            <button
              key={`${line.posted_date}-${line.description}-${i}`}
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation()
                if (!disabled) onOpenPicker()
              }}
              className={`block w-full rounded border border-emerald-100 bg-emerald-50/60 px-1.5 py-1 text-left hover:bg-emerald-50 disabled:opacity-50 ${textCls}`}
            >
              <div className="font-medium text-gray-800 truncate" title={line.financial_account_name}>
                {line.financial_account_name}
              </div>
              <div className="tabular-nums text-gray-600">{line.posted_date}</div>
              <div className="text-gray-700 line-clamp-2 break-words" title={line.description}>
                {line.description}
              </div>
            </button>
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
