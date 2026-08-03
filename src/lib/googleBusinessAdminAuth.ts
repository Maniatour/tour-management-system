import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireStaffApiAuth } from '@/lib/api-security'
import { applyActiveOperatorSession } from '@/lib/operators/applyActiveOperatorSession'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

async function isAdminUser(
  client: SupabaseClient<Database>,
  emailLower: string
): Promise<boolean> {
  const { data, error } = await client.rpc('is_admin_user', { p_email: emailLower })
  if (error) {
    console.error('[googleBusinessAdminAuth] is_admin_user:', error.message)
    return false
  }
  return Boolean(data)
}

export type GoogleBusinessAdminAuthResult =
  | {
      ok: true
      userEmail: string
      userId: string
      staffClient: SupabaseClient<Database>
      operatorId: string
    }
  | { ok: false; response: NextResponse }

export async function requireGoogleBusinessAdminAuth(
  request: NextRequest
): Promise<GoogleBusinessAdminAuthResult> {
  const staff = await requireStaffApiAuth(request)
  if (!staff.ok) {
    return staff
  }

  const emailLower = staff.userEmail.trim().toLowerCase()
  const adminClient = supabaseAdmin ?? staff.staffClient
  const adminOk = await isAdminUser(adminClient, emailLower)
  if (!adminOk) {
    return {
      ok: false,
      response: NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 }),
    }
  }

  const operatorSession = await applyActiveOperatorSession(staff.staffClient, request)

  return {
    ok: true,
    userEmail: staff.userEmail,
    userId: staff.userId,
    staffClient: staff.staffClient,
    operatorId: operatorSession.operatorId,
  }
}
