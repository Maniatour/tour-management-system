/**
 * 예약 가격 저장 시 product_price_total / total_price 단일 산식.
 * PricingSection ① 고객 총 결제(화면)와 동일 구성 요소를 사용해
 * `formData.totalPrice + not_included×인원` 이중·누락 가산을 막는다.
 */
import { computeProductPriceTotal, isChannelSinglePrice, getPerPersonChargePax } from '@/lib/productPriceTotal'
import {
  computePricingSectionCustomerPaymentGrossLike,
  computePricingSectionCustomerPaymentNet,
} from '@/utils/pricingSectionCustomerTotals'
import { sumResidentFeeAmountsUsd } from '@/utils/usResidentChoiceSync'

function roundUsd2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

export type PricingSavePartyInput = {
  pricingAdults?: number | null
  adults?: number | null
  child?: number | null
  infant?: number | null
}

export type PricingSaveAmountInput = {
  adultProductPrice?: number | null | undefined
  childProductPrice?: number | null | undefined
  infantProductPrice?: number | null | undefined
  /** 폼 판매가 합(불포함 미포함이 정상). 단가 재계산이 0일 때만 fallback */
  productPriceTotal?: number | null | undefined
  not_included_price?: number | null | undefined
  /** PricingSection notIncludedBreakdown.totalUsd 와 동기화된 값(거주비 포함) */
  choiceNotIncludedTotal?: number | null | undefined
  residentStatusAmounts?: Partial<Record<string, number>> | null | undefined
  couponDiscount?: number | null | undefined
  additionalDiscount?: number | null | undefined
  additionalCost?: number | null | undefined
  tax?: number | null | undefined
  cardFee?: number | null | undefined
  prepaymentCost?: number | null | undefined
  prepaymentTip?: number | null | undefined
  refundAmount?: number | null | undefined
  status?: string | null | undefined
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** 청구 인원. 단일가 채널은 성인 칸에 총원을 넣은 경우 아동을 다시 더하지 않음 */
export function billingPaxForPricingSave(
  party: PricingSavePartyInput,
  channel?: { pricing_type?: string | null } | null
): number {
  return getPerPersonChargePax({
    isSinglePrice: isChannelSinglePrice(channel),
    pricingAdults: toNum(party.pricingAdults ?? party.adults),
    reservationAdults: toNum(party.adults),
    child: toNum(party.child),
    infant: toNum(party.infant),
  })
}

/**
 * 판매가×인원(불포함 제외). 단가 재계산을 우선하고,
 * 폼 productPriceTotal 이 이미 불포함을 포함한 것처럼 보이면 불포함을 제거한다.
 */
export function resolveBaseProductPriceTotalForSave(
  amounts: PricingSaveAmountInput,
  party: PricingSavePartyInput,
  channel?: { pricing_type?: string | null } | null
): number {
  const pricingAdults = Math.max(
    0,
    Math.floor(toNum(party.pricingAdults ?? party.adults))
  )
  const child = Math.max(0, Math.floor(toNum(party.child)))
  const infant = Math.max(0, Math.floor(toNum(party.infant)))
  const computed = computeProductPriceTotal({
    isSinglePrice: isChannelSinglePrice(channel),
    adultProductPrice: toNum(amounts.adultProductPrice),
    childProductPrice: toNum(amounts.childProductPrice),
    infantProductPrice: toNum(amounts.infantProductPrice),
    pricingAdults,
    reservationAdults: Math.max(0, Math.floor(toNum(party.adults))),
    child,
    infant,
  })
  const stored = roundUsd2(toNum(amounts.productPriceTotal))
  const billingPax = billingPaxForPricingSave(party, channel) || 1
  const fieldNi = roundUsd2(toNum(amounts.not_included_price) * billingPax)

  if (computed > 0.005) {
    // 폼 값이 단가합+불포함이면 단가합만 사용
    if (fieldNi > 0.005 && Math.abs(stored - roundUsd2(computed + fieldNi)) <= 0.02) {
      return roundUsd2(computed)
    }
    return roundUsd2(computed)
  }

  if (fieldNi > 0.005 && stored > fieldNi + 0.01) {
    const stripped = roundUsd2(stored - fieldNi)
    if (stripped > 0.005) return stripped
  }
  return stored
}

/** 고객 총액에 넣을 불포함(필드×인원 + 거주 현장비, 또는 폼 choiceNotIncludedTotal) */
export function resolveNotIncludedTotalUsdForCustomerPayment(
  amounts: PricingSaveAmountInput,
  party: PricingSavePartyInput,
  channel?: { pricing_type?: string | null } | null
): number {
  const billingPax = billingPaxForPricingSave(party, channel) || 1
  const fieldNi = roundUsd2(toNum(amounts.not_included_price) * billingPax)
  const residentNi = roundUsd2(
    sumResidentFeeAmountsUsd(
      amounts.residentStatusAmounts as Parameters<typeof sumResidentFeeAmountsUsd>[0]
    )
  )
  const fromParts = roundUsd2(fieldNi + residentNi)
  const fromChoice = roundUsd2(toNum(amounts.choiceNotIncludedTotal))
  return Math.max(fromParts, fromChoice)
}

/** DB product_price_total 에 넣을 불포함(1인당 필드 × 청구 인원만 — 거주비는 total_price 쪽) */
export function resolveNotIncludedFieldTotalForProductSave(
  amounts: PricingSaveAmountInput,
  party: PricingSavePartyInput,
  channel?: { pricing_type?: string | null } | null
): number {
  const billingPax = billingPaxForPricingSave(party, channel) || 1
  return roundUsd2(toNum(amounts.not_included_price) * billingPax)
}

export type ComputePricingTotalsForDbSaveParams = {
  amounts: PricingSaveAmountInput
  party: PricingSavePartyInput
  channel?: { pricing_type?: string | null } | null
  /** reservation_options 활성 합 (PricingSection reservationOptionsTotalPrice) */
  reservationOptionsTotalUsd: number
  returnedAmount?: number
}

export type PricingTotalsForDbSave = {
  billingPax: number
  baseProductPriceTotal: number
  notIncludedFieldTotal: number
  notIncludedCustomerTotal: number
  productPriceTotal: number
  subtotal: number
  totalPrice: number
}

/**
 * DB에 쓸 product_price_total / subtotal / total_price.
 * total_price = PricingSection ① 화면 산식(Returned 반영)과 동일.
 */
export function computePricingTotalsForDbSave(
  params: ComputePricingTotalsForDbSaveParams
): PricingTotalsForDbSave {
  const { amounts, party, channel } = params
  const billingPax = billingPaxForPricingSave(party, channel)
  const baseProductPriceTotal = resolveBaseProductPriceTotalForSave(amounts, party, channel)
  const notIncludedFieldTotal = resolveNotIncludedFieldTotalForProductSave(amounts, party, channel)
  const notIncludedCustomerTotal = resolveNotIncludedTotalUsdForCustomerPayment(amounts, party, channel)
  const productPriceTotal = roundUsd2(baseProductPriceTotal + notIncludedFieldTotal)
  const optionsTotal = Math.max(0, roundUsd2(params.reservationOptionsTotalUsd))

  const gross = computePricingSectionCustomerPaymentGrossLike({
    status: amounts.status ?? null,
    productPriceTotal: baseProductPriceTotal,
    couponDiscount: toNum(amounts.couponDiscount),
    additionalDiscount: toNum(amounts.additionalDiscount),
    reservationOptionsTotalUsd: optionsTotal,
    notIncludedTotalUsd: notIncludedCustomerTotal,
    additionalCost: toNum(amounts.additionalCost),
    tax: toNum(amounts.tax),
    cardFee: toNum(amounts.cardFee),
    prepaymentCost: toNum(amounts.prepaymentCost),
    prepaymentTip: toNum(amounts.prepaymentTip),
  })
  // gross 산식에 이미 refund_amount 차감이 없으므로 net 쪽에서 수동 환불·Returned 처리
  // computePricingSectionCustomerPaymentGrossLike 는 refund 미차감 — PricingSection gross는 refund를 뺀다.
  const manualRefund = Math.max(0, toNum(amounts.refundAmount))
  const grossAfterManualRefund = Math.max(0, roundUsd2(gross - manualRefund))
  const totalPrice = computePricingSectionCustomerPaymentNet(
    grossAfterManualRefund,
    params.returnedAmount ?? 0,
    manualRefund
  )

  const subtotal = roundUsd2(baseProductPriceTotal + optionsTotal + notIncludedCustomerTotal)

  return {
    billingPax,
    baseProductPriceTotal,
    notIncludedFieldTotal,
    notIncludedCustomerTotal,
    productPriceTotal,
    subtotal,
    totalPrice,
  }
}
