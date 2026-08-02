/**
 * 예약 상세「가격 정보」④ 최종 매출 & 운영 이익 — DB 스냅샷용 순수 계산.
 * `PricingSection`의 `companyViewRevenueLedger` / `refundAmountForCompanyRevenueBlock`와 동일 산식.
 */

import { roundUsd2, splitNotIncludedForDisplay } from '@/utils/pricingSectionDisplay'
import {
  shouldOmitAdditionalDiscountAndCostFromCompanyRevenueSum,
  shouldOmitOtaExtrasFromCompanyRevenueSum,
  otaReservationOptionsForCompanyRevenue,
  otaPricingFormExtrasForCompanyRevenue,
} from '@/utils/channelSettlement'
import {
  isCancelledReservationStatus,
  isNoShowReservationStatus,
  isNotIncludedExcludedReservationStatus,
} from '@/lib/reservationStatus'

export function computeRefundAmountForCompanyRevenueBlock(inp: {
  refundedFromRecords: number
  reservationOptionsActiveSum: number
  optionCancelRefundUsd: number
  manualRefundAmount: number
  isOTAChannel: boolean
  returnedAmount: number
}): number {
  const ref = Math.max(0, Number(inp.refundedFromRecords) || 0)
  const optRev = Math.max(0, Number(inp.reservationOptionsActiveSum) || 0)
  const optCancel = Math.max(0, Number(inp.optionCancelRefundUsd) || 0)
  const man = Math.max(0, Number(inp.manualRefundAmount) || 0)
  const tourRefundCreditedByPartnerReturn = Math.min(
    man,
    Math.max(0, Number(inp.returnedAmount) || 0)
  )
  if (optRev > 0.005) {
    return roundUsd2(ref)
  }
  const base = roundUsd2(Math.max(man, Math.max(0, ref - optCancel)))
  if (!inp.isOTAChannel) {
    return base
  }
  return Math.max(0, roundUsd2(base - tourRefundCreditedByPartnerReturn))
}

export type StoredCompanyRevenueComputeInput = {
  /** ④의 시작점 — 저장된 `channel_settlement_amount`(또는 UI와 동일하게 산출한 값) */
  channelSettlementBase: number
  /**
   * 비-OTA·진행 예약: ④ 시작점을 고객 총 결제(넷)으로 할 때 설정.
   * 설정 시 `channelSettlementBase`는 무시되고 옵션·불포함·세·선결제 등은 이중 가산하지 않음.
   */
  customerPaymentNetForRevenueBase?: number | null
  /** OTA·진행: ④ 총매출에 가산하는 폼 카드수수료 */
  cardFee?: number
  reservationStatus: string | null | undefined
  isOTAChannel: boolean
  isHomepageBooking: boolean
  /** 취소·환불 제외 예약 옵션 합 — OTA일 때만 ④에 가산 */
  reservationOptionsActiveSum: number
  /** `shouldOmitAdditionalDiscountAndCostFromCompanyRevenueSum` 인자 */
  omitCtx: {
    usesStoredChannelSettlement: boolean
    depositAmount: number
    onlinePaymentAmount: number
    channelPaymentGross: number
  }
  /** Balance 파이프라인 등에서 이미 계산된 omit — 있으면 `omitCtx` 무시 */
  omitAdditionalDiscountAndCostFromSumOverride?: boolean
  notIncludedPerPerson: number
  pricingAdults: number
  child: number
  infant: number
  residentStatusAmounts?: Record<string, number>
  choiceNotIncludedTotal?: number
  choiceNotIncludedBaseTotal?: number
  additionalDiscount: number
  additionalCost: number
  tax: number
  prepaymentCost: number
  prepaymentTip: number
  refundAmountForCompanyRevenueBlock: number
  /** OTA ④ 이중 가산 방지: ① 고객 총 결제(넷) */
  customerPaymentNetForOtaOmitCheck?: number
  commissionAmount?: number
  channelPaymentNet?: number
  /**
   * 예약 지출(위약금 등) 총합 — ④ 총매출에서 차감(UI `companyViewRevenueLedger`와 동일).
   * 미지정 시 0. 음수면 가산(환수)으로 동작해 UI와 부호가 일치한다.
   */
  reservationExpensesTotal?: number
  /** 취소·비-OTA: 입금 순수령(보증금 순액+잔금 수령) — 있으면 채널 정산 베이스 대신 ④에 사용 */
  cancelledNetCollectedFromPayments?: number | null
  /** ① 고객 총 결제(gross) — 선결제 팁 환불 구간 판정용 */
  customerPaymentGross?: number | null
}

