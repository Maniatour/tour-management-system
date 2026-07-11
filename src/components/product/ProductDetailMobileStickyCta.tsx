'use client'

import { useTranslations } from 'next-intl'
import CustomerPageZone from '@/components/product/CustomerPageZone'

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
        className="fixed bottom-[var(--footer-height)] left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-3 py-2.5 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] backdrop-blur-md sm:px-4 sm:py-3"
        role="region"
        aria-label={t('bookingCtaRegion')}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">{t('fromPrice')}</p>
            <p className="text-lg font-bold text-slate-900 sm:text-xl">
              ${totalPrice}
              <span className="ml-1 text-xs font-medium text-slate-500 sm:text-sm">{t('perPerson')}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onBookNow}
            className="shrink-0 rounded-xl bg-[#0B5FFF] px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#0952e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5FFF] focus-visible:ring-offset-2 sm:px-6 sm:py-3.5 sm:shadow-lg"
          >
            {t('bookNow')}
          </button>
        </div>
      </div>
    </CustomerPageZone>
  )
}
