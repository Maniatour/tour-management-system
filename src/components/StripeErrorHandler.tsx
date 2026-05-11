'use client'

import { useEffect } from 'react'
import { isAbortLikeError } from '@/lib/isAbortLikeError'

/**
 * Stripe 관련 오류 핸들러 컴포넌트
 * r.stripe.com/b 오류는 Stripe의 배너/메시지 리소스 로딩 중 발생하는 것으로,
 * 결제 기능에는 영향을 주지 않으므로 무시합니다.
 */
export default function StripeErrorHandler() {
  useEffect(() => {
    // 전역 Promise rejection 핸들러
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason
      
      // Stripe 배너 리소스 로딩 오류 무시
      if (
        (typeof error === 'object' && error !== null && 'message' in error && 
         (error as any).message?.includes('r.stripe.com/b')) ||
        (typeof error === 'string' && error.includes('r.stripe.com/b')) ||
        (typeof error === 'object' && error !== null && 'stack' in error && 
         (error as any).stack?.includes('r.stripe.com'))
      ) {
        event.preventDefault()
        return
      }
    }

    // 콘솔 경고 필터링 (Stripe.js 관련 경고, AbortError 무시)
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => {
      // 객체 인자는 join 시 [object Object]가 되어 메시지 검사로는 잡히지 않음 — Supabase 등
      if (args.some((a) => isAbortLikeError(a))) return
      const message = args
        .map((a) => (typeof a === 'string' ? a : ''))
        .join(' ')
      // Stripe.js HTTP 경고 무시
      if (
        message.includes('You may test your Stripe.js integration over HTTP') ||
        message.includes('live Stripe.js integrations must use HTTPS') ||
        // aria-hidden 경고 무시 (Stripe Elements Link 기능 관련)
        message.includes('Blocked aria-hidden on an element') ||
        message.includes('because its descendant retained focus')
      ) {
        return
      }
      // AbortError / signal aborted: 동시 요청·페이지 전환 등으로 인한 정상적 취소 → 로그 생략
      if (message.includes('AbortError') || message.includes('signal is aborted')) {
        return
      }
      // next-intl DB 번역 타임아웃 폴백 — 의도된 동작이라 일반 경고로 노출하지 않음
      if (message.includes('[i18n]') && message.includes('translation_values')) {
        return
      }
      originalWarn(...(args as []))
    }

    // 일반 에러 핸들러
    const handleError = (event: ErrorEvent) => {
      const error = event.error
      
      // Stripe 관련 fetch 오류 무시
      if (
        (error?.message?.includes('r.stripe.com/b')) ||
        (error?.message?.includes('Failed to fetch') && error?.stack?.includes('stripe')) ||
        (event.target && (event.target as any).src?.includes('r.stripe.com'))
      ) {
        event.preventDefault()
        if (process.env.NODE_ENV === 'development') {
          console.warn('Stripe 리소스 로딩 실패 (무시됨):', error?.message || event.message)
        }
        return false
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
      // console.warn 복원
      console.warn = originalWarn
    }
  }, [])

  return null
}

