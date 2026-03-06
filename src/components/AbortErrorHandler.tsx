'use client'

import { useEffect } from 'react'

/**
 * Next.js / fetch 등에서 요청이 중단될 때 발생하는 AbortError를
 * unhandledrejection에서 무시해 콘솔에 불필요한 에러가 나오지 않도록 합니다.
 */
export default function AbortErrorHandler() {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const name = reason?.name ?? (reason as Error)?.constructor?.name
      const msg = typeof (reason as Error)?.message === 'string' ? (reason as Error).message : ''
      const isAbort =
        name === 'AbortError' ||
        msg.includes('aborted') ||
        msg.includes('signal is aborted')
      if (isAbort) {
        event.preventDefault()
      }
    }
    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [])
  return null
}
