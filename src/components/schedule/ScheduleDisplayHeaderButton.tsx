'use client'

import { useCallback } from 'react'
import { ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { prefetchScheduleDisplayData } from '@/lib/prefetchScheduleDisplay'

type ScheduleDisplayHeaderButtonProps = {
  locale: string
  className?: string
}

export default function ScheduleDisplayHeaderButton({
  locale,
  className,
}: ScheduleDisplayHeaderButtonProps) {
  const router = useRouter()
  const { operatorId } = useOperatorOptional()
  const activeOperatorId = resolveOperatorId(operatorId)

  const prefetch = useCallback(() => {
    router.prefetch(`/${locale}/admin/schedule-display`)
    void prefetchScheduleDisplayData(activeOperatorId, 15)
  }, [router, locale, activeOperatorId])

  return (
    <button
      type="button"
      onClick={() => router.push(`/${locale}/admin/schedule-display`)}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      className={className}
      title="스케줄 디스플레이"
      aria-label="스케줄 디스플레이"
    >
      <ExternalLink size={16} aria-hidden />
    </button>
  )
}
