import type { SupabaseClient, User } from '@supabase/supabase-js'
import { supabase, supabaseAdmin, createSupabaseClientWithToken } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

const STAFF_EMAIL_WHITELIST = new Set(['info@maniatour.com', 'wooyong.shim09@gmail.com'])

async function isActiveStaff(client: SupabaseClient<Database>, emailLower: string): Promise<boolean> {
  if (STAFF_EMAIL_WHITELIST.has(emailLower)) return true

  const { data: staffOk, error: staffErr } = await client.rpc('is_staff', { p_email: emailLower })
  if (!staffErr && staffOk) return true

  const { data, error } = await client
    .from('team')
    .select('id')
    .ilike('email', emailLower)
    .or('is_active.is.null,is_active.eq.true')
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[travelGuideStaffAuth] team lookup:', error.message)
    return false
  }

  return !!data
}

export type TravelGuideStaffSession = {
  user: User
  token: string
}

export async function requireTravelGuideStaff(request: Request): Promise<TravelGuideStaffSession | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7).trim()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user?.email) return null

  const emailLower = user.email.trim().toLowerCase()
  if (supabaseAdmin && (await isActiveStaff(supabaseAdmin, emailLower))) {
    return { user, token }
  }

  try {
    const userClient = createSupabaseClientWithToken(token)
    if (await isActiveStaff(userClient, emailLower)) {
      return { user, token }
    }
  } catch (staffError) {
    console.error('[travelGuideStaffAuth] user jwt lookup failed', staffError)
  }

  return null
}
