import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getTokenBundleByRawToken,
  tokenIsExpired,
} from '@/lib/residentCheckTokenService'
import {
  computeResidentCheckUsdCents,
  type ResidentCheckResidency,
} from '@/lib/residentCheckFees'

function isResidency(v: unknown): v is ResidentCheckResidency {
  return v === 'us_resident' || v === 'non_resident' || v === 'mixed'
}

/**
 * POST /api/resident-check/save
 * Body: { token, residency?, non_resident_16_plus_count?, agreed?, payment_method?, ... }
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

    const { token, submission: existing } = bundle
    if (token.completed_at) {
      return NextResponse.json({ error: 'This link has already been completed.' }, { status: 400 })
    }
    if (tokenIsExpired(token)) {
      return NextResponse.json({ error: 'This link has expired.' }, { status: 400 })
    }

    const residencyInput = body.residency ?? existing?.residency
    if (!isResidency(residencyInput)) {
      return NextResponse.json({ error: 'Invalid residency.' }, { status: 400 })
    }

    let nonResidentCount =
      body.non_resident_16_plus_count !== undefined
        ? Number(body.non_resident_16_plus_count)
        : Number(existing?.non_resident_16_plus_count ?? 0)
    if (!Number.isFinite(nonResidentCount) || nonResidentCount < 0) nonResidentCount = 0
    nonResidentCount = Math.floor(nonResidentCount)

    if (residencyInput === 'us_resident') {
      nonResidentCount = 0
    }

    if (residencyInput === 'mixed' && nonResidentCount < 1) {
      return NextResponse.json(
        { error: 'Please enter the number of non-U.S. residents (16+).' },
        { status: 400 }
      )
    }

    if (residencyInput === 'non_resident' && body.has_annual_pass !== true && nonResidentCount < 1) {
      return NextResponse.json(
        { error: 'Please enter the number of non-U.S. residents (16+).' },
        { status: 400 }
      )
    }

    const agreed =
      body.agreed !== undefined ? Boolean(body.agreed) : Boolean(existing?.agreed)

    let payment_method =
      body.payment_method !== undefined ? body.payment_method : existing?.payment_method
    if (payment_method !== null && payment_method !== 'card' && payment_method !== 'cash') {
      payment_method = null
    }

    const pass_assistance_requested =
      body.pass_assistance_requested !== undefined
        ? Boolean(body.pass_assistance_requested)
        : Boolean(existing?.pass_assistance_requested)

    let has_annual_pass: boolean | null =
      body.has_annual_pass !== undefined ? body.has_annual_pass : existing?.has_annual_pass ?? null
    if (residencyInput !== 'non_resident') {
      has_annual_pass = null
    }

    if (residencyInput === 'us_resident') {
      payment_method = null
    }

    const pass_photo_url =
      body.pass_photo_url !== undefined ? body.pass_photo_url : existing?.pass_photo_url ?? null
    const id_proof_url =
      body.id_proof_url !== undefined ? body.id_proof_url : existing?.id_proof_url ?? null

    const fees = computeResidentCheckUsdCents({
      residency: residencyInput,
      non_resident_16_plus_count: nonResidentCount,
      has_annual_pass,
      payment_method,
    })

    const row = {
      token_id: token.id,
      residency: residencyInput,
      non_resident_16_plus_count: nonResidentCount,
      agreed,
      payment_method,
      pass_assistance_requested,
      has_annual_pass,
      pass_photo_url: pass_photo_url ? String(pass_photo_url) : null,
      id_proof_url: id_proof_url ? String(id_proof_url) : null,
      nps_fee_usd_cents: fees.nps_fee_usd_cents,
      card_processing_fee_usd_cents: fees.card_processing_fee_usd_cents,
      total_charge_usd_cents: fees.total_charge_usd_cents,
      stripe_payment_intent_id: existing?.stripe_payment_intent_id ?? null,
      stripe_payment_status: existing?.stripe_payment_status ?? null,
      updated_at: new Date().toISOString(),
    }

    const { data: saved, error } = await supabaseAdmin
      .from('resident_check_submissions')
      .upsert(row, { onConflict: 'token_id' })
      .select('*')
      .single()

    if (error) {
      console.error('resident-check/save upsert', error)
      return NextResponse.json({ error: 'Failed to save.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, submission: saved })
  } catch (e) {
    console.error('resident-check/save', e)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
