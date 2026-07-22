'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import type { ScheduleDisplayDataPayload } from '@/lib/scheduleDisplayData'
import {
  getScheduleDisplayCacheKey,
  isScheduleDisplayCacheFresh,
  readScheduleDisplayCache,
  writeScheduleDisplayCache,
  invalidateScheduleDisplayCache,
} from '@/lib/scheduleDisplayCache'
import { fetchScheduleDisplayFromApi, preloadScheduleViewChunk } from '@/lib/prefetchScheduleDisplay'

type UseScheduleDisplayDataResult = {
  data: ScheduleDisplayDataPayload | null
  loading: boolean
  isRefreshing: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useScheduleDisplayData(displayDayCount = 15): UseScheduleDisplayDataResult {
  const { operatorId } = useOperatorOptional()
  const activeOperatorId = resolveOperatorId(operatorId)
  const cacheKey = getScheduleDisplayCacheKey(activeOperatorId, displayDayCount)

  const cachedOnMount = readScheduleDisplayCache(cacheKey)
  const [data, setData] = useState<ScheduleDisplayDataPayload | null>(cachedOnMount)
  const [loading, setLoading] = useState(!cachedOnMount)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const load = useCallback(
    async (options?: { force?: boolean; background?: boolean }) => {
      const force = options?.force ?? false
      const background = options?.background ?? false

      if (!force && isScheduleDisplayCacheFresh(cacheKey)) {
        const cached = readScheduleDisplayCache(cacheKey)
        if (cached) {
          setData(cached)
          setLoading(false)
          setError(null)
          return
        }
      }

      const requestId = ++requestIdRef.current
      if (background) {
        setIsRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      try {
        const payload = await fetchScheduleDisplayFromApi(activeOperatorId, displayDayCount)
        if (requestId !== requestIdRef.current) return
        writeScheduleDisplayCache(cacheKey, payload)
        setData(payload)
      } catch (err) {
        if (requestId !== requestIdRef.current) return
        console.error('useScheduleDisplayData:', err)
        const message = err instanceof Error ? err.message : '데이터를 불러오지 못했습니다.'
        setError(message)
        if (!readScheduleDisplayCache(cacheKey)) {
          setData(null)
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [activeOperatorId, cacheKey, displayDayCount],
  )

  const refetch = useCallback(async () => {
    invalidateScheduleDisplayCache(cacheKey)
    await load({ force: true, background: false })
  }, [cacheKey, load])

  useEffect(() => {
    preloadScheduleViewChunk()

    const cached = readScheduleDisplayCache(cacheKey)
    if (cached) {
      setData(cached)
      setLoading(false)
      if (isScheduleDisplayCacheFresh(cacheKey)) return
      void load({ background: true })
      return
    }
    void load()
  }, [cacheKey, load])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (isScheduleDisplayCacheFresh(cacheKey)) return
      void load({ background: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [cacheKey, load])

  return { data, loading, isRefreshing, error, refetch }
}
