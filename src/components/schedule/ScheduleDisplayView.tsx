'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useScheduleDisplayData } from '@/hooks/useScheduleDisplayData'
import { preloadScheduleViewChunk } from '@/lib/prefetchScheduleDisplay'

const ScheduleView = dynamic(() => import('@/components/schedule/ScheduleViewDisplay'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[50vh] items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">스케줄 그리드를 불러오는 중...</p>
      </div>
    </div>
  ),
})

type ScheduleDisplayViewProps = {
  displayDayCount?: number
}

export default function ScheduleDisplayView({ displayDayCount = 15 }: ScheduleDisplayViewProps) {
  const { data, loading, isRefreshing, error, refetch } = useScheduleDisplayData(displayDayCount)

  useEffect(() => {
    preloadScheduleViewChunk()
  }, [])

  if (loading) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">스케줄 디스플레이를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-4 bg-slate-50 px-4">
        <p className="text-center text-sm text-destructive">
          {error || '스케줄 디스플레이 데이터를 불러오지 못했습니다.'}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted"
        >
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {isRefreshing ? (
        <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-2 rounded-full border border-border/60 bg-white/95 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>갱신 중…</span>
        </div>
      ) : null}
      <ScheduleView
        variant="display"
        displayDayCount={displayDayCount}
        prefetchedScheduleData={data}
        onScheduleDisplayRefetch={refetch}
      />
    </div>
  )
}
