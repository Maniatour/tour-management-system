'use client'

import { useEffect, useState } from 'react'
import { useCustomerPagePreviewViewport } from '@/contexts/CustomerPagePreviewViewportContext'

type LayoutMode = {
  /** lg 미만 — 사이드바·모바일 예약·sticky CTA */
  isMobileLayout: boolean
  /** sm 미만 — 탭 아이콘 그리드·모바일 시트 */
  isCompactLayout: boolean
  /** md 미만 — 갤러리 단일 이미지 */
  isMdDownLayout: boolean
  isDesktopLayout: boolean
}

function readForcedLayout(forced: ReturnType<typeof useCustomerPagePreviewViewport>): LayoutMode | null {
  if (forced === 'mobile') {
    return {
      isMobileLayout: true,
      isCompactLayout: true,
      isMdDownLayout: true,
      isDesktopLayout: false,
    }
  }
  if (forced === 'desktop') {
    return {
      isMobileLayout: false,
      isCompactLayout: false,
      isMdDownLayout: false,
      isDesktopLayout: true,
    }
  }
  return null
}

/** 고객 페이지 반응형 — 관리자 미리보기 뷰포트가 있으면 우선 적용 */
export function useCustomerPageLayoutMode(): LayoutMode {
  const forcedViewport = useCustomerPagePreviewViewport()
  const forcedLayout = readForcedLayout(forcedViewport)
  const [layout, setLayout] = useState<LayoutMode>(() => ({
    isMobileLayout: false,
    isCompactLayout: false,
    isMdDownLayout: false,
    isDesktopLayout: true,
  }))

  useEffect(() => {
    if (forcedViewport !== null) return

    const lgMq = window.matchMedia('(max-width: 1023px)')
    const smMq = window.matchMedia('(max-width: 639px)')
    const mdMq = window.matchMedia('(max-width: 767px)')

    const sync = () => {
      setLayout({
        isMobileLayout: lgMq.matches,
        isCompactLayout: smMq.matches,
        isMdDownLayout: mdMq.matches,
        isDesktopLayout: !lgMq.matches,
      })
    }

    sync()
    lgMq.addEventListener('change', sync)
    smMq.addEventListener('change', sync)
    mdMq.addEventListener('change', sync)

    return () => {
      lgMq.removeEventListener('change', sync)
      smMq.removeEventListener('change', sync)
      mdMq.removeEventListener('change', sync)
    }
  }, [forcedViewport])

  return forcedLayout ?? layout
}
