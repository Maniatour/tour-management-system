import { detectPricingProfile } from '@/lib/pricingEngine/detectProfile'
import type {
  PricingEngineContext,
  PricingLayerResult,
  PricingLedgerLine,
  ReservationPricingResult,
} from '@/lib/pricingEngine/types'
import {
  cancelledNonOtaNetCollectedFromPayments,
  cancelledSettlementReturnedAmount,
  computeCustomerPaymentNetForCompanyRevenueBase,
  computeCustomerPaymentTotalLineFormula,
  computeEffectiveCustomerPaidTowardDue,
  computeRemainingBalanceAfterPaymentRecords,
  customerRefundCreditAgainstDue,
  pricingFieldToNumber,
  summarizePaymentRecordsForBalance,
  type PaymentRecordLike,
} from '@/utils/reservationPricingBalance'
import {
  computeChannelPaymentAfterReturn,
  computeChannelSettlementAmount,
  deriveCommissionGrossForSettlement,
  otaPricingFormExtrasForCompanyRevenue,
  otaReservationOptionsForCompanyRevenue,
  shouldOmitAdditionalDiscountAndCostFromCompanyRevenueSum,
  shouldOmitOtaExtrasFromCompanyRevenueSum,
  type ChannelSettlementComputeInput,
} from '@/utils/channelSettlement'
import {
  computeRefundAmountForCompanyRevenueBlock,
  computePrepaymentTipOperatingDeduction,
  computeStoredCompanyRevenueFields,
} from '@/utils/storedCompanyRevenue'
import {
  computePricingSectionCustomerPaymentGrossLike,
  computePricingSectionCustomerPaymentNet,
} from '@/utils/pricingSectionCustomerTotals'
import {
  isCancelledReservationStatus,
  isNotIncludedExcludedReservationStatus,
} from '@/lib/reservationStatus'

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

function sumLayer(lines: PricingLedgerLine[]): number {
  return roundUsd2(
    lines.reduce((acc, line) => {
      if (line.sign === '=') return acc
      return acc + (line.sign === '+' ? line.amount : -line.amount)
    }, 0)
  )
}

function line(
  id: string,
  sign: '+' | '-' | '=',
  labelKo: string,
  labelEn: string,
  amount: number
): PricingLedgerLine {
  return { id, sign, labelKo, labelEn, amount: roundUsd2(Math.abs(amount)) }
}

function partyFromContext(ctx: PricingEngineContext) {
  return {
    adults: ctx.adults,
    children: ctx.children,
    child: ctx.children,
    infants: ctx.infants,
    infant: ctx.infants,
  }
}

function paymentSummary(records: PaymentRecordLike[]) {
  return summarizePaymentRecordsForBalance(records)
}

function buildSettlementInput(
  ctx: PricingEngineContext,
  returnedAmount: number
): ChannelSettlementComputeInput {
  const notIncludedTotalUsd = ctx.notIncludedTotalUsd
  const productTotalForSettlement = roundUsd2(ctx.productPriceTotal + notIncludedTotalUsd)
  const storedCb = ctx.commissionBasePriceStored ?? 0
  const onlineRaw = ctx.onlinePaymentAmount
  const dep = ctx.depositAmount
  const onlineMissingOrTiny = Math.abs(onlineRaw) < 0.005
  let onlineForSettlement =
    Math.abs(onlineRaw) > 0.005
      ? onlineRaw
      : deriveCommissionGrossForSettlement(storedCb, {
          returnedAmount,
          depositAmount: dep,
          productPriceTotal: productTotalForSettlement,
          isOTAChannel: ctx.isOtaChannel,
        }) || storedCb
  /** 취소·자체: online이 순잔액만 있고 보증금이 실제 캡처액이면 gross로 보증금 사용 (PricingSection 동일) */
  if (
    isCancelledReservationStatus(ctx.reservationStatus) &&
    !ctx.isOtaChannel &&
    dep > 0.005 &&
    (onlineMissingOrTiny || dep > onlineForSettlement + 0.02)
  ) {
    onlineForSettlement = dep
  }

  const input: ChannelSettlementComputeInput = {
    depositAmount: ctx.depositAmount,
    onlinePaymentAmount: onlineForSettlement,
    productPriceTotal: productTotalForSettlement,
    couponDiscount: ctx.couponDiscount,
    additionalDiscount: ctx.additionalDiscount,
    optionTotalSum: ctx.reservationOptionsTotal,
    additionalCost: ctx.additionalCost,
    tax: ctx.tax,
    cardFee: ctx.cardFee,
    prepaymentTip: ctx.prepaymentTip,
    onSiteBalanceAmount: ctx.balanceAmountStored ?? 0,
    returnedAmount,
    partnerReceivedAmount: ctx.partnerReceivedAmount,
    commissionAmount: ctx.commissionAmount,
    isOTAChannel: ctx.isOtaChannel,
  }
  if (ctx.reservationStatus != null && ctx.reservationStatus !== '') {
    input.reservationStatus = ctx.reservationStatus
  }
  return input
}

