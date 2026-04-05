/**
 * PricingSection「채널 결제 금액」「채널 정산 금액」과 동일한 산식.
 * DB `reservation_pricing.channel_settlement_amount` 저장·통계 표시에 공통 사용.
 */

export type ChannelSettlementComputeInput = {
  depositAmount: number
  /** commission_base_price / onlinePaymentAmount (채널 결제 gross) */
  onlinePaymentAmount: number
  productPriceTotal: number
  couponDiscount: number
  additionalDiscount: number
  /** reservation_options 합 또는 option_total */
  optionTotalSum: number
  additionalCost: number
  tax: number
  cardFee: number
  prepaymentTip: number
  onSiteBalanceAmount: number
  /** payment_records Returned 합계(앱과 동일하게 부호 그대로 합산) */
  returnedAmount: number
  commissionAmount: number
  reservationStatus?: string | null
  isOTAChannel: boolean
}

function toN(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** 채널 결제(표시) = gross − Returned (gross는 분기별 base) */
export function computeChannelPaymentAfterReturn(inp: ChannelSettlementComputeInput): number {
  const depositAmount = toN(inp.depositAmount)
  const onlinePaymentAmount = toN(inp.onlinePaymentAmount)
  const productPriceTotal = toN(inp.productPriceTotal)
  const couponDiscount = toN(inp.couponDiscount)
  const additionalDiscount = toN(inp.additionalDiscount)
  const optionTotalSum = toN(inp.optionTotalSum)
  const additionalCost = toN(inp.additionalCost)
  const tax = toN(inp.tax)
  const cardFee = toN(inp.cardFee)
  const prepaymentTip = toN(inp.prepaymentTip)
  const onSiteBalanceAmount = toN(inp.onSiteBalanceAmount)
  const returnedAmount = toN(inp.returnedAmount)

  const discountedProductPrice = productPriceTotal - couponDiscount - additionalDiscount
  const otaChannelProductPaymentGross =
    couponDiscount > 0 ? Math.max(0, discountedProductPrice) : productPriceTotal

  if (depositAmount > 0) {
    const base = onlinePaymentAmount || depositAmount
    return Math.max(0, base - returnedAmount)
  }
  if (inp.isOTAChannel) {
    const base =
      onlinePaymentAmount ||
      depositAmount ||
      (otaChannelProductPaymentGross > 0 ? otaChannelProductPaymentGross : 0)
    return Math.max(0, base - returnedAmount)
  }
  const productSubtotal =
    productPriceTotal -
    couponDiscount +
    optionTotalSum +
    (additionalCost - additionalDiscount) +
    tax +
    cardFee +
    prepaymentTip -
    onSiteBalanceAmount
  const base = onlinePaymentAmount || (productSubtotal > 0 ? productSubtotal : 0)
  return Math.max(0, base - returnedAmount)
}

/** 채널 정산 금액 = 채널 결제(표시) − 수수료$ (취소 예약은 수수료 0) */
export function computeChannelSettlementAmount(inp: ChannelSettlementComputeInput): number {
  const st = String(inp.reservationStatus ?? '')
    .toLowerCase()
    .trim()
  const cancelled = st === 'cancelled' || st === 'canceled'
  const effectiveCommission = cancelled ? 0 : toN(inp.commissionAmount)
  const pay = computeChannelPaymentAfterReturn(inp)
  return Math.max(0, pay - effectiveCommission)
}

export type ReservationPricingLike = {
  channelSettlementAmount?: number | null
  commissionBasePrice?: number | null
  productPriceTotal?: number
  couponDiscount?: number
  additionalDiscount?: number
  optionTotal?: number
  additionalCost?: number
  tax?: number
  cardFee?: number
  prepaymentTip?: number
  depositAmount?: number
  balanceAmount?: number
  commissionAmount?: number
}

/**
 * 통계 등: DB에 저장된 값이 있으면 우선, 없으면 동일 산식으로 계산.
 */
export function resolveChannelSettlementForReport(
  pricing: ReservationPricingLike,
  ctx: {
    reservationStatus: string
    isOTAChannel: boolean
    returnedAmount: number
  }
): number {
  const stored = pricing.channelSettlementAmount
  if (stored != null && stored !== undefined && Number.isFinite(Number(stored))) {
    return Math.max(0, Number(stored))
  }
  const online = toN(pricing.commissionBasePrice)
  return computeChannelSettlementAmount({
    depositAmount: toN(pricing.depositAmount),
    onlinePaymentAmount: online,
    productPriceTotal: toN(pricing.productPriceTotal),
    couponDiscount: toN(pricing.couponDiscount),
    additionalDiscount: toN(pricing.additionalDiscount),
    optionTotalSum: toN(pricing.optionTotal),
    additionalCost: toN(pricing.additionalCost),
    tax: toN(pricing.tax),
    cardFee: toN(pricing.cardFee),
    prepaymentTip: toN(pricing.prepaymentTip),
    onSiteBalanceAmount: toN(pricing.balanceAmount),
    returnedAmount: toN(ctx.returnedAmount),
    commissionAmount: toN(pricing.commissionAmount),
    reservationStatus: ctx.reservationStatus,
    isOTAChannel: ctx.isOTAChannel,
  })
}
