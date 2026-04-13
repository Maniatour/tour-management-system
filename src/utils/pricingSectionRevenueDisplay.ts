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
}

export function computePricingSectionDisplayTotalRevenue(inp: PricingSectionRevenueDisplayInput): number {
  if (inp.isReservationCancelled) {
    if (inp.isOTAChannel) return Math.max(0, roundUsd2(inp.channelSettlementBeforePartnerReturn))
    return 0
  }
  let totalRevenue = inp.channelSettlementBeforePartnerReturn
  if (inp.reservationOptionsTotalPrice > 0 && inp.isOTAChannel) {
    totalRevenue += inp.reservationOptionsTotalPrice
  }
  if (inp.notIncludedTotalUsd > 0) {
    totalRevenue += inp.notIncludedTotalUsd
  }
  if (inp.additionalDiscount > 0) totalRevenue -= inp.additionalDiscount
  if (inp.additionalCost > 0) totalRevenue += inp.additionalCost
  if (inp.tax > 0) totalRevenue += inp.tax
  // card_fee: 채널 결제 금액·정산 산식에 이미 포함 — 이중 가산하지 않음
  if (inp.prepaymentCost > 0) totalRevenue += inp.prepaymentCost
  totalRevenue -= inp.refundedAmount
  return Math.max(0, roundUsd2(totalRevenue))
}

export function computePricingSectionDisplayOperatingProfit(inp: PricingSectionRevenueDisplayInput): number {
  if (inp.isReservationCancelled) {
    if (inp.isOTAChannel) {
      return Math.max(0, roundUsd2(inp.channelSettlementBeforePartnerReturn - inp.prepaymentTip))
    }
    return 0
  }
  const totalRevenue = computePricingSectionDisplayTotalRevenue(inp)
  return Math.max(0, roundUsd2(totalRevenue - inp.prepaymentTip))
}
