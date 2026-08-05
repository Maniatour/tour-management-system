'use client'

import ScheduleDisplayView from '@/components/schedule/ScheduleDisplayView'

export default function ScheduleDisplayPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden">
      <div className="lg:min-h-0 lg:flex-1">
        <ScheduleDisplayView displayDayCount={15} />
      </div>
    </div>
  )
}
