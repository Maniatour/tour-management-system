import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase-server'
import type { Database } from '@/lib/database.types'
import { applyActiveOperatorSession } from '@/lib/operators/applyActiveOperatorSession'

const STAFF_EMAIL_WHITELIST = new Set(['info@maniatour.com', 'wooyong.shim09@gmail.com'])

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/** 프로덕션에서 디버그/테스트 API 차단 */
export function blockDevEndpointsInProduction(): NextResponse | null {
  if (isProduction()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return null
}

/** Cron 엔드포인트 인증 — 프로덕션에서는 CRON_SECRET 필수 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (isProduction()) {
    if (!cronSecret) {
      console.error('[api-security] CRON_SECRET is not configured in production')
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return null
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}

async function isActiveStaff(
  client: SupabaseClient<Database>,
  emailLower: string
): Promise<boolean> {
  if (STAFF_EMAIL_WHITELIST.has(emailLower)) return true

  const { data: staffOk, error: staffErr } = await client.rpc('is_staff', {
    p_email: emailLower,
  })
  if (!staffErr && staffOk) return true

  const { data, error } = await client
    .from('team')
    .select('id')
    .ilike('email', emailLower)
    .or('is_active.is.null,is_active.eq.true')
    .limit(1)
    .maybeSingle()

  return !error && !!data
}

/** 스태프 전용 API — Bearer 또는 쿠키 세션 */
export async function requireStaffApiAuth(request: NextRequest): Promise<
  | { ok: true; userEmail: string }
  | { ok: false; response: NextResponse }
> {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

  let userEmail: string | undefined
  let staffClient: SupabaseClient<Database> | undefined

  if (token) {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    )
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (!error && user?.email) {
      userEmail = user.email
      staffClient = supabase
    }
  }

  if (!userEmail) {
    const serverSb = await createServerSupabase()
    const {
      data: { session },
    } = await serverSb.auth.getSession()
    if (session?.user?.email) {
      userEmail = session.user.email
      staffClient = serverSb
    }
  }

  if (!userEmail || !staffClient) {
    return {
      ok: false,
      response: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }),
    }
  }

  const emailLower = userEmail.trim().toLowerCase()
  if (!(await isActiveStaff(staffClient, emailLower))) {
    return {
      ok: false,
      response: NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 }),
    }
  }

  // Phase 6c.9: request-scoped active operator GUC (prep; no staff RLS lock-down yet)
  await applyActiveOperatorSession(staffClient, request)

  return { ok: true, userEmail }
}
