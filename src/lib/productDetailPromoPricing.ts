export type AppliedPromoCoupon = {
  code: string
  discount_type: string
  percentage_value: number | null
  fixed_value: number | null
}

export function calculateChoicesAddonTotal(
  totalPrice: number,
  basePrice: number
): number {
  return Math.max(0, totalPrice - basePrice)
}

export function calculatePromoDiscountAmount(
  coupon: AppliedPromoCoupon,
  basePrice: number
): number {
  if (basePrice <= 0) return 0

  if (coupon.discount_type === 'percentage' && coupon.percentage_value) {
    return (basePrice * Number(coupon.percentage_value)) / 100
  }

  if (coupon.discount_type === 'fixed' && coupon.fixed_value) {
    return Math.min(Number(coupon.fixed_value), basePrice)
  }

  if (coupon.fixed_value && coupon.percentage_value) {
    const fixedDiscount = Number(coupon.fixed_value)
    const percentageDiscount =
      ((basePrice - fixedDiscount) * Number(coupon.percentage_value)) / 100
    return fixedDiscount + percentageDiscount
  }

  return 0
}

export function calculatePriceWithPromoDiscount(
  basePrice: number,
  choicesAddonTotal: number,
  discountAmount: number
): number {
  return Math.max(0, basePrice - discountAmount) + choicesAddonTotal
}

export function mapValidatedCoupon(
  coupon: {
    coupon_code?: string | null
    code?: string | null
    discount_type: string
    percentage_value?: number | null
    fixed_value?: number | null
  }
): AppliedPromoCoupon {
  return {
    code: coupon.coupon_code || coupon.code || '',
    discount_type: coupon.discount_type,
    percentage_value: coupon.percentage_value ?? null,
    fixed_value: coupon.fixed_value ?? null,
  }
}
