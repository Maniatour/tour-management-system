'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { GripVertical, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Rect = { x: number; y: number; w: number; h: number }

const MIN_W = 360
const MIN_H = 260
const DEFAULT_W = 560
const DEFAULT_H = 720

function clampRect(r: Rect): Rect {
  if (typeof window === 'undefined') return r
  const margin = 8
  const maxW = window.innerWidth - margin * 2
  const maxH = window.innerHeight - margin * 2
  const w = Math.min(Math.max(MIN_W, r.w), maxW)
  const h = Math.min(Math.max(MIN_H, r.h), maxH)
  const x = Math.min(Math.max(margin, r.x), window.innerWidth - w - margin)
  const y = Math.min(Math.max(margin, r.y), window.innerHeight - h - margin)
  return { x, y, w, h }
}

export default function SopPrintPreviewFloatingPanel({
  open,
  onOpenChange,
  uiLocaleEn,
  storageKey,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  uiLocaleEn: boolean
  storageKey: string
  title: string
  children: ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  const [rect, setRect] = useState<Rect>(() => ({
    x: 48,
    y: 72,
    w: DEFAULT_W,
    h: DEFAULT_H,
  }))
  const rectRef = useRef(rect)
  rectRef.current = rect

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const persist = useCallback(
    (r: Rect) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(r))
      } catch {
        /* ignore */
      }
    },
    [storageKey]
  )

  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const p = JSON.parse(raw) as Partial<Rect>
        const next: Rect = {
          x: typeof p.x === 'number' ? p.x : 48,
          y: typeof p.y === 'number' ? p.y : 72,
          w: typeof p.w === 'number' ? p.w : DEFAULT_W,
          h: typeof p.h === 'number' ? p.h : DEFAULT_H,
        }
        setRect(clampRect(next))
      } else {
        setRect(
          clampRect({
            x: Math.max(16, window.innerWidth - DEFAULT_W - 28),
            y: 72,
            w: DEFAULT_W,
            h: Math.min(DEFAULT_H, window.innerHeight - 96),
          })
        )
      }
    } catch {
      setRect(
        clampRect({
          x: Math.max(16, window.innerWidth - DEFAULT_W - 28),
          y: 72,
          w: DEFAULT_W,
          h: Math.min(DEFAULT_H, window.innerHeight - 96),
        })
      )
    }
  }, [open, storageKey])

  useEffect(() => {
    if (!open) return
    const onWinResize = () => setRect((r) => clampRect(r))
    window.addEventListener('resize', onWinResize)
    return () => window.removeEventListener('resize', onWinResize)
  }, [open])

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const { x: sx, y: sy } = rectRef.current
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      setRect((prev) => clampRect({ ...prev, x: sx + dx, y: sy + dy }))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setRect((prev) => {
        const c = clampRect(prev)
        persist(c)
        return c
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onResizePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const { w: sw, h: sh } = rectRef.current
    const move = (ev: PointerEvent) => {
      const dw = ev.clientX - startX
      const dh = ev.clientY - startY
      setRect((prev) =>
        clampRect({
          ...prev,
          w: sw + dw,
          h: sh + dh,
        })
      )
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setRect((prev) => {
        const c = clampRect(prev)
        persist(c)
        return c
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  if (!mounted || !open) return null

  const panel = (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={title}
      className={cn(
        'fixed flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl',
        'ring-1 ring-black/10'
      )}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        zIndex: 1160,
      }}
    >
      <header
        className="flex shrink-0 cursor-grab select-none items-center gap-2 border-b border-slate-200 bg-slate-100 px-2 py-2 active:cursor-grabbing"
        onPointerDown={onHeaderPointerDown}
      >
        <GripVertical className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{title}</span>
        <span className="hidden text-[10px] text-slate-500 sm:inline">
          {uiLocaleEn ? 'Drag title bar to move' : '제목 줄을 드래그해 이동'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={uiLocaleEn ? 'Close preview' : '미리보기 닫기'}
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={(ev) => {
            ev.stopPropagation()
            onOpenChange(false)
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-2">{children}</div>
      <div
        aria-label={uiLocaleEn ? 'Resize preview window' : '창 크기 조절'}
        className="absolute bottom-0 right-0 h-5 w-5 cursor-se-resize touch-none bg-gradient-to-br from-transparent via-transparent to-slate-300/60"
        onPointerDown={onResizePointerDown}
      />
    </div>
  )

  return createPortal(panel, document.body)
}
