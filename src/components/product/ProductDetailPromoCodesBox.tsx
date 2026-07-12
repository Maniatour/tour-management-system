'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronRight, Ticket } from 'lucide-react'
import ProductDetailPromoCodesModal from '@/components/product/ProductDetailPromoCodesModal'
import {
  getBestPromoDiscountLabel,
  PRODUCT_DETAIL_PLATFORM_PROMO_CODES,
} from '@/lib/productDetailPromoCodes'
import type { ProductDetailAppliedPromoState } from '@/hooks/useProductDetailAppliedPromo'

type ProductDetailPromoCodesBoxProps = {
  promo: ProductDetailAppliedPromoState
}

export default function ProductDetailPromoCodesBox({ promo }: ProductDetailPromoCodesBoxProps) {
  const t = useTranslations('productDetail')
  const [open, setOpen] = useState(false)
  const badgeLabel = promo.hasPromoApplied
    ? t('promoApplied')
    : getBestPromoDiscountLabel(PRODUCT_DETAIL_PLATFORM_PROMO_CODES)

  const handleRedeem = async (code: string) => {
    promo.clearError()
    const success = await promo.redeemPromo(code)
    if (success) {
      toast.success(t('promoApplied'))
      setOpen(false)
      return
    }
    toast.error(t('promoInvalid'))
  }

  return (
    <>
      <button
        type="button"
        className={`airbnb-detail-promo-box ${promo.hasPromoApplied ? 'is-applied' : ''}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <span className="airbnb-detail-promo-box-title">{t('promoCodesTitle')}</span>
        <span className="airbnb-detail-promo-box-trailing">
          {badgeLabel ? (
            <span className="airbnb-detail-promo-box-badge">
              <Ticket className="h-3.5 w-3.5" aria-hidden />
              {badgeLabel}
            </span>
          ) : null}
          <ChevronRight className="h-4 w-4 shrink-0 text-[#9ca3af]" aria-hidden />
        </span>
      </button>

      <ProductDetailPromoCodesModal
        open={open}
        onOpenChange={setOpen}
        promoCodes={PRODUCT_DETAIL_PLATFORM_PROMO_CODES}
        appliedCode={promo.appliedCoupon?.code ?? null}
        validating={promo.validating}
        error={promo.error}
        onRedeem={handleRedeem}
      />
    </>
  )
}
