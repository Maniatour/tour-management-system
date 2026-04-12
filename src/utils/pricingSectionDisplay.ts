import { sumResidentFeeAmountsUsd } from '@/utils/usResidentChoiceSync'

export function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

export function splitNotIncludedForDisplay(
  choiceNotIncludedTotal: number,
  choiceNotIncludedBaseTotal: number,
  notIncludedPerPerson: number,
  adults: number,
  child: number,
  infant: number,
  residentStatusAmounts?: Record<string, number>
): { baseUsd: number; residentFeesUsd: number; totalUsd: number } {
  const pax = (adults || 0) + (child || 0) + (infant || 0)
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
