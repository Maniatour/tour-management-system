import type { ResidentCheckSubmissionRow } from '@/lib/residentCheckTokenService'

/** Human-facing keys for missing steps (client maps to locale). */
export function residentCheckFinalizeBlockers(
  s: ResidentCheckSubmissionRow
): string[] {
  const out: string[] = []
  if (!s.agreed) out.push('agreed')

  if (s.residency === 'us_resident') {
    if (!s.id_proof_url) out.push('id_proof')
    return out
  }

  if (!s.id_proof_url) out.push('id_proof')
  if (s.residency === 'non_resident' && s.has_annual_pass === true && !s.pass_photo_url) {
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
