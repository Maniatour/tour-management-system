import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

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

function rowFromGetTeamMemberInfo(
  rpcRows: unknown,
  normalizedEmail: string
): AuthTeamMemberRow | null {
  const row = (rpcRows as Record<string, unknown>[] | null)?.[0]
  if (!row) return null
  return {
    email: String(row.email ?? normalizedEmail),
    name_ko: (row.name_ko as string | null) ?? null,
    position: (row.position as string | null) ?? null,
    is_active: (row.is_active as boolean | null) ?? true,
  }
}

async function lookupViaGetTeamMemberInfo(
  client: SupabaseClient<Database>,
  normalizedEmail: string
): Promise<AuthTeamMemberRow | null> {
  try {
    const { data: rpcRows, error: rpcError } = await client.rpc('get_team_member_info', {
      p_email: normalizedEmail,
    })
    if (!rpcError && rpcRows) {
      return rowFromGetTeamMemberInfo(rpcRows, normalizedEmail)
    }
  } catch (rpcErr) {
    console.warn('authTeamRoleLookup: get_team_member_info failed:', rpcErr)
  }
  return null
}

async function lookupAuthTeamMemberRow(normalizedEmail: string): Promise<AuthTeamMemberRow | null> {
  // API Route 등 서버: 전역 supabase 클라이언트에 JWT가 없어 resolve_auth_team_member 가
  // found:false 를 반환한다. 이메일 기반 DEFINER RPC 로 직접 조회한다.
  if (typeof window === 'undefined') {
    if (supabaseAdmin) {
      const adminRow = await lookupViaGetTeamMemberInfo(supabaseAdmin, normalizedEmail)
      if (adminRow) return adminRow
    }
    if (!supabase) return null
    return lookupViaGetTeamMemberInfo(supabase, normalizedEmail)
  }

  if (!supabase) return null

  try {
    const { data, error } = await supabase.rpc('resolve_auth_team_member')
    if (!error && data && typeof data === 'object' && !Array.isArray(data)) {
      const row = rowFromResolvePayload(data as ResolveAuthTeamMemberPayload, normalizedEmail)
      if (row) return row
    }
  } catch (rpcErr) {
    console.warn('authTeamRoleLookup: resolve_auth_team_member failed:', rpcErr)
  }

  return lookupViaGetTeamMemberInfo(supabase, normalizedEmail)
}

/** 역할 확인용 team 행 — 세션 RPC 1회, 실패 시 get_team_member_info 폴백 (최대 5초) */
export async function fetchAuthTeamMemberRow(normalizedEmail: string): Promise<AuthTeamMemberRow | null> {
  return Promise.race([
    lookupAuthTeamMemberRow(normalizedEmail),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), TEAM_ROLE_LOOKUP_TIMEOUT_MS)),
  ])
}
