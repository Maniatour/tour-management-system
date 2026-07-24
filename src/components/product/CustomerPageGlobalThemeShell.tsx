'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useCustomerPageGlobalTheme } from '@/hooks/useCustomerPageGlobalTheme'
import { useCustomerPageFieldBindings } from '@/components/product/CustomerPageFieldBindingsProvider'
import { siteLocalePathTest } from '@/lib/siteLocales'

type CustomerPageGlobalThemeShellProps = {
  children: ReactNode
  className?: string
}

/** 고객 페이지 전체 배경·테마 CSS 변수 */
export default function CustomerPageGlobalThemeShell({
  children,
  className = '',
}: CustomerPageGlobalThemeShellProps) {
  const theme = useCustomerPageGlobalTheme()
  const pathname = usePathname()
  const { ready } = useCustomerPageFieldBindings()
  const isCustomerHome = siteLocalePathTest(pathname, '/?$')
  const isCustomerProductDetail = siteLocalePathTest(pathname, '/products/[^/]+/?$')
  const pageBackground =
    isCustomerHome || isCustomerProductDetail ? '#ffffff' : theme.pageBackground

  return (
    <div
      data-cp-global-theme={theme.id}
      data-cp-theme-dark={theme.isDark ? '1' : '0'}
      className={`customer-page-theme-root ${ready || !isCustomerHome ? 'transition-colors duration-300' : ''} ${className}`.trim()}
      style={{
        backgroundColor: pageBackground,
        ['--cp-global-accent' as string]: theme.accentColor,
        ['--cp-global-page-bg' as string]: pageBackground,
      }}
    >
      {children}
    </div>
  )
}
