import { useState, useEffect, useCallback, useRef } from 'react'

interface UseOptimizedDataOptions<T> {
  fetchFn: () => Promise<T>
  dependencies?: any[]
  cacheKey?: string
  cacheTime?: number
  enabled?: boolean
}

interface CacheItem<T> {
  data: T
  timestamp: number
  expiresAt: number
}

// 간단한 메모리 캐시
const cache = new Map<string, CacheItem<any>>()

export function useOptimizedData<T>({
  fetchFn,
  dependencies = [],
  cacheKey,
  cacheTime = 5 * 60 * 1000, // 5분
  enabled = true
}: UseOptimizedDataOptions<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const isMountedRef = useRef(true)

  const fetchData = useCallback(async () => {
    if (!enabled) return

    // 캐시 확인
    if (cacheKey && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!
      if (Date.now() < cached.expiresAt) {
        setData(cached.data)
        setLoading(false)
        return
      }
    }

    try {
      setLoading(true)
      setError(null)
      
      const result = await fetchFn()
      
      if (!isMountedRef.current) return
      
      setData(result)
      
      // 캐시 저장
      if (cacheKey) {
        cache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          expiresAt: Date.now() + cacheTime
        })
      }
    } catch (err) {
      if (!isMountedRef.current) return
      
      console.error('Error fetching data:', err)
      setError(err as Error)
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [fetchFn, enabled, cacheKey, cacheTime])

  useEffect(() => {
    isMountedRef.current = true
    fetchData()
    
    return () => {
      isMountedRef.current = false
    }
  }, dependencies)

  // 캐시 무효화 함수
  const invalidateCache = useCallback(() => {
    if (cacheKey && cache.has(cacheKey)) {
      cache.delete(cacheKey)
    }
  }, [cacheKey])

  // 전체 캐시 클리어
  const clearCache = useCallback(() => {
    cache.clear()
  }, [])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    invalidateCache,
    clearCache
  }
}

// 캐시 유틸리티 함수들
export const cacheUtils = {
  clear: () => cache.clear(),
  clearByPattern: (pattern: string) => {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key)
      }
    }
  },
  getSize: () => cache.size,
  getKeys: () => Array.from(cache.keys())
}
