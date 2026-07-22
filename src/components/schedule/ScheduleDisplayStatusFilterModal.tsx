'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DEFAULT_SCHEDULE_DISPLAY_STATUS_FILTER,
  SCHEDULE_DISPLAY_STATUS_FILTER_OPTIONS,
  scheduleDisplayStatusFilterLabel,
  type ScheduleDisplayStatusFilterId,
} from '@/lib/scheduleDisplayStatusFilter'

export type ScheduleDisplayStatusFilterModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: string
  selected: ReadonlySet<ScheduleDisplayStatusFilterId>
  onApply: (next: Set<ScheduleDisplayStatusFilterId>) => void
}

export default function ScheduleDisplayStatusFilterModal({
  open,
  onOpenChange,
  locale,
  selected,
  onApply,
}: ScheduleDisplayStatusFilterModalProps) {
  const [draft, setDraft] = useState<Set<ScheduleDisplayStatusFilterId>>(() => new Set(selected))

  useEffect(() => {
    if (open) setDraft(new Set(selected))
  }, [open, selected])

  const toggle = (id: ScheduleDisplayStatusFilterId, checked: boolean) => {
    setDraft((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{locale === 'ko' ? '투어 상태 필터' : 'Tour status filter'}</DialogTitle>
          <DialogDescription>
            {locale === 'ko'
              ? '달력에 표시할 투어 상태를 선택하세요. (다중 선택)'
              : 'Choose which tour statuses to show on the calendar. (multi-select)'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SCHEDULE_DISPLAY_STATUS_FILTER_OPTIONS.map((option) => {
            const checked = draft.has(option.id)
            const inputId = `schedule-display-status-${option.id}`
            return (
              <label
                key={option.id}
                htmlFor={inputId}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2 hover:bg-muted/50"
              >
                <Checkbox
                  id={inputId}
                  checked={checked}
                  onCheckedChange={(value) => toggle(option.id, value === true)}
                />
                <span className="text-sm font-medium">
                  {scheduleDisplayStatusFilterLabel(option.id, locale)}
                </span>
              </label>
            )
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
            onClick={() => setDraft(new Set(DEFAULT_SCHEDULE_DISPLAY_STATUS_FILTER))}
          >
            {locale === 'ko' ? '기본값' : 'Default'}
          </button>
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
            onClick={() => onOpenChange(false)}
          >
            {locale === 'ko' ? '취소' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={draft.size === 0}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              onApply(new Set(draft))
              onOpenChange(false)
            }}
          >
            {locale === 'ko' ? '적용' : 'Apply'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
