import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseAdmin, createSupabaseClientWithToken } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

const STAFF_EMAIL_WHITELIST = new Set(['info@maniatour.com', 'wooyong.shim09@gmail.com'])

async function teamActiveRowExists(
  client: SupabaseClient<Database>,
  emailLower: string
): Promise<boolean> {
  const { data, error } = await client
    .from('team')
    .select('id')
    .ilike('email', emailLower)
    .or('is_active.is.null,is_active.eq.true')
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[api/admin/customers] team lookup:', error.message)
    return false
  }
  return !!data
}

/** customers RLS·is_staff(text)와 동일: 활성 팀 행(또는 화이트리스트) — team 직접 SELECT 실패 시 보조 */
async function isActiveStaffForCustomerInsert(
  client: SupabaseClient<Database>,
  emailLower: string
): Promise<boolean> {
  const { data: staffOk, error: staffErr } = await client.rpc('is_staff', { p_email: emailLower })
  if (!staffErr && staffOk) {
    return true
  }
  const { data: roleOk, error: roleErr } = await client.rpc('customer_insert_team_role_ok', {
    p_email: emailLower,
  })
  if (!roleErr && roleOk) {
    return true
  }
  if (staffErr) {
    console.error('[api/admin/customers] is_staff rpc:', staffErr.message)
  }
  if (roleErr) {
    console.error('[api/admin/customers] customer_insert_team_role_ok rpc:', roleErr.message)
  }
  return teamActiveRowExists(client, emailLower)
}

async function callerMayInsertCustomers(userEmail: string | undefined | null, accessToken: string): Promise<boolean> {
  if (!userEmail) return false
  const em = userEmail.trim().toLowerCase()
  if (STAFF_EMAIL_WHITELIST.has(em)) return true

  if (supabaseAdmin) {
    const ok = await isActiveStaffForCustomerInsert(supabaseAdmin, em)
    if (ok) return true
  }

  // 서비스 롤 미설정·RPC만 통과하는 환경: 사용자 JWT로 is_staff / team 조회
  try {
    const userSb = createSupabaseClientWithToken(accessToken)
    return await isActiveStaffForCustomerInsert(userSb, em)
  } catch (e) {
    console.error('[api/admin/customers] team lookup (user jwt) exception:', e)
    return false
  }
}

/**
 * 관리 화면 전용: 활성 팀·화이트리스트만 고객 생성.
 * 서비스 롤이 있으면 INSERT 시 RLS와 무관하게 동작; 없으면 사용자 JWT로 INSERT(고객 RLS: 팀 멤버 INSERT 허용).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }
  const token = authHeader.slice(7).trim()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)
  if (authError || !user?.email) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  if (!(await callerMayInsertCustomers(user.email, token))) {
    return NextResponse.json({ error: '고객 생성 권한이 없습니다' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다' }, { status: 400 })
  }

  const customer = (body as { customer?: Record<string, unknown> }).customer
  if (!customer || typeof customer !== 'object') {
    return NextResponse.json({ error: 'customer 객체가 필요합니다' }, { status: 400 })
  }

  const name = customer.name != null ? String(customer.name).trim() : ''
  const email = customer.email != null ? String(customer.email).trim() : ''
  if (!name && !email) {
    return NextResponse.json({ error: 'name 또는 email이 필요합니다' }, { status: 400 })
  }

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.from('customers').insert(customer as never).select('*').single()
    if (error) {
      console.error('[api/admin/customers] insert:', error.message, error.code, error.details)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ customer: data })
  }

  const userSb = createSupabaseClientWithToken(token)
  const { data, error } = await userSb.from('customers').insert(customer as never).select('*').single()
  if (error) {
    console.error('[api/admin/customers] insert (user jwt):', error.message, error.code, error.details)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ customer: data })
}
