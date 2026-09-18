'use client'

import { useRef } from 'react'
import { GripHorizontal } from 'lucide-react'

const DEFAULT_MIN = 240
const DEFAULT_MAX = 1400

export function clampPanelHeight(value: number, min = DEFAULT_MIN, max = DEFAULT_MAX): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

export default function PanelHeightResizeHandle({
  height,
  onHeightChange,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  label,
}: {
  height: number
  onHeightChange: (next: number) => void
  min?: number
  max?: number
  label: string
}) {
  const startRef = useRef<{ y: number; h: number } | null>(null)

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      aria-valuenow={Math.round(height)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        startRef.current = { y: event.clientY, h: height }
      }}
      onPointerMove={(event) => {
        const start = startRef.current
        if (!start) return
        onHeightChange(clampPanelHeight(start.h + (event.clientY - start.y), min, max))
      }}
      onPointerUp={(event) => {
        startRef.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }}
      onPointerCancel={() => {
        startRef.current = null
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          onHeightChange(clampPanelHeight(height + 32, min, max))
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          onHeightChange(clampPanelHeight(height - 32, min, max))
        }
      }}
      className="flex h-4 shrink-0 cursor-ns-resize items-center justify-center border-t border-gray-200 bg-gray-50 text-gray-400 transition hover:bg-muted hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <GripHorizontal className="h-3.5 w-3.5" aria-hidden />
    </div>
  )
}
