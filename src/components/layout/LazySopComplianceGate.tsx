'use client'

import dynamic from 'next/dynamic'

const SopComplianceGate = dynamic(() => import('@/components/sop/SopComplianceGate'), {
  ssr: false,
})

/** 직원 SOP·계약 게이트 — 초기 JS 번들에서 분리 */
export default function LazySopComplianceGate() {
  return <SopComplianceGate />
}
