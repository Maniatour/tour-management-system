'use client'

import { useEffect } from 'react'

const CHUNK_RELOAD_KEY = 'tms-dev-chunk-reload-v1'

function isChunkLoadFailure(message: string): boolean {
  return (
    message.includes('Loading chunk') ||
    message.includes('ChunkLoadError') ||
    message.includes('Failed to fetch dynamically imported module')
  )
}

/**
 * next dev: 긴 최초 컴파일·구 SW 캐시로 layout chunk 로드가 타임아웃될 때 1회 자동 새로고침.
 * (React 마운트 전에도 layout 인라인 스크립트가 동일 로직을 실행한다.)
 */
export default function DevBootRecovery() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    try {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY)
    } catch {
      /* ignore */
    }

    const onError = (event: ErrorEvent) => {
      if (document.visibilityState !== 'visible') return
      const message = event.message ?? event.error?.message ?? ''
      if (!isChunkLoadFailure(String(message))) return
      try {
        if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
      } catch {
        /* ignore */
      }
      window.location.reload()
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      if (document.visibilityState !== 'visible') return
      const reason = event.reason
      const message =
        typeof reason === 'string'
          ? reason
          : reason instanceof Error
            ? reason.message
            : String(reason ?? '')
      if (!isChunkLoadFailure(message)) return
      try {
        if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
      } catch {
        /* ignore */
      }
      event.preventDefault()
      window.location.reload()
    }

    window.addEventListener('error', onError, true)
    window.addEventListener('unhandledrejection', onRejection, true)
    return () => {
      window.removeEventListener('error', onError, true)
      window.removeEventListener('unhandledrejection', onRejection, true)
    }
  }, [])

  return null
}

export { CHUNK_RELOAD_KEY }
