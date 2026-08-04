import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { fetchAuthTeamMemberRow } from '@/lib/authTeamRoleLookup'
import { getUserRole } from '@/lib/roles'

const GUIDE_PORTAL_ROLES = ['admin', 'manager', 'team_member'] as const

export type GuideApiContext = {
  user: User
  userEmail: string
  actingEmail: string
}

export async function resolveGuideApiAuth(
  request: NextRequest
): Promise<{ ok: true; ctx: GuideApiContext } | { ok: false; response: NextResponse }> {
  const clientOrResponse = await getSupabaseForApiRoute(request)
  if (clientOrResponse instanceof NextResponse) {
    return { ok: false, response: clientOrResponse }
  }

  const {
    data: { user },
    error: userError,
  } = await clientOrResponse.auth.getUser()
  if (userError || !user?.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }),
    }
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

  if (!GUIDE_PORTAL_ROLES.includes(userRole as typeof GUIDE_PORTAL_ROLES[number])) {
    return {
      ok: false,
      response: NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 }),
    }
  }

  const simulatedEmail = request.headers.get('x-simulated-user-email')?.trim()
  const actingEmail = (simulatedEmail || user.email).toLowerCase()

  return {
    ok: true,
    ctx: {
      user,
      userEmail: user.email.toLowerCase(),
      actingEmail,
    },
  }
}
