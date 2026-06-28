'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

export function ProductDetailLoadingState() {
  const t = useTranslations('productDetail')
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">{t('loadingProduct')}</p>
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-red-500 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('errorTitle')}</h2>
        <p className="text-gray-600 mb-4">{error || t('productNotFound')}</p>
        <Link
          href={`/${locale}/products`}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('backToProductList')}
        </Link>
      </div>
    </div>
  )
}