/**
 * ④ 운영 이익에서 차감할 선결제 팁.
 * 취소·비-OTA에서 고객 환불이 선결제 팁 구간까지 포함되면 팁도 함께 반환된 것으로 보고 차감하지 않는다.
 */
export function computePrepaymentTipOperatingDeduction(inp: {
  prepaymentTip: number
  isReservationCancelled: boolean
  isOTAChannel: boolean
  refundAmountForCompanyRevenueBlock: number
  customerPaymentGross?: number | null
  cancelledNetCollectedFromPayments?: number | null
  /** ④ 총 매출 — 취소·전액 환불 후 0이면 팁 차감 없음 */
  totalRevenue?: number | null
  /** 입금 「환불됨 (우리)」 합 — `refundAmountForCompanyRevenueBlock` 보조 */
  refundedFromRecords?: number | null
}): number {
  const tip = Math.max(0, Number(inp.prepaymentTip) || 0)
  if (tip <= 0.005) return 0

  if (inp.isReservationCancelled && !inp.isOTAChannel) {
    const tr = Number(inp.totalRevenue)
    if (Number.isFinite(tr) && tr <= 0.005) {
      return 0
    }

    const gross = Number(inp.customerPaymentGross)
    const refund = roundUsd2(
      Math.max(
        Math.max(0, Number(inp.refundAmountForCompanyRevenueBlock) || 0),
        Math.max(0, Number(inp.refundedFromRecords) || 0)
      )
    )

    if (Number.isFinite(gross) && gross > 0.005 && refund > 0.005) {
      const nonTipGross = Math.max(0, roundUsd2(gross - tip))
      const tipRefunded = roundUsd2(Math.min(tip, Math.max(0, refund - nonTipGross)))
      return roundUsd2(Math.max(0, tip - tipRefunded))
    }

    const net = inp.cancelledNetCollectedFromPayments
    if (net != null && Number.isFinite(Number(net)) && Number(net) <= 0.005) {
      return 0
    }
  }

  return tip
}

function operatingProfitFromTotalRevenue(
  totalRevenue: number,
  inp: StoredCompanyRevenueComputeInput,
  isReservationCancelled: boolean
): number {
  const tipDeduction = computePrepaymentTipOperatingDeduction({
    prepaymentTip: Number(inp.prepaymentTip) || 0,
    isReservationCancelled,
    isOTAChannel: inp.isOTAChannel,
    refundAmountForCompanyRevenueBlock: inp.refundAmountForCompanyRevenueBlock,
    customerPaymentGross: inp.customerPaymentGross ?? null,
    cancelledNetCollectedFromPayments: inp.cancelledNetCollectedFromPayments ?? null,
    totalRevenue,
    refundedFromRecords: inp.refundAmountForCompanyRevenueBlock,
  })
  if (isReservationCancelled && !inp.isOTAChannel && totalRevenue <= 0.005) {
    return 0
  }
  return roundUsd2(totalRevenue - tipDeduction)
}

