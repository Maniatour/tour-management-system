'use client'

import { useEffect } from 'react'
import { prefetchWaiverCardSummaries } from '@/lib/waiver/cardSummaryClient'

export function usePrefetchWaiverCardSummaries(reservationIds: string[]) {
  const key = [...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean))].sort().join(',')

  useEffect(() => {
    if (!key) return
    prefetchWaiverCardSummaries(key.split(','))
  }, [key])
}
