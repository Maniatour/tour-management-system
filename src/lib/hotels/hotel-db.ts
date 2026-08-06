import { supabaseAdmin } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Admin Supabase client for hotel module tables.
 * Tables land in generated Database types after `supabase gen types`; until then we
 * use a loose client so module code stays typed at the domain layer.
 */
export function getHotelAdminClient(): SupabaseClient {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }
  return supabaseAdmin as unknown as SupabaseClient
}
