'use client'

import { Check, Flag, Ban } from 'lucide-react'
import {
  type CashLedgerReviewStatus,
  CASH_LEDGER_REVIEW_OPTIONS,
} from '@/lib/cashLedgerReview'
import { cn } from '@/lib/utils'

const ICONS: Record<CashLedgerReviewStatus, typeof Check> = {
  approved: Check,
  unapproved: Ban,
  flagged: Flag,
}

const ACTIVE: Record<CashLedgerReviewStatus, string> = {
  approved: 'bg-emerald-600 text-white border-emerald-600',
  unapproved: 'bg-gray-600 text-white border-gray-600',
  flagged: 'bg-amber-500 text-white border-amber-500',
}

const IDLE: Record<CashLedgerReviewStatus, string> = {
  approved: 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50',
  unapproved: 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
  flagged: 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50',
}

type Props = {
  status: CashLedgerReviewStatus | null
  disabled?: boolean
  onChange: (next: CashLedgerReviewStatus) => void
  showLabel?: boolean
}

export default function CashLedgerReviewControls({
  status,
  disabled,
  onChange,
  showLabel = false,
}: Props) {
  return (
    <div className="inline-flex items-center gap-0.5" role="group" aria-label="검토 상태">
      {CASH_LEDGER_REVIEW_OPTIONS.map((opt) => {
        const Icon = ICONS[opt.value]
        const active = status === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            title={opt.label}
            aria-pressed={active}
            aria-label={opt.label}
            onClick={() => {
              if (!disabled) onChange(opt.value)
            }}
            className={cn(
              'inline-flex h-8 min-h-[32px] items-center justify-center rounded-md border px-1.5 text-[11px] font-medium transition-colors duration-200 disabled:opacity-50',
              showLabel ? 'h-10 min-h-[40px] gap-1 px-3 text-sm' : 'w-8',
              active ? ACTIVE[opt.value] : IDLE[opt.value]
            )}
          >
            <Icon className={showLabel ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden />
            {showLabel ? <span>{opt.label}</span> : <span className="sr-only">{opt.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
