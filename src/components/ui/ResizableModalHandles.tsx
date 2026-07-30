'use client'

import { cn } from '@/lib/utils'
import type { ResizeHandle } from '@/lib/resizableRect'

export const RESIZABLE_MODAL_HANDLE_CLASS: Record<ResizeHandle, string> = {
  n: 'top-0 left-2 right-2 h-1.5 cursor-n-resize',
  s: 'bottom-0 left-2 right-2 h-1.5 cursor-s-resize',
  e: 'right-0 top-2 bottom-2 w-1.5 cursor-e-resize',
  w: 'left-0 top-2 bottom-2 w-1.5 cursor-w-resize',
  ne: 'top-0 right-0 h-3 w-3 cursor-ne-resize',
  nw: 'top-0 left-0 h-3 w-3 cursor-nw-resize',
  se: 'bottom-0 right-0 z-20 flex h-5 w-5 cursor-nwse-resize items-end justify-end p-0.5 text-gray-400 hover:text-gray-600',
  sw: 'bottom-0 left-0 h-3 w-3 cursor-sw-resize',
}

type ResizableModalHandlesProps = {
  onResizePointerDown: (handle: ResizeHandle) => (e: React.PointerEvent) => void
}

export function ResizableModalHandles({ onResizePointerDown }: ResizableModalHandlesProps) {
  return (
    <>
      {(Object.keys(RESIZABLE_MODAL_HANDLE_CLASS) as ResizeHandle[]).map((handle) => (
        <div
          key={handle}
          aria-hidden
          className={cn('absolute touch-none', RESIZABLE_MODAL_HANDLE_CLASS[handle])}
          onPointerDown={onResizePointerDown(handle)}
        >
          {handle === 'se' ? (
            <svg viewBox="0 0 12 12" className="pointer-events-none h-3 w-3" aria-hidden>
              <path
                d="M11 11L11 6M11 11L6 11M11 11L4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          ) : null}
        </div>
      ))}
    </>
  )
}
