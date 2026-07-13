'use client'

import { Loader2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatPromoDiscountLabel, type ProductDetailPromoCode } from '@/lib/productDetailPromoCodes'

type ProductDetailPromoCodesModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  promoCodes: ProductDetailPromoCode[]
  loading?: boolean
  appliedCode: string | null
  validating: boolean
  error: string | null
  onRedeem: (code: string) => Promise<void>
}

export default function ProductDetailPromoCodesModal({
  open,
  onOpenChange,
  promoCodes,
  loading = false,
  appliedCode,
  validating,
  error,
  onRedeem,
}: ProductDetailPromoCodesModalProps) {
  const t = useTranslations('productDetail')
  const locale = useLocale()
  const isEnglish = locale === 'en'

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

          {loading ? (
            <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              <span>{isEnglish ? 'Loading coupons…' : '쿠폰 불러오는 중…'}</span>
            </div>
          ) : promoCodes.length === 0 ? (
            <p className="rounded-lg border border-border/60 bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              {isEnglish
                ? 'No coupons are available for this tour right now.'
                : '현재 이 투어에 사용할 수 있는 쿠폰이 없습니다.'}
            </p>
          ) : (
            <div className="space-y-3">
              {promoCodes.map((promo) => {
                const isApplied = appliedCode?.toLowerCase() === promo.code.toLowerCase()
                const discountLabel = formatPromoDiscountLabel(promo, isEnglish)
                return (
                  <div
                    key={promo.id}
                    className={`airbnb-detail-promo-ticket ${isApplied ? 'is-applied' : ''}`}
                  >
                    <div className="airbnb-detail-promo-ticket-main">
                      <p className="airbnb-detail-promo-ticket-title">{promo.title}</p>
                      <p className="airbnb-detail-promo-ticket-code">
                        {t('promoCodeLabel', { code: promo.code })}
                      </p>
                    </div>

                    <div className="airbnb-detail-promo-ticket-action">
                      {discountLabel ? (
                        <p className="airbnb-detail-promo-ticket-discount">{discountLabel}</p>
                      ) : null}
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
