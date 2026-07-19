'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { buildRouteStorageKey } from '@/hooks/useRoutePersistedState'

/**
 * Legacy standalone details editor — redirects into the product edit hub
 * (ProductDetailsTab). Locale-aware.
 */
export default function ProductDetailsLegacyRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const locale = (params.locale as string) || 'ko'
  const productId = params.id as string

  useEffect(() => {
    if (!productId) {
      router.replace(`/${locale}/admin/products`)
      return
    }
    const editPath = `/${locale}/admin/products/${productId}`
    try {
      sessionStorage.setItem(
        buildRouteStorageKey(editPath, 'edit-tab'),
        JSON.stringify('details')
      )
    } catch {
      // ignore storage errors
    }
    router.replace(editPath)
  }, [locale, productId, router])

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Redirecting…
    </div>
  )
}
