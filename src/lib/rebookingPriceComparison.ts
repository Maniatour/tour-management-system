import type { CancellationFollowUpMessageLocale } from '@/lib/cancellationFollowUpMessage'
import type { ReservationChoiceRowForRebooking } from '@/lib/customerRebookingUrl'
import {
  computeCustomerPaymentTotalLineFormula,
  pricingFieldToNumber,
  type PartySizeSource,
} from '@/utils/reservationPricingBalance'

export type RebookingPricingSnapshot = {
  product_price_total?: number | null
  not_included_price?: number | null
  choices_total?: number | null
  option_total?: number | null
  required_option_total?: number | null
  subtotal?: number | null
  total_price?: number | null
  pricing_adults?: number | null
  adult_product_price?: number | null
  child_product_price?: number | null
  infant_product_price?: number | null
  coupon_discount?: number | null
  additional_discount?: number | null
  additional_cost?: number | null
  tax?: number | null
  card_fee?: number | null
  prepayment_cost?: number | null
  prepayment_tip?: number | null
  private_tour_additional_cost?: number | null
  refund_amount?: number | null
}

export type RebookingDirectDynamicPricing = {
  adult_price?: number | null
  child_price?: number | null
  infant_price?: number | null
  not_included_price?: number | null
}

export type RebookingPriceComparisonResult = {
  channelName: string
  otaTourFare: number
  otaNotIncludedTotal: number
  otaGrandTotal: number
  directListTotal: number
  couponPercent: number
  directAfterCoupon: number
  savings: number
  billingPax: number
  notIncludedPerPerson: number
}

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

function billingPax(party: PartySizeSource): number {
  const a = party.adults ?? 0
  const c = (party.children ?? party.child ?? 0) ?? 0
  const i = (party.infants ?? party.infant ?? 0) ?? 0
  const n = a + c + i
  return n > 0 ? n : 1
}

function notIncludedTotalForParty(
  pricing: Pick<RebookingPricingSnapshot, 'not_included_price'>,
  party: PartySizeSource
): number {
  return roundUsd2(pricingFieldToNumber(pricing.not_included_price) * billingPax(party))
}

function addonsTotal(pricing: RebookingPricingSnapshot): number {
  return roundUsd2(
    pricingFieldToNumber(pricing.choices_total) +
      pricingFieldToNumber(pricing.option_total) +
      pricingFieldToNumber(pricing.required_option_total)
  )
}

function resolveOtaCustomerExpectedPayment(
  pricing: RebookingPricingSnapshot,
  party: PartySizeSource
): number {
  const formula = computeCustomerPaymentTotalLineFormula(pricing, party)
  const stored = pricingFieldToNumber(pricing.total_price)
  if (formula > 0.005) return formula
  return stored
}

/**
 * @deprecated 서버 `fetchRebookingPriceComparisonForReservation` 사용 권장. 클라이언트 폴백용.
 */
