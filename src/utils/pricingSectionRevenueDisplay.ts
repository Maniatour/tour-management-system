import { roundUsd2 } from '@/utils/pricingSectionDisplay'

/** PricingSection 우측 「4. 최종 매출 & 운영 이익」의 총 매출 표시값과 동일 */
export type PricingSectionRevenueDisplayInput = {
  isReservationCancelled: boolean
  isOTAChannel: boolean
  channelSettlementBeforePartnerReturn: number
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
  /** 홈페이지 직예약: 추가비용은 회사 총 매출·운영 이익에 포함하지 않음 */
  excludeHomepageAdditionalCostFromCompanyTotals: boolean
}

export function computePricingSectionDisplayTotalRevenue(inp: PricingSectionRevenueDisplayInput): number {
  if (inp.isReservationCancelled) {
    if (inp.isOTAChannel) return roundUsd2(inp.channelSettlementBeforePartnerReturn)
    return 0
  }
  let totalRevenue = inp.channelSettlementBeforePartnerReturn
  if (inp.reservationOptionsTotalPrice > 0 && inp.isOTAChannel) {
    totalRevenue += inp.reservationOptionsTotalPrice
  }
  if (inp.notIncludedTotalUsd > 0) {
    totalRevenue += inp.notIncludedTotalUsd
  }
  if (!inp.omitAdditionalDiscountAndCostFromSum) {
    if (inp.additionalDiscount > 0) totalRevenue -= inp.additionalDiscount
    if (inp.additionalCost > 0) totalRevenue += inp.additionalCost
  }
  if (inp.tax > 0) totalRevenue += inp.tax
  // card_fee: 채널 결제 금액·정산 산식에 이미 포함 — 이중 가산하지 않음
  if (inp.prepaymentCost > 0) totalRevenue += inp.prepaymentCost
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
