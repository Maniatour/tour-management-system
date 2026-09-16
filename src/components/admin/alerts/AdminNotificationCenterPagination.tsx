'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

type AdminNotificationCenterPaginationProps = {
  isKo: boolean
  page: number
  totalPages: number
  rangeStart: number
  rangeEnd: number
  total: number
  onPrev: () => void
  onNext: () => void
}

export function AdminNotificationCenterPagination({
  isKo,
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onPrev,
  onNext,
}: AdminNotificationCenterPaginationProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3">
      <p className="text-xs tabular-nums text-slate-500">
        <span className="font-medium text-slate-800">
          {rangeStart}–{rangeEnd}
        </span>
        {isKo ? ` / 총 ${total}건` : ` / ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {isKo ? '이전' : 'Prev'}
        </button>
        <span className="min-w-[3.5rem] text-center text-xs font-medium tabular-nums text-slate-700">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isKo ? '다음' : 'Next'}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
