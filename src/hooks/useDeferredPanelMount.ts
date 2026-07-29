'use client'

import { useEffect, useState } from 'react'
import { scheduleDeferredWork } from '@/lib/scheduleDeferredWork'

/**
 * 팀보드 고정 Todo 패널을 순차 마운트해 초기 Supabase 동시 요청 수를 줄입니다.
 */
export function useDeferredPanelMount(panelIndex: number, immediateCount = 2): boolean {
  const [mounted, setMounted] = useState(panelIndex < immediateCount)

  useEffect(() => {
    if (panelIndex < immediateCount) {
      setMounted(true)
      return
    }

    if (panelIndex < 6) {
      const delayMs = 60 + (panelIndex - immediateCount) * 100
      const timer = window.setTimeout(() => setMounted(true), delayMs)
      return () => window.clearTimeout(timer)
    }

    return scheduleDeferredWork(() => setMounted(true), 350 + (panelIndex - 6) * 200)
  }, [panelIndex, immediateCount])

  return mounted
}
