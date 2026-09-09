import type { SupabaseClient } from '@supabase/supabase-js'
import type { ResidentCheckSubmissionRow } from '@/lib/residentCheckTokenService'
import { saveResidentStatusWithPricing } from '@/lib/saveResidentStatusWithPricing'
import { residentStatusCountsFromGuestSubmission } from '@/lib/residentCheckGuestMapping'

export {
  assignedResidentPeopleFromForm,
  guestResidentCountsToFormPatch,
  leftoverUndecidedResidentCount,
  residentStatusCountsFromGuestSubmission,
  isGuestResidentCheckFilledByCustomer,
} from '@/lib/residentCheckGuestMapping'

export type ResidentCheckGuestRecord = {
  submission: ResidentCheckSubmissionRow
  completedAt: string | null
}

export async function fetchLatestResidentCheckGuestRecord(
  supabase: SupabaseClient,
  reservationId: string
): Promise<ResidentCheckGuestRecord | null> {
  if (!reservationId) return null

  const { data: tokens, error: tokenErr } = await supabase
    .from('resident_check_tokens')
    .select('id, completed_at')
    .eq('reservation_id', reservationId)
  if (tokenErr || !tokens?.length) return null

  const tokenIds = tokens.map((row) => (row as { id: string }).id).filter(Boolean)
  if (tokenIds.length === 0) return null

  const { data: submissions, error: subErr } = await supabase
    .from('resident_check_submissions')
    .select('*')
    .in('token_id', tokenIds)
  if (subErr || !submissions?.length) return null

  const completedByToken = new Map(
    tokens.map((row) => [
      (row as { id: string }).id,
      (row as { completed_at?: string | null }).completed_at ?? null,
    ])
  )

  const ranked = [...(submissions as ResidentCheckSubmissionRow[])].sort((a, b) => {
    const aDone = completedByToken.get(a.token_id) ? 1 : 0
    const bDone = completedByToken.get(b.token_id) ? 1 : 0
    if (aDone !== bDone) return bDone - aDone
    const aAgreed = a.agreed ? 1 : 0
    const bAgreed = b.agreed ? 1 : 0
    if (aAgreed !== bAgreed) return bAgreed - aAgreed
    return String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
  })

  const submission = ranked[0]
  if (!submission) return null
  return {
    submission,
    completedAt: completedByToken.get(submission.token_id) ?? null,
  }
}

export async function syncReservationFromResidentCheckSubmission(
  supabase: SupabaseClient,
  args: {
    reservationId: string
    customerId: string | null
    submission: ResidentCheckSubmissionRow
  }
): Promise<{ ok: boolean; error?: string }> {
  const { data: reservation, error } = await supabase
    .from('reservations')
    .select('adults, child, infant, customer_id')
    .eq('id', args.reservationId)
    .maybeSingle()

  if (error || !reservation) {
    return { ok: false, error: error?.message || 'reservation_not_found' }
  }

  const totalPeople =
    (Number(reservation.adults) || 0) +
    (Number(reservation.child) || 0) +
    (Number(reservation.infant) || 0)
  const counts = residentStatusCountsFromGuestSubmission(args.submission, totalPeople)
  if (!counts) return { ok: true }

  const customerId =
    args.customerId ||
    ((reservation as { customer_id?: string | null }).customer_id ?? null)

  return saveResidentStatusWithPricing(
    supabase,
    args.reservationId,
    customerId,
    totalPeople,
    counts
  )
}
