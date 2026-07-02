import type { MouseEvent as ReactMouseEvent } from 'react'

const FIELD_SELECTOR =
  'input, textarea, select, option, [contenteditable="true"], [contenteditable=""], [role="textbox"]'

export function isFormFieldElement(el: Element | null): boolean {
  if (!el) return false
  return !!el.closest(FIELD_SELECTOR)
}

/** fixed 전체 화면 모달 배경(백드롭)인지 판별 */
export function isModalBackdropElement(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false

  const style = window.getComputedStyle(el)
  if (style.position !== 'fixed') return false

  const rect = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (rect.width < vw * 0.85 || rect.height < vh * 0.85) return false

  const top = parseFloat(style.top)
  const left = parseFloat(style.left)
  const coversViewport =
    el.className.includes('inset-0') ||
    (Number.isFinite(top) && top <= 1 && Number.isFinite(left) && left <= 1)

  return coversViewport
}

/**
 * 입력칸에서 텍스트 드래그 선택 후 백드롭에서 mouseup → click 으로 모달이 닫히는 것을 방지.
 * document capture 단계에서 호출.
 */
export function shouldSuppressBackdropClickFromFieldDrag(
  pointerDownTarget: Element | null,
  clickTarget: Element | null
): boolean {
  if (!pointerDownTarget || !clickTarget) return false
  if (!isFormFieldElement(pointerDownTarget)) return false
  if (pointerDownTarget === clickTarget || pointerDownTarget.contains(clickTarget)) {
    return false
  }
  if (!isModalBackdropElement(clickTarget)) return false

  return true
}

/** React 모달 백드rop에 직접 붙일 때: mousedown·click 모두 백드롭에서 시작/끝날 때만 닫기 */
export function getSafeBackdropPointerHandlers(onClose: () => void) {
  let mouseDownOnBackdrop = false

  return {
    onMouseDown: (e: ReactMouseEvent) => {
      mouseDownOnBackdrop = e.target === e.currentTarget
    },
    onClick: (e: ReactMouseEvent) => {
      if (mouseDownOnBackdrop && e.target === e.currentTarget) {
        onClose()
      }
      mouseDownOnBackdrop = false
    },
  }
}
