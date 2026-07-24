'use client'

import { useTranslations } from 'next-intl'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import PriceDisplay from '@/components/customer/ui/PriceDisplay'
import { Button } from '@/components/ui/button'
import { useCustomerPagePreviewViewport } from '@/contexts/CustomerPagePreviewViewportContext'
import { cn } from '@/lib/utils'

type ProductDetailMobileStickyCtaProps = {
  totalPrice: number
  originalTotalPrice?: number
  onBookNow: () => void
}

export default function ProductDetailMobileStickyCta({
  totalPrice,
  originalTotalPrice,
  onBookNow,
}: ProductDetailMobileStickyCtaProps) {
  const t = useTranslations('productDetail')
  const previewViewport = useCustomerPagePreviewViewport()
  const pinToPreviewFrame = previewViewport === 'mobile'

  return (
    <CustomerPageZone zone="detail-mobile-sticky-cta">
      <div
        className={cn(
          'left-0 right-0 z-50 border-t border-border/60 bg-background/95 px-0 py-2.5 shadow-[0_-4px_20px_rgb(15_23_42/0.08)] backdrop-blur-md sm:px-4 sm:py-3',
          pinToPreviewFrame
            ? 'absolute bottom-0'
            : 'fixed bottom-[var(--footer-height)]'
        )}
        role="region"
        aria-label={t('bookingCtaRegion')}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-[var(--customer-mobile-inset,0.75rem)] sm:px-4">
          <div className="min-w-0 flex-1">
            {originalTotalPrice != null && originalTotalPrice !== totalPrice ? (
              <p className="text-xs text-muted-foreground line-through">${originalTotalPrice}</p>
            ) : null}
            <PriceDisplay
              amount={totalPrice}
              prefixLabel={t('fromPrice')}
              suffixLabel={t('perPerson')}
              size="md"
            />
          </div>
          <Button
            type="button"
            variant="booking"
            size="booking"
            className="shrink-0"
            onClick={onBookNow}
          >
            {t('bookNow')}
          </Button>
        </div>
      </div>
    </CustomerPageZone>
  )
}
