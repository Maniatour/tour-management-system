'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import {
  clampAdminFabPosition,
  readSavedAdminFabPosition,
  writeSavedAdminFabPosition,
  type AdminFabPosition,
} from '@/lib/adminFloatingFabLayout'

const DRAG_THRESHOLD_PX = 6

type DragState = {
  pointerId: number
  startClientX: number
  startClientY: number
  startLeft: number
  startTop: number
}

/**
 * 관리자 플로팅 FAB를 드래그로 이동. 위치는 localStorage에 저장.
 * 짧은 클릭은 onClick으로 전달하고, 임계값 이상 이동 시 클릭은 무시.
 */
export function useDraggableAdminFab(storageKey: string, stackIndex = 0) {
  // SSR에서는 null → visibility:hidden. 마운트 후 저장된 좌표로 표시 (하이드레이션 불일치 방지).
  const [pos, setPos] = useState<AdminFabPosition | null>(null)
  const posRef = useRef<AdminFabPosition>({ left: 0, top: 0 })
  const dragRef = useRef<DragState | null>(null)
  const didDragRef = useRef(false)

  useEffect(() => {
    const next = readSavedAdminFabPosition(storageKey, stackIndex)
    posRef.current = next
    setPos(next)
  }, [storageKey, stackIndex])

  useEffect(() => {
    const onResize = () => {
      const clamped = clampAdminFabPosition(posRef.current.left, posRef.current.top)
      posRef.current = clamped
      setPos(clamped)
    }
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [])

  const onPointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.startClientX
    const dy = e.clientY - drag.startClientY
    if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
      didDragRef.current = true
    }
    const next = clampAdminFabPosition(drag.startLeft + dx, drag.startTop + dy)
    posRef.current = next
    setPos(next)
  }, [])

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      dragRef.current = null
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      writeSavedAdminFabPosition(storageKey, posRef.current)
    },
    [onPointerMove, storageKey],
  )

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || !pos) return
      e.stopPropagation()
      didDragRef.current = false
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      dragRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startLeft: pos.left,
        startTop: pos.top,
      }
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
    },
    [pos, onPointerMove, onPointerUp],
  )

  /** onClick에서 호출: 드래그였으면 true (열기 동작 스킵) */
  const consumeClickIfDragged = useCallback(() => {
    if (!didDragRef.current) return false
    didDragRef.current = false
    return true
  }, [])

  const fabStyle: CSSProperties | undefined = pos
    ? {
        left: pos.left,
        top: pos.top,
        right: 'auto',
        bottom: 'auto',
        touchAction: 'none',
        cursor: 'grab',
      }
    : { visibility: 'hidden' as const }

  return {
    fabStyle,
    onPointerDown,
    consumeClickIfDragged,
  }
}
