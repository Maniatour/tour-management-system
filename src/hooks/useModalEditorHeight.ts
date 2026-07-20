'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const MODAL_SELECTOR = '[data-customer-zone-edit-modal]'
const SCROLL_SELECTOR = '[data-customer-zone-edit-scroll]'

function computeAvailableHeight(
  measureEl: HTMLElement | null,
  reserveBelowPx: number
): number {
  const scrollParent =
    (measureEl?.closest(SCROLL_SELECTOR) as HTMLElement | null) ??
    (document.querySelector(SCROLL_SELECTOR) as HTMLElement | null)
  const modalShell =
    (measureEl?.closest(MODAL_SELECTOR) as HTMLElement | null) ??
    (document.querySelector(MODAL_SELECTOR) as HTMLElement | null)

  const viewportH = window.innerHeight
  const modalH =
    modalShell?.clientHeight ?? Math.min(viewportH * 0.88, viewportH - 32)

  if (measureEl && scrollParent) {
    const parentRect = scrollParent.getBoundingClientRect()
    const slotTop = measureEl.getBoundingClientRect().top
    // Visible space from editor top to bottom of modal body (no page scroll).
    const available = parentRect.bottom - slotTop - reserveBelowPx
    return Math.max(160, Math.min(Math.round(available), Math.round(modalH - 80)))
  }

  return Math.max(160, Math.round(modalH - reserveBelowPx - 220))
}

/**
 * Zone edit modal(≈88vh) 안에서 리치 에디터 초기 높이를 잡습니다.
 * measureRef를 에디터 래퍼에 붙이면, 모달 본문 스크롤이 생기지 않도록
 * 남은 세로 공간에 맞춰 높이를 계산합니다.
 *
 * @param reserveBelowPx 에디터 아래 저장 버튼·여백 등
 */
export function useModalEditorHeight(reserveBelowPx = 140): {
  height: number
  measureRef: (el: HTMLDivElement | null) => void
} {
  const measureElRef = useRef<HTMLDivElement | null>(null)
  const [measureEl, setMeasureEl] = useState<HTMLDivElement | null>(null)
  const [height, setHeight] = useState(220)

  const measureRef = useCallback((el: HTMLDivElement | null) => {
    measureElRef.current = el
    setMeasureEl(el)
  }, [])

  useEffect(() => {
    let frame = 0

    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setHeight(computeAvailableHeight(measureElRef.current, reserveBelowPx))
      })
    }

    update()
    window.addEventListener('resize', update)

    const ro = new ResizeObserver(update)
    const scrollEl = document.querySelector(SCROLL_SELECTOR)
    const modalEl = document.querySelector(MODAL_SELECTOR)
    if (scrollEl) ro.observe(scrollEl)
    if (modalEl) ro.observe(modalEl)
    if (measureEl) ro.observe(measureEl)

    const t = window.setTimeout(update, 50)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(t)
      window.removeEventListener('resize', update)
      ro.disconnect()
    }
  }, [reserveBelowPx, measureEl])

  return { height, measureRef }
}
