'use client'

import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { useResizableDialogContext } from '@/components/ui/ResizableDialogContext'

type DialogDragHandleProps = HTMLAttributes<HTMLDivElement>

export function DialogDragHandle({ children, className, onPointerDown, ...props }: DialogDragHandleProps) {
  const ctx = useResizableDialogContext()

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    onPointerDown?.(e)
    if (e.defaultPrevented) return
    if (!ctx || ctx.isMobile || e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, select, textarea, [data-no-drag]')) return
    e.stopPropagation()
    ctx.onDragHandlePointerDown(e)
  }

  return (
    <div
      data-dialog-drag-handle
      onPointerDown={handlePointerDown}
      className={cn('sm:cursor-grab sm:active:cursor-grabbing', className)}
      {...props}
    >
      {children}
    </div>
  )
}
