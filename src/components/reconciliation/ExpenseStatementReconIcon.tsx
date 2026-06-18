'use client'

import { Ban, Landmark } from 'lucide-react'

export function ExpenseStatementReconIcon({
  matched,
  exempt,
  disabled,
  titleMatched,
  titleUnmatched,
  titleExempt,
  titleDisabled,
  onClick
}: {
  matched: boolean
  exempt?: boolean
  disabled?: boolean
  titleMatched: string
  titleUnmatched: string
  titleExempt?: string
  titleDisabled?: string
  onClick?: () => void
}) {
  const title = disabled
    ? (titleDisabled ?? titleUnmatched)
    : exempt
      ? (titleExempt ?? titleMatched)
      : matched
        ? titleMatched
        : titleUnmatched
  const done = matched || exempt
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled) onClick?.()
      }}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent transition-colors ${
        disabled
          ? 'cursor-not-allowed text-slate-300 opacity-60'
          : 'cursor-pointer hover:bg-slate-100 text-slate-500 hover:text-slate-800'
      }`}
      title={title}
      aria-label={title}
    >
      {exempt && !disabled ? (
        <span className="relative inline-flex">
          <Landmark className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <Ban className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-slate-600 bg-white rounded-full" aria-hidden />
        </span>
      ) : (
        <Landmark className={`h-4 w-4 shrink-0 ${done && !disabled ? 'text-emerald-600' : 'text-slate-400'}`} aria-hidden />
      )}
    </button>
  )
}
