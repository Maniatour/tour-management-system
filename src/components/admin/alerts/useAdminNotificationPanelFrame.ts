'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export type NotificationPanelBox = {
  x: number
  y: number
  width: number
  height: number
}

export type NotificationPanelDragMode = 'move' | 'e' | 's' | 'se'

type DragSession = {
  mode: NotificationPanelDragMode
  pointerId: number
  startX: number
  startY: number
  origin: NotificationPanelBox
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

function frameLimits() {
  const margin = 8
  const maxW = Math.max(280, window.innerWidth - margin * 2)
  const maxH = Math.max(240, window.innerHeight - margin * 2)
  return {
    margin,
    minW: Math.min(360, maxW),
    minH: Math.min(420, maxH),
    maxW,
    maxH,
  }
}

function defaultBox(): NotificationPanelBox {
  const { margin, minW, minH, maxW, maxH } = frameLimits()
  const width = clamp(Math.min(512, maxW), minW, maxW)
  const height = clamp(Math.min(680, Math.round(window.innerHeight * 0.86), maxH), minH, maxH)
  return {
    width,
    height,
    x: clamp((window.innerWidth - width) / 2, margin, window.innerWidth - width - margin),
    y: clamp((window.innerHeight - height) / 2, margin, window.innerHeight - height - margin),
  }
}

function clampBox(box: NotificationPanelBox): NotificationPanelBox {
  const { margin, minW, minH, maxW, maxH } = frameLimits()
  const width = clamp(box.width, minW, maxW)
  const height = clamp(box.height, minH, maxH)
  return {
    width,
    height,
    x: clamp(box.x, margin, Math.max(margin, window.innerWidth - width - margin)),
    y: clamp(box.y, margin, Math.max(margin, window.innerHeight - height - margin)),
  }
}

export function useAdminNotificationPanelFrame(open: boolean) {
  const [box, setBox] = useState<NotificationPanelBox | null>(null)
  const boxRef = useRef<NotificationPanelBox | null>(null)
  const dragRef = useRef<DragSession | null>(null)
  boxRef.current = box

  useLayoutEffect(() => {
    if (!open || boxRef.current) return
    setBox(defaultBox())
  }, [open])

  useEffect(() => {
    const onResize = () => {
      setBox((current) => (current ? clampBox(current) : current))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      const { margin, minW, minH } = frameLimits()
      const next = { ...drag.origin }
      if (drag.mode === 'move') {
        next.x = clamp(
          drag.origin.x + dx,
          margin,
          Math.max(margin, window.innerWidth - drag.origin.width - margin)
        )
        next.y = clamp(
          drag.origin.y + dy,
          margin,
          Math.max(margin, window.innerHeight - drag.origin.height - margin)
        )
        setBox(next)
        return
      }
      if (drag.mode === 'e' || drag.mode === 'se') next.width = drag.origin.width + dx
      if (drag.mode === 's' || drag.mode === 'se') next.height = drag.origin.height + dy
      next.width = clamp(next.width, minW, Math.max(minW, window.innerWidth - next.x - margin))
      next.height = clamp(next.height, minH, Math.max(minH, window.innerHeight - next.y - margin))
      setBox(next)
    }
    const endDrag = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
    }
  }, [])

  const beginDrag = useCallback((mode: NotificationPanelDragMode, event: ReactPointerEvent<HTMLElement>) => {
    const current = boxRef.current
    if (!current) return
    if (mode === 'move' && event.target instanceof Element && event.target.closest('button, a, input, textarea, select')) {
      return
    }
    event.preventDefault()
    dragRef.current = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: current,
    }
  }, [])

  return { box, beginDrag }
}
