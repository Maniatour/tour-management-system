'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useResizableRect } from '@/hooks/useResizableRect'
import { cn } from '@/lib/utils'
import { ResizableModalHandles } from '@/components/ui/ResizableModalHandles'

const MOBILE_MAX_WIDTH = 767

type ResizableModalFrameProps = {
  storageKey: string
  defaultWidth?: number
  defaultHeight?: number
  zIndex: number
  className?: string
  overlayClassName?: string
  draggableHeaderSelector?: string
  /** 이 너비 이하에서는 리사이즈 창 대신 전체 화면으로 표시 */
  fullViewportMaxWidth?: number
  /** true이면 모바일에서 관리자 헤더까지 덮는 전체 화면 */
  coverAdminChromeOnMobile?: boolean
  children: ReactNode
}

export function ResizableModalFrame({
  storageKey,
  defaultWidth = 960,
  defaultHeight = 720,
  zIndex,
  className,
  overlayClassName,
  draggableHeaderSelector = '[data-dialog-drag-handle]',
  fullViewportMaxWidth = MOBILE_MAX_WIDTH,
  coverAdminChromeOnMobile = false,
  children,
}: ResizableModalFrameProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const { rect, onDragPointerDown, onResizePointerDown } = useResizableRect({
    storageKey,
    defaultW: defaultWidth,
    defaultH: defaultHeight,
  })
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${fullViewportMaxWidth}px)`)
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [fullViewportMaxWidth])

  const handleHeaderPointerDown = (e: React.PointerEvent) => {
    if (isMobile || e.button !== 0) return
    const root = panelRef.current
    const target = e.target as HTMLElement
    if (!root || !root.contains(target)) return
    if (!target.closest(draggableHeaderSelector)) return
    if (target.closest('button, a, input, select, textarea, [data-no-drag]')) return
    e.stopPropagation()
    onDragPointerDown(e)
  }

  const effectiveZIndex =
    isMobile && coverAdminChromeOnMobile ? Math.max(zIndex, 10050) : zIndex

  const panelStyle: CSSProperties = isMobile
    ? coverAdminChromeOnMobile
      ? {
          left: 0,
          top: 0,
          width: '100%',
          height: '100dvh',
          maxWidth: 'none',
          maxHeight: 'none',
          zIndex: effectiveZIndex,
        }
      : {
          left: 0,
          top: 'var(--header-height, 4rem)',
          width: '100%',
          height: 'calc(100dvh - var(--header-height, 4rem))',
          maxWidth: 'none',
          maxHeight: 'none',
          zIndex: effectiveZIndex,
        }
    : {
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        maxWidth: 'none',
        maxHeight: 'none',
        zIndex: effectiveZIndex,
      }

  return (
    <>
      <div
        className={cn('reservation-form-modal-overlay fixed inset-0 bg-black/50', overlayClassName)}
        style={{ zIndex: effectiveZIndex }}
        aria-hidden
      />
      <div
        ref={panelRef}
        onPointerDown={handleHeaderPointerDown}
        className={cn(
          'fixed flex flex-col gap-0 overflow-hidden border bg-white shadow-2xl sm:rounded-lg',
          className
        )}
        style={panelStyle}
      >
        {children}
        {!isMobile ? <ResizableModalHandles onResizePointerDown={onResizePointerDown} /> : null}
      </div>
    </>
  )
}
