/**
 * 투어별 재무 통계 계산 (서버/클라이언트 공용)
 * 사전 조회된 데이터만 사용하며 DB 호출 없음.
 */
export type ReservationPricingRow = {
  reservation_id: string
  total_price?: number | null
  product_price_total?: number | null
  option_total?: number | null
  choices_total?: number | null
  coupon_discount?: number | null
  additional_discount?: number | null
  additional_cost?: number | null
  not_included_price?: number | null
  card_fee?: number | null
  prepayment_tip?: number | null
  commission_amount?: number | null
  commission_percent?: number | null
}

export function calculateNetPrice(
  pricing: ReservationPricingRow | null,
  reservationId: string,
  reservationChannels: Record<string, { commission_base_price_only?: boolean }>
): number {
  if (!pricing || !pricing.total_price) return 0
  const grandTotal = pricing.total_price
  const channel = reservationChannels[reservationId]
  const commissionBasePriceOnly = channel?.commission_base_price_only || false
  let commissionAmount = 0
  if (pricing.commission_amount && pricing.commission_amount > 0) {
    commissionAmount = pricing.commission_amount
  } else if (pricing.commission_percent && pricing.commission_percent > 0) {
    if (commissionBasePriceOnly) {
      const productPriceTotal = pricing.product_price_total || 0
      const couponDiscount = pricing.coupon_discount || 0
      const additionalDiscount = pricing.additional_discount || 0
      const additionalCost = pricing.additional_cost || 0
      const basePriceForCommission = productPriceTotal - couponDiscount - additionalDiscount + additionalCost
      commissionAmount = basePriceForCommission * (pricing.commission_percent / 100)
    } else {
      commissionAmount = grandTotal * (pricing.commission_percent / 100)
    }
  }
  return grandTotal - commissionAmount
}

export function calculateTotalCustomerPayment(pricing: ReservationPricingRow | null): number {
  if (!pricing) return 0
  const productPriceTotal = pricing.product_price_total || 0
  const couponDiscount = pricing.coupon_discount || 0
  const additionalDiscount = pricing.additional_discount || 0
  const additionalCost = pricing.additional_cost || 0
  const optionTotal = pricing.option_total || 0
  const choicesTotal = pricing.choices_total || 0
  const cardFee = pricing.card_fee || 0
  const prepaymentTip = pricing.prepayment_tip || 0
  return (
    (productPriceTotal - couponDiscount - additionalDiscount) +
    optionTotal +
    choicesTotal +
    additionalCost +
    cardFee +
    prepaymentTip
  )
}

export function calculateAdditionalPayment(
  pricing: ReservationPricingRow | null,
  reservationId: string,
  reservationChannels: Record<string, { commission_base_price_only?: boolean }>
): number {
  if (!pricing) return 0
  const totalCustomerPayment = calculateTotalCustomerPayment(pricing)
  const commissionAmount = pricing.commission_amount || 0
  const netPrice = calculateNetPrice(pricing, reservationId, reservationChannels)
  const additionalPayment = totalCustomerPayment - commissionAmount - netPrice
  return Math.max(0, additionalPayment)
}

export function calculateOperatingProfit(
  pricing: ReservationPricingRow | null,
  reservationId: string,
  reservationExpenses: Record<string, number>,
  reservationChannels: Record<string, { commission_base_price_only?: boolean }>
): number {
  if (!pricing) return 0
  const netPrice = calculateNetPrice(pricing, reservationId, reservationChannels)
  const reservationExpense = reservationExpenses[reservationId] || 0
  const additionalPayment = calculateAdditionalPayment(pricing, reservationId, reservationChannels)
  return netPrice - reservationExpense + additionalPayment
}
