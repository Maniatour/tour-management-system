'use client'

import { Toaster } from 'sonner'

/** 전역 토스트 — 모달(고정 오버레이)보다 위에 보이도록 z-index 지정 */
export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      style={{ zIndex: 100000 }}
      toastOptions={{
        classNames: {
          toast: 'z-[100000]',
        },
      }}
    />
  )
}
