'use client'

import { useTranslations } from 'next-intl'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import PriceDisplay from '@/components/customer/ui/PriceDisplay'
import { Button } from '@/components/ui/button'

type ProductDetailMobileStickyCtaProps = {
  totalPrice: number
  onBookNow: () => void
}

export default function ProductDetailMobileStickyCta({
  totalPrice,
  onBookNow,
}: ProductDetailMobileStickyCtaProps) {
  const t = useTranslations('productDetail')

  return (
    <CustomerPageZone zone="detail-mobile-sticky-cta" className="lg:hidden">
      <div
        className="fixed bottom-[var(--footer-height)] left-0 right-0 z-50 border-t border-border/60 bg-background/95 px-4 py-2.5 shadow-[0_-4px_20px_rgb(15_23_42/0.08)] backdrop-blur-md sm:py-3"
        role="region"
        aria-label={t('bookingCtaRegion')}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <div className="min-w-0 flex-1">
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
