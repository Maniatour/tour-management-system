'use client'

import { useState } from 'react'
import { FileBarChart } from 'lucide-react'
import { DailyReportPreviewModal } from '@/components/admin/daily-report/DailyReportPreviewModal'

type DailyReportHeaderButtonProps = {
  locale?: string
  className?: string
  /** 외부에서 모달 열기 제어 (퇴근 모달 등) */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideButton?: boolean
}

export function DailyReportHeaderButton({
  locale = 'ko',
  className = '',
  open: controlledOpen,
  onOpenChange,
  hideButton = false,
}: DailyReportHeaderButtonProps) {
  const isKo = locale.startsWith('ko')
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  return (
    <>
      {!hideButton && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            className ||
            'inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-white transition-colors hover:bg-slate-900'
          }
          title={isKo ? 'Daily Report — 일일 업무 보고' : 'Daily Report'}
          aria-label={isKo ? 'Daily Report — 일일 업무 보고' : 'Daily Report'}
        >
          <FileBarChart className="h-5 w-5" />
        </button>
      )}

      <DailyReportPreviewModal open={open} onClose={() => setOpen(false)} locale={locale} />
    </>
  )
}
