'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  buildPlatformPromoCodesFromMessages,
  type ProductDetailPromoCode,
} from '@/lib/productDetailPromoCodes'

export function useProductDetailPlatformPromoCodes(): ProductDetailPromoCode[] {
  const t = useTranslations('productDetail')

  return useMemo(
    () =>
      buildPlatformPromoCodesFromMessages({
        platformPromoCode: t('platformPromoCode'),
        platformPromoDiscountPercent: t('platformPromoDiscountPercent'),
      }),
    [t]
  )
}
