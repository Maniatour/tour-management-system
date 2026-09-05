import { hasResidentCheckProof } from '@/lib/residentCheckProofUrls'
import type { ResidentCheckSubmissionRow } from '@/lib/residentCheckTokenService'

export function residentCheckRequiresIdProof(residency: string | null | undefined): boolean {
  return residency === 'us_resident' || residency === 'mixed'
}

export function residentCheckRequiresPassPhoto(
  residency: string | null | undefined,
  hasAnnualPass: boolean | null | undefined
): boolean {
  return residency === 'non_resident' && hasAnnualPass === true
}

export function residentCheckUploadStepDone(
  s: Pick<ResidentCheckSubmissionRow, 'residency' | 'has_annual_pass' | 'id_proof_url' | 'pass_photo_url'> | null
): boolean {
  if (!s) return false
  if (residentCheckRequiresIdProof(s.residency) && !hasResidentCheckProof(s.id_proof_url)) {
    return false
  }
  if (
    residentCheckRequiresPassPhoto(s.residency, s.has_annual_pass) &&
    !hasResidentCheckProof(s.pass_photo_url)
  ) {
    return false
  }
  return true
}

/** Human-facing keys for missing steps (client maps to locale). */
export function residentCheckFinalizeBlockers(
  s: ResidentCheckSubmissionRow
): string[] {
  const out: string[] = []
  if (!s.agreed) out.push('agreed')

  if (residentCheckRequiresIdProof(s.residency) && !hasResidentCheckProof(s.id_proof_url)) {
    out.push('id_proof')
  }

  if (
    residentCheckRequiresPassPhoto(s.residency, s.has_annual_pass) &&
    !hasResidentCheckProof(s.pass_photo_url)
  ) {
    out.push('pass_photo')
  }

  const total = s.total_charge_usd_cents ?? 0
  if (total > 0 && !s.payment_method) out.push('payment_method')
  return out
}

/**
 * Card pay can proceed once terms + card method + charge amount are ready.
 * Proof uploads remain recommended but do not block paying the due amount.
 */
export function residentCheckCardPaymentBlockers(
  s: ResidentCheckSubmissionRow
): string[] {
  const out: string[] = []
  if (!s.agreed) out.push('agreed')
  if (s.payment_method !== 'card') out.push('payment_method')
  const total = s.total_charge_usd_cents ?? 0
  if (!total || total < 50) out.push('amount')
  return out
}

export function residentCheckCanPayByCard(s: ResidentCheckSubmissionRow): boolean {
  return residentCheckCardPaymentBlockers(s).length === 0
}
