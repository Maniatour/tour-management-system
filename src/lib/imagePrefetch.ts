/**
 * 외부 이미지(채널 favicon, 상품 썸네일 등)를 백그라운드로 미리 받아
 * 브라우저 HTTP 캐시에 저장하는 간단한 prefetch 유틸.
 *
 * 사용 시점:
 *  - 페이지 진입 직후, 화면에 곧 깔릴 다수의 작은 이미지(예: 채널 favicon)를 일괄 워밍업.
 *  - 다음 화면(모달/상세)에서 보일 첨부 이미지를 hover 시 예열.
 *
 * 정책:
 *  - 같은 URL 은 한 번만 prefetch 한다.
 *  - SSR/노드 환경에서는 호출되어도 안전하다(window 가 없으면 no-op).
 *  - <Image> 객체로 백그라운드 fetch 를 트리거 → 브라우저 캐시에 저장 → next/image
 *    혹은 일반 <img> 태그가 동일 URL 을 요청하면 즉시 캐시 히트.
 */

const prefetchedUrls = new Set<string>()

/**
 * URL 들을 백그라운드 prefetch.
 * 빈/중복/무효 URL 은 자동으로 걸러진다.
 */
export function preloadImages(urls: ReadonlyArray<string | null | undefined>): void {
  if (typeof window === 'undefined') return
  if (!urls || urls.length === 0) return

  for (const raw of urls) {
    if (!raw) continue
    const url = raw.trim()
    if (!url) continue
    if (prefetchedUrls.has(url)) continue
    // data: / blob: 스킴은 prefetch 대상에서 제외 (이미 메모리/브라우저 보유)
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      prefetchedUrls.add(url)
      continue
    }
    prefetchedUrls.add(url)
    try {
      const img = new Image()
      img.decoding = 'async'
      // 가능한 환경에서만 fetchpriority 힌트 부여
      ;(img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'low'
      img.referrerPolicy = 'no-referrer'
      img.src = url
    } catch {
      // 무시 — prefetch 실패는 사용자 경험에 영향 없음
    }
  }
}

/**
 * 테스트/디버깅용 — 실제 코드에서는 사용하지 말 것.
 */
export function __resetImagePrefetchCacheForTests(): void {
  prefetchedUrls.clear()
}
