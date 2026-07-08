'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  applyResizeDelta,
  clampResizableRect,
  defaultCenteredRect,
  loadPersistedRect,
  persistRect,
  type ResizableRect,
  type ResizeHandle,
} from '@/lib/resizableRect'

type Options = {
  storageKey?: string
  defaultW?: number
  defaultH?: number
  enabled?: boolean
}

export function useResizableRect({
  storageKey,
  defaultW = 960,
  defaultH = 720,
  enabled = true,
}: Options) {
  const fallback = defaultCenteredRect(defaultW, defaultH)
  const [rect, setRect] = useState<ResizableRect>(fallback)
  const rectRef = useRef(rect)
  rectRef.current = rect

  useLayoutEffect(() => {
    if (!enabled) return
    if (storageKey) {
      setRect(loadPersistedRect(storageKey, fallback))
    } else {
      setRect(fallback)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open/default only
  }, [enabled, storageKey])

  useEffect(() => {
    if (!enabled) return
    const onWinResize = () => setRect((r) => clampResizableRect(r))
    window.addEventListener('resize', onWinResize)
    return () => window.removeEventListener('resize', onWinResize)
  }, [enabled])

  const commitRect = useCallback(
    (next: ResizableRect) => {
      const clamped = clampResizableRect(next)
      setRect(clamped)
      if (storageKey) persistRect(storageKey, clamped)
      return clamped
    },
    [storageKey]
  )

  const onDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.button !== 0) return
      if ((e.target as HTMLElement).closest('button, a, input, select, textarea, [data-no-drag]')) return
      e.preventDefault()
      const startX = e.clientX
      const startY = e.clientY
      const start = rectRef.current
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        setRect(clampResizableRect({ ...start, x: start.x + dx, y: start.y + dy }))
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        commitRect(rectRef.current)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [commitRect, enabled]
  )

  const onResizePointerDown = useCallback(
    (handle: ResizeHandle) => (e: React.PointerEvent) => {
      if (!enabled || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startY = e.clientY
      const start = rectRef.current
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        setRect(applyResizeDelta(start, handle, dx, dy))
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        commitRect(rectRef.current)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [commitRect, enabled]
  )

  return {
    rect,
    onDragPointerDown,
    onResizePointerDown,
  }
}
