import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

const STAFF_EMAIL_WHITELIST = new Set(['info@maniatour.com', 'wooyong.shim09@gmail.com'])

async function callerMayInsertCustomers(userEmail: string | undefined | null): Promise<boolean> {
  if (!userEmail) return false
  const em = userEmail.trim().toLowerCase()
  if (STAFF_EMAIL_WHITELIST.has(em)) return true
  if (!supabaseAdmin) return false
  const { data, error } = await supabaseAdmin
    .from('team')
    .select('id')
    .ilike('email', em)
    .or('is_active.is.null,is_active.eq.true')
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[api/admin/customers] team lookup:', error.message)
    return false
  }
  return !!data
}

/**
 * 관리 화면 전용: 활성 팀·화이트리스트만 고객 생성.
 * 서비스 롤로 INSERT 하여 브라우저 RLS(team↔is_staff 재귀 등)와 무관하게 동작.
 */
export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: '서버 설정 오류(SUPABASE_SERVICE_ROLE_KEY)' }, { status: 500 })
  }

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

  if (!(await callerMayInsertCustomers(user.email))) {
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

  const { data, error } = await supabaseAdmin.from('customers').insert(customer as never).select('*').single()

  if (error) {
    console.error('[api/admin/customers] insert:', error.message, error.code, error.details)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ customer: data })
}
