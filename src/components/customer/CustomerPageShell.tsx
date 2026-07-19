'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import CustomerSiteManiaTourFooter from '@/components/customer/CustomerSiteManiaTourFooter'
import { postCustomerPagePreviewHeight } from '@/lib/customerPageEditMessaging'
import { siteLocalePathTest } from '@/lib/siteLocales'

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

function isFullWidthCustomerFooterPath(pathname: string): boolean {
  return (
    siteLocalePathTest(pathname, '/?$') ||
    siteLocalePathTest(pathname, '/products(/|$)') ||
    siteLocalePathTest(pathname, '/travel-guide(/|$)')
  )
}

/** 고객-facing 페이지 공통 래퍼 — 본문 + 사이트 푸터 */
export default function CustomerPageShell({
  locale,
  children,
  className = '',
  hideFooter = false,
}: CustomerPageShellProps) {
  const pathname = usePathname()
  const footerBleedClass = isFullWidthCustomerFooterPath(pathname)
    ? 'w-full'
    : '-mx-4 w-auto sm:-mx-6 lg:-mx-8'

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
