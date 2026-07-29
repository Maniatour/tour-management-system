'use client'

import { useEffect, type ReactNode } from 'react'
import {
  ADMIN_FLOATING_PANEL_Z_CLASS,
  type FloatingPanelSize,
} from '@/lib/adminFloatingFabLayout'

type AdminFloatingPanelShellProps = {
  isMobile: boolean
  isMinimized?: boolean
  panelOpen: boolean
  position: { x: number; y: number }
  size: FloatingPanelSize
  minSize: FloatingPanelSize
  minimizedHeight?: number
  docked?: boolean
  dockedResizeHandle?: ReactNode
  onMouseDown?: (e: React.MouseEvent) => void
  header: ReactNode
  children: ReactNode
  resizeHandle?: ReactNode
}

export function AdminFloatingPanelShell({
  isMobile,
  isMinimized = false,
  panelOpen,
  position,
  size,
  minSize,
  minimizedHeight = 50,
  docked = false,
  dockedResizeHandle,
  onMouseDown,
  header,
  children,
  resizeHandle,
}: AdminFloatingPanelShellProps) {
  useEffect(() => {
    if (!panelOpen || !isMobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [panelOpen, isMobile])

  if (isMobile) {
    return (
      <div
        className={`fixed inset-0 ${ADMIN_FLOATING_PANEL_Z_CLASS} flex flex-col overflow-hidden bg-white`}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {header}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    )
  }

  if (docked) {
    return (
      <div
        className={`fixed ${ADMIN_FLOATING_PANEL_Z_CLASS} flex flex-col overflow-hidden border-l border-gray-200 bg-white shadow-2xl`}
        style={{
          right: 0,
          top: 'var(--header-height, 4rem)',
          bottom: 0,
          width: size.width,
          minWidth: minSize.width,
          maxWidth: '50vw',
        }}
        onMouseDown={onMouseDown}
      >
        {dockedResizeHandle}
        {header}
        {!isMinimized ? <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div> : null}
      </div>
    )
  }

  if (isMinimized) {
    return (
      <div
        className={`fixed ${ADMIN_FLOATING_PANEL_Z_CLASS} shadow-2xl`}
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: minimizedHeight,
          minWidth: 280,
        }}
        onMouseDown={onMouseDown}
      >
        {header}
      </div>
    )
  }

  return (
    <div
      className={`fixed ${ADMIN_FLOATING_PANEL_Z_CLASS} flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        maxWidth: '92vw',
        maxHeight: '92dvh',
        minWidth: minSize.width,
        minHeight: minSize.height,
      }}
      onMouseDown={onMouseDown}
    >
      {header}
      {children}
      {resizeHandle}
    </div>
  )
}
