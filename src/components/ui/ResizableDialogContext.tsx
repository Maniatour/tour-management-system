'use client'

import { createContext, useContext } from 'react'

type ResizableDialogContextValue = {
  onDragHandlePointerDown: (e: React.PointerEvent) => void
  isMobile: boolean
}

export const ResizableDialogContext = createContext<ResizableDialogContextValue | null>(null)

export function useResizableDialogContext() {
  return useContext(ResizableDialogContext)
}
