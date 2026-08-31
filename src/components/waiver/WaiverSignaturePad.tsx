'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

type Point = { x: number; y: number }
type Stroke = Point[]

type SignaturePadProps = {
  onChange: (empty: boolean, dataUrl: string) => void
  label: string
  hint: string
  clearLabel: string
  undoLabel: string
}

function coords(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
  const r = canvas.getBoundingClientRect()
  const scaleX = canvas.width / r.width
  const scaleY = canvas.height / r.height
  return {
    x: (clientX - r.left) * scaleX,
    y: (clientY - r.top) * scaleY,
  }
}

export default function WaiverSignaturePad({
  onChange,
  label,
  hint,
  clearLabel,
  undoLabel,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const strokes = useRef<Stroke[]>([])
  const current = useRef<Stroke>([])
  const drawing = useRef(false)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 2.6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const stroke of strokes.current) {
      if (stroke.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      for (let i = 1; i < stroke.length; i += 1) ctx.lineTo(stroke[i].x, stroke[i].y)
      ctx.stroke()
    }
    const empty = strokes.current.every((s) => s.length < 2)
    onChange(empty, empty ? '' : canvas.toDataURL('image/png'))
  }, [onChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const width = Math.floor(canvas.clientWidth * ratio)
    const height = Math.floor(180 * ratio)
    canvas.width = Math.max(width, 600)
    canvas.height = Math.max(height, 280)
    redraw()
  }, [redraw])

  const start = (x: number, y: number) => {
    drawing.current = true
    current.current = [{ x, y }]
    strokes.current = [...strokes.current, current.current]
  }
  const move = (x: number, y: number) => {
    if (!drawing.current) return
    current.current.push({ x, y })
    redraw()
  }
  const end = () => {
    drawing.current = false
    redraw()
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium tracking-wide text-foreground">{label}</p>
      <p id="waiver-signature-hint" className="text-sm text-muted-foreground">
        {hint}
      </p>
      <div className="rounded-xl border border-border bg-white shadow-sm">
        <canvas
          ref={canvasRef}
          className="h-[180px] w-full touch-none rounded-xl"
          aria-label={label}
          aria-describedby="waiver-signature-hint"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            const c = canvasRef.current
            if (!c) return
            const p = coords(c, e.clientX, e.clientY)
            start(p.x, p.y)
          }}
          onPointerMove={(e) => {
            const c = canvasRef.current
            if (!c) return
            const p = coords(c, e.clientX, e.clientY)
            move(p.x, p.y)
          }}
          onPointerUp={end}
          onPointerCancel={end}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-lg"
          onClick={() => {
            strokes.current = []
            redraw()
          }}
        >
          {clearLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 rounded-lg"
          onClick={() => {
            strokes.current = strokes.current.slice(0, -1)
            redraw()
          }}
        >
          {undoLabel}
        </Button>
      </div>
    </div>
  )
}
