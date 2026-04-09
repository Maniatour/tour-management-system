/**
 * 배정 카드·Balance 봉투 등에서 동일하게 사용하는 잔액 계산
 * (가격 모달의 balance_amount 우선, 없으면 Grand Total − 보증금)
 */

export function pricingFieldToNumber(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') return parseFloat(v) || 0
  return Number(v) || 0
}

export type PartySizeSource = {
  adults?: number | null
  children?: number | null
  infants?: number | null
  child?: number | null
  infant?: number | null
}

/** reservation_pricing 행 또는 API JSON 일부 */
export type PricingBalanceFields = {
  balance_amount?: unknown
  deposit_amount?: unknown
  product_price_total?: unknown
  coupon_discount?: unknown
  additional_discount?: unknown
  option_total?: unknown
  choices_total?: unknown
  not_included_price?: unknown
  additional_cost?: unknown
  tax?: unknown
  card_fee?: unknown
  prepayment_cost?: unknown
  prepayment_tip?: unknown
}

/**
 * Grand Total − 보증금 (reservation_options 합이 있으면 option_total 대신 사용)
 */
export function computeRemainingBalanceAmount(
  pricing: PricingBalanceFields,
  optionsTotalFromOptions: number | null,
  party: PartySizeSource
): number {
  const totalPeople =
    (party.adults || 0) +
    ((party.children ?? party.child) || 0) +
    ((party.infants ?? party.infant) || 0) ||
    1
  const notIncludedTotal = pricingFieldToNumber(pricing.not_included_price) * totalPeople
  const effectiveOpts =
    optionsTotalFromOptions !== null ? optionsTotalFromOptions : pricingFieldToNumber(pricing.option_total)
  const discounted =
    pricingFieldToNumber(pricing.product_price_total) -
    pricingFieldToNumber(pricing.coupon_discount) -
    pricingFieldToNumber(pricing.additional_discount)
  const customerTotal =
    discounted +
    effectiveOpts +
    pricingFieldToNumber(pricing.choices_total) +
    notIncludedTotal +
    pricingFieldToNumber(pricing.additional_cost) +
    pricingFieldToNumber(pricing.tax) +
    pricingFieldToNumber(pricing.card_fee) +
    pricingFieldToNumber(pricing.prepayment_cost) +
    pricingFieldToNumber(pricing.prepayment_tip)
  return Math.max(0, customerTotal - pricingFieldToNumber(pricing.deposit_amount))
}

/** DB 잔액(balance_amount)이 양수면 우선, 아니면 계산 잔액 */
export function getBalanceAmountForDisplay(
  pricing: PricingBalanceFields | null | undefined,
  optionsTotalFromOptions: number | null,
  party: PartySizeSource
): number {
  if (!pricing) return 0
  const stored = pricingFieldToNumber(pricing.balance_amount)
  if (stored > 0) return stored
  return computeRemainingBalanceAmount(pricing, optionsTotalFromOptions, party)
}
