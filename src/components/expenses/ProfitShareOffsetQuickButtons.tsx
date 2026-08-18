'use client'

import { Checkbox } from '@/components/ui/checkbox'

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
      title={excluded ? '50/50에 다시 포함' : '상계 · 50/50에서 제외'}
      className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/30 px-2 h-7 disabled:opacity-50"
      onClick={() => onChange(!excluded)}
    >
      <Checkbox checked={excluded} disabled={disabled} className="h-3.5 w-3.5 pointer-events-none" />
      <span className="text-[11px] font-medium leading-none">상계</span>
    </button>
  )
}
