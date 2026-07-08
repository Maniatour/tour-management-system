'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useResizableRect } from '@/hooks/useResizableRect'
import { cn } from '@/lib/utils'
import type { ResizeHandle } from '@/lib/resizableRect'

const MOBILE_MAX_WIDTH = 767

const HANDLE_CLASS: Record<ResizeHandle, string> = {
  n: 'top-0 left-2 right-2 h-1.5 cursor-n-resize',
  s: 'bottom-0 left-2 right-2 h-1.5 cursor-s-resize',
  e: 'right-0 top-2 bottom-2 w-1.5 cursor-e-resize',
  w: 'left-0 top-2 bottom-2 w-1.5 cursor-w-resize',
  ne: 'top-0 right-0 h-3 w-3 cursor-ne-resize',
  nw: 'top-0 left-0 h-3 w-3 cursor-nw-resize',
  se: 'bottom-0 right-0 h-3 w-3 cursor-se-resize',
  sw: 'bottom-0 left-0 h-3 w-3 cursor-sw-resize',
}

type Props = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  storageKey?: string
  defaultWidth?: number
  defaultHeight?: number
  draggableHeaderSelector?: string
  hideCloseButton?: boolean
  overlayClassName?: string
}

const ResizableDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  Props
>(
  (
    {
      className,
      children,
      storageKey = 'resizable-dialog-rect',
      defaultWidth = 960,
      defaultHeight = 720,
      draggableHeaderSelector = '[data-dialog-drag-handle]',
      hideCloseButton,
      overlayClassName,
      ...props
    },
    ref
  ) => {
    const { rect, onDragPointerDown, onResizePointerDown } = useResizableRect({
      storageKey,
      defaultW: defaultWidth,
      defaultH: defaultHeight,
    })
    const [isMobile, setIsMobile] = React.useState(false)

    React.useEffect(() => {
      const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`)
      const sync = () => setIsMobile(mq.matches)
      sync()
      mq.addEventListener('change', sync)
      return () => mq.removeEventListener('change', sync)
    }, [])

    const handleHeaderPointerDown = (e: React.PointerEvent) => {
      if (isMobile) return
      const target = e.target as HTMLElement
      if (!target.closest(draggableHeaderSelector)) return
      onDragPointerDown(e)
    }

    const contentStyle: React.CSSProperties = isMobile
      ? {
          left: 0,
          top: 0,
          width: '100%',
          height: '100dvh',
          maxWidth: 'none',
          maxHeight: 'none',
          transform: 'none',
        }
      : {
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          maxWidth: 'none',
          maxHeight: 'none',
          transform: 'none',
        }

    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[1100] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            overlayClassName
          )}
        />
        <DialogPrimitive.Content
          ref={ref}
          aria-describedby={undefined}
          onPointerDown={handleHeaderPointerDown}
          className={cn(
            'fixed z-[1100] flex flex-col gap-0 overflow-hidden border bg-white p-0 shadow-2xl duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 max-md:rounded-none sm:rounded-lg',
            className
          )}
          style={contentStyle}
          {...props}
        >
          {children}
          {!isMobile
            ? (Object.keys(HANDLE_CLASS) as ResizeHandle[]).map((handle) => (
                <div
                  key={handle}
                  aria-hidden
                  className={cn('absolute touch-none', HANDLE_CLASS[handle])}
                  onPointerDown={onResizePointerDown(handle)}
                />
              ))
            : null}
          {!hideCloseButton ? (
            <DialogPrimitive.Close className="absolute right-4 top-4 z-20 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    )
  }
)
ResizableDialogContent.displayName = 'ResizableDialogContent'

export { ResizableDialogContent }
