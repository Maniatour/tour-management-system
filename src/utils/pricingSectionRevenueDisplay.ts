import {
  shouldOmitOtaExtrasFromCompanyRevenueSum,
  otaReservationOptionsForCompanyRevenue,
  otaPricingFormExtrasForCompanyRevenue,
} from '@/utils/channelSettlement'
import { roundUsd2 } from '@/utils/pricingSectionDisplay'
import { isNoShowReservationStatus } from '@/lib/reservationStatus'
import { computePrepaymentTipOperatingDeduction } from '@/utils/storedCompanyRevenue'

/** PricingSection 우측 「4. 최종 매출 & 운영 이익」의 총 매출 표시값과 동일 */
export type PricingSectionRevenueDisplayInput = {
  isReservationCancelled: boolean
  isOTAChannel: boolean
  channelSettlementBeforePartnerReturn: number
  reservationExpensesTotal: number
  reservationOptionsTotalPrice: number
  notIncludedTotalUsd: number
  additionalDiscount: number
  additionalCost: number
  tax: number
  prepaymentCost: number
  prepaymentTip: number
  refundedAmount: number
  /** 채널 정산·결제에 추가할인/추가비용이 이미 반영된 경우 true — 총 매출에서 이중 반영 방지 */
  omitAdditionalDiscountAndCostFromSum: boolean
  /** 자체(홈페이지) 직예약: 추가할인·선결제 지출은 ④에 반영하지 않음(상단·채널 결제에 이미 반영) · 추가비용은 회사 총 매출·운영 이익 합에서 제외 */
  excludeHomepageAdditionalCostFromCompanyTotals: boolean
  /** Self·진행: ① 고객 총 결제(넷) — `channelSettlementBeforePartnerReturn` 대신 베이스로 사용 */
  customerPaymentNetAsRevenueBase?: number | null
  /** OTA·진행: ④에 가산하는 폼 카드수수료 */
  cardFeeForCompanyRevenue?: number
  customerPaymentNetForOtaOmitCheck?: number
  commissionAmount?: number
  channelPaymentNet?: number
  reservationStatus?: string | null
  /** ① 고객 총 결제(gross) — 선결제 팁 환불 구간 판정용 */
  customerPaymentGross?: number | null
  /** 취소·비-OTA: 입금 순수령 — 선결제 팁 환불 판정 보조 */
  cancelledNetCollectedFromPayments?: number | null
}

