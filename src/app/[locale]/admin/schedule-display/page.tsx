'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useLocale } from 'next-intl'

const ScheduleView = dynamic(() => import('@/components/ScheduleView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[50vh] items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">스케줄 디스플레이를 불러오는 중...</p>
      </div>
    </div>
  ),
})

export default function ScheduleDisplayPage() {
  const locale = useLocale()

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-slate-50">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-white px-3 py-2.5 sm:px-4">
        <Link
          href={`/${locale}/admin/tours`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/60 bg-white px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          <span>투어 관리</span>
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
            스케줄 디스플레이
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            오늘부터 15일 · 스케줄 테이블 + 투어 달력
          </p>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <ScheduleView variant="display" displayDayCount={15} />
      </div>
    </div>
  )
}
