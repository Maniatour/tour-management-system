'use client'

import { useEffect } from 'react'

function isAbortReason(reason: unknown): boolean {
  if (reason == null) return false
  if (typeof reason === 'string') return reason.toLowerCase().includes('aborted')
  const name = (reason as Error)?.name ?? (reason as { name?: string })?.name
  const msg = typeof (reason as Error)?.message === 'string' ? (reason as Error).message : String((reason as { message?: string })?.message ?? '')
  const str = name + msg + (reason instanceof Error ? reason.message : '')
  return (
    name === 'AbortError' ||
    msg.toLowerCase().includes('aborted') ||
    msg.includes('signal is aborted') ||
    str.toLowerCase().includes('aborted')
  )
}

/**
 * Next.js / fetch 등에서 요청이 중단될 때 발생하는 AbortError를
 * unhandledrejection에서 무시해 콘솔·에러 오버레이에 나오지 않도록 합니다.
 */
export default function AbortErrorHandler() {
  useEffect(() => {
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      if (isAbortReason(event.reason)) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }
    const errorHandler = (event: ErrorEvent) => {
      const msg = event.message ?? event.error?.message ?? ''
      if (msg.includes('aborted') || msg.includes('AbortError') || event.error?.name === 'AbortError') {
        event.preventDefault()
        return true
      }
      return false
    }
    window.addEventListener('unhandledrejection', rejectionHandler, true)
    window.addEventListener('error', errorHandler, true)
    return () => {
      window.removeEventListener('unhandledrejection', rejectionHandler, true)
      window.removeEventListener('error', errorHandler, true)
    }
  }, [])
  return null
}
