import { supabaseAdmin } from '@/lib/supabase'
import { siteUrlForEmail } from '@/lib/residentInquiryEmailHtml'
import { generateResidentCheckRawToken, hashResidentCheckToken } from '@/lib/residentCheckCrypto'

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

/**
 * Creates a new access token row. Returns the raw token once (for URL) — never log/store raw in DB.
 */
export async function mintResidentCheckTokenForReservation(args: {
  reservationId: string
  emailLocalePath: 'en' | 'ko'
}): Promise<{ rawToken: string; absoluteUrl: string } | null> {
  if (!supabaseAdmin) return null

  const rawToken = generateResidentCheckRawToken()
  const token_hash = hashResidentCheckToken(rawToken)
  const expires_at = new Date(Date.now() + FOURTEEN_DAYS_MS).toISOString()

  const { error } = await supabaseAdmin.from('resident_check_tokens').insert({
    reservation_id: args.reservationId,
    token_hash,
    expires_at,
  })

  if (error) {
    console.error('mintResidentCheckTokenForReservation:', error)
    return null
  }

  const base = siteUrlForEmail().replace(/\/$/, '')
  const path = `/${args.emailLocalePath}/dashboard/resident-check`
  const absoluteUrl = base
    ? `${base}${path}?t=${encodeURIComponent(rawToken)}`
    : `${path}?t=${encodeURIComponent(rawToken)}`

  return { rawToken, absoluteUrl }
}
