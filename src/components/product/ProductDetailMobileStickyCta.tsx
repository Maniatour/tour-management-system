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
        className="fixed bottom-[var(--footer-height)] left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur-md"
        role="region"
        aria-label={t('bookingCtaRegion')}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">{t('fromPrice')}</p>
            <p className="text-xl font-bold text-slate-900">
              ${totalPrice}
              <span className="ml-1 text-sm font-medium text-slate-500">{t('perPerson')}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onBookNow}
            className="shrink-0 rounded-xl bg-[#0B5FFF] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-[#0952e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5FFF] focus-visible:ring-offset-2"
          >
            {t('bookNow')}
          </button>
        </div>
      </div>
    </CustomerPageZone>
  )
}
