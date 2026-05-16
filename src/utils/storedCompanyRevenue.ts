/**
 * 예약 상세「가격 정보」④ 최종 매출 & 운영 이익 — DB 스냅샷용 순수 계산.
 * `PricingSection`의 `companyViewRevenueLedger` / `refundAmountForCompanyRevenueBlock`와 동일 산식.
 */

import { roundUsd2, splitNotIncludedForDisplay } from '@/utils/pricingSectionDisplay'
import {
  shouldOmitAdditionalDiscountAndCostFromCompanyRevenueSum,
  shouldOmitOtaExtrasFromCompanyRevenueSum,
} from '@/utils/channelSettlement'

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
}

export function computeStoredCompanyRevenueFields(
  inp: StoredCompanyRevenueComputeInput
): { company_total_revenue: number; operating_profit: number } {
  const st = String(inp.reservationStatus || '').toLowerCase().trim()
  const isReservationCancelled = st === 'cancelled' || st === 'canceled'
  const prepTip = Number(inp.prepaymentTip) || 0

  const omitAdditionalDiscountAndCostFromRevenueSum =
    inp.omitAdditionalDiscountAndCostFromSumOverride !== undefined
      ? inp.omitAdditionalDiscountAndCostFromSumOverride
      : shouldOmitAdditionalDiscountAndCostFromCompanyRevenueSum({
          usesStoredChannelSettlement: inp.omitCtx.usesStoredChannelSettlement,
          isOTAChannel: inp.isOTAChannel,
          depositAmount: inp.omitCtx.depositAmount,
          onlinePaymentAmount: inp.omitCtx.onlinePaymentAmount,
          channelPaymentGross: inp.omitCtx.channelPaymentGross,
        })

  if (isReservationCancelled && !inp.isOTAChannel) {
    const ch = roundUsd2(Math.max(0, Number(inp.channelSettlementBase) || 0))
    /** 비-OTA 취소: 투어 환불은 ③ 정산 net에 반영 — 저장 총매출은 정산 베이스(OTA 취소와 동일: refb 재차감 없음) */
    return {
      company_total_revenue: ch,
      operating_profit: roundUsd2(ch - prepTip),
    }
  }

  const refb = inp.refundAmountForCompanyRevenueBlock

  if (isReservationCancelled && inp.isOTAChannel) {
    const ch = roundUsd2(Math.max(0, Number(inp.channelSettlementBase) || 0))
    const tr = roundUsd2(ch - refb)
    return {
      company_total_revenue: tr,
      operating_profit: roundUsd2(tr - prepTip),
    }
  }

  const cpn = inp.customerPaymentNetForRevenueBase
  if (
    !isReservationCancelled &&
    !inp.isOTAChannel &&
    cpn != null &&
    Number.isFinite(Number(cpn))
  ) {
    let tr = roundUsd2(Math.max(0, Number(cpn) || 0))
    if (refb > 0.005) {
      tr -= refb
    }
    if (inp.isHomepageBooking && (Number(inp.additionalCost) || 0) > 0.005) {
      const ac = Number(inp.additionalCost) || 0
      tr -= ac
    }
    tr = roundUsd2(tr)
    return {
      company_total_revenue: tr,
      operating_profit: roundUsd2(tr - prepTip),
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

  if (!omitOtaExtras && inp.reservationOptionsActiveSum > 0 && inp.isOTAChannel) {
    tr += inp.reservationOptionsActiveSum
  }

  if (!omitOtaExtras && !isReservationCancelled) {
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
    }
    if (residentFeesUsd > 0.005) {
      tr += residentFeesUsd
    }
  }

  const omitDiscCostEffective =
    (omitAdditionalDiscountAndCostFromRevenueSum &&
      !(inp.isOTAChannel && !isReservationCancelled)) ||
    omitOtaExtras

  if (!omitDiscCostEffective) {
    const disc = Number(inp.additionalDiscount) || 0
    if (disc > 0.005 && !inp.isHomepageBooking) {
      tr -= disc
    }
    const ac = Number(inp.additionalCost) || 0
    if (ac > 0.005 && !inp.isHomepageBooking) {
      tr += ac
    }
  }

  if (!omitOtaExtras) {
    const tax = Number(inp.tax) || 0
    if (tax > 0.005) {
      tr += tax
    }

    const ppc = Number(inp.prepaymentCost) || 0
    if (ppc > 0.005 && !inp.isHomepageBooking) {
      tr += ppc
    }
  }

  if (inp.isOTAChannel && !isReservationCancelled && !omitOtaExtras) {
    const cf = Number(inp.cardFee) || 0
    if (cf > 0.005) {
      tr += cf
    }
    if (prepTip > 0.005) {
      tr += prepTip
    }
  }

  if (refb > 0.005) {
    tr -= refb
  }

  if (inp.isHomepageBooking && (Number(inp.additionalCost) || 0) > 0.005) {
    const ac = Number(inp.additionalCost) || 0
    tr -= ac
  }

  tr = roundUsd2(tr)
  return {
    company_total_revenue: tr,
    operating_profit: roundUsd2(tr - prepTip),
  }
}