function computeCustomerLayer(
  ctx: PricingEngineContext,
  profile: ReturnType<typeof detectPricingProfile>
): { layer: PricingLayerResult; gross: number; net: number; balance: number } {
  const lines: PricingLedgerLine[] = []
  const excludeNotIncluded = isNotIncludedExcludedReservationStatus(ctx.reservationStatus)

  const discountedProduct = roundUsd2(
    ctx.productPriceTotal - ctx.couponDiscount - ctx.additionalDiscount
  )
  if (discountedProduct > 0.005) {
    lines.push(line('product', '+', '상품 합계 (할인 후)', 'Product (after discounts)', discountedProduct))
  }

  if (ctx.reservationOptionsTotal > 0.005) {
    lines.push(
      line('options', '+', '예약 옵션', 'Reservation options', ctx.reservationOptionsTotal)
    )
  }

  if (!excludeNotIncluded && ctx.notIncludedBaseUsd > 0.005) {
    lines.push(
      line('not_included', '+', '불포함 (입장권)', 'Not included (admission)', ctx.notIncludedBaseUsd)
    )
  }
  if (!excludeNotIncluded && ctx.notIncludedResidentFeesUsd > 0.005) {
    lines.push(
      line(
        'resident_fees',
        '+',
        '비거주자 비용',
        'Non-resident fees',
        ctx.notIncludedResidentFeesUsd
      )
    )
  }

  for (const [id, sign, ko, en, amt] of [
    ['additional_cost', '+', '추가 비용', 'Additional cost', ctx.additionalCost],
    ['tax', '+', '세금', 'Tax', ctx.tax],
    ['card_fee', '+', '카드 수수료', 'Card fee', ctx.cardFee],
    ['prepay_cost', '+', '선결제 지출', 'Prepayment cost', ctx.prepaymentCost],
    ['prepay_tip', '+', '선결제 팁', 'Prepayment tip', ctx.prepaymentTip],
    ['refund', '-', '투어 환불', 'Tour refund', ctx.manualRefundAmount],
  ] as const) {
    if (amt > 0.005) {
      lines.push(line(id, sign, ko, en, amt))
    }
  }

  const gross = computePricingSectionCustomerPaymentGrossLike({
    status: ctx.reservationStatus ?? null,
    productPriceTotal: ctx.productPriceTotal,
    couponDiscount: ctx.couponDiscount,
    additionalDiscount: ctx.additionalDiscount,
    reservationOptionsTotalUsd: ctx.reservationOptionsTotal,
    notIncludedTotalUsd: excludeNotIncluded ? 0 : ctx.notIncludedTotalUsd,
    additionalCost: ctx.additionalCost,
    tax: ctx.tax,
    cardFee: ctx.cardFee,
    prepaymentCost: ctx.prepaymentCost,
    prepaymentTip: ctx.prepaymentTip,
  })

  const paySm = paymentSummary(ctx.paymentRecords)
  const returnedAmount = isCancelledReservationStatus(ctx.reservationStatus)
    ? cancelledSettlementReturnedAmount(paySm, ctx.manualRefundAmount)
    : paySm.returnedTotal

  let net = computePricingSectionCustomerPaymentNet(
    gross,
    returnedAmount,
    ctx.manualRefundAmount
  )

  if (isCancelledReservationStatus(ctx.reservationStatus) && ctx.totalPriceStored != null) {
    net = roundUsd2(Math.max(0, ctx.totalPriceStored))
  }

  if (returnedAmount > ctx.manualRefundAmount + 0.005) {
    lines.push(
      line(
        'returned_surplus',
        '-',
        'Returned (파트너, 추가분)',
        'Returned (partner, surplus)',
        roundUsd2(returnedAmount - ctx.manualRefundAmount)
      )
    )
  }

  let balance = 0
  if (ctx.paymentRecords.length > 0) {
    const refundCredit = isCancelledReservationStatus(ctx.reservationStatus)
      ? 0
      : customerRefundCreditAgainstDue(paySm, ctx.manualRefundAmount)
    const refundedFromRecordsUsd = roundUsd2(Math.max(0, Math.abs(paySm.refundedTotal)))
    if (refundedFromRecordsUsd > 0.005 && !isCancelledReservationStatus(ctx.reservationStatus)) {
      lines.push(
        line(
          'refund_records',
          '-',
          '입금 환불 (우리)',
          'Refunded (us, payments)',
          refundedFromRecordsUsd
        )
      )
    }
    balance = computeRemainingBalanceAfterPaymentRecords(
      net,
      paySm.depositTotalNet,
      paySm.balanceReceivedTotal,
      refundCredit
    )
    if (paySm.depositTotalNet > 0.005) {
      lines.push(line('deposit_paid', '-', '보증금 (순액)', 'Deposit (net)', paySm.depositTotalNet))
    }
    if (paySm.balanceReceivedTotal > 0.005) {
      lines.push(
        line('balance_received', '-', '잔금 수령', 'Balance received', paySm.balanceReceivedTotal)
      )
    }
  } else {
    const depositForDue = Math.max(0, ctx.depositAmount)
    const paid = computeEffectiveCustomerPaidTowardDue(
      net,
      depositForDue,
      paySm.balanceReceivedTotal,
      paySm.refundedTotal,
      ctx.manualRefundAmount
    )
    balance = roundUsd2(net - paid)
    if (depositForDue > 0.005) {
      lines.push(line('deposit', '-', '보증금', 'Deposit', depositForDue))
    }
  }

  if (!isNotIncludedExcludedReservationStatus(ctx.reservationStatus)) {
    lines.push(line('balance_due', '=', '잔액 (미수)', 'Balance due', balance))
  }

  void profile

  return {
    layer: { total: net, lines },
    gross,
    net,
    balance: isNotIncludedExcludedReservationStatus(ctx.reservationStatus) ? 0 : balance,
  }
}

