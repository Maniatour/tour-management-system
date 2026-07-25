'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  calculatePerPersonPrice,
  calculatePromoDiscountAmount,
  calculateSubtotalAfterPromoDiscount,
  mapValidatedCoupon,
  type AppliedPromoCoupon,
} from '@/lib/productDetailPromoPricing'

export function useProductDetailAppliedPromo(
  productId: string,
  basePrice: number | null,
  totalPrice: number,
  partySize = 1
) {
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedPromoCoupon | null>(null)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const normalizedBasePrice = basePrice ?? 0
  const effectivePartySize = Math.max(1, partySize)
  const totalBasePrice = normalizedBasePrice * effectivePartySize
  const subtotal = totalPrice

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0
    return calculatePromoDiscountAmount(appliedCoupon, subtotal)
  }, [appliedCoupon, subtotal])

  const displayTotalPrice = useMemo(
    () => calculateSubtotalAfterPromoDiscount(subtotal, discountAmount),
    [subtotal, discountAmount]
  )

  const perPersonPrice = useMemo(
    () => calculatePerPersonPrice(displayTotalPrice, effectivePartySize),
    [displayTotalPrice, effectivePartySize]
  )

  const clearError = useCallback(() => setError(null), [])

  const redeemPromo = useCallback(
    async (couponCode: string) => {
      const trimmed = couponCode.trim()
      if (!trimmed) return false

      setValidating(true)
      setError(null)

      try {
        const response = await fetch('/api/coupons/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            couponCode: trimmed,
            totalAmount: subtotal,
            productIds: [productId],
          }),
        })

        const data = await response.json()

        if (!response.ok || !data.valid || !data.coupon) {
          setAppliedCoupon(null)
          setError(data.error || data.message || 'invalid')
          return false
        }

        setAppliedCoupon(mapValidatedCoupon(data.coupon))
        return true
      } catch {
        setAppliedCoupon(null)
        setError('request_failed')
        return false
      } finally {
        setValidating(false)
      }
    },
    [subtotal, productId]
  )

  const clearPromo = useCallback(() => {
    setAppliedCoupon(null)
    setError(null)
  }, [])

  return {
    appliedCoupon,
    discountAmount,
    displayTotalPrice,
    perPersonPrice,
    totalBasePrice,
    subtotal,
    originalTotalPrice: totalPrice,
    hasPromoApplied: Boolean(appliedCoupon),
    validating,
    error,
    redeemPromo,
    clearPromo,
    clearError,
  }
}

export type ProductDetailAppliedPromoState = ReturnType<typeof useProductDetailAppliedPromo>
