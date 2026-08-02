import type { PaymentRecordLike } from '@/utils/reservationPricingBalance'
import type { PricingEngineContext } from '@/lib/pricingEngine/types'

export type BuildPricingEngineContextInput = {
  reservationStatus?: string | null
  channelId?: string | null
  isOtaChannel: boolean
  isHomepageBooking: boolean

  adults?: number
  children?: number
  infants?: number
  pricingAdults?: number

  productPriceTotal?: number
  adultProductPrice?: number
  childProductPrice?: number
  infantProductPrice?: number
  couponDiscount?: number
  additionalDiscount?: number
  additionalCost?: number
  tax?: number
  cardFee?: number
  prepaymentCost?: number
  prepaymentTip?: number
  manualRefundAmount?: number
  privateTourAdditionalCost?: number

  reservationOptionsTotal?: number
  requiredOptionTotal?: number
  optionTotal?: number
  notIncludedTotalUsd?: number
  notIncludedBaseUsd?: number
  notIncludedResidentFeesUsd?: number

  depositAmount?: number
  onlinePaymentAmount?: number
  commissionAmount?: number
  commissionPercent?: number
  commissionBasePriceStored?: number | null
  channelSettlementAmountStored?: number | null
  balanceAmountStored?: number | null
  totalPriceStored?: number | null

  usesStoredChannelSettlement?: boolean
  channelPricingFieldsUserEdited?: boolean

  paymentRecords?: PaymentRecordLike[]
  reservationExpensesTotal?: number
  optionCancelRefundUsd?: number
  tourExpensesTotal?: number
  partnerReceivedAmount?: number
}

function n(v: unknown, fallback = 0): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : fallback
}

/** PricingSection·Balance 테이블 등에서 공통으로 쓰는 컨텍스트 조립 */
export function buildPricingEngineContext(
  input: BuildPricingEngineContextInput
): PricingEngineContext {
  return {
    reservationStatus: input.reservationStatus ?? null,
    channelId: input.channelId ?? null,
    isOtaChannel: input.isOtaChannel,
    isHomepageBooking: input.isHomepageBooking,

    adults: n(input.adults),
    children: n(input.children),
    infants: n(input.infants),
    pricingAdults: n(input.pricingAdults, n(input.adults)),

    productPriceTotal: n(input.productPriceTotal),
    adultProductPrice: n(input.adultProductPrice),
    childProductPrice: n(input.childProductPrice),
    infantProductPrice: n(input.infantProductPrice),
    couponDiscount: n(input.couponDiscount),
    additionalDiscount: n(input.additionalDiscount),
    additionalCost: n(input.additionalCost),
    tax: n(input.tax),
    cardFee: n(input.cardFee),
    prepaymentCost: n(input.prepaymentCost),
    prepaymentTip: n(input.prepaymentTip),
    manualRefundAmount: n(input.manualRefundAmount),
    privateTourAdditionalCost: n(input.privateTourAdditionalCost),

    reservationOptionsTotal: n(input.reservationOptionsTotal),
    requiredOptionTotal: n(input.requiredOptionTotal),
    optionTotal: n(input.optionTotal),
    notIncludedTotalUsd: n(input.notIncludedTotalUsd),
    notIncludedBaseUsd: n(input.notIncludedBaseUsd),
    notIncludedResidentFeesUsd: n(input.notIncludedResidentFeesUsd),

    depositAmount: n(input.depositAmount),
    onlinePaymentAmount: n(input.onlinePaymentAmount),
    commissionAmount: n(input.commissionAmount),
    commissionPercent: n(input.commissionPercent),
    commissionBasePriceStored: input.commissionBasePriceStored ?? null,
    channelSettlementAmountStored: input.channelSettlementAmountStored ?? null,
    balanceAmountStored: input.balanceAmountStored ?? null,
    totalPriceStored: input.totalPriceStored ?? null,

    usesStoredChannelSettlement: Boolean(input.usesStoredChannelSettlement),
    channelPricingFieldsUserEdited: Boolean(input.channelPricingFieldsUserEdited),

    paymentRecords: input.paymentRecords ?? [],
    reservationExpensesTotal: n(input.reservationExpensesTotal),
    optionCancelRefundUsd: n(input.optionCancelRefundUsd),
    tourExpensesTotal: n(input.tourExpensesTotal),
    partnerReceivedAmount: n(input.partnerReceivedAmount),
  }
}
