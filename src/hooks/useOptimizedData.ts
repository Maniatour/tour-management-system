import React, { useState, useEffect, useCallback, useRef } from 'react'
import { isAbortLikeError } from '@/lib/supabase'
import { serializeUnknownError, unknownToError } from '@/lib/unknownToError'

interface UseOptimizedDataOptions<T> {
  fetchFn: () => Promise<T>
  dependencies?: unknown[]
  cacheKey?: string
  cacheTime?: number
  enabled?: boolean
  /**
   * stale-while-revalidate.
   * 기본 true — 캐시가 있으면 신선/오래됨 모두 즉시 표시하고,
   * 백그라운드에서 fresh fetch를 진행해 데이터를 갱신한다(페이지 재진입 시 0초 표시).
   * cacheTime 안의 캐시면 fresh로 간주해 백그라운드 갱신을 생략한다.
   */
  staleWhileRevalidate?: boolean
}

interface CacheItem<T> {
  data: T
  timestamp: number
  expiresAt: number
}

// 간단한 메모리 캐시
const cache = new Map<string, CacheItem<unknown>>()
// 동일 cacheKey 에 대한 진행 중 fetch — 동시 다중 마운트에서 N회 발사 방지
const inflight = new Map<string, Promise<unknown>>()

/**
 * useOptimizedData 의 기본 dependencies 가 아래처럼 작성되면 안 된다:
 *   dependencies = []  // 호출마다 새 배열 참조 → useEffect 가 매 렌더 실행 → 무한 fetch/setState
 * 모듈 단일 빈 배열을 사용한다.
 */
const EMPTY_EFFECT_DEPS: readonly unknown[] = []

export function useOptimizedData<T>({
  fetchFn,
  dependencies,
  cacheKey,
  cacheTime = 5 * 60 * 1000, // 5분
  enabled = true,
  staleWhileRevalidate = true,
}: UseOptimizedDataOptions<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const isMountedRef = useRef(true)

  // 인라인 fetchFn 이 매 렌더마다 새 참조여도 fetchData 가 안정적으로 유지되도록 최신 함수만 ref 에 보관
  const fetchFnRef = useRef(fetchFn)
  fetchFnRef.current = fetchFn

  const extraDeps = dependencies === undefined || dependencies.length === 0 ? EMPTY_EFFECT_DEPS : dependencies

  const fetchData = useCallback(async () => {
    if (!enabled) {
      if (isMountedRef.current) {
        setLoading(false)
      }
      return
    }

    // 캐시 확인 (fresh / stale 분기)
    if (cacheKey && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!
      const isFresh = Date.now() < cached.expiresAt
      if (isFresh) {
        // 신선한 캐시 — 즉시 표시 후 종료
        if (isMountedRef.current) {
          setData(cached.data as T)
          setLoading(false)
        }
        return
      }
      if (staleWhileRevalidate) {
        // 오래된 캐시지만 즉시 표시 + 아래에서 백그라운드 갱신 진행
        if (isMountedRef.current) {
          setData(cached.data as T)
          setLoading(false)
        }
      }
    }

    // 동일 키 진행 중 fetch가 있으면 재사용 (N회 발사 방지)
    if (cacheKey && inflight.has(cacheKey)) {
      try {
        const result = (await inflight.get(cacheKey)) as T
        if (!isMountedRef.current) return
        setData(result)
      } catch {
        // 메인 발사처에서 에러 처리됨
      }
      return
    }

    try {
      // 캐시(stale)가 표시 중이면 setLoading(true)로 깜빡이지 않게 한다.
      const hasStaleVisible =
        staleWhileRevalidate && cacheKey != null && cache.has(cacheKey)
      if (!hasStaleVisible) {
        setLoading(true)
      }
      setError(null)

      const promise = fetchFnRef.current()
      if (cacheKey) inflight.set(cacheKey, promise)
      const result = await promise

      if (!isMountedRef.current) return

      setData(result)

      if (cacheKey) {
        cache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          expiresAt: Date.now() + cacheTime,
        })
      }
    } catch (err) {
      if (!isMountedRef.current) return

      if (isAbortLikeError(err)) {
        return
      }
      const normalized = unknownToError(err)
      console.error('Error fetching data:', serializeUnknownError(err), normalized.message)
      setError(normalized)
    } finally {
      if (cacheKey) inflight.delete(cacheKey)
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [enabled, cacheKey, cacheTime, staleWhileRevalidate])

  useEffect(() => {
    isMountedRef.current = true
    fetchData()

    return () => {
      isMountedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extraDeps 는 호출부가 넘긴 외부 의존성 시그니처
  }, [fetchData, ...extraDeps])

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

  // refetch: 캐시를 무시하고 항상 서버에서 새로 불러옴 (추가/수정/삭제 후 목록 갱신용)
  const refetch = useCallback(async () => {
    invalidateCache()
    return fetchData()
  }, [invalidateCache, fetchData])

  return {
    data,
    loading,
    error,
    refetch,
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
