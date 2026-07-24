'use client'

import ProductDetailPageContent from '@/components/product/ProductDetailPageContent'
import { CustomerPagePreviewViewportProvider } from '@/contexts/CustomerPagePreviewViewportContext'
import type { SiteLocale } from '@/lib/siteLocales'

type PreviewViewport = 'desktop' | 'mobile'

type AdminProductCustomerPreviewPanelProps = {
  productId: string
  previewLocale: SiteLocale
  previewViewport: PreviewViewport
}

export default function AdminProductCustomerPreviewPanel({
  productId,
  previewLocale,
  previewViewport,
}: AdminProductCustomerPreviewPanelProps) {
  const isMobilePreview = previewViewport === 'mobile'

  return (
    <CustomerPagePreviewViewportProvider viewport={previewViewport}>
      <div
        className={`min-h-0 flex-1 overflow-y-auto ${
          isMobilePreview ? 'bg-slate-200 px-4 py-6' : 'bg-background'
        }`}
      >
        <div
          className={
            isMobilePreview
              ? 'customer-page-preview-mobile-frame relative mx-auto w-full max-w-[390px] overflow-x-hidden rounded-[2rem] border-[10px] border-gray-900 bg-white shadow-2xl'
              : 'w-full'
          }
          data-cp-preview-viewport={isMobilePreview ? 'mobile' : undefined}
        >
          <ProductDetailPageContent
            productId={productId}
            contentLocale={previewLocale}
            enableCheckout={false}
            forceShowOptions
          />
        </div>
      </div>
    </CustomerPagePreviewViewportProvider>
  )
}
