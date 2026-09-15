import type { SupabaseClient } from '@supabase/supabase-js'
import { STRIPE_PI_NOTE_PREFIX } from '@/lib/customerBookingCheckout'
import { supabaseAdmin } from '@/lib/supabase'
import { hasResidentCheckProof, primaryResidentCheckProofUrl } from '@/lib/residentCheckProofUrls'
import {
  mergeResidentCheckCardFeeUsd,
  residentCheckCardFeeUsdFromPayment,
} from '@/lib/residentCheckFees'
import type { ResidentCheckSubmissionRow } from '@/lib/residentCheckTokenService'
import { lookupReservationOperatorId } from '@/lib/operators/lookupReservationOperatorId'
import { syncReservationPricingAggregates } from '@/lib/syncReservationPricingAggregates'
import { isBalanceReceivedPaymentStatus } from '@/utils/reservationPricingBalance'

const RESIDENT_CHECK_SUBMIT_BY = 'resident_check'
const RESIDENT_CHECK_CONFIRMED_BY = 'resident_check_confirm'
const RESIDENT_CHECK_PAYMENT_STATUS = 'Balance Received'
const RESIDENT_CHECK_PAYMENT_METHOD = 'Stripe'

function isStripePaymentMethod(method: string | null | undefined): boolean {
  return String(method || '').trim().toLowerCase() === 'stripe'
}

export async function syncCustomerFromResidentCheckSubmission(args: {
  customerId: string | null
  submission: ResidentCheckSubmissionRow
}): Promise<void> {
  if (!supabaseAdmin || !args.customerId) return

  let resident_status: 'us_resident' | 'non_resident' | 'non_resident_with_pass' = 'non_resident'
  if (args.submission.residency === 'us_resident') {
    resident_status = 'us_resident'
  } else if (hasResidentCheckProof(args.submission.pass_photo_url)) {
    resident_status = 'non_resident_with_pass'
  } else {
    resident_status = 'non_resident'
  }

  await supabaseAdmin
    .from('customers')
    .update({
      resident_status,
      pass_photo_url: primaryResidentCheckProofUrl(args.submission.pass_photo_url),
      id_photo_url: primaryResidentCheckProofUrl(args.submission.id_proof_url),
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
 * 비거주자 카드 결제 수수료를 가격 정보 card_fee에 가산.
 * 입금 기록이 처음 확정될 때만 호출해 중복 가산을 막는다.
 */
async function applyResidentCheckCardFeeToReservationPricing(
  admin: SupabaseClient,
  reservationId: string,
  cardFeeUsd: number
): Promise<void> {
  if (!(cardFeeUsd > 0)) return
  const { data: pricing, error } = await admin
    .from('reservation_pricing')
    .select('id, card_fee')
    .eq('reservation_id', reservationId)
    .maybeSingle()
  if (error) {
    console.warn(
      '[recordResidentCheckCardPayment] 카드 수수료 조회 실패:',
      reservationId,
      error.message
    )
    return
  }
  if (!pricing?.id) return
  const nextCardFee = mergeResidentCheckCardFeeUsd(pricing.card_fee, cardFeeUsd)
  const { error: updateError } = await admin
    .from('reservation_pricing')
    .update({ card_fee: nextCardFee })
    .eq('id', pricing.id)
  if (updateError) {
    console.warn(
      '[recordResidentCheckCardPayment] 카드 수수료 저장 실패:',
      reservationId,
      updateError.message
    )
  }
}

/**
 * Resident-check Stripe card payment → payment_records (입금 관리).
 * Idempotent on payment intent id. Does not change reservation status.
 * First confirmation also writes the included card processing fee into reservation_pricing.card_fee.
 */
export async function recordResidentCheckCardPayment(
  admin: SupabaseClient,
  args: {
    reservationId: string
    paymentIntentId: string
    amountUsdCents: number
    cardFeeUsdCents?: number | null
  }
): Promise<{ alreadyRecorded: boolean; paymentRecordId: string | null }> {
  const amountUsd = Math.round(args.amountUsdCents) / 100
  if (!(amountUsd > 0)) {
    throw new Error('Invalid payment amount for payment_records.')
  }

  const note = `${STRIPE_PI_NOTE_PREFIX}${args.paymentIntentId}; resident_check_nps`

  const { data: existing } = await admin
    .from('payment_records')
    .select('id, payment_status, payment_method')
    .eq('reservation_id', args.reservationId)
    .ilike('note', `%${args.paymentIntentId}%`)
    .maybeSingle()

  const now = new Date().toISOString()
  const paymentFields = {
    amount: amountUsd,
    payment_method: RESIDENT_CHECK_PAYMENT_METHOD,
    payment_status: RESIDENT_CHECK_PAYMENT_STATUS,
    note,
    confirmed_by: RESIDENT_CHECK_CONFIRMED_BY,
    confirmed_on: now,
    updated_at: now,
  }

  let paymentRecordId: string | null = existing?.id ?? null
  let alreadyRecorded = false

  if (existing?.id) {
    alreadyRecorded =
      isBalanceReceivedPaymentStatus(existing.payment_status || '') &&
      isStripePaymentMethod(existing.payment_method)
    if (!alreadyRecorded) {
      const { error: updateError } = await admin
        .from('payment_records')
        .update(paymentFields)
        .eq('id', existing.id)
      if (updateError) {
        throw new Error(`입금 기록 확정 실패: ${updateError.message}`)
      }
    }
  } else {
    const operatorId = await lookupReservationOperatorId(admin, args.reservationId)
    const { data: inserted, error: insertError } = await admin
      .from('payment_records')
      .insert({
        operator_id: operatorId,
        reservation_id: args.reservationId,
        submit_by: RESIDENT_CHECK_SUBMIT_BY,
        submit_on: now,
        ...paymentFields,
      })
      .select('id')
      .maybeSingle()
    if (insertError) {
      throw new Error(`입금 기록 저장 실패: ${insertError.message}`)
    }
    paymentRecordId = inserted?.id ?? null
  }

  if (!alreadyRecorded) {
    const cardFeeUsd = residentCheckCardFeeUsdFromPayment({
      cardProcessingFeeUsdCents: args.cardFeeUsdCents,
      amountUsdCents: args.amountUsdCents,
    })
    await applyResidentCheckCardFeeToReservationPricing(admin, args.reservationId, cardFeeUsd)
  }

  const sync = await syncReservationPricingAggregates(admin, args.reservationId)
  if (!sync.ok && sync.error) {
    console.warn(
      '[recordResidentCheckCardPayment] reservation_pricing 동기화 실패:',
      args.reservationId,
      sync.error
    )
  }

  return { alreadyRecorded, paymentRecordId }
}
