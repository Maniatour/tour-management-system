import type { ResidentCheckSubmissionRow } from '@/lib/residentCheckTokenService'
import {
  computePassCoveredCount,
  emptyResidentStatusAmounts,
  residentLineDefaultAmountUsd,
  type ResidentLineKey,
} from '@/utils/usResidentChoiceSync'

export type GuestResidentStatusCounts = {
  usResident: number
  nonResident: number
  nonResidentUnder16: number
  nonResidentWithPass: number
  residentStatusAmounts: Partial<Record<ResidentLineKey, number>>
}

export function residentStatusCountsFromGuestSubmission(
  submission: Pick<
    ResidentCheckSubmissionRow,
    'residency' | 'non_resident_16_plus_count' | 'has_annual_pass' | 'nps_fee_usd_cents'
  >,
  totalPeople: number
): GuestResidentStatusCounts | null {
  const total = Math.max(0, Math.floor(Number(totalPeople) || 0))
  if (total < 1) return null

  const amounts = emptyResidentStatusAmounts()
  const npsUsd = Math.max(0, Math.round(Number(submission.nps_fee_usd_cents) || 0) / 100)
  const n16 = Math.min(total, Math.max(0, Math.floor(Number(submission.non_resident_16_plus_count) || 0)))

  if (submission.residency === 'us_resident') {
    return {
      usResident: total,
      nonResident: 0,
      nonResidentUnder16: 0,
      nonResidentWithPass: 0,
      residentStatusAmounts: amounts,
    }
  }

  if (submission.residency === 'non_resident' && submission.has_annual_pass === true) {
    const passCount = Math.max(1, Math.ceil(total / 4))
    return {
      usResident: 0,
      nonResident: 0,
      nonResidentUnder16: 0,
      nonResidentWithPass: passCount,
      residentStatusAmounts: amounts,
    }
  }

  if (submission.residency === 'mixed') {
    amounts.non_resident = npsUsd > 0 ? npsUsd : residentLineDefaultAmountUsd('non_resident', n16)
    return {
      usResident: Math.max(0, total - n16),
      nonResident: n16,
      nonResidentUnder16: 0,
      nonResidentWithPass: 0,
      residentStatusAmounts: amounts,
    }
  }

  const under16 = Math.max(0, total - n16)
  amounts.non_resident = npsUsd > 0 ? npsUsd : residentLineDefaultAmountUsd('non_resident', n16)
  return {
    usResident: 0,
    nonResident: n16,
    nonResidentUnder16: under16,
    nonResidentWithPass: 0,
    residentStatusAmounts: amounts,
  }
}

export function guestResidentCountsToFormPatch(
  counts: GuestResidentStatusCounts,
  totalPeople: number
): Record<string, unknown> {
  const passCovered = computePassCoveredCount(
    counts.nonResidentWithPass,
    counts.usResident,
    counts.nonResident,
    counts.nonResidentUnder16,
    totalPeople
  )
  const assigned =
    counts.usResident +
    counts.nonResident +
    counts.nonResidentUnder16 +
    counts.nonResidentWithPass +
    passCovered
  const undecided = Math.max(0, totalPeople - assigned)
  const amounts = { ...emptyResidentStatusAmounts(), ...counts.residentStatusAmounts }
  return {
    usResidentCount: counts.usResident,
    nonResidentCount: counts.nonResident,
    nonResidentUnder16Count: counts.nonResidentUnder16,
    nonResidentWithPassCount: counts.nonResidentWithPass,
    nonResidentPurchasePassCount: 0,
    passCoveredCount: passCovered,
    undecidedResidentCount: undecided,
    residentStatusAmounts: amounts,
  }
}

export function assignedResidentPeopleFromForm(form: {
  usResidentCount?: number
  nonResidentCount?: number
  nonResidentUnder16Count?: number
  nonResidentWithPassCount?: number
  nonResidentPurchasePassCount?: number
}): number {
  return (
    (form.usResidentCount || 0) +
    (form.nonResidentCount || 0) +
    (form.nonResidentUnder16Count || 0) +
    (form.nonResidentWithPassCount || 0) +
    (form.nonResidentPurchasePassCount || 0)
  )
}

/** 이미 배정된 인원을 제외한 미정 잔여. 배정이 총원을 넘으면 0. */
export function leftoverUndecidedResidentCount(totalPeople: number, assigned: number): number {
  const total = Math.max(0, Math.floor(Number(totalPeople) || 0))
  const used = Math.max(0, Math.floor(Number(assigned) || 0))
  return Math.max(0, total - used)
}