export function computePricingSectionDisplayTotalRevenue(inp: PricingSectionRevenueDisplayInput): number {
  if (isNoShowReservationStatus(inp.reservationStatus)) {
    return roundUsd2(inp.channelSettlementBeforePartnerReturn - inp.reservationExpensesTotal)
  }

  if (inp.isReservationCancelled) {
    if (inp.isOTAChannel) {
      return roundUsd2(inp.channelSettlementBeforePartnerReturn - inp.reservationExpensesTotal)
    }
    return 0
  }

  const useCustomerBase =
    !inp.isOTAChannel &&
    inp.customerPaymentNetAsRevenueBase != null &&
    Number.isFinite(Number(inp.customerPaymentNetAsRevenueBase))

  let totalRevenue = useCustomerBase
    ? Number(inp.customerPaymentNetAsRevenueBase) - inp.reservationExpensesTotal
    : inp.channelSettlementBeforePartnerReturn - inp.reservationExpensesTotal

  const omitOtaExtras = shouldOmitOtaExtrasFromCompanyRevenueSum({
    isOTAChannel: inp.isOTAChannel,
    isReservationCancelled: inp.isReservationCancelled,
    channelSettlementBase: inp.channelSettlementBeforePartnerReturn,
    customerPaymentNet: Number(inp.customerPaymentNetForOtaOmitCheck) || 0,
    commissionAmount: Number(inp.commissionAmount) || 0,
    channelPaymentNet: Number(inp.channelPaymentNet) || 0,
  })

  if (useCustomerBase) {
    /** ① 고객 총 결제(넷)에 추가할인·투어환불·입금 Refunded가 이미 반영됨 — 환불 재차감 없음 */
    return roundUsd2(totalRevenue)
  }

  totalRevenue += otaReservationOptionsForCompanyRevenue({
    isOTAChannel: inp.isOTAChannel,
    reservationOptionsTotalPrice: inp.reservationOptionsTotalPrice,
    omitOtaExtras,
    customerPaymentNet: Number(inp.customerPaymentNetForOtaOmitCheck) || 0,
    channelPaymentNet: Number(inp.channelPaymentNet) || 0,
  })
  /** 불포함(입장권·비거주자 비용)은 OTA 판매가에 포함되지 않는 별도 수금이라 omitOtaExtras와 무관하게 항상 가산 */
  if (inp.notIncludedTotalUsd > 0) {
    totalRevenue += inp.notIncludedTotalUsd
  }

  const formExtras = otaPricingFormExtrasForCompanyRevenue({
    isOTAChannel: inp.isOTAChannel,
    omitOtaExtras,
    additionalDiscount: inp.additionalDiscount,
    additionalCost: inp.additionalCost,
    tax: inp.tax,
    cardFee: Number(inp.cardFeeForCompanyRevenue) || 0,
    prepaymentCost: inp.prepaymentCost,
    customerPaymentNet: Number(inp.customerPaymentNetForOtaOmitCheck) || 0,
    channelPaymentNet: Number(inp.channelPaymentNet) || 0,
    notIncludedTotalUsd: inp.notIncludedTotalUsd,
    reservationOptionsTotalPrice: inp.reservationOptionsTotalPrice,
  })

  if (formExtras.additionalDiscount > 0 && !inp.excludeHomepageAdditionalCostFromCompanyTotals) {
    totalRevenue -= formExtras.additionalDiscount
  }
  if (formExtras.additionalCost > 0) {
    totalRevenue += formExtras.additionalCost
  }
  if (formExtras.tax > 0) {
    totalRevenue += formExtras.tax
  }
  if (formExtras.prepaymentCost > 0 && !inp.excludeHomepageAdditionalCostFromCompanyTotals) {
    totalRevenue += formExtras.prepaymentCost
  }
  if (inp.isOTAChannel && !inp.isReservationCancelled && formExtras.cardFee > 0.005) {
    totalRevenue += formExtras.cardFee
  }

  const ptip = Number(inp.prepaymentTip) || 0
  if (inp.isOTAChannel && !inp.isReservationCancelled && !omitOtaExtras && ptip > 0.005) {
    totalRevenue += ptip
  }

  if (!omitOtaExtras) {
    totalRevenue -= inp.refundedAmount
  }
  if (inp.excludeHomepageAdditionalCostFromCompanyTotals && inp.additionalCost > 0) {
    totalRevenue -= inp.additionalCost
  }
  return roundUsd2(totalRevenue)
}

export function computePricingSectionDisplayOperatingProfit(inp: PricingSectionRevenueDisplayInput): number {
  const totalRevenue = computePricingSectionDisplayTotalRevenue(inp)
  const tipDeduction = computePrepaymentTipOperatingDeduction({
    prepaymentTip: Number(inp.prepaymentTip) || 0,
    isReservationCancelled: inp.isReservationCancelled,
    isOTAChannel: inp.isOTAChannel,
    refundAmountForCompanyRevenueBlock: Number(inp.refundedAmount) || 0,
    customerPaymentGross: inp.customerPaymentGross ?? null,
    cancelledNetCollectedFromPayments: inp.cancelledNetCollectedFromPayments ?? null,
    totalRevenue,
    refundedFromRecords: inp.refundedAmount,
  })

  if (isNoShowReservationStatus(inp.reservationStatus)) {
    return roundUsd2(totalRevenue - tipDeduction)
  }

  if (inp.isReservationCancelled) {
    if (inp.isOTAChannel) {
      return roundUsd2(inp.channelSettlementBeforePartnerReturn - tipDeduction)
    }
    if (totalRevenue <= 0.005) {
      return 0
    }
    return roundUsd2(totalRevenue - tipDeduction)
  }
  return roundUsd2(totalRevenue - tipDeduction)
}
