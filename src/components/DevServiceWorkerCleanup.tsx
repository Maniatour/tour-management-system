'use client'

import { useEffect } from 'react'

/**
 * `next dev`에서는 빌드 ID·해시가 계속 바뀌는데, 이전 `next build`로 만들어진
 * `public/sw.js`가 남아 있으면 프리캐시 URL이 404가 되어 `bad-precaching-response`가 난다.
 * 개발 모드에서만 등록을 해제하고 Serwist/Workbox 캐시를 비운다.
 */
export default function DevServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    void (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      } catch {
        /* ignore */
      }
      try {
        const keys = await caches.keys()
        await Promise.all(
          keys.filter((k) => /workbox|serwist|precache/i.test(k)).map((k) => caches.delete(k))
        )
      } catch {
        /* ignore */
      }
    })()
  }, [])

  return null
}
