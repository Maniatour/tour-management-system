import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { fetchAuthTeamMemberRow } from '@/lib/authTeamRoleLookup'
import { getUserRole, ROLE_PERMISSIONS } from '@/lib/roles'
import { supabaseAdmin } from '@/lib/supabase'

export async function requireTourReportAdminAccess(request: NextRequest): Promise<
  | { ok: true; user: User; db: SupabaseClient }
  | { ok: false; response: NextResponse }
> {
  const clientOrResponse = await getSupabaseForApiRoute(request)
  if (clientOrResponse instanceof NextResponse) {
    return { ok: false, response: clientOrResponse }
  }

  const {
    data: { user },
    error,
  } = await clientOrResponse.auth.getUser()
  if (error || !user?.email) {
    return { ok: false, response: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }) }
  }

  const teamMember = await fetchAuthTeamMemberRow(user.email.toLowerCase())
  const userRole = getUserRole(
    user.email,
    teamMember
      ? {
          ...(teamMember.position ? { position: teamMember.position } : {}),
          is_active: teamMember.is_active,
        }
      : undefined
  )
  const perms = ROLE_PERMISSIONS[userRole]
  if (!perms.canViewSchedule && !perms.canManageTours) {
    return { ok: false, response: NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 }) }
  }

  return {
    ok: true,
    user,
    db: (supabaseAdmin ?? clientOrResponse) as SupabaseClient,
  }
}
