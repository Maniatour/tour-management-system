/**
 * PricingSection「채널 결제 금액」「채널 정산 금액」과 동일한 산식.
 * DB `reservation_pricing.channel_settlement_amount` 저장 시 산식과 동일하게 맞추는 용도.
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
const PAY_LINE_EPS = 0.005

/**
 * 「4. 최종 매출」에서 추가할인·추가비용을 다시 넣지 않을지.
 * 채널 결제/정산 산식(`computeChannelPaymentAfterReturn`)의 베이스에 이미 `(additionalCost - additionalDiscount)` 또는
 * 고객 결제 전액(온라인·예치금·commission_base 복원 gross 등)이 반영된 경우 이중 계상됨 — card_fee와 동일 원칙.
 */
export function shouldOmitAdditionalDiscountAndCostFromCompanyRevenueSum(inp: {
  usesStoredChannelSettlement: boolean
  isOTAChannel: boolean
  depositAmount: number
  /** 폼 `onlinePaymentAmount` (0이면 미사용) */
  onlinePaymentAmount: number
  /**
   * PricingSection의 `channelPaymentGrossDb`와 동일: 온라인 결제가 없을 때 정산용 gross(commission_base 등).
   * OTA에서만 고객 결제 총액 추정에 사용.
   */
  channelPaymentGross: number
}): boolean {
  if (inp.usesStoredChannelSettlement) return true

  const dep = toN(inp.depositAmount)
  const onl = toN(inp.onlinePaymentAmount)
  const cg = toN(inp.channelPaymentGross)

  if (!inp.isOTAChannel && dep <= PAY_LINE_EPS) {
    return true
  }

  if (inp.isOTAChannel) {
    const hasCustomerPaymentGross =
      dep > PAY_LINE_EPS || onl > PAY_LINE_EPS || cg > PAY_LINE_EPS
    if (hasCustomerPaymentGross) return true
    return false
  }

  return false
}

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

/**
 * 채널 결제 gross(Returned 차감 전).
 * 자체(비-OTA) 채널은 보증금만 쓰는 조기 분기를 두지 않음 — 추가비용·카드수수료·옵션 등이 베이스에 포함되도록
 * `productSubtotal` 경로와 동일한 산식을 사용한다. (OTA만 예금 우선 조기 분기)
 */