function computeChannelLayer(
  ctx: PricingEngineContext,
  customerNet: number
): { layer: PricingLayerResult; paymentNet: number; settlement: number } {
  const lines: PricingLedgerLine[] = []
  const paySm = paymentSummary(ctx.paymentRecords)
  const returnedAmount = isCancelledReservationStatus(ctx.reservationStatus)
    ? cancelledSettlementReturnedAmount(paySm, ctx.manualRefundAmount)
    : paySm.returnedTotal

  const settlementInput = buildSettlementInput(ctx, returnedAmount)
  let paymentNet = computeChannelPaymentAfterReturn(settlementInput)
  if (
    ctx.isOtaChannel &&
    ctx.partnerReceivedAmount > 0 &&
    paymentNet > ctx.partnerReceivedAmount + 0.005
  ) {
    paymentNet = ctx.partnerReceivedAmount
  }
  paymentNet = roundUsd2(Math.max(0, paymentNet))

  const settlementFromFormula = roundUsd2(
    Math.max(0, computeChannelSettlementAmount(settlementInput))
  )
  const settlement =
    ctx.usesStoredChannelSettlement && ctx.channelSettlementAmountStored != null
      ? roundUsd2(Math.max(0, ctx.channelSettlementAmountStored))
      : settlementFromFormula

  lines.push(line('channel_payment', '+', '채널 결제 (넷)', 'Channel payment (net)', paymentNet))
  if (returnedAmount > 0.005) {
    lines.push(line('returned', '-', 'Returned', 'Returned', returnedAmount))
  }
  if (ctx.commissionAmount > 0.005) {
    lines.push(line('commission', '-', '채널 수수료', 'Channel commission', ctx.commissionAmount))
  }
  lines.push(line('settlement', '=', '채널 정산', 'Channel settlement', settlement))

  void customerNet

  return {
    layer: { total: settlement, lines },
    paymentNet,
    settlement,
  }
}

