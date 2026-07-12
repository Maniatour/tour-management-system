'use client'

import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ProductDetailPromoCode } from '@/lib/productDetailPromoCodes'

type ProductDetailPromoCodesModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  promoCodes: ProductDetailPromoCode[]
  appliedCode: string | null
  validating: boolean
  error: string | null
  onRedeem: (code: string) => Promise<void>
}

export default function ProductDetailPromoCodesModal({
  open,
  onOpenChange,
  promoCodes,
  appliedCode,
  validating,
  error,
  onRedeem,
}: ProductDetailPromoCodesModalProps) {
  const t = useTranslations('productDetail')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="airbnb-detail-promo-modal max-w-md rounded-2xl p-0 sm:max-w-md">
        <DialogHeader className="border-b border-[#e5e7eb] px-5 pb-4 pt-5 text-left">
          <DialogTitle className="text-xl font-bold text-[#1a2b49]">
            {t('promoCodesTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 pt-4">
          <h3 className="mb-3 text-base font-bold text-[#1a2b49]">
            {t('platformPromoCodesTitle')}
          </h3>

          {error ? (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {t('promoInvalid')}
            </p>
          ) : null}

          <div className="space-y-3">
            {promoCodes.map((promo) => {
              const isApplied = appliedCode?.toLowerCase() === promo.code.toLowerCase()
              return (
                <div
                  key={promo.id}
                  className={`airbnb-detail-promo-ticket ${isApplied ? 'is-applied' : ''}`}
                >
                  <div className="airbnb-detail-promo-ticket-main">
                    <p className="airbnb-detail-promo-ticket-title">{t(promo.titleKey)}</p>
                    <p className="airbnb-detail-promo-ticket-code">
                      {t('promoCodeLabel', { code: promo.code })}
                    </p>
                  </div>

                  <div className="airbnb-detail-promo-ticket-action">
                    <p className="airbnb-detail-promo-ticket-discount">{promo.discountPercent}% off</p>
                    <p className="airbnb-detail-promo-ticket-min">{t('promoNoMinSpend')}</p>
                    <button
                      type="button"
                      className="airbnb-detail-promo-redeem-btn"
                      disabled={validating || isApplied}
                      onClick={() => void onRedeem(promo.code)}
                    >
                      {isApplied
                        ? t('promoAppliedShort')
                        : validating
                          ? t('promoRedeeming')
                          : t('promoRedeem')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
