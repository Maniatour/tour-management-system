'use client'

import { useEffect, useState } from 'react'

/**
 * 고객 페이지 영역 편집 모달(≈88vh)에 맞춘 리치 에디터 초기 높이.
 * @param reservePx 헤더·탭·푸터·여백으로 남길 픽셀
 */
export function useModalEditorHeight(reservePx = 260): number {
  const [height, setHeight] = useState(480)

  useEffect(() => {
    const update = () => {
      const modalH = Math.min(window.innerHeight * 0.88, window.innerHeight - 32)
      setHeight(Math.max(320, Math.round(modalH - reservePx)))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [reservePx])

  return height
}