function computeCompanyLayer(
  ctx: PricingEngineContext,
  customerNet: number,
  customerGross: number,
  channelSettlement: number,
  channelPaymentNet: number
): { layer: PricingLayerResult; totalRevenue: number; operatingProfit: number } {
  const paySm = paymentSummary(ctx.paymentRecords)
  const returnedAmount = isCancelledReservationStatus(ctx.reservationStatus)
    ? cancelledSettlementReturnedAmount(paySm, ctx.manualRefundAmount)
    : paySm.returnedTotal

  const productTotalForSettlement = roundUsd2(ctx.productPriceTotal + ctx.notIncludedTotalUsd)
  const storedCb = ctx.commissionBasePriceStored ?? 0
  const onlineRaw = ctx.onlinePaymentAmount
  let channelPaymentGrossDbLike = 0
  if (Math.abs(onlineRaw) > 0.005) {
    channelPaymentGrossDbLike = onlineRaw
  } else if (storedCb) {
    channelPaymentGrossDbLike = deriveCommissionGrossForSettlement(storedCb, {
      returnedAmount,
      depositAmount: ctx.depositAmount,
      productPriceTotal: productTotalForSettlement,
      isOTAChannel: ctx.isOtaChannel,
    })
  }

  const omitAdditional = shouldOmitAdditionalDiscountAndCostFromCompanyRevenueSum({
    usesStoredChannelSettlement: ctx.usesStoredChannelSettlement,
    isOTAChannel: ctx.isOtaChannel,
    depositAmount: ctx.depositAmount,
    onlinePaymentAmount: onlineRaw,
    channelPaymentGross: channelPaymentGrossDbLike,
  })

  const refundForRevenue = computeRefundAmountForCompanyRevenueBlock({
    refundedFromRecords: paySm.refundedTotal,
    reservationOptionsActiveSum: ctx.reservationOptionsTotal,
    optionCancelRefundUsd: ctx.optionCancelRefundUsd,
    manualRefundAmount: ctx.manualRefundAmount,
    isOTAChannel: ctx.isOtaChannel,
    returnedAmount,
  })

  const cancelledNetCollected = cancelledNonOtaNetCollectedFromPayments(paySm)

  const stored = computeStoredCompanyRevenueFields({
    channelSettlementBase: channelSettlement,
    customerPaymentNetForRevenueBase: !ctx.isOtaChannel ? customerNet : null,
    cardFee: ctx.cardFee,
    reservationStatus: ctx.reservationStatus,
    isOTAChannel: ctx.isOtaChannel,
    isHomepageBooking: ctx.isHomepageBooking,
    reservationOptionsActiveSum: ctx.reservationOptionsTotal,
    omitCtx: {
      usesStoredChannelSettlement: ctx.usesStoredChannelSettlement,
      depositAmount: ctx.depositAmount,
      onlinePaymentAmount: onlineRaw,
      channelPaymentGross: channelPaymentGrossDbLike,
    },
    omitAdditionalDiscountAndCostFromSumOverride: omitAdditional,
    notIncludedPerPerson: ctx.notIncludedTotalUsd / Math.max(1, ctx.adults + ctx.children + ctx.infants || 1),
    pricingAdults: ctx.pricingAdults,
    child: ctx.children,
    infant: ctx.infants,
    additionalDiscount: ctx.additionalDiscount,
    additionalCost: ctx.additionalCost,
    tax: ctx.tax,
    prepaymentCost: ctx.prepaymentCost,
    prepaymentTip: ctx.prepaymentTip,
    refundAmountForCompanyRevenueBlock: refundForRevenue,
    customerPaymentNetForOtaOmitCheck: customerNet,
    commissionAmount: ctx.commissionAmount,
    channelPaymentNet,
    reservationExpensesTotal: ctx.reservationExpensesTotal,
    cancelledNetCollectedFromPayments: cancelledNetCollected,
    customerPaymentGross: customerGross,
  })

  const lines: PricingLedgerLine[] = []
  const omitOtaExtras = shouldOmitOtaExtrasFromCompanyRevenueSum({
    isOTAChannel: ctx.isOtaChannel,
    isReservationCancelled: isCancelledReservationStatus(ctx.reservationStatus),
    channelSettlementBase: channelSettlement,
    customerPaymentNet: customerNet,
    commissionAmount: ctx.commissionAmount,
    channelPaymentNet,
  })

  if (!ctx.isOtaChannel && !isCancelledReservationStatus(ctx.reservationStatus)) {
    lines.push(
      line('customer_net', '+', '고객 총 결제 (넷)', 'Customer payment (net)', customerNet)
    )
  } else {
    lines.push(line('settlement_base', '+', '채널 정산', 'Channel settlement', channelSettlement))
  }

  if (Math.abs(ctx.reservationExpensesTotal) > 0.005) {
    lines.push(
      line(
        'reservation_expenses',
        ctx.reservationExpensesTotal >= 0 ? '-' : '+',
        '예약 지출',
        'Reservation expenses',
        Math.abs(ctx.reservationExpensesTotal)
      )
    )
  }

  const otaOpts = otaReservationOptionsForCompanyRevenue({
    isOTAChannel: ctx.isOtaChannel,
    reservationOptionsTotalPrice: ctx.reservationOptionsTotal,
    omitOtaExtras,
    customerPaymentNet: customerNet,
    channelPaymentNet,
  })
  if (otaOpts > 0.005) {
    lines.push(line('ota_options', '+', '예약 옵션', 'Reservation options', otaOpts))
  }

  const formExtras = otaPricingFormExtrasForCompanyRevenue({
    isOTAChannel: ctx.isOtaChannel,
    omitOtaExtras,
    additionalDiscount: ctx.additionalDiscount,
    additionalCost: ctx.additionalCost,
    tax: ctx.tax,
    cardFee: ctx.cardFee,
    prepaymentCost: ctx.prepaymentCost,
    customerPaymentNet: customerNet,
    channelPaymentNet,
    notIncludedTotalUsd: ctx.notIncludedTotalUsd,
    reservationOptionsTotalPrice: ctx.reservationOptionsTotal,
  })

  /** Self·진행: ① 고객 총 결제(넷)에 환불이 이미 포함되어 ④에서 재차감하지 않음 */
  const refundLineAmount =
    !ctx.isOtaChannel && !isCancelledReservationStatus(ctx.reservationStatus)
      ? 0
      : refundForRevenue

  for (const [id, sign, ko, en, amt] of [
    ['add_discount', '-', '추가할인', 'Additional discount', formExtras.additionalDiscount],
    ['add_cost', '+', '추가비용', 'Additional cost', formExtras.additionalCost],
    ['tax', '+', '세금', 'Tax', formExtras.tax],
    ['card_fee', '+', '카드 수수료', 'Card fee', formExtras.cardFee],
    ['prepay_cost', '+', '선결제 지출', 'Prepayment cost', formExtras.prepaymentCost],
    ['refund', '-', '환불', 'Refund', refundLineAmount],
  ] as const) {
    if (amt > 0.005) {
      lines.push(line(id, sign, ko, en, amt))
    }
  }

  lines.push(
    line('total_revenue', '=', '총 매출', 'Total revenue', stored.company_total_revenue)
  )
  const prepTipDeduction = computePrepaymentTipOperatingDeduction({
    prepaymentTip: ctx.prepaymentTip,
    isReservationCancelled: isCancelledReservationStatus(ctx.reservationStatus),
    isOTAChannel: ctx.isOtaChannel,
    refundAmountForCompanyRevenueBlock: refundForRevenue,
    customerPaymentGross: customerGross,
    cancelledNetCollectedFromPayments: cancelledNetCollected ?? null,
    totalRevenue: stored.company_total_revenue,
    refundedFromRecords: paySm.refundedTotal,
  })
  if (prepTipDeduction > 0.005) {
    lines.push(line('prepay_tip', '-', '선결제 팁', 'Prepayment tip', prepTipDeduction))
  }

  return {
    layer: { total: stored.company_total_revenue, lines },
    totalRevenue: stored.company_total_revenue,
    operatingProfit: stored.operating_profit,
  }
}

