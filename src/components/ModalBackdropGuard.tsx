'use client'

import { useEffect } from 'react'
import { shouldSuppressBackdropClickFromFieldDrag } from '@/lib/modalBackdropGuard'

/**
 * 사이트 전역: 입력칸에서 드래그로 텍스트 선택 후 백드롭에서 mouseup 할 때
 * 모달이 닫히지 않도록 click 전파를 차단합니다.
 */
export default function ModalBackdropGuard() {
  useEffect(() => {
    let pointerDownTarget: Element | null = null

    const onPointerDown = (e: PointerEvent) => {
      pointerDownTarget = e.target instanceof Element ? e.target : null
    }

    const onClick = (e: MouseEvent) => {
      const clickTarget = e.target instanceof Element ? e.target : null

      if (
        shouldSuppressBackdropClickFromFieldDrag(pointerDownTarget, clickTarget)
      ) {
        e.stopPropagation()
        e.stopImmediatePropagation()
      }

      pointerDownTarget = null
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('click', onClick, true)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('click', onClick, true)
    }
  }, [])

  return null
}
