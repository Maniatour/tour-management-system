'use client'

import type { ReactNode } from 'react'
import { useCustomerPageGlobalTheme } from '@/hooks/useCustomerPageGlobalTheme'

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

  return (
    <div
      data-cp-global-theme={theme.id}
      data-cp-theme-dark={theme.isDark ? '1' : '0'}
      className={`customer-page-theme-root transition-colors duration-300 ${className}`.trim()}
      style={{
        backgroundColor: theme.pageBackground,
        ['--cp-global-accent' as string]: theme.accentColor,
        ['--cp-global-page-bg' as string]: theme.pageBackground,
      }}
    >
      {children}
    </div>
  )
}
