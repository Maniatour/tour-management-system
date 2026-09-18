'use client'

import { cn } from '@/lib/utils'
import type { ReportStopRole } from '@/lib/tourReportStopRoles'

const ROLE_BUTTONS: { role: ReportStopRole; label: string; activeClass: string }[] = [
  { role: 'required', label: '필수', activeClass: 'bg-primary text-primary-foreground' },
  { role: 'alternate', label: '대체', activeClass: 'bg-amber-500 text-white' },
  { role: 'optional', label: '선택', activeClass: 'bg-emerald-600 text-white' },
]

export default function ProductTourCourseReportRoleToggle({
  value,
  onChange,
}: {
  value: ReportStopRole | null
  onChange: (next: ReportStopRole | null) => void
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">리포트</span>
      {ROLE_BUTTONS.map((item) => (
        <button
          key={item.role}
          type="button"
          onClick={() => onChange(value === item.role ? null : item.role)}
          className={cn(
            'rounded-lg px-2 py-1 text-[11px] font-medium transition',
            value === item.role
              ? item.activeClass
              : 'border border-border bg-white text-muted-foreground hover:bg-muted/50'
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
