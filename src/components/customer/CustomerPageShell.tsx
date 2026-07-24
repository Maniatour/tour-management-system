'use client'

import { useEffect, type ReactNode } from 'react'
import CustomerSiteManiaTourFooter from '@/components/customer/CustomerSiteManiaTourFooter'
import { postCustomerPagePreviewHeight } from '@/lib/customerPageEditMessaging'

type CustomerPageShellProps = {
  locale: string
  children: ReactNode
  className?: string
  hideFooter?: boolean
}

function measurePreviewHeight() {
  if (typeof document === 'undefined') return 0
  return Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0)
}

/** 고객-facing 페이지 공통 래퍼 — 본문 + 사이트 푸터 */
export default function CustomerPageShell({
  locale,
  children,
  className = '',
  hideFooter = true,
}: CustomerPageShellProps) {
  const footerBleedClass = 'customer-site-footer-bleed w-full'

  useEffect(() => {
    if (window.parent === window) return

    const notifyOnce = () => {
      const height = measurePreviewHeight()
      if (height > 0) postCustomerPagePreviewHeight(height)
    }

    notifyOnce()
    const delayedTimers = [400, 1200].map((ms) => window.setTimeout(notifyOnce, ms))

    return () => {
      delayedTimers.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  return (
    <div className={`customer-page-shell flex min-h-full flex-col ${className}`.trim()}>
      <div className="flex-1">{children}</div>
      {!hideFooter ? (
        <div className={footerBleedClass} data-customer-site-footer>
          <CustomerSiteManiaTourFooter locale={locale} />
        </div>
      ) : null}
    </div>
  )
}
