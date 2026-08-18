'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type ProfitShareExcludeQuickToggleProps = {
  excluded: boolean
  disabled?: boolean
  onChange: (excluded: boolean) => void
}

export default function ProfitShareOffsetQuickButtons({
  excluded,
  disabled,
  onChange,
}: ProfitShareExcludeQuickToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={excluded}
      title={excluded ? '50/50에 다시 포함' : '상계 · 50/50에서 제외'}
      className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/30 px-2 h-7 disabled:opacity-50"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onChange(!excluded)
      }}
    >
      <span
        aria-hidden
        className={cn(
          'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border border-primary',
          excluded && 'bg-primary text-primary-foreground'
        )}
      >
        {excluded ? <Check className="h-3 w-3" /> : null}
      </span>
      <span className="text-[11px] font-medium leading-none">상계</span>
    </button>
  )
}
