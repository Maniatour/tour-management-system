'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import CustomerSiteFooter from '@/components/customer/CustomerSiteFooter'
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
  hideFooter = false,
}: CustomerPageShellProps) {
  const pathname = usePathname()
  const isHome = pathname === `/${locale}` || pathname === `/${locale}/`

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
        isHome ? (
          <div className="w-full" data-customer-site-footer>
            <CustomerSiteManiaTourFooter locale={locale} />
          </div>
        ) : (
          <div className="-mx-4 mt-8 sm:-mx-6 lg:-mx-8" data-customer-site-footer>
            <CustomerSiteFooter locale={locale} forceShow />
          </div>
        )
      ) : null}
    </div>
  )
}
