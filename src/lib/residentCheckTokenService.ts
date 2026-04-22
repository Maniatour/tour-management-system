import { supabaseAdmin } from '@/lib/supabase'
import { hashResidentCheckToken } from '@/lib/residentCheckCrypto'

export type ResidentCheckTokenRow = {
  id: string
  reservation_id: string
  token_hash: string
  expires_at: string
  created_at: string
  completed_at: string | null
}

export type ResidentCheckSubmissionRow = {
  id: string
  token_id: string
  residency: string
  non_resident_16_plus_count: number
  agreed: boolean
  payment_method: string | null
  pass_assistance_requested: boolean
  has_annual_pass: boolean | null
  pass_photo_url: string | null
  id_proof_url: string | null
  stripe_payment_intent_id: string | null
  stripe_payment_status: string | null
  nps_fee_usd_cents: number
  card_processing_fee_usd_cents: number
  total_charge_usd_cents: number
  created_at: string
  updated_at: string
}

export async function getTokenBundleByRawToken(
  rawToken: string
): Promise<{
  token: ResidentCheckTokenRow
  submission: ResidentCheckSubmissionRow | null
} | null> {
  if (!supabaseAdmin) return null
  const trimmed = rawToken.trim()
  if (!trimmed) return null

  const token_hash = hashResidentCheckToken(trimmed)
  const { data: token, error } = await supabaseAdmin
    .from('resident_check_tokens')
    .select('*')
    .eq('token_hash', token_hash)
    .maybeSingle()

  if (error || !token) return null

  const { data: submission } = await supabaseAdmin
    .from('resident_check_submissions')
    .select('*')
    .eq('token_id', (token as ResidentCheckTokenRow).id)
    .maybeSingle()

  return {
    token: token as ResidentCheckTokenRow,
    submission: (submission as ResidentCheckSubmissionRow | null) ?? null,
  }
}

export function tokenIsExpired(token: ResidentCheckTokenRow): boolean {
  return Date.now() > new Date(token.expires_at).getTime()
}
