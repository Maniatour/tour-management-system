import {
  computeChannelPaymentAfterReturn,
  deriveCommissionGrossForSettlement,
} from '@/utils/channelSettlement'
import { roundUsd2 } from '@/utils/pricingSectionDisplay'

export type ChannelSettlementStatsPricingExtras = {
  notIncludedPrice: number
  onlinePaymentAmount: number
  prepaymentCost: number
  commissionBasePrice: number | null
}

export type ChannelSettlementStatsItemLike = {
  status: string
  totalPrice: number
  productPriceTotal?: number
  couponDiscount?: number
  additionalDiscount?: number
  additionalCost?: number
  optionTotal?: number
  depositAmount?: number
  balanceAmount?: number
  cardFee?: number
  prepaymentTip?: number
  commissionAmount?: number
  commissionBasePrice?: number
  channelSettlementAmount?: number | null
  pricingCommissionPercent?: number | null
  channelId?: string
  pricingAdults?: number | null
  adults?: number
  child?: number
  infant?: number
  refundAmount?: number
  /** enrich 또는 산식 */
  companyTotalRevenue?: number
  /** DB reservation_pricing.company_total_revenue */
  dbCompanyTotalRevenue?: number | null
  /** DB reservation_pricing.operating_profit */
  dbOperatingProfit?: number | null
}

export type ChannelSettlementPricingCalcDisplay = {
  customerTotalPayment: number
  channelPaymentAmount: number
  channelCommissionPercent: number | null
  channelSettlementAmount: number | null
  companyTotalRevenue: number
  operatingProfit: number
}

type ChannelMasterLike = {
  id: string
  commission_percent?: number | null
  commission_rate?: number | null
  commission?: number | null
}

function invoiceChannelCommissionPercent(ch: ChannelMasterLike): number {
  let p = Number(ch.commission_percent ?? ch.commission_rate ?? ch.commission ?? 0)
  if (!Number.isFinite(p)) p = 0
  if (p > 0 && p <= 1) p = p * 100
  return Math.round(p * 100) / 100
}

/** 예약 pricing % 우선, 없으면 채널 마스터 */
export function effectiveCommissionPercentForStats(
  item: ChannelSettlementStatsItemLike,
  channelsList: ChannelMasterLike[] | null | undefined
): number | null {
  const fromPricing = item.pricingCommissionPercent
  if (fromPricing != null && Number.isFinite(fromPricing)) {
    return fromPricing
  }
  if (!item.channelId || !channelsList?.length) return null
  const ch = channelsList.find((c) => c.id === item.channelId)
  return ch ? invoiceChannelCommissionPercent(ch) : null
}

/** PricingSection ③ 채널 결제 금액과 동일 */
export function channelPaymentAmountForStats(
  item: ChannelSettlementStatsItemLike,
  returnedAmount: number,
  isOta: boolean,
  partnerReceived: number
): number {
  const storedCb = Number(item.commissionBasePrice ?? 0)
  const online = deriveCommissionGrossForSettlement(storedCb, {
    returnedAmount,
    depositAmount: item.depositAmount ?? 0,
    productPriceTotal: item.productPriceTotal ?? 0,
    isOTAChannel: isOta,
  })
  let pay = computeChannelPaymentAfterReturn({
    depositAmount: item.depositAmount ?? 0,
    onlinePaymentAmount: online,
    productPriceTotal: item.productPriceTotal ?? 0,
    couponDiscount: item.couponDiscount ?? 0,
    additionalDiscount: item.additionalDiscount ?? 0,
    optionTotalSum: item.optionTotal ?? 0,
    additionalCost: item.additionalCost ?? 0,
    tax: 0,
    cardFee: item.cardFee ?? 0,
    prepaymentTip: item.prepaymentTip ?? 0,
    onSiteBalanceAmount: item.balanceAmount ?? 0,
    returnedAmount,
    commissionAmount: item.commissionAmount ?? 0,
    reservationStatus: item.status,
    isOTAChannel: isOta,
  })
  const pr = Number(partnerReceived) || 0
  if (isOta && pr > 0 && pay > pr + 0.005) {
    pay = pr
  }
  return pay
}

/** 예약 수정 · 가격정보 · 가격 계산 블록과 동일한 6개 금액 */
export function buildChannelSettlementPricingCalcDisplay(
  item: ChannelSettlementStatsItemLike,
  ctx: {
    returnedAmount: number
    partnerReceived: number
    isOta: boolean
    channels: ChannelMasterLike[] | null | undefined
    computedCompanyTotalRevenue?: number
  }
): ChannelSettlementPricingCalcDisplay {
  const customerTotalPayment = roundUsd2(Number(item.totalPrice) || 0)
  const channelPaymentAmount = roundUsd2(
    channelPaymentAmountForStats(item, ctx.returnedAmount, ctx.isOta, ctx.partnerReceived)
  )
  const channelCommissionPercent = effectiveCommissionPercentForStats(item, ctx.channels)
  const channelSettlementAmount =
    item.channelSettlementAmount != null && Number.isFinite(Number(item.channelSettlementAmount))
      ? roundUsd2(Number(item.channelSettlementAmount))
      : null

  const companyTotalRevenue =
    item.dbCompanyTotalRevenue != null && Number.isFinite(Number(item.dbCompanyTotalRevenue))
      ? roundUsd2(Number(item.dbCompanyTotalRevenue))
      : ctx.computedCompanyTotalRevenue != null && Number.isFinite(ctx.computedCompanyTotalRevenue)
        ? roundUsd2(ctx.computedCompanyTotalRevenue)
        : 0

  const operatingProfit =
    item.dbOperatingProfit != null && Number.isFinite(Number(item.dbOperatingProfit))
      ? roundUsd2(Number(item.dbOperatingProfit))
      : roundUsd2(companyTotalRevenue - (Number(item.prepaymentTip) || 0))

  return {
    customerTotalPayment,
    channelPaymentAmount,
    channelCommissionPercent,
    channelSettlementAmount,
    companyTotalRevenue,
    operatingProfit,
  }
}

export function formatChannelSettlementRegistrationDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function formatUsdStatsCell(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatPercentStatsCell(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(Number(p))) return '—'
  return `${p}%`
}

export type PricingCalcTotals = {
  customerTotalPayment: number
  channelPaymentAmount: number
  channelSettlementAmount: number
  companyTotalRevenue: number
  operatingProfit: number
}

export function aggregatePricingCalcTotals(
  items: ChannelSettlementStatsItemLike[],
  buildDisplay: (item: ChannelSettlementStatsItemLike) => ChannelSettlementPricingCalcDisplay
): PricingCalcTotals {
  return items.reduce(
    (acc, item) => {
      const d = buildDisplay(item)
      return {
        customerTotalPayment: acc.customerTotalPayment + d.customerTotalPayment,
        channelPaymentAmount: acc.channelPaymentAmount + d.channelPaymentAmount,
        channelSettlementAmount: acc.channelSettlementAmount + (d.channelSettlementAmount ?? 0),
        companyTotalRevenue: acc.companyTotalRevenue + d.companyTotalRevenue,
        operatingProfit: acc.operatingProfit + d.operatingProfit,
      }
    },
    {
      customerTotalPayment: 0,
      channelPaymentAmount: 0,
      channelSettlementAmount: 0,
      companyTotalRevenue: 0,
      operatingProfit: 0,
    }
  )
}
