import type { SupabaseClient } from '@supabase/supabase-js'
import { STRIPE_PI_NOTE_PREFIX } from '@/lib/customerBookingCheckout'
import { supabaseAdmin } from '@/lib/supabase'
import type { ResidentCheckSubmissionRow } from '@/lib/residentCheckTokenService'
import { lookupReservationOperatorId } from '@/lib/operators/lookupReservationOperatorId'

const RESIDENT_CHECK_SUBMIT_BY = 'resident_check'
const RESIDENT_CHECK_CONFIRMED_BY = 'resident_check_confirm'

export async function syncCustomerFromResidentCheckSubmission(args: {
  customerId: string | null
  submission: ResidentCheckSubmissionRow
}): Promise<void> {
  if (!supabaseAdmin || !args.customerId) return

  let resident_status: 'us_resident' | 'non_resident' | 'non_resident_with_pass' = 'non_resident'
  if (args.submission.residency === 'us_resident') {
    resident_status = 'us_resident'
  } else if (args.submission.pass_photo_url) {
    resident_status = 'non_resident_with_pass'
  } else {
    resident_status = 'non_resident'
  }

  await supabaseAdmin
    .from('customers')
    .update({
      resident_status,
      pass_photo_url: args.submission.pass_photo_url,
      id_photo_url: args.submission.id_proof_url,
    })
    .eq('id', args.customerId)
}

export async function markResidentCheckTokenCompleted(tokenId: string): Promise<void> {
  if (!supabaseAdmin) return
  await supabaseAdmin
    .from('resident_check_tokens')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', tokenId)
}

/**
 * Resident-check Stripe card payment → payment_records (입금 관리).
 * Idempotent on payment intent id. Does not change reservation status.
 */
export async function recordResidentCheckCardPayment(
  admin: SupabaseClient,
  args: {
    reservationId: string
    paymentIntentId: string
    amountUsdCents: number
  }
): Promise<{ alreadyRecorded: boolean }> {
  const amountUsd = Math.round(args.amountUsdCents) / 100
  if (!(amountUsd > 0)) {
    throw new Error('Invalid payment amount for payment_records.')
  }

  const note = `${STRIPE_PI_NOTE_PREFIX}${args.paymentIntentId}; resident_check_nps`

  const { data: existing } = await admin
    .from('payment_records')
    .select('id, payment_status')
    .eq('reservation_id', args.reservationId)
    .ilike('note', `%${args.paymentIntentId}%`)
    .maybeSingle()

  if (existing?.id) {
    if (existing.payment_status === 'confirmed') {
      return { alreadyRecorded: true }
    }
    const { error: updateError } = await admin
      .from('payment_records')
      .update({
        amount: amountUsd,
        payment_method: 'card',
        payment_status: 'confirmed',
        note,
        confirmed_by: RESIDENT_CHECK_CONFIRMED_BY,
        confirmed_on: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (updateError) {
      throw new Error(`입금 기록 확정 실패: ${updateError.message}`)
    }
    return { alreadyRecorded: false }
  }

  const now = new Date().toISOString()
  const operatorId = await lookupReservationOperatorId(admin, args.reservationId)
  const { error: insertError } = await admin.from('payment_records').insert({
    operator_id: operatorId,
    reservation_id: args.reservationId,
    amount: amountUsd,
    payment_method: 'card',
    payment_status: 'confirmed',
    note,
    submit_by: RESIDENT_CHECK_SUBMIT_BY,
    submit_on: now,
    confirmed_by: RESIDENT_CHECK_CONFIRMED_BY,
    confirmed_on: now,
  })
  if (insertError) {
    throw new Error(`입금 기록 저장 실패: ${insertError.message}`)
  }
  return { alreadyRecorded: false }
}
