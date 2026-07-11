'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

export function ProductDetailLoadingState() {
  const t = useTranslations('productDetail')
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-booking" />
        <p className="text-muted-foreground">{t('loadingProduct')}</p>
      </div>
    </div>
  )
}

type ProductDetailErrorStateProps = {
  error?: string | null
}

export function ProductDetailErrorState({ error }: ProductDetailErrorStateProps) {
  const t = useTranslations('productDetail')
  const locale = useLocale()

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="max-w-md px-6 text-center">
        <div className="mb-4 text-red-500">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-xl font-semibold text-foreground">{t('errorTitle')}</h2>
        <p className="mb-6 text-muted-foreground">{error || t('productNotFound')}</p>
        <Button variant="booking" size="booking" asChild>
          <Link href={`/${locale}/products`}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            {t('backToProductList')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