export function computeStoredCompanyRevenueFields(
  inp: StoredCompanyRevenueComputeInput
): { company_total_revenue: number; operating_profit: number } {
  const st = String(inp.reservationStatus || '').toLowerCase().trim()
  const isReservationCancelled = isCancelledReservationStatus(st)
  const isReservationNoShow = isNoShowReservationStatus(st)
  const prepTip = Number(inp.prepaymentTip) || 0
  /** 예약 지출(위약금 등) — UI ④와 동일하게 모든 분기에서 차감(부호 그대로) */
  const rex = Number(inp.reservationExpensesTotal) || 0

  const _omitAdditionalDiscountAndCostFromRevenueSum =
    inp.omitAdditionalDiscountAndCostFromSumOverride !== undefined
      ? inp.omitAdditionalDiscountAndCostFromSumOverride
      : shouldOmitAdditionalDiscountAndCostFromCompanyRevenueSum({
          usesStoredChannelSettlement: inp.omitCtx.usesStoredChannelSettlement,
          isOTAChannel: inp.isOTAChannel,
          depositAmount: inp.omitCtx.depositAmount,
          onlinePaymentAmount: inp.omitCtx.onlinePaymentAmount,
          channelPaymentGross: inp.omitCtx.channelPaymentGross,
        })
  void _omitAdditionalDiscountAndCostFromRevenueSum

  if (isReservationCancelled && !inp.isOTAChannel) {
    const netFromPayments = inp.cancelledNetCollectedFromPayments
    if (netFromPayments != null && Number.isFinite(Number(netFromPayments))) {
      const tr = roundUsd2(Math.max(0, Number(netFromPayments)) - rex)
      return {
        company_total_revenue: tr,
        operating_profit: operatingProfitFromTotalRevenue(tr, inp, true),
      }
    }
    const ch = roundUsd2(Math.max(0, Number(inp.channelSettlementBase) || 0))
    const refb = inp.refundAmountForCompanyRevenueBlock
    /** 채널 정산 net에 환불이 안 잡힌 경우 입금·가격 환불 합으로 차감 */
    const tr = roundUsd2(ch - rex - (refb > 0.005 ? refb : 0))
    return {
      company_total_revenue: tr,
      operating_profit: operatingProfitFromTotalRevenue(tr, inp, true),
    }
  }

  const refb = inp.refundAmountForCompanyRevenueBlock

  if (isReservationCancelled && inp.isOTAChannel) {
    /** `computePricingSectionDisplayTotalRevenue`·가격 정보 ④와 동일 — 저장된 채널 정산(net)만 사용, 환불 재차감 없음 */
    const ch = roundUsd2(Math.max(0, Number(inp.channelSettlementBase) || 0))
    const tr = roundUsd2(ch - rex)
    return {
      company_total_revenue: tr,
      operating_profit: operatingProfitFromTotalRevenue(tr, inp, true),
    }
  }

  if (isReservationNoShow) {
    const ch = roundUsd2(Math.max(0, Number(inp.channelSettlementBase) || 0))
    const tr = roundUsd2(ch - rex)
    return {
      company_total_revenue: tr,
      operating_profit: operatingProfitFromTotalRevenue(tr, inp, false),
    }
  }

  const cpn = inp.customerPaymentNetForRevenueBase
  if (
    !isReservationCancelled &&
    !isReservationNoShow &&
    !inp.isOTAChannel &&
    cpn != null &&
    Number.isFinite(Number(cpn))
  ) {
    let tr = roundUsd2(Math.max(0, Number(cpn) || 0))
    tr -= rex
    if (refb > 0.005) {
      tr -= refb
    }
    tr = roundUsd2(tr)
    return {
      company_total_revenue: tr,
      operating_profit: operatingProfitFromTotalRevenue(tr, inp, false),
    }
  }

  let tr = roundUsd2(Math.max(0, Number(inp.channelSettlementBase) || 0))

  const omitOtaExtras = shouldOmitOtaExtrasFromCompanyRevenueSum({
    isOTAChannel: inp.isOTAChannel,
    isReservationCancelled,
    channelSettlementBase: tr,
    customerPaymentNet: Number(inp.customerPaymentNetForOtaOmitCheck) || 0,
    commissionAmount: Number(inp.commissionAmount) || 0,
    channelPaymentNet: Number(inp.channelPaymentNet) || 0,
  })

  /** UI ledger와 동일: omit 판정(베이스 기준) 이후 예약 지출(위약금) 차감 */
  tr -= rex

  tr += otaReservationOptionsForCompanyRevenue({
    isOTAChannel: inp.isOTAChannel,
    reservationOptionsTotalPrice: inp.reservationOptionsActiveSum,
    omitOtaExtras,
    customerPaymentNet: Number(inp.customerPaymentNetForOtaOmitCheck) || 0,
    channelPaymentNet: Number(inp.channelPaymentNet) || 0,
  })

  /** 불포함(입장권·비거주자 비용)은 OTA 판매가에 포함되지 않는 별도 수금이라 omitOtaExtras와 무관하게 항상 가산 */
  let notIncludedTotalUsd = 0
  if (!isNotIncludedExcludedReservationStatus(inp.reservationStatus)) {
    const { baseUsd, residentFeesUsd } = splitNotIncludedForDisplay(
      inp.choiceNotIncludedTotal ?? 0,
      inp.choiceNotIncludedBaseTotal ?? 0,
      inp.notIncludedPerPerson,
      inp.pricingAdults,
      inp.child,
      inp.infant,
      inp.residentStatusAmounts
    )
    if (baseUsd > 0.005) {
      tr += baseUsd
      notIncludedTotalUsd += baseUsd
    }
    if (residentFeesUsd > 0.005) {
      tr += residentFeesUsd
      notIncludedTotalUsd += residentFeesUsd
    }
  }

  const formExtras = otaPricingFormExtrasForCompanyRevenue({
    isOTAChannel: inp.isOTAChannel,
    omitOtaExtras,
    additionalDiscount: Number(inp.additionalDiscount) || 0,
    additionalCost: Number(inp.additionalCost) || 0,
    tax: Number(inp.tax) || 0,
    cardFee: Number(inp.cardFee) || 0,
    prepaymentCost: Number(inp.prepaymentCost) || 0,
    customerPaymentNet: Number(inp.customerPaymentNetForOtaOmitCheck) || 0,
    channelPaymentNet: Number(inp.channelPaymentNet) || 0,
    notIncludedTotalUsd,
    reservationOptionsTotalPrice: inp.reservationOptionsActiveSum,
  })

  if (formExtras.additionalDiscount > 0.005 && !inp.isHomepageBooking) {
    tr -= formExtras.additionalDiscount
  }
  if (formExtras.additionalCost > 0.005 && !inp.isHomepageBooking) {
    tr += formExtras.additionalCost
  }
  if (formExtras.tax > 0.005) {
    tr += formExtras.tax
  }
  if (formExtras.prepaymentCost > 0.005 && !inp.isHomepageBooking) {
    tr += formExtras.prepaymentCost
  }
  if (inp.isOTAChannel && !isReservationCancelled && formExtras.cardFee > 0.005) {
    tr += formExtras.cardFee
  }
  if (inp.isOTAChannel && !isReservationCancelled && !omitOtaExtras && prepTip > 0.005) {
    tr += prepTip
  }

  /** 채널 정산 ≈ 고객 총 결제(넷)이면 환불·Returned는 정산에 이미 반영 — 이중 차감 방지 */
  if (refb > 0.005 && !omitOtaExtras) {
    tr -= refb
  }

  if (inp.isHomepageBooking && (Number(inp.additionalCost) || 0) > 0.005) {
    const ac = Number(inp.additionalCost) || 0
    tr -= ac
  }

  tr = roundUsd2(tr)
  return {
    company_total_revenue: tr,
    operating_profit: operatingProfitFromTotalRevenue(tr, inp, isReservationCancelled),
  }
}