export function computeRebookingPriceComparison(params: {
  channelName: string
  adults: number
  children: number
  infants: number
  pricing: RebookingPricingSnapshot | null | undefined
  directDynamicPricing?: RebookingDirectDynamicPricing | null
  couponPercent: number
  directListTotalOverride?: number | null
  directAfterCouponOverride?: number | null
}): RebookingPriceComparisonResult | null {
  const pricing = params.pricing
  if (!pricing) return null

  const party: PartySizeSource = {
    adults: params.adults,
    children: params.children,
    infants: params.infants,
  }
  const pax = billingPax(party)
  const notIncludedPerPerson = pricingFieldToNumber(pricing.not_included_price)
  const notIncludedTotal = notIncludedTotalForParty(pricing, party)
  const otaGrandTotal = resolveOtaCustomerExpectedPayment(pricing, party)
  const otaTourFare = roundUsd2(Math.max(0, otaGrandTotal - notIncludedTotal))

  let directListTotal = params.directListTotalOverride ?? 0
  let directAfterCoupon = params.directAfterCouponOverride ?? 0
  let couponPercent = Math.max(0, Math.min(100, params.couponPercent || 0))

  if (directListTotal <= 0) {
    const dp = params.directDynamicPricing
    let directBase = 0
    if (dp) {
      directBase = roundUsd2(
        pricingFieldToNumber(dp.adult_price) * (party.adults ?? 0) +
          pricingFieldToNumber(dp.child_price) * ((party.children ?? party.child ?? 0) ?? 0) +
          pricingFieldToNumber(dp.infant_price) * ((party.infants ?? party.infant ?? 0) ?? 0)
      )
    }
    const directNotIncludedPerPerson =
      dp && dp.not_included_price != null
        ? pricingFieldToNumber(dp.not_included_price)
        : notIncludedPerPerson
    const directNotIncludedTotal = roundUsd2(directNotIncludedPerPerson * pax)
    const addons = addonsTotal(pricing)
    if (directBase > 0) {
      directListTotal = roundUsd2(directBase + directNotIncludedTotal + addons)
    } else {
      const storedSubtotal = pricingFieldToNumber(pricing.subtotal)
      if (storedSubtotal > 0) directListTotal = roundUsd2(storedSubtotal + addons)
    }
    if (directListTotal > 0) {
      const couponDiscount = roundUsd2((directListTotal * couponPercent) / 100)
      directAfterCoupon = roundUsd2(Math.max(0, directListTotal - couponDiscount))
    }
  } else if (directAfterCoupon <= 0 && couponPercent > 0) {
    directAfterCoupon = roundUsd2(Math.max(0, directListTotal * (1 - couponPercent / 100)))
  }

  if (directListTotal <= 0 || otaGrandTotal <= 0) return null

  const savings = roundUsd2(otaGrandTotal - directAfterCoupon)
  if (savings < 0.5) return null

  return {
    channelName: params.channelName.trim() || 'OTA',
    otaTourFare,
    otaNotIncludedTotal: notIncludedTotal,
    otaGrandTotal,
    directListTotal,
    couponPercent,
    directAfterCoupon,
    savings,
    billingPax: pax,
    notIncludedPerPerson,
  }
}

function formatOtaPaymentLine(comparison: RebookingPriceComparisonResult): string {
  if (comparison.otaNotIncludedTotal > 0.005) {
    return `${fmtUsd(comparison.otaTourFare)} + ${fmtUsd(comparison.otaNotIncludedTotal)} <span style="color:#64748b;font-size:12px;">(not incl.)</span> = <strong>${fmtUsd(comparison.otaGrandTotal)}</strong>`
  }
  return `<strong>${fmtUsd(comparison.otaGrandTotal)}</strong>`
}

function formatOtaPaymentLineKo(comparison: RebookingPriceComparisonResult): string {
  if (comparison.otaNotIncludedTotal > 0.005) {
    return `${fmtUsd(comparison.otaTourFare)} + ${fmtUsd(comparison.otaNotIncludedTotal)} <span style="color:#64748b;font-size:12px;">(불포함)</span> = <strong>${fmtUsd(comparison.otaGrandTotal)}</strong>`
  }
  return `<strong>${fmtUsd(comparison.otaGrandTotal)}</strong>`
}