export function computeChannelPaymentGrossBeforeReturn(inp: ChannelSettlementComputeInput): number {
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

  const discountedProductPrice = productPriceTotal - couponDiscount - additionalDiscount
  const otaChannelProductPaymentGross =
    couponDiscount > 0 ? Math.max(0, discountedProductPrice) : productPriceTotal

  if (depositAmount > 0 && inp.isOTAChannel) {
    return Math.max(0, onlinePaymentAmount || depositAmount)
  }
  if (inp.isOTAChannel) {
    const base =
      onlinePaymentAmount ||
      depositAmount ||
      (otaChannelProductPaymentGross > 0 ? otaChannelProductPaymentGross : 0)
    return Math.max(0, base)
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
  return Math.max(0, base)
}

/** 채널 결제(표시) = gross − Returned (gross는 분기별 base) */
export function computeChannelPaymentAfterReturn(inp: ChannelSettlementComputeInput): number {
  const returnedAmount = toN(inp.returnedAmount)
  const gross = computeChannelPaymentGrossBeforeReturn(inp)
  return Math.max(0, gross - returnedAmount)
}

/** 채널 정산 금액 = 채널 결제(표시) − 수수료$ (취소 후에도 플랫폼 부분 정산이 있으면 수수료 $를 직접 입력) */
export function computeChannelSettlementAmount(inp: ChannelSettlementComputeInput): number {
  const effectiveCommission = toN(inp.commissionAmount)
  let pay = computeChannelPaymentAfterReturn(inp)
  const pr = toN(inp.partnerReceivedAmount)
  if (inp.isOTAChannel && pr > 0 && pay > pr + 0.005) {
    pay = pr
  }
  return Math.max(0, pay - effectiveCommission)
}

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * PricingSection「4. 최종 매출 & 운영 이익」의 총 매출(Total Revenue)과 동일한 산식.
 * - OTA: 기준 `channelSettlementBase`(③ 채널 정산) + 옵션·불포함·부가 + 진행 예약 시 폼 카드수수료·선결제 팁(총매출 항목) + 추가할인/추가비용(③에 없을 때 omit 무시)
 * - Self(`revenueFromCustomerPaymentTotal`): 기준 `channelSettlementBase` = ① 고객 총 결제(넷) — 옵션·불포함·세 등은 이중 가산하지 않음
 * - 자체(홈페이지): `excludeHomepageAdditionalCostFromCompanyTotals` 규칙 유지
 */
export type CompanyTotalRevenueInput = {
  channelSettlementBase: number
  isOTAChannel: boolean
  isReservationCancelled: boolean
  reservationOptionsTotalPrice: number
  /** DB not_included_price×청구인원 근사 (폼의 notIncludedBreakdown.totalUsd 전량 반영은 불가) */
  notIncludedTotalUsd: number
  additionalDiscount: number
  additionalCost: number
  tax: number
  prepaymentCost: number
  /** payment_records Refunded (우리 쪽 환불) */
  refundedOurAmount: number
  /**
   * true: 추가할인 차감·추가비용 가산 생략(채널 정산·결제에 이미 반영).
   * `shouldOmitAdditionalDiscountAndCostFromCompanyRevenueSum` 결과를 넣을 것.
   */
  omitAdditionalDiscountAndCostFromSum: boolean
  /** 자체(홈페이지) 예약: ④에서 추가할인·선결제 지출 가산 안 함 · 추가비용은 회사 매출 합에서 제외(정산에 섞인 뒤 말미 차감) */
  excludeHomepageAdditionalCostFromCompanyTotals: boolean
  /** 비-OTA·진행: `channelSettlementBase`가 고객 총 결제(넷)인 경우 true */
  revenueFromCustomerPaymentTotal?: boolean
  /** OTA·진행: ④ 총매출에 가산하는 폼 카드수수료(③ 플랫폼 수수료와 별개) */
  cardFeeForCompanyRevenue?: number
  /** OTA·진행: ④ 총매출에 포함하는 선결제 팁(운영이익은 총매출−팁으로 동일 순효과 유지) */
  prepaymentTipForCompanyRevenue?: number
}

export function computeCompanyTotalRevenueLikePricingSection(inp: CompanyTotalRevenueInput): number {
  const {
    channelSettlementBase,
    isOTAChannel,
    isReservationCancelled,
    reservationOptionsTotalPrice,
    notIncludedTotalUsd,
    additionalDiscount,
    additionalCost,
    tax,
    prepaymentCost,
    refundedOurAmount,
    omitAdditionalDiscountAndCostFromSum,
    excludeHomepageAdditionalCostFromCompanyTotals,
    revenueFromCustomerPaymentTotal = false,
    cardFeeForCompanyRevenue = 0,
    prepaymentTipForCompanyRevenue = 0,
  } = inp

  if (isReservationCancelled) {
    return roundUsd2(channelSettlementBase)
  }

  if (revenueFromCustomerPaymentTotal) {
    let totalRevenue = channelSettlementBase
    totalRevenue -= refundedOurAmount
    if (excludeHomepageAdditionalCostFromCompanyTotals && additionalCost > 0) {
      totalRevenue -= additionalCost
    }
    return roundUsd2(totalRevenue)
  }

  let totalRevenue = channelSettlementBase

  if (reservationOptionsTotalPrice > 0 && isOTAChannel) {
    totalRevenue += reservationOptionsTotalPrice
  }
  if (notIncludedTotalUsd > 0) {
    totalRevenue += notIncludedTotalUsd
  }

  const omitDiscCostEffective =
    omitAdditionalDiscountAndCostFromSum && !(isOTAChannel && !isReservationCancelled)

  if (!omitDiscCostEffective) {
    if (additionalDiscount > 0 && !excludeHomepageAdditionalCostFromCompanyTotals) {
      totalRevenue -= additionalDiscount
    }
    if (additionalCost > 0) {
      totalRevenue += additionalCost
    }
  }
  if (tax > 0) {
    totalRevenue += tax
  }
  if (prepaymentCost > 0 && !excludeHomepageAdditionalCostFromCompanyTotals) {
    totalRevenue += prepaymentCost
  }
  totalRevenue -= refundedOurAmount

  if (excludeHomepageAdditionalCostFromCompanyTotals && additionalCost > 0) {
    totalRevenue -= additionalCost
  }

  if (isOTAChannel && !isReservationCancelled) {
    const cf = Number(cardFeeForCompanyRevenue) || 0
    if (cf > 0.005) {
      totalRevenue += cf
    }
    const ptip = Number(prepaymentTipForCompanyRevenue) || 0
    if (ptip > 0.005) {
      totalRevenue += ptip
    }
  }

  return roundUsd2(totalRevenue)
}

/**
 * `reservation_pricing.commission_base_price` 저장 시 UI「채널 결제 금액」(net)과 정산 산식 `channelPayNet` 중 무엇을 쓸지 결정.
 * 기존에는 산식만 저장해 사용자가 폼에서 맞춘 금액이 DB에 반영되지 않던 문제를 막는다.
 */
export function resolveCommissionBasePriceForPersistence(input: {
  formCommissionBase: unknown
  channelPayNet: number
  /** PricingSection이 채널 결제 관련 필드를 편짟해 `pricingFieldsFromDb` 플래그가 false인 경우 */
  channelPricingFieldsUserEdited?: boolean
}): number {
  const net = roundUsd2(Math.max(0, toN(input.channelPayNet)))
  const raw = input.formCommissionBase
  const has =
    raw !== undefined &&
    raw !== null &&
    String(raw).trim() !== '' &&
    Number.isFinite(Number(raw))
  if (!has) return net
  const form = roundUsd2(Number(raw))
  if (input.channelPricingFieldsUserEdited) return form
  if (form <= 0.005 && net > 0.01) return net
  if (Math.abs(form - net) > 0.02) return form
  return net
}

/**
 * PricingSection·가격 정보 모달에서 OTA 전용 산식(③④)을 쓸지 판별.
 * DB `channels.type`/`category`가 비어 있어도 이름 휴리스틱으로 OTA를 잡는다(예: Viator·Booking만 등록된 경우).
 */
export function channelIsOtaForPricingSection(
  ch: { type?: string | null; category?: string | null; name?: string | null } | undefined
): boolean {
  if (!ch) return false
  if (String(ch.type ?? '').toLowerCase() === 'ota' || String(ch.category ?? '') === 'OTA') {
    return true
  }
  const n = String(ch.name ?? '').toLowerCase()
  if (!n) return false
  return (
    n.includes('ota') ||
    n.includes('expedia') ||
    n.includes('booking') ||
    n.includes('viator') ||
    n.includes('getyourguide') ||
    n.includes('get your guide')
  )
}
