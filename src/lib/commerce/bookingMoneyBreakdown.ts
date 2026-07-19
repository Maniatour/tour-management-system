/**
 * Immutable money breakdown snapshot stored on reservations.money_breakdown_json.
 * Past bookings must not re-run the price engine for settlement.
 */

export type BookingMoneyBreakdownV1 = {
  version: 1
  engine: 'commerce_v2' | 'legacy_rpc' | 'catalog_fallback' | 'unknown'
  calculationMethod: string
  channelId: string
  variantKey: string
  tourDate: string
  productId: string
  pax: {
    adults: number
    child: number
    infant: number
  }
  ratePlanId: string | null
  offerId: string | null
  offerCode: string | null
  lines: Array<{
    code: 'base' | 'choices' | 'addons' | 'coupon' | 'total'
    label: string
    amount: number
    couponCode?: string | null
  }>
  subtotal: number
  couponDiscount: number
  total: number
  currency: 'USD'
  createdAt: string
}

export type BuildMoneyBreakdownInput = {
  calculationMethod: string
  channelId: string
  variantKey?: string | null
  tourDate: string
  productId: string
  adults: number
  child: number
  infant: number
  basePrice: number
  choicesPrice: number
  additionalOptionsPrice: number
  subtotal: number
  couponCode: string | null
  couponDiscount: number
  totalPrice: number
  ratePlanId?: string | null
  offerId?: string | null
  offerCode?: string | null
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function inferPricingEngine(
  calculationMethod: string
): BookingMoneyBreakdownV1['engine'] {
  if (calculationMethod.startsWith('commerce_v2')) return 'commerce_v2'
  if (calculationMethod === 'catalog_fallback') return 'catalog_fallback'
  if (
    calculationMethod === 'unknown' ||
    !calculationMethod ||
    calculationMethod === 'not_found'
  ) {
    return 'unknown'
  }
  return 'legacy_rpc'
}

export function buildBookingMoneyBreakdown(
  input: BuildMoneyBreakdownInput
): BookingMoneyBreakdownV1 {
  const lines: BookingMoneyBreakdownV1['lines'] = [
    {
      code: 'base',
      label: 'Base / product',
      amount: roundMoney(input.basePrice),
    },
    {
      code: 'choices',
      label: 'Choices',
      amount: roundMoney(input.choicesPrice),
    },
    {
      code: 'addons',
      label: 'Additional options',
      amount: roundMoney(input.additionalOptionsPrice),
    },
  ]

  if (input.couponDiscount > 0) {
    lines.push({
      code: 'coupon',
      label: 'Coupon discount',
      amount: -roundMoney(input.couponDiscount),
      couponCode: input.couponCode,
    })
  }

  lines.push({
    code: 'total',
    label: 'Total',
    amount: roundMoney(input.totalPrice),
  })

  return {
    version: 1,
    engine: inferPricingEngine(input.calculationMethod),
    calculationMethod: input.calculationMethod,
    channelId: input.channelId,
    variantKey: input.variantKey || 'default',
    tourDate: input.tourDate,
    productId: input.productId,
    pax: {
      adults: Math.max(0, input.adults),
      child: Math.max(0, input.child),
      infant: Math.max(0, input.infant),
    },
    ratePlanId: input.ratePlanId ?? null,
    offerId: input.offerId ?? null,
    offerCode: input.offerCode ?? null,
    lines,
    subtotal: roundMoney(input.subtotal),
    couponDiscount: roundMoney(input.couponDiscount),
    total: roundMoney(input.totalPrice),
    currency: 'USD',
    createdAt: new Date().toISOString(),
  }
}
