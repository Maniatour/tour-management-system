import { roundUsd2 } from '@/utils/pricingSectionDisplay'

/** PricingSection `calculateTotalCustomerPaymentGross` 와 동일한 스냅샷 산식 */
export function computePricingSectionCustomerPaymentGrossLike(params: {
  status?: string | null
  productPriceTotal: number
  couponDiscount: number
  additionalDiscount: number
  reservationOptionsTotalUsd: number
  notIncludedTotalUsd: number
  additionalCost: number
  tax: number
  cardFee: number
  prepaymentCost: number
  prepaymentTip: number
}): number {
  const cancelled =
    params.status != null &&
    ['cancelled', 'canceled'].includes(String(params.status).toLowerCase().trim())
  const discountedProductPrice =
    params.productPriceTotal - params.couponDiscount - params.additionalDiscount
  const optionsTotal = cancelled ? 0 : params.reservationOptionsTotalUsd || 0
  const notIncludedPrice = cancelled ? 0 : params.notIncludedTotalUsd || 0
  return roundUsd2(
    discountedProductPrice +
      optionsTotal +
      notIncludedPrice +
      (params.additionalCost || 0) +
      (params.tax || 0) +
      (params.cardFee || 0) +
      (params.prepaymentCost || 0) +
      (params.prepaymentTip || 0)
  )
}

/** PricingSection `calculateTotalCustomerPayment` (Returned 차감 후) */
export function computePricingSectionCustomerPaymentNet(gross: number, returnedAmount: number): number {
  const ret = Math.max(0, Number(returnedAmount) || 0)
  return Math.max(0, roundUsd2(gross - ret))
}
