'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'

type Options = {
  storageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
  enabled?: boolean
}

export function usePersistedSplitWidth({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  enabled = true,
}: Options) {
  const [width, setWidth] = useState(defaultWidth)
  const widthRef = useRef(width)
  widthRef.current = width

  useLayoutEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const n = parseInt(raw, 10)
        if (Number.isFinite(n)) {
          setWidth(Math.min(maxWidth, Math.max(minWidth, n)))
        }
      }
    } catch {
      /* ignore */
    }
  }, [enabled, maxWidth, minWidth, storageKey])

  const commitWidth = useCallback(
    (next: number) => {
      const clamped = Math.min(maxWidth, Math.max(minWidth, next))
      setWidth(clamped)
      try {
        localStorage.setItem(storageKey, String(clamped))
      } catch {
        /* ignore */
      }
    },
    [maxWidth, minWidth, storageKey]
  )

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startW = widthRef.current
      const move = (ev: PointerEvent) => {
        const dw = ev.clientX - startX
        setWidth(Math.min(maxWidth, Math.max(minWidth, startW + dw)))
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        commitWidth(widthRef.current)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [commitWidth, enabled, maxWidth, minWidth]
  )

  return { width, onResizePointerDown }
}
