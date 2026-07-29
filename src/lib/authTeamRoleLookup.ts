import { supabase } from '@/lib/supabase'

export type AuthTeamMemberRow = {
  email: string
  name_ko: string | null
  position: string | null
  is_active: boolean | null
}

const TEAM_ROLE_LOOKUP_TIMEOUT_MS = 5_000

type ResolveAuthTeamMemberPayload = {
  found?: boolean
  email?: string
  name_ko?: string | null
  position?: string | null
  is_active?: boolean | null
}

function rowFromResolvePayload(
  payload: ResolveAuthTeamMemberPayload,
  fallbackEmail: string
): AuthTeamMemberRow | null {
  if (payload.found !== true) return null
  return {
    email: String(payload.email ?? fallbackEmail),
    name_ko: payload.name_ko ?? null,
    position: payload.position ?? null,
    is_active: payload.is_active ?? true,
  }
}

async function lookupAuthTeamMemberRow(normalizedEmail: string): Promise<AuthTeamMemberRow | null> {
  if (!supabase) return null

  try {
    const { data, error } = await supabase.rpc('resolve_auth_team_member')
    if (!error && data && typeof data === 'object' && !Array.isArray(data)) {
      const row = rowFromResolvePayload(data as ResolveAuthTeamMemberPayload, normalizedEmail)
      if (row) return row
      if ((data as ResolveAuthTeamMemberPayload).found === false) {
        return null
      }
    }
  } catch (rpcErr) {
    console.warn('authTeamRoleLookup: resolve_auth_team_member failed:', rpcErr)
  }

  try {
    const { data: rpcRows, error: rpcError } = await supabase.rpc('get_team_member_info', {
      p_email: normalizedEmail,
    })
    const row = (rpcRows as Record<string, unknown>[] | null)?.[0]
    if (!rpcError && row) {
      return {
        email: String(row.email ?? normalizedEmail),
        name_ko: (row.name_ko as string | null) ?? null,
        position: (row.position as string | null) ?? null,
        is_active: (row.is_active as boolean | null) ?? true,
      }
    }
  } catch (rpcErr) {
    console.warn('authTeamRoleLookup: get_team_member_info failed:', rpcErr)
  }

  return null
}

/** 역할 확인용 team 행 — 세션 RPC 1회, 실패 시 get_team_member_info 폴백 (최대 5초) */
export async function fetchAuthTeamMemberRow(normalizedEmail: string): Promise<AuthTeamMemberRow | null> {
  return Promise.race([
    lookupAuthTeamMemberRow(normalizedEmail),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), TEAM_ROLE_LOOKUP_TIMEOUT_MS)),
  ])
}
