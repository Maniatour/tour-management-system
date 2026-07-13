'use client'

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import {
  isCouponEligibleForProductDetail,
  mapCouponRowToPromoCode,
  type ProductDetailCouponRow,
  type ProductDetailPromoCode,
} from '@/lib/productDetailPromoCodes'

export function useProductDetailPlatformPromoCodes(productId: string): {
  promoCodes: ProductDetailPromoCode[]
  loading: boolean
} {
  const locale = useLocale()
  const isEnglish = locale === 'en'
  const [promoCodes, setPromoCodes] = useState<ProductDetailPromoCode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!productId) {
      setPromoCodes([])
      setLoading(false)
      return
    }

    let cancelled = false

    void (async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('coupons')
          .select(
            'id, coupon_code, discount_type, percentage_value, fixed_value, description, start_date, end_date, channel_id, product_id, status'
          )
          .eq('status', 'active')
          .order('created_at', { ascending: false })

        if (cancelled) return
        if (error) throw error

        const eligible = ((data ?? []) as ProductDetailCouponRow[]).filter((coupon) =>
          isCouponEligibleForProductDetail(coupon, productId)
        )

        setPromoCodes(eligible.map((coupon) => mapCouponRowToPromoCode(coupon, isEnglish)))
      } catch (error) {
        console.error('[useProductDetailPlatformPromoCodes]', error)
        if (!cancelled) setPromoCodes([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [productId, isEnglish])

  return { promoCodes, loading }
}