export function formatRebookingPriceComparisonHtml(
  locale: CancellationFollowUpMessageLocale,
  comparison: RebookingPriceComparisonResult,
  couponCode: string
): string {
  const ch = comparison.channelName
  const en = locale === 'en'

  if (en) {
    return `<div style="margin:0 0 20px;padding:16px 18px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;">
  <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#166534;">Save when you book direct</p>
  <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.55;">Same tour — what you paid on <strong>${escapeHtml(ch)}</strong> vs booking on our website with coupon <strong>${escapeHtml(couponCode)}</strong>:</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#0f172a;">
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #dcfce7;vertical-align:top;"><strong>${escapeHtml(ch)}</strong></td>
      <td style="padding:8px 0;border-bottom:1px solid #dcfce7;text-align:right;white-space:nowrap;">${formatOtaPaymentLine(comparison)}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #dcfce7;vertical-align:top;"><strong>Our website</strong></td>
      <td style="padding:8px 0;border-bottom:1px solid #dcfce7;text-align:right;white-space:nowrap;">${fmtUsd(comparison.directListTotal)} × ${comparison.couponPercent}% off = <strong>${fmtUsd(comparison.directAfterCoupon)}</strong></td>
    </tr>
    <tr>
      <td style="padding:10px 0 0;font-weight:700;color:#166534;">You save</td>
      <td style="padding:10px 0 0;text-align:right;font-weight:700;color:#166534;font-size:16px;">${fmtUsd(comparison.savings)}</td>
    </tr>
  </table>
</div>`
  }

  return `<div style="margin:0 0 20px;padding:16px 18px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;">
  <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#166534;">홈페이지 직접 예약 시 절약</p>
  <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.55;">같은 투어 — <strong>${escapeHtml(ch)}</strong> 결제 vs 쿠폰 <strong>${escapeHtml(couponCode)}</strong> 적용 홈페이지 예약:</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#0f172a;">
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #dcfce7;vertical-align:top;"><strong>${escapeHtml(ch)}</strong></td>
      <td style="padding:8px 0;border-bottom:1px solid #dcfce7;text-align:right;white-space:nowrap;">${formatOtaPaymentLineKo(comparison)}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #dcfce7;vertical-align:top;"><strong>홈페이지</strong></td>
      <td style="padding:8px 0;border-bottom:1px solid #dcfce7;text-align:right;white-space:nowrap;">${fmtUsd(comparison.directListTotal)} × ${comparison.couponPercent}% 할인 = <strong>${fmtUsd(comparison.directAfterCoupon)}</strong></td>
    </tr>
    <tr>
      <td style="padding:10px 0 0;font-weight:700;color:#166534;">절약 금액</td>
      <td style="padding:10px 0 0;text-align:right;font-weight:700;color:#166534;font-size:16px;">${fmtUsd(comparison.savings)}</td>
    </tr>
  </table>
</div>`
}

export function formatRebookingPriceComparisonPlain(
  locale: CancellationFollowUpMessageLocale,
  comparison: RebookingPriceComparisonResult,
  couponCode: string
): string {
  const ch = comparison.channelName
  if (locale === 'en') {
    const otaPart =
      comparison.otaNotIncludedTotal > 0.005
        ? `${fmtUsd(comparison.otaTourFare)} + ${fmtUsd(comparison.otaNotIncludedTotal)} (not incl.) = ${fmtUsd(comparison.otaGrandTotal)}`
        : `${fmtUsd(comparison.otaGrandTotal)}`
    return `Price compare: ${ch} ${otaPart} vs our site ${fmtUsd(comparison.directListTotal)} with ${couponCode} (${comparison.couponPercent}% off) = ${fmtUsd(comparison.directAfterCoupon)}. Save ${fmtUsd(comparison.savings)}.`
  }
  const otaPartKo =
    comparison.otaNotIncludedTotal > 0.005
      ? `${fmtUsd(comparison.otaTourFare)} + ${fmtUsd(comparison.otaNotIncludedTotal)}(불포함) = ${fmtUsd(comparison.otaGrandTotal)}`
      : `${fmtUsd(comparison.otaGrandTotal)}`
  return `가격 비교: ${ch} ${otaPartKo} vs 홈페이지 ${fmtUsd(comparison.directListTotal)} 쿠폰 ${couponCode}(${comparison.couponPercent}% 할인) ${fmtUsd(comparison.directAfterCoupon)}. ${fmtUsd(comparison.savings)} 절약.`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type { ReservationChoiceRowForRebooking }
