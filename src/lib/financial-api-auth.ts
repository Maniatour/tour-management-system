import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase-server'

const SUPER_ADMIN_EMAILS = ['info@maniatour.com', 'wooyong.shim09@gmail.com']

export async function assertSuper(
  supabase: ReturnType<typeof createClient>,
  userEmail: string | undefined
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  if (!userEmail) {
    return { ok: false, status: 403, message: '이메일이 없습니다.' }
  }
  const lower = userEmail.toLowerCase().trim()
  if (SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === lower)) {
    return { ok: true }
  }
  const { data: teamData, error } = await supabase
    .from('team')
    .select('position')
    .eq('email', userEmail)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !teamData) {
    return { ok: false, status: 403, message: '팀 정보를 확인할 수 없습니다.' }
  }
  const position = String((teamData as { position?: string }).position ?? '')
    .toLowerCase()
    .trim()
  if (position !== 'super') {
    return { ok: false, status: 403, message: 'Super 권한이 필요합니다.' }
  }
  return { ok: true }
}

/** Bearer 또는 쿠키 세션으로 Supabase + 이메일 확보 */
export async function resolveFinancialApiAuth(request: NextRequest): Promise<
  | { ok: true; supabase: ReturnType<typeof createClient>; userEmail: string }
  | { ok: false; response: NextResponse }
> {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  const resolveCookieSession = async () => {
    const serverSb = await createServerSupabase()
    const {
      data: { session },
    } = await serverSb.auth.getSession()
    if (!session?.user?.email) {
      return null
    }
    return { supabase: serverSb, userEmail: session.user.email }
  }

  if (token) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    )
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token)
    if (userErr || !user?.email) {
      const cookieAuth = await resolveCookieSession()
      if (cookieAuth) {
        return { ok: true, supabase: cookieAuth.supabase, userEmail: cookieAuth.userEmail }
      }
      return { ok: false, response: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }) }
    }
    return { ok: true, supabase, userEmail: user.email }
  }

  const cookieAuth = await resolveCookieSession()
  if (!cookieAuth) {
    return { ok: false, response: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }) }
  }
  return { ok: true, supabase: cookieAuth.supabase, userEmail: cookieAuth.userEmail }
}
