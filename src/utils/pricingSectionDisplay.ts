import { getPerPersonChargePax } from '@/lib/productPriceTotal'
import { sumResidentFeeAmountsUsd } from '@/utils/usResidentChoiceSync'

export function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

export type SplitNotIncludedPaxOpts = {
  /** 있으면 이 인원으로 1인당 불포함을 곱함 */
  billingPax?: number
  isSinglePrice?: boolean
  reservationAdults?: number
}

export function splitNotIncludedForDisplay(
  choiceNotIncludedTotal: number,
  choiceNotIncludedBaseTotal: number,
  notIncludedPerPerson: number,
  adults: number,
  child: number,
  infant: number,
  residentStatusAmounts?: Record<string, number>,
  paxOpts?: SplitNotIncludedPaxOpts
): { baseUsd: number; residentFeesUsd: number; totalUsd: number } {
  const pax =
    paxOpts?.billingPax != null && Number.isFinite(paxOpts.billingPax)
      ? Math.max(0, paxOpts.billingPax)
      : getPerPersonChargePax({
          isSinglePrice: Boolean(paxOpts?.isSinglePrice),
          pricingAdults: adults,
          reservationAdults: paxOpts?.reservationAdults ?? adults,
          child,
          infant,
        })
  const fieldTotal = (notIncludedPerPerson || 0) * pax
  const residentFeesUsd = sumResidentFeeAmountsUsd(residentStatusAmounts)

  const fromSubtract =
    choiceNotIncludedTotal > 0
      ? Math.max(0, roundUsd2(choiceNotIncludedTotal - residentFeesUsd))
      : 0

  const baseUsd = roundUsd2(
    Math.max(choiceNotIncludedBaseTotal, fromSubtract, fieldTotal)
  )

  const totalUsd =
    choiceNotIncludedTotal > 0
      ? Math.max(choiceNotIncludedTotal, roundUsd2(baseUsd + residentFeesUsd))
      : roundUsd2(baseUsd + residentFeesUsd)

  return {
    baseUsd,
    residentFeesUsd,
    totalUsd: roundUsd2(totalUsd),
  }
}
