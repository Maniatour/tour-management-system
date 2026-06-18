'use client'

import dynamic from 'next/dynamic'

const StripeErrorHandler = dynamic(
  () => import('@/components/StripeErrorHandler'),
  { ssr: false }
)

/** Stripe.js 콘솔 노이즈 필터 — 초기 페인트와 무관하므로 클라이언트에서만 지연 로드 */
export default function LazyStripeErrorHandler() {
  return <StripeErrorHandler />
}