/**
 * 새 가격 엔진 — 단일 진입점.
 * 기존 유틸을 프로필·레이어 구조로 감싸며, 점진적으로 내부 구현을 교체할 수 있다.
 */
export function computeReservationPricing(ctx: PricingEngineContext): ReservationPricingResult {
  const profileInfo = detectPricingProfile(ctx)
  const customer = computeCustomerLayer(ctx, profileInfo)
  const channel = computeChannelLayer(ctx, customer.net)
  const company = computeCompanyLayer(
    ctx,
    customer.net,
    customer.gross,
    channel.settlement,
    channel.paymentNet
  )

  return {
    profile: profileInfo.profile,
    profileLabelKo: profileInfo.labelKo,
    profileLabelEn: profileInfo.labelEn,
    customer: customer.layer,
    channel: channel.layer,
    company: company.layer,
    totals: {
      customerPaymentGross: customer.gross,
      customerPaymentNet: customer.net,
      onSiteBalance: customer.balance,
      channelPaymentNet: channel.paymentNet,
      channelSettlement: channel.settlement,
      companyTotalRevenue: company.totalRevenue,
      operatingProfit: company.operatingProfit,
    },
  }
}

/** Balance 테이블·라인 산식과의 교차 검증용 */
export function computeLineFormulaCustomerTotal(ctx: PricingEngineContext): number {
  const pricing = {
    product_price_total: ctx.productPriceTotal,
    adult_product_price: ctx.adultProductPrice,
    child_product_price: ctx.childProductPrice,
    infant_product_price: ctx.infantProductPrice,
    coupon_discount: ctx.couponDiscount,
    additional_discount: ctx.additionalDiscount,
    option_total: ctx.reservationOptionsTotal,
    required_option_total: ctx.requiredOptionTotal,
    additional_cost: ctx.additionalCost,
    tax: ctx.tax,
    card_fee: ctx.cardFee,
    prepayment_cost: ctx.prepaymentCost,
    prepayment_tip: ctx.prepaymentTip,
    private_tour_additional_cost: ctx.privateTourAdditionalCost,
    refund_amount: ctx.manualRefundAmount,
    not_included_price:
      ctx.notIncludedTotalUsd / Math.max(1, ctx.adults + ctx.children + ctx.infants || 1),
  }
  return roundUsd2(computeCustomerPaymentTotalLineFormula(pricing, partyFromContext(ctx)))
}

export function computeLineFormulaCustomerNet(
  ctx: PricingEngineContext,
  returnedAmount: number
): number {
  const pricing = {
    product_price_total: ctx.productPriceTotal,
    adult_product_price: ctx.adultProductPrice,
    child_product_price: ctx.childProductPrice,
    infant_product_price: ctx.infantProductPrice,
    coupon_discount: ctx.couponDiscount,
    additional_discount: ctx.additionalDiscount,
    option_total: ctx.reservationOptionsTotal,
    required_option_total: ctx.requiredOptionTotal,
    additional_cost: ctx.additionalCost,
    tax: ctx.tax,
    card_fee: ctx.cardFee,
    prepayment_cost: ctx.prepaymentCost,
    prepayment_tip: ctx.prepaymentTip,
    private_tour_additional_cost: ctx.privateTourAdditionalCost,
    refund_amount: ctx.manualRefundAmount,
    not_included_price:
      ctx.notIncludedTotalUsd / Math.max(1, ctx.adults + ctx.children + ctx.infants || 1),
  }
  return computeCustomerPaymentNetForCompanyRevenueBase(
    pricing,
    partyFromContext(ctx),
    returnedAmount
  )
}

export { roundUsd2, sumLayer, pricingFieldToNumber }
