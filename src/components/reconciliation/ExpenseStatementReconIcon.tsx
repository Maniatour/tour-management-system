'use client'

import { Landmark } from 'lucide-react'

export function ExpenseStatementReconIcon({
  matched,
  disabled,
  titleMatched,
  titleUnmatched,
  titleDisabled,
  onClick
}: {
  matched: boolean
  disabled?: boolean
  titleMatched: string
  titleUnmatched: string
  titleDisabled?: string
  onClick?: () => void
}) {
  const title = disabled ? (titleDisabled ?? titleUnmatched) : matched ? titleMatched : titleUnmatched
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
      <Landmark className={`h-4 w-4 shrink-0 ${matched && !disabled ? 'text-emerald-600' : 'text-slate-400'}`} aria-hidden />
    </button>
  )
}
