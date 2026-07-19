'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { useOperator } from '@/contexts/OperatorContext'
import { isOperationsModuleAdminPath } from '@/lib/operators/opsModulePaths'

/**
 * When Operations module is OFF, block direct URL access to Ops Suite pages
 * (sidebar already hides them — Phase 6a.1).
 */
export default function OpsModuleRouteGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const locale = useLocale()
  const { operationsEnabled, loading } = useOperator()

  useEffect(() => {
    if (loading) return
    if (operationsEnabled) return
    if (!isOperationsModuleAdminPath(pathname, locale)) return
    router.replace(`/${locale}/admin/operator-b/manual?ops_blocked=1`)
  }, [loading, operationsEnabled, pathname, locale, router])

  if (
    !loading &&
    !operationsEnabled &&
    isOperationsModuleAdminPath(pathname, locale)
  ) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-muted-foreground">
        Redirecting…
      </div>
    )
  }

  return <>{children}</>
}
