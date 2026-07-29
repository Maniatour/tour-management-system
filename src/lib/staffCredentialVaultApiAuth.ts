import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchAuthTeamMemberRow } from '@/lib/authTeamRoleLookup'
import { getUserRole } from '@/lib/roles'
import { canAccessStaffCredentialVault } from '@/lib/staffCredentialVault'

export type StaffCredentialVaultApiContext = {
  user: User
  userEmail: string
  userName: string
  userPosition: string | null
}

export async function resolveStaffCredentialVaultApiAuth(
  request: NextRequest
): Promise<
  | { ok: true; ctx: StaffCredentialVaultApiContext }
  | { ok: false; response: NextResponse }
> {
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

  if (
    !canAccessStaffCredentialVault({
      userRole,
      userPosition: teamMember?.position ?? null,
      authUserEmail: user.email,
    })
  ) {
    return {
      ok: false,
      response: NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 }),
    }
  }

  if (!supabaseAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 503 }),
    }
  }

  return {
    ok: true,
    ctx: {
      user,
      userEmail: user.email.toLowerCase(),
      userName: teamMember?.name_ko || user.email.split('@')[0] || 'User',
      userPosition: teamMember?.position ?? null,
    },
  }
}

export function readRequestAuditMeta(request: NextRequest): {
  ipAddress: string | null
  userAgent: string | null
} {
  const forwarded = request.headers.get('x-forwarded-for')
  const ipAddress =
    (forwarded ? forwarded.split(',')[0]?.trim() : null) ||
    request.headers.get('x-real-ip') ||
    null
  const userAgent = request.headers.get('user-agent')
  return { ipAddress, userAgent }
}
