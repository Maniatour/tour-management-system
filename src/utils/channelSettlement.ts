/**
 * PricingSection「채널 결제 금액」「채널 정산 금액」과 동일한 산식.
 * DB `reservation_pricing.channel_settlement_amount` 저장·통계 표시에 공통 사용.
 *
 * DB `commission_base_price`는 Returned 차감 **후** 금액(UI「채널 결제 금액」과 동일).
 * 이 모듈의 `onlinePaymentAmount` 인자는 산식용 **gross**(보통 폼의 `onlinePaymentAmount`).
 */

export type ChannelSettlementComputeInput = {
  depositAmount: number
  /** 채널 결제 gross — 폼 `onlinePaymentAmount` 우선. DB `commission_base_price`는 net이므로 복원 시 `deriveCommissionGrossForSettlement` 사용 */
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
  /** payment_records Partner Received 합계. OTA에서 commission_base가 과대(옵션 포함 등)일 때 실제 입금 기준으로 상한 */
  partnerReceivedAmount?: number
  commissionAmount: number
  reservationStatus?: string | null
  isOTAChannel: boolean
}

function toN(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const GROSS_NET_EPS = 0.02

/**
 * DB·폼에 남아 있는 `commission_base_price`가 net(신규)인지 gross(기존 행)인지에 따라
 * `computeChannelSettlementAmount`에 넣을 gross를 복원한다.
 */
export function deriveCommissionGrossForSettlement(
  storedCommissionBase: number,
  ctx: {
    returnedAmount: number
    depositAmount: number
    productPriceTotal: number
    isOTAChannel: boolean
  }
): number {
  const cb = toN(storedCommissionBase)
  const ret = toN(ctx.returnedAmount)
  const dep = toN(ctx.depositAmount)
  const ppt = toN(ctx.productPriceTotal)
  const otaLike = ctx.isOTAChannel || dep > 0
  if (!otaLike || ret < GROSS_NET_EPS) return cb

  const sum = cb + ret
  const sumMatchesDep = Math.abs(sum - dep) < GROSS_NET_EPS
  const sumMatchesPpt = Math.abs(sum - ppt) < GROSS_NET_EPS
  if (sumMatchesDep || sumMatchesPpt) return sum

  const cbMatchesDep = Math.abs(cb - dep) < GROSS_NET_EPS
  const cbMatchesPpt = Math.abs(cb - ppt) < GROSS_NET_EPS
  const cbLooksLikeFullProduct = cb >= ppt - GROSS_NET_EPS
  if (cbMatchesDep || cbMatchesPpt || cbLooksLikeFullProduct) return cb

  return sum
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
  let pay = computeChannelPaymentAfterReturn(inp)
  const pr = toN(inp.partnerReceivedAmount)
  if (inp.isOTAChannel && pr > 0 && pay > pr + 0.005) {
    pay = pr
  }
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
 * OTA이고 Partner Received 입금이 있으면 commission_base·저장값이 옵션까지 포함해 과대인 경우가 있어, 항상 동일 산식(입금 상한)으로 맞춘다.
 */
export function resolveChannelSettlementForReport(
  pricing: ReservationPricingLike,
  ctx: {
    reservationStatus: string
    isOTAChannel: boolean
    returnedAmount: number
    partnerReceivedAmount?: number
  }
): number {
  const partnerReceived = toN(ctx.partnerReceivedAmount)
  const storedCb = toN(pricing.commissionBasePrice)
  const gross = deriveCommissionGrossForSettlement(storedCb, {
    returnedAmount: toN(ctx.returnedAmount),
    depositAmount: toN(pricing.depositAmount),
    productPriceTotal: toN(pricing.productPriceTotal),
    isOTAChannel: ctx.isOTAChannel,
  })
  const recomputed = computeChannelSettlementAmount({
    depositAmount: toN(pricing.depositAmount),
    onlinePaymentAmount: gross,
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
    partnerReceivedAmount: partnerReceived,
    commissionAmount: toN(pricing.commissionAmount),
    reservationStatus: ctx.reservationStatus,
    isOTAChannel: ctx.isOTAChannel,
  })
  if (ctx.isOTAChannel && partnerReceived > 0) {
    return recomputed
  }
  const stored = pricing.channelSettlementAmount
  if (stored != null && stored !== undefined && Number.isFinite(Number(stored))) {
    return Math.max(0, Number(stored))
  }
  return recomputed
}
