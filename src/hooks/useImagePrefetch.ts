'use client'

import { useEffect } from 'react'
import { preloadImages } from '@/lib/imagePrefetch'

/**
 * 화면에 곧 표시될 외부 이미지 URL 목록을 백그라운드 prefetch.
 *
 * - urls 가 변경될 때마다 새 항목만 추가로 prefetch (모듈 스코프 Set 으로 중복 방지)
 * - SSR 안전 — useEffect 안에서만 prefetch 실행
 * - 페이지 첫 진입 직후, 카드/배지에 깔릴 favicon/썸네일 워밍업에 적합
 */
export function useImagePrefetch(urls: ReadonlyArray<string | null | undefined>): void {
  useEffect(() => {
    if (!urls || urls.length === 0) return
    // 별도 microtask 로 양보 — 메인 스레드의 첫 페인트를 막지 않도록
    const id = setTimeout(() => {
      preloadImages(urls)
    }, 0)
    return () => clearTimeout(id)
  }, [urls])
}
