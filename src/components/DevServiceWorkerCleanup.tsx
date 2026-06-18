'use client'

import { useEffect } from 'react'
import { cleanupDevServiceWorkerIfStale } from '@/lib/devServiceWorkerCleanup'

/**
 * `next dev`에서는 빌드 ID·해시가 계속 바뀌는데, 이전 `next build`로 만들어진
 * `public/sw.js`가 남아 있으면 프리캐시 URL이 404가 되어 `bad-precaching-response`가 난다.
 * stale SW·프리캐시가 있을 때만 1회 정리한다 (매 탭마다 전역 캐시 삭제 → 다른 탭 연쇄 새로고침 방지).
 */
export default function DevServiceWorkerCleanup() {
  useEffect(() => {
    void cleanupDevServiceWorkerIfStale()
  }, [])

  return null
}
