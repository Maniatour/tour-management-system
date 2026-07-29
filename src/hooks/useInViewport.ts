'use client'

import { useEffect, useRef, useState } from 'react'

type UseInViewportOptions = {
  /** false면 observer를 붙이지 않음 */
  enabled?: boolean
  /** 뷰포트 밖에서도 미리 로드할 여유(px) */
  rootMargin?: string
  threshold?: number
}

/**
 * 요소가 뷰포트(또는 rootMargin) 안에 들어왔는지 감지합니다.
 */
export function useInViewport({
  enabled = true,
  rootMargin = '240px 0px',
  threshold = 0,
}: UseInViewportOptions = {}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [inViewport, setInViewport] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setInViewport(false)
      return
    }

    const node = ref.current
    if (!node) return

    if (typeof IntersectionObserver === 'undefined') {
      setInViewport(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          setInViewport(true)
          observer.disconnect()
        }
      },
      { root: null, rootMargin, threshold }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, rootMargin, threshold])

  return { ref, inViewport }
}
