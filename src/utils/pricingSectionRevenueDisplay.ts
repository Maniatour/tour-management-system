import { shouldOmitOtaExtrasFromCompanyRevenueSum } from '@/utils/channelSettlement'
import { roundUsd2 } from '@/utils/pricingSectionDisplay'

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
}

export function computePricingSectionDisplayTotalRevenue(inp: PricingSectionRevenueDisplayInput): number {
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
    totalRevenue -= inp.refundedAmount
    if (inp.excludeHomepageAdditionalCostFromCompanyTotals && inp.additionalCost > 0) {
      totalRevenue -= inp.additionalCost
    }
    return roundUsd2(totalRevenue)
  }

  if (!omitOtaExtras) {
    if (inp.reservationOptionsTotalPrice > 0 && inp.isOTAChannel) {
      totalRevenue += inp.reservationOptionsTotalPrice
    }
    if (inp.notIncludedTotalUsd > 0) {
      totalRevenue += inp.notIncludedTotalUsd
    }
  }

  const omitDiscCostEffective =
    (inp.omitAdditionalDiscountAndCostFromSum &&
      !(inp.isOTAChannel && !inp.isReservationCancelled)) ||
    omitOtaExtras

  if (!omitDiscCostEffective) {
    if (inp.additionalDiscount > 0 && !inp.excludeHomepageAdditionalCostFromCompanyTotals) {
      totalRevenue -= inp.additionalDiscount
    }
    if (inp.additionalCost > 0) totalRevenue += inp.additionalCost
  }
  if (!omitOtaExtras) {
    if (inp.tax > 0) totalRevenue += inp.tax
    if (inp.prepaymentCost > 0 && !inp.excludeHomepageAdditionalCostFromCompanyTotals) {
      totalRevenue += inp.prepaymentCost
    }
  }

  const cf = Number(inp.cardFeeForCompanyRevenue) || 0
  if (inp.isOTAChannel && !inp.isReservationCancelled && !omitOtaExtras && cf > 0.005) {
    totalRevenue += cf
  }

  const ptip = Number(inp.prepaymentTip) || 0
  if (inp.isOTAChannel && !inp.isReservationCancelled && !omitOtaExtras && ptip > 0.005) {
    totalRevenue += ptip
  }

  totalRevenue -= inp.refundedAmount
  if (inp.excludeHomepageAdditionalCostFromCompanyTotals && inp.additionalCost > 0) {
    totalRevenue -= inp.additionalCost
  }
  return roundUsd2(totalRevenue)
}

export function computePricingSectionDisplayOperatingProfit(inp: PricingSectionRevenueDisplayInput): number {
  if (inp.isReservationCancelled) {
    if (inp.isOTAChannel) {
      return roundUsd2(inp.channelSettlementBeforePartnerReturn - inp.prepaymentTip)
    }
    return 0
  }
  const totalRevenue = computePricingSectionDisplayTotalRevenue(inp)
  return roundUsd2(totalRevenue - inp.prepaymentTip)
}
