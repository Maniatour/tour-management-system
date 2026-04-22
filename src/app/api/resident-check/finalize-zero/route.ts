import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getTokenBundleByRawToken,
  tokenIsExpired,
} from '@/lib/residentCheckTokenService'
import { residentCheckFinalizeBlockers } from '@/lib/residentCheckFinalize'
import {
  markResidentCheckTokenCompleted,
  syncCustomerFromResidentCheckSubmission,
} from '@/lib/residentCheckSyncCustomer'

/**
 * POST /api/resident-check/finalize-zero
 * Body: { token: string } — no Stripe charge (U.S. resident or pass holder with $0 due).
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server is not configured for this feature.' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const rawToken = typeof body.token === 'string' ? body.token : ''

    const bundle = await getTokenBundleByRawToken(rawToken)
    if (!bundle) {
      return NextResponse.json({ error: 'Invalid or unknown link.' }, { status: 404 })
    }

    const { token, submission } = bundle
    if (!submission) {
      return NextResponse.json({ error: 'Please save the questionnaire first.' }, { status: 400 })
    }
    if (token.completed_at) {
      return NextResponse.json({ ok: true, alreadyCompleted: true })
    }
    if (tokenIsExpired(token)) {
      return NextResponse.json({ error: 'This link has expired.' }, { status: 400 })
    }

    const blockers = residentCheckFinalizeBlockers(submission)
    if (blockers.length > 0) {
      return NextResponse.json({ error: 'Incomplete form.', blockers }, { status: 400 })
    }

    if (submission.residency !== 'us_resident' && (submission.total_charge_usd_cents ?? 0) !== 0) {
      return NextResponse.json(
        { error: 'This submission still has an amount due. Use card or cash flow.' },
        { status: 400 }
      )
    }

    await supabaseAdmin
      .from('resident_check_submissions')
      .update({
        stripe_payment_status: submission.residency === 'us_resident' ? 'not_required' : 'not_required',
        updated_at: new Date().toISOString(),
      })
      .eq('token_id', token.id)

    const { data: reservation } = await supabaseAdmin
      .from('reservations')
      .select('customer_id')
      .eq('id', token.reservation_id)
      .maybeSingle()

    const customerId = (reservation as { customer_id?: string | null } | null)?.customer_id ?? null
    await syncCustomerFromResidentCheckSubmission({ customerId, submission })
    await markResidentCheckTokenCompleted(token.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('resident-check/finalize-zero', e)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
