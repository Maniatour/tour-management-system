'use client'

import type { ReactNode } from 'react'

type CustomerPageZoneProps = {
  zone: string
  children: ReactNode
  className?: string
}

/** 고객 페이지 영역 — admin preview=1&highlight= 쿼리로 강조 */
export default function CustomerPageZone({ zone, children, className = '' }: CustomerPageZoneProps) {
  return (
    <div data-customer-zone={zone} className={`customer-page-zone relative ${className}`.trim()}>
      {children}
    </div>
  )
}
